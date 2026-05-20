"""LangChain-ready enrichment. Sin API keys devuelve plantillas deterministas (sin alucinar datos falsos)."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

from app.config import settings


def _fallback_enrich(raw: str, titulo: Optional[str], componente: Optional[str]) -> Dict[str, Any]:
    snippet = (raw or "").strip()[:800]
    title = titulo or "Hallazgo sin título"
    comp = componente or "componente no especificado"
    return {
        "explicacion_tecnica": (
            f"Resumen estructurado (modo sin LLM) para «{title}». "
            f"Fragmento de evidencia normalizada ({len(snippet)} caracteres): {snippet or '[vacío]'}"
        ),
        "amenaza_ampliada": (
            "Sin modelo activo: describe manualmente el impacto confidencialidad/integridad/disponibilidad "
            "y el escenario de abuso en el contexto del cliente."
        ),
        "owasp_top10": None,
        "mitre_attack": [],
        "sugerencia_remediacion": (
            f"Actualizar o sustituir {comp} según inventario y vendor advisory; aplicar parches y "
            "endurecimiento de configuración verificados en entorno no productivo."
        ),
    }


def enrich_finding(
    raw_tool_output: str, titulo: Optional[str], componente_afectado: Optional[str]
) -> Dict[str, Any]:
    if settings.openai_api_key:
        try:
            from langchain_openai import ChatOpenAI

            llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.2, api_key=settings.openai_api_key)
            prompt = ChatPromptTemplate.from_messages(
                [
                    (
                        "system",
                        "Eres analista senior de seguridad. Respondes en español profesional. "
                        "No inventes CVE ni versiones no presentes en el texto. Si falta información, dilo.",
                    ),
                    (
                        "human",
                        "Título: {titulo}\nComponente: {comp}\nSalida de herramienta:\n{raw}\n\n"
                        "Genera: 1) Explicación técnica breve 2) Amenaza ampliada 3) Mapeo OWASP Top 10 (categoría) "
                        "4) IDs MITRE ATT&CK si aplican (lista separada por comas o vacío) "
                        "5) Sugerencia de remediación concreta.\n"
                        "Formato exacto por líneas: EXPLICACION:... AMENAZA:... OWASP:... MITRE:... REMEDIACION:...",
                    ),
                ]
            )
            chain = prompt | llm | StrOutputParser()
            text = chain.invoke(
                {
                    "raw": raw_tool_output[:12000],
                    "titulo": titulo or "",
                    "comp": componente_afectado or "",
                }
            )
            return _parse_llm_block(text)
        except Exception:
            return _fallback_enrich(raw_tool_output, titulo, componente_afectado)

    if settings.anthropic_api_key:
        try:
            from langchain_anthropic import ChatAnthropic

            llm = ChatAnthropic(model="claude-3-5-haiku-20241022", temperature=0.2, api_key=settings.anthropic_api_key)
            prompt = ChatPromptTemplate.from_messages(
                [
                    (
                        "system",
                        "Analista de ciberseguridad. Español. Sin inventar datos fuera del texto proporcionado.",
                    ),
                    (
                        "human",
                        "Título: {titulo}\nComponente: {comp}\nSalida:\n{raw}\n\n"
                        "Devuelve EXPLICACION, AMENAZA, OWASP, MITRE (coma), REMEDIACION en ese orden, prefijado.",
                    ),
                ]
            )
            chain = prompt | llm | StrOutputParser()
            text = chain.invoke(
                {"raw": raw_tool_output[:12000], "titulo": titulo or "", "comp": componente_afectado or ""}
            )
            return _parse_llm_block(text)
        except Exception:
            return _fallback_enrich(raw_tool_output, titulo, componente_afectado)

    return _fallback_enrich(raw_tool_output, titulo, componente_afectado)


def _parse_llm_block(text: str) -> Dict[str, Any]:
    def grab(prefix: str) -> str:
        for line in text.splitlines():
            if line.upper().startswith(prefix.upper()):
                return line.split(":", 1)[-1].strip()
        return ""

    mitre_raw = grab("MITRE")
    mitre_list: List[str] = [m.strip() for m in mitre_raw.split(",") if m.strip()] if mitre_raw else []
    owasp = grab("OWASP") or None
    return {
        "explicacion_tecnica": grab("EXPLICACION") or text[:2000],
        "amenaza_ampliada": grab("AMENAZA") or "",
        "owasp_top10": owasp,
        "mitre_attack": mitre_list,
        "sugerencia_remediacion": grab("REMEDIACION") or "",
    }
