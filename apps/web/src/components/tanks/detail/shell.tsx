import Image from "next/image";
import { toRoman } from "roman-numerals";
import { NationFlag } from "@/components/tanks/nation-flag";
import type { SearchHistoryItem } from "@/hooks/use-search-history";
import { TankActionsMenu } from "@/components/tanks/detail/actions-menu";
import { TankCost } from "@/components/tanks/detail/cost";
import { TankDetailTabs } from "@/components/tanks/detail/tab-bar";
import { TankDetailTab } from "@/components/tanks/detail/tabs";
import { TankRender } from "@/components/tanks/detail/render";
import { CommunityHeroBadge } from "@/components/tanks/detail/community/hero-badge";
import type { TankVideoCardData } from "@/components/tanks/detail/videos/card";
import {
  TankHero,
  TankVideoHeroPlayer,
} from "@/components/tanks/detail/videos/player";
import { TankVideosLiveProvider } from "@/components/tanks/detail/videos/live-provider";
import { VehicleRoleIcon } from "@/components/tanks/vehicle-role-icon";
import { VehicleTypeIcon } from "@/components/tanks/vehicle-type-icon";
import { Panel, PanelSeparator } from "@/components/panel";
import ROUTES from "@/constants/routes";
import {
  type TankSpec,
  type VehicleMeta,
  VEHICLE_CLASS_LABEL_FULL,
  VEHICLE_ROLE_LABEL,
  roleSuffix,
} from "@unicum.gg/shared";
import { Region, REGION_LABEL, hangarBgUrl } from "@unicum.gg/wargaming";

/**
 * Everything a tank page keeps while you move around it: the hero, the tab bar
 * and the video player behind them.
 *
 * It lives in the segment's layout rather than in each tab, which is what makes
 * a video survive a tab change. Next only re-renders the segment below a shared
 * layout, so the player keeps its iframe, its playhead and its sound while the
 * panel underneath is replaced. Rendered per tab, the same markup would tear the
 * player down and start the video over, which is the one thing someone watching
 * a battle notices.
 */
