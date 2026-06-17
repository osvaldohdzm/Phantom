/** Filas/columnas separadas por tab y salto de línea — Excel pega como tabla. */
export function rowsToTsv(rows: (string | number | null | undefined)[][]): string {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          if (cell === null || cell === undefined || cell === '') return '';
          return String(cell);
        })
        .join('\t')
    )
    .join('\n');
}

export async function copyTsvToClipboard(rows: (string | number | null | undefined)[][]): Promise<void> {
  await navigator.clipboard.writeText(rowsToTsv(rows));
}
