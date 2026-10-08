import unicodedata
from datetime import UTC, datetime
from decimal import Decimal
from uuid import UUID, uuid4
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload
from app.extensions import db
from app.models.almacen import DimAlmacen
from app.models.movimiento import TipoDocumento, TipoMovimiento
from app.models.orden_compra import (
    AprobacionOrdenCompra,
    CierreSaldoOrdenCompra,
    OrdenCompra,
    OrdenCompraLinea,
    OrdenCompraVersion,
    RecepcionCompra,
    RecepcionCompraLinea,
)
from app.models.producto import DimProducto
from app.models.proveedor import DimProveedor
from app.models.usuario import DimUsuario
from app.schemas.movimiento_schema import MovimientoCreate
from app.schemas.orden_compra_schema import (
    AdjuntarFacturaEntrada,
    CancelarOrdenEntrada,
    CerrarSaldoEntrada,
    DecidirAprobacion,
    OrdenCompraCrear,
    RecepcionCompraEntrada,
)
from app.services import movimientos_service
from app.services.errores import (
    DatosInvalidos,
    ErrorDeNegocio,
    NoEncontrado,
    SinPermiso,
)
from app.services.fechas import dia_de_negocio

CARGOS_APROBACION = (
    "Jefe de Almacén",
    "Jefe de Tienda",
    "Responsable del Presupuesto",
)
CARGO_ALMACEN = CARGOS_APROBACION[0]


def listar(page: int, per_page: int) -> tuple[list[dict], int]:
    total = db.session.execute(db.select(func.count(OrdenCompra.id))).scalar_one()
    filas = db.session.execute(
        db.select(OrdenCompra, OrdenCompraVersion)
        .join(
            OrdenCompraVersion,
            (OrdenCompraVersion.orden_id == OrdenCompra.id)
            & (OrdenCompraVersion.numero_version == OrdenCompra.version_actual),
        )
        .order_by(OrdenCompra.created_at.desc(), OrdenCompra.id.desc())
        .limit(per_page)
        .offset((page - 1) * per_page)
    ).all()
    return [_resumen(orden, version) for orden, version in filas], total


def detalle(orden_id: UUID) -> dict:
    orden = _obtener_orden(orden_id)
    versiones = list(
        db.session.execute(
            db.select(OrdenCompraVersion)
            .where(OrdenCompraVersion.orden_id == orden.id)
            .options(
                selectinload(OrdenCompraVersion.lineas).selectinload(
                    OrdenCompraLinea.almacen_previsto
                ),
                selectinload(OrdenCompraVersion.aprobaciones).selectinload(
                    AprobacionOrdenCompra.aprobador
                ),
            )
            .order_by(OrdenCompraVersion.numero_version.desc())
        ).scalars()
    )
    version = next(
        (v for v in versiones if v.numero_version == orden.version_actual), None
    )
    if version is None:
        raise NoEncontrado("Versión de orden no encontrada")
    recibos = db.session.execute(
        db.select(RecepcionCompra)
        .join(OrdenCompraVersion, RecepcionCompra.version_id == OrdenCompraVersion.id)
        .where(OrdenCompraVersion.orden_id == orden.id)
        .options(
            selectinload(RecepcionCompra.lineas).selectinload(
                RecepcionCompraLinea.almacen
            ),
            selectinload(RecepcionCompra.lineas).selectinload(
                RecepcionCompraLinea.orden_linea
            ),
        )
        .order_by(RecepcionCompra.fecha_recepcion.desc(), RecepcionCompra.id)
    ).scalars()
    recibidos, cerrados = _cantidades_por_producto(orden.id)
    versiones_salida = [
        {
            "id": str(v.id),
            "number": v.numero_version,
            "supplier_id": str(v.proveedor_id),
            "supplier_document": v.proveedor_documento_snapshot,
            "supplier_name": v.proveedor_nombre_snapshot,
            "currency": v.moneda,
            "exchange_rate": str(v.tipo_cambio),
            "status": v.estado,
            "created_at": v.created_at.isoformat(),
            "submitted_at": v.enviado_at.isoformat() if v.enviado_at else None,
            "approved_at": v.aprobado_at.isoformat() if v.aprobado_at else None,
            "issued_at": v.emitido_at.isoformat() if v.emitido_at else None,
            "cancellation_reason": v.motivo_cancelacion,
            "lines": [
                _salida_linea(
                    linea,
                    recibidos.get(linea.producto_id, 0),
                    cerrados.get(linea.producto_id, 0),
                )
                for linea in v.lineas
            ],
            "approvals": [_salida_aprobacion(a) for a in v.aprobaciones],
        }
        for v in versiones
    ]
    actual_salida = next(
        v for v in versiones_salida if v["number"] == version.numero_version
    )
    return {
        **_resumen(orden, version),
        "version": {
            **actual_salida,
            "currency": version.moneda,
            "exchange_rate": str(version.tipo_cambio),
        },
        "versions": versiones_salida,
        "receipts": [_salida_recepcion(r) for r in recibos],
    }


