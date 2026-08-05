import APP from "@/constants/app";
import { TOOL_DEFS, type ToolInputSchema } from "./tools";

export const MCP_NAME = "wot-stats";

function paramTable(schema: ToolInputSchema): string {
  const keys = Object.keys(schema.properties);
  if (!keys.length) return "";
  const req = new Set<string>(schema.required ?? []);
  const rows = keys.map((name) => {
    const prop = schema.properties[name] as {
      type?: string;
      enum?: string[];
      description?: string;
    };
    const type = prop.enum?.length ? prop.enum.join(" \\| ") : (prop.type ?? "string");
    return `| \`${name}\` | ${type} | ${req.has(name) ? "yes" : "no"} | ${prop.description ?? ""} |`;
  });
  return `| Parameter | Type | Required | Description |\n|-----------|------|----------|-------------|\n${rows.join("\n")}`;
}

/**
 * Every operation of the public API, one `###` block each with its parameter
 * table. Shared by the Agent Skill and by `llms-full.txt`, which are the same
 * reference addressed to two different discovery conventions.
 *
 * @param headingLevel depth of each operation heading, so a caller can nest the
 * reference under its own sections.
 */
export function renderOperations(headingLevel: number = 3): string {
  const hashes = "#".repeat(headingLevel);
  return TOOL_DEFS.map(({ name, description, inputSchema, path }) => {
    const table = paramTable(inputSchema);
    return [
      `${hashes} ${name}`,
      "",
      description,
      "",
      `\`GET /api${path}\``,
      ...(table ? ["", table] : []),
    ].join("\n");
  }).join("\n\n");
}

export function generateSkillMd(): string {
  return [
    "---",
    `name: ${MCP_NAME}`,
    `description: ${APP.DESCRIPTION}`,
    "---",
    "",
    `# World of Tanks Stats, ${APP.NAME}`,
    "",
    "## Overview",
    "",
    APP.DESCRIPTION,
    "",
    "## API base",
    "",
    `\`${APP.URL}/api\``,
    "",
    `Full OpenAPI spec: \`${APP.URL}/api/openapi.json\``,
    `Interactive docs: \`${APP.URL}/docs\``,
    "",
    "## Operations",
    "",
    renderOperations(),
    "",
  ].join("\n");
}
