import { ImageResponse } from "next/og";
import { type NextRequest } from "next/server";
import {
  BrandHeaderCell,
  RegionHeaderCell,
  StatCard,
} from "@/components/og";
import APP from "@/constants/app";
import {
  loadOgAssets,
  OG_SIZE,
  ogFonts,
  RATING_BG,
  ratingFmt,
} from "@/lib/og";
import { loadPlayerInitialData } from "@unicum.gg/core/players/initial-data";
import { isRegion } from "@unicum.gg/wargaming/region";
import { wnxColor } from "@unicum.gg/core/wargaming/wot/ratings";

export const runtime = "nodejs";

const MAX_PLAYERS = 4;
const MIN_PLAYERS = 2;

type Slot = {
  requested: string;
  displayName: string;
  wnx: number | null;
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

function pickNameFontSize(joined: string): number {
  const len = joined.length;
  if (len <= 14) return 130;
  if (len <= 20) return 110;
  if (len <= 30) return 88;
  if (len <= 44) return 68;
  return 52;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ region: string }> },
) {
  const { region } = await params;
  const namesParam = req.nextUrl.searchParams.get("names") ?? "";
  const assets = await loadOgAssets();

  const raw = namesParam
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .slice(0, MAX_PLAYERS);
  const nicks = dedupePreservingOrder(raw);

  let slots: Slot[] = [];
  if (isRegion(region) && nicks.length >= MIN_PLAYERS) {
    slots = await Promise.all(
      nicks.map(async (nick): Promise<Slot> => {
        const initial = await loadPlayerInitialData(region, { nickname: nick });
        return {
          requested: nick,
          displayName: initial.player?.nickname ?? nick,
          wnx: initial.player?.wnx ?? null,
        };
      }),
    );
  } else {
    slots = nicks.map((nick) => ({
      requested: nick,
      displayName: nick,
      wnx: null,
    }));
  }

  const joinedNames = slots.map((s) => s.displayName).join(" vs ");
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
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {s.displayName}
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
              {APP.NAME}/{region}/players/{slots[0]?.displayName ?? ""}/vs/
              {slots
                .slice(1)
                .map((s) => s.displayName)
                .join("/")}
            </span>
          </div>
        </div>

        <div style={{ display: "flex" }}>
          {slots.map((s, idx) => (
            <StatCard
              key={s.requested}
              label={s.displayName}
              value={s.wnx !== null ? ratingFmt.format(s.wnx) : "—"}
              bg={s.wnx !== null ? RATING_BG[wnxColor(s.wnx)] : null}
              first={idx === 0}
            />
          ))}
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: ogFonts(assets) },
  );
}
