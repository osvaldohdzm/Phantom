"""Pruebas del parser Nmap → componente_afectado para objetivos M2."""

from types import SimpleNamespace

from app.services.finding_duplicates import _resolve_componente
from app.services.parse_nmap_scan import parse_nmap_bytes

SAMPLE_XML = b"""<?xml version="1.0"?>
<nmaprun scanner="nmap" args="nmap" start="0" version="7.94" xmloutputversion="1.05">
  <host>
    <address addr="10.13.255.23" addrtype="ipv4"/>
    <ports>
      <port protocol="tcp" portid="22">
        <state state="open" reason="syn-ack" reason_ttl="0"/>
        <service name="ssh" product="OpenSSH" version="8.2"/>
      </port>
    </ports>
  </host>
</nmaprun>
"""


def test_nmap_xml_sets_componente_afectado():
    rows = parse_nmap_bytes(SAMPLE_XML, "scan.xml")
    assert len(rows) == 1
    assert rows[0]["componente_afectado"] == "10.13.255.23:22"
    assert rows[0]["host"] == "10.13.255.23"
    assert rows[0]["port"] == "22"


def test_resolve_componente_from_legacy_nmap_raw():
    finding = SimpleNamespace(
        componente_afectado=None,
        raw_tool_output="[Nmap XML] host=10.13.255.23 port=22/tcp service=ssh",
        titulo="Puerto abierto: ssh en 10.13.255.23:22",
    )
    assert _resolve_componente(finding) == "10.13.255.23:22"
