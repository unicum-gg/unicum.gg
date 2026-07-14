import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ClanCompareView } from "@/components/clans/compare/view";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { constructMetadata } from "@/lib/metadata";
import { unicum } from "@/services/sdk";
import type { WN8Expected, WNXExpected } from "@unicum.gg/shared";
import { isRegion } from "@unicum.gg/wargaming";

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

  // The page consumes its own public API through the SDK: one composite
  // compare payload with every clan's inputs + the shared tables.
  const data = await unicum.region(region).clans.compare(tags);
  type ViewProps = React.ComponentProps<typeof ClanCompareView>;
  const slots = data.slots as unknown as ViewProps["slots"];
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

