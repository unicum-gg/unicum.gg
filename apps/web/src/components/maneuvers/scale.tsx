"use client";

import {
  famePointsScale,
  ManeuversBoardKind,
  RATING_COLOR_CLASS,
} from "@unicum.gg/shared";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
  PanelTitle,
} from "@/components/panel";
import { RatingBandName } from "@/components/rating-band-name";
import { RATING_BAND_KEY } from "@/components/rating-band-key";
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
const SHARE_FORMAT = { style: "percent", maximumFractionDigits: 1 } as const;

/**
 * What the colours of the Fame Points column mean, as every rated board on the
 * site prints its scale: one row per band, named in the site's own band words,
 * with the places it covers on the board as it stands. Built by
 * `famePointsScale`, the arithmetic the cells are painted with, so the legend
 * cannot drift from them.
 */
export function ManeuversScale({ kind }: { kind: ManeuversBoardKind }) {
  const { t } = useTranslation("components/maneuvers/scale");
  const { t: tScale } = useTranslation("components/home/rating-scale");
  const { num } = useFormat();
  const { board } = useManeuversEdition();
  const { edition, standing } = board;
  if (!edition || !standing) return null;

  const ranked = kind === ManeuversBoardKind.Players ? standing.playerCount : standing.clanCount;
  const bands = famePointsScale(ranked);
  if (bands.length === 0) return null;
  const fmt = num(INT_FORMAT);
  const pct = num(SHARE_FORMAT);

  return (
    <>
      <PanelSeparator />
      <Panel>
        <PanelHeader>
          <PanelTitle>{tScale("title")}</PanelTitle>
        </PanelHeader>
        <PanelContent className="p-0">
          <div className={cn("p-4", styles.mutedDescription)}>
            {t(`description.${kind}`)}
          </div>
          <Table className="mb-px! [&_td]:min-w-0! [&_th]:min-w-0! [&_tr]:h-11">
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4!">{tScale("tier")}</TableHead>
                <TableHead>{t("share")}</TableHead>
                <TableHead className="pr-4 text-right!">{t("places")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bands.map((band) => (
                <TableRow key={band.color}>
                  <TableCell
                    className={cn(
                      "pl-4! font-semibold sm:whitespace-nowrap",
                      RATING_COLOR_CLASS[band.color],
                    )}
                  >
                    <RatingBandName color={band.color}>
                      {tScale(`tiers.${RATING_BAND_KEY[band.color]}`)}
                    </RatingBandName>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {band.share >= 1
                      ? t("rest")
                      : t("top", { share: pct.format(band.share) })}
                  </TableCell>
                  <TableCell className="pr-4 text-right tabular-nums text-muted-foreground whitespace-nowrap">
                    {band.fromPlace === band.toPlace
                      ? fmt.format(band.fromPlace)
                      : t("range", {
                          from: fmt.format(band.fromPlace),
                          to: fmt.format(band.toPlace),
                        })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </PanelContent>
      </Panel>
    </>
  );
}
