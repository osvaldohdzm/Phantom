import { NextRequest, NextResponse } from 'next/server';
import { dbQuery } from '@/lib/db';
import {
  applyReplaceToText,
  buildScopeWhere,
  isSafeColumnName,
  resolveTargetColumns,
  validateRegexPattern,
  type BulkReplaceRule,
  type BulkReplaceSample,
  type BulkReplaceScope,
} from '@/lib/catalog-bulk-replace';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const BATCH = 150;
const SAMPLE_LIMIT = 12;

type RequestBody = {
  rules?: BulkReplaceRule[];
  dry_run?: boolean;
  scope?: BulkReplaceScope | null;
  sample_limit?: number;
};

async function loadTextColumns(): Promise<string[]> {
  const colsResult = await dbQuery<{ column_name: string }>(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'core' AND table_name = 'vulns_catalog'
       AND data_type IN ('text', 'character varying', 'character')
     ORDER BY ordinal_position ASC`
  );
  return colsResult.rows.map((r) => r.column_name).filter(isSafeColumnName);
}

function normalizeRules(raw: unknown): BulkReplaceRule[] | { error: string } {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { error: 'Debes indicar al menos una regla de reemplazo' };
  }
  if (raw.length > 50) {
    return { error: 'Máximo 50 reglas por operación' };
  }

  const rules: BulkReplaceRule[] = [];
  for (let i = 0; i < raw.length; i += 1) {
    const item = raw[i];
    if (!item || typeof item !== 'object') {
      return { error: `Regla ${i + 1} inválida` };
    }
    const find = typeof item.find === 'string' ? item.find : '';
    const replace = typeof item.replace === 'string' ? item.replace : '';
    const mode = item.mode === 'regex' ? 'regex' : 'exact';
    if (!find.trim()) {
      return { error: `Regla ${i + 1}: el texto a buscar no puede estar vacío` };
    }
    if (find.length > 2000 || replace.length > 8000) {
      return { error: `Regla ${i + 1}: cadena demasiado larga` };
    }
    if (mode === 'regex') {
      const err = validateRegexPattern(find);
      if (err) return { error: `Regla ${i + 1}: ${err}` };
    }
    const columns = Array.isArray(item.columns)
      ? item.columns.filter((c: string): c is string => typeof c === 'string' && isSafeColumnName(c))
      : null;
    rules.push({
      find,
      replace,
      mode,
      case_insensitive: item.case_insensitive !== false,
      columns: columns?.length ? columns : null,
    });
  }
  return rules;
}

function cellValue(raw: unknown): string {
  if (raw === null || raw === undefined) return '';
  return String(raw);
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as RequestBody;
    const normalized = normalizeRules(body.rules);
    if ('error' in normalized) {
      return NextResponse.json({ error: normalized.error }, { status: 400 });
    }
    const rules = normalized;
    const dryRun = body.dry_run !== false;
    const scope = body.scope ?? undefined;
    const sampleLimit = Math.min(Math.max(body.sample_limit ?? SAMPLE_LIMIT, 0), 30);

    const textColumns = await loadTextColumns();
    const textColumnSet = new Set(textColumns);
    const { whereSql, values } = buildScopeWhere(scope ?? undefined, textColumnSet);

    const countResult = await dbQuery<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM core.vulns_catalog ${whereSql}`,
      values
    );
    const scopedTotal = Number.parseInt(countResult.rows[0]?.total ?? '0', 10);

    let affectedRows = 0;
    let affectedCells = 0;
    let updatedRows = 0;
    let updatedCells = 0;
    const samples: BulkReplaceSample[] = [];
    let offset = 0;

    while (offset < scopedTotal) {
      const idsResult = await dbQuery<{ Id: string }>(
        `SELECT "Id" FROM core.vulns_catalog ${whereSql} ORDER BY "Id"::int ASC NULLS LAST LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
        [...values, BATCH, offset]
      );
      if (!idsResult.rows.length) break;

      for (const { Id } of idsResult.rows) {
        const rowResult = await dbQuery<Record<string, unknown>>(
          `SELECT ${textColumns.map((c) => `"${c}"`).join(', ')} FROM core.vulns_catalog WHERE "Id" = $1`,
          [Id]
        );
        const original = rowResult.rows[0];
        if (!original) continue;

        const working: Record<string, string> = {};
        for (const col of textColumns) {
          working[col] = cellValue(original[col]);
        }

        for (const rule of rules) {
          const targetCols = resolveTargetColumns(rule.columns, textColumns);
          for (const col of targetCols) {
            working[col] = applyReplaceToText(working[col], rule);
          }
        }

        const changedCols: string[] = [];
        for (const col of textColumns) {
          const before = cellValue(original[col]);
          const after = working[col];
          if (before !== after) {
            changedCols.push(col);
          }
        }

        if (!changedCols.length) continue;

        affectedRows += 1;
        affectedCells += changedCols.length;

        for (const col of changedCols) {
          if (samples.length >= sampleLimit) break;
          const before = cellValue(original[col]);
          const after = working[col];
          samples.push({
            id: String(Id),
            column: col,
            before: before.length > 280 ? `${before.slice(0, 280)}…` : before,
            after: after.length > 280 ? `${after.slice(0, 280)}…` : after,
          });
        }

        if (!dryRun) {
          const setClauses: string[] = [];
          const updateValues: unknown[] = [];
          for (const col of changedCols) {
            const val = working[col];
            updateValues.push(val === '' ? null : val);
            setClauses.push(`"${col}" = $${updateValues.length}`);
          }
          updateValues.push(Id);
          await dbQuery(
            `UPDATE core.vulns_catalog SET ${setClauses.join(', ')} WHERE "Id" = $${updateValues.length}`,
            updateValues
          );
          updatedRows += 1;
          updatedCells += changedCols.length;
        }
      }

      offset += BATCH;
    }

    return NextResponse.json({
      ok: true,
      dry_run: dryRun,
      scoped_rows: scopedTotal,
      affected_rows: affectedRows,
      affected_cells: affectedCells,
      updated_rows: dryRun ? undefined : updatedRows,
      updated_cells: dryRun ? undefined : updatedCells,
      samples,
      hint: dryRun
        ? 'Vista previa: ejecuta «Aplicar» para guardar en PostgreSQL. Luego sincroniza hallazgos si aplica.'
        : 'Cambios guardados. Usa Sync catálogo en revisión de hallazgos para propagar a proyectos.',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'No se pudo ejecutar el reemplazo masivo', details: message },
      { status: 500 }
    );
  }
}
