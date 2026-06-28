import { generateSkillMd } from "@/services/mcp/skill";

export function GET(): Response {
  return new Response(generateSkillMd(), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
