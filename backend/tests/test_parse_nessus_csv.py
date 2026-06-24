"""Pruebas de parseo Nessus CSV."""

from app.services.parse_nessus_csv import (
    DEFAULT_NESSUS_METODO,
    parse_nessus_csv_bytes,
    parse_nessus_scan_targets_csv_bytes,
)

SAMPLE_CSV = '''Plugin ID,CVE,CVSS v2.0 Base Score,Risk,Host,Protocol,Port,Name,Synopsis,Description,Solution,See Also,Plugin Output,STIG Severity
"10180","","","None","10.1.10.1","tcp","0","Ping the remote host","Synopsis text","Description text","n/a","","The remote host is dead","",""
'''

TARGETS_CSV = '''Plugin ID,CVE,CVSS v2.0 Base Score,Risk,Host,Protocol,Port,Name,Synopsis,Description,Solution,See Also,Plugin Output,STIG Severity
"10180","","","None","10.1.10.1","tcp","0","Ping the remote host","Synopsis text","Description text","n/a","","The remote host is dead","",""
"19506","","","None","10.1.10.1","tcp","22","SSH","Synopsis","Desc","n/a","","","",""
"19506","","","None","10.1.10.2","tcp","443","HTTPS","Synopsis","Desc","n/a","","","",""
'''


def test_nessus_targets_only_dedupes_host_port():
    rows = parse_nessus_scan_targets_csv_bytes(TARGETS_CSV.encode("utf-8"))
    assert len(rows) == 3
    keys = {r["componente_afectado"] for r in rows}
    assert "10.1.10.1:0" in keys or "10.1.10.1" in keys
    assert any("10.1.10.2" in k for k in keys)


def test_nessus_plugin_output_maps_to_raw_tool_output_only():
    rows = parse_nessus_csv_bytes(SAMPLE_CSV.encode("utf-8"))
    assert len(rows) == 1
    row = rows[0]
    assert row["metodo_deteccion"] == DEFAULT_NESSUS_METODO
    assert row["raw_tool_output"] is not None
    assert "remote host is dead" in row["raw_tool_output"]
    assert "Plugin ID" not in row["raw_tool_output"]
    assert "[Nessus CSV]" not in row["raw_tool_output"]


def test_nessus_empty_plugin_output_yields_no_salidas():
    csv_no_output = SAMPLE_CSV.replace(
        "The remote host is dead",
        "",
    )
    rows = parse_nessus_csv_bytes(csv_no_output.encode("utf-8"))
    assert rows[0]["raw_tool_output"] is None
