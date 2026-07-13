export type TableRow = { label: string; primary: string; secondary?: string };

/**
 * Renders label/value rows as an aligned monospace code block: one row per line,
 * primary column right-aligned, optional secondary appended. Shared by the
 * /player and /clan stat cards so both read like the site's tables.
 */
export function renderTable(rows: TableRow[]): string {
  const labelW = Math.max(...rows.map((r) => r.label.length));
  const primaryW = Math.max(...rows.map((r) => r.primary.length));
  const lines = rows.map((r) => {
    const base = `${r.label.padEnd(labelW)}  ${r.primary.padStart(primaryW)}`;
    return r.secondary ? `${base}  ${r.secondary}` : base;
  });
  return `\`\`\`\n${lines.join("\n")}\n\`\`\``;
}
