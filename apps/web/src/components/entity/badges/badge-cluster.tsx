import type { ReactNode } from "react";
import Link from "next/link";
import { Crest, type Tincture } from "@/components/entity/badges/crest";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * One crest in a cluster, plus what the fold needs to speak for it.
 *
 * `node` is the rendered crest, `label` is what the "+N" tooltip says in its
 * place, and `href` makes that line a link where the crest itself was one.
 * A folded badge must stay reachable, or the fold would be hiding rather than
 * stacking.
 *
 * `crest` is the same device drawn BARE, for the tooltip's own rows. It cannot
 * reuse `node`: every badge wraps its crest in a tooltip of its own, and a
 * tooltip inside a tooltip neither positions nor dismisses correctly. Drawing
 * the bare crest is what the badges page does for the same reason.
 */
export type ClusterBadge = {
  key: string;
  node: ReactNode;
  /** The bare crest, no tooltip and no link, shown beside the label. */
  crest: ReactNode;
  /** The badge's own colour, so the "+N" can wear a band of it. */
  tint: Tincture;
  label: ReactNode;
  href?: string;
};

/** How many crests a cluster shows before folding, the "+N" counted. */
export const BADGE_CLUSTER_MAX = 3;

// Slate, used only when the "+N" has no colours to show: it is a count, not an
// honour of its own. With badges behind it, it wears THEIR colours instead (see
// `OverflowCrest`), which is the whole point of folding rather than hiding.
const OVERFLOW_TINCTURE: Tincture = { fill: "#8b8b8b", edge: "#5f5f5f" };

/**
 * The "+N" charge, typeset rather than drawn.
 *
 * `<text>` in an icon usually inherits whatever font the page has, so the stack
 * is pinned here, and `textLength` locks the advance width so a two-character
 * label cannot spill past the hexagon's flat edges whatever font is resolved.
 */
function CountCharge({ label }: { label: string }) {
  const twoChar = label.length >= 2;
  return (
    <text
      x="50"
      y="43.3"
      textAnchor="middle"
      dominantBaseline="central"
      fill="#fff"
      // Outlined, because the count now sits on the folded badges' own colours
      // rather than on flat slate, and white on gold read as barely there. The
      // stroke is painted UNDER the glyph so it thickens the letterform from
      // outside instead of eating into it.
      stroke="rgba(0,0,0,.45)"
      strokeWidth="4"
      paintOrder="stroke"
      fontFamily="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
      fontSize={twoChar ? 42 : 54}
      fontWeight="700"
      textLength={twoChar ? 46 : undefined}
      lengthAdjust="spacingAndGlyphs"
    >
      {label}
    </text>
  );
}

/**
 * A slate "+N" crest standing in for the badges past the cap, with a tooltip
 * that spells them out so nothing is hidden, only folded.
 *
 * Not itself a link: it stands for several badges at once, so there is no one
 * place to send to. The tooltip stays open while the pointer is over it
 * (`disableHoverableContent={false}`) precisely because its rows are the only
 * way to reach what was folded.
 */
export function OverflowCrest({
  hidden,
  size,
}: {
  hidden: ClusterBadge[];
  size: number;
}) {
  return (
    <TooltipProvider>
      <Tooltip disableHoverableContent={false}>
        <TooltipTrigger asChild>
          <span
            className="inline-flex shrink-0 cursor-default"
            aria-label={`${hidden.length} more badges`}
          >
            <Crest
              tincture={
                hidden.length > 0 ? hidden.map((b) => b.tint) : OVERFLOW_TINCTURE
              }
              size={size}
              charge={<CountCharge label={`+${hidden.length}`} />}
            />
          </span>
        </TooltipTrigger>
        <TooltipContent>
          {/* Each folded badge is named AND drawn: the crest is what the reader
              is being asked to recognise, and a list of names alone would make
              them work out which colour went with which line. */}
          <span className="flex flex-col gap-1">
            {hidden.map((b) => {
              const row = (
                <>
                  <span className="inline-flex shrink-0">{b.crest}</span>
                  <span>{b.label}</span>
                </>
              );
              return b.href ? (
                <Link
                  key={b.key}
                  href={b.href}
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1.5 hover:underline"
                >
                  {row}
                </Link>
              ) : (
                <span key={b.key} className="flex items-center gap-1.5">
                  {row}
                </span>
              );
            })}
          </span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Render a cluster of crests, folding everything past `max` into one "+N".
 *
 * The cap is what keeps a name readable: crests sit inline after a nickname or
 * a tag, in table rows that are already tight, and a player who has earned five
 * of them would otherwise push the name out of its column. So the cluster is
 * never wider than `max`, whatever it holds.
 *
 * `max` counts the "+N" itself, so overflowing leaves `max - 1` real crests
 * beside it (5 badges at max 3 gives 2 crests and a "+3"). Callers pass their
 * badges already ordered, best first, because that order is what decides which
 * ones survive the fold.
 */
export function BadgeCluster({
  badges,
  size = 16,
  max = BADGE_CLUSTER_MAX,
}: {
  badges: ClusterBadge[];
  size?: number;
  max?: number;
}) {
  const fold = badges.length > max;
  const shown = fold ? badges.slice(0, max - 1) : badges;
  const hidden = fold ? badges.slice(max - 1) : [];
  return (
    <>
      {shown.map((b) => (
        <span key={b.key} className="contents">
          {b.node}
        </span>
      ))}
      {hidden.length > 0 && <OverflowCrest hidden={hidden} size={size} />}
    </>
  );
}
