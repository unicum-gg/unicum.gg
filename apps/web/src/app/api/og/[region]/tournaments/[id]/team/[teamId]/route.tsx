import { ImageResponse } from "next/og";
import { type NextRequest } from "next/server";
import {
  loadOgAssets,
  normalizeTagColor,
  OG_CACHE_CONTROL,
  OG_SIZE,
  ogFonts,
  RATING_BG,
} from "@/lib/og";
import {
  BrandHeaderCell,
  OgClanTag,
  RegionHeaderCell,
  StatCard,
} from "@/components/og";
import { getTournament } from "@unicum.gg/core/tournaments/read";
import { ordinal, winrateColor, wnxColor } from "@unicum.gg/shared";
import { isRegion } from "@unicum.gg/wargaming";

export const runtime = "nodejs";

const intFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

/**
 * Where the team finished, read the way the tournament page reads it.
 *
 * Only a stage that holds a single group decided an overall order: a draw
 * played as parallel groups crowns a winner per group and nobody overall, and
 * claiming a place there would contradict the page this card links to. A tie is
 * reported at its best (two beaten semi-finalists are both third), since the
 * bracket records a tie at its lowest place.
 */
function placementOf(
  stages: Awaited<ReturnType<typeof getTournament>> extends infer T
    ? T extends { stages: infer S }
      ? S
      : never
    : never,
  teamId: number,
): number | null {
  for (const stage of [...stages].reverse()) {
    if (stage.groups.length !== 1) continue;
    const standings = stage.groups[0]!.standings;
    const mine = standings.find((s) => s.teamId === teamId);
    if (!mine || mine.position === null) continue;
    const tied = standings.filter((s) => s.position === mine.position).length;
    return tied > 1 ? mine.position - tied + 1 : mine.position;
  }
  return null;
}

/**
 * Tournament team OG card
 * @description One team's card as a stable, hash-free 1200×630 PNG (team name, the clan it fielded, where it finished, roster size and average rating). Mirrors the page's link-unfurl image for embedding directly (Discord, social share), without the route-group hash Next appends to the file convention's URL.
 * @pathParams tournamentTeamParams
 * @response ogImageResponse
 * @responseContentType image/png
 * @tag OG Images
 * @openapi
 */
export async function GET(
  _req: NextRequest,
  {
    params,
  }: { params: Promise<{ region: string; id: string; teamId: string }> },
) {
  const { region, id, teamId } = await params;
  const assets = await loadOgAssets();

  let name = `Team ${teamId}`;
  let tournamentTitle = "";
  let clanTag = "";
  let clanName = "";
  // Wargaming stores a clan's colour in three notations (`#RRGGBB`, `0xRRGGBB`,
  // bare hex); the clan card's own normaliser handles all three and falls back
  // to the body colour for anything else.
  let clanColor = "#F5F5F5";
  let placeLabel = "—";
  let playersLabel = "—";
  let ratingLabel = "—";
  let winrateLabel = "—";
  // Kept beside the labels: the cell is tinted by the rating, the same reading
  // the site gives a number everywhere else, and a rating printed without its
  // colour is the one thing a WoT player will not read.
  let rating: number | null = null;
  let winrate: number | null = null;

  const numericId = Number(id);
  const numericTeam = Number(teamId);
  if (
    isRegion(region) &&
    Number.isSafeInteger(numericId) &&
    Number.isSafeInteger(numericTeam)
  ) {
    const t = await getTournament(region, numericId);
    const team = t?.teams.find((x) => x.id === numericTeam);
    if (t && team) {
      name = team.title;
      tournamentTitle = t.title;
      if (team.clan) {
        clanTag = team.clan.clanTag;
        clanName = team.clan.clanName ?? "";
        clanColor = normalizeTagColor(team.clan.clanColor ?? "");
      }
      const place = placementOf(t.stages, team.id);
      if (place !== null) placeLabel = ordinal(place);
      playersLabel = `${team.players.length}/${t.maxPlayersInTeam}`;
      if (team.avgWnx !== null && Number.isFinite(team.avgWnx)) {
        rating = team.avgWnx;
        ratingLabel = intFmt.format(team.avgWnx);
      }
      if (team.avgWinrate !== null && Number.isFinite(team.avgWinrate)) {
        winrate = team.avgWinrate;
        winrateLabel = `${(team.avgWinrate * 100).toFixed(1)}%`;
      }
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
              fontSize: 26,
              fontWeight: 400,
              color: "#A1A1AA",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {tournamentTitle}
          </div>
          <BrandHeaderCell logoSrc={assets.logoSrc} />
        </div>

        <div
          style={{
            display: "flex",
            flex: 1,
            flexDirection: "column",
            justifyContent: "center",
            gap: 16,
            padding: "48px",
            borderBottom: "1px solid #3F3F46",
          }}
        >
          <span
            style={{
              fontSize: name.length > 24 ? 72 : 96,
              fontWeight: 700,
              lineHeight: 1.1,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {name}
          </span>
          {/* The clan it actually fielded, which the team name rarely says: a
              clan often enters under whatever its captain typed. */}
          {clanTag ? (
            // The tag in the clan's own colour, the way it is drawn everywhere
            // else on the site and on the clan card; the name stays neutral
            // beside it.
            <div style={{ display: "flex", gap: 12, fontSize: 34 }}>
              <span style={{ color: "#F5F5F5" }}>
                <OgClanTag tag={clanTag} color={clanColor} />
              </span>
              {clanName ? (
                <span style={{ color: "#D4D4D8" }}>{clanName}</span>
              ) : null}
            </div>
          ) : (
            <span style={{ fontSize: 28, color: "#D4D4D8" }}>
              World of Tanks tournament team
            </span>
          )}
        </div>

        <div style={{ display: "flex" }}>
          <StatCard label="Finished" value={placeLabel} bg={null} first />
          <StatCard label="Players" value={playersLabel} bg={null} />
          <StatCard
            label="Avg WNX"
            value={ratingLabel}
            bg={rating !== null ? RATING_BG[wnxColor(rating)] : null}
          />
          <StatCard
            label="Avg winrate"
            value={winrateLabel}
            // A fraction, not a percentage: `winrateColor` brackets on 0.58.
            bg={winrate !== null ? RATING_BG[winrateColor(winrate)] : null}
          />
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
