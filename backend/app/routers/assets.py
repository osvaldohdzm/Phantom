from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.core import Asset, Environment
from app.schemas import AssetCreate, AssetRead

router = APIRouter(prefix="/assets", tags=["assets"])


@router.get("", response_model=list[AssetRead])
def list_assets(db: Session = Depends(get_db)) -> list[Asset]:
    return db.query(Asset).limit(200).all()


@router.post("", response_model=AssetRead)
def create_asset(payload: AssetCreate, db: Session = Depends(get_db)) -> Asset:
    a = Asset(
        nombre=payload.nombre,
        ip_publica=payload.ip_publica,
        ip_privada=payload.ip_privada,
        fqdn=payload.fqdn,
        criticidad=payload.criticidad,
        ambiente=Environment(payload.ambiente.value),
    )
    db.add(a)
    db.commit()
    db.refresh(a)
    return a
