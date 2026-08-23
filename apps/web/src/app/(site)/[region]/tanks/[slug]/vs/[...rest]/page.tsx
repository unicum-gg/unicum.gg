import { cache } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { UnicumError } from "@unicum.gg/sdk";
import { toRoman } from "roman-numerals";
import { isRegion } from "@unicum.gg/wargaming";
import type {
  CompareCatalog,
  CompareVehicle,
} from "@unicum.gg/core/wargaming/wot/tanks/compare-assemble";
import type { SpecRanges } from "@unicum.gg/core/wargaming/wot/tanks/spec-ranges";
import { TankCompareView } from "@/components/tanks/compare/view";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { constructMetadata } from "@/lib/metadata";
import {
  MAX_COMPARE_TANKS,
  MIN_COMPARE_TANKS,
} from "@/constants/compare";
import { SETUP_PARAM } from "@/components/tanks/detail/specifications/config-url";
import { formatTankRef, parseTankRef } from "@unicum.gg/shared";
import {
  vehicleLabel,
  vehicleRef,
} from "@/components/tanks/compare/column-ref";
import { unicum } from "@/services/sdk";

// Dynamic on purpose: the page consumes our own API through the SDK, and its
// vehicles are an unbounded path, so there is nothing to prerender. The endpoint
// caches server-side, so per-request cost is a local HTTP hop onto a cached
// payload.
export const dynamic = "force-dynamic";

