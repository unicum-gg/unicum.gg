import type { Metadata } from "next";
import Image from "next/image";
import type { SoftwareApplication, WithContext } from "schema-dts";
import {
  ChartBarIcon,
  DiscordLogoIcon,
  JeepIcon,
  LightningIcon,
  MapPinIcon,
  ShareNetworkIcon,
  ShieldIcon,
} from "@phosphor-icons/react/dist/ssr";
import { buttonVariants } from "fumadocs-ui/components/ui/button";
import { JsonLd } from "@/components/json-ld";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
  PanelTitle,
} from "@/components/panel";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { DiscordInstallStatus } from "@/services/discord";
import { unicumPublic } from "@/services/sdk";
import { constructMetadata } from "@/lib/metadata";
import { Interpolate } from "@/components/interpolate";
import { getTranslation } from "@/lib/translations.server";
import { ogImagePath } from "@/lib/og-image";
import { breadcrumbSchema } from "@/lib/schema-org";
import { styles } from "@/lib/styles";
import { cn } from "@/lib/utils";


export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;

  const { t } = await getTranslation("app/bot/page", locale);
  return constructMetadata({
    locale,
    title: t("title"),
    description: t("description", { name: APP.NAME }),
    ogTitle: t("og-title"),
    ogSubtitle: "/player · /clan · /tank · /maps",
    canonical: ROUTES.BOT,
  });
}

function softwareSchema(description: string): WithContext<SoftwareApplication> {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: `${APP.NAME} Discord bot`,
    applicationCategory: "GameApplication",
    operatingSystem: "Discord",
    url: `${APP.URL}${ROUTES.BOT}`,
    description,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    author: { "@type": "Organization", name: APP.NAME, url: APP.URL },
  };
}

const COMMANDS = [
  {
    name: "/player",
    Icon: ChartBarIcon,
    summary: "player-stats",
    description:
      "any-player-s-overall-stats-battles-winrate-a",
  },
  {
    name: "/clan",
    Icon: ShieldIcon,
    summary: "clan-stats",
    description:
      "a-clan-s-battle-weighted-member-ratings-plus",
  },
  {
    name: "/tank",
    Icon: JeepIcon,
    summary: "tank-stats",
    description:
      "a-vehicle-s-server-average-performance-acros",
  },
  {
    name: "/maps",
    Icon: MapPinIcon,
    summary: "battle-maps",
    description:
      "a-battle-map-s-size-timer-team-size-and-game",
  },
];

const FEATURES = [
  {
    Icon: LightningIcon,
    title: "any-player-instantly",
    text: "autocomplete-over-tracked-players-and-a-firs",
  },
  {
    Icon: ChartBarIcon,
    title: "the-same-data-as-the-site",
    text: "wn7-wn8-and-wnx-computed-exactly-like-unicum",
  },
  {
    Icon: ShareNetworkIcon,
    title: "private-then-shareable",
    text: "replies-are-ephemeral-by-default-one-click-s",
  },
];

// A real, tracked EU player. The mockup is the exact reply the bot posts: the
// full aligned stat table (the embed description, generated verbatim from the
// same formatter as `apps/bot/.../lib/stats-lines.ts`) plus the player's OG
// card (the embed image). `Animal` is populated, so both are real and match.
const EXAMPLE_PLAYER = "Animal";
// One fixed card, so it goes through the optimizer like every other image on
// the site: the resized copy is cached once, for everyone. As a path, since
// `next/image` reads an absolute URL as a remote host (see `ogImagePath`).
const EXAMPLE_OG_PATH = ogImagePath(
  unicumPublic.og.eu.players(EXAMPLE_PLAYER).url(),
);
const EXAMPLE_TABLE = `Battles                  27,655
Tier                       9.35
Wins                     18,794  67.96%
Losses                    8,521  30.81%
Draws                       340  1.23%
Battles survived         10,319  37.31%
Tanks destroyed          47,610  1.72
Destruction ratio          2.75
Tanks spotted            50,432  1.82
Damages                4,226.92
Track damages             93.72
Spotting damages         588.18
Assisting damages        681.91
Combined damages       4,908.54
Base capture              6,743  0.24
Base defense             16,298  0.59
Experience             1,375.11
Hit rate                 81.44%
Personal rating          12,745
World of Tanks Rating    12,317
WN7                    2,520.75
WN8                    5,004.95
WNX                    5,599.32`;

// Post-install redirect (`?discord=`).
const STATUS: Record<
  DiscordInstallStatus,
  { tone: "ok" | "error"; text: string }
> = {
  [DiscordInstallStatus.Joined]: {
    tone: "ok",
    text: "bot-installed-and-you-ve-joined-our-discord-",
  },
  [DiscordInstallStatus.Installed]: {
    tone: "ok",
    text: "bot-installed-type-player-in-your-server-to-",
  },
  [DiscordInstallStatus.Error]: {
    tone: "error",
    text: "something-went-wrong-with-the-install-please",
  },
};

