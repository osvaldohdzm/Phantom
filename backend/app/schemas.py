from datetime import date, datetime
from enum import Enum
from typing import Any, List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class EnvironmentEnum(str, Enum):
    prod = "Prod"
    dev = "Dev"


class SeverityEnum(str, Enum):
    critical = "Critical"
    high = "High"
    medium = "Medium"
    low = "Low"
    info = "Info"


class FindingStatusEnum(str, Enum):
    abierta = "Identificado"
    identificado = "Identificado"
    validada = "Validado"
    en_proceso = "En Proceso de Remediación"
    retest_pendiente = "Re-test Pendiente"
    retest_en_curso = "Re-test En Curso"
    cerrado = "Cerrado"
    falso_positivo = "Falso Positivo"
    riesgo_aceptado = "Riesgo Aceptado"
    atendido = "Atendido"
    remediado = "Remediado"
    reaparecido = "Reaparecido"


class EngagementTypeEnum(str, Enum):
    black_box = "Caja Negra"
    grey_box = "Caja Gris"
    white_box = "Caja Blanca"


class AssetSourceTypeEnum(str, Enum):
    inventory = "inventory"
    external_recon = "external_recon"
    external_attack_surface = "external_attack_surface"
    internal_recon = "internal_recon"
    internal_attack_surface = "internal_attack_surface"


class AssetCreate(BaseModel):
    nombre: str
    ip_publica: Optional[str] = None
    ip_privada: Optional[str] = None
    fqdn: Optional[str] = None
    criticidad: Optional[str] = None
    ambiente: EnvironmentEnum = EnvironmentEnum.prod
    os: Optional[str] = None
    asset_type: Optional[str] = None
    owner: Optional[str] = None
    location: Optional[str] = None
    last_scan_date: Optional[datetime] = None
    discovery_method: Optional[str] = None
    is_in_scope: bool = True
    scope_version: Optional[int] = None
    source_type: AssetSourceTypeEnum = AssetSourceTypeEnum.inventory
    engagement_id: Optional[UUID] = None
    metadata: dict = Field(default_factory=dict)


class AssetRead(AssetCreate):
    model_config = ConfigDict(from_attributes=True)
    id: UUID


class AssetBulkRow(AssetCreate):
    id: Optional[UUID] = None


class AssetBulkUpsertRequest(BaseModel):
    rows: List[AssetBulkRow]
    delete_ids: List[UUID] = Field(default_factory=list)


class AssetBulkUpsertResponse(BaseModel):
    created: int
    updated: int
    deleted: int
    rows: List[AssetRead]


class AssetScanTargetRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    target_key: str
    display_name: str
    componente_afectado: str
    tool_sources: List[str] = Field(default_factory=list)
    finding_count: int
    status: str
    target_source_type: Optional[str] = None
    promoted_asset_id: Optional[UUID] = None
    engagement_id: Optional[UUID] = None


class AssetScanTargetRefreshResponse(BaseModel):
    discovered: int
    pending: int
    message: Optional[str] = None


class AssetScanTargetPromoteRequest(BaseModel):
    target_ids: List[UUID]
    source_type: AssetSourceTypeEnum = AssetSourceTypeEnum.inventory
    engagement_id: Optional[UUID] = None


class AssetScanTargetPassRequest(BaseModel):
    target_ids: List[UUID]


class AssetScanTargetActionResponse(BaseModel):
    processed: int
    asset_ids: List[UUID] = Field(default_factory=list)
    message: Optional[str] = None


# --- Vault Schemas ---

class CredentialTypeEnum(str, Enum):
    ssh = "ssh"
    rdp = "rdp"
    web = "web"
    database = "database"
    api_key = "api_key"
    certificate = "certificate"


class VaultCredentialCreate(BaseModel):
    engagement_id: Optional[UUID] = None
    asset_id: Optional[UUID] = None
    label: str
    credential_type: CredentialTypeEnum
    username: str
    secret: str
    service_port: Optional[int] = None
    notes: Optional[str] = None


class VaultCredentialRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    engagement_id: Optional[UUID] = None
    asset_id: Optional[UUID] = None
    label: str
    credential_type: CredentialTypeEnum
    service_port: Optional[int] = None
    created_at: datetime
    updated_at: datetime


