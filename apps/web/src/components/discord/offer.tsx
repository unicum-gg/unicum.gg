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
 * The picture is an example and says so, drawn only once hydrated, so its
 * invented numbers never reach the HTML a crawler or the `.md` twin reads as
 * this vehicle's or this player's.
 *
 * Three asks. On a vehicle: hear about its next buff or nerf. On someone
 * else's profile: the same lookups, in Discord. On the reader's own profile
 * with no Discord linked: be named after this account on our server, which no
 * other page can offer. Once linked there is nothing left to ask, so that
 * reader sees nothing, and nothing either while the answer loads, rather than
 * an offer that vanishes a second later.
 */

export function DiscordOffer({
  kind,
  name,
  region,
}: {
  kind: DiscordOfferKind;
  /** The vehicle's name, or the player's nickname. */
  name: string;
  region: Region;
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
        invocation={t("preview.invocation")}
        color="#f25322"
        title={kind === DiscordOfferKind.OwnProfile ? tag : "Koala [EU]"}
        block={[
          { text: "              Total    30d" },
          { text: "Battles      41,203    612" },
          { text: "Win rate     56.4%   58.1%" },
          { text: "WN8           2,412  2,780" },
        ]}
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
        <span className="bg-fd-background/90 text-fd-muted-foreground absolute top-4 right-4 rounded-md px-2 py-0.5 text-xs font-medium sm:right-8">
          {t("example")}
        </span>
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
