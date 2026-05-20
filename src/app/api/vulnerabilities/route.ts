import { NextRequest, NextResponse } from "next/server";
import { dbQuery } from "@/lib/db";
import { VULNERABILITY_SELECT_COLUMNS } from "@/lib/vulnerability-columns";

export const dynamic = "force-dynamic";

const selectColumnsSql = VULNERABILITY_SELECT_COLUMNS.map((column) => `"${column}"`).join(", ");

function toInt(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("query")?.trim() ?? "";
    const severity = searchParams.get("severity")?.trim() ?? "";
    const sourceDetection = searchParams.get("source")?.trim() ?? "";
    const page = Math.max(toInt(searchParams.get("page"), 1), 1);
    const pageSize = Math.min(Math.max(toInt(searchParams.get("pageSize"), 25), 5), 100);

    const whereClauses: string[] = [];
    const values: unknown[] = [];

    if (query) {
      values.push(`%${query}%`);
      const index = values.length;
      whereClauses.push(
        `("DefaultVulnerabilityName" ILIKE $${index} OR "Vulnerability" ILIKE $${index} OR "Description" ILIKE $${index} OR "CVE" ILIKE $${index} OR "CWE" ILIKE $${index})`,
      );
    }

    if (severity) {
      values.push(severity);
      whereClauses.push(`"Severity" = $${values.length}`);
    }

    if (sourceDetection) {
      values.push(sourceDetection);
      whereClauses.push(`"SourceDetection" = $${values.length}`);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
    const offset = (page - 1) * pageSize;

    const rowsPromise = dbQuery<Record<string, unknown>>(
      `SELECT ${selectColumnsSql}
       FROM core.vulnerabilities
       ${whereSql}
       ORDER BY "Id" DESC
       LIMIT $${values.length + 1}
       OFFSET $${values.length + 2}`,
      [...values, pageSize, offset],
    );

    const countPromise = dbQuery<{ total: string }>(
      `SELECT COUNT(*)::text AS total
       FROM core.vulnerabilities
       ${whereSql}`,
      values,
    );

    const severityPromise = dbQuery<{ value: string | null }>(
      `SELECT DISTINCT "Severity" AS value
       FROM core.vulnerabilities
       WHERE "Severity" IS NOT NULL AND "Severity" <> ''
       ORDER BY "Severity" ASC
       LIMIT 200`,
    );

    const sourcePromise = dbQuery<{ value: string | null }>(
      `SELECT DISTINCT "SourceDetection" AS value
       FROM core.vulnerabilities
       WHERE "SourceDetection" IS NOT NULL AND "SourceDetection" <> ''
       ORDER BY "SourceDetection" ASC
       LIMIT 200`,
    );

    const [rowsResult, countResult, severityResult, sourceResult] = await Promise.all([
      rowsPromise,
      countPromise,
      severityPromise,
      sourcePromise,
    ]);

    const total = Number.parseInt(countResult.rows[0]?.total ?? "0", 10);

    return NextResponse.json({
      rows: rowsResult.rows,
      total,
      page,
      pageSize,
      filters: {
        severity: severityResult.rows.map((row) => row.value).filter(Boolean),
        source: sourceResult.rows.map((row) => row.value).filter(Boolean),
      },
      columns: VULNERABILITY_SELECT_COLUMNS,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        error: "No se pudo consultar la tabla core.vulnerabilities",
        details: message,
      },
      { status: 500 },
    );
  }
}
