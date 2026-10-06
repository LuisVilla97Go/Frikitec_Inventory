from flask import Flask
from .almacenes import almacenes_bp
from .auth import auth_bp
from .dashboard import dashboard_bp
from .empresa import empresa_bp
from .guias_remision import bp as guias_bp
from .movimientos import movimientos_bp
from .openapi import openapi_bp
from .ordenes_compra import ordenes_compra_bp
from .productos import productos_bp
from .proveedores import proveedores_bp
from .toma_fisica import toma_fisica_bp
from .usuarios import usuarios_bp

__all__ = [
    "almacenes_bp",
    "auth_bp",
    "dashboard_bp",
    "empresa_bp",
    "guias_bp",
    "movimientos_bp",
    "openapi_bp",
    "ordenes_compra_bp",
    "productos_bp",
    "proveedores_bp",
    "registrar_blueprints",
    "toma_fisica_bp",
    "usuarios_bp",
]


def registrar_blueprints(app: Flask) -> None:
    app.register_blueprint(almacenes_bp, url_prefix="/api/almacenes")
    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(usuarios_bp, url_prefix="/api/usuarios")
    app.register_blueprint(productos_bp, url_prefix="/api/productos")
    app.register_blueprint(proveedores_bp, url_prefix="/api/proveedores")
    app.register_blueprint(movimientos_bp, url_prefix="/api/movimientos")
    app.register_blueprint(guias_bp, url_prefix="/api/guias-remision")
    app.register_blueprint(ordenes_compra_bp, url_prefix="/api/ordenes")
    app.register_blueprint(dashboard_bp, url_prefix="/api/dashboard")
    app.register_blueprint(empresa_bp, url_prefix="/api/empresa")
    app.register_blueprint(toma_fisica_bp, url_prefix="/api/tomas-fisicas")
    app.register_blueprint(openapi_bp, url_prefix="/api")