class VaultCredentialReveal(BaseModel):
    username: str
    secret: str
    notes: Optional[str] = None


class VaultAuditLogRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    credential_id: UUID
    action: str
    actor: str
    ip_address: Optional[str] = None
    timestamp: datetime
    details: Optional[str] = None


# --- Scope Schemas ---

class SnapshotTypeEnum(str, Enum):
    initial_discovery = "initial_discovery"
    validated = "validated"
    final = "final"


class ScopeSnapshotCreate(BaseModel):
    snapshot_type: SnapshotTypeEnum
    asset_ids: List[UUID]
    notes: Optional[str] = None


class ScopeSnapshotRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    engagement_id: UUID
    version: int
    snapshot_type: SnapshotTypeEnum
    asset_ids: List[UUID]
    created_by: str
    created_at: datetime
    notes: Optional[str] = None


class ScopeCompareResponse(BaseModel):
    added_assets: List[AssetRead]
    removed_assets: List[AssetRead]
    initial_version: int
    final_version: int


# --- TTP Catalog Schemas ---

class MITRETacticEnum(str, Enum):
    reconnaissance = "Reconnaissance"
    resource_development = "Resource Development"
    initial_access = "Initial Access"
    execution = "Execution"
    persistence = "Persistence"
    privilege_escalation = "Privilege Escalation"
    defense_evasion = "Defense Evasion"
    credential_access = "Credential Access"
    discovery = "Discovery"
    lateral_movement = "Lateral Movement"
    collection = "Collection"
    command_and_control = "Command and Control"
    exfiltration = "Exfiltration"
    impact = "Impact"


class TTPCreate(BaseModel):
    name: str
    tactic: MITRETacticEnum
    tool: str
    command_template: str
    description: str
    tags: List[str] = Field(default_factory=list)
    is_active: bool = True


class TTPRead(TTPCreate):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    version: int
    created_at: datetime
    updated_at: datetime


# --- Execution Log Schemas ---

class ExecutionLogCreate(BaseModel):
    engagement_id: UUID
    asset_id: Optional[UUID] = None
    node_id: Optional[str] = None
    command: str
    raw_output: str
    executed_by: str = "admin"
    duration_ms: Optional[int] = None
    parent_log_id: Optional[UUID] = None


class ExecutionLogRead(ExecutionLogCreate):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    output_hash: str
    executed_at: datetime


# --- Evidence Schemas ---

class AttachmentTypeEnum(str, Enum):
    screenshot = "screenshot"
    console_log = "console_log"
    pcap = "pcap"
    request_response = "request_response"
    file = "file"


class EvidenceAttachmentCreate(BaseModel):
    attachment_type: AttachmentTypeEnum
    filename: str
    description: Optional[str] = None


class EvidenceAttachmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    finding_id: UUID
    attachment_type: AttachmentTypeEnum
    filename: str
    mime_type: str
    file_path: str
    file_hash: str
    description: Optional[str] = None
    uploaded_by: str
    uploaded_at: datetime


# --- Compliance Schemas ---

class ComplianceFrameworkEnum(str, Enum):
    iso27001 = "ISO27001"
    nist_csf = "NIST_CSF"
    pci_dss = "PCI_DSS"
    owasp = "OWASP"
    mitre = "MITRE"


class ComplianceMappingCreate(BaseModel):
    framework: ComplianceFrameworkEnum
    control_id: str
    control_name: str
    notes: Optional[str] = None


class ComplianceMappingRead(ComplianceMappingCreate):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    finding_id: UUID


class ComplianceControlCreate(BaseModel):
    framework: ComplianceFrameworkEnum
    control_id: str
    control_name: str
    description: str
    category: str


class ComplianceControlRead(ComplianceControlCreate):
    model_config = ConfigDict(from_attributes=True)
    id: UUID




class FindingCreate(BaseModel):
    titulo: str
    descripcion: Optional[str] = None
    severidad: SeverityEnum = SeverityEnum.medium
    cvss_score: Optional[float] = None
    cvss_vector: Optional[str] = None
    cve: Optional[str] = None
    cwe: Optional[str] = None
    evidencia_url: Optional[str] = None
    asset_id: Optional[UUID] = None
    engagement_id: Optional[UUID] = None
    catalog_id: Optional[int] = None
    raw_tool_output: Optional[str] = None
    explicacion_tecnica: Optional[str] = None
    amenaza_ampliada: Optional[str] = None
    componente_afectado: Optional[str] = None
    metodo_deteccion: Optional[str] = None
    tool_source: Optional[str] = None
    tool_vuln_id: Optional[str] = None
    propuesta_remediacion: Optional[str] = None
    referencias: Optional[str] = None
    epss_score: Optional[float] = None
    kev_listed: bool = False


