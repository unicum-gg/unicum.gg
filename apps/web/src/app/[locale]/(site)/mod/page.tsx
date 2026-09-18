import type { Metadata } from "next";
import Image from "next/image";
import type { SoftwareApplication, WithContext } from "schema-dts";
import {
  CrosshairIcon,
  DownloadSimpleIcon,
  GithubLogoIcon,
  PuzzlePieceIcon,
  TrophyIcon,
  TwitchLogoIcon,
  WarehouseIcon,
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
import { constructMetadata } from "@/lib/metadata";
import { getTranslation } from "@/lib/translations.server";
import { breadcrumbSchema, faqSchema } from "@/lib/schema-org";
import { styles } from "@/lib/styles";
import { cn } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;

  const { t } = await getTranslation("app/mod/page", locale);
  return constructMetadata({
    locale,
    title: t("title"),
    description: t("description", { name: APP.NAME }),
    ogTitle: t("og-title"),
    ogSubtitle: t("og-subtitle"),
    canonical: ROUTES.MOD,
  });
}

function softwareSchema(description: string): WithContext<SoftwareApplication> {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: `${APP.NAME} mod`,
    applicationCategory: "GameApplication",
    operatingSystem: "Windows",
    url: `${APP.URL}${ROUTES.MOD}`,
    downloadUrl: APP.EXTERNAL.MOD_DOWNLOAD,
    description,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    author: { "@type": "Organization", name: APP.NAME, url: APP.URL },
  };
}

const FEATURES = [
  { Icon: CrosshairIcon, title: "in-battle", text: "in-battle-text" },
  { Icon: TrophyIcon, title: "battle-results", text: "battle-results-text" },
  { Icon: WarehouseIcon, title: "in-the-garage", text: "in-the-garage-text" },
  { Icon: TwitchLogoIcon, title: "twitch", text: "twitch-text" },
];

// The listing's own visuals (tools/visuals in the mod repository). The garage
// is a capture of the client, so it leads; the battle screens are drawn from
// the mod's badges, flags and styles, with invented players. Each caption is
// also the image's alt text.
const SCREENSHOTS = [
  { src: "/mod/1-garage.jpg", caption: "screenshot-garage" },
  { src: "/mod/3-battle-players.jpg", caption: "screenshot-battle-players" },
  { src: "/mod/4-battle-markers.jpg", caption: "screenshot-battle-markers" },
  { src: "/mod/5-battle-twitch-chat.jpg", caption: "screenshot-twitch-chat" },
  { src: "/mod/2-garage-cards.jpg", caption: "screenshot-garage-cards" },
];

const FAQ = ["allowed", "ratings", "servers", "free", "hide"];

const INSTALL_STEPS = ["install-step-1", "install-step-2"];

const DATA = ["data-ratings", "data-linking", "data-twitch"];

