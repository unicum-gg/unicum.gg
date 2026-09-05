import Image from "next/image";
import Link from "next/link";
import { toRoman } from "roman-numerals";
import { NationFlag } from "@/components/tanks/nation-flag";
import type { SearchHistoryItem } from "@/hooks/use-search-history";
import { TankActionsMenu } from "@/components/tanks/detail/actions-menu";
import { TankCost } from "@/components/tanks/detail/cost";
import { TankDetailTabs } from "@/components/tanks/detail/tab-bar";
import { TankDetailTab } from "@/components/tanks/detail/tabs";
import { TankRender } from "@/components/tanks/detail/render";
import {
  HERO_BAND,
  HERO_COLUMN,
} from "@/components/tanks/detail/viewer/column";
import { TankStage } from "@/components/tanks/detail/viewer/stage";
import type { HeroShell } from "@/components/tanks/detail/viewer/shell-rules";
import { VehicleName } from "@/components/tanks/detail/vehicle-name";
import { CommunityHeroBadge } from "@/components/tanks/detail/community/hero-badge";
import type { TankVideoCardData } from "@/components/tanks/detail/videos/card";
import {
  TankHero,
  TankVideoHeroPlayer,
} from "@/components/tanks/detail/videos/player";
import { TankVideosLiveProvider } from "@/components/tanks/detail/videos/live-provider";
import { AmmoChoiceProvider } from "@/components/tanks/detail/ammo-context";
import { VehicleModeProvider } from "@/components/tanks/detail/mode-context";
import { HeroShownProvider } from "@/components/tanks/detail/hero-context";
import { BuildLinkProvider } from "@/components/tanks/detail/build-context";
import { HeroCompare } from "@/components/tanks/detail/hero-compare";
import { HeroOpenTank } from "@/components/tanks/detail/hero-open-tank";
import { VehicleRoleIcon } from "@/components/tanks/vehicle-role-icon";
import { CommonTestBadge } from "@/components/entity/badges/common-test-badge";
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
  basedOn,
  builds,
  shells,
  mechanic,
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
  /** The rounds the hero's armour view can answer for, standard one first.
   * Empty where the client publishes too little about any of them to answer. */
  shells?: Record<string, HeroShell[]>;
  /**
   * Which mechanic this vehicle's second state is, where it has one.
   *
   * The client tags all seven of them `siegeMode`, so without this the hero
   * offers a Panhard EBR a siege button for what is its road mode.
   */
  mechanic?: string | null;
  /** The community's verdict, for the badge under the title. Only the two
   * figures the badge draws, not the whole summary: the hero renders on every
   * tab and has no use for thirty reviews. */
  rating: { overall: number | null; votes: number };
  /** The vehicle this one was made from, where the client says it is one. */
  basedOn?: { name: string; slug: string } | null;
  /**
   * Every module combination, paired with the game's own name for each module.
   *
   * The hero reads the configurator's own URL to know which one is showing, so
   * the vehicle on screen carries the gun the reader picked. Only the two
   * fields that takes: the specs behind each build are the tab's business.
   */
  builds?: {
    modules: Record<string, number | null>;
    keys: Record<string, string>;
  }[];
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
      is_common_test: meta.isCommonTest,
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
      <AmmoChoiceProvider>
        <VehicleModeProvider>
          <HeroShownProvider>
            <BuildLinkProvider>
              {/* **The one band that runs the full width of the page.** The studio is a
        room the vehicle stands in, and a room that stops at the text column
        reads as a picture of a room. What stays in the column is everything
        meant to be read: the title, the cost, the controls. The side rules go
        with it, since a rule at the edge of the window marks nothing. */}
              <Panel
                screenLines={false}
                className="border-x-0 border-b border-fd-border"
              >
                {/* The hero is always dark, in both themes. It sits on the hangar
            photo, which is dark whatever the theme, so the fades below have to
            darken rather than lighten: in light mode `fd-background` is
            hsl(0,0%,96%) and the gradient washed the whole thing out in white.
            Carrying the `dark` class re-resolves every design token inside this
            subtree to its dark value, so the fades, the spotlight and the text
            colors move together (a fade-only fix would leave the dark title
            unreadable). `text-fd-foreground` is needed because `color` is
            inherited as a computed value from `body`, so it would not pick the
            re-resolved token on its own.

            **And `bg-background` for the same reason as the text.** Carrying
            `dark` re-resolves the tokens here but paints nothing with them: this
            subtree was transparent all the way up, so what showed through was
            the page, which is dark only in the dark theme. It went unnoticed
            while the hangar photograph covered the whole hero, and appeared the
            moment an armour view replaced it with a plain floor: near-white
            title on white, over a scene meant to be a lit studio.

            It is `--background` and not fumadocs' `--fd-background`: the two are
            separate tokens and not the same colour, rgb(22) against rgb(18), so
            the `fd-` one made the hero a shade darker than the page it sits in
            rather than continuous with it. */}
                <TankHero className="dark relative min-h-[300px] overflow-hidden bg-background text-fd-foreground sm:min-h-0">
                  {/* Soft spotlight behind the vehicle. It is what lights the plate
              once the model has replaced the photograph. */}
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 bg-[radial-gradient(52%_66%_at_57%_36%,var(--color-fd-secondary)/45%,transparent_72%)]"
                  />
                  {/* High-res vehicle render, full-bleed (gunmarks / skill4ltu style).
              It stays the hero's first paint: the model behind it is megabytes
              of meshes and textures, and a vehicle the geometry mirror does not
              carry has nothing else to show. */}
                  <TankStage
                    code={meta.tag}
                    shells={shells}
                    builds={builds}
                    mechanic={mechanic}
                    backdrop={
                      <>
                        {/* The exact hangar-floor backdrop WG's own tankopedia detail
                    page uses (1920x900, matching the render), served from its
                    portal CDN. `latest` keeps the URL stable across client
                    version bumps. Wrapped rather than inset directly: `fill`
                    writes its own inline `inset: 0`, which no class can
                    override. */}
                        <div className="absolute inset-x-0 top-0 bottom-px overflow-hidden">
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
                        {/* The fades belong to the picture and go with it.
                    
                    They exist to keep the title legible over a photograph of a
                    lit hangar. Once the model is standing on a dark plate there
                    is nothing left to darken, and all they do is lie across the
                    vehicle, which by then sits further left than the render did.

                    Both stop a pixel short of the bottom. The hero's height is
                    fractional, coming from an aspect ratio, so its last device
                    row is shared with the panel's bottom border, and a fade that
                    is opaque `fd-background` down there takes most of that row:
                    the border came out thinner than every other rule on the
                    page. */}
                        <div className="absolute inset-x-0 top-0 bottom-px bg-linear-to-r from-fd-background from-0% via-fd-background/30 via-26% to-transparent to-58%" />
                        <div className="absolute inset-x-0 top-0 bottom-px bg-linear-to-br from-fd-background from-0% via-fd-background/20 via-28% to-transparent to-55%" />
                      </>
                    }
                  >
                    <TankRender
                      tag={meta.tag}
                      region={region}
                      slug={slug}
                      name={meta.name}
                    />
                  </TankStage>
                  {/* Everything positioned against the column rather than the window,
              so the corners it hangs from are the page's own. It passes clicks
              through and its children take them back, or the whole band would
              stop the vehicle being turned.

              It also draws the column's own two rules, which is what keeps the
              band from reading as a hole in the page: the studio runs past them
              but they carry straight on into the panels below, so the column is
              still there to be seen even where nothing is sitting in it. Drawn
              here rather than by the Panel, whose rules would now be at the
              edges of the window, and on this layer rather than on the title's,
              which stops at its own content once there is no aspect to stretch
              it. */}
                  <div
                    className={`pointer-events-none absolute inset-0 border-x border-fd-border ${HERO_COLUMN}`}
                  >
                    <div className="pointer-events-auto absolute right-4 top-4 z-20 flex items-center gap-1.5">
                      {/* Beside the actions rather than inside them: putting a
                    vehicle against another is one click, and a menu is where
                    one-click things go to be found later. */}
                      {/* Opening another vehicle first, comparing second: one is
                    leaving this tank and the other is bringing something to
                    it, and the order reads as the narrower ask coming last. */}
                      <HeroOpenTank region={region} slug={slug} />
                      <HeroCompare region={region} slug={slug} />
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
                      /* Marked so the viewer's dial can stand clear of it. The two
                  share this corner from different components, one of them
                  rendered on the server with no ref to hand over, and the dial
                  used to guess a height that fits a tech-tree tank's five lines
                  and floats a long way above a premium's one. */
                      <div
                        data-hero-cost
                        className="pointer-events-auto absolute bottom-4 right-4 z-10 sm:bottom-6 sm:right-6"
                      >
                        <TankCost
                          specs={specs}
                          region={region}
                          isReward={meta.isReward}
                        />
                      </div>
                    )}
                  </div>
                  {/* Left in flow rather than positioned with the rest: on a narrow
              screen the hero has no aspect to give it a height and this block is
              what sets one, so taking it out of the flow would collapse it. */}
                  <div
                    className={`pointer-events-none relative z-10 ${HERO_COLUMN} ${HERO_BAND}`}
                  >
                    {/* **The words let the vehicle through.** They sit over the studio
              and they are not a surface anyone means to touch, so catching the
              pointer there only stopped the tank being turned from the corner
              of the band it fills. What can actually be used takes the pointer
              back, one by one rather than by matching on tag names, so adding
              something interactive here is a deliberate act. The cost is that
              the name is no longer selectable. */}
                    <div className="pointer-events-none space-y-2 px-6 py-8 sm:px-10 sm:py-10">
                      <div className="flex flex-wrap items-center gap-2 text-sm uppercase tracking-wide text-fd-muted-foreground">
                        <span className="font-semibold text-brand">
                          {tierLabel}
                        </span>
                        <NationFlag
                          nation={meta.nation}
                          region={region}
                          variant="flag"
                        />
                        <VehicleTypeIcon
                          type={meta.type}
                          premium={meta.isPremium}
                        />
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
                        {meta.isCommonTest && (
                          <span className="pointer-events-auto">
                            <CommonTestBadge size={15} />
                          </span>
                        )}
                      </div>
                      <h1 className="max-w-sm font-heading text-4xl font-bold tracking-tight md:text-5xl">
                        <VehicleName name={meta.name} variant={meta.variant} />
                      </h1>
                      <p className="max-w-sm text-sm text-fd-muted-foreground">
                        World of Tanks {REGION_LABEL[region]} statistics for the{" "}
                        {tierLabel} {meta.nation.toUpperCase()}{" "}
                        {classLabel.toLowerCase()} {meta.name}.
                      </p>
                      {/* **What the tank is underneath.** A reissue, an event variant or
                  a reskin is another vehicle wearing something else, and the
                  client says which: either it draws that tank's meshes outright
                  or it points every hit tester at that tank's armour. Worth a
                  line, because it is the same tank to shoot at. */}
                      {basedOn ? (
                        <p className="pointer-events-auto max-w-sm text-sm text-fd-muted-foreground">
                          Based on{" "}
                          <Link
                            href={`/${region}/tanks/${basedOn.slug}`}
                            className="font-medium text-fd-foreground underline-offset-4 transition-colors hover:text-brand hover:underline"
                          >
                            {basedOn.name}
                          </Link>
                        </p>
                      ) : null}
                      {/* `w-fit` so it takes the pointer back over the stars alone and
                not across a band the width of the column. */}
                      <div className="pointer-events-auto w-fit">
                        <CommunityHeroBadge
                          region={region}
                          slug={slug}
                          overall={rating.overall}
                          votes={rating.votes}
                        />
                      </div>
                    </div>
                  </div>
                  {/* Covers everything above while a battle is playing, so the hero
              doubles as the player instead of the page growing a second one. */}
                  <TankVideoHeroPlayer />
                </TankHero>
              </Panel>

              <div className="mx-auto w-full max-w-7xl">
                <PanelSeparator />

                <TankDetailTabs
                  basePath={ROUTES.TANK(region, slug)}
                  available={available}
                />

                {children}
              </div>
            </BuildLinkProvider>
          </HeroShownProvider>
        </VehicleModeProvider>
      </AmmoChoiceProvider>
    </TankVideosLiveProvider>
  );
}
