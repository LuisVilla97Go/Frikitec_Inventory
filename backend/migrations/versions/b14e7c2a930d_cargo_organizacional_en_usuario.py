import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "b14e7c2a930d"
down_revision = "c3e8a1f5b702"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "dim_usuario",
        sa.Column("cargo", sa.String(length=100), nullable=True),
        if_not_exists=True,
    )


def downgrade():
    op.drop_column("dim_usuario", "cargo", if_exists=True)
