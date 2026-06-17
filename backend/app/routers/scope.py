from uuid import UUID
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.scope import ScopeSnapshot, SnapshotType
from app.models.core import Asset, Engagement
from app.schemas import (
    ScopeSnapshotCreate,
    ScopeSnapshotRead,
    ScopeCompareResponse
)

router = APIRouter(prefix="/engagements", tags=["scope"])


@router.post("/{engagement_id}/scope/snapshot", response_model=ScopeSnapshotRead)
def create_scope_snapshot(
    engagement_id: UUID,
    payload: ScopeSnapshotCreate,
    db: Session = Depends(get_db)
) -> ScopeSnapshot:
    engagement = db.query(Engagement).filter(Engagement.id == engagement_id).first()
    if not engagement:
        raise HTTPException(status_code=404, detail="Engagement no encontrado")

    for asset_id in payload.asset_ids:
        asset = db.query(Asset).filter(Asset.id == asset_id).first()
        if not asset:
            raise HTTPException(status_code=404, detail=f"Activo {asset_id} no encontrado")

    last_snapshot = db.query(ScopeSnapshot)\
        .filter(ScopeSnapshot.engagement_id == engagement_id)\
        .order_by(ScopeSnapshot.version.desc())\
        .first()
    
    next_version = (last_snapshot.version + 1) if last_snapshot else 1
    asset_id_strs = [str(aid) for aid in payload.asset_ids]

    snapshot = ScopeSnapshot(
        engagement_id=engagement_id,
        version=next_version,
        snapshot_type=SnapshotType(payload.snapshot_type.value),
        asset_ids=asset_id_strs,
        created_by="admin",
        notes=payload.notes,
    )

    for aid in payload.asset_ids:
        asset = db.query(Asset).filter(Asset.id == aid).first()
        if asset:
            asset.scope_version = next_version
            asset.is_in_scope = True

    db.add(snapshot)
    db.commit()
    db.refresh(snapshot)
    return snapshot


@router.get("/{engagement_id}/scope/history", response_model=List[ScopeSnapshotRead])
def get_scope_history(
    engagement_id: UUID,
    db: Session = Depends(get_db)
) -> List[ScopeSnapshot]:
    engagement = db.query(Engagement).filter(Engagement.id == engagement_id).first()
    if not engagement:
        raise HTTPException(status_code=404, detail="Engagement no encontrado")

    return db.query(ScopeSnapshot)\
        .filter(ScopeSnapshot.engagement_id == engagement_id)\
        .order_by(ScopeSnapshot.version.desc())\
        .all()


@router.get("/{engagement_id}/scope/compare", response_model=ScopeCompareResponse)
def compare_scopes(
    engagement_id: UUID,
    version_a: int = 1,
    version_b: int = None,
    db: Session = Depends(get_db)
) -> dict:
    engagement = db.query(Engagement).filter(Engagement.id == engagement_id).first()
    if not engagement:
        raise HTTPException(status_code=404, detail="Engagement no encontrado")

    snap_a = db.query(ScopeSnapshot)\
        .filter(ScopeSnapshot.engagement_id == engagement_id, ScopeSnapshot.version == version_a)\
        .first()
    if not snap_a:
        raise HTTPException(status_code=404, detail=f"Snapshot versión {version_a} no encontrado")

    if version_b is None:
        snap_b = db.query(ScopeSnapshot)\
            .filter(ScopeSnapshot.engagement_id == engagement_id)\
            .order_by(ScopeSnapshot.version.desc())\
            .first()
        if not snap_b or snap_b.version == version_a:
            return {
                "added_assets": [],
                "removed_assets": [],
                "initial_version": version_a,
                "final_version": version_a
            }
    else:
        snap_b = db.query(ScopeSnapshot)\
            .filter(ScopeSnapshot.engagement_id == engagement_id, ScopeSnapshot.version == version_b)\
            .first()
        if not snap_b:
            raise HTTPException(status_code=404, detail=f"Snapshot versión {version_b} no encontrado")

    assets_a_set = set(snap_a.asset_ids)
    assets_b_set = set(snap_b.asset_ids)

    added_ids = assets_b_set - assets_a_set
    removed_ids = assets_a_set - assets_b_set

    added_assets = db.query(Asset).filter(Asset.id.in_(list(added_ids))).all() if added_ids else []
    removed_assets = db.query(Asset).filter(Asset.id.in_(list(removed_ids))).all() if removed_ids else []

    return {
        "added_assets": added_assets,
        "removed_assets": removed_assets,
        "initial_version": snap_a.version,
        "final_version": snap_b.version
    }
