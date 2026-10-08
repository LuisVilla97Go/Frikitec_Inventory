import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "c52f18b7d640"
down_revision = "b14e7c2a930d"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "dim_proveedor",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tipo_documento", sa.String(length=3), nullable=False),
        sa.Column("numero_documento", sa.String(length=11), nullable=False),
        sa.Column("razon_social", sa.String(length=200), nullable=False),
        sa.Column("nombre_comercial", sa.String(length=200), nullable=True),
        sa.Column("contacto", sa.String(length=150), nullable=True),
        sa.Column("telefono", sa.String(length=30), nullable=True),
        sa.Column("correo", sa.String(length=254), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.CheckConstraint(
            "(tipo_documento = 'RUC' AND length(numero_documento) = 11) OR "
            "(tipo_documento = 'DNI' AND length(numero_documento) = 8)",
            name="check_proveedor_documento_longitud",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "tipo_documento", "numero_documento", name="uq_proveedor_documento"
        ),
        if_not_exists=True,
    )
    op.add_column(
        "fact_movimiento",
        sa.Column("proveedor_id", sa.Uuid(), nullable=True),
        if_not_exists=True,
    )
    op.create_foreign_key(
        "fk_fact_movimiento_proveedor_id_dim_proveedor",
        "fact_movimiento",
        "dim_proveedor",
        ["proveedor_id"],
        ["id"],
        ondelete="RESTRICT",
        postgresql_not_valid=True,
    )


def downgrade():
    op.drop_constraint(
        "fk_fact_movimiento_proveedor_id_dim_proveedor",
        "fact_movimiento",
        type_="foreignkey",
    )
    op.drop_column("fact_movimiento", "proveedor_id", if_exists=True)
    op.drop_table("dim_proveedor", if_exists=True)
