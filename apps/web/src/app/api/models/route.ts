import { getModelsMirror } from "@unicum.gg/core/wargaming/wot/tanks/mirror";
import { modelsCdn, modelsRoot } from "@unicum.gg/wargaming";
import { measured } from "@/services/perf";

// Where the viewer reads a vehicle's geometry from, and what there is to read.
//
// **Not a proxy: eleven megabytes a vehicle do not belong on our origin.** All
// this hands over is the address, resolved to the commit the mirror is at, so
// every file under it is immutable and a CDN can hold it for a week. The bytes
// go straight from that CDN to the reader and never touch us.
//
// It exists at all because the browser cannot resolve the commit itself:
// GitHub's API is rate limited per address, and sixty an hour is a minute of
// traffic. Here it is one shared answer behind a ten minute entry.
export const dynamic = "force-dynamic";

export async function GET(...args: Parameters<typeof GET__perf>) {
  return measured("GET /models", () => GET__perf(...args));
}

async function GET__perf() {
  const { sha, vehicles } = await getModelsMirror();
  return Response.json(
    {
      // Pinned where the commit is known, and the branch where it is not. The
      // fallback is the same files: what it loses is a patch changing the
      // address, so a reader holds the old geometry until their cache turns
      // over rather than until the next request.
      root: sha ? modelsCdn(sha) : modelsCdn(),
      // What the CDN cannot serve, if it is ever the one that is down.
      origin: modelsRoot(),
      sha,
      vehicles,
    },
    {
      headers: {
        // Short, because this is the one answer that has to notice a patch. It
        // is also the only small one: everything it points at is cached for a
        // week by the address it names.
        "Cache-Control":
          "public, max-age=300, s-maxage=600, stale-while-revalidate=3600",
      },
    },
  );
}
