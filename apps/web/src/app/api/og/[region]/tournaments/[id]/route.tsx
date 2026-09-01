import { ImageResponse } from "next/og";
import { type NextRequest } from "next/server";
import sharp from "sharp";
import { loadOgAssets, OG_CACHE_CONTROL, OG_SIZE, ogFonts } from "@/lib/og";
import { BrandHeaderCell, RegionHeaderCell, StatCard } from "@/components/og";
import { getTournamentRow } from "@unicum.gg/core/tournaments/read";
import {
  teamFormat,
  TOURNAMENT_GAME_MODE_LABEL,
  TOURNAMENT_STATUS_LABEL,
} from "@unicum.gg/shared";
import {
  isRegion,
  type TournamentGameMode,
  type TournamentStatus,
} from "@unicum.gg/wargaming";
import { tierBand } from "@/components/tournaments/tier-label";

export const runtime = "nodejs";

/**
 * The organiser's logo, re-encoded for Satori.
 *
 * Wargaming serves these as whatever the organiser uploaded, and Satori decodes
 * neither WebP nor SVG, so it goes through sharp like the minimaps do. Asia
 * also holds several hundred logo values that are a bare filename rather than a
 * URL, hence the scheme check before the fetch. Any failure is a card without a
 * logo, never a card that fails to render.
 */
async function logoDataUrl(url: string | null): Promise<string | null> {
  if (!url?.startsWith("http")) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const png = await sharp(Buffer.from(await res.arrayBuffer()))
      .resize(320, 320, { fit: "inside" })
      .png()
      .toBuffer();
    return `data:image/png;base64,${png.toString("base64")}`;
  } catch {
    return null;
  }
}

/**
 * Tournament OG card
 * @description The tournament's card as a stable, hash-free 1200×630 PNG (organiser logo, title, status, field size, format, tier and prize). Mirrors the page's link-unfurl image for embedding directly (Discord, social share), without the route-group hash Next appends to the file convention's URL.
 * @pathParams tournamentParams
 * @response ogImageResponse
 * @responseContentType image/png
 * @tag OG Images
 * @openapi
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ region: string; id: string }> },
) {
  const { region, id } = await params;
  const assets = await loadOgAssets();

  let title = `Tournament ${id}`;
  let statusLabel = "";
  let teamsLabel = "—";
  let formatLabel = "—";
  let tier = "—";
  let prize = "—";
  let logo: string | null = null;

  const numericId = Number(id);
  if (isRegion(region) && Number.isSafeInteger(numericId)) {
    // The row alone: this card prints six scalars, and the full detail read
    // would assemble the whole bracket to get them.
    const t = await getTournamentRow(region, numericId);
    if (t) {
      title = t.title;
      statusLabel = TOURNAMENT_STATUS_LABEL[t.status as TournamentStatus] ?? "";
      teamsLabel = String(t.confirmedTeams);
      formatLabel = teamFormat(t.minPlayersInTeam);
      tier = tierBand(t.tierFrom, t.tierTo) ?? "—";
      // The organiser's own words, which for a qualifier is literally
      // "Qualifier" rather than a reward. Falls back to the battle types, since
      // an empty cell reads as a missing value rather than as "pays nothing".
      const modes = (t.gameModes ?? [])
        .map((m) => TOURNAMENT_GAME_MODE_LABEL[m as TournamentGameMode])
        .join(", ");
      prize = t.prize || modes || "—";
      logo = await logoDataUrl(t.logoUrl);
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
            {statusLabel}
          </div>
          <BrandHeaderCell logoSrc={assets.logoSrc} />
        </div>

        <div
          style={{
            display: "flex",
            flex: 1,
            alignItems: "center",
            gap: 48,
            padding: "48px",
            borderBottom: "1px solid #3F3F46",
          }}
        >
          {logo && (
            <img
              src={logo}
              width={200}
              height={200}
              style={{ objectFit: "contain" }}
              alt=""
            />
          )}
          <div
            style={{
              display: "flex",
              flex: 1,
              flexDirection: "column",
              justifyContent: "center",
              gap: 16,
            }}
          >
            {/* Wrapped rather than truncated: a tournament title is the whole
                identity of the card, and these run long by convention
                ("Onslaught Legends Series - Season 6 Qualifier - 18:00 CET").
                Three lines at this size hold every title we mirror. */}
            <span
              style={{
                fontSize: title.length > 46 ? 56 : 72,
                fontWeight: 700,
                lineHeight: 1.15,
                display: "-webkit-box",
                WebkitLineClamp: 3,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {title}
            </span>
            <span style={{ fontSize: 28, color: "#D4D4D8" }}>
              World of Tanks tournament
            </span>
          </div>
        </div>

        <div style={{ display: "flex" }}>
          <StatCard label="Teams" value={teamsLabel} bg={null} first />
          <StatCard label="Format" value={formatLabel} bg={null} />
          <StatCard label="Tier" value={tier} bg={null} />
          <StatCard label="Prize" value={prize} bg={null} />
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
