import sqlalchemy as sa
from alembic import op

revision = "b7d41e6c2a90"

down_revision = "9f2a5ac675f3"
branch_labels = None
depends_on = None

DINERO = sa.Numeric(precision=15, scale=2)


def upgrade():
    op.add_column(
        "fact_movimiento",
        sa.Column("importe", DINERO, nullable=False, server_default="0"),
        if_not_exists=True,
    )
    op.add_column(
        "fact_movimiento",
        sa.Column("saldo_valorizado", DINERO, nullable=False, server_default="0"),
        if_not_exists=True,
    )
    op.add_column(
        "fact_stock_almacen",
        sa.Column("valor_total", DINERO, nullable=False, server_default="0"),
        if_not_exists=True,
    )

    op.execute("""
        UPDATE fact_movimiento AS m
        SET importe = c.importe, saldo_valorizado = c.saldo
        FROM (
            SELECT id,
                   round(cantidad * costo_unitario * tipo_cambio, 2) AS importe,
                   sum(round(cantidad * costo_unitario * tipo_cambio, 2)) OVER (
                       PARTITION BY producto_id, almacen_id
                       ORDER BY fecha_movimiento, id
                   ) AS saldo
            FROM fact_movimiento
        ) AS c
        WHERE c.id = m.id
        """)
    op.execute("""
        UPDATE fact_stock_almacen AS s
        SET valor_total = u.saldo_valorizado
        FROM (
            SELECT DISTINCT ON (producto_id, almacen_id) producto_id, almacen_id, saldo_valorizado
            FROM fact_movimiento
            ORDER BY producto_id, almacen_id, fecha_movimiento DESC, id DESC
        ) AS u
        WHERE u.producto_id = s.producto_id AND u.almacen_id = s.almacen_id
        """)

    op.execute(
        "ALTER TABLE fact_stock_almacen DROP CONSTRAINT IF EXISTS check_valor_no_negativo"
    )
    op.execute(
        "ALTER TABLE fact_stock_almacen "
        "ADD CONSTRAINT check_valor_no_negativo CHECK (valor_total >= 0) NOT VALID"
    )

    with op.get_context().autocommit_block():
        op.execute(
            "ALTER TABLE IF EXISTS fact_stock_almacen VALIDATE CONSTRAINT check_valor_no_negativo"
        )


def downgrade():
    op.execute(
        "ALTER TABLE fact_stock_almacen DROP CONSTRAINT IF EXISTS check_valor_no_negativo"
    )
    op.drop_column("fact_stock_almacen", "valor_total", if_exists=True)
    op.drop_column("fact_movimiento", "saldo_valorizado", if_exists=True)
    op.drop_column("fact_movimiento", "importe", if_exists=True)
