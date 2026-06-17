"""Pruebas de preprocesado de texto para informes Word."""

from app.services.report_text_preprocess import (
    is_report_hyphen_list_line,
    preprocess_report_field,
    strip_bullet_markers,
)


SAMPLE_REMEDIATION = """Se recomienda realizar una migración planificada e inmediata a PHP 8.2.
 - Migrar a PHP 8.2+ o versión con soporte vigente
 - Eliminar versiones obsoletas del sistema
 - Implementar parches virtuales mediante WAF corporativo."""


def test_report_hyphen_list_lines_are_detected():
    assert is_report_hyphen_list_line(" - Migrar a PHP 8.2+")
    assert is_report_hyphen_list_line("  - Eliminar versiones")
    assert not is_report_hyphen_list_line("Migrar a PHP 8.2+")
    assert not is_report_hyphen_list_line("-sin espacio")


def test_strip_bullets_preserves_report_hyphen_items():
    out = strip_bullet_markers(SAMPLE_REMEDIATION)
    assert " - Migrar a PHP 8.2+ o versión con soporte vigente" in out
    assert " - Eliminar versiones obsoletas del sistema" in out
    assert " - Implementar parches virtuales mediante WAF corporativo." in out


def test_preprocess_remediation_keeps_hyphen_lines():
    out = preprocess_report_field(SAMPLE_REMEDIATION, strip_bullets=True)
    assert " - Migrar a PHP 8.2+ o versión con soporte vigente" in out
    assert " - Implementar parches virtuales mediante WAF corporativo." in out
    assert "•" not in out


def test_unicode_bullets_still_stripped():
    raw = "Párrafo intro\n• Primer paso\n• Segundo paso"
    out = strip_bullet_markers(raw)
    assert "•" not in out
    assert "Primer paso" in out
    assert "Segundo paso" in out
