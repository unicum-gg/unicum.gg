import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PlayerCompareView } from "@/components/players/compare/view";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { constructMetadata } from "@/lib/metadata";
import { unicum } from "@/services/sdk";
import type { WN8Expected, WNXExpected } from "@unicum.gg/shared";
import { isRegion } from "@unicum.gg/wargaming";


// Dynamic on purpose: the page consumes our own API through the SDK, and
// prerendering it at build time would make the build depend on a running API.
// The endpoints cache server-side, so per-request cost is local HTTP hops onto
// cached payloads.
export const dynamic = "force-dynamic";

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

  // The page consumes its own public API through the SDK: one composite
  // compare payload with every player's raw inputs + the shared tables.
  const data = await unicum.region(region).players.compare(nicks);
  type ViewProps = React.ComponentProps<typeof PlayerCompareView>;
  const visibleSlots = data.slots as unknown as ViewProps["slots"];
  const encyclopedia = data.encyclopedia as unknown as ViewProps["encyclopedia"];
  const wn8Expected = new Map(
    Object.entries(data.wn8Expected).map(([k, v]) => [
      Number(k),
      v as unknown as WN8Expected,
    ]),
  );
  const wnxExpected = new Map(
    Object.entries(data.wnxExpected).map(([k, v]) => [
      Number(k),
      v as unknown as WNXExpected,
    ]),
  );
  // Precomputed server-side from the full tables (keyed by `tier-type`), so the
  // client never rebuilds it from the trimmed owned-only expected table.
  const wn8Fallback = new Map(
    Object.entries(
      (data as unknown as { wn8Fallback: Record<string, WN8Expected> })
        .wn8Fallback,
    ),
  );

  return (
    <div className="mx-auto w-full max-w-7xl">
      <PlayerCompareView
        region={region}
        slots={visibleSlots}
        encyclopedia={encyclopedia}
        wn8Expected={wn8Expected}
        wnxExpected={wnxExpected}
        wn8Fallback={wn8Fallback}
        maxPlayers={MAX_PLAYERS}
      />
    </div>
  );
}
