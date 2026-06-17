"""Pruebas de parseo Nessus CSV."""

from app.services.parse_nessus_csv import DEFAULT_NESSUS_METODO, parse_nessus_csv_bytes

SAMPLE_CSV = '''Plugin ID,CVE,CVSS v2.0 Base Score,Risk,Host,Protocol,Port,Name,Synopsis,Description,Solution,See Also,Plugin Output,STIG Severity
"10180","","","None","10.1.10.1","tcp","0","Ping the remote host","Synopsis text","Description text","n/a","","The remote host is dead","",""
'''


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