class FindingRead(FindingCreate):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    status: FindingStatusEnum
    explicacion_tecnica: Optional[str] = None
    amenaza_ampliada: Optional[str] = None
    owasp_category: Optional[str] = None
    mitre_technique_id: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    first_seen: Optional[datetime] = None
    last_seen: Optional[datetime] = None
    origin_projects: Optional[List[dict]] = None
    detection_sources: Optional[List[dict]] = None
    sync_status: Optional[str] = None
    global_status: Optional[str] = None
    ai_summary: Optional[str] = None
    ai_group_id: Optional[UUID] = None
    remediation_context: Optional[str] = None
    dedup_fingerprint: Optional[str] = None
    lifecycle_history: Optional[List[dict]] = None


class AIEnrichRequest(BaseModel):
    raw_tool_output: Optional[str] = Field(None, description="Salida cruda Nessus/Nmap/etc.")
    titulo: Optional[str] = None
    componente_afectado: Optional[str] = Field(None, description="Ej. PHP 7.4, kernel 5.4")


class AIEnrichResponse(BaseModel):
    explicacion_tecnica: str
    amenaza_ampliada: str
    owasp_top10: Optional[str] = None
    mitre_attack: List[str] = Field(default_factory=list)
    sugerencia_remediacion: str
    disclaimer: str = "Revisión humana obligatoria antes de incluir en informe al cliente."


class IngestBatchResponse(BaseModel):
    source: str
    created_count: int
    finding_ids: List[UUID] = Field(default_factory=list)
    message: Optional[str] = None
    column_map: Optional[dict[str, str]] = None


class NessusRescanResponse(BaseModel):
    scan_run_id: UUID
    source: str = "nessus-csv-rescan"
    scope: str
    absent_policy: str
    new_count: int = 0
    updated_count: int = 0
    reaparecido_count: int = 0
    absent_count: int = 0
    total_in_scan: int = 0
    message: Optional[str] = None


# --- Remediation & Retest Schemas ---

class RemediationPlanCreate(BaseModel):
    responsable: Optional[str] = None
    fecha_compromiso: Optional[date] = None
    estado_remediacion: Optional[str] = None
    sla_date: Optional[date] = None
    priority: Optional[int] = None
    retest_trigger: Optional[str] = None


class RemediationPlanRead(RemediationPlanCreate):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    finding_id: UUID
    retest_count: int
    last_retest_at: Optional[datetime] = None
    last_retest_result: Optional[str] = None
    history: Optional[List[dict]] = None  # JSON list of changes


class RetestRequest(BaseModel):
    executed_by: str = "admin"
    notes: Optional[str] = None


class RetestResultSubmit(BaseModel):
    result: str  # e.g., 'passed', 'failed', 'partial'
    notes: Optional[str] = None
    executed_by: str = "admin"


# --- Engagement Schemas ---

class ServiceTypeEnum(str, Enum):
    pentest = "Pentest"
    dast = "DAST"
    sast = "SAST"
    api = "API"
    infraestructura = "Infraestructura"
    cloud = "Cloud"
    mobile = "Mobile"
    av_infra = "AV Infraestructura"
    av_cloud = "AV Cloud"


class EngagementProfileAlcance(BaseModel):
    ips: str = ""
    dominios: str = ""
    urls: str = ""
    ambientes: str = ""
    activos_incluidos: str = ""
    activos_excluidos: str = ""


class EngagementProfileTipoAnalisis(BaseModel):
    metodo: str = ""
    alcance_red: str = ""
    intrusivo: str = ""


class EngagementProfileAccesos(BaseModel):
    credenciales_entregadas: bool = False
    credenciales_notas: Optional[str] = None
    vpn_requerida: bool = False
    vpn_notas: Optional[str] = None
    usuarios_prueba: bool = False
    usuarios_prueba_notas: Optional[str] = None
    codigo_fuente_entregado: bool = False
    codigo_fuente_notas: Optional[str] = None
    documentacion_entregada: bool = False
    documentacion_notas: Optional[str] = None


