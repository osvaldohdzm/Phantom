import os
from contextlib import asynccontextmanager

import app.models  # noqa: F401 — registra tablas en Base.metadata

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db_startup import worker_startup
from app.routers import (
    assets, findings, ingest, vault, scope, ttp, execution, evidence,
    compliance, retest, reports, docx_templates, workspaces, engagements, auth, admin,
    asset_groups, branding,
)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    worker_startup(schema_prebootstrapped=os.environ.get("PHANTOM_DB_BOOTSTRAPPED") == "1")
    from app.services.ingest_worker import start_ingest_worker

    start_ingest_worker()
    yield


app = FastAPI(
    title="Phantom SecOps API",
    description="Gateway para hallazgos, activos, engagements e integración IA (LangChain).",
    version="0.1.0",
    lifespan=lifespan,
)

from app.config import settings

cors_origins = [o.strip() for o in settings.cors_allowed_origins.split(",") if o.strip()]
if "*" in cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=r"https?://.*",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

from app.core.logger import logger
from fastapi import Request
from fastapi.responses import JSONResponse
import traceback
import time

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    error_id = f"ERR-2026-{int(time.time())}-{os.urandom(3).hex().upper()}"
    
    # Log the complete error message, stack trace, and request metadata
    logger.error(
        f"Excepción no controlada: {exc}",
        exc_info=True,
        extra={"extra_data": {
            "error_id": error_id, 
            "path": request.url.path, 
            "method": request.method
        }}
    )
    
    env = os.getenv("NODE_ENV", "development")
    log_level = os.getenv("LOG_LEVEL", "info").lower()
    
    if env == "development":
        return JSONResponse(
            status_code=500,
            content={
                "status": 500,
                "message": str(exc),
                "error_id": error_id,
                "stack": traceback.format_exc()
            }
        )
    elif log_level == "info" or env == "test":
        return JSONResponse(
            status_code=500,
            content={
                "status": 500,
                "message": f"Error en el servidor: {str(exc)}. Revise los registros del sistema.",
                "error_id": error_id
            }
        )
    else:
        return JSONResponse(
            status_code=500,
            content={
                "status": 500,
                "message": "Error interno del servidor. Contacte a soporte.",
                "error_id": error_id
            }
        )

app.include_router(auth.router, prefix="/api/v1")
app.include_router(admin.router, prefix="/api/v1")
app.include_router(branding.router, prefix="/api/v1")
app.include_router(assets.router, prefix="/api/v1")
app.include_router(findings.router, prefix="/api/v1")
app.include_router(ingest.router, prefix="/api/v1")
app.include_router(vault.router, prefix="/api/v1")
app.include_router(scope.router, prefix="/api/v1")
app.include_router(ttp.router, prefix="/api/v1")
app.include_router(execution.router, prefix="/api/v1")
app.include_router(evidence.router, prefix="/api/v1")
app.include_router(compliance.router, prefix="/api/v1")
app.include_router(retest.router, prefix="/api/v1")
app.include_router(reports.router, prefix="/api/v1")
app.include_router(docx_templates.router, prefix="/api/v1")
app.include_router(workspaces.router, prefix="/api/v1")
app.include_router(engagements.router, prefix="/api/v1")
app.include_router(asset_groups.router, prefix="/api/v1")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "Phantom-secops-api"}
