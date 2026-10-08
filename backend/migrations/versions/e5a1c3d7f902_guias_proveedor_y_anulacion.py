import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "e5a1c3d7f902"
down_revision = "c6d2f8a41b97"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("guia_remision", sa.Column("proveedor_id", sa.Uuid(), nullable=True))
    op.add_column(
        "guia_remision", sa.Column("motivo_anulacion", sa.Text(), nullable=True)
    )
    op.add_column(
        "guia_remision",
        sa.Column("anulada_en", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "guia_remision", sa.Column("usuario_anulacion_id", sa.Uuid(), nullable=True)
    )
    op.create_foreign_key(
        "fk_guia_remision_proveedor_id_dim_proveedor",
        "guia_remision",
        "dim_proveedor",
        ["proveedor_id"],
        ["id"],
        postgresql_not_valid=True,
    )
    op.create_foreign_key(
        "fk_guia_remision_usuario_anulacion_id_dim_usuario",
        "guia_remision",
        "dim_usuario",
        ["usuario_anulacion_id"],
        ["id"],
        postgresql_not_valid=True,
    )


def downgrade():
    op.drop_constraint(
        "fk_guia_remision_usuario_anulacion_id_dim_usuario",
        "guia_remision",
        type_="foreignkey",
    )
    op.drop_constraint(
        "fk_guia_remision_proveedor_id_dim_proveedor",
        "guia_remision",
        type_="foreignkey",
    )
    op.drop_column("guia_remision", "usuario_anulacion_id")
    op.drop_column("guia_remision", "anulada_en")
    op.drop_column("guia_remision", "motivo_anulacion")
    op.drop_column("guia_remision", "proveedor_id")
