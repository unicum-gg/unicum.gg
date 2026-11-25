import { DiscordLogoIcon } from "@phosphor-icons/react/dist/ssr";
import APP from "@/constants/app";
import { Interpolate } from "@/components/interpolate";
import { getTranslation } from "@/lib/translations.server";
import { Button } from "@/components/ui/button";

/**
 * The invitation under a page of game changes: the same changes, posted to
 * Discord the day they land.
 *
 * Placed on the pages a reader opens to find out what a patch did, because
 * that is the one place the channel is not an interruption but the answer to
 * "how do I hear about the next one". Two asks: join and take the channel's
 * role, which pings the reader, and follow the channel from a clan's own
 * server, which is the one that grows: each follower is a server that shows
 * our cards, links back to the site included, on every patch.
 */

export enum ChangesFeed {
  Tanks = "tanks",
  Maps = "maps",
}

/** The channel and role names are Discord's, not prose, so they are filled in
 * rather than handed to the translator. */
const FEED = {
  [ChangesFeed.Tanks]: {
    channel: "#tank-changes",
    role: "Tank changes",
    href: APP.EXTERNAL.DISCORD_TANK_CHANGES,
  },
  [ChangesFeed.Maps]: {
    channel: "#map-changes",
    role: "Map changes",
    href: APP.EXTERNAL.DISCORD_MAP_CHANGES,
  },
} as const;

export async function ChangesDiscordBanner({
  feed,
  locale,
}: {
  feed: ChangesFeed;
  locale: string;
}) {
  const { t } = await getTranslation("components/discord/changes-banner", locale);
  const { channel, role, href } = FEED[feed];
  const name = (text: string) => (
    <span className="font-medium text-fd-foreground">{text}</span>
  );

  return (
    <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <DiscordLogoIcon
          weight="fill"
          className="mt-0.5 size-5 shrink-0 text-[#5865F2]"
        />
        <div className="space-y-1">
          <p className="text-sm font-medium">{t(`title.${feed}`)}</p>
          <p className="text-xs text-fd-muted-foreground">
            <Interpolate
              template={t("body")}
              values={{ channel: name(channel), role: name(role) }}
            />{" "}
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-fd-foreground"
            >
              <Interpolate template={t("follow")} values={{ channel }} />
            </a>
          </p>
        </div>
      </div>
      <Button size="sm" variant="secondary" className="self-start sm:self-center" asChild>
        <a href={APP.EXTERNAL.DISCORD} target="_blank" rel="noopener noreferrer">
          <DiscordLogoIcon className="size-4" />
          {t("join")}
        </a>
      </Button>
    </div>
  );
}
