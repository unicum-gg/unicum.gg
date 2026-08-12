import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { TankView } from "@/components/tanks/detail/view";
import {
  TankDetailTab,
  tankDetailTabHref,
} from "@/components/tanks/detail/tabs";
import { JsonLd } from "@/components/json-ld";
import { constructMetadata } from "@/lib/metadata";
import {
  breadcrumbSchema,
  tankSchema,
  tankVideoSchema,
} from "@/lib/schema-org";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { unicum } from "@/services/sdk";
import { UnicumError } from "@unicum.gg/sdk";
import type { ResearchBranch } from "@unicum.gg/core/wargaming/wot/tanks/research-path";
import type { TankModuleNode } from "@unicum.gg/core/wargaming/wot/tanks/modules";
import type { TankConfig } from "@unicum.gg/core/wargaming/wot/tanks/configs";
import type { TankLoadout } from "@unicum.gg/core/wargaming/wot/tanks/loadout";
import type { TankCrew } from "@unicum.gg/core/wargaming/wot/tanks/crew";
import type { TankFieldMods } from "@unicum.gg/core/wargaming/wot/tanks/field-mods";
import type { TankSkillTree } from "@unicum.gg/core/wargaming/wot/tanks/skill-tree";
import {
  MAP_GAME_MODE_LABEL,
  youtubeEmbedBaseUrl,
  youtubeThumbnailUrl,
  youtubeWatchUrl,
  type TankSpec,
  type VehicleMode,
} from "@unicum.gg/shared";
import type { TankVideoCardData } from "@/components/tanks/detail/videos/card";
import {
  groupBattlesByVideo,
  PREVIEW_VIDEO_COUNT,
} from "@/components/tanks/detail/videos/group";
import { type Region, isRegion } from "@unicum.gg/wargaming";
import { toRoman } from "roman-numerals";

// ISR, not dynamic: the rendered page is cached, so a navigation serves
// prerendered HTML instead of re-running the heavy tank-view render each time
// (measured 0.3-4.4s/nav while force-dynamic, vs ~50ms for the static pages).
// Each tab is its own route segment, so a render only builds the requested tab
// (see tabs.ts); this page is the Specifications default and reads no
// searchParams, so it stays static. On-demand: pages generate on first request
// (no generateStaticParams for the ~1229 slugs) and revalidate on the tank
// data's daily cadence. The SDK loopback covers any build-time prerender.
export const dynamic = "force-static";
export const revalidate = 1800; // 30 min

// The page consumes its own public API through the SDK: one composite
// `GET /{region}/tanks/{slug}/detail` payload carries everything the view
// renders. Next memoizes identical fetches within one render pass, so
// generateMetadata and the page body share a single request.
async function loadDetail(region: Region, slug: string) {
  try {
    return await unicum.region(region).tanks(slug).detail();
  } catch (error) {
    if (error instanceof UnicumError && error.status === 404) return null;
    throw error;
  }
}

/** Per-tab title and description. Each tab is its own indexable URL, so they get
 * their own wording rather than three copies of the same one. */
function tabCopy(
  tab: TankDetailTab,
  name: string,
  regionLabel: string,
  tier: string,
  nation: string,
): { title: string; description: string } {
  switch (tab) {
    case TankDetailTab.Performances:
      return {
        title: `${name} performances (${regionLabel}), server stats and best players`,
        description: `${name} (${regionLabel}) World of Tanks performances: server-average winrate, damage and assist, the best players on this tier ${tier} ${nation} tank, plus WN8 and WNX expected values.`,
      };
    case TankDetailTab.Marks:
      return {
        title: `${name} marks of excellence and mastery (${regionLabel})`,
        description: `${name} (${regionLabel}) World of Tanks marks of excellence and marks of mastery requirements, with their history on this tier ${tier} ${nation} tank.`,
      };
    case TankDetailTab.Videos:
      return {
        title: `${name} gameplay videos (${regionLabel})`,
        description: `Watch the ${name} in action: community-suggested battles on this tier ${tier} ${nation} tank, each opening at the moment it is played, with the map and result they happened on.`,
      };
    default:
      return {
        title: `${name} World of Tanks stats (${regionLabel}), tier ${tier} ${nation}`,
        description: `${name} (${regionLabel}) World of Tanks specifications: armour, firepower, mobility, modules, crew and field modifications for this tier ${tier} ${nation} tank.`,
      };
  }
}

export async function tankMetadata(
  region: string,
  slug: string,
  tab: TankDetailTab,
): Promise<Metadata> {
  if (!isRegion(region)) return {};
  const detail = await loadDetail(region, slug).catch(() => null);
  if (!detail) return {};
  const { meta } = detail;
  const regionLabel = region.toUpperCase();
  const tier = meta.tier ? toRoman(meta.tier) : String(meta.tier);
  const { title, description } = tabCopy(
    tab,
    meta.name,
    regionLabel,
    tier,
    meta.nation.toUpperCase(),
  );
  return constructMetadata({
    title,
    description,
    // Point at the readable slug so a legacy numeric-id URL doesn't become the
    // canonical, and at this tab's own segment so the three don't compete.
    canonical: tankDetailTabHref(ROUTES.TANK(region, detail.slug), tab),
    ogImage: `/api/og/${region}/tanks/${encodeURIComponent(detail.slug)}`,
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ region: string; slug: string }>;
}): Promise<Metadata> {
  const { region, slug } = await params;
  return tankMetadata(region, slug, TankDetailTab.Specifications);
}

export default async function TankPage({
  params,
}: {
  params: Promise<{ region: string; slug: string }>;
}) {
  const { region, slug } = await params;
  if (!isRegion(region)) notFound();
  return renderTankPage(region, slug, TankDetailTab.Specifications);
}

