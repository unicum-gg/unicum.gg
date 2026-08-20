import { ImageResponse } from "next/og";
import { type NextRequest } from "next/server";
import { toRoman } from "roman-numerals";
import {
  defaultVehicleRenderUrl,
  isRegion,
  Region,
  tankopediaImageUrl,
} from "@unicum.gg/wargaming";
import {
  applyCamouflage,
  BRAND_COLOR,
  VEHICLE_CLASS_LABEL_FULL,
  type TankSpec,
} from "@unicum.gg/shared";
import { getTankDataset } from "@unicum.gg/core/wargaming/wot/tanks/dataset";
import { getSpecRanges } from "@unicum.gg/core/wargaming/wot/tanks/spec-ranges";
import { BrandHeaderCell, RegionHeaderCell, StatCard } from "@/components/og";
import { overallScore } from "@/components/tanks/compare/score";
import APP from "@/constants/app";
import { MAX_COMPARE_TANKS, MIN_COMPARE_TANKS } from "@/constants/compare";
import {
  fetchImageDataUrl,
  hangarBgDataUrl,
  loadOgAssets,
  OG_CACHE_CONTROL,
  OG_SIZE,
  ogFonts,
} from "@/lib/og";

export const runtime = "nodejs";

type Slot = {
  slug: string;
  name: string;
  /** "Tier X USSR heavy tank", as on a tank's own card. */
  subtitle: string;
  tierLabel: string;
  render: string | null;
  /** Catalogue standing of the vehicle in its top configuration. */
  score: number | null;
};

