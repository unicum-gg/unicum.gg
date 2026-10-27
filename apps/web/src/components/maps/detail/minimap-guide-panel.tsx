"use client";

import Image from "next/image";
import { WarningIcon } from "@phosphor-icons/react/dist/ssr";
import {
  CONFIDENT_GUIDE_SAMPLE,
  GuidePhase,
  spawnDirection,
} from "@unicum.gg/shared";
import { BASE } from "@/components/maps/detail/minimap-overlay";
import {
  PHASE_KEY,
  type GuideState,
  type GuideView,
} from "@/components/maps/detail/minimap-guide";
import type { MapView } from "@/components/maps/detail/views";
import { SegmentedControl } from "@/components/segmented-control";
import { LOADOUT_MODE_NAME_KEY } from "@/components/tanks/detail/loadouts/mode-names";
import { VehicleTypeIcon } from "@/components/tanks/vehicle-type-icon";
import { useFormat } from "@/hooks/use-format";
import { useTranslation } from "@/hooks/use-translation";
import { cn } from "@/lib/utils";

/**
 * The positioning guide's half beside the map: its four choices and the
 * squares it ranks. The half over the map is `minimap-guide`.
 */

/** Under this many players behind a square, its figures are a first look. */
const THIN_SAMPLE = 5;

/**
 * Side, class and moment, at the top of the guide's panel: compact, since the
 * minimap's own row of views and layers is already full.
 */
function GuideControls({
  state,
  guide,
  view,
}: {
  state: GuideState;
  guide: GuideView;
  view: MapView;
}) {
  const { t } = useTranslation("components/maps/detail/minimap-guide");
  const { t: tClasses } = useTranslation("game/vehicle-classes");
  const { t: tGame } = useTranslation("game/vocabulary");
  const side = (team: 1 | 2) => {
    const direction = spawnDirection(view, team);
    return direction ? t(`side.${direction}`) : t("spawn", { n: team });
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Drawn even with one mode: it is what says which battles these are,
          and an Encounter only ever recorded as Skirmishes must not read as
          Random battles. */}
      {guide.layout ? (
        <SegmentedControl
          active={guide.layout.mode}
          onSelect={(next) => state.setMode(next)}
          segments={guide.modes.map((each) => ({
            id: each.mode,
            label: tGame(LOADOUT_MODE_NAME_KEY[each.mode]),
            count: each.battles,
          }))}
        />
      ) : null}
      <SegmentedControl
        active={String(guide.team)}
        onSelect={(next) => state.setTeam(Number(next))}
        segments={([1, 2] as const).map((team) => ({
          id: String(team),
          label: side(team),
          icon: (
            <Image
              src={team === 1 ? BASE.team1 : BASE.team2}
              alt=""
              width={14}
              height={14}
            />
          ),
        }))}
      />
      {guide.classes.length > 0 ? (
        <SegmentedControl
          active={guide.vehicleClass}
          onSelect={state.setVehicleClass}
          segments={guide.classes.map((each) => ({
            id: each,
            label: tClasses(each),
            icon: <VehicleTypeIcon type={each} size={14} />,
            iconOnly: true,
          }))}
        />
      ) : null}
      <SegmentedControl
        active={String(state.phase)}
        onSelect={(next) => state.setPhase(Number(next) as GuidePhase)}
        segments={[GuidePhase.Opening, GuidePhase.Middle, GuidePhase.Late].map(
          (phase) => ({ id: String(phase), label: t(`phase.${PHASE_KEY[phase]}`) }),
        )}
      />
    </div>
  );
}

/** The damage picture and the numbered squares, over the minimap. */
export function GuidePanel({
  state,
  guide,
  view,
}: {
  state: GuideState;
  guide: GuideView;
  view: MapView | undefined;
}) {
  const { t } = useTranslation("components/maps/detail/minimap-guide");
  const { t: tClasses } = useTranslation("game/vehicle-classes");
  const { num } = useFormat();
  if (!state.open || !view || !state.data) return null;
  const pct = num({ style: "percent", maximumFractionDigits: 0 });
  const int = num({ maximumFractionDigits: 0 });
  const direction = spawnDirection(view, guide.team as 1 | 2);
  const opening = state.phase === GuidePhase.Opening;
  return (
    <div className="flex flex-col gap-3 p-4">
      <GuideControls state={state} guide={guide} view={view} />
      <div>
        <h2 className="font-heading text-lg font-semibold">
          {t(`title.${PHASE_KEY[state.phase]}`)}
        </h2>
        <p className="text-sm text-fd-muted-foreground">
          {t("subtitle", {
            vehicle: tClasses(guide.vehicleClass),
            side: direction ? t(`side.${direction}`) : t("spawn", { n: guide.team }),
          })}
        </p>
      </div>
      <dl className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-fd-border px-3 py-2">
          <dt className="text-xs text-fd-muted-foreground">{t("sample.battles")}</dt>
          <dd className="text-lg font-semibold tabular-nums">
            {int.format(guide.layout?.battles ?? 0)}
          </dd>
        </div>
        <div className="rounded-lg border border-fd-border px-3 py-2">
          <dt className="text-xs text-fd-muted-foreground">
            {t("sample.players", { vehicle: tClasses(guide.vehicleClass) })}
          </dt>
          <dd className="text-lg font-semibold tabular-nums">
            {int.format(guide.players)}
          </dd>
        </div>
      </dl>
      {(guide.layout?.battles ?? 0) < CONFIDENT_GUIDE_SAMPLE ? (
        <p className="flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          <WarningIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
          {t("few-battles")}
        </p>
      ) : null}
      {guide.squares.length === 0 ? (
        <p className="text-sm text-fd-muted-foreground">{t("empty")}</p>
      ) : (
        <ol className="flex flex-col gap-1">
          {guide.squares.map((square, index) => (
            <li
              key={square.name}
              onMouseEnter={() => state.setHovered(index)}
              onMouseLeave={() => state.setHovered(null)}
              className={cn(
                "flex items-center gap-3 rounded-md px-2 py-1.5 transition-colors",
                state.hovered === index && "bg-fd-accent",
              )}
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-fd-muted text-xs font-bold">
                {index + 1}
              </span>
              <span className="w-8 font-mono text-sm font-semibold">{square.name}</span>
              <span className="flex flex-1 flex-col text-xs">
                <span className="text-sm text-fd-foreground">
                  {opening
                    ? t("players-share", { share: pct.format(square.share) })
                    : t("damage-share", { share: pct.format(square.share) })}
                </span>
                <span className="text-fd-muted-foreground">
                  {opening
                    ? t("opening-detail", {
                        damage: int.format(square.avgDamage),
                        kills: int.format(square.kills),
                      })
                    : t("later-detail", {
                        damage: int.format(square.damage),
                        kills: int.format(square.kills),
                      })}
                  {opening && square.players < THIN_SAMPLE
                    ? ` · ${t("thin", { players: int.format(square.players) })}`
                    : ""}
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}
      <p className="text-xs text-fd-muted-foreground">{t("note")}</p>
    </div>
  );
}
