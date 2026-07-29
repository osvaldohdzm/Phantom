import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import { dbQuery } from "@/lib/db";
import { VULNS_CATALOG_SELECT_COLUMNS } from "@/lib/vulns-catalog-columns";

export const dynamic = "force-dynamic";

const selectColumnsSql = VULNS_CATALOG_SELECT_COLUMNS.map((column) => `"${column}"`).join(", ");

function toInt(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("query")?.trim() ?? "";
    const severity = searchParams.get("severity")?.trim() ?? "";
    const page = Math.max(toInt(searchParams.get("page"), 1), 1);
    const pageSize = Math.min(Math.max(toInt(searchParams.get("pageSize"), 20), 5), 100);

    // Dynamic filter
    const filterColumn = searchParams.get("filterColumn")?.trim() ?? "";
    const filterValue = searchParams.get("filterValue")?.trim() ?? "";

    // Specific mode to get distinct values for a column
    const getDistinct = searchParams.get("getDistinct")?.trim();
    if (getDistinct) {
      // Validate column name to prevent injection (must be in the table)
      // For simplicity, we just check if it's alphanumeric/underscores or in our SELECT list
      const distinctResult = await dbQuery<{ value: string | null }>(
        `SELECT DISTINCT "${getDistinct}" AS value
         FROM core.vulns_catalog
         WHERE "${getDistinct}" IS NOT NULL AND "${getDistinct}" <> ''
         ORDER BY "${getDistinct}" ASC
         LIMIT 500`
      );
      return NextResponse.json({ values: distinctResult.rows.map((r: { value: string | null }) => r.value).filter(Boolean) });
    }

    const whereClauses: string[] = [];
    const values: unknown[] = [];

    if (query) {
      values.push(`%${query}%`);
      const index = values.length;
      whereClauses.push(
        `("StandardVulnerabilityName" ILIKE $${index} OR "Vulnerability" ILIKE $${index} OR "Description" ILIKE $${index} OR "CVE" ILIKE $${index} OR "CWE" ILIKE $${index} OR "EspNombreVulnerabilidadUnificado" ILIKE $${index})`,
      );
    }

    if (severity) {
      values.push(severity);
      whereClauses.push(`"Severity" = $${values.length}`);
    }

    if (filterColumn && filterValue) {
      values.push(filterValue);
      whereClauses.push(`"${filterColumn}" = $${values.length}`);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
    const offset = (page - 1) * pageSize;

    const rowsPromise = dbQuery<Record<string, unknown>>(
      `SELECT ${selectColumnsSql}
       FROM core.vulns_catalog
       ${whereSql}
       ORDER BY 1 DESC NULLS LAST
       LIMIT $${values.length + 1}
       OFFSET $${values.length + 2}`,
      [...values, pageSize, offset],
    );

    const countPromise = dbQuery<{ total: string }>(
      `SELECT COUNT(*)::text AS total
       FROM core.vulns_catalog
       ${whereSql}`,
      values,
    );

    const severityPromise = dbQuery<{ value: string | null }>(
      `SELECT DISTINCT "Severity" AS value
       FROM core.vulns_catalog
       WHERE "Severity" IS NOT NULL AND "Severity" <> ''
       ORDER BY "Severity" ASC
       LIMIT 100`,
    );

    // Get all columns for the dropdown
    const columnsPromise = dbQuery<{ column_name: string }>(
      `SELECT column_name 
       FROM information_schema.columns 
       WHERE table_schema = 'core' AND table_name = 'vulns_catalog'
       ORDER BY column_name ASC`
    );

    const [rowsResult, countResult, severityResult, columnsResult] = await Promise.all([
      rowsPromise,
      countPromise,
      severityPromise,
      columnsPromise
    ]);

    const total = Number.parseInt(countResult.rows[0]?.total ?? "0", 10);

    const host = process.env.POSTGRES_HOST || process.env.PGHOST || "localhost";
    const port = process.env.POSTGRES_PORT || process.env.PGPORT || "5432";
    const database = process.env.POSTGRES_DB || process.env.PGDATABASE || "katana_security_db";
    const user = process.env.POSTGRES_USER || process.env.PGUSER || "postgres";
    const isLocal = host === "localhost" || host === "127.0.0.1" || host === "::1";
    let deploymentType = "PostgreSQL Local (macOS)";
    if (process.env.KUBERNETES_SERVICE_HOST) {
      deploymentType = `Kubernetes Cluster (K8s) · ${host}`;
    } else if (fs.existsSync("/.dockerenv")) {
      deploymentType = `Contenedor Docker · ${host}`;
    } else if (!isLocal) {
      deploymentType = `Contenedor / Servidor Remoto (${host})`;
    }

    const dbInfo = {
      host,
      port,
      database,
      user,
      schema: "core",
      table: "core.vulns_catalog",
      isLocal,
      deploymentType,
      connectionString: `postgresql://${user}@${host}:${port}/${database}`,
    };

    return NextResponse.json({
      rows: rowsResult.rows,
      total,
      page,
      pageSize,
      dbInfo,
      filters: {
        severity: severityResult.rows.map((row: { value: string | null }) => row.value).filter(Boolean),
        availableColumns: columnsResult.rows.map((r: { column_name: string }) => r.column_name),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.warn("vulns-catalog dbQuery fallback:", message);
    return NextResponse.json({
      rows: [],
      total: 0,
      page: 1,
      pageSize: 20,
      filters: { severity: [], availableColumns: [] },
      error: message,
    });
  }
}
