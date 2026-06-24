"""Schema migrations and seed data — run once before multi-worker Uvicorn."""

from __future__ import annotations

import time

import app.models  # noqa: F401 — registra tablas en Base.metadata

from sqlalchemy import text

from app.database import Base, SessionLocal, engine
from app.config import settings
from app.models.evidence import ComplianceControl, ComplianceFramework
from app.services.auth_seed import backfill_tenant_ids, seed_auth_data

_DB_INIT_LOCK_ID = 0x5048414E  # PHAN
_SCHEMA_READY_TABLE = "tenants"


def _migrate_engagement_profile() -> None:
    alters = [
        "ALTER TABLE engagements ADD COLUMN IF NOT EXISTS nombre_proyecto VARCHAR(255)",
        "ALTER TABLE engagements ADD COLUMN IF NOT EXISTS estado VARCHAR(64)",
        "ALTER TABLE engagements ADD COLUMN IF NOT EXISTS responsable VARCHAR(255)",
        "ALTER TABLE engagements ADD COLUMN IF NOT EXISTS tipo_servicio VARCHAR(64)",
        "ALTER TABLE engagements ADD COLUMN IF NOT EXISTS profile JSONB",
        "ALTER TABLE engagements ALTER COLUMN profile SET DEFAULT '{}'::jsonb",
    ]
    with engine.connect() as conn:
        for sql in alters:
            conn.execute(text(sql))
        conn.execute(text("UPDATE engagements SET profile = '{}'::jsonb WHERE profile IS NULL"))
        conn.commit()


def _migrate_report_jobs_kind() -> None:
    alters = [
        "ALTER TABLE report_jobs ADD COLUMN IF NOT EXISTS report_kind VARCHAR(40) DEFAULT 'vulnerability_tables'",
        "UPDATE report_jobs SET report_kind = 'vulnerability_tables' WHERE report_kind IS NULL",
        "ALTER TABLE report_jobs ADD COLUMN IF NOT EXISTS grouped_rows INTEGER",
        "ALTER TABLE report_jobs ALTER COLUMN template_id DROP NOT NULL",
    ]
    with engine.connect() as conn:
        for sql in alters:
            conn.execute(text(sql))
        conn.commit()


def _migrate_report_jobs_template_fk_cascade() -> None:
    sql = """
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'report_jobs_template_id_fkey'
          AND table_name = 'report_jobs'
      ) THEN
        ALTER TABLE report_jobs DROP CONSTRAINT report_jobs_template_id_fkey;
        ALTER TABLE report_jobs
          ADD CONSTRAINT report_jobs_template_id_fkey
          FOREIGN KEY (template_id) REFERENCES docx_templates(id) ON DELETE CASCADE;
      END IF;
    END $$;
    """
    with engine.connect() as conn:
        conn.execute(text(sql))
        conn.commit()


def _migrate_remediation_plan_finding_fk_cascade() -> None:
    sql = """
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'remediation_plan_finding_id_fkey'
          AND table_name = 'remediation_plan'
      ) THEN
        ALTER TABLE remediation_plan DROP CONSTRAINT remediation_plan_finding_id_fkey;
        ALTER TABLE remediation_plan
          ADD CONSTRAINT remediation_plan_finding_id_fkey
          FOREIGN KEY (finding_id) REFERENCES findings(id) ON DELETE CASCADE;
      END IF;
    END $$;
    """
    with engine.connect() as conn:
        conn.execute(text(sql))
        conn.commit()


def _migrate_engagement_fk_cascade() -> None:
    sql = """
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'report_jobs_engagement_id_fkey'
          AND table_name = 'report_jobs'
      ) THEN
        ALTER TABLE report_jobs DROP CONSTRAINT report_jobs_engagement_id_fkey;
        ALTER TABLE report_jobs
          ADD CONSTRAINT report_jobs_engagement_id_fkey
          FOREIGN KEY (engagement_id) REFERENCES engagements(id) ON DELETE CASCADE;
      END IF;
    END $$;
    """
    with engine.connect() as conn:
        conn.execute(text(sql))
        conn.commit()


