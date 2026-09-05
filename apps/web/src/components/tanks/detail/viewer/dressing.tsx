"use client";

import { ChevronsUp } from "lucide-react";
import type { MirrorStyle } from "@unicum.gg/wargaming";

import {
  CONTROL,
  Group,
  Mark,
} from "@/components/tanks/detail/viewer/control-group";
import {
  MARKS_MEANING,
  MARKS_MOST,
  marksLabel,
  nextMarks,
} from "@/components/tanks/detail/viewer/marks";
import { WardrobePicker } from "@/components/tanks/detail/viewer/wardrobe";
import type { SkinFace } from "@/services/tank-viewer/styles";

/**
 * What the vehicle is wearing and what it is doing, on the view that draws it.
 *
 * **Only on the visual view, all of it.** A style is paint and paint is
 * invisible to a question about steel; the armour views draw flat answers off a
 * collision shell, which has no texture to sharpen and no barrel to paint a
 * mark on. The whole group therefore comes and goes with the view rather than
 * each of its marks doing so on its own, which is what left the old row a
 * different length every time a reader switched.
 *
 * Empty where the vehicle offers none of it, and drawn as nothing rather than
 * as an empty box.
 */
export function DressingControls({
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
}: {
  /** Whether the mirror holds the larger texture set for this vehicle. */
  sharpenable: boolean;
  sharp: boolean;
  onSharpen: () => void;
  marks: number;
  /** How many the mirror has a texture for here, zero where it has none. */
  markable: number;
  onMarks: (next: number) => void;
  /** The vehicle's 3D styles, each a set of pieces rather than a coat of paint. */
  cuts: string[];
  cutNames: Record<string, SkinFace>;
  cut: string | null;
  onCut: (name: string | null) => void;
  wardrobe: MirrorStyle[];
  worn: MirrorStyle | null;
  onWear: (style: MirrorStyle | null) => void;
  season: string;
  onSeason: (next: string) => void;
}) {
  const dressable = wardrobe.length > 0 || cuts.length > 0;
  if (!dressable && markable === 0 && !sharpenable) return null;
  return (
    <Group>
      {/*
        What it is wearing. Offered only once the wardrobe has arrived, which
        is after the vehicle.
      */}
      {dressable ? (
        <WardrobePicker
          className={CONTROL}
          cuts={cuts}
          cutNames={cutNames}
          cut={cut}
          onCut={onCut}
          styles={wardrobe}
          worn={worn}
          onWear={onWear}
          season={season}
          onSeason={onSeason}
        />
      ) : null}
      {/*
        The marks of excellence on the barrel.

        One control that counts up rather than a switch per mark: they are three
        points on one scale, a player has the first before the second, and three
        switches would let a reader ask for the third alone, which is not a tank
        anyone has ever seen.

        The count is written beside the mark because it is the whole content of
        the control: an icon alone would say the gun is painted without saying
        how far, which is the only part a reader is asking about.
      */}
      {markable > 0 ? (
        <Mark
          onClick={() => onMarks(nextMarks(marks, markable))}
          says={marksLabel(marks)}
          tooltip={MARKS_MEANING[Math.min(marks, MARKS_MOST)]}
          wide
        >
          <ChevronsUp
            className={marks > 0 ? "size-4 text-fd-foreground" : "size-4"}
            aria-hidden
          />
          <span className="text-xs leading-none tabular-nums">{marks}</span>
        </Mark>
      ) : null}
      {/*
        Which of the two texture sets the vehicle wears.

        **The mesh is the same either way.** The client ships one geometry and
        two sets of maps, the second at twice the side, so this changes what a
        plate is painted with and nothing about its shape.

        Only where the mirror actually holds the larger set: a vehicle whose
        textures were published once would give a control that does nothing.
      */}
      {sharpenable ? (
        <Mark
          on={sharp}
          onClick={onSharpen}
          says={sharp ? "High definition textures" : "Standard textures"}
        >
          {/* **The words players already use**, rather than a mark for them to
              learn. Every game that ships two texture sets calls them this, and
              two letters take no more room on the bar than the icon they
              replace. */}
          <span className="block w-6 text-center text-[11px] font-semibold leading-4 tracking-wide">
            {sharp ? "HD" : "SD"}
          </span>
        </Mark>
      ) : null}
    </Group>
  );
}
