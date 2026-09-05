"use client";

import Image from "next/image";
import { ChevronDown } from "lucide-react";
import { SHELL_LABEL, iconUrl } from "@unicum.gg/shared";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { HeroShell } from "@/components/tanks/detail/viewer/shell-rules";

// WG's own shell icons, from our wot.assets mirror. Keyed by the shell's own
// icon rather than by its kind, so a premium round carries its own mark.
const AMMO_ICON = iconUrl("ammopanel/ammo");

/** The look every typed figure shares. */
const FIGURE =
  "w-full rounded border border-fd-border/60 bg-fd-background/60 py-1 pl-2 pr-7 text-right text-xs tabular-nums text-fd-foreground outline-none focus:border-brand/60 focus:text-brand";

/**
 * What is being fired, as one mark that opens onto the whole shot.
 *
 * **A round is not the same kind of control as a camera.** It was laid out flat
 * beside them, five kinds and four numbered boxes wide, which made the band
 * under the picture into an instrument panel and left the vehicle competing
 * with it. Folded here, the band says what is loaded and the rest is one click
 * away, which matches how often either is touched: a reader changes shell to
 * ask a question, and edits a normalisation angle perhaps once.
 *
 * The button carries the round rather than a label, so the answer to "what am I
 * looking at" needs no click at all.
 */
export function ShotPicker({
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
}: {
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
}) {
  const on = shells[round];
  // **What the button says is the shot, not the round.** A reader who typed
  // their own penetration is asking about a shell nobody has, and the mark
  // would otherwise still be showing them the one they started from.
  const short = SHELL_LABEL[kind as keyof typeof SHELL_LABEL] ?? kind;
  const edited = pen !== String(on?.shot.penetration ?? "");
  return (
    <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`Firing ${short}, ${pen} mm. Change the shot`}
            className="flex items-center gap-2 rounded-md py-1 pl-1.5 pr-1 transition-colors hover:bg-fd-secondary/60"
          >
            {on ? (
              <Image
                src={`${AMMO_ICON}/${on.icon}.png`}
                alt=""
                width={18}
                height={18}
                className="object-contain"
                style={{ width: 18, height: 18 }}
              />
            ) : null}
            <span className="text-xs font-semibold tracking-wide text-fd-foreground">
              {short}
            </span>
            <span
              className={`text-xs tabular-nums ${edited ? "text-brand" : "text-fd-muted-foreground"}`}
            >
              {pen} mm
            </span>
            <ChevronDown
              className="size-3.5 text-fd-muted-foreground"
              aria-hidden
            />
          </button>
        </PopoverTrigger>
        <PopoverContent side="top" align="start" className="w-72 p-0">
          {/*
            The vehicle's own rounds first, since they are the question almost
            everyone is asking. Named in full here, where there is room for it,
            rather than left to a tooltip on the picture.
          */}
          {shells.length > 1 ? (
            <div className="border-b border-fd-border p-1">
              {shells.map((shell, i) => (
                <button
                  key={`${shell.icon}-${i}`}
                  type="button"
                  onClick={() => onRound(i)}
                  aria-pressed={i === round}
                  className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left transition-colors ${
                    i === round
                      ? "bg-brand/15 text-brand"
                      : "text-fd-foreground hover:bg-fd-secondary/60"
                  }`}
                >
                  <Image
                    src={`${AMMO_ICON}/${shell.icon}.png`}
                    alt=""
                    width={18}
                    height={18}
                    className="shrink-0 object-contain"
                    style={{ width: 18, height: 18 }}
                  />
                  <span className="min-w-0 flex-1 truncate text-xs">
                    {shell.name}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-fd-muted-foreground">
                    {shell.penetration} mm
                  </span>
                </button>
              ))}
            </div>
          ) : null}
          {/*
            **The vehicle's own rounds are a starting point, not the limit.** A
            player wants to know what it takes to get through this plate, which
            is a question about a shell nobody has yet, so every figure the
            rules actually consume is a box: what it goes through, how wide it
            is, how far it straightens, and how far past square it glances off.

            The kind is here because it is not a label. It decides whether the
            calibre rules apply at all, so a solid shot three times the plate
            cannot be turned away and a shaped charge of the same width can.
          */}
          <div className="p-2">
            <p className="px-1 pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-fd-muted-foreground">
              Treat it as
            </p>
            <div className="flex flex-wrap items-center gap-0.5">
              {Object.entries(SHELL_LABEL).map(([raw, mark]) => {
                // **A kind this vehicle carries is a different offer.** Picking
                // it reads that round's own normalisation and ricochet angle;
                // picking one it does not carry cannot, so those two figures
                // stay where they are and it falls to the reader to set them.
                // Saying which is which is the difference between a deliberate
                // silence and a stale number nobody notices.
                const real = carried.includes(raw);
                return (
                  <Tooltip key={raw}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => onKind(raw)}
                        aria-pressed={kind === raw}
                        aria-label={`Treat it as ${mark}`}
                        className={`rounded px-1.5 py-1 text-[11px] font-semibold tracking-wide transition-colors ${
                          kind === raw
                            ? "bg-brand/20 text-brand"
                            : real
                              ? "text-fd-muted-foreground hover:text-fd-foreground"
                              : "text-fd-muted-foreground/50 hover:text-fd-muted-foreground"
                        }`}
                      >
                        {mark}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      {real
                        ? `${mark}: this gun's own round, figures and all`
                        : `${mark}: this gun has none, so set the angles yourself`}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {(
                [
                  {
                    key: "pen",
                    label: "Penetration",
                    value: pen,
                    says: "Penetration in millimetres",
                    unit: "mm",
                  },
                  {
                    key: "calibre",
                    label: "Caliber",
                    value: calibre,
                    says: "Caliber in millimetres",
                    unit: "mm",
                  },
                  {
                    key: "norm",
                    label: "Normalisation",
                    value: norm,
                    says: "Normalisation in degrees",
                    unit: "°",
                  },
                  {
                    key: "ricochet",
                    label: "Ricochet",
                    value: ricochet,
                    says: "Ricochet angle in degrees",
                    unit: "°",
                  },
                ] as const
              ).map((figure) => (
                <label key={figure.key} className="flex flex-col gap-1">
                  <span className="px-1 text-[10px] uppercase tracking-wide text-fd-muted-foreground">
                    {figure.label}
                  </span>
                  <span className="relative">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={figure.value}
                      onChange={(e) => onTune({ [figure.key]: e.target.value })}
                      aria-label={figure.says}
                      className={FIGURE}
                    />
                    <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-[10px] text-fd-muted-foreground">
                      {figure.unit}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>
      </PopoverContent>
    </Popover>
  );
}
