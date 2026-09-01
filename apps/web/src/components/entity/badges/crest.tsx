import { useId, type ReactNode } from "react";
import { BRAND_COLOR } from "@unicum.gg/shared";
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
}

// Flat-top regular hexagon in a 100×86.6 box: flat top/bottom edges (x 25–75),
// points at left/right (y 43.3).
const HEX = "M25 1.5 L75 1.5 L99 43.3 L75 85.1 L25 85.1 L1 43.3 Z";
const HEX_W = 100;
const HEX_H = 86.6;

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

type Tincture = { fill: string; edge: string };

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
  | { kind?: never; tincture: Tincture; charge: ReactNode }
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
  const { fill, edge } = muted
    ? MUTED
    : (tincture ?? TINCTURE[kind as CrestKind]);
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
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={fill} />
          <stop offset="1" stopColor={edge} />
        </linearGradient>
      </defs>
      <path
        d={HEX}
        fill={`url(#${gradientId})`}
        stroke={edge}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Top-edge highlight for the struck-metal crest feel. */}
      <path d="M26 3 H74" stroke="rgba(255,255,255,.35)" strokeWidth="3" fill="none" />
      {charge ?? (kind ? CHARGE[kind] : null)}
    </svg>
  );
}
