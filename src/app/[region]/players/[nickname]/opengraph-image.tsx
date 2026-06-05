import { ImageResponse } from "next/og";
import {
  intFmt,
  loadOgAssets,
  normalizeTagColor,
  OG_CONTENT_TYPE,
  OG_SIZE,
  ogFonts,
  pctFmt,
  RATING_BG,
  ratingFmt,
} from "@/lib/og";
import {
  BrandHeaderCell,
  RegionHeaderCell,
  StatCard,
} from "@/components/og";
import { loadPlayerInitialData } from "@/services/players/initial-data";
import { isRegion } from "@/services/wargaming/wot";
import { winrateColor, wnxColor } from "@/services/wargaming/wot/ratings";

export const runtime = "nodejs";
export const alt = "World of Tanks player stats on unicum.gg";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image({
  params,
}: {
  params: Promise<{ region: string; nickname: string }>;
}) {
  const { region, nickname } = await params;
  const decoded = decodeURIComponent(nickname);
  const assets = await loadOgAssets();

  let displayName = decoded;
  let battles: number | null = null;
  let winrate: number | null = null;
  let clanTag: string | null = null;
  let clanTagColor = "#F5F5F5";
  let clanEmblemDataUrl: string | null = null;
  let wnx: number | null = null;
  let wnxRecent: number | null = null;

  if (isRegion(region)) {
    const initial = await loadPlayerInitialData(region, { nickname: decoded });
    displayName = initial.player?.nickname ?? decoded;
    const snap = initial.latestSnapshot;
    if (snap && snap.battles > 0) {
      battles = snap.battles;
      winrate = snap.wins / snap.battles;
    }
    const currentClan = initial.clanHistory?.data.currentStint?.clan;
    clanTag = currentClan?.tag ?? null;
    if (currentClan?.color) clanTagColor = normalizeTagColor(currentClan.color);
    // Pre-fetch emblem as data URL so a failed fetch (G-Core throttle, dev
    // network, etc.) just hides the image instead of breaking the OG render.
    if (currentClan?.emblem) {
      try {
        const res = await fetch(currentClan.emblem, {
          signal: AbortSignal.timeout(5000),
        });
        if (res.ok) {
          const buf = await res.arrayBuffer();
          clanEmblemDataUrl = `data:image/png;base64,${Buffer.from(buf).toString("base64")}`;
        }
      } catch {
        // ignore — render without emblem
      }
    }

    // Ratings come pre-computed on the player row (updated by snapshot-cron
    // whenever a fresh tank snapshot is recorded), so no compute here.
    wnx = initial.player?.wnx ?? null;
    wnxRecent = initial.player?.wnxRecent ?? null;
  }

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
              gap: 20,
              padding: "20px 32px",
              borderLeft: "1px solid #3F3F46",
            }}
          >
            {clanEmblemDataUrl && (
              <img
                src={clanEmblemDataUrl}
                width={56}
                height={56}
                alt=""
                style={{ objectFit: "contain" }}
              />
            )}
            {clanTag ? (
              <span
                style={{
                  fontSize: 44,
                  fontWeight: 700,
                  color: clanTagColor,
                  lineHeight: 1,
                }}
              >
                [{clanTag}]
              </span>
            ) : (
              <span style={{ fontSize: 28, color: "#71717A" }}>No clan</span>
            )}
          </div>
          <BrandHeaderCell logoSrc={assets.logoSrc} />
        </div>

        <div
          style={{
            display: "flex",
            flex: 1,
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "56px 48px 32px",
            borderBottom: "1px solid #3F3F46",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <span
              style={{
                fontSize: 120,
                fontWeight: 700,
                lineHeight: 1.1,
                maxWidth: 1100,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {displayName}
            </span>
            <span style={{ fontSize: 28, color: "#A1A1AA" }}>
              World of Tanks player stats
            </span>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              fontSize: 22,
              color: "#71717A",
            }}
          >
            <span>
              unicum.gg/{region}/players/{displayName}
            </span>
          </div>
        </div>

        <div style={{ display: "flex" }}>
          <StatCard
            label="Battles"
            value={battles !== null ? intFmt.format(battles) : "—"}
            bg={null}
            first
          />
          <StatCard
            label="Recent WNX"
            value={wnxRecent !== null ? ratingFmt.format(wnxRecent) : "—"}
            bg={wnxRecent !== null ? RATING_BG[wnxColor(wnxRecent)] : null}
          />
          <StatCard
            label="WNX"
            value={wnx !== null ? ratingFmt.format(wnx) : "—"}
            bg={wnx !== null ? RATING_BG[wnxColor(wnx)] : null}
          />
          <StatCard
            label="Winrate"
            value={winrate !== null ? `${pctFmt.format(winrate * 100)}%` : "—"}
            bg={winrate !== null ? RATING_BG[winrateColor(winrate)] : null}
          />
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: ogFonts(assets) },
  );
}