class EngagementProfileReglas(BaseModel):
    horarios_permitidos: str = ""
    dos_permitido: bool = False
    explotacion_permitida: bool = False
    ingenieria_social_permitida: bool = False
    contacto_emergencia: str = ""


class EngagementProfileHerramientas(BaseModel):
    nmap: bool = False
    burp_suite: bool = False
    owasp_zap: bool = False
    nessus: bool = False
    metasploit: bool = False
    nuclei: bool = False


class EngagementProfileDast(BaseModel):
    url_objetivo: str = ""
    login_url: str = ""
    auth_requerida: bool = False
    headers_custom: str = ""


class EngagementProfileSast(BaseModel):
    repositorio: str = ""
    branch: str = ""
    lenguaje: str = ""
    scm: str = ""


class EngagementProfilePentestInfra(BaseModel):
    ip_objetivo: str = ""
    segmento_red: str = ""
    firewall_waf: str = ""
    servicios_criticos: str = ""


class EngagementProfileReporting(BaseModel):
    severidad: bool = True
    cvss: bool = True
    cwe: bool = True
    owasp: bool = True
    mitre: bool = True
    evidencia: bool = True
    remediacion: bool = True
    estado: bool = True


class EngagementProfile(BaseModel):
    alcance: EngagementProfileAlcance = Field(default_factory=EngagementProfileAlcance)
    tipo_analisis: EngagementProfileTipoAnalisis = Field(default_factory=EngagementProfileTipoAnalisis)
    accesos: EngagementProfileAccesos = Field(default_factory=EngagementProfileAccesos)
    reglas: EngagementProfileReglas = Field(default_factory=EngagementProfileReglas)
    herramientas: EngagementProfileHerramientas = Field(default_factory=EngagementProfileHerramientas)
    dast: EngagementProfileDast = Field(default_factory=EngagementProfileDast)
    sast: EngagementProfileSast = Field(default_factory=EngagementProfileSast)
    pentest_infra: EngagementProfilePentestInfra = Field(default_factory=EngagementProfilePentestInfra)
    reporting: EngagementProfileReporting = Field(default_factory=EngagementProfileReporting)


class EngagementCreate(BaseModel):
    cliente: str
    nombre_proyecto: Optional[str] = None
    estado: Optional[str] = None
    responsable: Optional[str] = None
    tipo_servicio: Optional[ServiceTypeEnum] = None
    fecha_inicio: date
    fecha_fin: Optional[date] = None
    tipo: EngagementTypeEnum = EngagementTypeEnum.black_box
    profile: Optional[EngagementProfile] = None


class EngagementRead(EngagementCreate):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    profile: EngagementProfile = Field(default_factory=EngagementProfile)
    tipo_servicio: Optional[str] = None

    @field_validator("profile", mode="before")
    @classmethod
    def _coerce_profile(cls, v: object) -> EngagementProfile:
        if isinstance(v, EngagementProfile):
            return v
        if isinstance(v, dict):
            return EngagementProfile.model_validate(v)
        return EngagementProfile()


class EngagementUpdate(BaseModel):
    cliente: Optional[str] = None
    nombre_proyecto: Optional[str] = None
    estado: Optional[str] = None
    responsable: Optional[str] = None
    tipo_servicio: Optional[ServiceTypeEnum] = None
    fecha_inicio: Optional[date] = None
    fecha_fin: Optional[date] = None
    tipo: Optional[EngagementTypeEnum] = None
    profile: Optional[EngagementProfile] = None


# --- Phantom Workspace Schemas ---

class WorkspaceCreate(BaseModel):
    name: str
    description: Optional[str] = None
    category: Optional[str] = None
    engagement_id: Optional[UUID] = None
    asset_id: Optional[UUID] = None
    global_vars: dict = Field(default_factory=dict)
    nodes: list = Field(default_factory=list)
    connections: list = Field(default_factory=list)
    custom_rules: Optional[list] = None
    created_by: str = "admin"


class WorkspaceUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    engagement_id: Optional[UUID] = None
    asset_id: Optional[UUID] = None
    global_vars: Optional[dict] = None
    nodes: Optional[list] = None
    connections: Optional[list] = None
    custom_rules: Optional[list] = None


