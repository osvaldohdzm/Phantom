from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.deps.auth import AuthContext, get_auth_context, require_write
from app.database import get_db
from app.models.core import Engagement, EngagementType
from app.schemas import EngagementCreate, EngagementProfile, EngagementRead, EngagementUpdate
from app.services.default_engagement import is_default_engagement
from app.services.engagement_cleanup import delete_engagement as delete_engagement_record

router = APIRouter(prefix="/engagements", tags=["engagements"])


def _deep_merge(base: Dict[str, Any], patch: Dict[str, Any]) -> Dict[str, Any]:
    result = dict(base or {})
    for key, value in patch.items():
        if isinstance(value, dict) and isinstance(result.get(key), dict):
            result[key] = _deep_merge(result[key], value)
        else:
            result[key] = value
    return result


def _profile_to_dict(profile: Any) -> dict:
    """Acepta EngagementProfile, dict (tras model_dump) o None."""
    if profile is None:
        return {}
    if isinstance(profile, dict):
        return profile
    if isinstance(profile, EngagementProfile):
        return profile.model_dump()
    return EngagementProfile.model_validate(profile).model_dump()


@router.get("", response_model=List[EngagementRead])
def list_engagements(
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(get_auth_context),
    skip: int = 0,
    limit: int = 100,
) -> List[Engagement]:
    return (
        db.query(Engagement)
        .filter(Engagement.tenant_id == ctx.tenant_id)
        .order_by(Engagement.fecha_inicio.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


@router.post("", response_model=EngagementRead)
def create_engagement(
    payload: EngagementCreate,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_write),
) -> Engagement:
    eg = Engagement(
        cliente=payload.cliente,
        nombre_proyecto=payload.nombre_proyecto,
        estado=payload.estado,
        responsable=payload.responsable,
        tipo_servicio=payload.tipo_servicio.value if payload.tipo_servicio else None,
        fecha_inicio=payload.fecha_inicio,
        fecha_fin=payload.fecha_fin,
        tipo=EngagementType[payload.tipo.name],
        profile=_profile_to_dict(payload.profile) or {},
        tenant_id=ctx.tenant_id,
    )
    db.add(eg)
    db.commit()
    db.refresh(eg)
    return eg


@router.get("/{engagement_id}", response_model=EngagementRead)
def get_engagement(
    engagement_id: UUID,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(get_auth_context),
) -> Engagement:
    eg = db.get(Engagement, engagement_id)
    if not eg or eg.tenant_id != ctx.tenant_id:
        raise HTTPException(status_code=404, detail="Engagement no encontrado")
    return eg


@router.patch("/{engagement_id}", response_model=EngagementRead)
def update_engagement(
    engagement_id: UUID,
    payload: EngagementUpdate,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_write),
) -> Engagement:
    eg = db.get(Engagement, engagement_id)
    if not eg or eg.tenant_id != ctx.tenant_id:
        raise HTTPException(status_code=404, detail="Engagement no encontrado")
    data = payload.model_dump(exclude_unset=True)
    if "tipo" in data and data["tipo"] is not None:
        data["tipo"] = EngagementType[data["tipo"].name]
    if "tipo_servicio" in data:
        data["tipo_servicio"] = data["tipo_servicio"].value if data["tipo_servicio"] else None
    if "profile" in data:
        incoming = _profile_to_dict(data.pop("profile"))
        eg.profile = _deep_merge(eg.profile or {}, incoming)
    for k, v in data.items():
        setattr(eg, k, v)
    db.commit()
    db.refresh(eg)
    return eg


@router.delete("/{engagement_id}")
def delete_engagement(
    engagement_id: UUID,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_write),
) -> dict:
    eg = db.get(Engagement, engagement_id)
    if not eg or eg.tenant_id != ctx.tenant_id:
        raise HTTPException(status_code=404, detail="Engagement no encontrado")
    if is_default_engagement(eg):
        raise HTTPException(
            status_code=400,
            detail="No se puede eliminar el Proyecto Default del tenant",
        )
    delete_engagement_record(db, eg)
    db.commit()
    return {"deleted": True, "id": str(engagement_id)}
