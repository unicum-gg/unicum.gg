import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PlayerCompareView } from "@/components/players/compare/view";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { constructMetadata } from "@/lib/metadata";
import {
  type PlayerInitialData,
  loadPlayerInitialData,
} from "@/services/players/initial-data";
import { tankSnapshotsToTankStats } from "@/services/players/tanks";
import { isRegion } from "@/services/wargaming/wot";
import { getVehicleEncyclopedia } from "@/services/wargaming/wot/encyclopedia";
import {
  getWN8ExpectedValues,
  getWNXExpectedValues,
} from "@/services/wargaming/wot/ratings";

const MAX_PLAYERS = 4;
const MIN_PLAYERS = 2;

type RouteParams = {
  params: Promise<{
    region: string;
    nickname: string;
    rest: string[];
  }>;
};

function dedupePreservingOrder(nicks: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const n of nicks) {
    const key = n.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(n);
  }
  return out;
}

function resolveNicknames(raw: string[]): string[] | null {
  const decoded = raw.map((s) => decodeURIComponent(s));
  const cleaned = decoded.filter((s) => s.trim().length > 0);
  if (cleaned.length < MIN_PLAYERS) return null;
  const limited = cleaned.slice(0, MAX_PLAYERS);
  return dedupePreservingOrder(limited);
}

export async function generateMetadata({
  params,
}: RouteParams): Promise<Metadata> {
  const { region, nickname, rest } = await params;
  if (!isRegion(region)) return {};
  const nicks = resolveNicknames([nickname, ...(rest ?? [])]);
  if (!nicks) return {};
  const list = nicks.join(" vs ");
  const ogImage = `/api/og/${region}/players/compare?names=${nicks
    .map((n) => encodeURIComponent(n))
    .join(",")}`;
  return constructMetadata({
    title: `${list} compared on World of Tanks (${region.toUpperCase()})`,
    description: `Side-by-side World of Tanks stats for ${list}: WN7, WN8, WNX, win rate, average damage and more. ${APP.NAME}.`,
    ogImage,
  });
}

export default async function ComparePlayersPage({ params }: RouteParams) {
  const { region, nickname, rest } = await params;
  if (!isRegion(region)) notFound();

  const nicks = resolveNicknames([nickname, ...(rest ?? [])]);
  if (!nicks) notFound();

  // If the URL had duplicates or empty segments, canonicalize.
  const canonical = ROUTES.COMPARE_PLAYERS(region, nicks);
  const requested = `/${region}/players/${nickname}/vs/${(rest ?? []).join("/")}`;
  if (canonical !== requested) redirect(canonical);

  const [encyclopedia, wn8Expected, wnxExpected, ...initials] =
    await Promise.all([
      getVehicleEncyclopedia(region),
      getWN8ExpectedValues(),
      getWNXExpectedValues(),
      ...nicks.map((nick) => loadPlayerInitialData(region, { nickname: nick })),
    ]);

  type Loaded = {
    requested: string;
    initial: PlayerInitialData;
  };
  const loaded: Loaded[] = nicks.map((nick, i) => ({
    requested: nick,
    initial: initials[i],
  }));

  const visibleSlots = loaded.map((l) => {
    const player = l.initial.player;
    const latest = l.initial.latestSnapshot;
    const tanks =
      player && latest
        ? tankSnapshotsToTankStats(l.initial.latestTankSnapshots)
        : [];
    return {
      requested: l.requested,
      player,
      latest,
      tanks,
    };
  });

  return (
    <div className="mx-auto w-full max-w-7xl">
      <PlayerCompareView
        region={region}
        slots={visibleSlots}
        encyclopedia={encyclopedia}
        wn8Expected={wn8Expected}
        wnxExpected={wnxExpected}
        maxPlayers={MAX_PLAYERS}
      />
    </div>
  );
}
