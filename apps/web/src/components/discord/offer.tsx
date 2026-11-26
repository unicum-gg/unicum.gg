"use client";

import { DiscordLogoIcon } from "@phosphor-icons/react";
import type { Region } from "@unicum.gg/wargaming";
import { buttonVariants } from "fumadocs-ui/components/ui/button";
import { PanelContent } from "@/components/panel";
import { CtaCard } from "@/components/cta-card";
import Link from "@/components/link";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { useHydrated } from "@/hooks/use-hydrated";
import { usePathname } from "@/hooks/use-pathname";
import { useTranslation } from "@/hooks/use-translation";
import { localizePath } from "@/lib/translations";
import { DiscordMessagePreview } from "./message-preview";
import { DiscordOfferKind } from "./offer-kind";

/**
 * The Discord offer at the foot of a vehicle or a player page, the pages
 * readers actually land on, shaped like the mod's battles offer: a faded
 * picture of what the server posts, and the card asking them in on top of it.
 *
 * The picture is drawn only once hydrated, so it never reaches the HTML a
 * crawler or the `.md` twin reads. On a vehicle it is an example and says so:
 * its numbers are invented, so it is never captioned as this vehicle's
 * changes. On a player it is the real answer, the `/player` reply for the
 * player being read, built from the figures the page already shows.
 *
 * Three asks. On a vehicle: hear about its next buff or nerf. On someone
 * else's profile: the same lookups, in Discord. On the reader's own profile
 * with no Discord linked: be named after this account on our server, which no
 * other page can offer. Once linked there is nothing left to ask, so that
 * reader sees nothing, and nothing either while the answer loads, rather than
 * an offer that vanishes a second later.
 */

/** The player's own figures, for the `/player` reply in the preview. */
export type DiscordOfferFigures = {
  /** The rating the reader picked (its WN fallback), as the bot would show. */
  ratingLabel: string;
  total: { battles: number; winRate: number | null; rating: number | null };
  d30: { battles: number; winRate: number | null; rating: number | null } | null;
};

const int = (n: number | null) =>
  n === null ? "-" : Math.round(n).toLocaleString("en-US");
const pct = (n: number | null) => (n === null ? "-" : `${(n * 100).toFixed(1)}%`);

/** The bot's own table shape: a label column, then Total and 30d. */
function figureLines(f: DiscordOfferFigures): { text: string }[] {
  const rows: [string, string, string][] = [
    ["", "Total", "30d"],
    ["Battles", int(f.total.battles), f.d30 ? int(f.d30.battles) : "-"],
    ["Win rate", pct(f.total.winRate), f.d30 ? pct(f.d30.winRate) : "-"],
    [f.ratingLabel, int(f.total.rating), f.d30 ? int(f.d30.rating) : "-"],
  ];
  const w = [10, 9, 8];
  return rows.map(([a, b, c]) => ({
    text: `${a.padEnd(w[0]!)}${b.padStart(w[1]!)}${c.padStart(w[2]!)}`,
  }));
}

export function DiscordOffer({
  kind,
  name,
  region,
  figures,
}: {
  kind: DiscordOfferKind;
  /** The vehicle's name, or the player's nickname. */
  name: string;
  region: Region;
  /** On a player page: their real figures, so the preview answers for the
   * player being read rather than for an invented one. */
  figures?: DiscordOfferFigures;
}) {
  const { t, locale } = useTranslation("components/discord/offer");
  const hydrated = useHydrated();
  const back = localizePath(usePathname(), locale);
  const tag = `${name} [${region.toUpperCase()}]`;

  const preview =
    kind === DiscordOfferKind.Tank ? (
      <DiscordMessagePreview
        color="#22c55e"
        title={t("preview.tank-title")}
        description={t("preview.tank-description")}
        blockTitle={`🟡 ${name}`}
        block={[
          { sign: "+", text: "Reload              10.2 → 9.8 s" },
          { sign: "+", text: "Aiming time          2.3 → 2.1 s" },
          { sign: "-", text: "Hull armor · front   150 → 140 mm" },
        ]}
      />
    ) : (
      <DiscordMessagePreview
        invocation={t("preview.invocation", { name })}
        color="#f25322"
        title={tag}
        block={
          figures
            ? figureLines(figures)
            : [{ text: "Battles · Win rate · Rating" }]
        }
      />
    );

  return (
    <PanelContent className="p-0">
      <div className="relative h-56 overflow-hidden">
        {hydrated ? (
          <div
            inert
            aria-hidden
            className="pointer-events-none select-none opacity-75 [mask-image:linear-gradient(to_bottom,black_55%,transparent)]"
          >
            {preview}
          </div>
        ) : null}
        {kind === DiscordOfferKind.Tank ? (
          <span className="bg-fd-background/90 text-fd-muted-foreground absolute top-4 right-4 rounded-md px-2 py-0.5 text-xs font-medium sm:right-8">
            {t("example")}
          </span>
        ) : null}
      </div>
      <div className="relative -mt-14 px-4 pb-4">
        <CtaCard
          className="bg-fd-background/90 backdrop-blur-sm"
          heading={t(`${kind}.heading`, { tank: name, name: tag })}
          description={t(`${kind}.description`, { tank: name })}
        >
          {kind === DiscordOfferKind.OwnProfile ? (
            // A plain anchor: the route hands off to Discord's OAuth, and
            // `return` is narrowed to a same-origin path server-side.
            <a
              href={`/api/link/discord?return=${encodeURIComponent(back)}`}
              className={buttonVariants({ variant: "primary" })}
            >
              <DiscordLogoIcon weight="fill" className="mr-2 size-4" />
              {t("link")}
            </a>
          ) : (
            <a
              href={APP.EXTERNAL.DISCORD}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "primary" })}
            >
              <DiscordLogoIcon weight="fill" className="mr-2 size-4" />
              {t("join")}
            </a>
          )}
          <Link href={ROUTES.BOT} className={buttonVariants({ color: "secondary" })}>
            {t("add-bot")}
          </Link>
        </CtaCard>
      </div>
    </PanelContent>
  );
}
