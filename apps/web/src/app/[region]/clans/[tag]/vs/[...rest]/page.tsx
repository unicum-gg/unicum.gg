import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ClanCompareView } from "@/components/clans/compare/view";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { constructMetadata } from "@/lib/metadata";
import { getClanByTagCached } from "@unicum.gg/core/clans/repository";
import { getClanMembersCached } from "@unicum.gg/core/clans/repository/members";
import { getClanTankAggregates } from "@unicum.gg/core/clans/repository/tanks";
import { isRegion, type Region } from "@unicum.gg/wargaming";
import { getVehicleEncyclopedia } from "@unicum.gg/core/wargaming/wot/tanks/encyclopedia";
import {
  getWN8ExpectedValues,
  getWNXExpectedValues,
} from "@unicum.gg/core/wargaming/wot/wn-expected";

const MAX_CLANS = 4;
const MIN_CLANS = 2;

type RouteParams = {
  params: Promise<{
    region: string;
    tag: string;
    rest: string[];
  }>;
};

function dedupePreservingOrder(tags: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of tags) {
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

function resolveTags(raw: string[]): string[] | null {
  const decoded = raw.map((s) => decodeURIComponent(s));
  const cleaned = decoded.filter((s) => s.trim().length > 0);
  if (cleaned.length < MIN_CLANS) return null;
  const limited = cleaned.slice(0, MAX_CLANS);
  return dedupePreservingOrder(limited);
}

export async function generateMetadata({
  params,
}: RouteParams): Promise<Metadata> {
  const { region, tag, rest } = await params;
  if (!isRegion(region)) return {};
  const tags = resolveTags([tag, ...(rest ?? [])]);
  if (!tags) return {};
  const list = tags.map((t) => `[${t}]`).join(" vs ");
  const ogImage = `/api/og/${region}/clans/compare?tags=${tags
    .map((t) => encodeURIComponent(t))
    .join(",")}`;
  return constructMetadata({
    title: `${list} compared on World of Tanks (${region.toUpperCase()})`,
    description: `Side-by-side World of Tanks clan stats for ${list}: members, WN8/WNX averages, tanks, role distribution. ${APP.NAME}.`,
    ogImage,
  });
}

export default async function CompareClansPage({ params }: RouteParams) {
  const { region, tag, rest } = await params;
  if (!isRegion(region)) notFound();

  const tags = resolveTags([tag, ...(rest ?? [])]);
  if (!tags) notFound();

  const canonical = ROUTES.COMPARE_CLANS(region, tags);
  const requested = `/${region}/clans/${tag}/vs/${(rest ?? []).join("/")}`;
  if (canonical !== requested) redirect(canonical);

  // Static encyclopedia + expected values shared by all clans.
  const [encyclopedia, wn8Expected, wnxExpected, ...clanData] =
    await Promise.all([
      getVehicleEncyclopedia(region),
      getWN8ExpectedValues(),
      getWNXExpectedValues(),
      ...tags.map((tag) => loadClanForCompare(region, tag)),
    ]);

  const slots = tags.map((tag, i) => ({
    requested: tag,
    ...clanData[i],
  }));

  return (
    <div className="mx-auto w-full max-w-7xl">
      <ClanCompareView
        region={region}
        slots={slots}
        encyclopedia={encyclopedia}
        wn8Expected={wn8Expected}
        wnxExpected={wnxExpected}
        maxClans={MAX_CLANS}
      />
    </div>
  );
}

async function loadClanForCompare(region: Region, tag: string) {
  const cached = await getClanByTagCached(region, tag);
  if (!cached) {
    return { clan: null, members: [], tankAggregates: [] };
  }
  const [membersCached, tankAggregates] = await Promise.all([
    getClanMembersCached(region, cached.info.id),
    getClanTankAggregates(region, cached.info.id),
  ]);
  return {
    clan: cached.info,
    members: membersCached.members,
    tankAggregates,
  };
}
