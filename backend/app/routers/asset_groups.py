"""Agrupación de activos por tenant."""

from __future__ import annotations

from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps.auth import AuthContext, require_write
from app.models.core import Asset
from app.models.scan import AssetGroup, AssetGroupMember

router = APIRouter(prefix="/asset-groups", tags=["asset-groups"])


class AssetGroupRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    nombre: str
    descripcion: Optional[str] = None
    color: Optional[str] = None
    asset_ids: List[UUID] = Field(default_factory=list)


class AssetGroupCreate(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=255)
    descripcion: Optional[str] = None
    color: Optional[str] = None


class AssetGroupMembersUpdate(BaseModel):
    asset_ids: List[UUID] = Field(default_factory=list)


def _group_read(db: Session, group: AssetGroup) -> AssetGroupRead:
    ids = [
        m.asset_id
        for m in db.query(AssetGroupMember).filter(AssetGroupMember.group_id == group.id).all()
    ]
    return AssetGroupRead(
        id=group.id,
        nombre=group.nombre,
        descripcion=group.descripcion,
        color=group.color,
        asset_ids=ids,
    )


@router.get("", response_model=List[AssetGroupRead])
def list_asset_groups(
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_write),
) -> List[AssetGroupRead]:
    groups = (
        db.query(AssetGroup)
        .filter(AssetGroup.tenant_id == ctx.tenant_id)
        .order_by(AssetGroup.nombre)
        .all()
    )
    return [_group_read(db, g) for g in groups]


@router.post("", response_model=AssetGroupRead)
def create_asset_group(
    payload: AssetGroupCreate,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_write),
) -> AssetGroupRead:
    group = AssetGroup(
        tenant_id=ctx.tenant_id,
        nombre=payload.nombre.strip(),
        descripcion=(payload.descripcion or "").strip() or None,
        color=(payload.color or "").strip() or None,
    )
    db.add(group)
    db.commit()
    db.refresh(group)
    return _group_read(db, group)


@router.put("/{group_id}/members", response_model=AssetGroupRead)
def set_asset_group_members(
    group_id: UUID,
    payload: AssetGroupMembersUpdate,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_write),
) -> AssetGroupRead:
    group = db.get(AssetGroup, group_id)
    if not group or group.tenant_id != ctx.tenant_id:
        raise HTTPException(status_code=404, detail="Grupo no encontrado")

    valid_ids: set[UUID] = set()
    for aid in payload.asset_ids:
        asset = db.query(Asset).filter(Asset.id == aid, Asset.tenant_id == ctx.tenant_id).first()
        if asset:
            valid_ids.add(aid)

    db.query(AssetGroupMember).filter(AssetGroupMember.group_id == group_id).delete()
    for aid in valid_ids:
        db.add(AssetGroupMember(group_id=group_id, asset_id=aid))
    db.commit()
    db.refresh(group)
    return _group_read(db, group)


@router.delete("/{group_id}")
def delete_asset_group(
    group_id: UUID,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_write),
) -> dict:
    group = db.get(AssetGroup, group_id)
    if not group or group.tenant_id != ctx.tenant_id:
        raise HTTPException(status_code=404, detail="Grupo no encontrado")
    db.delete(group)
    db.commit()
    return {"deleted": True, "id": str(group_id)}
