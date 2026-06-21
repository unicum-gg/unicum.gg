import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/json-ld";
import { TanksIndexView } from "@/components/tanks/tanks-index-view";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { constructMetadata } from "@/lib/metadata";
import { breadcrumbSchema, collectionPageSchema } from "@/lib/schema-org";
import { listTankCommunityStats } from "@/services/tanks/aggregates";
import { getVehicleEncyclopedia } from "@/services/wargaming/wot/encyclopedia";
import {
  isRegion,
  Region,
  REGION_LABEL,
} from "@/services/wargaming/wot";

export function generateStaticParams() {
  return [Region.EU, Region.NA, Region.ASIA].map((region) => ({ region }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ region: string }>;
}): Promise<Metadata> {
  const { region } = await params;
  if (!isRegion(region)) return {};
  const label = REGION_LABEL[region];
  return constructMetadata({
    title: `World of Tanks tank stats (${label})`,
    description: `Community win rate, average damage and popularity for every World of Tanks vehicle on ${label}, aggregated by ${APP.NAME} across all tracked players. Browse by tier and class.`,
    ogTitle: "Tank stats",
    ogSubtitle: `${label} vehicles`,
    canonical: ROUTES.TANKS(region),
  });
}

export default async function TanksIndexPage({
  params,
}: {
  params: Promise<{ region: string }>;
}) {
  const { region } = await params;
  if (!isRegion(region)) notFound();

  const [encyclopedia, stats] = await Promise.all([
    getVehicleEncyclopedia(region),
    listTankCommunityStats(region),
  ]);

  const label = REGION_LABEL[region];

  return (
    <>
      <JsonLd
        data={collectionPageSchema({
          name: `World of Tanks tank stats (${label})`,
          description: `Community stats for every World of Tanks vehicle on ${label}.`,
          url: ROUTES.TANKS(region),
        })}
      />
      <JsonLd
        data={breadcrumbSchema([
          { name: APP.NAME, path: "/" },
          { name: `Tanks (${label})`, path: ROUTES.TANKS(region) },
        ])}
      />
      <TanksIndexView
        region={region}
        encyclopedia={encyclopedia}
        stats={stats}
      />
    </>
  );
}

// Aggregates refresh nightly; a day-long ISR window keeps the page static and
// the marginal render cost at zero between rebuilds.
export const revalidate = 86400;