def crear(datos: OrdenCompraCrear, usuario_id: UUID) -> dict:
    actor = _usuario_activo(usuario_id)
    orden_id = uuid4()
    orden = OrdenCompra()
    orden.id = orden_id
    orden.numero = f"OC-{orden_id.hex[:12].upper()}"
    orden.creador_id = actor.id
    orden.version_actual = 1
    orden.estado = "BORRADOR"
    db.session.add(orden)
    db.session.flush()
    _nueva_version(orden, datos, 1, actor.id)
    _confirmar("No se pudo crear la orden")
    return detalle(orden.id)


def guardar_borrador(orden_id: UUID, datos: OrdenCompraCrear, usuario_id: UUID) -> dict:
    actor = _usuario_activo(usuario_id)
    orden = _obtener_orden(orden_id, bloquear=True)
    _exigir_creador(orden, actor)
    anterior = _version_actual(orden, bloquear=True)
    if orden.estado == "PENDIENTE_APROBACION":
        raise ErrorDeNegocio("No se puede editar una orden mientras espera firmas")
    if orden.estado in {"CANCELADA", "RECIBIDA", "CERRADA_PARCIALMENTE"}:
        raise ErrorDeNegocio("No se puede editar una orden cancelada o cerrada")

    if anterior.estado == "BORRADOR":
        _reemplazar_lineas(anterior, datos)
        _actualizar_proveedor(anterior, datos.proveedor_id)
    else:
        _validar_nueva_version(orden, anterior, datos)
        anterior_numero = anterior.numero_version
        version = _nueva_version(orden, datos, anterior_numero + 1, actor.id)
        orden.version_actual = version.numero_version
    orden.estado = "BORRADOR"
    _confirmar("No se pudo guardar la orden")
    return detalle(orden.id)


def enviar(orden_id: UUID, usuario_id: UUID) -> dict:
    actor = _usuario_activo(usuario_id)
    orden = _obtener_orden(orden_id, bloquear=True)
    if actor.id != orden.creador_id:
        raise SinPermiso("Solo quien prepara la orden puede enviarla a aprobación")
    version = _version_actual(orden, bloquear=True)
    if version.estado != "BORRADOR" or not version.lineas:
        raise ErrorDeNegocio("La orden debe tener líneas y estar en borrador")
    proveedor = db.session.get(DimProveedor, version.proveedor_id)
    if proveedor is None or not proveedor.is_active:
        raise DatosInvalidos("Selecciona un proveedor activo antes de enviar")
    for linea in sorted(version.lineas, key=lambda item: item.producto_id.hex):
        producto = db.session.get(DimProducto, linea.producto_id, with_for_update=True)
        if producto is None or not producto.is_active:
            raise DatosInvalidos(
                "Una línea contiene un producto desactivado; corrige el borrador"
            )

    asignados: set[UUID] = set()
    aprobaciones = []
    usuarios = db.session.execute(
        db.select(DimUsuario).where(DimUsuario.is_active.is_(True))
    ).scalars()
    activos = list(usuarios)
    for etapa, cargo in enumerate(CARGOS_APROBACION, start=1):
        candidatos = [
            u for u in activos if _normalizar_cargo(u.cargo) == _normalizar_cargo(cargo)
        ]
        candidatos = [
            u for u in candidatos if u.id != actor.id and u.id not in asignados
        ]
        if len(candidatos) != 1:
            raise DatosInvalidos(
                f"No se puede enviar: asigna exactamente una cuenta activa distinta al creador "
                f"para el cargo {cargo}"
            )
        aprobador = candidatos[0]
        asignados.add(aprobador.id)
        aprobacion = AprobacionOrdenCompra()
        aprobacion.version_id = version.id
        aprobacion.etapa = etapa
        aprobacion.cargo_snapshot = cargo
        aprobacion.aprobador_id = aprobador.id
        aprobacion.estado = "PENDIENTE"
        aprobaciones.append(aprobacion)

    ahora = datetime.now(UTC)
    version.estado = orden.estado = "PENDIENTE_APROBACION"
    version.enviado_at = ahora
    db.session.add_all(aprobaciones)
    _confirmar("No se pudo enviar la orden a aprobación")
    return detalle(orden.id)


