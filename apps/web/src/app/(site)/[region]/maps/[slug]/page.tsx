import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import type { MapDetail } from "@unicum.gg/shared";
import { type Region, isRegion } from "@unicum.gg/wargaming";
import { UnicumError } from "@unicum.gg/sdk";
import { MapView } from "@/components/maps/detail/view";
import ROUTES from "@/constants/routes";
import { constructMetadata } from "@/lib/metadata";
import { unicum } from "@/services/sdk";

// ISR, not dynamic: the whole page is rendered and cached, so a navigation
// serves prerendered HTML. Pages generate on first request (no
// generateStaticParams for the ~50 slugs) and revalidate on the map data's
// patch cadence. The SDK loopback covers any build-time prerender.
export const dynamic = "force-static";
export const revalidate = 3600;

async function loadDetail(
  region: Region,
  slug: string,
): Promise<MapDetail | null> {
  try {
    return (await unicum.region(region).maps(slug).detail()) as MapDetail;
  } catch (error) {
    if (error instanceof UnicumError && error.status === 404) return null;
    throw error;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ region: string; slug: string }>;
}): Promise<Metadata> {
  const { region, slug } = await params;
  if (!isRegion(region)) return {};
  const detail = await loadDetail(region, slug).catch(() => null);
  if (!detail) return {};
  const regionLabel = region.toUpperCase();
  const modes = detail.geometry.map((g) => g.label).join(", ");
  return constructMetadata({
    title: `${detail.name}, World of Tanks map (${regionLabel})`,
    description:
      detail.description ||
      `${detail.name}: a ${detail.widthMeters} × ${detail.heightMeters} m World of Tanks map${modes ? ` playing ${modes}` : ""}.`,
    ogImage: `/api/og/${region}/maps/${encodeURIComponent(detail.slug)}`,
    canonical: ROUTES.MAP(region, detail.slug),
  });
}

export default async function MapDetailPage({
  params,
}: {
  params: Promise<{ region: string; slug: string }>;
}) {
  const { region, slug } = await params;
  if (!isRegion(region)) notFound();
  return renderMapPage(region, slug);
}

export async function renderMapPage(region: Region, slug: string) {
  const detail = await loadDetail(region, slug);
  if (!detail) notFound();
  // Redirect a legacy / non-canonical slug (or a bare arena id) onto the pretty
  // one, so the canonical and OG always point at a single URL.
  if (detail.slug !== slug) permanentRedirect(ROUTES.MAP(region, detail.slug));

  return <MapView detail={detail} region={region} />;
}
