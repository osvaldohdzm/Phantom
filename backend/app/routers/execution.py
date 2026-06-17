import hashlib
from uuid import UUID
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.execution_log import ExecutionLog
from app.models.core import Asset, Engagement
from app.schemas import ExecutionLogCreate, ExecutionLogRead

router = APIRouter(prefix="/execution", tags=["execution"])


@router.post("/log", response_model=ExecutionLogRead)
def create_execution_log(payload: ExecutionLogCreate, db: Session = Depends(get_db)) -> ExecutionLog:
    engagement = db.query(Engagement).filter(Engagement.id == payload.engagement_id).first()
    if not engagement:
        raise HTTPException(status_code=404, detail="Engagement no encontrado")

    if payload.asset_id:
        asset = db.query(Asset).filter(Asset.id == payload.asset_id).first()
        if not asset:
            raise HTTPException(status_code=404, detail="Activo no encontrado")

    raw_output_bytes = payload.raw_output.encode('utf-8')
    output_hash = hashlib.sha256(raw_output_bytes).hexdigest()

    log_entry = ExecutionLog(
        engagement_id=payload.engagement_id,
        asset_id=payload.asset_id,
        node_id=payload.node_id,
        command=payload.command,
        raw_output=payload.raw_output,
        output_hash=output_hash,
        executed_by=payload.executed_by,
        duration_ms=payload.duration_ms,
        parent_log_id=payload.parent_log_id,
    )

    db.add(log_entry)
    db.commit()
    db.refresh(log_entry)
    return log_entry


@router.get("/logs", response_model=List[ExecutionLogRead])
def list_execution_logs(
    engagement_id: UUID = None,
    asset_id: UUID = None,
    db: Session = Depends(get_db)
) -> List[ExecutionLog]:
    query = db.query(ExecutionLog)
    if engagement_id:
        query = query.filter(ExecutionLog.engagement_id == engagement_id)
    if asset_id:
        query = query.filter(ExecutionLog.asset_id == asset_id)
    return query.order_by(ExecutionLog.executed_at.desc()).all()


@router.get("/chain/{engagement_id}", response_model=List[ExecutionLogRead])
def get_attack_chain(engagement_id: UUID, db: Session = Depends(get_db)) -> List[ExecutionLog]:
    return db.query(ExecutionLog)\
        .filter(ExecutionLog.engagement_id == engagement_id)\
        .order_by(ExecutionLog.executed_at.asc())\
        .all()


@router.get("/logs/{log_id}/verify-integrity")
def verify_log_integrity(log_id: UUID, db: Session = Depends(get_db)) -> dict:
    log_entry = db.query(ExecutionLog).filter(ExecutionLog.id == log_id).first()
    if not log_entry:
        raise HTTPException(status_code=404, detail="Log de ejecución no encontrado")

    raw_output_bytes = log_entry.raw_output.encode('utf-8')
    current_hash = hashlib.sha256(raw_output_bytes).hexdigest()

    is_valid = current_hash == log_entry.output_hash

    return {
        "log_id": log_id,
        "stored_hash": log_entry.output_hash,
        "calculated_hash": current_hash,
        "integrity_verified": is_valid
    }