export function TankShell({
  region,
  slug,
  tankId,
  meta,
  specs,
  videos,
  available,
  rating,
  children,
}: {
  region: Region;
  slug: string;
  tankId: number;
  meta: VehicleMeta;
  /** For the price badge in the hero corner. */
  specs: TankSpec | null;
  /** Approved community videos, plus the reader's own queued ones once the
   * provider has fetched them. The player resolves `?battle=` against this. */
  videos: TankVideoCardData[];
  /** The tabs that have something to show for this tank. */
  available: TankDetailTab[];
  /** The community's verdict, for the badge under the title. Only the two
   * figures the badge draws, not the whole summary: the hero renders on every
   * tab and has no use for thirty reviews. */
  rating: { overall: number | null; votes: number };
  children: React.ReactNode;
}) {
  const tierLabel = meta.tier ? toRoman(meta.tier) : String(meta.tier);
  const classLabel = VEHICLE_CLASS_LABEL_FULL[meta.type] ?? meta.type;
  const roleSfx = roleSuffix(meta.role);

  const favoriteItem: SearchHistoryItem = {
    kind: "tank",
    region,
    tank: {
      tank_id: tankId,
      slug,
      name: meta.name,
      short_name: meta.shortName,
      tag: meta.tag,
      tier: meta.tier,
      nation: meta.nation,
      type: meta.type,
      is_premium: meta.isPremium,
    },
  };

  return (
    // The provider spans the hero and the tab below it: a video card is what
    // you click, the hero is where it plays. The Live wrapper revalidates the
    // published list from the browser, so an approved video shows without
    // waiting out the cached shell (see live-provider). It sets `ownTankSlug`
    // itself to fold in the reader's own queued rows.
    <TankVideosLiveProvider region={region} slug={slug} initialVideos={videos}>
      <div className="mx-auto w-full max-w-7xl">
        <Panel className="border-b border-fd-border">
          {/* The hero is always dark, in both themes. It sits on the hangar
            photo, which is dark whatever the theme, so the fades below have to
            darken rather than lighten: in light mode `fd-background` is
            hsl(0,0%,96%) and the gradient washed the whole thing out in white.
            Carrying the `dark` class re-resolves every design token inside this
            subtree to its dark value, so the fades, the spotlight and the text
            colors move together (a fade-only fix would leave the dark title
            unreadable). `text-fd-foreground` is needed because `color` is
            inherited as a computed value from `body`, so it would not pick the
            re-resolved token on its own. */}
          <TankHero className="dark relative min-h-[300px] overflow-hidden text-fd-foreground sm:min-h-0 sm:aspect-[32/15]">
            {/* The exact hangar-floor backdrop WG's own tankopedia detail page
              uses (1920x900, matching the render), served from its portal CDN.
              `latest` keeps the URL stable across client version bumps. Rendered
              through next/image so it is resized/format-negotiated instead of
              shipping the full-size webp as a CSS background. */}
            {/* Wrapped rather than inset directly: `fill` writes its own inline
              `inset: 0`, which no class can override. Same pixel of clearance
              as the fades above. */}
            <div className="pointer-events-none absolute inset-x-0 top-0 bottom-px overflow-hidden">
              <Image
                src={hangarBgUrl(region, "webp")}
                alt=""
                aria-hidden
                fill
                priority
                sizes="100vw"
                className="object-cover object-center"
              />
            </div>
            {/* Soft spotlight behind the vehicle. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(52%_66%_at_57%_36%,var(--color-fd-secondary)/45%,transparent_72%)]"
            />
            {/* High-res vehicle render, full-bleed (gunmarks / skill4ltu style). */}
            <div className="pointer-events-none absolute inset-0">
              <TankRender
                tag={meta.tag}
                region={region}
                slug={slug}
                name={meta.name}
              />
            </div>
            {/* Left fade keeps the title legible over the render. Kept tight to
              the left (clears by ~58%) so it darkens the title area, not the
              vehicle render sitting in the centre.

              Both fades stop a pixel short of the bottom. The hero's height is
              fractional (it comes from an aspect ratio), so its last device row
              is shared with the panel's bottom border, and a fade that is opaque
              `fd-background` down there takes most of that row: the border came
              out thinner than every other rule on the page. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 bottom-px bg-linear-to-r from-fd-background from-0% via-fd-background/30 via-26% to-transparent to-58%"
            />
            {/* Wrap the fade around the top-left corner (diagonal from that
              corner) so the header labels sit on the same darkening, not just
              the left edge. Clears before the centre so the render stays lit. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 bottom-px bg-linear-to-br from-fd-background from-0% via-fd-background/20 via-28% to-transparent to-55%"
            />
            <div className="absolute right-4 top-4 z-20 flex items-center gap-1.5">
              <TankActionsMenu
                region={region}
                tankId={tankId}
                tag={meta.tag}
                name={meta.name}
                slug={slug}
                favoriteItem={favoriteItem}
              />
            </div>
            {specs && (
              <div className="absolute bottom-4 right-4 z-10 sm:bottom-6 sm:right-6">
                <TankCost
                  specs={specs}
                  region={region}
                  isReward={meta.isReward}
                />
              </div>
            )}
            <div className="relative z-10 space-y-2 px-6 py-8 sm:px-10 sm:py-10">
              <div className="flex flex-wrap items-center gap-2 text-sm uppercase tracking-wide text-fd-muted-foreground">
                <span className="font-semibold text-brand">{tierLabel}</span>
                <NationFlag
                  nation={meta.nation}
                  region={region}
                  variant="flag"
                />
                <VehicleTypeIcon type={meta.type} premium={meta.isPremium} />
                <span>{classLabel}</span>
                {roleSfx && (
                  <span className="flex items-center gap-1">
                    <VehicleRoleIcon role={roleSfx} size={14} />
                    {VEHICLE_ROLE_LABEL[roleSfx]}
                  </span>
                )}
                {meta.isReward ? (
                  <span className="text-[#4FC4D9]">Reward</span>
                ) : meta.isPremium ? (
                  <span className="text-[#FAB81B]">Premium</span>
                ) : null}
              </div>
              <h1 className="max-w-sm font-heading text-4xl font-bold tracking-tight md:text-5xl">
                {meta.name}
              </h1>
              <p className="max-w-sm text-sm text-fd-muted-foreground">
                World of Tanks {REGION_LABEL[region]} statistics for the{" "}
                {tierLabel} {meta.nation.toUpperCase()}{" "}
                {classLabel.toLowerCase()} {meta.name}.
              </p>
              <CommunityHeroBadge
                region={region}
                slug={slug}
                overall={rating.overall}
                votes={rating.votes}
              />
            </div>
            {/* Covers everything above while a battle is playing, so the hero
              doubles as the player instead of the page growing a second one. */}
            <TankVideoHeroPlayer />
          </TankHero>
        </Panel>

        <PanelSeparator />

        <TankDetailTabs
          basePath={ROUTES.TANK(region, slug)}
          available={available}
        />

        {children}
      </div>
    </TankVideosLiveProvider>
  );
}