export default async function BotPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ discord?: string }>;
}) {
  const { locale } = await params;
  const { t } = await getTranslation("app/bot/page", locale);
  const { discord } = await searchParams;
  const status = discord ? STATUS[discord as DiscordInstallStatus] : undefined;

  return (
    <div className="mx-auto w-full max-w-7xl">
      <JsonLd data={softwareSchema(t("description", { name: APP.NAME }))} />
      <JsonLd
        data={breadcrumbSchema([
          { name: APP.NAME, url: APP.URL },
          { name: "Discord bot", url: `${APP.URL}${ROUTES.BOT}` },
        ])}
      />

      {/* Hero — same treatment as the site's other landing heroes (coverage,
          etc.): eyebrow, big heading with orange keyword spans, muted subline. */}
      <Panel>
        <PanelContent className="px-4 py-12 text-center sm:py-16">
          <div className="mb-2 inline-flex items-center gap-1.5 text-sm uppercase tracking-wide text-fd-muted-foreground">
            <DiscordLogoIcon weight="fill" className="size-4 text-[#5865F2]" />
            {t("eyebrow")}
          </div>
          <h1 className="mx-auto max-w-4xl font-heading text-4xl font-bold tracking-tight text-balance md:text-5xl">
            <Interpolate
              template={t("hero")}
              values={{
                player: <span className="text-fd-primary">/player</span>,
                clan: <span className="text-fd-primary">/clan</span>,
                tank: <span className="text-fd-primary">/tank</span>,
                maps: <span className="text-fd-primary">/maps</span>,
              }}
            />
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-fd-muted-foreground">
            {t("add-the-bot-to-your", { NAME: APP.NAME })}</p>

          {status ? (
            <p
              role={status.tone === "error" ? "alert" : "status"}
              className={cn(
                "mx-auto mt-6 max-w-xl rounded-md border px-4 py-2 text-sm",
                status.tone === "ok"
                  ? "border-fd-border bg-fd-secondary text-fd-foreground"
                  : "border-red-500/40 bg-red-500/10 text-red-500",
              )}
            >
              {t(status.text)}
            </p>
          ) : null}

          <div className="mt-6 flex flex-col items-center gap-2">
            {/* The one-click OAuth install endpoint (adds the bot + joins our
                server): an API route that 307s to Discord, so a plain full-page
                <a> is required — `next/link` would client-navigate a non-page. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/api/discord/install"
              className={cn(
                buttonVariants({ variant: "primary" }),
                "h-10 gap-2 px-5 text-base",
              )}
            >
              <DiscordLogoIcon weight="fill" className="size-5" />
              {t("add-to-discord")}
            </a>
            <p className="text-xs text-fd-muted-foreground">
              <Interpolate
                template={t("one-click-adds")}
                values={{
                  discord: (
                    <a
                      href={APP.EXTERNAL.DISCORD}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline-offset-2 hover:underline"
                    >
                      {t("discord")}
                    </a>
                  ),
                }}
              />
            </p>
          </div>
        </PanelContent>
      </Panel>

      <PanelSeparator />

      {/* Commands */}
      <Panel>
        <PanelHeader>
          <PanelTitle>{t("commands")}</PanelTitle>
        </PanelHeader>
        <PanelContent className="grid gap-px p-0 sm:grid-cols-3">
          {COMMANDS.map(({ name, Icon, summary, description }) => (
            <section
              key={name}
              className="flex flex-col items-start gap-3 p-6 text-left"
            >
              <Icon weight="duotone" className="size-8 text-fd-primary" />
              <div className="flex items-baseline gap-2">
                <code className="font-mono text-lg font-semibold">{name}</code>
                <span className="text-xs text-fd-muted-foreground">
                  {t(summary)}
                </span>
              </div>
              <p className={styles.mutedDescription}>{t(description)}</p>
            </section>
          ))}
        </PanelContent>
      </Panel>

      <PanelSeparator />

      {/* Example output — the exact reply the bot posts */}
      <Panel>
        <PanelHeader>
          <PanelTitle>{t("see-it-in-action")}</PanelTitle>
        </PanelHeader>
        <PanelContent className="grid items-start gap-8 md:grid-cols-2">
          <div className="space-y-3 md:pt-4">
            <h3 className="text-lg font-semibold">
              <Interpolate
                template={t("a-player-reply")}
                values={{
                  command: <code className="font-mono">/player</code>,
                }}
              />
            </h3>
            <p className={styles.mutedDescription}>
              {t("the-full-stats-table-ranked")}</p>
          </div>
          {/* Discord-style embed: the aligned stat table, then the OG card. */}
          <div className="rounded-md bg-[#2b2d31] p-3 text-white shadow-lg">
            <div className="rounded-e-sm border-s-4 border-[#5A3175] bg-[#313338] p-3">
              <div className="text-sm font-semibold text-[#00a8fc]">
                {EXAMPLE_PLAYER}
              </div>
              <pre className="mt-2 overflow-x-auto rounded bg-[#1e1f22] p-3 font-mono text-[11px] leading-relaxed text-[#dbdee1]">
                {EXAMPLE_TABLE}
              </pre>
              <Image
                src={EXAMPLE_OG_PATH}
                alt={t("example-unicum-gg-world-of")}
                width={1200}
                height={630}
                className="mt-2 aspect-40/21 w-full rounded object-cover"
              />
              <div className="mt-2 text-[11px] text-[#949ba4]">
                {APP.NAME} · EU
              </div>
            </div>
          </div>
        </PanelContent>
      </Panel>

      <PanelSeparator />

      {/* Why */}
      <Panel>
        <PanelContent className="grid gap-px p-0 sm:grid-cols-3">
          {FEATURES.map(({ Icon, title, text }) => (
            <div key={title} className="flex flex-col gap-2 p-6">
              <Icon weight="duotone" className="size-6 text-fd-primary" />
              <h3 className="font-semibold">{t(title)}</h3>
              <p className={styles.mutedDescription}>{t(text)}</p>
            </div>
          ))}
        </PanelContent>
      </Panel>
    </div>
  );
}
