from app.services.catalog_from_draft import draft_to_catalog_payload, draft_tool_identity


def test_draft_to_catalog_payload_nessus():
    draft = {
        "titulo": "OpenSSL Logjam",
        "descripcion": "Weak DH",
        "severidad": "High",
        "tool_source": "Nessus",
        "tool_vuln_id": "87501",
        "cve": "CVE-2015-4000",
    }
    row = draft_to_catalog_payload(draft)
    assert row["NessusPluginId"] == "87501"
    assert row["StandardVulnerabilityName"] == "OpenSSL Logjam"
    assert row["EspSeveridadUnificada"] == "Alta"


def test_draft_to_catalog_payload_acunetix():
    draft = {
        "titulo": "SQL Injection",
        "descripcion": "Blind SQLi",
        "severidad": "Critical",
        "tool_source": "Acunetix",
        "tool_vuln_id": "SQL Injection",
    }
    row = draft_to_catalog_payload(draft)
    assert row["AcunetixName"] == "SQL Injection"
    assert row["SourceDetection"] == "Acunetix"


def test_draft_tool_identity_from_raw():
    draft = {
        "tool_source": "Nessus",
        "raw_tool_output": "Plugin ID: 12345\nHost: 10.0.0.1",
    }
    src, vid = draft_tool_identity(draft)
    assert src == "nessus"
    assert vid == "12345"
