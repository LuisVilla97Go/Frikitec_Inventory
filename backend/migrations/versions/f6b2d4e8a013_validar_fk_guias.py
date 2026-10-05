from alembic import op

# revision identifiers, used by Alembic.
revision = "f6b2d4e8a013"
down_revision = "e5a1c3d7f902"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        "ALTER TABLE guia_remision VALIDATE CONSTRAINT fk_guia_remision_proveedor_id_dim_proveedor"
    )
    op.execute(
        "ALTER TABLE guia_remision "
        "VALIDATE CONSTRAINT fk_guia_remision_usuario_anulacion_id_dim_usuario"
    )


def downgrade():

    pass
