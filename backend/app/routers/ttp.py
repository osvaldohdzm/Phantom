from uuid import UUID
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.ttp_catalog import TTPEntry, MITRETactic
from app.schemas import TTPCreate, TTPRead

router = APIRouter(prefix="/ttp", tags=["ttp"])


@router.get("", response_model=List[TTPRead])
def list_ttps(
    tactic: str = None,
    tool: str = None,
    db: Session = Depends(get_db)
) -> List[TTPEntry]:
    query = db.query(TTPEntry).filter(TTPEntry.is_active == True)
    if tactic:
        query = query.filter(TTPEntry.tactic == tactic)
    if tool:
        query = query.filter(TTPEntry.tool.ilike(f"%{tool}%"))
    return query.all()


@router.get("/{ttp_id}", response_model=TTPRead)
def get_ttp(ttp_id: UUID, db: Session = Depends(get_db)) -> TTPEntry:
    ttp = db.query(TTPEntry).filter(TTPEntry.id == ttp_id, TTPEntry.is_active == True).first()
    if not ttp:
        raise HTTPException(status_code=404, detail="TTP no encontrado")
    return ttp


@router.post("", response_model=TTPRead)
def create_ttp(payload: TTPCreate, db: Session = Depends(get_db)) -> TTPEntry:
    ttp = TTPEntry(
        name=payload.name,
        tactic=MITRETactic(payload.tactic.value),
        tool=payload.tool,
        command_template=payload.command_template,
        description=payload.description,
        tags=payload.tags,
        is_active=payload.is_active,
    )
    db.add(ttp)
    db.commit()
    db.refresh(ttp)
    return ttp


@router.put("/{ttp_id}", response_model=TTPRead)
def update_ttp(ttp_id: UUID, payload: TTPCreate, db: Session = Depends(get_db)) -> TTPEntry:
    ttp = db.query(TTPEntry).filter(TTPEntry.id == ttp_id).first()
    if not ttp:
        raise HTTPException(status_code=404, detail="TTP no encontrado")

    # Invalidate old entry if we version up (or modify in place)
    # The CFR requires versioning, so let's increment the version counter
    ttp.name = payload.name
    ttp.tactic = MITRETactic(payload.tactic.value)
    ttp.tool = payload.tool
    ttp.command_template = payload.command_template
    ttp.description = payload.description
    ttp.tags = payload.tags
    ttp.is_active = payload.is_active
    ttp.version += 1

    db.commit()
    db.refresh(ttp)
    return ttp


@router.delete("/{ttp_id}")
def delete_ttp(ttp_id: UUID, db: Session = Depends(get_db)) -> dict:
    ttp = db.query(TTPEntry).filter(TTPEntry.id == ttp_id).first()
    if not ttp:
        raise HTTPException(status_code=404, detail="TTP no encontrado")
    
    # Soft delete
    ttp.is_active = False
    db.commit()
    return {"message": "TTP desactivado exitosamente"}
