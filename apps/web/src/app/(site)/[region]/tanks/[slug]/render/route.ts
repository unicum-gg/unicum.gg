import { getTankBySlug } from "@unicum.gg/core/wargaming/wot/tanks/resolve";
import { isRegion } from "@unicum.gg/wargaming";
import { normalizeVehicleRender } from "@/services/tanks/vehicle-render";

// The tank hero's vehicle render, co-located with the page's `opengraph-image`
// (both resolve the tank from region+slug and draw the same fallback chain).
// This one re-frames our wot.assets mirror into WG's portal layout for tanks WG
// hasn't published a portal render for (see the service for the framing math).
//
// Cached, on-demand: the normalized PNG only changes when WG updates the source
// asset (a game patch), so serve it static and revalidate weekly.
export const dynamic = "force-static";
export const revalidate = 604800; // 1 week

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ region: string; slug: string }> },
) {
  const { region, slug } = await params;
  if (!isRegion(region)) return new Response(null, { status: 404 });

  const tank = await getTankBySlug(region, slug);
  if (!tank) return new Response(null, { status: 404 });

  const png = await normalizeVehicleRender(tank.meta.tag);
  if (!png) return new Response(null, { status: 404 }); // caller falls back

  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control":
        "public, max-age=604800, s-maxage=604800, stale-while-revalidate=86400",
    },
  });
}
