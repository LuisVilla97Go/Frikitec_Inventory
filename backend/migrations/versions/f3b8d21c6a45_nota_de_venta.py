from alembic import op

# revision identifiers, used by Alembic.
revision = "f3b8d21c6a45"
down_revision = "b7a0e9d3f142"
branch_labels = None
depends_on = None


def upgrade():

    with op.get_context().autocommit_block():
        op.execute(
            "ALTER TYPE tipo_documento_enum "
            "ADD VALUE IF NOT EXISTS 'NOTA_VENTA' AFTER 'AJUSTE_INVENTARIO'"
        )


def downgrade():

    pass
