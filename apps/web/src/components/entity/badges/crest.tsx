import { useId, type ReactNode } from "react";
import {
  BRAND_COLOR,
  ONSLAUGHT_TIER_COLOR,
  OnslaughtTier,
  RATING_COLOR_HEX,
} from "@unicum.gg/shared";
import { cn } from "@/lib/utils";

/**
 * A small flat-top hexagon crest carried beside a player's name — the shared
 * shape for the identity badges (verified, supporter, streamer). Purely the
 * shape + tincture; the white charge inside says which one. `size` is the
 * height in px (the meaningful dimension inline); the width follows the
 * hexagon's aspect.
 */
export enum CrestKind {
  Verified = "verified",
  Supporter = "supporter",
  Streamer = "streamer",
  CommonTest = "common-test",
  Tournament = "tournament",
  TournamentFeatured = "tournament-featured",
  OnslaughtChampion = "onslaught-champion",
  OnslaughtLegend = "onslaught-legend",
}

// Flat-top regular hexagon in a 100×86.6 box: flat top/bottom edges (x 25–75),
// points at left/right (y 43.3).
const HEX = "M25 1.5 L75 1.5 L99 43.3 L75 85.1 L25 85.1 L1 43.3 Z";
const HEX_W = 100;
const HEX_H = 86.6;

/**
 * One wedge of a shield divided from its centre, `i` of `n`.
 *
 * Gyronny, in the heraldic sense: the divisions radiate from the middle rather
 * than running side to side, so four colours land in the four corners instead
 * of stacking into stripes, and each one keeps a piece of the centre where the
 * eye goes first.
 *
 * The first boundary is straight up, which is what makes the common cases read
 * as themselves: two wedges split left and right, four cut a cross into
 * quarters, three point one up and two down. The wedge is drawn out to a radius
 * well past the hexagon and cut back by its clip path, so no arc has to know
 * the shape it is being fitted into.
 */
function gyron(i: number, n: number): string {
  const cx = HEX_W / 2;
  const cy = HEX_H / 2;
  const r = 130;
  const from = -90 + (360 * i) / n;
  const to = -90 + (360 * (i + 1)) / n;
  // Chorded every 15 degrees or so: a single straight edge would cut across the
  // shield's interior once a wedge is wider than a quarter turn.
  const steps = Math.max(2, Math.ceil((to - from) / 15));
  const points = Array.from({ length: steps + 1 }, (_, step) => {
    const a = ((from + ((to - from) * step) / steps) * Math.PI) / 180;
    return `${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`;
  });
  return `M${cx} ${cy} L${points.join(" L")} Z`;
}

/** `#rrggbb` to HSL, each component 0-1. */
function hexToHsl(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const sat = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const hue =
    max === r
      ? (g - b) / d + (g < b ? 6 : 0)
      : max === g
        ? (b - r) / d + 2
        : (r - g) / d + 4;
  return [hue / 6, sat, l];
}