def _migrate_finding_columns() -> None:
    alters = [
        "ALTER TABLE findings ADD COLUMN IF NOT EXISTS componente_afectado TEXT",
        "ALTER TABLE findings ADD COLUMN IF NOT EXISTS metodo_deteccion TEXT",
        "ALTER TABLE findings ALTER COLUMN metodo_deteccion TYPE TEXT",
        "ALTER TABLE findings ADD COLUMN IF NOT EXISTS propuesta_remediacion TEXT",
        "ALTER TABLE findings ADD COLUMN IF NOT EXISTS referencias TEXT",
        "ALTER TABLE findings ADD COLUMN IF NOT EXISTS tool_source VARCHAR(64)",
        "ALTER TABLE findings ADD COLUMN IF NOT EXISTS tool_vuln_id VARCHAR(512)",
        "ALTER TABLE findings ADD COLUMN IF NOT EXISTS epss_score DOUBLE PRECISION",
        "ALTER TABLE findings ADD COLUMN IF NOT EXISTS kev_listed BOOLEAN DEFAULT FALSE",
        "ALTER TABLE findings ADD COLUMN IF NOT EXISTS first_seen TIMESTAMPTZ",
        "ALTER TABLE findings ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ",
        "ALTER TABLE findings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ",
        "UPDATE findings SET updated_at = COALESCE(last_seen, first_seen, created_at) WHERE updated_at IS NULL",
        "ALTER TABLE findings ADD COLUMN IF NOT EXISTS origin_projects JSONB DEFAULT '[]'::jsonb",
        "ALTER TABLE findings ADD COLUMN IF NOT EXISTS detection_sources JSONB DEFAULT '[]'::jsonb",
        "ALTER TABLE findings ADD COLUMN IF NOT EXISTS sync_status VARCHAR(32) DEFAULT 'pending'",
        "ALTER TABLE findings ADD COLUMN IF NOT EXISTS global_status VARCHAR(32) DEFAULT 'LOCAL'",
        "ALTER TABLE findings ADD COLUMN IF NOT EXISTS ai_summary TEXT",
        "ALTER TABLE findings ADD COLUMN IF NOT EXISTS ai_group_id UUID",
        "ALTER TABLE findings ADD COLUMN IF NOT EXISTS remediation_context TEXT",
        "ALTER TABLE findings ADD COLUMN IF NOT EXISTS dedup_fingerprint VARCHAR(512)",
        "CREATE INDEX IF NOT EXISTS idx_findings_dedup_fingerprint ON findings (dedup_fingerprint)",
        "ALTER TABLE findings ADD COLUMN IF NOT EXISTS lifecycle_history JSONB DEFAULT '[]'::jsonb",
        "ALTER TABLE remediation_plan ADD COLUMN IF NOT EXISTS sla_date DATE",
        "ALTER TABLE remediation_plan ADD COLUMN IF NOT EXISTS priority INTEGER",
        "ALTER TABLE remediation_plan ADD COLUMN IF NOT EXISTS retest_trigger VARCHAR(255)",
        "ALTER TABLE remediation_plan ADD COLUMN IF NOT EXISTS retest_count INTEGER DEFAULT 0",
        "ALTER TABLE remediation_plan ADD COLUMN IF NOT EXISTS last_retest_at TIMESTAMPTZ",
        "ALTER TABLE remediation_plan ADD COLUMN IF NOT EXISTS last_retest_result VARCHAR(128)",
        "ALTER TABLE remediation_plan ADD COLUMN IF NOT EXISTS history JSONB",
    ]
    with engine.connect() as conn:
        for sql in alters:
            conn.execute(text(sql))
        conn.commit()


