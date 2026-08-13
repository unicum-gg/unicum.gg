import type { PlayerAchievement } from "@unicum.gg/shared";
import { Medal } from "@/components/players/detail/achievements/medal";
import { TooltipProvider } from "@/components/ui/tooltip";
import { styles } from "@/lib/styles";

const intFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

/**
 * The medals this player earned on this vehicle: the game's "Awards" tab.
 *
 * Server-rendered from the record's own payload, not fetched here. The medals
 * are stored per account (one row covering the whole garage), so they cost the
 * page a jsonb lookup rather than a Wargaming call, and the panel arrives whole
 * instead of filling in after it.
 *
 * Earned only, unlike the profile's cabinet which shows the catalogue greyed
 * out. "What is still missing" is a question about a player, not about one of
 * their tanks, and 505 tiles would bury the record above.
 */
export function TankAwards({ awards }: { awards: PlayerAchievement[] }) {
  return (
    <div>
      <h4 className="mb-1.5 text-sm font-semibold">
        Awards
        {awards.length > 0 ? ` (${intFmt.format(awards.length)})` : ""}
      </h4>
      {awards.length > 0 ? (
        // Each tile carries a Radix tooltip with the medal's name and how it is
        // earned, and Radix needs the provider above them; the profile's own
        // cabinet wraps its grid the same way.
        <TooltipProvider delayDuration={150}>
          <div className="flex flex-wrap gap-1">
            {awards.map((a) => (
              <Medal key={a.id} achievement={a} />
            ))}
          </div>
        </TooltipProvider>
      ) : (
        <p className={styles.mutedDescription}>
          No medal earned on this tank yet.
        </p>
      )}
    </div>
  );
}
