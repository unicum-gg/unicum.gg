"use client";

import { Paintbrush } from "lucide-react";
import { useMemo, useState } from "react";
import { assetUrl, type MirrorStyle } from "@unicum.gg/wargaming";
import type { SkinFace } from "@/services/tank-viewer/styles";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

/** Where the client keeps every style's swatch, 2D and 3D alike. */
const STYLE_ICONS = "gui/maps/vehicles/styles";

/** The seasons a style can be cut for, in the order they are offered. */
const SEASONS = ["summer", "winter", "desert"] as const;

/**
 * What the vehicle can be dressed in.
 *
 * **A list rather than the row's usual marks, because there are hundreds.** The
 * Object 140 alone is offered 728 of the client's 845 styles, so this is the one
 * control here that cannot be a handful of icons: it is a panel with a filter,
 * opened from a single mark in the row.
 *
 * **Named and pictured.** The client draws each style a swatch of its own
 * pattern and the mirror carries them, so every entry shows what it puts on the
 * tank rather than asking a reader to know that "Klarer Himmel" is blue. The
 * names stay: they are what the search box matches, and a swatch of dark green
 * looks like every other swatch of dark green.
 *
 * The swatches load as they are scrolled to. There are seven hundred of them on
 * a well-offered vehicle, and fetching that at once to show a dozen would be a
 * megabyte a reader never sees.
 */
export function WardrobePicker({
  className,
  cuts,
  cutNames,
  cut,
  onCut,
  styles,
  worn,
  onWear,
  season,
  onSeason,
}: {
  /** How the mark is drawn, which is the bar it sits in rather than its own. */
  className?: string;
  /** The vehicle's 3D styles, each a set of pieces rather than a coat of paint. */
  cuts: string[];
  /** What each of those is called in the game, by folder. */
  cutNames: Record<string, SkinFace>;
  cut: string | null;
  onCut: (name: string | null) => void;
  styles: MirrorStyle[];
  /** The style on the vehicle, or null for the paint it left the factory in. */
  worn: MirrorStyle | null;
  onWear: (style: MirrorStyle | null) => void;
  season: string;
  onSeason: (next: string) => void;
}) {
  const [filter, setFilter] = useState("");
  const shown = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    if (!needle) return styles;
    return styles.filter((style) => style.name.toLowerCase().includes(needle));
  }, [styles, filter]);
  // Only worth offering where the style was actually cut three ways: most are
  // one outfit for the year round, and a season toggle over those says nothing.
  const seasonal = (worn?.outfits.length ?? 0) > 1;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={worn ? `Style: ${worn.name}` : "Choose a style"}
          aria-pressed={worn !== null}
          className={`${className ?? ""} ${worn || cut ? "text-brand" : ""}`}
        >
          <Paintbrush className="size-4" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-72 p-0">
        <div className="border-b border-fd-border p-2">
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={`Search ${styles.length} styles`}
            aria-label="Search styles"
            className="w-full bg-transparent px-1 py-0.5 text-sm outline-none placeholder:text-fd-muted-foreground"
          />
        </div>
        {seasonal ? (
          <div className="flex items-center gap-1 border-b border-fd-border px-2 py-1.5">
            {SEASONS.map((one) => (
              <button
                key={one}
                type="button"
                onClick={() => onSeason(one)}
                aria-pressed={season === one}
                className={`rounded px-1.5 py-0.5 text-[11px] capitalize transition-colors ${
                  season === one
                    ? "bg-brand/20 text-brand"
                    : "text-fd-muted-foreground hover:text-fd-foreground"
                }`}
              >
                {one}
              </button>
            ))}
          </div>
        ) : null}
        <div className="max-h-64 overflow-y-auto py-1">
          {/*
            **The two kinds of style are not the same offer, so they are not one
            list.** A 2D style is paint on the vehicle that is already standing
            there. A 3D one is another vehicle: its own pieces, its own textures,
            fetched and built from scratch, which is why picking one costs a
            rebuild and picking a camouflage does not. Sorting them together
            would hide that behind two entries that look alike.
          */}
          {cuts.length > 0 ? (
            <>
              <Heading>Cut</Heading>
              <Entry active={cut === null} onClick={() => onCut(null)}>
                As it was built
              </Entry>
              {/* The folder is what the viewer loads and the name is what the
                  game calls it: `A120_M48A5_3DSt_TLXXL` is "Tiger Claw". A
                  style the catalogue has no name for keeps its folder, which
                  is still better than nothing to click. */}
              {/* **The swatch is read from the catalogue, not guessed.** A
                  cut's folder is whatever the artist called the set of models,
                  and a third of them are named after the occasion rather than
                  the style: `battlepass2020` is "Storm", `halloween` is
                  "Revenant". Naming the file after the folder found the picture
                  for most of them and quietly missed those. Falls back to the
                  guess for a mirror published before the swatch travelled with
                  the name. */}
              {cuts.map((folder) => (
                <Entry
                  key={folder}
                  active={cut === folder}
                  onClick={() => onCut(folder)}
                  swatch={cutNames[folder]?.icon ?? `${STYLE_ICONS}/${folder}.png`}
                >
                  {cutNames[folder]?.name ?? folder}
                </Entry>
              ))}
              <Heading>Paint</Heading>
            </>
          ) : null}
          <Entry active={worn === null} onClick={() => onWear(null)}>
            No style
          </Entry>
          {shown.map((style) => (
            <Entry
              key={style.id}
              active={worn?.id === style.id}
              onClick={() => onWear(style)}
              swatch={style.icon}
            >
              {style.name}
            </Entry>
          ))}
          {shown.length === 0 ? (
            <p className="px-3 py-2 text-sm text-fd-muted-foreground">
              Nothing by that name.
            </p>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-fd-muted-foreground">
      {children}
    </p>
  );
}

