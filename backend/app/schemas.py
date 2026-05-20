from datetime import date, datetime
from enum import Enum
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


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
    abierta = "Abierta"
    en_proceso = "En Proceso"
    remediada = "Remediada"
    validada = "Validada"
    falso_positivo = "Falso Positivo"
    riesgo_aceptado = "Riesgo Aceptado"


class EngagementTypeEnum(str, Enum):
    black_box = "Caja Negra"
    grey_box = "Caja Gris"
    white_box = "Caja Blanca"


class AssetCreate(BaseModel):
    nombre: str
    ip_publica: Optional[str] = None
    ip_privada: Optional[str] = None
    fqdn: Optional[str] = None
    criticidad: Optional[str] = None
    ambiente: EnvironmentEnum = EnvironmentEnum.prod


class AssetRead(AssetCreate):
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
    catalog_id: Optional[UUID] = None
    raw_tool_output: Optional[str] = None


class FindingRead(FindingCreate):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    status: FindingStatusEnum
    explicacion_tecnica: Optional[str] = None
    amenaza_ampliada: Optional[str] = None
    owasp_category: Optional[str] = None
    mitre_technique_id: Optional[str] = None
    created_at: datetime


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
