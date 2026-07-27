import { ImageResponse } from "next/og";
import { type NextRequest } from "next/server";
import {
  BrandHeaderCell,
  RegionHeaderCell,
  StatCard,
} from "@/components/og";
import APP from "@/constants/app";
import { weightedAverage, overallPoints, wnxColor } from "@unicum.gg/shared";
import {
  loadOgAssets,
  OG_CACHE_CONTROL,
  OG_SIZE,
  ogFonts,
  RATING_BG,
  ratingFmt,
} from "@/lib/og";
import { getClanByTagCached } from "@unicum.gg/core/clans/repository";
import { getClanMembersCached } from "@unicum.gg/core/clans/repository/members";
import { isRegion } from "@unicum.gg/wargaming";

export const runtime = "nodejs";

const MAX_CLANS = 4;
const MIN_CLANS = 2;

type Slot = {
  requested: string;
  displayTag: string;
  color: string | null;
  wnx: number | null;
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

function pickNameFontSize(joined: string): number {
  const len = joined.length;
  if (len <= 14) return 130;
  if (len <= 20) return 110;
  if (len <= 30) return 88;
  if (len <= 44) return 68;
  return 52;
}

/**
 * Clans comparison OG card
 * @description A side-by-side comparison card (up to 4 clans, WNX each) as a 1200×630 PNG.
 * @pathParams regionParams
 * @queryParams compareTagsQuery
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
  const tagsParam = req.nextUrl.searchParams.get("tags") ?? "";
  const assets = await loadOgAssets();

  const raw = tagsParam
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .slice(0, MAX_CLANS);
  const tags = dedupePreservingOrder(raw);

  let slots: Slot[] = [];
  if (isRegion(region) && tags.length >= MIN_CLANS) {
    slots = await Promise.all(
      tags.map(async (tag): Promise<Slot> => {
        const cached = await getClanByTagCached(region, tag);
        if (!cached) {
          return {
            requested: tag,
            displayTag: tag,
            color: null,
            wnx: null,
          };
        }
        const { members } = await getClanMembersCached(region, cached.info.id);
        const wnx = weightedAverage(overallPoints(members, (m) => m.wnx));
        return {
          requested: tag,
          displayTag: cached.info.tag,
          color: cached.info.color,
          wnx,
        };
      }),
    );
  } else {
    slots = tags.map((tag) => ({
      requested: tag,
      displayTag: tag,
      color: null,
      wnx: null,
    }));
  }

  const joinedNames = slots.map((s) => `[${s.displayTag}]`).join(" vs ");
  const nameFontSize = pickNameFontSize(joinedNames);

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
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid #3F3F46",
          }}
        >
          <RegionHeaderCell region={region} />
          <div
            style={{
              display: "flex",
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              padding: "20px 32px",
              borderLeft: "1px solid #3F3F46",
              fontSize: 40,
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
            display: "flex",
            flex: 1,
            flexDirection: "column",
            justifyContent: "center",
            gap: 32,
            padding: "32px 48px 24px",
            borderBottom: "1px solid #3F3F46",
            position: "relative",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              fontSize: nameFontSize,
              fontWeight: 700,
              lineHeight: 1.1,
            }}
          >
            {slots.flatMap((s, idx) => {
              const items = [];
              if (idx > 0) {
                items.push(
                  <span
                    key={`sep-${idx}`}
                    style={{
                      display: "flex",
                      color: "#71717A",
                      fontSize: nameFontSize * 0.55,
                      fontWeight: 600,
                      padding: "0 24px",
                    }}
                  >
                    vs
                  </span>,
                );
              }
              const isFirst = idx === 0;
              const isLast = idx === slots.length - 1;
              const justify = isFirst
                ? "flex-end"
                : isLast
                  ? "flex-start"
                  : "center";
              const color = s.color ?? "#71717A";
              items.push(
                <span
                  key={s.requested}
                  style={{
                    display: "flex",
                    flex: 1,
                    justifyContent: justify,
                    overflow: "hidden",
                    minWidth: 0,
                  }}
                >
                  <span
                    style={{
                      display: "flex",
                      overflow: "hidden",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <span style={{ color }}>[</span>
                    {s.displayTag}
                    <span style={{ color }}>]</span>
                  </span>
                </span>,
              );
              return items;
            })}
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              fontSize: 22,
              color: "#71717A",
            }}
          >
            <span>
              {APP.NAME}/{region}/clans/{slots[0]?.displayTag ?? ""}/vs/
              {slots
                .slice(1)
                .map((s) => s.displayTag)
                .join("/")}
            </span>
          </div>
        </div>

        <div style={{ display: "flex" }}>
          {slots.map((s, idx) => (
            <StatCard
              key={s.requested}
              label={`[${s.displayTag}]`}
              value={s.wnx !== null ? ratingFmt.format(s.wnx) : "—"}
              bg={s.wnx !== null ? RATING_BG[wnxColor(s.wnx)] : null}
              first={idx === 0}
            />
          ))}
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
