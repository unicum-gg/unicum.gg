"use client";

import { ArrowsOutSimpleIcon } from "@phosphor-icons/react/dist/ssr";
import { useId } from "react";
import { useTranslation } from "@/hooks/use-translation";
import {
  type MapChangeArea,
  MARKER_MOVE_THRESHOLD_M,
  matchMarkers,
  type MapDetail,
  type MapHistoryPoint,
} from "@unicum.gg/shared";
import { mapName } from "@/components/game-name";
import { MinimapImage } from "@/components/maps/minimap-image";
import { buildArrows } from "@/components/maps/detail/history/arrows";
import { areaLabel } from "@/components/maps/detail/history/areas";
import {
  HistoryMarker,
  iconFor,
} from "@/components/maps/detail/history/marker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { FormattedMapChange } from "@/components/maps/change-format";
import {
  plan,
  type VersionPlan,
} from "@/components/maps/detail/history/plan";

/**
 * The drawing itself, rendered twice: in the history panel's column and
 * enlarged in its dialog.
 *
 * One component for both, so the enlarged view is the same drawing rather than a
 * second one that can disagree with it. Everything it places is a percentage of
 * the box (positions, marker sizes, arrow widths), so the only thing `large`
 * changes is the legend's own type size, which does not scale with an image.
 */
function VersionMinimapCanvas({
  detail,
  drawn,
  large,
}: {
  detail: MapDetail;
  drawn: VersionPlan;
  large?: boolean;
}) {
  const { t } = useTranslation("components/maps/detail/history/version-map");
  const arrowId = useId();
  const { geometry, onslaught, width, height } = drawn;

  // Percent of the image, clamped: a marker whose play area was re-cut since can
  // project outside it, and half a marker on the edge reads better than one that
  // is not there.
  const px = (p: MapHistoryPoint) => Math.max(0, Math.min(100, (p.x / width) * 100));
  const py = (p: MapHistoryPoint) =>
    Math.max(0, Math.min(100, 100 - (p.z / height) * 100));
  const project = (p: MapHistoryPoint) => ({
    left: `${px(p)}%`,
    top: `${py(p)}%`,
  });

  const before = geometry.flatMap((c) => c.markers?.before ?? []);
  const after = geometry.flatMap((c) => c.markers?.after ?? []);
  // Every marker drawn is something an arrow has to stay clear of, its own two
  // ends excepted: a line grazing a third marker reads as if it came from there.
  const obstacles = [...before, ...after].map((p) => ({ x: px(p), y: py(p) }));

  // Markers are paired within their own group, never across: an arrow must join
  // a spawn to that same spawn's new place, not to the nearest base. A marker
  // that only appeared or disappeared has no arrow, and neither has one that
  // barely shifted (the same threshold the diff calls "moved").
  const arrows = buildArrows(
    geometry
      .flatMap((c) =>
        c.markers ? matchMarkers(c.markers.before, c.markers.after) : [],
      )
      .filter((m) => m.distance > MARKER_MOVE_THRESHOLD_M)
      .map((m) => ({
        from: { x: px(m.from), y: py(m.from) },
        to: { x: px(m.to), y: py(m.to) },
      })),
    obstacles,
  );

  return (
    <div className="relative aspect-square w-full overflow-hidden">
      <MinimapImage
        src={onslaught?.minimapUrl ?? detail.minimapUrl}
        arenaId={onslaught?.arenaId ?? detail.arenaId}
        alt={`${detail.name} minimap`}
        sizes={
          large ? "(max-width: 1024px) 95vw, 900px" : "(max-width: 1024px) 100vw, 20rem"
        }
        className="opacity-70"
      />
      {arrows.length > 0 ? (
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 size-full"
          aria-hidden
        >
          <defs>
            <marker
              id={arrowId}
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="5"
              markerHeight="5"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="rgb(251 191 36)" />
            </marker>
          </defs>
          {arrows.map((arrow, i) => (
            <path
              key={`m-${i}`}
              d={arrow.path}
              fill="none"
              stroke="rgb(251 191 36)"
              strokeWidth="0.7"
              strokeOpacity="0.9"
              markerEnd={`url(#${arrowId})`}
              style={{ filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.8))" }}
            />
          ))}
        </svg>
      ) : null}
      {geometry.map((change) =>
        (change.markers?.before ?? []).map((p, i) => (
          <HistoryMarker
            key={`b-${change.field}-${i}`}
            src={iconFor(change.field, i)}
            at={project(p)}
            ghost
          />
        )),
      )}
      {geometry.map((change) => {
        const before = change.markers?.before ?? [];
        const after = change.markers?.after ?? [];
        // A spawn's numeral comes from its rank in the stored list, and the two
        // lists are not in the same order between versions. Numbering each side
        // independently would send an arrow from ghost spawn 1 to solid spawn 3,
        // which reads as a spawn that changed identity. So a paired marker keeps
        // the numeral of the marker it came from — the same pairing the arrow
        // itself was drawn from.
        const pairs = matchMarkers(before, after);
        return after.map((p, i) => {
          const from = pairs.find((m) => m.to === p)?.from;
          const rank = from ? before.indexOf(from) : i;
          return (
            <HistoryMarker
              key={`a-${change.field}-${i}`}
              src={iconFor(change.field, rank)}
              at={project(p)}
            />
          );
        });
      })}
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 flex items-center justify-center gap-4 bg-black/55 py-1 text-white",
          large ? "gap-6 py-2 text-sm" : "text-[11px]",
        )}
      >
        <span className="flex items-center gap-1.5">
          <span
            className={cn("rounded-full bg-white/45", large ? "size-3" : "size-2.5")}
          />
          {t("before")}
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className={cn("rounded-full bg-white", large ? "size-3" : "size-2.5")}
          />
          {t("after")}
        </span>
      </div>
    </div>
  );
}

