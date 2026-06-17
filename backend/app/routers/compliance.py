from uuid import UUID
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.evidence import ComplianceMapping, ComplianceControl, ComplianceFramework
from app.models.core import Finding
from app.schemas import (
    ComplianceMappingCreate,
    ComplianceMappingRead,
    ComplianceControlCreate,
    ComplianceControlRead
)

router = APIRouter(prefix="/compliance", tags=["compliance"])


@router.get("/frameworks")
def list_frameworks() -> List[str]:
    return [fw.value for fw in ComplianceFramework]


@router.get("/controls", response_model=List[ComplianceControlRead])
def list_controls(
    framework: ComplianceFramework = None,
    category: str = None,
    db: Session = Depends(get_db)
) -> List[ComplianceControl]:
    query = db.query(ComplianceControl)
    if framework:
        query = query.filter(ComplianceControl.framework == framework)
    if category:
        query = query.filter(ComplianceControl.category.ilike(f"%{category}%"))
    return query.all()


@router.post("/controls", response_model=ComplianceControlRead)
def create_control(payload: ComplianceControlCreate, db: Session = Depends(get_db)) -> ComplianceControl:
    existing = db.query(ComplianceControl).filter(
        ComplianceControl.framework == ComplianceFramework(payload.framework.value),
        ComplianceControl.control_id == payload.control_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="El control ya existe para este framework")

    control = ComplianceControl(
        framework=ComplianceFramework(payload.framework.value),
        control_id=payload.control_id,
        control_name=payload.control_name,
        description=payload.description,
        category=payload.category
    )
    db.add(control)
    db.commit()
    db.refresh(control)
    return control


@router.post("/findings/{finding_id}", response_model=ComplianceMappingRead)
def map_finding_to_control(
    finding_id: UUID,
    payload: ComplianceMappingCreate,
    db: Session = Depends(get_db)
) -> ComplianceMapping:
    finding = db.query(Finding).filter(Finding.id == finding_id).first()
    if not finding:
        raise HTTPException(status_code=404, detail="Hallazgo no encontrado")

    existing = db.query(ComplianceMapping).filter(
        ComplianceMapping.finding_id == finding_id,
        ComplianceMapping.framework == ComplianceFramework(payload.framework.value),
        ComplianceMapping.control_id == payload.control_id
    ).first()
    if existing:
        return existing

    mapping = ComplianceMapping(
        finding_id=finding_id,
        framework=ComplianceFramework(payload.framework.value),
        control_id=payload.control_id,
        control_name=payload.control_name,
        notes=payload.notes
    )
    db.add(mapping)
    db.commit()
    db.refresh(mapping)
    return mapping


@router.get("/findings/{finding_id}", response_model=List[ComplianceMappingRead])
def get_finding_mappings(finding_id: UUID, db: Session = Depends(get_db)) -> List[ComplianceMapping]:
    finding = db.query(Finding).filter(Finding.id == finding_id).first()
    if not finding:
        raise HTTPException(status_code=404, detail="Hallazgo no encontrado")

    return db.query(ComplianceMapping).filter(ComplianceMapping.finding_id == finding_id).all()


@router.delete("/findings/{finding_id}/mappings/{mapping_id}")
def delete_finding_mapping(finding_id: UUID, mapping_id: UUID, db: Session = Depends(get_db)) -> dict:
    mapping = db.query(ComplianceMapping).filter(
        ComplianceMapping.id == mapping_id,
        ComplianceMapping.finding_id == finding_id
    ).first()
    if not mapping:
        raise HTTPException(status_code=404, detail="Mapeo no encontrado")

    db.delete(mapping)
    db.commit()
    return {"message": "Mapeo de cumplimiento eliminado exitosamente"}
