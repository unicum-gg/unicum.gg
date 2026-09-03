import { OnslaughtBoardLive } from "@/components/players/list/onslaught/board-live";
import { RelativeTime } from "@/components/relative-time";
import { PlayersModeTabs } from "@/components/players/list/mode-tabs";
import { Panel, PanelContent, PanelSeparator } from "@/components/panel";
import { buildSafe, unicum } from "@/services/sdk";
import { Region, REGION_EMOJI, REGION_LABEL } from "@unicum.gg/wargaming";

// The full standings are fetched once and paginated client-side (TablePager).
// Onslaught's board is the whole ranked population (a few thousand, down to the
// Master cutoff), not a top-N, so we pull it all; the API caps at its own max.
const LIMIT = 60000;

type OnslaughtHistory = Awaited<
  ReturnType<ReturnType<typeof unicum.region>["players"]["onslaughtHistory"]>
> | null;

const dateFmt = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

// Shared body for /players/onslaught (EU default) and
// /<region>/players/onslaught: the Onslaught (Competitive 7) ranked leaderboard,
// mirrored from the in-game source into our database.
//
// The page renders the CURRENT season and is ISR-cached (`force-static` +
// revalidate), like the other leaderboards, so the common case is a cheap cached
// read rather than a per-request render of the whole ~4k-row board. Past seasons
// are picked with `?season=`, which a static page ignores, so `OnslaughtBoardLive`
// reads it client-side and refetches that season through the SDK.
export async function OnslaughtView({ region }: { region: Region }) {
  // Both in one pass: the standings, and the curve of what a rank has cost while
  // the season ran.
  //
  // The curve carries its own `catch`, and `buildSafe` is not it: that one only
  // swallows during the build, and deliberately lets a runtime error through so
  // a failed revalidation keeps serving the last good page. Inside a
  // `Promise.all` that behaviour is contagious, so a 502 on the curve alone
  // would take the whole leaderboard down with it. The board is the page; the
  // curve is an extra, and it is allowed to be missing.
  const [initial, history] = await Promise.all([
    buildSafe(() => unicum.region(region).players.onslaught({ limit: LIMIT }), {
      season: null,
      seasons: [],
      results: [],
    }),
    buildSafe(
      () => unicum.region(region).players.onslaughtHistory(),
      null as OnslaughtHistory,
    ).catch(() => null as OnslaughtHistory),
  ]);

  const { season } = initial;
  // Unix seconds from the source, so it is the instant the standings were
  // recomputed and not the instant our page rendered.
  const updatedAt =
    season?.lastRecalculationTs != null
      ? new Date(season.lastRecalculationTs * 1000)
      : null;
  const seasonLine = season
    ? [
        season.codename ?? season.name,
        season.startDate && season.endDate
          ? `${dateFmt.format(new Date(season.startDate))} to ${dateFmt.format(new Date(season.endDate))}`
          : null,
        season.ended ? "final standings" : "live season",
      ]
        .filter(Boolean)
        .join(" · ")
    : null;

  return (
    <div className="mx-auto w-full max-w-7xl">
      <Panel>
        <PanelContent className="px-4 py-12 text-center">
          <div className="mb-2 text-sm uppercase tracking-wide text-fd-muted-foreground">
            {REGION_EMOJI[region]} {REGION_LABEL[region]}
          </div>
          <h1 className="font-heading text-4xl font-bold tracking-tight md:text-5xl">
            Top <span className="text-brand">Onslaught</span> players
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-fd-muted-foreground">
            Onslaught is World of Tanks&apos; competitive 7v7 ranked mode on tier
            X. The {REGION_LABEL[region]}{" "}
            leaderboard, straight from the game&apos;s own standings.
          </p>
          {seasonLine ? (
            <p className="mt-3 text-sm text-fd-muted-foreground">
              {seasonLine}
              {/* When these standings were true, which is the source's own
                  recomputation time rather than when we asked. A reader needs
                  to know whether they are looking at the board as it stands or
                  at something that stopped moving, and on a live season the
                  answer changes what they do next. Absolute in the HTML and
                  relative on screen, so an ISR page half an hour old still
                  reads the right distance. */}
              {updatedAt ? (
                <>
                  {" · updated "}
                  <RelativeTime
                    date={updatedAt}
                    title={updatedAt.toISOString()}
                  />
                </>
              ) : null}
            </p>
          ) : null}
        </PanelContent>
      </Panel>

      <PanelSeparator />

      <PlayersModeTabs region={region} active="onslaught" />

      <PanelSeparator />

      <OnslaughtBoardLive
        region={region}
        initial={initial}
        initialHistory={history}
      />
    </div>
  );
}