def decidir(orden_id: UUID, datos: DecidirAprobacion, usuario_id: UUID) -> dict:
    actor = _usuario_activo(usuario_id)
    orden = _obtener_orden(orden_id, bloquear=True)
    version = _version_actual(orden, bloquear=True)
    if version.estado != "PENDIENTE_APROBACION":
        raise ErrorDeNegocio("La orden no está esperando aprobación")
    aprobaciones = list(
        db.session.execute(
            db.select(AprobacionOrdenCompra)
            .where(AprobacionOrdenCompra.version_id == version.id)
            .order_by(AprobacionOrdenCompra.etapa)
            .with_for_update()
        ).scalars()
    )
    pendiente = next((a for a in aprobaciones if a.estado == "PENDIENTE"), None)
    if pendiente is None or pendiente.aprobador_id != actor.id:
        raise SinPermiso("Esta aprobación no está asignada a tu cuenta")
    if _normalizar_cargo(actor.cargo) != _normalizar_cargo(pendiente.cargo_snapshot):
        raise SinPermiso("Tu cargo ya no coincide con la etapa asignada")
    if actor.id == orden.creador_id:
        raise SinPermiso("No puedes aprobar una orden que preparaste")

    pendiente.decidido_at = datetime.now(UTC)
    pendiente.comentario = datos.comentario
    if datos.decision == "RECHAZAR":
        pendiente.estado = "RECHAZADA"
        for siguiente in aprobaciones:
            if siguiente.etapa > pendiente.etapa and siguiente.estado == "PENDIENTE":
                siguiente.estado = "CANCELADA"
                siguiente.comentario = "Etapa cancelada por rechazo anterior"
                siguiente.decidido_at = pendiente.decidido_at
        version.estado = orden.estado = "RECHAZADA"
    else:
        pendiente.estado = "APROBADA"
        if all(a.estado == "APROBADA" for a in aprobaciones):
            ahora = datetime.now(UTC)
            version.estado = orden.estado = "APROBADA"
            version.aprobado_at = ahora
    _confirmar("No se pudo registrar la decisión")
    return detalle(orden.id)


def emitir(orden_id: UUID, usuario_id: UUID) -> dict:
    actor = _usuario_activo(usuario_id)
    orden = _obtener_orden(orden_id, bloquear=True)
    if orden.creador_id != actor.id:
        raise SinPermiso("Solo quien preparó la orden puede marcarla como emitida")
    version = _version_actual(orden, bloquear=True)
    if version.estado != "APROBADA":
        raise ErrorDeNegocio(
            "La orden debe completar las tres firmas antes de emitirla"
        )
    ahora = datetime.now(UTC)
    version.estado = orden.estado = "EMITIDA"
    version.emitido_at = ahora
    _confirmar("No se pudo emitir la orden")
    return detalle(orden.id)


def crear_recepcion(
    orden_id: UUID, datos: RecepcionCompraEntrada, usuario_id: UUID
) -> dict:
    actor = _usuario_activo(usuario_id)
    _exigir_cargo(actor, CARGO_ALMACEN)
    orden = _obtener_orden(orden_id, bloquear=True)
    version = _version_actual(orden, bloquear=True)
    if version.estado not in {"EMITIDA", "PARCIALMENTE_RECIBIDA"}:
        raise ErrorDeNegocio("Solo se recibe una orden emitida o parcialmente recibida")
    lineas_orden, nombres_almacen = _validar_recepcion(orden, version, datos)

    recepcion = RecepcionCompra()
    recepcion.version_id = version.id
    recepcion.usuario_id = actor.id
    recepcion.fecha_recepcion = datos.fecha_recepcion
    recepcion.numero_guia = datos.numero_guia
    recepcion.fecha_guia = datos.fecha_guia
    recepcion.numero_factura = datos.numero_factura
    recepcion.fecha_factura = datos.fecha_factura
    recepcion.estado = "BORRADOR"
    db.session.add(recepcion)
    db.session.flush()
    _agregar_lineas_recepcion(recepcion, datos, lineas_orden, nombres_almacen)
    _confirmar("No se pudo guardar la recepción")
    return detalle(orden.id)


def editar_recepcion(
    orden_id: UUID, recepcion_id: UUID, datos: RecepcionCompraEntrada, usuario_id: UUID
) -> dict:
    actor = _usuario_activo(usuario_id)
    _exigir_cargo(actor, CARGO_ALMACEN)
    orden = _obtener_orden(orden_id, bloquear=True)
    version = _version_actual(orden, bloquear=True)
    recepcion = db.session.get(RecepcionCompra, recepcion_id, with_for_update=True)
    if recepcion is None or recepcion.version.orden_id != orden.id:
        raise NoEncontrado("Recepción no encontrada")
    if recepcion.estado != "BORRADOR" or recepcion.usuario_id != actor.id:
        raise SinPermiso(
            "Solo quien registró el borrador puede corregirlo antes de contabilizar"
        )
    if recepcion.version_id != version.id or version.estado not in {
        "EMITIDA",
        "PARCIALMENTE_RECIBIDA",
    }:
        raise ErrorDeNegocio("La recepción no pertenece a una versión emitida vigente")
    lineas_orden, nombres_almacen = _validar_recepcion(orden, version, datos)
    db.session.execute(
        db.delete(RecepcionCompraLinea).where(
            RecepcionCompraLinea.recepcion_id == recepcion.id
        )
    )
    db.session.expire(recepcion, ["lineas"])
    recepcion.fecha_recepcion = datos.fecha_recepcion
    recepcion.numero_guia = datos.numero_guia
    recepcion.fecha_guia = datos.fecha_guia
    recepcion.numero_factura = datos.numero_factura
    recepcion.fecha_factura = datos.fecha_factura
    _agregar_lineas_recepcion(recepcion, datos, lineas_orden, nombres_almacen)
    _confirmar("No se pudo corregir la recepción")
    return detalle(orden.id)


