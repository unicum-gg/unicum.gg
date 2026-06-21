import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/json-ld";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
  PanelTitle,
} from "@/components/panel";
import APP from "@/constants/app";
import {
  getGlossaryMetric,
  glossaryMetricSlugs,
  GLOSSARY_METRICS,
} from "@/constants/glossary";
import ROUTES from "@/constants/routes";
import { constructMetadata } from "@/lib/metadata";
import {
  breadcrumbSchema,
  definedTermSchema,
  faqPageSchema,
} from "@/lib/schema-org";
import { styles } from "@/lib/styles";
import { cn } from "@/lib/utils";
import { Region } from "@/services/wargaming/wot";

export function generateStaticParams() {
  return glossaryMetricSlugs().map((metric) => ({ metric }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ metric: string }>;
}): Promise<Metadata> {
  const { metric } = await params;
  const def = getGlossaryMetric(metric);
  if (!def) return {};
  return constructMetadata({
    title: `What is ${def.shortName} in World of Tanks?`,
    description: def.summary,
    ogTitle: def.shortName,
    ogSubtitle: "World of Tanks rating explained",
    canonical: ROUTES.GLOSSARY_METRIC(def.slug),
  });
}

export default async function Page({
  params,
}: {
  params: Promise<{ metric: string }>;
}) {
  const { metric } = await params;
  const def = getGlossaryMetric(metric);
  if (!def) notFound();

  const related = def.relatedSlugs
    .map((slug) => GLOSSARY_METRICS.find((m) => m.slug === slug))
    .filter((m): m is (typeof GLOSSARY_METRICS)[number] => m != null);

  return (
    <div className="mx-auto w-full max-w-7xl">
      <JsonLd
        data={definedTermSchema({
          name: `${def.shortName} (World of Tanks)`,
          description: def.summary,
          url: ROUTES.GLOSSARY_METRIC(def.slug),
        })}
      />
      <JsonLd data={faqPageSchema(def.faq)} />
      <JsonLd
        data={breadcrumbSchema([
          { name: APP.NAME, path: "/" },
          { name: "Glossary", path: ROUTES.GLOSSARY },
          { name: def.shortName, path: ROUTES.GLOSSARY_METRIC(def.slug) },
        ])}
      />

      <Panel>
        <PanelContent className="px-4 py-12 text-center">
          <div className="mb-2 text-sm uppercase tracking-wide text-fd-muted-foreground">
            <Link href={ROUTES.GLOSSARY} className={styles.linkHover}>
              Metric glossary
            </Link>
          </div>
          <h1 className="font-heading text-4xl font-bold tracking-tight md:text-5xl">
            What is <span className="text-[#f25322]">{def.shortName}</span>?
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-fd-muted-foreground">
            {def.tagline}
          </p>
        </PanelContent>
      </Panel>

      <PanelSeparator />

      <Panel>
        <PanelHeader>
          <PanelTitle>What it measures</PanelTitle>
        </PanelHeader>
        <PanelContent>
          <p className="max-w-3xl text-fd-muted-foreground">
            {def.whatItMeasures}
          </p>
        </PanelContent>
      </Panel>

      <PanelSeparator />

      <Panel>
        <PanelHeader>
          <PanelTitle>How it is calculated</PanelTitle>
        </PanelHeader>
        <PanelContent>
          <p className="max-w-3xl text-fd-muted-foreground">
            {def.howItIsComputed}
          </p>
        </PanelContent>
      </Panel>

      <PanelSeparator />

      <Panel>
        <PanelHeader>
          <PanelTitle>In depth</PanelTitle>
        </PanelHeader>
        <PanelContent>
          <div className="max-w-3xl space-y-4 text-fd-muted-foreground">
            {def.body.map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
          </div>
        </PanelContent>
      </Panel>

      <PanelSeparator />

      <Panel>
        <PanelHeader>
          <PanelTitle>Frequently asked questions</PanelTitle>
        </PanelHeader>
        <PanelContent>
          <div className="max-w-3xl divide-y divide-fd-border">
            {def.faq.map((item) => (
              <div key={item.question} className="py-4 first:pt-0 last:pb-0">
                <h3 className="font-semibold">{item.question}</h3>
                <p className="mt-2 text-fd-muted-foreground">{item.answer}</p>
              </div>
            ))}
          </div>
        </PanelContent>
      </Panel>

      <PanelSeparator />

      <Panel>
        <PanelHeader>
          <PanelTitle>Related metrics</PanelTitle>
        </PanelHeader>
        <PanelContent>
          <div className="grid gap-4 sm:grid-cols-3">
            {related.map((m) => (
              <Link
                key={m.slug}
                href={ROUTES.GLOSSARY_METRIC(m.slug)}
                className={cn(
                  styles.cardBorder,
                  "group block rounded-lg p-4 transition-colors hover:border-[#f25322]/50",
                )}
              >
                <span className="font-semibold group-hover:text-[#f25322]">
                  {m.shortName}
                </span>
                <p className="mt-1 text-sm text-fd-muted-foreground">
                  {m.tagline}
                </p>
              </Link>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-4 text-sm">
            <Link href={ROUTES.TOP(Region.EU)} className={styles.linkHover}>
              Leaderboards
            </Link>
            <Link href={ROUTES.PLAYERS(Region.EU)} className={styles.linkHover}>
              Top players
            </Link>
            <Link href={ROUTES.CLANS(Region.EU)} className={styles.linkHover}>
              Top clans
            </Link>
          </div>
        </PanelContent>
      </Panel>
    </div>
  );
}

export const dynamic = "force-static";
