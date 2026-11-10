"use client";

import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
  PanelTitle,
} from "@/components/panel";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useManeuversEdition } from "@/components/maneuvers/edition-context";
import { useFormat } from "@/hooks/use-format";
import { useTranslation } from "@/hooks/use-translation";
import { styles } from "@/lib/styles";
import { cn } from "@/lib/utils";

const INT_FORMAT = { maximumFractionDigits: 0 } as const;

export type ManeuversBoardKind = "players" | "clans";

/**
 * What an edition pays, the Onslaught rank scale's twin: the rewarded places
 * of the board on screen and how many currently hold one, against the places
 * that win nothing. The places are set per region and change between editions
 * (9,000 vehicles on EU in autumn 2026 against 1,000 on Asia), which is why
 * they are read off the edition rather than written here.
 *
 * What a rewarded place currently costs is the race panel's figure, not this
 * one's, so the two do not print the same number twice.
 */
export function ManeuversRewards({ kind }: { kind: ManeuversBoardKind }) {
  const { t } = useTranslation("components/maneuvers/rewards");
  const { num } = useFormat();
  const { board } = useManeuversEdition();
  const { edition, standing } = board;
  const places =
    kind === "players" ? edition?.tankRewardPositions : edition?.clanGoldPositions;
  if (!edition || places == null) return null;

  const ranked = standing
    ? kind === "players"
      ? standing.playerCount
      : standing.clanCount
    : 0;
  const fmt = num(INT_FORMAT);
  const rewarded = Math.min(ranked, places);
  const unrewarded = Math.max(ranked - places, 0);

  return (
    <>
      <PanelSeparator />
      <Panel>
        <PanelHeader>
          <PanelTitle>{t("title")}</PanelTitle>
        </PanelHeader>
        <PanelContent className="p-0">
          <div className={cn("p-4", styles.mutedDescription)}>
            {t(`intro.${kind}`, { places: fmt.format(places) })}
          </div>
          <Table className="mb-px! [&_td]:min-w-0! [&_th]:min-w-0! [&_tr]:h-11">
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4!">{t("reward")}</TableHead>
                <TableHead>{t("places")}</TableHead>
                <TableHead className="pr-4 text-right!">{t("holders")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="pl-4! font-medium">
                  {t(`reward-name.${kind}`)}
                </TableCell>
                <TableCell className="tabular-nums">
                  {t("range", { from: fmt.format(1), to: fmt.format(places) })}
                </TableCell>
                <TableCell className="pr-4 text-right tabular-nums">
                  {/* A board still shallower than its rewards has places left
                      for anybody who turns up, which is the figure worth reading
                      early in an edition. */}
                  {ranked < places
                    ? t("open", {
                        held: fmt.format(rewarded),
                        open: fmt.format(places - ranked),
                      })
                    : t(`count.${kind}`, { count: fmt.format(rewarded) })}
                </TableCell>
              </TableRow>
              <TableRow className="text-muted-foreground">
                <TableCell className="pl-4!">{t("reward-name.none")}</TableCell>
                <TableCell className="tabular-nums">
                  {t("from", { from: fmt.format(places + 1) })}
                </TableCell>
                <TableCell className="pr-4 text-right tabular-nums">
                  {t(`count.${kind}`, { count: fmt.format(unrewarded) })}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </PanelContent>
      </Panel>
    </>
  );
}
