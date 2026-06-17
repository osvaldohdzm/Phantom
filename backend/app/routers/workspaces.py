import uuid
from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps.auth import AuthContext, actor_email, engagement_in_tenant, get_auth_context, require_engagement_tenant, require_write
from app.models.workspace import PhantomWorkspace
from app.models.core import Asset
from app.schemas import WorkspaceCreate, WorkspaceRead, WorkspaceUpdate

router = APIRouter(prefix="/workspaces", tags=["workspaces"])


def _workspace_in_tenant(db: Session, ws: PhantomWorkspace, tenant_id: UUID) -> bool:
    if ws.engagement_id:
        return engagement_in_tenant(db, ws.engagement_id, tenant_id)
    if ws.asset_id:
        asset = db.get(Asset, ws.asset_id)
        return asset is not None and asset.tenant_id == tenant_id
    return False


def _get_workspace_in_tenant(db: Session, workspace_id: UUID, tenant_id: UUID) -> PhantomWorkspace:
    ws = db.get(PhantomWorkspace, workspace_id)
    if not ws or not _workspace_in_tenant(db, ws, tenant_id):
        raise HTTPException(status_code=404, detail="Workspace no encontrado")
    return ws


@router.get("", response_model=List[WorkspaceRead])
def list_workspaces(
    engagement_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(get_auth_context),
) -> List[PhantomWorkspace]:
    query = db.query(PhantomWorkspace).order_by(PhantomWorkspace.updated_at.desc())
    if engagement_id:
        require_engagement_tenant(db, engagement_id, ctx.tenant_id)
        query = query.filter(PhantomWorkspace.engagement_id == engagement_id)
    rows = query.limit(100).all()
    return [w for w in rows if _workspace_in_tenant(db, w, ctx.tenant_id)]


@router.post("", response_model=WorkspaceRead)
def create_workspace(
    payload: WorkspaceCreate,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_write),
) -> PhantomWorkspace:
    if payload.engagement_id:
        require_engagement_tenant(db, payload.engagement_id, ctx.tenant_id)
    if payload.asset_id:
        asset = db.query(Asset).filter(Asset.id == payload.asset_id, Asset.tenant_id == ctx.tenant_id).first()
        if not asset:
            raise HTTPException(status_code=404, detail="Activo no encontrado")

    ws = PhantomWorkspace(
        name=payload.name,
        description=payload.description,
        category=payload.category,
        engagement_id=payload.engagement_id,
        asset_id=payload.asset_id,
        global_vars=payload.global_vars,
        nodes=payload.nodes,
        connections=payload.connections,
        custom_rules=payload.custom_rules,
        created_by=actor_email(ctx),
    )
    db.add(ws)
    db.commit()
    db.refresh(ws)
    return ws


@router.get("/{workspace_id}", response_model=WorkspaceRead)
def get_workspace(
    workspace_id: UUID,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(get_auth_context),
) -> PhantomWorkspace:
    return _get_workspace_in_tenant(db, workspace_id, ctx.tenant_id)


@router.put("/{workspace_id}", response_model=WorkspaceRead)
def update_workspace(
    workspace_id: UUID,
    payload: WorkspaceUpdate,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_write),
) -> PhantomWorkspace:
    ws = _get_workspace_in_tenant(db, workspace_id, ctx.tenant_id)

    for field in ("name", "description", "category", "engagement_id", "asset_id",
                  "global_vars", "nodes", "connections", "custom_rules"):
        val = getattr(payload, field, None)
        if val is not None:
            setattr(ws, field, val)
    ws.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(ws)
    return ws


@router.delete("/{workspace_id}")
def delete_workspace(
    workspace_id: UUID,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_write),
) -> dict:
    ws = _get_workspace_in_tenant(db, workspace_id, ctx.tenant_id)
    db.delete(ws)
    db.commit()
    return {"deleted": True, "id": str(workspace_id)}
