import { generateLlmsFullTxt } from "@/services/llms";

/**
 * `/llms-full.txt`: the same map as `llms.txt`, but with every endpoint's
 * parameters inlined instead of linked, so a model with room to spare can learn
 * the whole API in one fetch.
 */
export async function GET(): Promise<Response> {
  return new Response(await generateLlmsFullTxt(), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