class WorkspaceRead(WorkspaceCreate):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    created_at: datetime
    updated_at: datetime


# --- DOCX Template & Report Schemas ---

class DocxTemplateRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    name: str
    description: Optional[str] = None
    file_path: str
    placeholders: Optional[List[str]] = None
    created_by: str
    created_at: datetime
    updated_at: datetime


class GenerateDocxReportRequest(BaseModel):
    template_id: UUID
    engagement_id: Optional[UUID] = None
    finding_ids: Optional[List[UUID]] = None
    only_validated: bool = False
    status_filter: Optional[str] = None
    created_by: str = "admin"


class GenerateDocxReportResponse(BaseModel):
    job_id: UUID
    status: str
    findings_count: int
    consolidated_download_url: str
    individual_count: int
    message: str


class GenerateFindingsTableRequest(BaseModel):
    engagement_id: Optional[UUID] = None
    finding_ids: Optional[List[UUID]] = None
    only_validated: bool = False
    status_filter: Optional[str] = None
    created_by: str = "admin"


class GenerateFindingsTableResponse(BaseModel):
    job_id: UUID
    status: str
    findings_count: int
    grouped_rows: int
    download_url: str
    message: str


class SyncFromCatalogRequest(BaseModel):
    engagement_id: Optional[UUID] = None
    finding_ids: Optional[List[UUID]] = None
    catalog_id: Optional[str] = None
    only_validated: bool = False


class SyncFromCatalogResponse(BaseModel):
    synced: int
    skipped: int
    total: int
    errors: List[str] = Field(default_factory=list)


class ConsolidateMasterCatalogRequest(BaseModel):
    engagement_id: Optional[UUID] = None
    finding_ids: Optional[List[UUID]] = None


class ConsolidateMasterCatalogResponse(BaseModel):
    synced: int
    skipped: int
    total: int
    groups: int = 0
    errors: List[str] = Field(default_factory=list)
    details: Optional[dict] = None


class ReportJobRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    engagement_id: Optional[UUID] = None
    template_id: Optional[UUID] = None
    report_kind: str = "vulnerability_tables"
    grouped_rows: Optional[int] = None
    status: str  # ReportJobStatus enum value
    finding_ids: List[str]
    output_path: Optional[str] = None
    individual_paths: Optional[List[str]] = None
    findings_count: int
    error_message: Optional[str] = None
    created_by: str
    created_at: datetime
    completed_at: Optional[datetime] = None


class ReportJobListItem(BaseModel):
    id: UUID
    engagement_id: Optional[UUID] = None
    template_id: Optional[UUID] = None
    report_kind: str = "vulnerability_tables"
    template_name: str
    status: str
    findings_count: int
    individual_count: int
    grouped_rows: Optional[int] = None
    created_at: datetime
    completed_at: Optional[datetime] = None
    consolidated_download_url: Optional[str] = None
    error_message: Optional[str] = None


class FindingStatusUpdate(BaseModel):
    status: FindingStatusEnum
    notes: Optional[str] = None


class FindingUpdate(BaseModel):
    titulo: Optional[str] = None
    descripcion: Optional[str] = None
    severidad: Optional[SeverityEnum] = None
    cvss_score: Optional[float] = None
    cvss_vector: Optional[str] = None
    cve: Optional[str] = None
    cwe: Optional[str] = None
    explicacion_tecnica: Optional[str] = None
    amenaza_ampliada: Optional[str] = None
    evidencia_url: Optional[str] = None
    asset_id: Optional[UUID] = None
    engagement_id: Optional[UUID] = None
    catalog_id: Optional[int] = None
    raw_tool_output: Optional[str] = None
    componente_afectado: Optional[str] = None
    metodo_deteccion: Optional[str] = None
    tool_source: Optional[str] = None
    tool_vuln_id: Optional[str] = None
    propuesta_remediacion: Optional[str] = None
    referencias: Optional[str] = None
    epss_score: Optional[float] = None
    kev_listed: Optional[bool] = None
    seguimiento_estatus: Optional[str] = None


class BulkValidateRequest(BaseModel):
    finding_ids: List[UUID]
    notes: Optional[str] = None


class BulkDeleteRequest(BaseModel):
    finding_ids: List[UUID]