function dedupePreservingOrder(slugs: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of slugs) {
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

/** The name size that keeps the longest vehicle on one line in its column. */
function pickNameFontSize(longest: number, columns: number): number {
  const perColumn = OG_SIZE.width / columns;
  // ~0.55em per character at this weight, with a little room either side.
  const fitted = Math.floor((perColumn - 40) / (longest * 0.55));
  return Math.max(20, Math.min(columns <= 2 ? 64 : 44, fitted));
}

/**
 * Tanks comparison OG card
 * @description A side-by-side comparison card (up to 4 vehicles) as a 1200×630 PNG: each vehicle's render over the hangar floor, its tier and class, and its overall catalogue score.
 * @pathParams regionParams
 * @queryParams compareSlugsQuery
 * @response ogImageResponse
 * @responseContentType image/png
 * @tag OG Images
 * @openapi
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ region: string }> },
) {
  const { region } = await params;
  const slugsParam = req.nextUrl.searchParams.get("slugs") ?? "";
  // Deduped before the ceiling applies, and already URL-decoded by
  // `searchParams`, exactly like the comparison endpoint reads it.
  const slugs = dedupePreservingOrder(
    slugsParam
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0),
  ).slice(0, MAX_COMPARE_TANKS);

  const [assets, hangarBg] = await Promise.all([
    loadOgAssets(),
    hangarBgDataUrl(isRegion(region) ? region : Region.EU),
  ]);

  let slots: Slot[] = slugs.map((slug) => ({
    slug,
    name: slug,
    subtitle: "",
    tierLabel: "—",
    render: null,
    score: null,
  }));

  if (isRegion(region) && slugs.length >= MIN_COMPARE_TANKS) {
    // The dataset is read once and indexed, not once per vehicle: `getTankRow`
    // rebuilds the whole thing per call, so four of them in parallel is four
    // times every query behind it.
    const [ranges, dataset] = await Promise.all([
      getSpecRanges(region),
      getTankDataset(region),
    ]);
    const bySlug = new Map(dataset.map((r) => [r.identity.slug, r]));
    slots = await Promise.all(
      slugs.map(async (slug): Promise<Slot> => {
        const row = bySlug.get(slug) ?? null;
        if (!row) {
          return {
            slug,
            name: slug,
            subtitle: "",
            tierLabel: "—",
            render: null,
            score: null,
          };
        }
        const { identity } = row;
        const tierLabel = identity.tier ? toRoman(identity.tier) : "—";
        const classLabel =
          VEHICLE_CLASS_LABEL_FULL[identity.type] ?? identity.type;
        // Same fallback chain as a tank's own card: portal render, then the
        // encyclopedia one, then WG's covered-vehicle placeholder.
        const render =
          (await fetchImageDataUrl(
            tankopediaImageUrl(region, identity.tag.toLowerCase()),
          )) ??
          (identity.bigIcon ? await fetchImageDataUrl(identity.bigIcon) : null) ??
          (await fetchImageDataUrl(defaultVehicleRenderUrl(region)));
        // Scored on the no-camouflage-skill baseline, which is what the page
        // shows on an untouched comparison (the stored camo is the fully
        // trained value).
        const specs = row.specs
          ? applyCamouflage(row.specs as TankSpec, 0)
          : null;
        return {
          slug,
          name: identity.name,
          subtitle: `Tier ${tierLabel} ${identity.nation.toUpperCase()} ${classLabel.toLowerCase()}`,
          tierLabel,
          render,
          score: overallScore(specs, ranges),
        };
      }),
    );
  }

  const columns = Math.max(slots.length, 1);
  const longestName = slots.reduce((n, s) => Math.max(n, s.name.length), 1);
  const nameFontSize = pickNameFontSize(longestName, columns);
  const bestScore = Math.max(...slots.map((s) => s.score ?? -1));

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#161616",
          color: "#F5F5F5",
          fontFamily: "Figtree",
          border: "1px solid #3F3F46",
        }}
      >
        <div style={{ display: "flex", borderBottom: "1px solid #3F3F46" }}>
          <RegionHeaderCell region={region} />
          <div
            style={{
              display: "flex",
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              padding: "20px 32px",
              borderLeft: "1px solid #3F3F46",
              fontSize: 34,
              fontWeight: 700,
              color: "#A1A1AA",
              letterSpacing: 4,
              textTransform: "uppercase",
            }}
          >
            Compare
          </div>
          <BrandHeaderCell logoSrc={assets.logoSrc} />
        </div>

        <div
          style={{
            position: "relative",
            display: "flex",
            flex: 1,
            overflow: "hidden",
            borderBottom: "1px solid #3F3F46",
          }}
        >
          {/* One hangar floor behind every vehicle, so the columns read as one
              scene rather than as four cards. */}
          {hangarBg && (
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                backgroundImage: `url(${hangarBg})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            />
          )}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              background:
                "linear-gradient(to bottom, rgba(22,22,22,0.35) 0%, rgba(22,22,22,0.5) 45%, rgba(22,22,22,0.92) 100%)",
            }}
          />
          {slots.map((slot, idx) => (
            <div
              key={slot.slug}
              style={{
                position: "relative",
                display: "flex",
                flex: 1,
                minWidth: 0,
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: 6,
                padding: "16px 12px 20px",
                borderLeft: idx === 0 ? "none" : "1px solid rgba(63,63,70,0.6)",
              }}
            >
              {/* The render takes the space the labels leave, rather than the
                  full column height, which would push them out of the frame. */}
              <div
                style={{
                  display: "flex",
                  flex: 1,
                  minHeight: 0,
                  width: "100%",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {slot.render && (
                  <img
                    src={slot.render}
                    width={520}
                    height={300}
                    style={{
                      maxWidth: "100%",
                      maxHeight: "100%",
                      objectFit: "contain",
                    }}
                    alt=""
                  />
                )}
              </div>
              <span
                style={{
                  fontSize: nameFontSize,
                  fontWeight: 700,
                  lineHeight: 1.1,
                  maxWidth: "100%",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {slot.name}
              </span>
              <span
                style={{
                  fontSize: 20,
                  color: "#D4D4D8",
                  maxWidth: "100%",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {slot.subtitle}
              </span>
            </div>
          ))}
        </div>

        <div style={{ display: "flex" }}>
          {slots.map((slot, idx) => (
            <StatCard
              key={slot.slug}
              label={`${slot.name} overall`}
              value={slot.score !== null ? String(slot.score) : "—"}
              // The best of the comparison carries the brand colour, the way the
              // page marks it. Nothing is highlighted when nothing can be scored.
              bg={
                slot.score !== null && slot.score === bestScore
                  ? BRAND_COLOR
                  : null
              }
              first={idx === 0}
            />
          ))}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            padding: "10px 0 12px",
            fontSize: 20,
            color: "#71717A",
            borderTop: "1px solid #3F3F46",
          }}
        >
          <span>
            {APP.NAME}/{region}/tanks/{slots[0]?.slug ?? ""}/vs/
            {slots
              .slice(1)
              .map((s) => s.slug)
              .join("/")}
          </span>
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      fonts: ogFonts(assets),
      headers: { "Cache-Control": OG_CACHE_CONTROL },
    },
  );
}
