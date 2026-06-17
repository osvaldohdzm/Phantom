"""Pruebas de parseo CSV universal (delimitador, mapeo Seguimiento, extracción CVE)."""

from app.services.parse_universal_csv import parse_universal_csv_bytes

SEMICOLON_CSV = '''Vulnerabilidad;Descripción;Recomendación
"SQL Injection";"CVE-2024-1234, CWE-89, CVSS 9.8 en producción";"Parchear el ORM"
'''


def test_semicolon_delimiter_with_commas_in_quoted_description():
    rows, column_map = parse_universal_csv_bytes(SEMICOLON_CSV.encode("utf-8"))
    assert column_map.get("title") == "Vulnerabilidad"
    assert column_map.get("description") == "Descripción"
    assert len(rows) == 1
    assert rows[0]["titulo"] == "SQL Injection"
    assert "CVE-2024-1234" in rows[0]["descripcion"]


def test_auto_maps_recomendacion_to_remediation():
    rows, column_map = parse_universal_csv_bytes(SEMICOLON_CSV.encode("utf-8"))
    assert column_map.get("recommendation") == "Recomendación"
    assert column_map.get("remediation") == "Recomendación"
    assert rows[0]["propuesta_remediacion"] == "Parchear el ORM"


def test_extracts_cve_cwe_cvss_from_description():
    rows, _ = parse_universal_csv_bytes(SEMICOLON_CSV.encode("utf-8"))
    row = rows[0]
    assert row["cve"] == "CVE-2024-1234"
    assert row["cwe"] == "CWE-89"
    assert row["cvss_score"] == 9.8


SEGUIMIENTO_ROW = (
    "Estatus,Grupo de Activos,Proyecto,Vulnerabilidad,Severidad,Componentes afectados,"
    "Hosts afectados,Descripción,Tipo de mitigación,Fecha de registro,Herramienta de detección,"
    "Fecha de detección,Tiempo de remediación,Recomendación,Comentarios/Justificación,"
    "Comentarios de Seguridad,Tipo de Activo\n"
    "Nueva,Activos PCI,Americas-management-pci,SSL Medium Strength Cipher Suites Supported (SWEET32),"
    "Alta,10.252.221.3:55000,10.252.221.3,Descripción de prueba,Configuración,2025-12-12,Tenable,"
    "2025-12-12,15 días,Recomendación de prueba,,,Servidor\n"
)


def test_componente_afectado_does_not_merge_hosts_or_asset_group():
    rows, column_map = parse_universal_csv_bytes(SEGUIMIENTO_ROW.encode("utf-8"))
    assert column_map.get("component") == "Componentes afectados"
    assert column_map.get("hosts") == "Hosts afectados"
    assert column_map.get("asset_group") == "Grupo de Activos"
    row = rows[0]
    assert row["componente_afectado"] == "10.252.221.3:55000"
    ctx = row.get("import_context") or {}
    assert ctx.get("host") == "10.252.221.3"
    assert ctx.get("asset_group") == "Activos PCI"
    assert ctx.get("asset_groups") == ["Activos PCI"]
    assert ctx.get("seguimiento_estatus") == "Nueva"
    assert ctx.get("project") == "Americas-management-pci"
    assert ctx.get("asset_type") == "Servidor"
    assert row.get("remediation_context") == "Configuración"
    assert " · " not in (row.get("componente_afectado") or "")
    assert "Hosts afectados" not in (row.get("referencias") or "")


SEGUIMIENTO_MULTI_GROUP = (
    "Grupo de Activos,Sub grupo de Activos,Vulnerabilidad,Severidad,Componentes afectados,Hosts afectados\n"
    "PCI;Indeval,SubA | SubB,Test vuln,Alta,10.92.184.100:80,10.92.184.100\n"
)


def test_asset_groups_and_subgroups_parsed_as_tag_lists():
    rows, column_map = parse_universal_csv_bytes(SEGUIMIENTO_MULTI_GROUP.encode("utf-8"))
    assert column_map.get("asset_group") == "Grupo de Activos"
    assert column_map.get("asset_subgroup") == "Sub grupo de Activos"
    ctx = rows[0].get("import_context") or {}
    assert ctx.get("asset_groups") == ["PCI", "Indeval"]
    assert ctx.get("asset_group") == "PCI"
    assert ctx.get("asset_subgroups") == ["SubA", "SubB"]
    assert ctx.get("asset_subgroup") == "SubA"
