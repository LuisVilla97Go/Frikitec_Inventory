from uuid import UUID
from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from app.schemas.empresa_schema import EmpresaGuardar, EmpresaSalida
from app.services import empresa_service

empresa_bp = Blueprint("empresa", __name__)


@empresa_bp.get("/", strict_slashes=False)
@jwt_required()
def ver_empresa():
    empresa = empresa_service.obtener()
    datos = EmpresaSalida.desde(empresa).model_dump(mode="json") if empresa else None
    return jsonify({"status": "success", "data": datos}), 200


@empresa_bp.put("/", strict_slashes=False)
@jwt_required()
def guardar_empresa():
    datos = EmpresaGuardar.model_validate(request.get_json())
    empresa = empresa_service.guardar(datos, UUID(get_jwt_identity()))
    return (
        jsonify(
            {
                "status": "success",
                "data": EmpresaSalida.desde(empresa).model_dump(mode="json"),
            }
        ),
        200,
    )