class BulkDeleteByQueryRequest(BaseModel):
    engagement_id: Optional[UUID] = None
    # Borrado a nivel repositorio (sin engagement). Flag explícito para evitar
    # borrados masivos accidentales si engagement_id se omite por error.
    repository: bool = False
    severidad: Optional[str] = None
    severidades: Optional[str] = None
    q: Optional[str] = None
    tool_source: Optional[str] = None


class PublishToRepositoryRequest(BaseModel):
    engagement_id: UUID


class PublishToRepositoryResponse(BaseModel):
    published_count: int
    message: Optional[str] = None


# --- Auth / multi-tenant ---


class AuthLoginRequest(BaseModel):
    email: str
    password: str
    tenant_id: Optional[UUID] = None


class AuthSwitchTenantRequest(BaseModel):
    tenant_id: UUID


class TenantBrandingRead(BaseModel):
    """Configuración white-label del tenant (logo, colores, informes, login)."""

    language: Optional[str] = "es"
    product_name: Optional[str] = None
    workspace_name: Optional[str] = None
    tagline: Optional[str] = None
    login_headline: Optional[str] = None
    login_subtitle: Optional[str] = None
    login_message: Optional[str] = None
    logo_url: Optional[str] = None
    logo_dark_url: Optional[str] = None
    logo_secondary_url: Optional[str] = None
    favicon_url: Optional[str] = None
    login_banner_url: Optional[str] = None
    dashboard_banner_url: Optional[str] = None
    primary_color: Optional[str] = None
    accent_color: Optional[str] = None
    sidebar_color: Optional[str] = None
    default_theme: Optional[str] = "system"
    allow_theme_toggle: bool = True
    custom_domain: Optional[str] = None
    custom_domain_verified: bool = False
    report_company_name: Optional[str] = None
    report_footer: Optional[str] = None
    report_watermark: Optional[str] = None
    report_classification: Optional[str] = None
    email_from_name: Optional[str] = None
    email_footer_html: Optional[str] = None
    official_fields: Optional[dict[str, Any]] = None


class TenantBrandingUpdate(BaseModel):
    language: Optional[str] = Field(None, pattern="^(es|en)$")
    product_name: Optional[str] = Field(None, max_length=120)
    workspace_name: Optional[str] = Field(None, max_length=255)
    tagline: Optional[str] = Field(None, max_length=255)
    login_headline: Optional[str] = Field(None, max_length=255)
    login_subtitle: Optional[str] = Field(None, max_length=500)
    login_message: Optional[str] = Field(None, max_length=500)
    logo_url: Optional[str] = Field(None, max_length=2048)
    logo_dark_url: Optional[str] = Field(None, max_length=2048)
    logo_secondary_url: Optional[str] = Field(None, max_length=2048)
    favicon_url: Optional[str] = Field(None, max_length=2048)
    login_banner_url: Optional[str] = Field(None, max_length=2048)
    dashboard_banner_url: Optional[str] = Field(None, max_length=2048)
    primary_color: Optional[str] = Field(None, max_length=7)
    accent_color: Optional[str] = Field(None, max_length=7)
    sidebar_color: Optional[str] = Field(None, max_length=7)
    default_theme: Optional[str] = Field(None, pattern="^(light|dark|system)$")
    allow_theme_toggle: Optional[bool] = None
    custom_domain: Optional[str] = Field(None, max_length=255)
    custom_domain_verified: Optional[bool] = None
    report_company_name: Optional[str] = Field(None, max_length=255)
    report_footer: Optional[str] = Field(None, max_length=2000)
    report_watermark: Optional[str] = Field(None, max_length=255)
    report_classification: Optional[str] = Field(None, max_length=120)
    email_from_name: Optional[str] = Field(None, max_length=255)
    email_footer_html: Optional[str] = Field(None, max_length=8000)
    official_fields: Optional[dict[str, Any]] = None


class TenantBrandingPublicRead(BaseModel):
    """Branding expuesto sin autenticación (pantalla de login)."""

    tenant_id: UUID
    slug: str
    nombre: str
    branding: TenantBrandingRead


class AuthUserInfo(BaseModel):
    id: UUID
    email: str
    nombre: str
    ui_language_preference: str = "auto"
    ui_language: str = "es"
    must_change_password: bool = False


class AuthChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class UserPreferencesUpdate(BaseModel):
    ui_language: Optional[str] = Field(None, pattern="^(auto|es|en)$")


