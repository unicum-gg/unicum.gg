import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/json-ld";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
  PanelTitle,
} from "@/components/panel";
import APP from "@/constants/app";
import { GLOSSARY_METRICS } from "@/constants/glossary";
import ROUTES from "@/constants/routes";
import { constructMetadata } from "@/lib/metadata";
import {
  breadcrumbSchema,
  collectionPageSchema,
  itemListSchema,
} from "@/lib/schema-org";
import { styles } from "@/lib/styles";
import { cn } from "@/lib/utils";
import { Region } from "@/services/wargaming/wot";

export async function generateMetadata(): Promise<Metadata> {
  return constructMetadata({
    title: "World of Tanks rating glossary: WN8, WNX, WN7, Personal Rating",
    description: `What WN8, WNX, WN7 and Personal Rating mean in World of Tanks, how each is calculated, and how to read them. ${APP.NAME} metric glossary.`,
    ogTitle: "Rating glossary",
    ogSubtitle: "WN8 · WNX · WN7 · Personal Rating",
    canonical: ROUTES.GLOSSARY,
  });
}

export default function Page() {
  return (
    <div className="mx-auto w-full max-w-7xl">
      <JsonLd
        data={collectionPageSchema({
          name: "World of Tanks rating glossary",
          description:
            "Definitions of the World of Tanks rating metrics: WN8, WNX, WN7 and Personal Rating.",
          url: ROUTES.GLOSSARY,
        })}
      />
      <JsonLd
        data={breadcrumbSchema([
          { name: APP.NAME, path: "/" },
          { name: "Glossary", path: ROUTES.GLOSSARY },
        ])}
      />
      <JsonLd
        data={itemListSchema({
          name: "World of Tanks rating metrics",
          url: ROUTES.GLOSSARY,
          items: GLOSSARY_METRICS.map((m) => ({
            name: m.shortName,
            path: ROUTES.GLOSSARY_METRIC(m.slug),
          })),
        })}
      />

      <Panel>
        <PanelContent className="px-4 py-12 text-center">
          <div className="mb-2 text-sm uppercase tracking-wide text-fd-muted-foreground">
            Metric glossary
          </div>
          <h1 className="font-heading text-4xl font-bold tracking-tight md:text-5xl">
            World of Tanks <span className="text-[#f25322]">ratings</span>{" "}
            explained
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-fd-muted-foreground">
            Every player and clan profile on {APP.NAME} shows WN8, WNX, WN7 and
            Personal Rating. Here is what each one measures, how it is
            calculated and how to read the colours.
          </p>
        </PanelContent>
      </Panel>

      <PanelSeparator />

      <Panel>
        <PanelHeader>
          <PanelTitle>The metrics</PanelTitle>
        </PanelHeader>
        <PanelContent>
          <div className="grid gap-4 sm:grid-cols-2">
            {GLOSSARY_METRICS.map((m) => (
              <Link
                key={m.slug}
                href={ROUTES.GLOSSARY_METRIC(m.slug)}
                className={cn(
                  styles.cardBorder,
                  "group block rounded-lg p-5 transition-colors hover:border-[#f25322]/50",
                )}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-lg font-semibold group-hover:text-[#f25322]">
                    {m.shortName}
                  </span>
                  <span className="text-xs uppercase tracking-wide text-fd-muted-foreground">
                    {m.title}
                  </span>
                </div>
                <p className="mt-2 text-sm text-fd-muted-foreground">
                  {m.tagline}
                </p>
              </Link>
            ))}
          </div>
        </PanelContent>
      </Panel>

      <PanelSeparator />

      <Panel>
        <PanelHeader>
          <PanelTitle>See the ratings in action</PanelTitle>
        </PanelHeader>
        <PanelContent>
          <div className="flex flex-wrap gap-4 text-sm">
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
