from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

ZONA_NEGOCIO = ZoneInfo("America/Lima")


def dia_de_negocio(momento: datetime) -> date:

    if momento.tzinfo is None:
        momento = momento.replace(tzinfo=UTC)
    return momento.astimezone(ZONA_NEGOCIO).date()


def inicio_del_dia_utc(dia: date) -> datetime:

    return datetime.combine(dia, time.min, tzinfo=ZONA_NEGOCIO).astimezone(UTC)


def fin_del_dia_utc(dia: date) -> datetime:

    return inicio_del_dia_utc(dia + timedelta(days=1))