def _validar_recepcion(
    orden: OrdenCompra, version: OrdenCompraVersion, datos: RecepcionCompraEntrada
) -> tuple[dict[UUID, OrdenCompraLinea], dict[UUID, str]]:
    if datos.fecha_recepcion > dia_de_negocio(datetime.now(UTC)):
        raise DatosInvalidos("La fecha de recepción no puede ser futura")
    lineas_orden = {linea.id: linea for linea in version.lineas}
    recibidos, cerrados = _cantidades_por_producto(orden.id)
    aceptados_en_solicitud: dict[UUID, int] = {}
    nombres_almacen: dict[UUID, str] = {}
    for entrada in datos.lineas:
        linea = lineas_orden.get(entrada.orden_linea_id)
        if linea is None:
            raise DatosInvalidos(
                "La recepción contiene una línea que no pertenece a la versión emitida"
            )
        almacen = db.session.get(DimAlmacen, entrada.almacen_id)
        if almacen is None or not almacen.is_active:
            raise NoEncontrado("Selecciona un almacén activo")
        nombres_almacen[almacen.id] = almacen.nombre
        acumulada = (
            aceptados_en_solicitud.get(linea.producto_id, 0) + entrada.cantidad_aceptada
        )
        limite = (
            linea.cantidad_solicitada
            - recibidos.get(linea.producto_id, 0)
            - cerrados.get(linea.producto_id, 0)
        )
        if acumulada > limite:
            raise DatosInvalidos(
                "La cantidad aceptada supera el saldo pendiente de la orden"
            )
        aceptados_en_solicitud[linea.producto_id] = acumulada
    return lineas_orden, nombres_almacen


def _agregar_lineas_recepcion(
    recepcion: RecepcionCompra,
    datos: RecepcionCompraEntrada,
    lineas_orden: dict[UUID, OrdenCompraLinea],
    nombres_almacen: dict[UUID, str],
) -> None:
    for entrada in datos.lineas:
        linea = lineas_orden[entrada.orden_linea_id]
        recepcion_linea = RecepcionCompraLinea()
        recepcion_linea.recepcion_id = recepcion.id
        recepcion_linea.orden_linea_id = linea.id
        recepcion_linea.almacen_id = entrada.almacen_id
        recepcion_linea.almacen_snapshot = nombres_almacen[entrada.almacen_id]
        recepcion_linea.cantidad_aceptada = entrada.cantidad_aceptada
        recepcion_linea.cantidad_rechazada = entrada.cantidad_rechazada
        recepcion_linea.motivo_rechazo = entrada.motivo_rechazo
        recepcion_linea.costo_unitario = linea.costo_unitario
        db.session.add(recepcion_linea)


