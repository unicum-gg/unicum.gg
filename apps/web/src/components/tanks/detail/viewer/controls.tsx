"use client";

import type { MirrorStyle } from "@unicum.gg/wargaming";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  CameraControls,
  SizeControls,
} from "@/components/tanks/detail/viewer/camera";
import type { Cinematic } from "@/components/tanks/detail/viewer/cinematic";
import { Group } from "@/components/tanks/detail/viewer/control-group";
import { DressingControls } from "@/components/tanks/detail/viewer/dressing";
import { ArmourLegend } from "@/components/tanks/detail/viewer/legend";
import type { Presentation } from "@/components/tanks/detail/viewer/presentation";
import { ShotPicker } from "@/components/tanks/detail/viewer/shot";
import type { SkinFace } from "@/services/tank-viewer/styles";
import type { HeroShell } from "@/components/tanks/detail/viewer/shell-rules";
import {
  VIEW_LABEL,
  VIEW_TOOLTIP,
  View,
} from "@/components/tanks/detail/viewer/views";

/**
 * Everything the reader can ask of the hero, grouped by what it is about.
 *
 * **One row of boxes rather than one row of buttons.** Every control here used
 * to sit in a single flat line, so a camera angle stood beside a field for a
 * shell's normalisation as though the two were the same kind of question, and
 * by the time a vehicle offered all of them the line wrapped and pushed the
 * legend up over the tank. Four short groups say what belongs with what, and
 * the band stays one line: the dressing and the shot are never both there,
 * since one belongs to the view that draws paint and the other to the views
 * that draw steel.
 *
 * Which view comes first, because it is the question the other three answer
 * under.
 */
export function ViewerControls({
  centred,
  onRecentre,
  resettable,
  onReset,
  hullDown,
  onHullDown,
  canDeploy,
  deployed,
  onDeploy,
  mechanic,
  cinematic,
  onCinematic,
  presentation,
  onPresentation,
  shells,
  round,
  onRound,
  pen,
  calibre,
  norm,
  ricochet,
  kind,
  onTune,
  onKind,
  carried,
  range,
  works,
  onWork,
  rolls,
  rolling,
  onRolling,
  sharpenable,
  sharp,
  onSharpen,
  marks,
  markable,
  onMarks,
  cuts,
  cutNames,
  cut,
  onCut,
  wardrobe,
  worn,
  onWear,
  season,
  onSeason,
  view,
  views,
  onView,
}: {
  centred: boolean;
  onRecentre: () => void;
  resettable: boolean;
  onReset: () => void;
  hullDown: boolean;
  onHullDown: () => void;
  canDeploy: boolean;
  deployed: boolean;
  onDeploy: (on: boolean) => void;
  /** Which mechanic the second state is, so the mark can be named for it. */
  mechanic: string | null;
  cinematic: Cinematic;
  onCinematic: (next: Cinematic) => void;
  presentation: Presentation;
  onPresentation: (next: Presentation) => void;
  /** The rounds this vehicle's gun fires, the standard one first. */
  shells: HeroShell[];
  round: number;
  onRound: (next: number) => void;
  pen: string;
  calibre: string;
  norm: string;
  ricochet: string;
  kind: string;
  onTune: (patch: {
    pen?: string;
    calibre?: string;
    norm?: string;
    ricochet?: string;
    kind?: string;
  }) => void;
  onKind: (next: string) => void;
  /** The kinds this gun actually carries, which is not every kind offered. */
  carried: string[];
  /** The span of this vehicle's own armour, which the scale is read against. */
  range: [number, number];
  works: boolean;
  onWork: () => void;
  rolls: boolean;
  rolling: boolean;
  onRolling: () => void;
  sharpenable: boolean;
  sharp: boolean;
  onSharpen: () => void;
  marks: number;
  markable: number;
  onMarks: (next: number) => void;
  cuts: string[];
  cutNames: Record<string, SkinFace>;
  cut: string | null;
  onCut: (name: string | null) => void;
  wardrobe: MirrorStyle[];
  worn: MirrorStyle | null;
  onWear: (style: MirrorStyle | null) => void;
  season: string;
  onSeason: (next: string) => void;
  view: View;
  views: View[];
  onView: (next: View) => void;
}) {
  const steel = view !== View.Visual;
  return (
    <TooltipProvider>
      <div className="pointer-events-none flex flex-wrap items-center gap-2">
        {/*
          Offered only where there is a choice. A vehicle the mirror carries no
          collision for can answer one question, and a control with one position
          is a label pretending to be a control.

          **Drawn here rather than with the page's segmented control**, which is
          a shorter thing: its segments are 24 pixels where a mark on this band
          is 28, so the box around them came out eight pixels under its
          neighbours and the row of groups no longer had one baseline. Changing
          the shared control would have moved the two beside the characteristics
          title, which are the right size where they sit.
        */}
        {views.length > 1 ? (
          <Group>
            {views.map((one) => (
              <Tooltip key={one}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => onView(one)}
                    aria-pressed={view === one}
                    className={`rounded-md px-2.5 py-1.5 text-xs font-medium leading-4 transition-colors ${
                      view === one
                        ? "bg-brand/10 text-brand ring-1 ring-brand/60"
                        : "text-fd-muted-foreground hover:bg-fd-secondary/60 hover:text-fd-foreground"
                    }`}
                  >
                    {VIEW_LABEL[one]}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">{VIEW_TOOLTIP[one]}</TooltipContent>
              </Tooltip>
            ))}
          </Group>
        ) : null}
        <CameraControls
          centred={centred}
          onRecentre={onRecentre}
          resettable={resettable}
          onReset={onReset}
          hullDown={hullDown}
          onHullDown={onHullDown}
          canDeploy={canDeploy}
          deployed={deployed}
          onDeploy={onDeploy}
          mechanic={mechanic}
          cinematic={cinematic}
          onCinematic={onCinematic}
          works={works && !steel}
          onWork={onWork}
          rolls={rolls && !steel}
          rolling={rolling}
          onRolling={onRolling}
        />
        {steel ? (
          /*
            What is being fired and what the colours mean: the two things the
            armour views are read with, so the two things in one box. The shot
            is offered on the live view alone, because it is the only one a
            shell changes: reading the plate is the question you ask precisely
            when you do not want a particular shell in the answer.
          */
          <Group>
            {view === View.Live && shells.length > 0 ? (
              <ShotPicker
                shells={shells}
                round={round}
                onRound={onRound}
                pen={pen}
                calibre={calibre}
                norm={norm}
                ricochet={ricochet}
                kind={kind}
                onTune={onTune}
                onKind={onKind}
                carried={carried}
              />
            ) : null}
            <ArmourLegend view={view} range={range} />
          </Group>
        ) : (
          <DressingControls
            sharpenable={sharpenable}
            sharp={sharp}
            onSharpen={onSharpen}
            marks={marks}
            markable={markable}
            onMarks={onMarks}
            cuts={cuts}
            cutNames={cutNames}
            cut={cut}
            onCut={onCut}
            wardrobe={wardrobe}
            worn={worn}
            onWear={onWear}
            season={season}
            onSeason={onSeason}
          />
        )}
        <SizeControls
          presentation={presentation}
          onPresentation={onPresentation}
        />
      </div>
    </TooltipProvider>
  );
}
