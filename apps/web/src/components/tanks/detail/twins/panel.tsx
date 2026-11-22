import { Fragment } from "react";
import type { Region } from "@unicum.gg/wargaming";
import type { TankTwin } from "@unicum.gg/core/wargaming/wot/tanks/twins";
import Link from "@/components/link";
import { Interpolate } from "@/components/interpolate";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelTitle,
} from "@/components/panel";
import ROUTES from "@/constants/routes";
import { getTranslation } from "@/lib/translations.server";
import { TwinsControl } from "./control";

/**
 * The head of a tab that can read a vehicle with its twins: what the twins
 * are, and the switch. The tab renders both readings under it through
 * `TwinsView`, so this panel and the figures it governs stay apart.
 */
export async function TwinsPanel({
  region,
  tankName,
  twins,
  players,
  combinedPlayers,
  tab = "",
  locale,
}: {
  region: Region;
  tankName: string;
  twins: TankTwin[];
  players?: number;
  combinedPlayers?: number;
  /** The tab's own segment (`/performances`), so a twin's name opens the same
   * tab on that vehicle. */
  tab?: string;
  locale: string;
}) {
  const { t } = await getTranslation("components/tanks/detail/twins/panel", locale);
  const names = twins.map((twin, index) => (
    <Fragment key={twin.tankId}>
      {index > 0 ? ", " : null}
      <Link
        href={`${ROUTES.TANK(region, twin.slug)}${tab}`}
        className="font-medium text-fd-foreground hover:underline"
      >
        {twin.name}
      </Link>
    </Fragment>
  ));
  return (
    <Panel>
      <PanelHeader className="flex flex-wrap items-center justify-between gap-3">
        <PanelTitle>{t("title", { tank: tankName })}</PanelTitle>
        <TwinsControl players={players} combinedPlayers={combinedPlayers} />
      </PanelHeader>
      <PanelContent className="p-4">
        <p className="text-sm text-fd-muted-foreground">
          <Interpolate
            template={t(twins.length > 1 ? "description-many" : "description", {
              tank: tankName,
            })}
            values={{ twins: <>{names}</> }}
          />
        </p>
      </PanelContent>
    </Panel>
  );
}