export default async function ModPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const { t } = await getTranslation("app/mod/page", locale);
  const faq = FAQ.map((key) => ({
    key,
    question: t(`faq-${key}-question`, { name: APP.NAME }),
    answer: t(`faq-${key}-answer`, { name: APP.NAME }),
  }));

  return (
    <div className="mx-auto w-full max-w-7xl">
      <JsonLd data={softwareSchema(t("description", { name: APP.NAME }))} />
      <JsonLd data={faqSchema(faq)} />
      <JsonLd
        data={breadcrumbSchema([
          { name: APP.NAME, url: APP.URL },
          { name: t("eyebrow"), url: `${APP.URL}${ROUTES.MOD}` },
        ])}
      />

      <Panel>
        <PanelContent className="px-4 py-12 text-center sm:py-16">
          <div className="mb-2 inline-flex items-center gap-1.5 text-sm uppercase tracking-wide text-fd-muted-foreground">
            <PuzzlePieceIcon weight="fill" className="size-4 text-fd-primary" />
            {t("eyebrow")}
          </div>
          <h1 className="mx-auto max-w-4xl font-heading text-4xl font-bold tracking-tight text-balance md:text-5xl">
            {t("hero")}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-fd-muted-foreground">
            {t("subtitle", { name: APP.NAME })}
          </p>
          <div className="mt-6 flex flex-col items-center gap-2">
            <a
              href={APP.EXTERNAL.MOD_DOWNLOAD}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                buttonVariants({ variant: "primary" }),
                "h-10 gap-2 px-5 text-base",
              )}
            >
              <DownloadSimpleIcon weight="bold" className="size-5" />
              {t("download")}
            </a>
            <p className="text-xs text-fd-muted-foreground">
              {/* No version here: the page cannot keep one true. Wargaming
                  ships micropatches (2.4.0.1 a day after 2.4.0.0), and our own
                  API disagrees with itself on what the current one is -- tanks
                  say 2.4, maps say 2.4.0, the client says 2.4.0.1. The mod's
                  wgmods page names the exact build and is always current. */}
              {t("download-note")}
            </p>
          </div>
        </PanelContent>
      </Panel>

      <PanelSeparator />

      <Panel>
        <PanelHeader>
          <PanelTitle>{t("features")}</PanelTitle>
        </PanelHeader>
        <PanelContent className="grid gap-px p-0 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ Icon, title, text }) => (
            <section key={title} className="flex flex-col items-start gap-3 p-6 text-left">
              <Icon weight="duotone" className="size-8 text-fd-primary" />
              <h2 className="font-semibold">{t(title)}</h2>
              <p className={styles.mutedDescription}>{t(text)}</p>
            </section>
          ))}
        </PanelContent>
      </Panel>

      <PanelSeparator />

      <Panel>
        <PanelHeader>
          <PanelTitle>{t("see-it-in-action")}</PanelTitle>
        </PanelHeader>
        <PanelContent className="grid gap-6 md:grid-cols-2">
          {SCREENSHOTS.map(({ src, caption }, index) => (
            <figure key={src} className={cn("space-y-2", index === 0 && "md:col-span-2")}>
              <Image
                src={src}
                alt={t(caption)}
                width={1920}
                height={1080}
                sizes={index === 0 ? "100vw" : "(min-width: 768px) 50vw, 100vw"}
                priority={index === 0}
                className="aspect-video w-full rounded-md border border-fd-border object-cover"
              />
              <figcaption className={styles.mutedDescription}>{t(caption)}</figcaption>
            </figure>
          ))}
        </PanelContent>
      </Panel>

      <PanelSeparator />

      <Panel>
        <PanelContent className="grid gap-8 md:grid-cols-2">
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">{t("installation")}</h2>
            <ol className="list-decimal space-y-2 ps-5">
              {INSTALL_STEPS.map((step) => (
                <li key={step} className={styles.mutedDescription}>
                  {t(step)}
                </li>
              ))}
            </ol>
            <p className={styles.mutedDescription}>{t("install-included")}</p>
            <p className={styles.mutedDescription}>
              {t("install-optional")}:{" "}
              <a
                href={APP.EXTERNAL.MODS_SETTINGS_API}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-fd-foreground"
              >
                modsSettingsApi
              </a>{" "}
              {t("install-optional-settings")}
            </p>
          </section>
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">{t("what-it-sends")}</h2>
            <ul className="list-disc space-y-2 ps-5">
              {DATA.map((item) => (
                <li key={item} className={styles.mutedDescription}>
                  {t(item, { name: APP.NAME })}
                </li>
              ))}
            </ul>
            <a
              href={APP.EXTERNAL.MOD_SOURCE}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-fd-muted-foreground underline-offset-2 hover:underline"
            >
              <GithubLogoIcon className="size-4" />
              {t("source-code")}
            </a>
          </section>
        </PanelContent>
      </Panel>

      <PanelSeparator />

      <Panel>
        <PanelHeader>
          <PanelTitle>{t("faq")}</PanelTitle>
        </PanelHeader>
        <PanelContent className="grid gap-6 md:grid-cols-2">
          {faq.map(({ key, question, answer }) => (
            <section key={key} className="space-y-2">
              <h3 className="font-semibold">{question}</h3>
              <p className={styles.mutedDescription}>{answer}</p>
            </section>
          ))}
        </PanelContent>
      </Panel>
    </div>
  );
}
