from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.core import Finding, FindingStatus, Severity
from app.schemas import AIEnrichRequest, AIEnrichResponse, FindingCreate, FindingRead
from app.services.ai_pipeline import enrich_finding

router = APIRouter(prefix="/findings", tags=["findings"])


@router.get("", response_model=list[FindingRead])
def list_findings(db: Session = Depends(get_db), skip: int = 0, limit: int = 100) -> list[Finding]:
    return db.query(Finding).offset(skip).limit(limit).all()


@router.post("", response_model=FindingRead)
def create_finding(payload: FindingCreate, db: Session = Depends(get_db)) -> Finding:
    f = Finding(
        titulo=payload.titulo,
        descripcion=payload.descripcion,
        severidad=Severity[payload.severidad.name],
        cvss_score=payload.cvss_score,
        cvss_vector=payload.cvss_vector,
        cve=payload.cve,
        cwe=payload.cwe,
        evidencia_url=payload.evidencia_url,
        asset_id=payload.asset_id,
        engagement_id=payload.engagement_id,
        catalog_id=payload.catalog_id,
        raw_tool_output=payload.raw_tool_output,
        status=FindingStatus.abierta,
    )
    db.add(f)
    db.commit()
    db.refresh(f)
    return f


@router.post("/{finding_id}/ai-enrich", response_model=AIEnrichResponse)
def ai_enrich(
    finding_id: UUID,
    body: Optional[AIEnrichRequest] = Body(None),
    db: Session = Depends(get_db),
) -> AIEnrichResponse:
    f = db.get(Finding, finding_id)
    if not f:
        raise HTTPException(status_code=404, detail="Finding not found")
    raw = (body.raw_tool_output if body else None) or f.raw_tool_output or ""
    titulo = (body.titulo if body else None) or f.titulo
    comp = body.componente_afectado if body else None
    result = enrich_finding(raw, titulo, comp)
    f.explicacion_tecnica = str(result["explicacion_tecnica"])
    f.amenaza_ampliada = str(result["amenaza_ampliada"])
    f.owasp_category = str(result["owasp_top10"]) if result.get("owasp_top10") else None
    mitre = result.get("mitre_attack") or []
    f.mitre_technique_id = ",".join(mitre)[:512] if mitre else None
    db.add(f)
    db.commit()
    ow = result.get("owasp_top10")
    return AIEnrichResponse(
        explicacion_tecnica=str(result["explicacion_tecnica"]),
        amenaza_ampliada=str(result["amenaza_ampliada"]),
        owasp_top10=ow if isinstance(ow, str) else None,
        mitre_attack=list(result.get("mitre_attack") or []),
        sugerencia_remediacion=str(result.get("sugerencia_remediacion") or ""),
    )