def contabilizar_recepcion(
    orden_id: UUID, recepcion_id: UUID, usuario_id: UUID
) -> dict:
    actor = _usuario_activo(usuario_id)
    _exigir_cargo(actor, CARGO_ALMACEN)
    orden = _obtener_orden(orden_id, bloquear=True)
    version = _version_actual(orden, bloquear=True)
    recepcion = db.session.get(RecepcionCompra, recepcion_id, with_for_update=True)
    if recepcion is None or recepcion.version.orden_id != orden.id:
        raise NoEncontrado("Recepción no encontrada")
    if recepcion.estado == "CONTABILIZADA":
        return detalle(orden.id)
    if recepcion.version_id != version.id:
        raise ErrorDeNegocio(
            "La recepción pertenece a una versión anterior de la orden"
        )
    if version.estado not in {"EMITIDA", "PARCIALMENTE_RECIBIDA"}:
        raise ErrorDeNegocio("La versión de la orden no admite recepciones")
    if not recepcion.numero_guia and not recepcion.numero_factura:
        raise DatosInvalidos("Para contabilizar indica una guía o una factura")

    lineas = list(
        db.session.execute(
            db.select(RecepcionCompraLinea)
            .where(RecepcionCompraLinea.recepcion_id == recepcion.id)
            .order_by(RecepcionCompraLinea.id)
            .with_for_update()
        ).scalars()
    )
    orden_lineas = {
        linea.id: linea
        for linea in db.session.execute(
            db.select(OrdenCompraLinea).where(OrdenCompraLinea.version_id == version.id)
        ).scalars()
    }
    recibidos, cerrados = _cantidades_por_producto(orden.id)
    actuales: dict[UUID, int] = {}
    for linea in lineas:
        order_line = orden_lineas.get(linea.orden_linea_id)
        if order_line is None:
            raise DatosInvalidos("La recepción no coincide con la versión emitida")
        actuales[order_line.producto_id] = (
            actuales.get(order_line.producto_id, 0) + linea.cantidad_aceptada
        )
    for order_line in orden_lineas.values():
        disponible = (
            order_line.cantidad_solicitada
            - recibidos.get(order_line.producto_id, 0)
            - cerrados.get(order_line.producto_id, 0)
        )
        if actuales.get(order_line.producto_id, 0) > disponible:
            raise DatosInvalidos(
                "La recepción excede el saldo pendiente; actualiza el borrador"
            )

    lineas.sort(
        key=lambda linea: (
            orden_lineas[linea.orden_linea_id].producto_id.hex,
            linea.almacen_id.hex,
            linea.id.hex,
        )
    )
    for linea in lineas:
        if linea.cantidad_aceptada == 0:
            continue
        order_line = orden_lineas[linea.orden_linea_id]
        doc_tipo, doc_numero = _documento_movimiento(recepcion)
        movimiento = MovimientoCreate(
            almacen_id=linea.almacen_id,
            proveedor_id=version.proveedor_id,
            tipo_movimiento=TipoMovimiento.ENTRADA_COMPRA,
            tipo_documento=doc_tipo,
            numero_documento=doc_numero,
            cantidad=linea.cantidad_aceptada,
            costo_unitario=Decimal(linea.costo_unitario),
            moneda="PEN",
            tipo_cambio=Decimal("1"),
        )
        movimientos_service.registrar_sin_confirmar(
            order_line.producto_id,
            movimiento,
            actor.id,
            recepcion_compra_linea_id=linea.id,
        )

    recepcion.estado = "CONTABILIZADA"
    recepcion.contabilizada_at = datetime.now(UTC)
    recepcion.contabilizada_por_id = actor.id
    db.session.flush()
    _actualizar_estado_recibido(orden, version)
    _confirmar("No se pudo contabilizar la recepción")
    return detalle(orden.id)


def adjuntar_factura(
    orden_id: UUID,
    recepcion_id: UUID,
    datos: AdjuntarFacturaEntrada,
    usuario_id: UUID,
) -> dict:
    actor = _usuario_activo(usuario_id)
    _exigir_cargo(actor, CARGO_ALMACEN)
    orden = _obtener_orden(orden_id, bloquear=True)
    recepcion = db.session.get(RecepcionCompra, recepcion_id, with_for_update=True)
    if recepcion is None or recepcion.version.orden_id != orden.id:
        raise NoEncontrado("Recepción no encontrada")
    if recepcion.estado != "CONTABILIZADA":
        raise ErrorDeNegocio(
            "La factura posterior se asocia a una recepción contabilizada"
        )
    if recepcion.numero_factura:
        if recepcion.numero_factura != datos.numero_factura:
            raise ErrorDeNegocio(
                "La referencia de factura de esta recepción ya está registrada"
            )
        if recepcion.fecha_factura and recepcion.fecha_factura != datos.fecha_factura:
            raise ErrorDeNegocio("La fecha de la factura ya está registrada")
        if recepcion.fecha_factura is None and datos.fecha_factura is not None:
            recepcion.fecha_factura = datos.fecha_factura
            _confirmar("No se pudo completar la fecha de factura")
        return detalle(orden.id)
    recepcion.numero_factura = datos.numero_factura
    recepcion.fecha_factura = datos.fecha_factura
    _confirmar("No se pudo asociar la factura")
    return detalle(orden.id)


def cancelar(orden_id: UUID, datos: CancelarOrdenEntrada, usuario_id: UUID) -> dict:
    actor = _usuario_activo(usuario_id)
    orden = _obtener_orden(orden_id, bloquear=True)
    _exigir_creador(orden, actor)
    version = _version_actual(orden, bloquear=True)
    if orden.estado in {
        "CANCELADA",
        "RECIBIDA",
        "PARCIALMENTE_RECIBIDA",
        "CERRADA_PARCIALMENTE",
    }:
        raise ErrorDeNegocio("La orden ya tiene recepción o está cerrada")
    recibidos, _cerrados = _cantidades_por_producto(orden.id)
    if sum(recibidos.values()) > 0:
        raise ErrorDeNegocio(
            "Una orden con unidades recibidas no se cancela; cierra su saldo abierto"
        )
    for aprobacion in version.aprobaciones:
        if aprobacion.estado == "PENDIENTE":
            aprobacion.estado = "CANCELADA"
            aprobacion.comentario = datos.motivo
            aprobacion.decidido_at = datetime.now(UTC)
    version.estado = orden.estado = "CANCELADA"
    version.motivo_cancelacion = datos.motivo
    _confirmar("No se pudo cancelar la orden")
    return detalle(orden.id)


