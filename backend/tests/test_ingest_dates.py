"""Pruebas de parseo de fechas en ingesta."""

from datetime import datetime, timezone

from app.services.ingest_common import parse_datetime_maybe


def test_parse_datetime_maybe_iso_date():
    dt = parse_datetime_maybe("2025-12-12")
    assert dt == datetime(2025, 12, 12, tzinfo=timezone.utc)


def test_parse_datetime_maybe_slash_date():
    dt = parse_datetime_maybe("12/12/2025")
    assert dt == datetime(2025, 12, 12, tzinfo=timezone.utc)
