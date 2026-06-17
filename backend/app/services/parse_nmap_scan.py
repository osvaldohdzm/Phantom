"""Parse Nmap XML / GNMAP / greppable text into finding drafts (servicios expuestos)."""

from __future__ import annotations

import re
import xml.etree.ElementTree as ET
from typing import Any, Optional

from app.models.core import Severity
from app.services.ingest_common import clamp_title


def _parse_gnmap(text: str, filename: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for line in text.splitlines():
        if "Host:" not in line or "Ports:" not in line:
            continue
        ip_m = re.search(r"Host:\s*([\d.]+)", line)
        if not ip_m:
            continue
        ip = ip_m.group(1)
        ports_part = line.split("Ports:", 1)[1].strip()
        for entry in re.split(r",\s*", ports_part):
            parts = entry.split("/")
            if len(parts) < 2:
                continue
            port_id, state = parts[0].strip(), parts[1].strip()
            if state != "open":
                continue
            servicio = parts[4].strip() if len(parts) > 4 else "unknown"
            version = parts[6].strip() if len(parts) > 6 else ""
            titulo = f"Puerto abierto: {servicio} en {ip}:{port_id}"
            desc = f"Servicio: {servicio}\nVersión: {version or 'N/A'}\nArchivo: {filename}"
            raw = f"[Nmap GNMAP] {entry[:4000]}"
            rows.append(
                {
                    "titulo": clamp_title(titulo),
                    "descripcion": desc,
                    "severidad": Severity.info,
                    "cvss_score": None,
                    "cvss_vector": None,
                    "cve": None,
                    "cwe": None,
                    "raw_tool_output": raw,
                    "tool_source": "Nmap",
                    "tool_vuln_id": f"{servicio}/{port_id}"[:512],
                }
            )
    return rows


def _parse_nmap_xml(text: str, filename: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    try:
        root = ET.fromstring(text)
    except ET.ParseError:
        return []

    for host in root.findall("host"):
        addr: Optional[str] = None
        for a in host.findall("address"):
            if a.get("addrtype") == "ipv4" and a.get("addr"):
                addr = a.get("addr")
                break
        if not addr:
            a0 = host.find("address")
            if a0 is not None and a0.get("addr"):
                addr = a0.get("addr")
        if not addr:
            continue

        for port in host.findall("ports/port"):
            st_el = port.find("state")
            state = st_el.get("state") if st_el is not None else None
            if state != "open":
                continue
            port_id = port.get("portid") or "?"
            svc_el = port.find("service")
            name = svc_el.get("name") if svc_el is not None else "unknown"
            product = (svc_el.get("product") or "") if svc_el is not None else ""
            version = (svc_el.get("version") or "") if svc_el is not None else ""
            extra = (svc_el.get("extrainfo") or "") if svc_el is not None else ""
            ver = " ".join(x for x in (product, version, extra) if x).strip() or "N/A"
            titulo = f"Puerto abierto: {name} en {addr}:{port_id}"
            desc = f"Servicio: {name}\nVersión: {ver}\nArchivo: {filename}"
            raw = f"[Nmap XML] host={addr} port={port_id}/{port.get('protocol','tcp')} service={name} version={ver}"
            rows.append(
                {
                    "titulo": clamp_title(titulo),
                    "descripcion": desc,
                    "severidad": Severity.info,
                    "cvss_score": None,
                    "cvss_vector": None,
                    "cve": None,
                    "cwe": None,
                    "raw_tool_output": raw[:32000],
                    "tool_source": "Nmap",
                    "tool_vuln_id": f"{name}/{port_id}"[:512],
                }
            )
    return rows


def _parse_normal_nmap(text: str, filename: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    current_ip = "Unknown"
    for line in text.splitlines():
        m_ip = re.search(r"Nmap scan report for (?:.*?\(?([\d.]+)\)?|([\d.]+))", line)
        if m_ip:
            current_ip = m_ip.group(1) or m_ip.group(2) or current_ip
        m_port = re.match(r"^\s*(\d+)/(\w+)\s+(\w+)\s+([\w.-]+)\s*(.*)$", line)
        if not m_port:
            continue
        _port_num, _proto, state, svc, rest = m_port.groups()
        if state != "open":
            continue
        titulo = f"Puerto abierto: {svc} en {current_ip}:{m_port.group(1)}"
        desc = f"Servicio: {svc}\nVersión: {rest.strip() or 'N/A'}\nArchivo: {filename}"
        rows.append(
            {
                "titulo": clamp_title(titulo),
                "descripcion": desc,
                "severidad": Severity.info,
                "cvss_score": None,
                "cvss_vector": None,
                "cve": None,
                "cwe": None,
                "raw_tool_output": f"[Nmap texto] {line.strip()[:8000]}",
                "tool_source": "Nmap",
                "tool_vuln_id": f"{svc}/{m_port.group(1)}"[:512],
            }
        )
    return rows


def parse_nmap_bytes(data: bytes, filename: str = "scan") -> list[dict[str, Any]]:
    text = data.decode("utf-8", errors="replace").strip()
    low = filename.lower()
    if low.endswith(".xml") or text.startswith("<?xml") or text.startswith("<nmaprun"):
        return _parse_nmap_xml(text, filename)
    if low.endswith(".gnmap") or ("Host:" in text and "Ports:" in text):
        gn = _parse_gnmap(text, filename)
        if gn:
            return gn
    normal = _parse_normal_nmap(text, filename)
    if normal:
        return normal
    if "Ports:" in text:
        return _parse_gnmap(text, filename)
    return []