def cerrar_saldo(orden_id: UUID, datos: CerrarSaldoEntrada, usuario_id: UUID) -> dict:
    actor = _usuario_activo(usuario_id)
    _exigir_cargo(actor, CARGO_ALMACEN)
    orden = _obtener_orden(orden_id, bloquear=True)
    version = _version_actual(orden, bloquear=True)
    if version.estado not in {"EMITIDA", "PARCIALMENTE_RECIBIDA"}:
        raise ErrorDeNegocio("Solo se puede cerrar el saldo de una orden emitida")
    lineas_orden = {linea.id: linea for linea in version.lineas}
    recibidos, cerrados = _cantidades_por_producto(orden.id)
    for entrada in datos.lineas:
        linea = lineas_orden.get(entrada.orden_linea_id)
        if linea is None:
            raise DatosInvalidos("La línea no pertenece a la versión vigente")
        abierto = (
            linea.cantidad_solicitada
            - recibidos.get(linea.producto_id, 0)
            - cerrados.get(linea.producto_id, 0)
        )
        if entrada.cantidad_cerrada != abierto:
            raise DatosInvalidos(
                "El cierre debe cubrir todo el saldo pendiente de esa línea"
            )
        cierre = CierreSaldoOrdenCompra()
        cierre.orden_linea_id = linea.id
        cierre.cantidad_cerrada = entrada.cantidad_cerrada
        cierre.motivo = datos.motivo
        cierre.usuario_id = actor.id
        db.session.add(cierre)
    db.session.flush()
    _actualizar_estado_recibido(orden, version)
    _confirmar("No se pudo cerrar el saldo de la orden")
    return detalle(orden.id)


def _nueva_version(
    orden: OrdenCompra, datos: OrdenCompraCrear, numero: int, usuario_id: UUID
) -> OrdenCompraVersion:
    proveedor = _proveedor_activo(datos.proveedor_id)
    version = OrdenCompraVersion()
    version.orden_id = orden.id
    version.numero_version = numero
    version.proveedor_id = proveedor.id
    version.proveedor_documento_snapshot = proveedor.numero_documento
    version.proveedor_nombre_snapshot = proveedor.razon_social
    version.moneda = "PEN"
    version.tipo_cambio = Decimal("1")
    version.estado = "BORRADOR"
    version.creado_por_id = usuario_id
    db.session.add(version)
    db.session.flush()
    _agregar_lineas(version, datos)
    return version


def _reemplazar_lineas(version: OrdenCompraVersion, datos: OrdenCompraCrear) -> None:
    lineas = _construir_lineas(version, datos)
    db.session.execute(
        db.delete(OrdenCompraLinea).where(OrdenCompraLinea.version_id == version.id)
    )
    db.session.expire(version, ["lineas"])
    db.session.add_all(lineas)


def _agregar_lineas(version: OrdenCompraVersion, datos: OrdenCompraCrear) -> None:
    db.session.add_all(_construir_lineas(version, datos))


def _construir_lineas(
    version: OrdenCompraVersion, datos: OrdenCompraCrear
) -> list[OrdenCompraLinea]:
    vistos: set[UUID] = set()
    lineas = []
    for entrada in datos.lineas:
        if entrada.producto_id in vistos:
            raise DatosInvalidos("Cada producto debe aparecer una sola vez por versión")
        vistos.add(entrada.producto_id)
        producto = db.session.get(DimProducto, entrada.producto_id)
        almacen = db.session.get(DimAlmacen, entrada.almacen_previsto_id)
        if producto is None or not producto.is_active:
            raise NoEncontrado("Selecciona un producto activo")
        if almacen is None or not almacen.is_active:
            raise NoEncontrado("Selecciona un almacén activo")
        linea = OrdenCompraLinea()
        linea.version_id = version.id
        linea.producto_id = producto.id
        linea.almacen_previsto_id = almacen.id
        linea.almacen_previsto_snapshot = almacen.nombre
        linea.sku_snapshot = producto.sku
        linea.producto_snapshot = producto.nombre
        linea.cantidad_solicitada = entrada.cantidad_solicitada
        linea.costo_unitario = entrada.costo_unitario
        lineas.append(linea)
    return lineas


def _actualizar_proveedor(version: OrdenCompraVersion, proveedor_id: UUID) -> None:
    proveedor = _proveedor_activo(proveedor_id)
    version.proveedor_id = proveedor.id
    version.proveedor_documento_snapshot = proveedor.numero_documento
    version.proveedor_nombre_snapshot = proveedor.razon_social


