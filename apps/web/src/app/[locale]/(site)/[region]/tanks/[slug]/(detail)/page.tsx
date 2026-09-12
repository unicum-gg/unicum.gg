import type { Metadata } from "next";
import { mapModeName } from "@/components/game-name";
import type { TranslateFunction } from "@onruntime/translations";
import { localizePath } from "@/lib/translations";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { toRoman } from "roman-numerals";
import { isRegion, type Region } from "@unicum.gg/wargaming";
import {
  youtubeEmbedBaseUrl,
  youtubeThumbnailUrl,
  youtubeWatchUrl,
  type TankSpec,
  type VehicleMode,
} from "@unicum.gg/shared";
import type { TankConfig } from "@unicum.gg/core/wargaming/wot/tanks/configs";
import type { TankCrew } from "@unicum.gg/core/wargaming/wot/tanks/crew";
import type { TankFieldMods } from "@unicum.gg/core/wargaming/wot/tanks/field-mods";
import type { TankLoadout } from "@unicum.gg/core/wargaming/wot/tanks/loadout";
import type { TankModuleNode } from "@unicum.gg/core/wargaming/wot/tanks/modules";
import type { ResearchBranch } from "@unicum.gg/core/wargaming/wot/tanks/research-path";
import type { TankSkillTree } from "@unicum.gg/core/wargaming/wot/tanks/skill-tree";
import { JsonLd } from "@/components/json-ld";
import { SpecificationsTab } from "@/components/tanks/detail/specifications";
import {
  TankDetailTab,
  tankDetailTabHref,
} from "@/components/tanks/detail/tabs";
import {
  groupBattlesByVideo,
  PREVIEW_VIDEO_COUNT,
} from "@/components/tanks/detail/videos/group";
import ROUTES from "@/constants/routes";
import { constructMetadata } from "@/lib/metadata";
import { getTranslation } from "@/lib/translations.server";
import { tankVideoSchema } from "@/lib/schema-org";
import {
  availableTabs,
  loadSimilarTanks,
  loadTankDetail,
  loadTankRatings,
  loadTankVideos,
  type TankDetail,
} from "@/app/[locale]/(site)/[region]/tanks/[slug]/detail";

// ISR, not dynamic: the rendered page is cached, so a navigation serves
// prerendered HTML instead of re-running the heavy tank-view render each time
// (measured 0.3-4.4s/nav while force-dynamic, vs ~50ms for the static pages).
// Each tab is its own route segment, so a render only builds the requested tab
// (see tabs.ts); this page is the Specifications default and reads no
// searchParams, so it stays static. On-demand: pages generate on first request
// (no generateStaticParams for the ~1229 slugs) and revalidate on the tank
// data's cadence. The video preview it shows is revalidated in the browser (the
// shell's `TankVideosLiveProvider`), so an approval is not gated on this window.
// The SDK loopback covers any build-time prerender.
export const dynamic = "force-static";
export const revalidate = 1800; // 30 min

/** Per-tab title and description. Each tab is its own indexable URL, so they get
 * their own wording rather than three copies of the same one. The wording lives
 * in `app/tanks/detail/page`, keyed by the tab's own segment. */
function tabCopy(
  tab: TankDetailTab,
  name: string,
  regionLabel: string,
  tier: string,
  nation: string,
  t: TranslateFunction,
): { title: string; description: string } {
  const block = Object.values(TankDetailTab).includes(tab)
    ? tab
    : TankDetailTab.Specifications;
  const values = { tank: name, region: regionLabel, tier, nation };
  return {
    title: t(`${block}.title`, values),
    description: t(`${block}.description`, values),
  };
}

export async function tankMetadata(
  region: string,
  slug: string,
  tab: TankDetailTab,
  locale: string,
): Promise<Metadata> {
  if (!isRegion(region)) return {};
  const detail = await loadTankDetail(region, slug).catch(() => null);
  if (!detail) return {};
  const { meta } = detail;
  const regionLabel = region.toUpperCase();
  const tier = meta.tier ? toRoman(meta.tier) : String(meta.tier);
  const { t } = await getTranslation("app/tanks/detail/page", locale);
  // The nation as Wargaming names it in this language ("URSS" to a French
  // reader), not the raw token upper-cased.
  const { t: tNations } = await getTranslation("game/nations", locale);
  const { title, description } = tabCopy(
    tab,
    meta.name,
    regionLabel,
    tier,
    tNations(meta.nation),
    t,
  );
  // The Videos tab is shown even empty, since the suggestion form lives there,
  // but an empty one is thin content: keep it out of the index until it has a
  // video. The other tabs, and this one once populated, index as before.
  const noIndex =
    (tab === TankDetailTab.Videos &&
      (await loadTankVideos(region, detail.slug).catch(() => [])).length === 0) ||
    // Same rule for the Community tab, and the same reason: it is shown even
    // unrated, because that is where the rating form lives, but a page whose
    // only content is an empty form is not a page worth indexing.
    (tab === TankDetailTab.Community &&
      (await loadTankRatings(region, detail.slug)).votes === 0);
  return constructMetadata({
    locale,
    title,
    description,
    // Point at the readable slug so a legacy numeric-id URL doesn't become the
    // canonical, and at this tab's own segment so the four don't compete.
    canonical: tankDetailTabHref(ROUTES.TANK(region, detail.slug), tab),
    ogImage: `/api/og/${region}/tanks/${encodeURIComponent(detail.slug)}`,
    noIndex,
  });
}

