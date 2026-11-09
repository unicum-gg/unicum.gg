import { BoardUpdated } from "@/components/board-updated";
import { ManeuversClansBoard } from "@/components/clans/list/maneuvers/board";
import { Interpolate } from "@/components/interpolate";
import Link from "@/components/link";
import { Panel, PanelContent, PanelSeparator } from "@/components/panel";
import ROUTES from "@/constants/routes";
import { dateFormat } from "@/lib/format";
import { getTranslation } from "@/lib/translations.server";
import { buildSafe, unicum } from "@/services/sdk";
import { Region, REGION_EMOJI, REGION_LABEL } from "@unicum.gg/wargaming";

const LIMIT = 1000;

// Shared body for /clans/maneuvers (EU default) and /<region>/clans/maneuvers:
// the clan half of the Maneuvers edition, ranked by Fame Points. A standalone
// board like /clans/stronghold (the clan leaderboards have no mode-tab bar of
// their own), linked across to the player board it shares an edition with.
export async function ManeuversClansView({
  region,
  locale,
}: {
  region: Region;
  locale: string;
}) {
  const board = await buildSafe(() => unicum.region(region).maneuvers(LIMIT), {
    edition: null,
    standing: null,
    players: [],
    clans: [],
  });

  const [{ t }, { t: tGame }] = await Promise.all([
    getTranslation("components/clans/list/maneuvers/view", locale),
    getTranslation("game/vocabulary", locale),
  ]);
  const maneuvers = tGame("battle-formats.maneuvers");
  const { edition } = board;
  const dateFmt = dateFormat(locale, "d MMM yyyy");
  const windowLine =
    edition?.startDate && edition?.endDate
      ? t("window", {
          from: dateFmt.format(new Date(edition.startDate)),
          to: dateFmt.format(new Date(edition.endDate)),
        })
      : null;

  return (
    <div className="mx-auto w-full max-w-7xl">
      <Panel>
        <PanelContent className="relative px-4 py-12 text-center">
          <div className="mb-2 text-sm uppercase tracking-wide text-fd-muted-foreground">
            {REGION_EMOJI[region]} {REGION_LABEL[region]}
          </div>
          <h1 className="font-heading text-4xl font-bold tracking-tight md:text-5xl">
            <Interpolate
              template={t("heading", { maneuvers })}
              wrap={{
                accent: (text) => <span className="text-brand">{text}</span>,
              }}
            />
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-fd-muted-foreground">
            {t("intro", { maneuvers, region: REGION_LABEL[region] })}
          </p>
          <p className="mt-3 text-sm">
            <Link
              href={ROUTES.PLAYERS_MANEUVERS(region)}
              prefetch="intent"
              className="text-brand hover:underline"
            >
              {t("see-players")}
            </Link>
          </p>
          {windowLine ? (
            <p className="mt-3 text-sm text-fd-muted-foreground">{windowLine}</p>
          ) : null}
          <BoardUpdated
            at={board.standing ? new Date(board.standing.capturedAt) : null}
          />
        </PanelContent>
      </Panel>

      <PanelSeparator />

      <ManeuversClansBoard region={region} board={board} />
    </div>
  );
}
