import { NextRequest, NextResponse } from "next/server";
import { dbQuery } from "@/lib/db";
import {
  VULNERABILITY_EDITABLE_COLUMNS,
  VULNERABILITY_SELECT_COLUMNS,
  type VulnerabilityEditableColumn,
} from "@/lib/vulnerability-columns";

export const dynamic = "force-dynamic";

const editableColumnsSet = new Set<string>(VULNERABILITY_EDITABLE_COLUMNS);
const selectColumnsSql = VULNERABILITY_SELECT_COLUMNS.map((column) => `"${column}"`).join(", ");

function getUpdatesFromBody(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return [] as Array<[VulnerabilityEditableColumn, string | null]>;
  }

  const entries = Object.entries(body);
  const validEntries: Array<[VulnerabilityEditableColumn, string | null]> = [];

  for (const [key, value] of entries) {
    if (!editableColumnsSet.has(key)) {
      continue;
    }

    if (value === null) {
      validEntries.push([key as VulnerabilityEditableColumn, null]);
      continue;
    }

    if (typeof value === "string") {
      validEntries.push([key as VulnerabilityEditableColumn, value.trim() === "" ? null : value]);
    }
  }

  return validEntries;
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const idNumber = Number(id);

    if (!Number.isFinite(idNumber)) {
      return NextResponse.json({ error: "Id inválido." }, { status: 400 });
    }

    const body = await request.json();
    const updates = getUpdatesFromBody(body);

    if (updates.length === 0) {
      return NextResponse.json(
        { error: "No se recibieron columnas válidas para editar." },
        { status: 400 },
      );
    }

    const setClauses: string[] = [];
    const values: Array<string | number | null> = [];

    updates.forEach(([column, value], index) => {
      setClauses.push(`"${column}" = $${index + 1}`);
      values.push(value);
    });

    values.push(idNumber);
    const idPlaceholder = `$${values.length}`;

    const result = await dbQuery<Record<string, unknown>>(
      `UPDATE core.vulnerabilities
       SET ${setClauses.join(", ")}
       WHERE "Id" = ${idPlaceholder}
       RETURNING ${selectColumnsSql}`,
      values,
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Registro no encontrado." }, { status: 404 });
    }

    return NextResponse.json({ row: result.rows[0] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        error: "No se pudo actualizar el registro.",
        details: message,
      },
      { status: 500 },
    );
  }
}