def _migrate_finding_indexes() -> None:
    """Índices para acelerar el repositorio CYB001 (COUNT + listados + group by).

    La consulta del repositorio hace JOIN findings -> engagements (tenant) y filtra
    por global_status / severidad, ordenando por created_at. Sin estos índices cada
    consulta era un seq scan + hash join sobre toda la tabla (decenas de segundos en
    ~50k+ filas). Son idempotentes (IF NOT EXISTS), así que reejecutar no hace nada.
    """
    statements = [
        # JOIN con engagements para aislar por tenant.
        "CREATE INDEX IF NOT EXISTS idx_findings_engagement_id ON findings (engagement_id)",
        "CREATE INDEX IF NOT EXISTS idx_engagements_tenant_id ON engagements (tenant_id)",
        # Filtro de repositorio (excluye borradores de servicio) y severidad.
        "CREATE INDEX IF NOT EXISTS idx_findings_global_status ON findings (global_status)",
        "CREATE INDEX IF NOT EXISTS idx_findings_severidad ON findings (severidad)",
        "CREATE INDEX IF NOT EXISTS idx_findings_tool_source ON findings (tool_source)",
        "CREATE INDEX IF NOT EXISTS idx_findings_status ON findings (status)",
        # Orden por defecto del listado.
        "CREATE INDEX IF NOT EXISTS idx_findings_created_at ON findings (created_at)",
        # Índices compuestos para la ruta caliente del repositorio (count + group by).
        "CREATE INDEX IF NOT EXISTS idx_findings_eng_status ON findings (engagement_id, global_status)",
        "CREATE INDEX IF NOT EXISTS idx_findings_eng_status_sev ON findings (engagement_id, global_status, severidad)",
        # JOIN opcional con assets en algunos listados/exportaciones.
        "CREATE INDEX IF NOT EXISTS idx_findings_asset_id ON findings (asset_id)",
    ]
    with engine.connect() as conn:
        for sql in statements:
            try:
                conn.execute(text(sql))
                conn.commit()
            except Exception as exc:  # noqa: BLE001 — un índice no debe bloquear el arranque
                conn.rollback()
                print(f"[index migration] omitido '{sql}': {exc}")
        # Refresca estadísticas del planificador para que use los índices nuevos de inmediato.
        for tbl in ("findings", "engagements"):
            try:
                conn.execute(text(f"ANALYZE {tbl}"))
                conn.commit()
            except Exception as exc:  # noqa: BLE001
                conn.rollback()
                print(f"[index migration] ANALYZE {tbl} omitido: {exc}")


def _migrate_scan_runs_engagement_fk_cascade() -> None:
    sql = """
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'scan_runs_engagement_id_fkey'
          AND table_name = 'scan_runs'
      ) THEN
        ALTER TABLE scan_runs DROP CONSTRAINT scan_runs_engagement_id_fkey;
        ALTER TABLE scan_runs
          ADD CONSTRAINT scan_runs_engagement_id_fkey
          FOREIGN KEY (engagement_id) REFERENCES engagements(id) ON DELETE CASCADE;
      END IF;

      IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'asset_scan_targets_engagement_id_fkey'
          AND table_name = 'asset_scan_targets'
      ) THEN
        ALTER TABLE asset_scan_targets DROP CONSTRAINT asset_scan_targets_engagement_id_fkey;
        ALTER TABLE asset_scan_targets
          ADD CONSTRAINT asset_scan_targets_engagement_id_fkey
          FOREIGN KEY (engagement_id) REFERENCES engagements(id) ON DELETE SET NULL;
      END IF;
    END $$;
    """
    with engine.connect() as conn:
        conn.execute(text(sql))
        conn.commit()


def _migrate_asset_source_columns() -> None:
    alters = [
        "ALTER TABLE assets ADD COLUMN IF NOT EXISTS os VARCHAR(255)",
        "ALTER TABLE assets ADD COLUMN IF NOT EXISTS asset_type VARCHAR(255)",
        "ALTER TABLE assets ADD COLUMN IF NOT EXISTS owner VARCHAR(255)",
        "ALTER TABLE assets ADD COLUMN IF NOT EXISTS location VARCHAR(255)",
        "ALTER TABLE assets ADD COLUMN IF NOT EXISTS last_scan_date TIMESTAMPTZ",
        "ALTER TABLE assets ADD COLUMN IF NOT EXISTS discovery_method VARCHAR(128)",
        "ALTER TABLE assets ADD COLUMN IF NOT EXISTS is_in_scope BOOLEAN DEFAULT TRUE",
        "ALTER TABLE assets ADD COLUMN IF NOT EXISTS scope_version INTEGER",
        "ALTER TABLE assets ADD COLUMN IF NOT EXISTS source_type VARCHAR(64) DEFAULT 'inventory'",
        "ALTER TABLE assets ADD COLUMN IF NOT EXISTS engagement_id UUID",
        "ALTER TABLE assets ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb",
    ]
    with engine.connect() as conn:
        for sql in alters:
            conn.execute(text(sql))
        conn.commit()


def _migrate_auth_tenant_columns() -> None:
    alters = [
        "ALTER TABLE engagements ADD COLUMN IF NOT EXISTS tenant_id UUID",
        "ALTER TABLE assets ADD COLUMN IF NOT EXISTS tenant_id UUID",
        "ALTER TABLE docx_templates ADD COLUMN IF NOT EXISTS tenant_id UUID",
        "ALTER TABLE tenants ADD COLUMN IF NOT EXISTS descripcion TEXT",
        "ALTER TABLE tenants ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE",
    ]
    with engine.connect() as conn:
        for sql in alters:
            conn.execute(text(sql))
        conn.commit()


