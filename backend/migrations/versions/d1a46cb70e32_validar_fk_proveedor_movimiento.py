from alembic import op

# revision identifiers, used by Alembic.
revision = "d1a46cb70e32"
down_revision = "c52f18b7d640"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        "ALTER TABLE fact_movimiento "
        "VALIDATE CONSTRAINT fk_fact_movimiento_proveedor_id_dim_proveedor"
    )


def downgrade():
    pass