/**
 * Where a version's markers were and where they went, drawn over the map.
 *
 * The one thing a list of coordinates cannot say: a spawn moving 200 m across
 * Prokhorovka means nothing as a number and everything as a position. The old
 * places are hollow, the new ones solid, so the move reads at a glance.
 *
 * The panel draws it in a 16rem column, which is enough to see that something
 * moved and not always enough to see where to: it is a button onto the same
 * drawing at full size. The dialog names the map, the update and the area it is
 * showing, since a reader who opens it loses the rows that said so.
 *
 * Positions are stored in metres from the play area's bottom-left corner, and
 * projected here against the map's *current* area. A map whose area was re-cut
 * since therefore shows its old markers slightly off; that is the same
 * compromise as drawing them on today's minimap at all, which is the only one
 * we have.
 */
export function VersionMinimap({
  detail,
  changes,
  area,
  context,
}: {
  detail: MapDetail;
  changes: FormattedMapChange[];
  /** Which of the map's two play areas to draw. */
  area: MapChangeArea;
  /** What the rows beside it are, named by the panel that holds them (an update,
   * or the running test build), for the enlarged view's own heading. */
  context?: string;
}) {
  const { t } = useTranslation("components/maps/detail/history/version-map");
  const { t: tGame } = useTranslation("game/vocabulary");
  const { t: tMaps } = useTranslation("game/maps");
  const drawn = plan(detail, changes, area);
  if (!drawn) return null;
  // The map is named as the reader's own game names it, like everywhere else a
  // map is shown.
  const name = mapName(detail.arenaId, detail.name, tMaps);
  const subtitle = [context, areaLabel(area, tGame)]
    .filter((part) => part)
    .join(" · ");

  return (
    <Dialog>
      <DialogTrigger
        // `block` because a button is inline by default, which would leave the
        // square map sitting on a text baseline inside the column.
        className="group relative block w-full cursor-zoom-in"
        aria-label={t("enlarge", { map: name })}
      >
        <VersionMinimapCanvas detail={detail} drawn={drawn} />
        <span className="pointer-events-none absolute top-2 right-2 flex size-7 items-center justify-center rounded-full bg-black/55 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          <ArrowsOutSimpleIcon className="size-4" />
        </span>
      </DialogTrigger>
      {/* Sized off the viewport's shorter side, less the heading's own height,
          so the square never pushes the dialog taller than the screen. */}
      <DialogContent className="w-[min(95vw,calc(95vh-5.5rem))] max-w-[min(95vw,calc(95vh-5.5rem))] gap-0 p-0 sm:max-w-[min(95vw,calc(95vh-5.5rem))]">
        <DialogHeader className="px-4 pt-4 pr-14 pb-3">
          <DialogTitle>{name}</DialogTitle>
          {subtitle ? <DialogDescription>{subtitle}</DialogDescription> : null}
        </DialogHeader>
        <div className="border-t border-fd-border">
          <VersionMinimapCanvas detail={detail} drawn={drawn} large />
        </div>
      </DialogContent>
    </Dialog>
  );
}