def _migrate_finding_status_enum() -> None:
    alters = [
        "ALTER TYPE findingstatus ADD VALUE IF NOT EXISTS 'identificado'",
        "ALTER TYPE findingstatus ADD VALUE IF NOT EXISTS 'cerrado'",
        "ALTER TYPE findingstatus ADD VALUE IF NOT EXISTS 'retest_pendiente'",
        "ALTER TYPE findingstatus ADD VALUE IF NOT EXISTS 'retest_en_curso'",
        "ALTER TYPE findingstatus ADD VALUE IF NOT EXISTS 'atendido'",
        "ALTER TYPE findingstatus ADD VALUE IF NOT EXISTS 'remediado'",
        "ALTER TYPE findingstatus ADD VALUE IF NOT EXISTS 'reaparecido'",
    ]
    with engine.connect() as conn:
        for sql in alters:
            conn.execute(text(sql))
        conn.commit()


def _migrate_workspace_table() -> None:
    sql = """
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'Phantom_workspaces'
      ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'phantom_workspaces'
      ) THEN
        ALTER TABLE "Phantom_workspaces" RENAME TO phantom_workspaces;
      END IF;

      IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'spectra_workspaces'
      ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'phantom_workspaces'
      ) THEN
        ALTER TABLE spectra_workspaces RENAME TO phantom_workspaces;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'phantom_workspaces'
      ) AND EXISTS (
        SELECT 1 FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public' AND t.typname = 'Phantom_workspaces'
      ) THEN
        DROP TYPE "Phantom_workspaces";
      END IF;
    END $$;
    """
    with engine.connect() as conn:
        conn.execute(text(sql))
        conn.commit()


def _migrate_tenant_branding() -> None:
    alters = [
        "ALTER TABLE tenants ADD COLUMN IF NOT EXISTS branding JSONB DEFAULT '{}'::jsonb",
        "UPDATE tenants SET branding = '{}'::jsonb WHERE branding IS NULL",
    ]
    with engine.connect() as conn:
        for sql in alters:
            conn.execute(text(sql))
        conn.commit()


def _migrate_user_preferences() -> None:
    alters = [
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}'::jsonb",
        "UPDATE users SET preferences = '{}'::jsonb WHERE preferences IS NULL",
    ]
    with engine.connect() as conn:
        for sql in alters:
            conn.execute(text(sql))
        conn.commit()


def _migrate_audit_events_indexes() -> None:
    alters = [
        "CREATE INDEX IF NOT EXISTS ix_audit_events_tenant_id ON audit_events (tenant_id)",
        "CREATE INDEX IF NOT EXISTS ix_audit_events_created_at ON audit_events (created_at DESC)",
    ]
    with engine.connect() as conn:
        for sql in alters:
            conn.execute(text(sql))
        conn.commit()


def _migrate_scan_and_groups() -> None:
    alters = [
        "ALTER TABLE tenants ADD COLUMN IF NOT EXISTS tenant_kind VARCHAR(32) DEFAULT 'pentest'",
        "UPDATE tenants SET tenant_kind = 'pentest' WHERE tenant_kind IS NULL",
    ]
    with engine.connect() as conn:
        for sql in alters:
            conn.execute(text(sql))
        conn.commit()