def _validar_nueva_version(
    orden: OrdenCompra, anterior: OrdenCompraVersion, datos: OrdenCompraCrear
) -> None:
    _proveedor_activo(datos.proveedor_id)
    if datos.proveedor_id != anterior.proveedor_id:
        raise DatosInvalidos("Para cambiar de proveedor crea una orden de compra nueva")
    recibidos, cerrados = _cantidades_por_producto(orden.id)
    nuevas = {linea.producto_id: linea for linea in datos.lineas}
    if len(nuevas) != len(datos.lineas):
        raise DatosInvalidos("Cada producto debe aparecer una sola vez por versión")
    anteriores = {linea.producto_id: linea for linea in anterior.lineas}
    for producto_id in anteriores.keys() | recibidos.keys() | cerrados.keys():
        cantidad_existente = recibidos.get(producto_id, 0) + cerrados.get(
            producto_id, 0
        )
        nueva = nuevas.get(producto_id)
        if cantidad_existente > 0 and nueva is None:
            raise DatosInvalidos(
                "No puedes retirar una línea con unidades recibidas o cerradas"
            )
        if nueva is not None and nueva.cantidad_solicitada < cantidad_existente:
            raise DatosInvalidos(
                "La nueva versión no puede reducir unidades recibidas o cerradas"
            )


def _actualizar_estado_recibido(
    orden: OrdenCompra, version: OrdenCompraVersion
) -> None:
    recibidos, cerrados = _cantidades_por_producto(orden.id)
    abierto = sum(
        linea.cantidad_solicitada
        - recibidos.get(linea.producto_id, 0)
        - cerrados.get(linea.producto_id, 0)
        for linea in version.lineas
    )
    total_recibido = sum(recibidos.values())
    total_cerrado = sum(cerrados.values())
    if abierto == 0:
        estado = "CERRADA_PARCIALMENTE" if total_cerrado else "RECIBIDA"
    elif total_recibido:
        estado = "PARCIALMENTE_RECIBIDA"
    else:
        estado = "EMITIDA"
    version.estado = orden.estado = estado


def _cantidades_por_producto(orden_id: UUID) -> tuple[dict[UUID, int], dict[UUID, int]]:
    filas_recibidas = db.session.execute(
        db.select(
            OrdenCompraLinea.producto_id,
            func.sum(RecepcionCompraLinea.cantidad_aceptada),
        )
        .join(
            RecepcionCompraLinea,
            RecepcionCompraLinea.orden_linea_id == OrdenCompraLinea.id,
        )
        .join(RecepcionCompra, RecepcionCompra.id == RecepcionCompraLinea.recepcion_id)
        .join(OrdenCompraVersion, OrdenCompraVersion.id == OrdenCompraLinea.version_id)
        .where(
            OrdenCompraVersion.orden_id == orden_id,
            RecepcionCompra.estado == "CONTABILIZADA",
        )
        .group_by(OrdenCompraLinea.producto_id)
    ).all()
    filas_cerradas = db.session.execute(
        db.select(
            OrdenCompraLinea.producto_id,
            func.sum(CierreSaldoOrdenCompra.cantidad_cerrada),
        )
        .join(
            CierreSaldoOrdenCompra,
            CierreSaldoOrdenCompra.orden_linea_id == OrdenCompraLinea.id,
        )
        .join(OrdenCompraVersion, OrdenCompraVersion.id == OrdenCompraLinea.version_id)
        .where(OrdenCompraVersion.orden_id == orden_id)
        .group_by(OrdenCompraLinea.producto_id)
    ).all()
    return (
        {producto_id: int(cantidad or 0) for producto_id, cantidad in filas_recibidas},
        {producto_id: int(cantidad or 0) for producto_id, cantidad in filas_cerradas},
    )


def _salida_linea(linea: OrdenCompraLinea, recibido: int, cerrado: int) -> dict:
    return {
        "id": str(linea.id),
        "product_id": str(linea.producto_id),
        "sku": linea.sku_snapshot,
        "product_name": linea.producto_snapshot,
        "warehouse_id": str(linea.almacen_previsto_id),
        "warehouse_name": linea.almacen_previsto_snapshot,
        "quantity_ordered": linea.cantidad_solicitada,
        "quantity_received": recibido,
        "quantity_closed": cerrado,
        "quantity_open": max(0, linea.cantidad_solicitada - recibido - cerrado),
        "unit_cost": str(linea.costo_unitario),
    }


def _salida_aprobacion(aprobacion: AprobacionOrdenCompra) -> dict:
    return {
        "id": str(aprobacion.id),
        "stage": aprobacion.etapa,
        "cargo": aprobacion.cargo_snapshot,
        "approver_id": str(aprobacion.aprobador_id),
        "approver_name": f"{aprobacion.aprobador.nombres} {aprobacion.aprobador.apellidos}",
        "status": aprobacion.estado,
        "comment": aprobacion.comentario,
        "decided_at": (
            aprobacion.decidido_at.isoformat() if aprobacion.decidido_at else None
        ),
    }


