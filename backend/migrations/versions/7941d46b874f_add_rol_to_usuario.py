import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "7941d46b874f"
down_revision = "50181cd99d14"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("dim_usuario", schema=None) as batch_op:
        batch_op.add_column(sa.Column("rol", sa.String(length=20), nullable=True))

    op.execute("UPDATE dim_usuario SET rol = 'ADMIN' WHERE is_admin = true")
    op.execute(
        "UPDATE dim_usuario SET rol = 'TRABAJADOR' WHERE is_admin = false OR is_admin IS NULL"
    )

    with op.batch_alter_table("dim_usuario", schema=None) as batch_op:
        batch_op.alter_column("rol", nullable=False)
        batch_op.drop_column("is_admin")


def downgrade():
    with op.batch_alter_table("dim_usuario", schema=None) as batch_op:
        batch_op.add_column(sa.Column("is_admin", sa.Boolean(), nullable=True))

    op.execute("UPDATE dim_usuario SET is_admin = (rol IN ('SUPERADMIN', 'ADMIN'))")

    with op.batch_alter_table("dim_usuario", schema=None) as batch_op:
        batch_op.alter_column("is_admin", nullable=False)
        batch_op.drop_column("rol")
