from contextlib import asynccontextmanager

import app.models  # noqa: F401 — registra tablas en Base.metadata

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine
from sqlalchemy import text
from app.routers import assets, findings, ingest


@asynccontextmanager
async def lifespan(_app: FastAPI):
    with engine.connect() as conn:
        conn.execute(text("CREATE SCHEMA IF NOT EXISTS core"))
        conn.commit()
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="Spectra SecOps API",
    description="Gateway para hallazgos, activos, engagements e integración IA (LangChain).",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(assets.router, prefix="/api/v1")
app.include_router(findings.router, prefix="/api/v1")
app.include_router(ingest.router, prefix="/api/v1")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "spectra-secops-api"}