// Renders the tank view inline (blocking on the detail fetch) rather than
// streaming it behind a Suspense skeleton: force-static prerenders the whole
// page, so the real stats land in the cached HTML. That keeps the `.md` twin and
// non-JS crawlers complete (a Suspense boundary would leave only the skeleton in
// `#page-content`). The redirect/notFound run here in the blocking render.
// `tab` comes from the route segment, so only that tab is rendered.
export function renderTankPage(
  region: Region,
  slug: string,
  tab: TankDetailTab,
) {
  return <TankPageServer region={region} slug={slug} tab={tab} />;
}

async function TankPageServer({
  region,
  slug,
  tab,
}: {
  region: Region;
  slug: string;
  tab: TankDetailTab;
}) {
  const detail = await loadDetail(region, slug);
  if (!detail) notFound();
  // Send legacy numeric-id (or wrong-case) URLs to the readable canonical slug
  // with a 308 so links, history, and search engines settle on one URL. The
  // active tab is a path segment, so it has to be carried over.
  if (slug !== detail.slug)
    permanentRedirect(tankDetailTabHref(ROUTES.TANK(region, detail.slug), tab));
  const { tankId, meta, slug: canonicalSlug } = detail;

  // Videos are wanted on two tabs: in full on their own, and as the two most
  // recent at the bottom of Specifications, which is where anyone finds out the
  // tab exists at all. The map catalogue the submission form needs is not
  // fetched here: the form pulls it itself when it opens, so no tank page
  // carries 23 KB of maps for a dialog almost nobody opens.
  const wantsVideos =
    tab === TankDetailTab.Videos || tab === TankDetailTab.Specifications;
  const videos = wantsVideos
    ? await unicum
        .region(region)
        .tanks(canonicalSlug)
        .videos()
        .then((r) => r.videos as unknown as TankVideoCardData[])
        .catch(() => [])
    : [];

  const regionLabel = region.toUpperCase();
  const tierLabel = meta.tier ? toRoman(meta.tier) : String(meta.tier);
  const tankUrl = `${APP.URL}${ROUTES.TANK(region, canonicalSlug)}`;

  // The videos this page actually shows: all of them on the Videos tab, the
  // preview's first few on Specifications, none elsewhere.
  const videoGroups = groupBattlesByVideo(videos);
  const markedUpVideos =
    tab === TankDetailTab.Videos
      ? videoGroups
      : tab === TankDetailTab.Specifications
        ? videoGroups.slice(0, PREVIEW_VIDEO_COUNT)
        : [];

  return (
    <>
      <JsonLd
        data={tankSchema({
          name: meta.name,
          url: tankUrl,
          description: `${meta.name}, tier ${tierLabel} ${meta.nation.toUpperCase()} in World of Tanks. Server-average stats, best players and WN8/WNX expected values on ${regionLabel}.`,
          image: meta.bigIcon,
          tier: meta.tier,
          nation: meta.nation,
          type: meta.type,
          isPremium: meta.isPremium,
        })}
      />
      {/* Exactly what the page renders, no more: the markup has to sit on a
          page where the video can be watched, and both tabs that carry videos
          play them in the hero. Specifications shows a preview of the first
          few, so it declares those. Each battle becomes a `Clip`, the part of
          this we can state completely. */}
      {markedUpVideos.map((group) => (
        <JsonLd
          key={group.videoId}
          data={tankVideoSchema({
            videoId: group.videoId,
            name: group.title,
            thumbnailUrl: youtubeThumbnailUrl(group.videoId),
            embedUrl: youtubeEmbedBaseUrl(group.videoId),
            channelName: group.channelName,
            description: `${meta.name} battles marked in this video: ${group.battles
              .map((b) => b.mapName)
              .filter(Boolean)
              .join(", ")}.`,
            clips: group.battles.map((battle) => ({
              name: [
                battle.mapName,
                battle.mode ? MAP_GAME_MODE_LABEL[battle.mode] : null,
                battle.directionLabel,
              ]
                .filter(Boolean)
                .join(" · "),
              startSeconds: battle.startSeconds,
              url: youtubeWatchUrl(group.videoId, battle.startSeconds),
            })),
          })}
        />
      ))}
      <JsonLd
        data={breadcrumbSchema([
          { name: APP.NAME, url: `${APP.URL}${ROUTES.HOME(region)}` },
          { name: "Tanks", url: `${APP.URL}${ROUTES.TANKS(region)}` },
          { name: meta.name, url: tankUrl },
        ])}
      />
      <TankView
        region={region}
        tankId={tankId}
        slug={canonicalSlug}
        tab={tab}
        meta={meta}
        topByMetric={detail.topByMetric}
        serverStats={detail.serverStats}
        wn8Expected={detail.wn8Expected}
        wnxExpected={detail.wnxExpected}
        specs={detail.specs as unknown as TankSpec | null}
        moe={detail.moe}
        mom={detail.mom}
        researchPath={detail.researchPath as unknown as ResearchBranch}
        modules={detail.modules as unknown as TankModuleNode[]}
        configs={detail.configs as unknown as TankConfig[]}
        loadout={detail.loadout as unknown as TankLoadout | null}
        crew={detail.crew as unknown as TankCrew | null}
        fieldMods={detail.fieldMods as unknown as TankFieldMods | null}
        skillTree={detail.skillTree as unknown as TankSkillTree | null}
        modes={(detail.modes ?? []) as unknown as VehicleMode[]}
        moeHistory={detail.moeHistory}
        momHistory={detail.momHistory}
        videos={videos}
      />
    </>
  );
}
