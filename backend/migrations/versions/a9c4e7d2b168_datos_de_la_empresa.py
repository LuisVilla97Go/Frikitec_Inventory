"""datos de la empresa: una sola ficha editable por un administrador

Revision ID: a9c4e7d2b168
Revises: f3b8d21c6a45
Create Date: 2026-09-28 11:00:00

docs/2026-09-28_mejoras-compras-guias_ABIERTO.md, punto 3: «no tenemos dónde
poner los datos de la empresa». Tabla nueva y vacía: no se siembra nada (un
cambio de datos se pregunta); la llena un administrador desde la pantalla.
"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "a9c4e7d2b168"
down_revision = "f3b8d21c6a45"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "dim_empresa",
        # BIGINT aunque solo haya una fila: Squawk (prefer-bigint-over-smallint) no admite SMALLINT
        sa.Column("id", sa.BigInteger(), autoincrement=False, nullable=False),
        sa.Column("ruc", sa.String(length=11), nullable=False),
        sa.Column("razon_social", sa.String(length=200), nullable=False),
        sa.Column("nombre_comercial", sa.String(length=200), nullable=True),
        sa.Column("direccion_fiscal", sa.String(length=300), nullable=True),
        sa.Column("ubigeo", sa.String(length=6), nullable=True),
        sa.Column("distrito", sa.String(length=100), nullable=True),
        sa.Column("provincia", sa.String(length=100), nullable=True),
        sa.Column("departamento", sa.String(length=100), nullable=True),
        sa.Column("telefono", sa.String(length=30), nullable=True),
        sa.Column("correo", sa.String(length=254), nullable=True),
        sa.Column("web", sa.String(length=200), nullable=True),
        sa.Column("actualizado_por_id", sa.Uuid(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("id = 1", name="check_empresa_una_sola_fila"),
        sa.ForeignKeyConstraint(["actualizado_por_id"], ["dim_usuario.id"]),
        sa.PrimaryKeyConstraint("id"),
        if_not_exists=True,
    )


def downgrade():
    op.drop_table("dim_empresa", if_exists=True)