class AuthTenantInfo(BaseModel):
    id: UUID
    slug: str
    nombre: str
    role: str
    branding: Optional[TenantBrandingRead] = None


class AuthLoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: AuthUserInfo
    active_tenant_id: UUID
    role: str
    tenants: List[AuthTenantInfo]
    branding: Optional[TenantBrandingRead] = None


class AuthMeResponse(BaseModel):
    user: AuthUserInfo
    active_tenant_id: UUID
    role: str
    tenants: List[AuthTenantInfo]
    branding: Optional[TenantBrandingRead] = None


class UserRoleEnum(str, Enum):
    tenant_admin = "tenant_admin"
    analyst = "analyst"
    client_viewer = "client_viewer"
    platform_admin = "platform_admin"


class AdminUserRead(BaseModel):
    id: UUID
    email: str
    nombre: str
    is_active: bool
    role: str


class AdminUserCreate(BaseModel):
    email: str
    nombre: str
    password: str
    role: UserRoleEnum = UserRoleEnum.analyst
    tenant_ids: Optional[List[UUID]] = None


class AdminUserRoleUpdate(BaseModel):
    role: UserRoleEnum
    tenant_id: Optional[UUID] = None


class AdminUserUpdate(BaseModel):
    nombre: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None
    is_active: Optional[bool] = None


class AdminMembershipRead(BaseModel):
    membership_id: UUID
    tenant_id: UUID
    tenant_slug: str
    tenant_nombre: str
    role: str


class AdminUserWithMembershipsRead(BaseModel):
    id: UUID
    email: str
    nombre: str
    is_active: bool
    memberships: List[AdminMembershipRead]


class AdminMembershipAssign(BaseModel):
    tenant_id: UUID
    role: UserRoleEnum


class AdminUserMembershipsSet(BaseModel):
    memberships: List[AdminMembershipAssign]


class AdminAuditEventRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    action: str
    actor_id: Optional[UUID] = None
    actor_email: Optional[str] = None
    tenant_id: Optional[UUID] = None
    tenant_nombre: Optional[str] = None
    resource_type: Optional[str] = None
    resource_id: Optional[str] = None
    ip_address: Optional[str] = None
    details: Optional[dict] = None
    created_at: datetime


class AdminTenantRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    slug: str
    nombre: str
    descripcion: Optional[str] = None
    is_active: bool
    tenant_kind: str = "pentest"
    created_at: datetime
    users_count: int = 0
    engagements_count: int = 0


class AdminTenantCreate(BaseModel):
    slug: str = Field(..., min_length=2, max_length=64)
    nombre: str = Field(..., min_length=2, max_length=255)
    descripcion: Optional[str] = None
    tenant_kind: Optional[str] = Field(default="pentest", pattern="^(pentest|av_infra)$")
    default_language: Optional[str] = Field(default="es", pattern="^(es|en)$")
    add_me_as_admin: bool = True


class AdminTenantUpdate(BaseModel):
    slug: Optional[str] = Field(None, min_length=2, max_length=64)
    nombre: Optional[str] = Field(None, min_length=2, max_length=255)
    descripcion: Optional[str] = None
    is_active: Optional[bool] = None
    tenant_kind: Optional[str] = Field(None, pattern="^(pentest|av_infra)$")


class AdminDatabaseRuntimeRead(BaseModel):
    active: bool = True
    read_only: bool = True
    mode: str
    driver: Optional[str] = None
    connection_name: str = "DATABASE_URL"
    database_url_masked: str
    host: Optional[str] = None
    port: Optional[int] = None
    database: Optional[str] = None
    username: Optional[str] = None
    password_masked: Optional[str] = None
    query: Optional[str] = None
    redis_url_masked: str
    redis_host: Optional[str] = None
    redis_port: int = 6379
    redis_db: str = "0"
    auth_required: bool = True
    jwt_expire_minutes: int = 480
    can_switch_from_ui: bool = False
    switch_note: str


class AdminDeploymentProfileRead(BaseModel):
    id: str
    label: str
    description: str
    recommended_for: list[str]
    env_file_name: str
    database_mode: str
    limitations: list[str] = []


class AdminDeploymentEnvRead(BaseModel):
    profile_id: str
    env_content: str
    filename: str

