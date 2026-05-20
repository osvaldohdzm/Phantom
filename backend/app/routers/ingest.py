from __future__ import annotations

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.core import Engagement, Finding, FindingStatus
from app.schemas import IngestBatchResponse
from app.services.parse_acunetix_html import parse_acunetix_html_bytes
from app.services.parse_nessus_csv import parse_nessus_csv_bytes
from app.services.parse_nmap_scan import parse_nmap_bytes

router = APIRouter(prefix="/ingest", tags=["ingest"])

MAX_FILE_MB = 50


async def _read_upload(file: UploadFile) -> bytes:
    raw = await file.read()
    if len(raw) > MAX_FILE_MB * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"Archivo mayor a {MAX_FILE_MB} MB")
    return raw


def _persist_drafts(
    db: Session,
    drafts: list[dict],
    engagement_id: Optional[UUID],
) -> list[UUID]:
    if engagement_id is not None:
        eg = db.get(Engagement, engagement_id)
        if not eg:
            raise HTTPException(status_code=404, detail="Engagement no encontrado")

    ids: list[UUID] = []
    chunk: list[Finding] = []
    for d in drafts:
        f = Finding(
            titulo=d["titulo"],
            descripcion=d.get("descripcion"),
            severidad=d["severidad"],
            cvss_score=d.get("cvss_score"),
            cvss_vector=d.get("cvss_vector"),
            cve=d.get("cve"),
            cwe=d.get("cwe"),
            raw_tool_output=d.get("raw_tool_output"),
            engagement_id=engagement_id,
            status=FindingStatus.abierta,
        )
        chunk.append(f)
        if len(chunk) >= 250:
            for x in chunk:
                db.add(x)
            db.commit()
            for x in chunk:
                db.refresh(x)
                ids.append(x.id)
            chunk.clear()
    for x in chunk:
        db.add(x)
    db.commit()
    for x in chunk:
        db.refresh(x)
        ids.append(x.id)
    return ids


@router.post("/nessus-csv", response_model=IngestBatchResponse)
async def ingest_nessus_csv(
    file: UploadFile = File(...),
    engagement_id: Optional[UUID] = Form(None),
    db: Session = Depends(get_db),
) -> IngestBatchResponse:
    data = await _read_upload(file)
    drafts = parse_nessus_csv_bytes(data)
    if not drafts:
        raise HTTPException(
            status_code=400,
            detail="No se extrajeron filas del CSV. Comprueba que sea export Nessus/Tenable (.csv).",
        )
    ids = _persist_drafts(db, drafts, engagement_id)
    return IngestBatchResponse(source="nessus-csv", created_count=len(ids), finding_ids=ids)


@router.post("/acunetix-html", response_model=IngestBatchResponse)
async def ingest_acunetix_html(
    file: UploadFile = File(...),
    engagement_id: Optional[UUID] = Form(None),
    db: Session = Depends(get_db),
) -> IngestBatchResponse:
    data = await _read_upload(file)
    drafts = parse_acunetix_html_bytes(data)
    if not drafts:
        raise HTTPException(
            status_code=400,
            detail="No se encontraron tablas de alertas reconocibles. Exporta el informe HTML con la tabla de vulnerabilidades.",
        )
    ids = _persist_drafts(db, drafts, engagement_id)
    return IngestBatchResponse(source="acunetix-html", created_count=len(ids), finding_ids=ids)


@router.post("/nmap", response_model=IngestBatchResponse)
async def ingest_nmap(
    file: UploadFile = File(...),
    engagement_id: Optional[UUID] = Form(None),
    db: Session = Depends(get_db),
) -> IngestBatchResponse:
    data = await _read_upload(file)
    name = file.filename or "scan"
    drafts = parse_nmap_bytes(data, name)
    if not drafts:
        raise HTTPException(
            status_code=400,
            detail="No se detectaron puertos abiertos. Usa salida XML (-oX), .gnmap o texto estándar de Nmap.",
        )
    ids = _persist_drafts(db, drafts, engagement_id)
    return IngestBatchResponse(
        source="nmap",
        created_count=len(ids),
        finding_ids=ids,
        message="Hallazgos creados con severidad Info (inventario de superficie).",
    )
