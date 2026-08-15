import random
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps.auth import AuthContext, require_write
from app.models.core import Engagement
from app.models.shared_mission import SharedMission
from app.schemas import (
    SharedMissionRead,
    SharedMissionUnlockBody,
    SharedMissionUnlockResponse,
)

router = APIRouter(prefix="/shared-missions", tags=["shared-missions"])


def generate_access_code() -> str:
    # 6-character alphanumeric code, using uppercase letters and digits.
    # Exclude I, O, 0, 1 for readability.
    chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return "".join(random.choices(chars, k=6))


@router.post("/engagements/{engagement_id}", response_model=SharedMissionRead)
def create_shared_mission(
    engagement_id: uuid.UUID,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_write),
) -> SharedMissionRead:
    eg = db.get(Engagement, engagement_id)
    if not eg or eg.tenant_id != ctx.tenant_id:
        raise HTTPException(status_code=404, detail="Engagement no encontrado")

    # Generate unique share_hash and access_code
    share_hash = uuid.uuid4().hex
    access_code = generate_access_code()

    # Create the snapshot of the creation form fields
    snapshot = {
        "cliente": eg.cliente,
        "nombre_proyecto": eg.nombre_proyecto,
        "estado": eg.estado,
        "responsable": eg.responsable,
        "tipo_servicio": eg.tipo_servicio,
        "fecha_inicio": eg.fecha_inicio.isoformat() if eg.fecha_inicio else None,
        "fecha_fin": eg.fecha_fin.isoformat() if eg.fecha_fin else None,
        "tipo": eg.tipo.value if eg.tipo else None,
        "profile": eg.profile or {},
    }

    # Save to db
    shared_mission = SharedMission(
        share_hash=share_hash,
        access_code=access_code,
        engagement_id=engagement_id,
        snapshot=snapshot,
    )
    db.add(shared_mission)
    db.commit()
    db.refresh(shared_mission)

    return SharedMissionRead(
        share_hash=shared_mission.share_hash,
        access_code=shared_mission.access_code,
        share_url=f"/share/{shared_mission.share_hash}",
    )


@router.post("/{share_hash}/unlock", response_model=SharedMissionUnlockResponse)
def unlock_shared_mission(
    share_hash: str,
    payload: SharedMissionUnlockBody,
    db: Session = Depends(get_db),
) -> SharedMissionUnlockResponse:
    mission = db.query(SharedMission).filter(SharedMission.share_hash == share_hash).first()
    if not mission:
        raise HTTPException(status_code=404, detail="Misión compartida no encontrada")

    # Check access code (case-insensitive or exact, but exact/upper is standard)
    input_code = payload.access_code.strip().upper()
    if input_code != mission.access_code.upper():
        raise HTTPException(status_code=401, detail="ACCESO DENEGADO")

    return SharedMissionUnlockResponse(snapshot=mission.snapshot)