def run_schema_migrations() -> None:
    if settings.is_sqlite:
        Base.metadata.create_all(bind=engine)
        return
    with engine.connect() as conn:
        conn.execute(text("CREATE SCHEMA IF NOT EXISTS core"))
        conn.commit()
    _migrate_workspace_table()
    Base.metadata.create_all(bind=engine)
    _migrate_finding_columns()
    _migrate_engagement_profile()
    _migrate_engagement_fk_cascade()
    _migrate_remediation_plan_finding_fk_cascade()
    _migrate_report_jobs_kind()
    _migrate_report_jobs_template_fk_cascade()
    _migrate_auth_tenant_columns()
    _migrate_asset_source_columns()
    _migrate_finding_indexes()
    _migrate_finding_status_enum()
    _migrate_scan_and_groups()
    _migrate_scan_runs_engagement_fk_cascade()
    _migrate_tenant_branding()
    _migrate_user_preferences()
    _migrate_audit_events_indexes()
    db = SessionLocal()
    try:
        if db.query(ComplianceControl).count() == 0:
            controls = [
                ComplianceControl(
                    framework=ComplianceFramework.iso27001,
                    control_id="A.12.6.1",
                    control_name="Gestión de vulnerabilidades técnicas",
                    description="Se debe obtener oportunamente información sobre las vulnerabilidades técnicas de los sistemas de información que se utilicen.",
                    category="Seguridad de las operaciones",
                ),
                ComplianceControl(
                    framework=ComplianceFramework.iso27001,
                    control_id="A.9.1.1",
                    control_name="Política de control de acceso",
                    description="Se debe establecer, documentar y revisar una política de control de acceso basada en los requisitos del negocio.",
                    category="Control de acceso",
                ),
                ComplianceControl(
                    framework=ComplianceFramework.nist_csf,
                    control_id="DE.CM-8",
                    control_name="Análisis de Vulnerabilidades",
                    description="Se realizan análisis de vulnerabilidades para identificar posibles brechas y debilidades de seguridad.",
                    category="Monitoreo Continuo",
                ),
                ComplianceControl(
                    framework=ComplianceFramework.nist_csf,
                    control_id="PR.AC-1",
                    control_name="Gestión de Credenciales",
                    description="Las identidades y credenciales de los usuarios se gestionan, limitan y auditan de forma segura.",
                    category="Protección de Accesos",
                ),
                ComplianceControl(
                    framework=ComplianceFramework.pci_dss,
                    control_id="11.2",
                    control_name="Escaneos de vulnerabilidades de red",
                    description="Ejecutar escaneos de vulnerabilidades de red internos y externos al menos trimestralmente.",
                    category="Pruebas de Seguridad",
                ),
                ComplianceControl(
                    framework=ComplianceFramework.pci_dss,
                    control_id="6.5",
                    control_name="Desarrollo de software seguro",
                    description="Abordar las vulnerabilidades de codificación comunes durante los procesos de desarrollo de software.",
                    category="Desarrollo Seguro",
                ),
            ]
            db.bulk_save_objects(controls)
            db.commit()
            print("Compliance controls seeded.")
    except Exception as e:
        print(f"Error seeding: {e}")
        db.rollback()
    finally:
        db.close()


def run_startup_seeds() -> None:
    try:
        seed_auth_data(SessionLocal())
    except Exception as e:
        print(f"Auth seed: {e}")
    try:
        backfill_tenant_ids(SessionLocal())
    except Exception as e:
        print(f"Tenant backfill: {e}")
    try:
        seed_compliance_controls()
    except Exception:
        pass


def wait_for_schema_ready(timeout_seconds: float = 120.0) -> None:
    if settings.is_sqlite:
        return
    deadline = time.monotonic() + timeout_seconds
    while time.monotonic() < deadline:
        with engine.connect() as conn:
            ready = conn.execute(
                text(
                    "SELECT EXISTS ("
                    "  SELECT 1 FROM information_schema.tables"
                    "  WHERE table_schema = 'public' AND table_name = :table"
                    ")"
                ),
                {"table": _SCHEMA_READY_TABLE},
            ).scalar()
            if ready:
                return
        time.sleep(0.25)
    raise RuntimeError("Database schema not ready after startup wait")


def bootstrap_database() -> None:
    """Single-process schema + seeds (call before multi-worker Uvicorn)."""
    if settings.is_sqlite:
        run_schema_migrations()
        run_startup_seeds()
        return
    lock_conn = engine.connect()
    lock_conn.execute(text("SELECT pg_advisory_lock(:id)"), {"id": _DB_INIT_LOCK_ID})
    try:
        run_schema_migrations()
        run_startup_seeds()
    finally:
        lock_conn.execute(text("SELECT pg_advisory_unlock(:id)"), {"id": _DB_INIT_LOCK_ID})
        lock_conn.close()


def worker_startup(*, schema_prebootstrapped: bool) -> None:
    """Per-worker lifespan hook: migrate only if needed, never race seeds."""
    if settings.is_sqlite:
        if not schema_prebootstrapped:
            bootstrap_database()
        return
    if schema_prebootstrapped:
        wait_for_schema_ready()
        return

    lock_conn = engine.connect()
    got_lock = lock_conn.execute(
        text("SELECT pg_try_advisory_lock(:id)"), {"id": _DB_INIT_LOCK_ID}
    ).scalar()
    try:
        if got_lock:
            run_schema_migrations()
            run_startup_seeds()
        else:
            wait_for_schema_ready()
    finally:
        if got_lock:
            lock_conn.execute(text("SELECT pg_advisory_unlock(:id)"), {"id": _DB_INIT_LOCK_ID})
        lock_conn.close()
