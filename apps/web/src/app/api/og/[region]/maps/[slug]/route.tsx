import { ImageResponse } from "next/og";
import { type NextRequest } from "next/server";
import sharp from "sharp";
import APP from "@/constants/app";
import {
  loadOgAssets,
  OG_CACHE_CONTROL,
  OG_SIZE,
  ogFonts,
} from "@/lib/og";
import { BrandHeaderCell, RegionHeaderCell, StatCard } from "@/components/og";
import {
  MAP_CAMOUFLAGE_LABEL,
  TEAM_SIZE_BATTLE_TYPES,
  type MapCamouflage,
} from "@unicum.gg/shared";
import { getMapDetailBySlug } from "@unicum.gg/core/wargaming/wot/maps";
import { isRegion, Region } from "@unicum.gg/wargaming";

export const runtime = "nodejs";

function roundClock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Satori (next/og) can't decode the WebP minimaps, so pull the map's minimap and
// re-encode it as a PNG data URL, downscaled to a size that's plenty for the OG.
async function minimapPngDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const png = await sharp(Buffer.from(await res.arrayBuffer()))
      .resize(720, 720)
      .png()
      .toBuffer();
    return `data:image/png;base64,${png.toString("base64")}`;
  } catch {
    return null;
  }
}

/**
 * Map OG card
 * @description The battle map's card as a stable, hash-free 1200×630 PNG (minimap, size, battle time, team size, modes). Mirrors the page's link-unfurl image for embedding directly (Discord, social share), without the route-group hash Next appends to the file convention's URL.
 * @pathParams mapParams
 * @response ogImageResponse
 * @responseContentType image/png
 * @tag OG Images
 * @openapi
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ region: string; slug: string }> },
) {
  const { region, slug } = await params;
  const assets = await loadOgAssets();

  let name = slug;
  let camoLabel = "";
  let sizeLabel = "—";
  let timeLabel = "—";
  let teamLabel = "—";
  let modesLabel = "—";
  let minimap: string | null = null;

  if (isRegion(region)) {
    const detail = await getMapDetailBySlug(region, decodeURIComponent(slug));
    if (detail) {
      name = detail.name;
      camoLabel =
        MAP_CAMOUFLAGE_LABEL[detail.camouflage as MapCamouflage] ?? "";
      // Compact values so each footer cell fits the OG StatCard at a glance; the
      // full "1000 × 1000 m" / mode names live on the page + header meta strip.
      // Suppress unknown/meaningless stats (event/PvE maps) with an em dash, to
      // stay in sync with the detail page rather than showing "0 m" / "0v0".
      if (detail.sizeMeters > 0) sizeLabel = `${detail.sizeMeters} m`;
      if (detail.roundLength > 0) timeLabel = roundClock(detail.roundLength);
      // A symmetric team size is only meaningful for even-sided PvP modes.
      if (
        detail.maxPlayersInTeam > 0 &&
        detail.battleTypes.some((bt) => TEAM_SIZE_BATTLE_TYPES.has(bt))
      ) {
        teamLabel = `${detail.maxPlayersInTeam}v${detail.maxPlayersInTeam}`;
      }
      if (detail.geometry.length > 0) modesLabel = String(detail.geometry.length);
      minimap = await minimapPngDataUrl(detail.minimapUrl);
    }
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
        <div style={{ display: "flex", borderBottom: "1px solid #3F3F46" }}>
          <RegionHeaderCell region={region} />
          <div
            style={{
              display: "flex",
              flex: 1,
              alignItems: "center",
              padding: "20px 32px",
              borderLeft: "1px solid #3F3F46",
              fontSize: 30,
              fontWeight: 400,
              color: "#A1A1AA",
            }}
          >
            {camoLabel}
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
          {minimap && (
            <img
              src={minimap}
              width={OG_SIZE.width}
              height={OG_SIZE.height}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: "center",
              }}
              alt=""
            />
          )}
          {/* Left fade keeps the name legible over the minimap. */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              background:
                "linear-gradient(to right, #161616 0%, rgba(22,22,22,0.85) 34%, rgba(22,22,22,0.2) 64%, transparent 85%)",
            }}
          />
          <div
            style={{
              position: "relative",
              display: "flex",
              flex: 1,
              flexDirection: "column",
              justifyContent: "space-between",
              padding: "56px 48px 32px",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <span
                style={{
                  fontSize: 96,
                  fontWeight: 700,
                  lineHeight: 1.1,
                  maxWidth: 760,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {name}
              </span>
              <span style={{ fontSize: 28, color: "#D4D4D8" }}>
                World of Tanks battle map
              </span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                fontSize: 22,
                color: "#A1A1AA",
              }}
            >
              <span>
                {APP.NAME}/{isRegion(region) ? region : Region.EU}/maps/{slug}
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: "flex" }}>
          <StatCard label="Size" value={sizeLabel} bg={null} first />
          <StatCard label="Battle time" value={timeLabel} bg={null} />
          <StatCard label="Team size" value={teamLabel} bg={null} />
          <StatCard label="Modes" value={modesLabel} bg={null} />
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
