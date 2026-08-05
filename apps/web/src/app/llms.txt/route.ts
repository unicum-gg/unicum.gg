import { generateLlmsTxt } from "@/services/llms";

/**
 * `/llms.txt`: the agent entry point, a curated index of the machine-readable
 * surfaces (Markdown twins, MCP, OpenAPI, Agent Skill) plus the endpoint list.
 * Served as `text/plain` per the convention, even though the body is Markdown.
 */
export async function GET(): Promise<Response> {
  return new Response(await generateLlmsTxt(), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
