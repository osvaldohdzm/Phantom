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
    yield


app = FastAPI(
    title="Phantom SecOps API",
    description="Gateway para hallazgos, activos, engagements e integración IA (LangChain).",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
