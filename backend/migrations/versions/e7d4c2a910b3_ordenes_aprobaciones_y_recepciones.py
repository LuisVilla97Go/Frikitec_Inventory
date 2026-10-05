import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "e7d4c2a910b3"
down_revision = "d1a46cb70e32"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "fact_orden_compra",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("numero", sa.String(length=32), nullable=False),
        sa.Column("creador_id", sa.Uuid(), nullable=False),
        sa.Column("version_actual", sa.Integer(), nullable=False),
        sa.Column("estado", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "version_actual > 0", name="check_orden_version_actual_positiva"
        ),
        sa.CheckConstraint(
            "estado IN ('BORRADOR', 'PENDIENTE_APROBACION', 'APROBADA', 'EMITIDA', "
            "'PARCIALMENTE_RECIBIDA', 'RECIBIDA', 'CERRADA_PARCIALMENTE', 'RECHAZADA', 'CANCELADA')",
            name="check_orden_estado",
        ),
        sa.ForeignKeyConstraint(
            ["creador_id"], ["dim_usuario.id"], ondelete="RESTRICT"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("numero", name="uq_fact_orden_compra_numero"),
        if_not_exists=True,
    )
    op.create_table(
        "fact_orden_compra_version",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("orden_id", sa.Uuid(), nullable=False),
        sa.Column("numero_version", sa.Integer(), nullable=False),
        sa.Column("proveedor_id", sa.Uuid(), nullable=False),
        sa.Column("proveedor_documento_snapshot", sa.String(length=11), nullable=False),
        sa.Column("proveedor_nombre_snapshot", sa.String(length=200), nullable=False),
        sa.Column("moneda", sa.String(length=3), nullable=False),
        sa.Column("tipo_cambio", sa.Numeric(precision=10, scale=4), nullable=False),
        sa.Column("estado", sa.String(length=32), nullable=False),
        sa.Column("creado_por_id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("enviado_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("aprobado_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("emitido_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("motivo_cancelacion", sa.String(length=500), nullable=True),
        sa.CheckConstraint("numero_version > 0", name="check_orden_version_positiva"),
        sa.CheckConstraint("moneda = 'PEN'", name="check_orden_moneda_pen"),
        sa.CheckConstraint("tipo_cambio = 1", name="check_orden_tipo_cambio_uno"),
        sa.CheckConstraint(
            "estado IN ('BORRADOR', 'PENDIENTE_APROBACION', 'APROBADA', 'EMITIDA', "
            "'PARCIALMENTE_RECIBIDA', 'RECIBIDA', 'CERRADA_PARCIALMENTE', 'RECHAZADA', 'CANCELADA')",
            name="check_orden_version_estado",
        ),
        sa.ForeignKeyConstraint(
            ["orden_id"], ["fact_orden_compra.id"], ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["proveedor_id"], ["dim_proveedor.id"], ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["creado_por_id"], ["dim_usuario.id"], ondelete="RESTRICT"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "orden_id", "numero_version", name="uq_orden_version_numero"
        ),
        if_not_exists=True,
    )
    op.create_index(
        "ix_fact_orden_compra_version_orden_id",
        "fact_orden_compra_version",
        ["orden_id"],
        if_not_exists=True,
    )
    op.create_table(
        "fact_orden_compra_linea",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("version_id", sa.Uuid(), nullable=False),
        sa.Column("producto_id", sa.Uuid(), nullable=False),
        sa.Column("almacen_previsto_id", sa.Uuid(), nullable=False),
        sa.Column("almacen_previsto_snapshot", sa.String(length=100), nullable=False),
        sa.Column("sku_snapshot", sa.String(length=50), nullable=False),
        sa.Column("producto_snapshot", sa.String(length=200), nullable=False),
        sa.Column("cantidad_solicitada", sa.Integer(), nullable=False),
        sa.Column("costo_unitario", sa.Numeric(precision=15, scale=4), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "cantidad_solicitada > 0", name="check_orden_linea_cantidad_positiva"
        ),
        sa.CheckConstraint(
            "costo_unitario >= 0", name="check_orden_linea_costo_no_negativo"
        ),
        sa.ForeignKeyConstraint(
            ["version_id"], ["fact_orden_compra_version.id"], ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["producto_id"], ["dim_producto.id"], ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["almacen_previsto_id"], ["dim_almacen.id"], ondelete="RESTRICT"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "version_id", "producto_id", name="uq_orden_version_producto"
        ),
        if_not_exists=True,
    )
    op.create_index(
        "ix_fact_orden_compra_linea_version_id",
        "fact_orden_compra_linea",
        ["version_id"],
        if_not_exists=True,
    )
    op.create_table(
        "fact_orden_compra_aprobacion",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("version_id", sa.Uuid(), nullable=False),
        sa.Column("etapa", sa.Integer(), nullable=False),
        sa.Column("cargo_snapshot", sa.String(length=100), nullable=False),
        sa.Column("aprobador_id", sa.Uuid(), nullable=False),
        sa.Column("estado", sa.String(length=16), nullable=False),
        sa.Column("comentario", sa.String(length=500), nullable=True),
        sa.Column("decidido_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("etapa BETWEEN 1 AND 3", name="check_aprobacion_etapa"),
        sa.CheckConstraint(
            "estado IN ('PENDIENTE', 'APROBADA', 'RECHAZADA', 'CANCELADA')",
            name="check_aprobacion_estado",
        ),
        sa.ForeignKeyConstraint(
            ["version_id"], ["fact_orden_compra_version.id"], ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["aprobador_id"], ["dim_usuario.id"], ondelete="RESTRICT"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("version_id", "etapa", name="uq_aprobacion_version_etapa"),
        sa.UniqueConstraint(
            "version_id", "aprobador_id", name="uq_aprobacion_version_aprobador"
        ),
        if_not_exists=True,
    )
    op.create_index(
        "ix_fact_orden_compra_aprobacion_version_id",
        "fact_orden_compra_aprobacion",
        ["version_id"],
        if_not_exists=True,
    )
    op.create_table(
        "fact_recepcion_compra",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("version_id", sa.Uuid(), nullable=False),
        sa.Column("usuario_id", sa.Uuid(), nullable=False),
        sa.Column("fecha_recepcion", sa.Date(), nullable=False),
        sa.Column("numero_guia", sa.String(length=100), nullable=True),
        sa.Column("fecha_guia", sa.Date(), nullable=True),
        sa.Column("numero_factura", sa.String(length=100), nullable=True),
        sa.Column("fecha_factura", sa.Date(), nullable=True),
        sa.Column("estado", sa.String(length=16), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("contabilizada_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("contabilizada_por_id", sa.Uuid(), nullable=True),
        sa.CheckConstraint(
            "estado IN ('BORRADOR', 'CONTABILIZADA')",
            name="check_recepcion_compra_estado",
        ),
        sa.CheckConstraint(
            "numero_guia IS NULL OR length(numero_guia) > 0",
            name="check_recepcion_guia_no_vacia",
        ),
        sa.CheckConstraint(
            "numero_factura IS NULL OR length(numero_factura) > 0",
            name="check_recepcion_factura_no_vacia",
        ),
        sa.ForeignKeyConstraint(
            ["version_id"], ["fact_orden_compra_version.id"], ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["usuario_id"], ["dim_usuario.id"], ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["contabilizada_por_id"], ["dim_usuario.id"], ondelete="RESTRICT"
        ),
        sa.PrimaryKeyConstraint("id"),
        if_not_exists=True,
    )
    op.create_index(
        "ix_fact_recepcion_compra_version_id",
        "fact_recepcion_compra",
        ["version_id"],
        if_not_exists=True,
    )
    op.create_table(
        "fact_recepcion_compra_linea",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("recepcion_id", sa.Uuid(), nullable=False),
        sa.Column("orden_linea_id", sa.Uuid(), nullable=False),
        sa.Column("almacen_id", sa.Uuid(), nullable=False),
        sa.Column("almacen_snapshot", sa.String(length=100), nullable=False),
        sa.Column("cantidad_aceptada", sa.Integer(), nullable=False),
        sa.Column("cantidad_rechazada", sa.Integer(), nullable=False),
        sa.Column("motivo_rechazo", sa.String(length=300), nullable=True),
        sa.Column("costo_unitario", sa.Numeric(precision=15, scale=4), nullable=False),
        sa.CheckConstraint(
            "cantidad_aceptada >= 0 AND cantidad_rechazada >= 0 AND "
            "(cantidad_aceptada + cantidad_rechazada) > 0",
            name="check_recepcion_linea_cantidades",
        ),
        sa.CheckConstraint(
            "costo_unitario >= 0", name="check_recepcion_linea_costo_no_negativo"
        ),
        sa.ForeignKeyConstraint(
            ["recepcion_id"], ["fact_recepcion_compra.id"], ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["orden_linea_id"], ["fact_orden_compra_linea.id"], ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["almacen_id"], ["dim_almacen.id"], ondelete="RESTRICT"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "recepcion_id",
            "orden_linea_id",
            "almacen_id",
            name="uq_recepcion_linea_destino",
        ),
        if_not_exists=True,
    )
    op.create_index(
        "ix_fact_recepcion_compra_linea_recepcion_id",
        "fact_recepcion_compra_linea",
        ["recepcion_id"],
        if_not_exists=True,
    )
    op.create_index(
        "ix_fact_recepcion_compra_linea_orden_linea_id",
        "fact_recepcion_compra_linea",
        ["orden_linea_id"],
        if_not_exists=True,
    )
    op.create_table(
        "fact_orden_compra_cierre_saldo",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("orden_linea_id", sa.Uuid(), nullable=False),
        sa.Column("cantidad_cerrada", sa.Integer(), nullable=False),
        sa.Column("motivo", sa.String(length=500), nullable=False),
        sa.Column("usuario_id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "cantidad_cerrada > 0", name="check_orden_cierre_cantidad_positiva"
        ),
        sa.ForeignKeyConstraint(
            ["orden_linea_id"], ["fact_orden_compra_linea.id"], ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["usuario_id"], ["dim_usuario.id"], ondelete="RESTRICT"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("orden_linea_id", name="uq_orden_cierre_linea"),
        if_not_exists=True,
    )
    op.add_column(
        "fact_movimiento",
        sa.Column("recepcion_compra_linea_id", sa.Uuid(), nullable=True),
        if_not_exists=True,
    )
    op.create_foreign_key(
        "fk_movimiento_recepcion_compra_linea",
        "fact_movimiento",
        "fact_recepcion_compra_linea",
        ["recepcion_compra_linea_id"],
        ["id"],
        ondelete="RESTRICT",
        postgresql_not_valid=True,
    )


def downgrade():
    op.drop_constraint(
        "fk_movimiento_recepcion_compra_linea", "fact_movimiento", type_="foreignkey"
    )
    op.drop_column("fact_movimiento", "recepcion_compra_linea_id", if_exists=True)
    op.drop_table("fact_orden_compra_cierre_saldo", if_exists=True)
    op.drop_table("fact_recepcion_compra_linea", if_exists=True)
    op.drop_table("fact_recepcion_compra", if_exists=True)
    op.drop_table("fact_orden_compra_aprobacion", if_exists=True)
    op.drop_table("fact_orden_compra_linea", if_exists=True)
    op.drop_table("fact_orden_compra_version", if_exists=True)
    op.drop_table("fact_orden_compra", if_exists=True)