/**
 * Loads the tank for one tab, and settles where the reader should be.
 *
 * Two redirects, both of which the layout above deliberately leaves alone: a
 * legacy numeric-id (or wrong-case) URL goes to the readable canonical slug
 * with a 308, carrying the tab, and a tab this tank has nothing for falls back
 * to the first one it does have. The second is not permanent: a tank with no
 * marks today can have them next month.
 */
export async function loadTankTab(
  region: Region,
  slug: string,
  tab: TankDetailTab,
  locale: string,
): Promise<TankDetail> {
  const detail = await loadTankDetail(region, slug);
  if (!detail) notFound();
  if (slug !== detail.slug)
    permanentRedirect(
      localizePath(
        tankDetailTabHref(ROUTES.TANK(region, detail.slug), tab),
        locale,
      ),
    );

  const available = availableTabs(detail);
  if (!available.includes(tab))
    redirect(
      localizePath(
        tankDetailTabHref(ROUTES.TANK(region, detail.slug), available[0]),
        locale,
      ),
    );

  return detail;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; region: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, region, slug } = await params;
  return tankMetadata(region, slug, TankDetailTab.Specifications, locale);
}

export default async function TankPage({
  params,
}: {
  params: Promise<{ locale: string; region: string; slug: string }>;
}) {
  const { locale, region, slug } = await params;
  if (!isRegion(region)) notFound();
  const detail = await loadTankTab(region, slug, TankDetailTab.Specifications, locale);
  const [videos, similar] = await Promise.all([
    loadTankVideos(region, detail.slug),
    loadSimilarTanks(region, detail.slug),
  ]);

  return (
    <>
      {/* Only what this page shows: the preview's first few videos. The markup
          has to sit on a page where the video can be watched, and the hero
          above plays them. Each battle becomes a `Clip`, the part of this we
          can state completely. */}
      <TankVideosJsonLd
        locale={locale}
        tankName={detail.meta.name}
        videos={videos}
        limit={PREVIEW_VIDEO_COUNT}
      />
      <SpecificationsTab
        region={region}
        slug={detail.slug}
        tankId={detail.tankId}
        meta={detail.meta}
        specs={detail.specs as unknown as TankSpec | null}
        modules={detail.modules as unknown as TankModuleNode[]}
        configs={detail.configs as unknown as TankConfig[]}
        loadout={detail.loadout as unknown as TankLoadout | null}
        crew={detail.crew as unknown as TankCrew | null}
        fieldMods={detail.fieldMods as unknown as TankFieldMods | null}
        skillTree={detail.skillTree as unknown as TankSkillTree | null}
        modes={(detail.modes ?? []) as unknown as VehicleMode[]}
        mechanic={detail.mechanic ?? null}
        researchPath={detail.researchPath as unknown as ResearchBranch}
        videos={videos}
        similar={similar}
        // Defaulted rather than assumed: the detail payload is cached for a day
        // and served by an API that can be one deploy behind this render, so a
        // field this young has to be allowed to be missing.
        testVersion={detail.testVersion ?? null}
        locale={locale}
      />
    </>
  );
}

/** The structured data for the videos a tab shows, whole recordings with the
 * battles marked in them. Shared by the two tabs that show any. */
export async function TankVideosJsonLd({
  tankName,
  videos,
  limit,
  locale,
}: {
  tankName: string;
  videos: Parameters<typeof groupBattlesByVideo>[0];
  /** The preview shows the first few, the Videos tab shows all of them. */
  limit?: number;
  locale: string;
}) {
  const { t: tGame } = await getTranslation("game/vocabulary", locale);
  const groups = groupBattlesByVideo(videos);
  const shown = limit === undefined ? groups : groups.slice(0, limit);
  return (
    <>
      {shown.map((group) => (
        <JsonLd
          key={group.videoId}
          data={tankVideoSchema({
            videoId: group.videoId,
            name: group.title,
            thumbnailUrl: youtubeThumbnailUrl(group.videoId),
            embedUrl: youtubeEmbedBaseUrl(group.videoId),
            channelName: group.channelName,
            description: `${tankName} battles marked in this video: ${group.battles
              .map((b) => b.mapName)
              .filter(Boolean)
              .join(", ")}.`,
            clips: group.battles.map((battle) => ({
              name: [
                battle.mapName,
                battle.mode ? mapModeName(battle.mode, tGame) : null,
                battle.direction
                  ? tGame(`spawn-directions.${battle.direction}`)
                  : battle.directionLabel,
              ]
                .filter(Boolean)
                .join(" · "),
              startSeconds: battle.startSeconds,
              url: youtubeWatchUrl(group.videoId, battle.startSeconds),
            })),
          })}
        />
      ))}
    </>
  );
}
