import sqlalchemy as sa
from alembic import op

revision = "a3f2c9d4e8b1"
down_revision = "7941d46b874f"
branch_labels = None
depends_on = None


def upgrade():

    op.add_column(
        "dim_almacen",
        sa.Column("codigo_establecimiento", sa.String(length=4), nullable=True),
        if_not_exists=True,
    )

    with op.get_context().autocommit_block():
        op.create_index(
            "uq_dim_almacen_nombre",
            "dim_almacen",
            [sa.text("lower(nombre)")],
            unique=True,
            postgresql_concurrently=True,
            if_not_exists=True,
        )


def downgrade():
    with op.get_context().autocommit_block():
        op.drop_index(
            "uq_dim_almacen_nombre",
            table_name="dim_almacen",
            postgresql_concurrently=True,
            if_exists=True,
        )
    op.drop_column("dim_almacen", "codigo_establecimiento", if_exists=True)