function Entry({
  active,
  onClick,
  swatch,
  children,
}: {
  active: boolean;
  onClick: () => void;
  /** The client's own picture of this pattern, where it has one. */
  swatch?: string;
  children: React.ReactNode;
}) {
  // A cut's picture is guessed from its folder and one in seven has none, so
  // the row finds out by asking for it. A 2D style's is named by the client and
  // never misses.
  const [missing, setMissing] = useState(false);
  const shown = swatch && !missing;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`relative flex w-full items-center overflow-hidden px-3 text-left text-sm transition-colors ${
        shown ? "py-2.5" : "py-1.5"
      } ${
        active
          ? shown
            ? "ring-1 ring-inset ring-brand"
            : "bg-brand/15 text-brand"
          : shown
            ? ""
            : "text-fd-foreground hover:bg-fd-secondary/60"
      }`}
    >
      {shown ? (
        <>
          {/*
            **The pattern behind the name, not beside it.** A style is a look,
            and a swatch the size of a full stop shows a colour rather than what
            it does to a tank. Filling the row shows the pattern at something
            like the scale it is drawn at.

            **A layer rather than a CSS background**, so it keeps `loading`: a
            well-offered vehicle lists seven hundred of these, and a background
            image has no way to say "only when scrolled to".
          */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={assetUrl(swatch)}
            alt=""
            loading="lazy"
            decoding="async"
            aria-hidden
            onError={() => setMissing(true)}
            className="absolute inset-0 h-full w-full object-cover"
          />
          {/*
            What makes the name readable over it. The patterns run from black
            to near-white and the name has to hold on all of them, so it is a
            wash rather than a tint, heavier where the words are and thinning
            out to leave the pattern itself visible.
          */}
          <span
            aria-hidden
            className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/65 to-black/35"
          />
        </>
      ) : null}
      {/* Above both layers by coming after them and taking a position: a
          negative z-index would have put the pattern behind the panel's own
          ground instead, which is a popover away from being invisible. */}
      <span
        className={`relative min-w-0 flex-1 truncate ${
          shown
            ? `drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] ${active ? "text-brand" : "text-white"}`
            : ""
        }`}
      >
        {children}
      </span>
    </button>
  );
}
