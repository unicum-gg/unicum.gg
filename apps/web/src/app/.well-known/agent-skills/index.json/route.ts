import { createHash } from "crypto";
import APP from "@/constants/app";
import { MCP_NAME, generateSkillMd } from "@/services/mcp/skill";

export function GET(): Response {
  const content = generateSkillMd();
  const digest = `sha256:${createHash("sha256").update(content, "utf8").digest("hex")}`;

  const index = {
    $schema: "https://schemas.agentskills.io/discovery/0.2.0/schema.json",
    skills: [
      {
        name: MCP_NAME,
        type: "skill-md",
        description: APP.DESCRIPTION,
        url: `${APP.URL}/.well-known/agent-skills/${MCP_NAME}/SKILL.md`,
        digest,
      },
    ],
  };

  return new Response(JSON.stringify(index, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
