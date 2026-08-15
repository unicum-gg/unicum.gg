import Image from "next/image";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { styles } from "@/lib/styles";
import { cn } from "@/lib/utils";
import {
  ONSLAUGHT_TIER_COLOR,
  ONSLAUGHT_TIER_LABEL,
  onslaughtRankIcon,
  OnslaughtTier,
  RATING_COLOR_CLASS,
} from "@unicum.gg/shared";

// The two ranks the game admits to the leaderboard, top first. Wording follows
// the client: only Champion and Legend enter the leaderboard, and Legend is its
// elite top slice.
const TIERS: { tier: OnslaughtTier; blurb: string }[] = [
  {
    tier: OnslaughtTier.Legend,
    blurb:
      "The highest-rated Champions. The game caps it at a set leaderboard position each season (so its size varies by season and region), not a fixed points target. Slip below the last Legend and you drop back to Champion.",
  },
  {
    tier: OnslaughtTier.Champion,
    blurb:
      "The highest rank you can climb to on Rating Points, and the entry to the leaderboard. Every ranked player is at least Champion.",
  },
];

export function OnslaughtRankScale({
  seasonOrdinal,
  assetsRef,
}: {
  seasonOrdinal: string | null;
  assetsRef: string | null;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className={cn("p-4", styles.mutedDescription)}>
        You climb Onslaught&apos;s ranks by winning battles: every victory
        awards Rating Points based on how well you played. Champion is the
        highest rank you can reach on points alone, and reaching it puts you on
        the leaderboard. Legend isn&apos;t a fixed threshold: it&apos;s the
        top-rated slice of Champions, so its cutoff shifts with the field (ties
        broken by battles played). The exact Legend and Champion cutoffs come
        from the current season and are marked on the board.
      </div>
      <div className="mt-auto">
        <Table className="mb-px! [&_td]:min-w-0! [&_th]:min-w-0! [&_tr]:h-11">
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4!">Tier</TableHead>
              <TableHead className="pr-4">Meaning</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {TIERS.map(({ tier, blurb }) => (
              <TableRow key={tier}>
                <TableCell className="pl-4!">
                  <span className="inline-flex items-center gap-2">
                    <Image
                      src={onslaughtRankIcon(tier, seasonOrdinal, assetsRef)}
                      alt=""
                      width={24}
                      height={24}
                      className="h-6 w-6 shrink-0"
                    />
                    <span
                      className={cn(
                        "rounded px-2 py-0.5 text-xs font-semibold",
                        RATING_COLOR_CLASS[ONSLAUGHT_TIER_COLOR[tier]],
                      )}
                    >
                      {ONSLAUGHT_TIER_LABEL[tier]}
                    </span>
                  </span>
                </TableCell>
                <TableCell className="pr-4 text-muted-foreground">
                  {blurb}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
