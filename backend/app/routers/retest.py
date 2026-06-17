import uuid
from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.core import Finding, FindingStatus, RemediationPlan
from app.schemas import RemediationPlanRead, RetestRequest, RetestResultSubmit, FindingRead

router = APIRouter(prefix="/findings", tags=["retest"])


@router.post("/{finding_id}/transition", response_model=FindingRead)
def transition_finding_status(
    finding_id: uuid.UUID,
    new_status: FindingStatus,
    notes: str = None,
    db: Session = Depends(get_db)
) -> Finding:
    finding = db.query(Finding).filter(Finding.id == finding_id).first()
    if not finding:
        raise HTTPException(status_code=404, detail="Hallazgo no encontrado")

    old_status = finding.status
    finding.status = new_status

    remediation = db.query(RemediationPlan).filter(RemediationPlan.finding_id == finding_id).first()
    if not remediation:
        remediation = RemediationPlan(
            finding_id=finding_id,
            estado_remediacion=new_status.value,
            history=[]
        )
        db.add(remediation)
        db.commit()
        db.refresh(remediation)

    history = list(remediation.history) if remediation.history else []
    history.append({
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "from_status": old_status.value,
        "to_status": new_status.value,
        "user": "admin",
        "notes": notes
    })
    remediation.history = history
    remediation.estado_remediacion = new_status.value
    
    db.commit()
    db.refresh(finding)
    return finding


@router.post("/{finding_id}/retest", response_model=FindingRead)
def initiate_retest(
    finding_id: uuid.UUID,
    payload: RetestRequest,
    db: Session = Depends(get_db)
) -> Finding:
    finding = db.query(Finding).filter(Finding.id == finding_id).first()
    if not finding:
        raise HTTPException(status_code=404, detail="Hallazgo no encontrado")

    finding.status = FindingStatus.retest_en_curso

    remediation = db.query(RemediationPlan).filter(RemediationPlan.finding_id == finding_id).first()
    if not remediation:
        remediation = RemediationPlan(
            finding_id=finding_id,
            estado_remediacion=finding.status.value,
            history=[]
        )
        db.add(remediation)
        db.commit()
        db.refresh(remediation)

    history = list(remediation.history) if remediation.history else []
    history.append({
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "from_status": FindingStatus.en_proceso.value,
        "to_status": FindingStatus.retest_en_curso.value,
        "user": payload.executed_by,
        "notes": payload.notes or "Re-test iniciado."
    })
    remediation.history = history
    remediation.estado_remediacion = FindingStatus.retest_en_curso.value
    
    db.commit()
    db.refresh(finding)
    return finding


@router.post("/{finding_id}/retest/result", response_model=FindingRead)
def submit_retest_result(
    finding_id: uuid.UUID,
    payload: RetestResultSubmit,
    db: Session = Depends(get_db)
) -> Finding:
    finding = db.query(Finding).filter(Finding.id == finding_id).first()
    if not finding:
        raise HTTPException(status_code=404, detail="Hallazgo no encontrado")

    remediation = db.query(RemediationPlan).filter(RemediationPlan.finding_id == finding_id).first()
    if not remediation:
        remediation = RemediationPlan(
            finding_id=finding_id,
            history=[]
        )
        db.add(remediation)
        db.commit()
        db.refresh(remediation)

    if payload.result == "passed":
        finding.status = FindingStatus.cerrado
    elif payload.result == "failed":
        finding.status = FindingStatus.en_proceso
    else:
        finding.status = FindingStatus.retest_pendiente

    remediation.retest_count += 1
    remediation.last_retest_at = datetime.now(timezone.utc)
    remediation.last_retest_result = payload.result
    remediation.estado_remediacion = finding.status.value

    history = list(remediation.history) if remediation.history else []
    history.append({
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "from_status": FindingStatus.retest_en_curso.value,
        "to_status": finding.status.value,
        "user": payload.executed_by,
        "notes": f"Resultado de Re-test: {payload.result.upper()}. {payload.notes or ''}"
    })
    remediation.history = history

    db.commit()
    db.refresh(finding)
    return finding


@router.get("/retest-queue", response_model=List[FindingRead])
def list_retest_queue(db: Session = Depends(get_db)) -> List[Finding]:
    return db.query(Finding).filter(
        Finding.status.in_([FindingStatus.retest_pendiente, FindingStatus.retest_en_curso])
    ).all()
