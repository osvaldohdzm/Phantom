/** Formato legible de duración en segundos. */
export function formatDuration(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r > 0 ? `${m}m ${r}s` : `${m}m`;
}

/** ETA lineal a partir de progreso parcial. */
export function estimateEtaSeconds(elapsedSec: number, done: number, total: number): number | null {
  if (elapsedSec < 2 || done <= 0 || total <= 0 || done >= total) return null;
  const rate = done / elapsedSec;
  if (!Number.isFinite(rate) || rate <= 0) return null;
  return Math.ceil((total - done) / rate);
}

/**
 * Heurística para ingesta Nessus según tamaño de archivo (solo orientativa).
 * Recalibrada tras la inserción masiva (bulk_insert_mappings) y la deduplicación
 * de lookups de catálogo: el servidor procesa ~3-4x más rápido que antes.
 */
export function estimateIngestSeconds(fileSizeBytes: number): number {
  const mb = fileSizeBytes / (1024 * 1024);
  if (mb < 1) return 6;
  if (mb < 5) return 15;
  if (mb < 20) return 40;
  if (mb < 80) return 90;
  return 180;
}

export type LoadProgress = {
  phase: 'counting' | 'fetching' | 'deleting' | 'processing';
  loaded: number;
  total: number;
  label?: string;
};