type RouteParams = {
  params: Promise<{ region: string; slug: string; rest: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** A path segment as it was written. Next hands them over percent-encoded, and
 * the client separator is one of the characters that gets encoded (`@` becomes
 * `%40`), so a column reference has to be decoded before it can be read. A
 * malformed escape is left alone rather than throwing: it comes from a URL. */
function decodeSegment(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function dedupePreservingOrder(refs: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of refs) {
    const ref = formatTankRef(parseTankRef(decodeSegment(raw)));
    if (seen.has(ref)) continue;
    seen.add(ref);
    out.push(ref);
  }
  return out;
}

/** The columns a path asks for: already decoded by Next, deduped before the
 * ceiling applies (so a repeated column costs itself its slot, never a distinct
 * vehicle further down the path), and null below the two it takes to compare.
 *
 * A column is a vehicle on a client, so the whole reference is what dedupes:
 * `amx-13-90/vs/amx-13-90@ct` is a vehicle against its Common Test version, two
 * columns, where the bare slug twice is still one. */
function resolveRefs(raw: string[]): string[] | null {
  const cleaned = raw.map((s) => s.trim()).filter((s) => s.length > 0);
  if (cleaned.length < MIN_COMPARE_TANKS) return null;
  const unique = dedupePreservingOrder(cleaned);
  if (unique.length < MIN_COMPARE_TANKS) return null;
  return unique.slice(0, MAX_COMPARE_TANKS);
}

/** The comparison payload, or null when the catalogue knows none of the slugs.
 *
 * Only a 404 becomes null: anything else (the endpoint down, a timeout) is left
 * to throw, so a passing failure is served as a 500 and retried rather than as a
 * permanent 404 that de-indexes a valid comparison.
 *
 * Wrapped in `cache` so `generateMetadata` and the page body share one request:
 * they ask for the same comparison, and the payload is the heaviest thing this
 * page fetches. Keyed by the argument list, hence the joined slugs. */
const loadCompare = cache(async function loadCompare(
  region: string,
  slugsKey: string,
) {
  if (!isRegion(region)) return null;
  try {
    return await unicum.region(region).tanks.compare(slugsKey.split(","));
  } catch (error) {
    if (error instanceof UnicumError && error.status === 404) return null;
    throw error;
  }
});

export async function generateMetadata({
  params,
}: RouteParams): Promise<Metadata> {
  const { region, slug, rest } = await params;
  if (!isRegion(region)) return {};
  const refs = resolveRefs([slug, ...(rest ?? [])]);
  if (!refs) return {};
  const data = await loadCompare(region, refs.join(","));
  if (!data || data.vehicles.length < MIN_COMPARE_TANKS) return {};

  const names = data.vehicles.map(vehicleLabel);
  const list = names.join(" vs ");
  const tiers = [...new Set(data.vehicles.map((v) => toRoman(v.meta.tier)))];
  const tierPart =
    tiers.length === 1 ? `tier ${tiers[0]} ` : "";
  const ogImage = `/api/og/${region}/tanks/compare?slugs=${data.vehicles
    .map((v) => encodeURIComponent(vehicleRef(v)))
    .join(",")}`;
  return constructMetadata({
    title: `${list} compared on World of Tanks (${region.toUpperCase()})`,
    description: `Side-by-side comparison of the ${tierPart}${list}: firepower, mobility, survivability and concealment with your own equipment and crew, plus server-average winrate, damage and marks. ${APP.NAME}.`,
    ogImage,
    canonical: ROUTES.COMPARE_TANKS(region, data.vehicles.map(vehicleRef)),
  });
}

export default async function CompareTanksPage({
  params,
  searchParams,
}: RouteParams) {
  const { region, slug, rest } = await params;
  if (!isRegion(region)) notFound();

  const refs = resolveRefs([slug, ...(rest ?? [])]);
  if (!refs) notFound();

  const data = await loadCompare(region, refs.join(","));
  if (!data || data.vehicles.length < MIN_COMPARE_TANKS) notFound();

  // The setups the URL opened on. Read here to key the board, and carried
  // through the canonical redirect below: they are the builds on screen, so
  // dropping them there would quietly reset a shared link to pristine columns.
  const setupParam = (await searchParams)[SETUP_PARAM];
  const setupKey = Array.isArray(setupParam)
    ? setupParam.join("|")
    : (setupParam ?? "");

  // The endpoint answers with canonical slugs and drops what the catalogue
  // doesn't know, so a legacy id, a wrong-case slug, a duplicate or a dead
  // vehicle in the path lands on the URL this comparison actually is.
  //
  // Compared as column lists, not as URL strings. The two strings are built by
  // different means (one from the raw path, one through `pathcat`) and a column
  // reference carries a character that percent-encodes, so comparing them
  // spelled out made a CT column in first position differ from itself and
  // redirect forever.
  //
  // The path side is decoded but otherwise left as written, so what the URL got
  // wrong still shows up as a difference: a legacy id, the wrong case, a
  // repeated column, a vehicle the catalogue dropped.
  const canonicalRefs = data.vehicles.map(vehicleRef);
  const canonical = ROUTES.COMPARE_TANKS(region, canonicalRefs);
  const requestedRefs = [slug, ...(rest ?? [])].map(decodeSegment);
  if (canonicalRefs.join(",") !== requestedRefs.join(",")) {
    redirect(
      setupKey
        ? `${canonical}?${SETUP_PARAM}=${encodeURIComponent(setupKey)}`
        : canonical,
    );
  }

  // The setups the URL opened on. Read here only to key the board: the columns
  // decode them themselves, and later edits are mirrored back with replaceState
  // (no server render), so this changes on a real navigation and nowhere else.
  const vehicles = data.vehicles as unknown as CompareVehicle[];
  const catalog = data.catalog as unknown as CompareCatalog;
  const ranges = data.ranges as unknown as SpecRanges;

  return (
    <div className="mx-auto w-full max-w-7xl">
      {/* Column state is held by index and seeded from the URL once, so both a
          change of composition and a new set of setups (from "apply to every
          column") remount the board rather than sliding a removed column's
          setup onto its neighbour (see `useCompareBuilds`). */}
      <TankCompareView
        key={`${vehicles.map(vehicleRef).join(",")}|${setupKey}`}
        region={region}
        vehicles={vehicles}
        catalog={catalog}
        ranges={ranges}
      />
    </div>
  );
}
