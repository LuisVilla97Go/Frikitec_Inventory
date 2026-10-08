from alembic import op

# revision identifiers, used by Alembic.
revision = "c3e8a1f5b702"
down_revision = "b7d41e6c2a90"
branch_labels = None
depends_on = None

# Repetibles (Squawk, prefer-robust-stmts): DROP IF EXISTS antes de cada ADD
CHECKS_CON_REVALORIZACION = (
    "ALTER TABLE fact_movimiento DROP CONSTRAINT IF EXISTS check_cantidad_no_cero",
    "ALTER TABLE fact_movimiento ADD CONSTRAINT check_cantidad_no_cero "
    "CHECK (cantidad != 0 OR tipo_movimiento = 'REVALORIZACION') NOT VALID",
    "ALTER TABLE fact_movimiento DROP CONSTRAINT IF EXISTS check_signo_cantidad_tipo",
    "ALTER TABLE fact_movimiento ADD CONSTRAINT check_signo_cantidad_tipo CHECK ("
    "((tipo_movimiento IN ('ENTRADA_COMPRA', 'AJUSTE_POSITIVO')) AND cantidad > 0) OR "
    "((tipo_movimiento IN ('SALIDA_VENTA', 'AJUSTE_NEGATIVO')) AND cantidad < 0) OR "
    "(tipo_movimiento = 'REVALORIZACION' AND cantidad = 0) OR "
    "(tipo_movimiento = 'TRANSFERENCIA')) NOT VALID",
)

CHECKS_DE_ANTES = (
    "ALTER TABLE fact_movimiento DROP CONSTRAINT IF EXISTS check_cantidad_no_cero",
    "ALTER TABLE fact_movimiento ADD CONSTRAINT check_cantidad_no_cero "
    "CHECK (cantidad != 0) NOT VALID",
    "ALTER TABLE fact_movimiento DROP CONSTRAINT IF EXISTS check_signo_cantidad_tipo",
    "ALTER TABLE fact_movimiento ADD CONSTRAINT check_signo_cantidad_tipo CHECK ("
    "((tipo_movimiento IN ('ENTRADA_COMPRA', 'AJUSTE_POSITIVO')) AND cantidad > 0) OR "
    "((tipo_movimiento IN ('SALIDA_VENTA', 'AJUSTE_NEGATIVO')) AND cantidad < 0) OR "
    "(tipo_movimiento = 'TRANSFERENCIA')) NOT VALID",
)

VALIDAR = (
    "ALTER TABLE IF EXISTS fact_movimiento VALIDATE CONSTRAINT check_cantidad_no_cero",
    "ALTER TABLE IF EXISTS fact_movimiento VALIDATE CONSTRAINT check_signo_cantidad_tipo",
)


def _rehacer_checks(sentencias: tuple[str, ...]) -> None:
    for sentencia in sentencias:
        op.execute(sentencia)
    with op.get_context().autocommit_block():
        for sentencia in VALIDAR:
            op.execute(sentencia)


def upgrade():

    with op.get_context().autocommit_block():
        op.execute(
            "ALTER TYPE tipo_movimiento_enum "
            "ADD VALUE IF NOT EXISTS 'REVALORIZACION' AFTER 'TRANSFERENCIA'"
        )
    _rehacer_checks(CHECKS_CON_REVALORIZACION)


def downgrade():

    _rehacer_checks(CHECKS_DE_ANTES)
