from uuid import UUID
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps.auth import (
    AuthContext,
    actor_email,
    engagement_in_tenant,
    get_auth_context,
    require_engagement_tenant,
    require_write,
)
from app.models.vault import VaultCredential, VaultAuditLog, VaultAuditAction, CredentialType
from app.models.core import Asset
from app.schemas import (
    VaultCredentialCreate,
    VaultCredentialRead,
    VaultCredentialReveal,
    VaultAuditLogRead,
)
from app.services.crypto import crypto_service

router = APIRouter(prefix="/vault", tags=["vault"])


def _credential_in_tenant(db: Session, cred: VaultCredential, tenant_id: UUID) -> bool:
    if cred.engagement_id:
        return engagement_in_tenant(db, cred.engagement_id, tenant_id)
    if cred.asset_id:
        asset = db.get(Asset, cred.asset_id)
        return asset is not None and asset.tenant_id == tenant_id
    return False


def _get_credential_in_tenant(db: Session, cred_id: UUID, tenant_id: UUID) -> VaultCredential:
    cred = db.query(VaultCredential).filter(VaultCredential.id == cred_id).first()
    if not cred or not _credential_in_tenant(db, cred, tenant_id):
        raise HTTPException(status_code=404, detail="Credencial no encontrada")
    return cred


@router.get("/credentials", response_model=List[VaultCredentialRead])
def list_credentials(
    engagement_id: UUID = None,
    asset_id: UUID = None,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(get_auth_context),
) -> List[VaultCredential]:
    query = db.query(VaultCredential)
    if engagement_id:
        require_engagement_tenant(db, engagement_id, ctx.tenant_id)
        query = query.filter(VaultCredential.engagement_id == engagement_id)
    if asset_id:
        asset = db.query(Asset).filter(Asset.id == asset_id, Asset.tenant_id == ctx.tenant_id).first()
        if not asset:
            raise HTTPException(status_code=404, detail="Activo no encontrado")
        query = query.filter(VaultCredential.asset_id == asset_id)
    creds = query.all()
    return [c for c in creds if _credential_in_tenant(db, c, ctx.tenant_id)]


@router.post("/credentials", response_model=VaultCredentialRead)
def create_credential(
    payload: VaultCredentialCreate,
    request: Request,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_write),
) -> VaultCredential:
    if payload.asset_id:
        asset = db.query(Asset).filter(Asset.id == payload.asset_id, Asset.tenant_id == ctx.tenant_id).first()
        if not asset:
            raise HTTPException(status_code=404, detail="Activo no encontrado")
    if payload.engagement_id:
        require_engagement_tenant(db, payload.engagement_id, ctx.tenant_id)

    username_enc = crypto_service.encrypt(payload.username)
    secret_enc = crypto_service.encrypt(payload.secret)
    notes_enc = crypto_service.encrypt(payload.notes) if payload.notes else None

    cred = VaultCredential(
        engagement_id=payload.engagement_id,
        asset_id=payload.asset_id,
        label=payload.label,
        credential_type=CredentialType(payload.credential_type.value),
        username_encrypted=username_enc,
        secret_encrypted=secret_enc,
        service_port=payload.service_port,
        notes_encrypted=notes_enc,
    )

    db.add(cred)
    db.commit()
    db.refresh(cred)

    audit = VaultAuditLog(
        credential_id=cred.id,
        action=VaultAuditAction.created,
        actor=actor_email(ctx),
        ip_address=request.client.host if request.client else None,
        details=f"Credencial creada con etiqueta '{cred.label}'",
    )
    db.add(audit)
    db.commit()

    return cred


@router.get("/credentials/{cred_id}/decrypt", response_model=VaultCredentialReveal)
def reveal_credential(
    cred_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_write),
) -> dict:
    cred = _get_credential_in_tenant(db, cred_id, ctx.tenant_id)

    audit = VaultAuditLog(
        credential_id=cred.id,
        action=VaultAuditAction.revealed,
        actor=actor_email(ctx),
        ip_address=request.client.host if request.client else None,
        details="Credencial revelada",
    )
    db.add(audit)
    db.commit()

    return {
        "username": crypto_service.decrypt(cred.username_encrypted),
        "secret": crypto_service.decrypt(cred.secret_encrypted),
        "notes": crypto_service.decrypt(cred.notes_encrypted) if cred.notes_encrypted else None,
    }


@router.delete("/credentials/{cred_id}")
def delete_credential(
    cred_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(require_write),
) -> dict:
    cred = _get_credential_in_tenant(db, cred_id, ctx.tenant_id)

    audit = VaultAuditLog(
        credential_id=cred.id,
        action=VaultAuditAction.deleted,
        actor=actor_email(ctx),
        ip_address=request.client.host if request.client else None,
        details=f"Credencial eliminada: '{cred.label}'",
    )
    db.add(audit)
    db.delete(cred)
    db.commit()
    return {"message": "Credencial eliminada"}


@router.get("/credentials/{cred_id}/audit", response_model=List[VaultAuditLogRead])
def get_credential_audit(
    cred_id: UUID,
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(get_auth_context),
) -> List[VaultAuditLog]:
    _get_credential_in_tenant(db, cred_id, ctx.tenant_id)
    return (
        db.query(VaultAuditLog)
        .filter(VaultAuditLog.credential_id == cred_id)
        .order_by(VaultAuditLog.timestamp.desc())
        .all()
    )


@router.get("/audit", response_model=List[VaultAuditLogRead])
def list_vault_audit(
    db: Session = Depends(get_db),
    ctx: AuthContext = Depends(get_auth_context),
) -> List[VaultAuditLog]:
    cred_ids = [
        c.id
        for c in db.query(VaultCredential).all()
        if _credential_in_tenant(db, c, ctx.tenant_id)
    ]
    if not cred_ids:
        return []
    return (
        db.query(VaultAuditLog)
        .filter(VaultAuditLog.credential_id.in_(cred_ids))
        .order_by(VaultAuditLog.timestamp.desc())
        .limit(100)
        .all()
    )