/** HSL back to `#rrggbb`, clamping anything the scaling pushed out of range. */
function hslToHex([h, s, l]: [number, number, number]): string {
  const sat = Math.min(1, Math.max(0, s));
  const lum = Math.min(1, Math.max(0, l));
  const q = lum < 0.5 ? lum * (1 + sat) : lum + sat - lum * sat;
  const p = 2 * lum - q;
  const channel = (t: number) => {
    const x = (t + 1) % 1;
    const v =
      x < 1 / 6
        ? p + (q - p) * 6 * x
        : x < 1 / 2
          ? q
          : x < 2 / 3
            ? p + (q - p) * (2 / 3 - x) * 6
            : p;
    return Math.round((sat === 0 ? lum : v) * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${channel(h + 1 / 3)}${channel(h)}${channel(h - 1 / 3)}`;
}

/**
 * The two ends of an Onslaught crest's gradient, derived from the colour the
 * standings paint that rank in.
 *
 * The job is for a 16px hexagon to read as the same colour as the flat rank
 * pill beside it, and getting there took measuring rather than eyeballing. A
 * crest is a gradient behind a 2px stroke of its own darker end, drawn small
 * enough that the antialiased rim blends a real share of its area into the
 * page background. Sampling the rendered badge and averaging it showed what
 * that costs: a gradient running from the rank colour down to a darker one
 * landed 30 short on green and 47 short on blue. So the badge was not too
 * dark so much as too GREY, and the instinct to fix it by lightening made it
 * worse, since mixing towards white desaturates too.
 *
 * The correction is therefore in HSL: lift the lightness and multiply the
 * saturation, which keeps the hue while surviving the blend. Scaling rather
 * than offsetting is what lets ONE rule serve both ranks: Legend's violet is
 * two thirds the lightness of Champion's blue, so a fixed +0.22 overshot it
 * by a mile while x1.3 moves each in proportion. Measured across both ranks at
 * 16 / 20 / 24px, the sampled mean now lands within 15 of the pill on all of
 * them, against 56 before.
 */
const CREST_TOP_LIGHTNESS = 1.3;
const CREST_BOTTOM_LIGHTNESS = 1.02;
const CREST_SATURATION = 1.6;

function rankTincture(tier: OnslaughtTier): { fill: string; edge: string } {
  const [h, s, l] = hexToHsl(RATING_COLOR_HEX[ONSLAUGHT_TIER_COLOR[tier]]);
  const sat = s * CREST_SATURATION;
  return {
    fill: hslToHex([h, sat, l * CREST_TOP_LIGHTNESS]),
    edge: hslToHex([h, sat, l * CREST_BOTTOM_LIGHTNESS]),
  };
}

const TINCTURE: Record<CrestKind, { fill: string; edge: string }> = {
  [CrestKind.Verified]: { fill: "#3b9eff", edge: "#1f6fd6" },
  [CrestKind.Supporter]: { fill: BRAND_COLOR, edge: "#b8390f" },
  [CrestKind.Streamer]: { fill: "#9147ff", edge: "#6d28d9" },
  [CrestKind.CommonTest]: { fill: BRAND_COLOR, edge: "#b8390f" },
  // Steel for a win, gold for one Wargaming flagged as featured: the two tiers
  // have to be told apart at 16px, and hue is the only channel a crest this
  // small has left once the charge is spoken for.
  [CrestKind.Tournament]: { fill: "#9aa4b2", edge: "#5b6472" },
  [CrestKind.TournamentFeatured]: { fill: "#f0b429", edge: "#b07407" },
  // Read from the rank's own colour rather than copied out of it, so the crest
  // cannot drift from the pill the standings paint beside the same name. They
  // sit close to the verified blue and the Twitch purple, which is a real cost
  // and is paid on purpose: a reader who has seen a violet Legend on the board
  // recognises the violet crest, and matching the entity everywhere beats being
  // maximally distinct from unrelated crests. The charge tells them apart at
  // 16px.
  [CrestKind.OnslaughtChampion]: rankTincture(OnslaughtTier.Champion),
  [CrestKind.OnslaughtLegend]: rankTincture(OnslaughtTier.Legend),
};

// Muted tincture for the owner-only supporter states (hidden / invite): a slate
// crest instead of the live accent, so it reads as "not active yet".
const MUTED = { fill: "#8b8b8b", edge: "#5f5f5f" };

// A cup, drawn once and worn by both tournament tinctures.
//
// A laurel would be the truer device (it is what Wargaming's own placement
// medals use, and what `RankMedal` transcribes), but at 16px its two branches
// collapse into an open ring that reads as a horseshoe. A cup keeps a
// silhouette that survives the size: bowl, stem, foot, and two handles.
const TOURNAMENT_CHARGE = (
  <>
    <g fill="#fff">
      <path d="M35 20 H65 V33 C65 44 58 52 50 52 C42 52 35 44 35 33 Z" />
      <path d="M46 52 H54 V62 H46 Z" />
      <path d="M36 62 H64 V69 H36 Z" />
    </g>
    <g fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round">
      <path d="M35 24 H29 C24 24 24 34 32 38" />
      <path d="M65 24 H71 C76 24 76 34 68 38" />
    </g>
  </>
);

// A chevron over a bar, drawn once and worn by both Onslaught tinctures.
//
// The mode's own devices are creatures (a dragon, then a phoenix) and none of
// them survives 16px: they collapse into a blob. A chevron is the universal
// mark of rank, it reads at any size, and the bar under it gives the crest the
// weight the thin arrow alone would lack. Champion and Legend share it and are
// told apart by tincture, exactly as the two tournament tiers are.
const ONSLAUGHT_CHARGE = (
  <g fill="#fff">
    <path d="M50 18 L78 46 L64 46 L50 32 L36 46 L22 46 Z" />
    <rect x="26" y="55" width="48" height="11" rx="3" />
  </g>
);

// White charges, centred on the hexagon (~50, 43.3).
const CHARGE: Record<CrestKind, ReactNode> = {
  [CrestKind.Verified]: (
    <path
      d="M31 44 L44 58 L70 28"
      fill="none"
      stroke="#fff"
      strokeWidth="9"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  [CrestKind.Supporter]: (
    <path
      d="M50 61 C28 45 29 26 41 26 C47 26 50 31 50 34 C50 31 53 26 59 26 C71 26 72 45 50 61 Z"
      fill="#fff"
    />
  ),
  [CrestKind.Streamer]: <path d="M40 27 L67 43 L40 59 Z" fill="#fff" />,
  [CrestKind.Tournament]: TOURNAMENT_CHARGE,
  [CrestKind.TournamentFeatured]: TOURNAMENT_CHARGE,
  [CrestKind.OnslaughtChampion]: ONSLAUGHT_CHARGE,
  [CrestKind.OnslaughtLegend]: ONSLAUGHT_CHARGE,
  // Lettered rather than a device: "CT" is what the community calls it, and no
  // pictogram reads as "test build" at 16px.
  [CrestKind.CommonTest]: (
    <text
      x="50"
      y="43.3"
      textAnchor="middle"
      dominantBaseline="central"
      fill="#fff"
      fontSize="42"
      fontWeight="700"
      fontFamily="system-ui, sans-serif"
      letterSpacing="-2"
    >
      CT
    </text>
  ),
};

export type Tincture = { fill: string; edge: string };

/** The colours a kind is drawn in, for a caller that needs the hue rather than
 * the crest: the "+N" paints one band per badge it stands for. */
export function crestTincture(kind: CrestKind, muted = false): Tincture {
  return muted ? MUTED : TINCTURE[kind];
}

type CrestProps = {
  /** Height in px; the width follows the hexagon's aspect. */
  size?: number;
  /** Slate crest for owner-only supporter states (hidden / invite). */
  muted?: boolean;
  className?: string;
} & (
  | { kind: CrestKind; tincture?: never; charge?: ReactNode }
  // Colour and device both supplied: the clan leaderboard crests, where the
  // hue is the board and the charge is the rank digit, neither of which is a
  // fixed identity this enum could name.
  // Several tinctures divide the shield gyronny, one wedge per colour, radiating
  // from the centre clockwise from the top. That is what the "+N" uses to show
  // which badges it stands for: a count that is grey says nothing about what was
  // folded, while a divided shield carries every one of their colours at 16px.
  | { kind?: never; tincture: Tincture | Tincture[]; charge: ReactNode }
);

export function Crest({
  kind,
  size = 16,
  muted = false,
  tincture,
  charge,
  className,
}: CrestProps) {
  const gradientId = useId();
  const given = tincture ?? TINCTURE[kind as CrestKind];
  const bands = muted ? [MUTED] : Array.isArray(given) ? given : [given];
  const { edge } = bands[0];
  const parted = bands.length > 1;
  return (
    <svg
      width={Math.round((size * HEX_W) / HEX_H)}
      height={size}
      viewBox={`0 0 ${HEX_W} ${HEX_H}`}
      role="img"
      aria-hidden
      // A crest is a mark, not a control: keep the arrow rather than the text
      // caret an inline SVG would otherwise inherit. Unless it IS a control:
      // the rank, streamer and tournament crests are wrapped in a link, and the
      // cursor set here would otherwise win over the anchor's own, leaving a
      // clickable crest showing an arrow.
      className={cn(
        "inline-block shrink-0 cursor-default align-middle [a_&]:cursor-pointer",
        className,
      )}
      style={{ filter: "drop-shadow(0 1px 1.5px rgba(0,0,0,.28))" }}
    >
      <defs>
        {bands.map((b, i) => (
          <linearGradient
            key={i}
            id={`${gradientId}-${i}`}
            x1="0"
            y1="0"
            x2="0"
            // Divided, the ramp is pinned to the shield rather than to each
            // wedge's own box, or every wedge would run its whole light-to-dark
            // range inside itself and the crest would lose one shared relief for
            // a ring of unrelated ones.
            y2={parted ? HEX_H : 1}
            gradientUnits={parted ? "userSpaceOnUse" : undefined}
          >
            <stop offset="0" stopColor={b.fill} />
            <stop offset="1" stopColor={b.edge} />
          </linearGradient>
        ))}
        <clipPath id={`${gradientId}-clip`}>
          <path d={HEX} />
        </clipPath>
      </defs>
      {parted && (
        <g clipPath={`url(#${gradientId}-clip)`}>
          {bands.map((_, i) => (
            <path
              key={i}
              d={gyron(i, bands.length)}
              fill={`url(#${gradientId}-${i})`}
              // A hairline of the rim colour along each division, so two
              // neighbouring wedges stay separate even when their hues are
              // close (the verified blue against the Onslaught blue).
              stroke="rgba(0,0,0,.28)"
              strokeWidth="1.5"
            />
          ))}
        </g>
      )}
      <path
        d={HEX}
        fill={parted ? "none" : `url(#${gradientId}-0)`}
        // One dark rim rather than each band's own edge: the outline has to
        // read as a single shield, and a rim changing colour along the way
        // would look like several crests overlapping.
        stroke={parted ? "rgba(0,0,0,.38)" : edge}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Top-edge highlight for the struck-metal crest feel. */}
      <path d="M26 3 H74" stroke="rgba(255,255,255,.35)" strokeWidth="3" fill="none" />
      {charge ?? (kind ? CHARGE[kind] : null)}
    </svg>
  );
}
