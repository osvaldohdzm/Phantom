import uuid
from typing import List, Optional
from sqlalchemy.orm import Session

from app.models.core import Engagement, Finding, Asset, Severity
from app.models.execution_log import ExecutionLog
from app.models.evidence import ComplianceMapping, EvidenceAttachment
from app.models.auth import Tenant
from app.services.tenant_branding import display_name, normalize_branding

class ReportGenerator:
    def generate_html_report(self, engagement_id: uuid.UUID, db: Session) -> str:
        engagement = db.query(Engagement).filter(Engagement.id == engagement_id).first()
        if not engagement:
            raise ValueError("Engagement no encontrado")

        branding = {}
        tenant = db.get(Tenant, engagement.tenant_id) if engagement.tenant_id else None
        if tenant:
            branding = normalize_branding(tenant.branding)

        accent = branding.get("primary_color") or branding.get("accent_color") or "#3b82f6"
        company = (
            branding.get("report_company_name")
            or branding.get("workspace_name")
            or (display_name(branding, tenant.nombre) if tenant else engagement.cliente)
        )
        classification = branding.get("report_classification") or "CONFIDENCIAL"
        footer = branding.get("report_footer") or ""
        watermark = branding.get("report_watermark") or classification

        findings = db.query(Finding).filter(Finding.engagement_id == engagement_id).all()
        
        # Obtener activos asociados
        asset_ids = [f.asset_id for f in findings if f.asset_id]
        assets = db.query(Asset).filter(Asset.id.in_(asset_ids)).all() if asset_ids else []

        logs = db.query(ExecutionLog).filter(ExecutionLog.engagement_id == engagement_id).order_by(ExecutionLog.executed_at.asc()).all()

        # Contador de severidad
        sev_counts = {"Critical": 0, "High": 0, "Medium": 0, "Low": 0, "Info": 0}
        for f in findings:
            sev_name = f.severidad.value
            if sev_name in sev_counts:
                sev_counts[sev_name] += 1

        # Construir HTML
        html = f"""<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reporte de Pentest - {engagement.cliente}</title>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            background-color: #0b0f19;
            color: #f3f4f6;
            margin: 0;
            padding: 40px;
            line-height: 1.6;
        }}
        .watermark {{
            position: fixed;
            top: 40%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-35deg);
            font-size: 4rem;
            opacity: 0.06;
            pointer-events: none;
            white-space: nowrap;
            z-index: 0;
        }}
        .container {{
            max-width: 1000px;
            margin: 0 auto;
            position: relative;
            z-index: 1;
        }}
        .header {{
            text-align: center;
            border-bottom: 2px solid {accent};
            padding-bottom: 20px;
            margin-bottom: 40px;
        }}
        .header h1 {{
            font-size: 2.5em;
            color: {accent};
            margin: 0 0 10px 0;
        }}
        .header .company {{
            font-size: 1.1em;
            color: #e5e7eb;
            margin: 0 0 6px 0;
        }}
        .header .classification {{
            display: inline-block;
            font-size: 0.75em;
            letter-spacing: 0.12em;
            text-transform: uppercase;
            border: 1px solid {accent};
            color: {accent};
            padding: 4px 10px;
            border-radius: 4px;
        }}
        .header p {{
            font-size: 1.2em;
            color: #9ca3af;
            margin: 10px 0 0 0;
        }}
        .card {{
            background: rgba(30, 41, 59, 0.5);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            padding: 30px;
            margin-bottom: 30px;
            backdrop-filter: blur(10px);
        }}
        h2 {{
            color: #60a5fa;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            padding-bottom: 10px;
            margin-top: 0;
        }}
        table {{
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }}
        th, td {{
            text-align: left;
            padding: 12px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }}
        th {{
            background-color: rgba(59, 130, 246, 0.2);
            color: #60a5fa;
        }}
        .badge {{
            display: inline-block;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.85em;
            font-weight: bold;
        }}
        .badge-Critical {{ background-color: #ef4444; color: #ffffff; }}
        .badge-High {{ background-color: #f97316; color: #ffffff; }}
        .badge-Medium {{ background-color: #eab308; color: #000000; }}
        .badge-Low {{ background-color: #3b82f6; color: #ffffff; }}
        .badge-Info {{ background-color: #6b7280; color: #ffffff; }}
        .finding {{
            border-left: 4px solid #ef4444;
            padding-left: 20px;
            margin-bottom: 40px;
        }}
        .finding-High {{ border-left-color: #f97316; }}
        .finding-Medium {{ border-left-color: #eab308; }}
        .finding-Low {{ border-left-color: #3b82f6; }}
        .finding-Info {{ border-left-color: #6b7280; }}
        .terminal-block {{
            background-color: #011627;
            font-family: "Courier New", Courier, monospace;
            padding: 15px;
            border-radius: 6px;
            overflow-x: auto;
            border: 1px solid rgba(255, 255, 255, 0.05);
            color: #ecc48d;
        }}
    </style>
</head>
<body>
    <div class="watermark">{watermark}</div>
    <div class="container">
        <div class="header">
            <p class="company">{company}</p>
            <span class="classification">{classification}</span>
            <h1>Reporte de Pruebas de Penetración</h1>
            <p>{engagement.cliente}</p>
        </div>

        <div class="card">
            <h2>Resumen del Proyecto</h2>
            <table>
                <tr><th>Cliente</th><td>{engagement.cliente}</td></tr>
                <tr><th>Fecha de Inicio</th><td>{engagement.fecha_inicio}</td></tr>
                <tr><th>Fecha de Finalización</th><td>{engagement.fecha_fin or 'En progreso'}</td></tr>
                <tr><th>Tipo de Caja</th><td>{engagement.tipo.value}</td></tr>
            </table>
        </div>

        <div class="card">
            <h2>Resumen Ejecutivo de Vulnerabilidades</h2>
            <table>
                <tr>
                    <th>Critical</th>
                    <th>High</th>
                    <th>Medium</th>
                    <th>Low</th>
                    <th>Info</th>
                </tr>
                <tr>
                    <td><span class="badge badge-Critical">{sev_counts["Critical"]}</span></td>
                    <td><span class="badge badge-High">{sev_counts["High"]}</span></td>
                    <td><span class="badge badge-Medium">{sev_counts["Medium"]}</span></td>
                    <td><span class="badge badge-Low">{sev_counts["Low"]}</span></td>
                    <td><span class="badge badge-Info">{sev_counts["Info"]}</span></td>
                </tr>
            </table>
        </div>

        <div class="card">
            <h2>Activos Evaluados</h2>
            <table>
                <thead>
                    <tr>
                        <th>Nombre</th>
                        <th>IP Pública</th>
                        <th>IP Privada</th>
                        <th>SO</th>
                        <th>Criticidad</th>
                    </tr>
                </thead>
                <tbody>"""

        for asset in assets:
            html += f"""
                    <tr>
                        <td>{asset.nombre}</td>
                        <td>{asset.ip_publica or 'n/a'}</td>
                        <td>{asset.ip_privada or 'n/a'}</td>
                        <td>{asset.os or 'n/a'}</td>
                        <td>{asset.criticidad or 'Media'}</td>
                    </tr>"""

        html += """
                </tbody>
            </table>
        </div>

        <div class="card">
            <h2>Detalle de Hallazgos</h2>"""

        for f in findings:
            html += f"""
            <div class="finding finding-{f.severidad.value}">
                <h3>{f.titulo} <span class="badge badge-{f.severidad.value}">{f.severidad.value}</span></h3>
                <p><strong>Estado:</strong> {f.status.value}</p>
                <p><strong>Descripción:</strong> {f.descripcion or 'Sin descripción disponible.'}</p>
                {f'<p><strong>CVE:</strong> {f.cve}</p>' if f.cve else ''}
                {f'<p><strong>CWE:</strong> {f.cwe}</p>' if f.cwe else ''}
                {f'<p><strong>CVSS Score:</strong> {f.cvss_score}</p>' if f.cvss_score else ''}
                
                <h4>Evidencia de Consola</h4>
                {f'<div class="terminal-block"><pre>{f.raw_tool_output}</pre></div>' if f.raw_tool_output else '<p>No se incluye salida de consola.</p>'}
                
                {f'<h5>Explicación AI</h5><p>{f.explicacion_tecnica}</p>' if f.explicacion_tecnica else ''}
            </div>"""

        html += """
        </div>

        <div class="card">
            <h2>Cadena de Ataque Logística (Interactive Replicator)</h2>
            <div class="terminal-block">
                <pre>"""

        if not logs:
            html += "No se registran comandos de cadena de ataque."
        else:
            for l in logs:
                html += f"[{l.executed_at.strftime('%Y-%m-%d %H:%M:%S')}] {l.executed_by} ejecutó:\n$ {l.command}\n"
                if l.raw_output:
                    trunc = l.raw_output[:500] + "\n[... SALIDA TRUNCADA ...]" if len(l.raw_output) > 500 else l.raw_output
                    html += f"--- SALIDA ---\n{trunc}\n---------------\n\n"

        html += """</pre>
            </div>
        </div>
"""
        if footer:
            html += f"""        <div class="card" style="margin-top:40px;text-align:center;font-size:0.9em;color:#9ca3af;">
            <p>{footer}</p>
        </div>
"""
        html += """    </div>
</body>
</html>"""

        return html

report_generator = ReportGenerator()
