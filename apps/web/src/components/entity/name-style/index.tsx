"use client";

import { createContext, useContext, type CSSProperties, type ReactNode } from "react";
import {
  NAME_COLOR_HEX,
  NameEffect,
  parseNameStyle,
  type NameStyle,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import { useSupporterEntry } from "@/components/entity/badges/supporter-tier";
import { cn } from "@/lib/utils";
import { NAME_FONT_CLASS } from "./fonts";
import { namePalette } from "./palette";

/**
 * How a style is drawn, as Discord draws its own: every shade is opened out
 * from the picked colour (`namePalette`) and handed to the effect's class in
 * `globals.css` as custom properties, so the CSS holds the whole look and this
 * only chooses the numbers.
 *
 * `animated` is whether the effect moves on its own. Where a nickname is the
 * page's subject (a profile's title, the picker) it loops; in a list it only
 * moves under the pointer, since a board where every supporter moves at once is
 * a board nobody can read.
 */
function effectVars(style: NameStyle): CSSProperties {
  const p = namePalette(NAME_COLOR_HEX[style.color]);
  return {
    "--ns-main": p.main,
    "--ns-light-1": p.light1,
    "--ns-light-2": p.light2,
    "--ns-dark-1": p.dark1,
    "--ns-dark-2": p.dark2,
    "--ns-toon": p.toon,
    "--ns-neon": p.neon,
    "--ns-second": NAME_COLOR_HEX[style.color2],
  } as CSSProperties;
}

/** Gummy's letters: the picked colour as a pastel, then three hues around it. */
function gummyColors(style: NameStyle): string[] {
  const main = NAME_COLOR_HEX[style.color];
  return [0, ...GUMMY_HUE_TURNS].map(
    (turn) => `hsl(from ${main} calc(h + ${turn}) clamp(55, s, 80) 80)`,
  );
}

/** The hue turns of Discord's own Gummy set (pink, then sky, lavender, mint). */
const GUMMY_HUE_TURNS = [-124, -65, 182];

/** A nickname drawn in a given style, or plainly with none. */
export function StyledText({
  text,
  style,
  animated = false,
  className,
}: {
  text: string;
  style: NameStyle | null;
  animated?: boolean;
  className?: string;
}) {
  if (!style) return <span className={className}>{text}</span>;
  const classes = cn(
    className,
    NAME_FONT_CLASS[style.font],
    "ns",
    `ns-${style.effect}`,
    animated && "ns-live",
  );
  if (style.effect === NameEffect.Gummy) {
    const colors = gummyColors(style);
    return (
      <span className={classes} style={effectVars(style)}>
        <span className="sr-only">{text}</span>
        <span aria-hidden>
          {[...text].map((letter, i) => (
            <span
              key={i}
              className="ns-letter"
              style={
                {
                  color: colors[i % colors.length],
                  "--ns-letter": i,
                } as CSSProperties
              }
            >
              {letter}
            </span>
          ))}
        </span>
      </span>
    );
  }
  return (
    <span className={classes} style={effectVars(style)} data-text={text}>
      {text}
    </span>
  );
}

/**
 * A style being tried on, not yet saved: the picker wraps the site's real
 * components in this so the nickname it names is drawn in the draft wherever
 * those components draw it, with no props threaded through them.
 */
const NameStyleOverride = createContext<{ nickname: string; style: NameStyle } | null>(null);

export function NameStylePreviewScope({
  nickname,
  style,
  children,
}: {
  nickname: string;
  style: NameStyle;
  children: ReactNode;
}) {
  return (
    <NameStyleOverride.Provider value={{ nickname, style }}>
      {children}
    </NameStyleOverride.Provider>
  );
}

/**
 * A player's nickname, in the style they picked if they are a public supporter.
 *
 * Read from the same `/support/tiers` entry as the supporter crest, so a board
 * costs one request for every styled name on it, and a player who is not a
 * supporter (`isSupporter` false) costs nothing at all. Drawn plainly until the
 * entry arrives, which is also how it is server-rendered.
 */
export function StyledNickname({
  region,
  nickname,
  isSupporter,
  animated = false,
  className,
}: {
  region: Region;
  nickname: string;
  isSupporter: boolean | undefined;
  animated?: boolean;
  className?: string;
}) {
  const override = useContext(NameStyleOverride);
  const tried =
    override && override.nickname.toLowerCase() === nickname.toLowerCase()
      ? override.style
      : null;
  const entry = useSupporterEntry(
    region,
    isSupporter && !tried ? nickname : undefined,
  );
  return (
    <StyledText
      text={nickname}
      style={tried ?? (entry ? parseNameStyle(entry.style) : null)}
      animated={animated}
      className={className}
    />
  );
}
