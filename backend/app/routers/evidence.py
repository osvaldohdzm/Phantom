import os
import uuid
import hashlib
from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps.auth import AuthContext, actor_email, get_finding_in_tenant, get_auth_context, require_write
from app.models.evidence import EvidenceAttachment, AttachmentType
from app.schemas import EvidenceAttachmentRead

router = APIRouter(prefix="/findings", tags=["evidence"])

from pathlib import Path
from fastapi.responses import FileResponse

UPLOAD_DIR = Path(__file__).resolve().parents[2] / "uploads" / "evidence"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


@router.post("/{finding_id}/evidence", response_model=EvidenceAttachmentRead)
def upload_evidence(
    finding_id: uuid.UUID,
    attachment_type: AttachmentType = Form(...),
    description: str = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_write),
) -> EvidenceAttachment:
    get_finding_in_tenant(db, finding_id, ctx.tenant_id)

    file_id = uuid.uuid4()
    extension = os.path.splitext(file.filename)[1] if file.filename else ""
    target_filename = f"{file_id}{extension}"
    target_path = str(UPLOAD_DIR / target_filename)

    sha256 = hashlib.sha256()
    try:
        with open(target_path, "wb") as buffer:
            while chunk := file.file.read(8192):
                buffer.write(chunk)
                sha256.update(chunk)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"No se pudo guardar el archivo: {str(e)}")

    file_hash = sha256.hexdigest()

    evidence = EvidenceAttachment(
        id=file_id,
        finding_id=finding_id,
        attachment_type=attachment_type,
        filename=file.filename or target_filename,
        mime_type=file.content_type or "application/octet-stream",
        file_path=target_path,
        file_hash=file_hash,
        description=description,
        uploaded_by=actor_email(ctx),
    )

    db.add(evidence)
    db.commit()
    db.refresh(evidence)
    return evidence


@router.get("/{finding_id}/evidence", response_model=List[EvidenceAttachmentRead])
def list_evidence(
    finding_id: uuid.UUID,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(get_auth_context),
) -> List[EvidenceAttachment]:
    get_finding_in_tenant(db, finding_id, ctx.tenant_id)

    return db.query(EvidenceAttachment).filter(EvidenceAttachment.finding_id == finding_id).all()


@router.get("/{finding_id}/evidence/{evidence_id}/file")
def download_evidence_file(
    finding_id: uuid.UUID,
    evidence_id: uuid.UUID,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(get_auth_context),
):
    get_finding_in_tenant(db, finding_id, ctx.tenant_id)
    evidence = db.query(EvidenceAttachment).filter(
        EvidenceAttachment.id == evidence_id,
        EvidenceAttachment.finding_id == finding_id,
    ).first()
    if not evidence or not os.path.exists(evidence.file_path):
        raise HTTPException(status_code=404, detail="Archivo no encontrado")
    return FileResponse(evidence.file_path, media_type=evidence.mime_type, filename=evidence.filename)


@router.delete("/{finding_id}/evidence/{evidence_id}")
def delete_evidence(
    finding_id: uuid.UUID,
    evidence_id: uuid.UUID,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_write),
) -> dict:
    get_finding_in_tenant(db, finding_id, ctx.tenant_id)
    evidence = db.query(EvidenceAttachment).filter(
        EvidenceAttachment.id == evidence_id,
        EvidenceAttachment.finding_id == finding_id
    ).first()
    if not evidence:
        raise HTTPException(status_code=404, detail="Evidencia no encontrada")

    if os.path.exists(evidence.file_path):
        try:
            os.remove(evidence.file_path)
        except Exception:
            pass

    db.delete(evidence)
    db.commit()
    return {"message": "Evidencia eliminada exitosamente"}
