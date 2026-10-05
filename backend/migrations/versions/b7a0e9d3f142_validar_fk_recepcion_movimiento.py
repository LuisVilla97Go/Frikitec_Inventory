from alembic import op

revision = "b7a0e9d3f142"
down_revision = "e7d4c2a910b3"
branch_labels = None
depends_on = None


def upgrade():

    with op.get_context().autocommit_block():
        op.create_index(
            "uq_movimiento_recepcion_compra_linea",
            "fact_movimiento",
            ["recepcion_compra_linea_id"],
            unique=True,
            postgresql_concurrently=True,
            if_not_exists=True,
        )
    op.execute(
        "ALTER TABLE fact_movimiento "
        "VALIDATE CONSTRAINT fk_movimiento_recepcion_compra_linea"
    )


def downgrade():
    with op.get_context().autocommit_block():
        op.drop_index(
            "uq_movimiento_recepcion_compra_linea",
            table_name="fact_movimiento",
            postgresql_concurrently=True,
            if_exists=True,
        )
