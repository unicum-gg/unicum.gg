"use client";

import { BoardUpdated } from "@/components/board-updated";
import { useManeuversEdition } from "@/components/maneuvers/edition-context";
import { maneuversEditionName } from "@/components/maneuvers/edition-name";
import { useFormat } from "@/hooks/use-format";
import { useTranslation } from "@/hooks/use-translation";

/**
 * The hero's account of the edition on screen: its name and its dates, and when
 * its boards were last recomputed. Client because the edition follows
 * `?edition=`, which the statically rendered page cannot see.
 */
export function ManeuversEditionHeader() {
  const { t } = useTranslation("components/maneuvers/edition-name");
  const { date } = useFormat();
  const { board, requested } = useManeuversEdition();
  const { edition, standing } = board;
  const eventName = edition?.eventName ?? requested;
  if (!eventName) return null;

  const name = maneuversEditionName(eventName, t);
  const dateFmt = date("d MMM yyyy");
  return (
    <>
      <p className="mt-3 text-sm text-fd-muted-foreground">
        {edition?.startDate && edition.endDate
          ? t("window", {
              edition: name,
              from: dateFmt.format(edition.startDate),
              to: dateFmt.format(edition.endDate),
            })
          : name}
      </p>
      <BoardUpdated at={standing ? standing.capturedAt : null} />
    </>
  );
}