def _salida_recepcion(recepcion: RecepcionCompra) -> dict:
    return {
        "id": str(recepcion.id),
        "status": recepcion.estado,
        "arrival_date": recepcion.fecha_recepcion.isoformat(),
        "guide_number": recepcion.numero_guia,
        "guide_date": (
            recepcion.fecha_guia.isoformat() if recepcion.fecha_guia else None
        ),
        "invoice_number": recepcion.numero_factura,
        "invoice_date": (
            recepcion.fecha_factura.isoformat() if recepcion.fecha_factura else None
        ),
        "posted_at": (
            recepcion.contabilizada_at.isoformat()
            if recepcion.contabilizada_at
            else None
        ),
        "created_at": recepcion.created_at.isoformat(),
        "created_by_id": str(recepcion.usuario_id),
        "posted_by_id": (
            str(recepcion.contabilizada_por_id)
            if recepcion.contabilizada_por_id
            else None
        ),
        "lines": [
            {
                "id": str(linea.id),
                "order_line_id": str(linea.orden_linea_id),
                "sku": linea.orden_linea.sku_snapshot,
                "product_name": linea.orden_linea.producto_snapshot,
                "warehouse_id": str(linea.almacen_id),
                "warehouse_name": linea.almacen_snapshot,
                "quantity_accepted": linea.cantidad_aceptada,
                "quantity_rejected": linea.cantidad_rechazada,
                "rejection_reason": linea.motivo_rechazo,
                "unit_cost": str(linea.costo_unitario),
            }
            for linea in recepcion.lineas
        ],
    }


def _resumen(orden: OrdenCompra, version: OrdenCompraVersion) -> dict:
    return {
        "id": str(orden.id),
        "number": orden.numero,
        "status": orden.estado,
        "version_number": version.numero_version,
        "created_by_id": str(orden.creador_id),
        "created_at": orden.created_at.isoformat(),
        "supplier_name": version.proveedor_nombre_snapshot,
    }


def _documento_movimiento(recepcion: RecepcionCompra) -> tuple[TipoDocumento, str]:
    if recepcion.numero_guia:
        return TipoDocumento.GUIA_REMISION, recepcion.numero_guia
    if recepcion.numero_factura:
        return TipoDocumento.FACTURA, recepcion.numero_factura
    raise DatosInvalidos("Para contabilizar indica una guía o una factura")


def _version_actual(orden: OrdenCompra, bloquear: bool = False) -> OrdenCompraVersion:
    consulta = db.select(OrdenCompraVersion).where(
        OrdenCompraVersion.orden_id == orden.id,
        OrdenCompraVersion.numero_version == orden.version_actual,
    )
    if bloquear:
        consulta = consulta.with_for_update()
    version = db.session.execute(consulta).scalar_one_or_none()
    if version is None:
        raise NoEncontrado("Versión de orden no encontrada")
    return version


def _obtener_orden(orden_id: UUID, bloquear: bool = False) -> OrdenCompra:
    orden = db.session.get(OrdenCompra, orden_id, with_for_update=bloquear)
    if orden is None:
        raise NoEncontrado("Orden de compra no encontrada")
    return orden


def _proveedor_activo(proveedor_id: UUID) -> DimProveedor:
    proveedor = db.session.get(DimProveedor, proveedor_id)
    if proveedor is None or not proveedor.is_active:
        raise NoEncontrado("Proveedor no encontrado o inactivo")
    return proveedor


def _usuario_activo(usuario_id: UUID) -> DimUsuario:
    usuario = db.session.get(DimUsuario, usuario_id)
    if usuario is None or not usuario.is_active:
        raise SinPermiso("Tu usuario está desactivado")
    return usuario


def _exigir_creador(orden: OrdenCompra, actor: DimUsuario) -> None:
    if orden.creador_id != actor.id:
        raise SinPermiso("Solo quien preparó la orden puede editarla")


def _exigir_cargo(actor: DimUsuario, cargo: str) -> None:
    if _normalizar_cargo(actor.cargo) != _normalizar_cargo(cargo):
        raise SinPermiso(f"Solo el cargo {cargo} puede realizar esta acción")


def _normalizar_cargo(cargo: str | None) -> str:
    if not cargo:
        return ""
    normalizado = unicodedata.normalize("NFKD", cargo)
    sin_tildes = "".join(c for c in normalizado if not unicodedata.combining(c))
    return " ".join(sin_tildes.casefold().split())


def _confirmar(mensaje: str) -> None:
    try:
        db.session.commit()
    except IntegrityError as e:
        db.session.rollback()
        raise ErrorDeNegocio(mensaje) from e
