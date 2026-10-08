import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "c6d2f8a41b97"
down_revision = "a9c4e7d2b168"
branch_labels = None
depends_on = None

ESTADO = postgresql.ENUM(
    "ABIERTO",
    "CONTABILIZADO",
    "ANULADO",
    name="estado_toma_fisica_enum",
    create_type=False,
)


def upgrade():
    op.execute("CREATE SEQUENCE IF NOT EXISTS toma_fisica_numero_seq")
    ESTADO.create(op.get_bind(), checkfirst=True)
    op.create_table(
        "doc_toma_fisica",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("numero", sa.String(length=20), nullable=False),
        sa.Column("almacen_id", sa.Uuid(), nullable=False),
        sa.Column("estado", ESTADO, nullable=False),
        sa.Column("observacion", sa.String(length=300), nullable=True),
        sa.Column("creado_por_id", sa.Uuid(), nullable=False),
        sa.Column("creado_en", sa.DateTime(timezone=True), nullable=False),
        sa.Column("cerrado_por_id", sa.Uuid(), nullable=True),
        sa.Column("cerrado_en", sa.DateTime(timezone=True), nullable=True),
        sa.Column("motivo_anulacion", sa.String(length=300), nullable=True),
        sa.ForeignKeyConstraint(["almacen_id"], ["dim_almacen.id"]),
        sa.ForeignKeyConstraint(["creado_por_id"], ["dim_usuario.id"]),
        sa.ForeignKeyConstraint(["cerrado_por_id"], ["dim_usuario.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("numero"),
        if_not_exists=True,
    )
    op.create_index(
        "ix_doc_toma_fisica_almacen_id",
        "doc_toma_fisica",
        ["almacen_id"],
        if_not_exists=True,
    )
    op.create_table(
        "doc_toma_fisica_linea",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("documento_id", sa.Uuid(), nullable=False),
        sa.Column("producto_id", sa.Uuid(), nullable=False),
        sa.Column("almacen_id", sa.Uuid(), nullable=False),
        sa.Column("abierta", sa.Boolean(), nullable=False),
        sa.Column("stock_sistema", sa.Integer(), nullable=False),
        sa.Column("agregado_en", sa.DateTime(timezone=True), nullable=False),
        sa.Column("cantidad_contada", sa.Integer(), nullable=True),
        sa.Column("contado_por_id", sa.Uuid(), nullable=True),
        sa.Column("contado_en", sa.DateTime(timezone=True), nullable=True),
        sa.Column("diferencia", sa.Integer(), nullable=True),
        sa.Column("movimiento_id", sa.Uuid(), nullable=True),
        sa.CheckConstraint("stock_sistema >= 0", name="check_toma_stock_sistema"),
        sa.CheckConstraint(
            "cantidad_contada IS NULL OR cantidad_contada >= 0",
            name="check_toma_contada",
        ),
        sa.ForeignKeyConstraint(
            ["documento_id"], ["doc_toma_fisica.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["producto_id"], ["dim_producto.id"]),
        sa.ForeignKeyConstraint(["almacen_id"], ["dim_almacen.id"]),
        sa.ForeignKeyConstraint(["contado_por_id"], ["dim_usuario.id"]),
        sa.ForeignKeyConstraint(
            ["movimiento_id"], ["fact_movimiento.id"], ondelete="RESTRICT"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "documento_id", "producto_id", name="uq_toma_linea_producto"
        ),
        sa.UniqueConstraint("movimiento_id"),
        if_not_exists=True,
    )
    op.create_index(
        "ix_doc_toma_fisica_linea_documento_id",
        "doc_toma_fisica_linea",
        ["documento_id"],
        if_not_exists=True,
    )
    op.create_index(
        "ix_doc_toma_fisica_linea_producto_id",
        "doc_toma_fisica_linea",
        ["producto_id"],
        if_not_exists=True,
    )
    op.create_index(
        "uq_toma_linea_abierta",
        "doc_toma_fisica_linea",
        ["almacen_id", "producto_id"],
        unique=True,
        postgresql_where=sa.text("abierta"),
        if_not_exists=True,
    )


def downgrade():
    op.drop_table("doc_toma_fisica_linea", if_exists=True)
    op.drop_table("doc_toma_fisica", if_exists=True)
    ESTADO.drop(op.get_bind(), checkfirst=True)
    op.execute("DROP SEQUENCE IF EXISTS toma_fisica_numero_seq")
