import { ImageResponse } from "next/og";
import { type NextRequest } from "next/server";
import sharp from "sharp";
import {
  loadOgAssets,
  OG_CACHE_CONTROL,
  OG_SIZE,
  ogFonts,
  RATING_BG,
  intFmt,
  normalizeTagColor,
} from "@/lib/og";
import {
  BrandHeaderCell,
  RegionHeaderCell,
  StatCard,
  OgClanTag,
  VehicleTypeGlyph,
} from "@/components/og";
import { minimapUrl, modeLabel, wnxColor } from "@unicum.gg/shared";
import { battleDetail } from "@unicum.gg/core/battles/read";
import { normaliseBattleId } from "@unicum.gg/core/battles/ingest";
import { listMapSummaries } from "@unicum.gg/core/wargaming/wot/maps";
import { isRegion } from "@unicum.gg/wargaming";
import { toRoman } from "roman-numerals";

export const runtime = "nodejs";

/** `deathReason` when a vehicle saw the battle out. */
const SURVIVED = -1;

const WIN = "#34D399";
const LOSS = "#F87171";
const MUTED = "#A1A1AA";

function clock(seconds: number | null): string {
  if (!seconds || seconds <= 0) return "—";
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

function day(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

// Satori cannot decode the WebP minimaps, so the battle's is fetched and
// re-encoded as a PNG data URL, as the map card does.
async function minimapPngDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const png = await sharp(Buffer.from(await res.arrayBuffer()))
      .resize(560, 560)
      .png()
      .toBuffer();
    return `data:image/png;base64,${png.toString("base64")}`;
  } catch {
    return null;
  }
}

type Card = {
  header: string;
  /** The result's colour, for the header and the minimap's tint. */
  tint: string | null;
  title: string;
  titleColor: string;
  /** The clan the title's player wears, drawn after the name in its own
   * colour as everywhere else on the site. */
  clan?: { tag: string; color: string | null };
  lines: { text: string; color?: string }[];
  glyph: string | null;
  stats: { label: string; value: string; bg: string | null }[];
};

/**
 * Battle OG card
 * @description A battle's card as a stable, hash-free 1200×630 PNG: its map, mode and minimap, and either one player's side of it (result, vehicle, damage, assistance, kills, experience and WNX) or, without `player`, the battle as a whole (score, length, who recorded it, the top damage). Mirrors the battle pages' link-unfurl image for embedding directly (Discord, social share).
 * @pathParams battleParams
 * @queryParams battleOgQuery
 * @response ogImageResponse
 * @responseContentType image/png
 * @tag OG Images
 * @openapi
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ region: string; id: string }> },
) {
  const { region, id } = await params;
  const assets = await loadOgAssets();
  const asked = Number(new URL(req.url).searchParams.get("player"));

  let card: Card = {
    header: "World of Tanks battle",
    tint: null,
    title: "Battle",
    titleColor: "#F5F5F5",
    lines: [],
    glyph: null,
    stats: [],
  };
  let minimap: string | null = null;

  const battle = isRegion(region)
    ? await battleDetail(region, normaliseBattleId(id)).catch(() => null)
    : null;

  if (battle && isRegion(region)) {
    const maps = await listMapSummaries(region).catch(() => []);
    const mapName = maps.find((one) => one.arenaId === battle.map)?.name ?? battle.map;
    const mode = modeLabel(battle.battleType) ?? "Battle";
    minimap = await minimapPngDataUrl(battle.mapImage ?? minimapUrl(battle.map));
    const length = clock(battle.duration);
    const player = Number.isFinite(asked) && asked > 0
      ? battle.participants.find((one) => one.account === asked)
      : undefined;

    if (player?.player && player.tank) {
      const result =
        battle.winnerTeam === null
          ? null
          : battle.winnerTeam === 0
            ? "Draw"
            : battle.winnerTeam === player.team
              ? "Victory"
              : "Defeat";
      const tint = result === "Victory" ? WIN : result === "Defeat" ? LOSS : null;
      const own = player.own;
      // WNX, the site's default rating and the one the player card shows.
      const wnx = player.rating.wnx;
      card = {
        header: [result, mode, mapName].filter(Boolean).join(" · "),
        tint,
        title: player.player.nickname,
        clan: player.player.clanTag
          ? { tag: player.player.clanTag, color: player.player.clanColor ?? null }
          : undefined,
        titleColor: "#F5F5F5",
        lines: [
          {
            text: `${toRoman(player.tank.tier)}  ${player.tank.shortName || player.tank.name}`,
          },
          { text: `${day(battle.startedAt)} · ${length}`, color: MUTED },
          ...(battle.hasReplay ? [{ text: "Replay available", color: WIN }] : []),
        ],
        glyph: player.tank.type,
        stats: [
          { label: "Damage", value: intFmt.format(own.damage ?? 0), bg: null },
          {
            label: "Assisted",
            value: intFmt.format((own.radio ?? 0) + (own.track ?? 0)),
            bg: null,
          },
          { label: "Kills", value: intFmt.format(own.kills ?? 0), bg: null },
          { label: "XP", value: intFmt.format(own.xp ?? 0), bg: null },
          ...(typeof wnx === "number"
            ? [{ label: "WNX", value: intFmt.format(wnx), bg: RATING_BG[wnxColor(wnx)] }]
            : []),
        ],
      };
    } else {
      // The battle as a whole: each side's kills are the other side's wrecks.
      const dead = (team: number) =>
        battle.participants.filter(
          (one) =>
            one.team === team &&
            one.own.deathReason !== undefined &&
            one.own.deathReason !== SURVIVED,
        ).length;
      const top = [...battle.participants].sort(
        (a, b) => (b.own.damage ?? 0) - (a.own.damage ?? 0),
      )[0];
      const recorders = battle.recorders.map((one) => one.nickname);
      card = {
        header: [mode, mapName].join(" · "),
        tint: null,
        title: `${dead(2)} – ${dead(1)}`,
        titleColor: "#F5F5F5",
        lines: [
          { text: "Kills, team 1 – team 2", color: MUTED },
          { text: `${day(battle.startedAt)} · ${length}`, color: MUTED },
          ...(recorders.length
            ? [{ text: `Recorded by ${recorders.slice(0, 3).join(", ")}` }]
            : []),
          ...(battle.hasReplay ? [{ text: "Replay available", color: WIN }] : []),
        ],
        glyph: null,
        stats: [
          { label: "Length", value: length, bg: null },
          { label: "Players", value: String(battle.participants.length), bg: null },
          {
            label: top?.player?.nickname ? `Top damage · ${top.player.nickname}` : "Top damage",
            value: intFmt.format(top?.own.damage ?? 0),
            bg: null,
          },
        ],
      };
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
              color: card.tint ?? MUTED,
              overflow: "hidden",
              whiteSpace: "nowrap",
            }}
          >
            {card.header}
          </div>
          <BrandHeaderCell logoSrc={assets.logoSrc} />
        </div>

        <div
          style={{
            display: "flex",
            flex: 1,
            overflow: "hidden",
            borderBottom: "1px solid #3F3F46",
          }}
        >
          {/* The battle's minimap, tinted by the result like a battle row. */}
          <div
            style={{
              position: "relative",
              display: "flex",
              width: 380,
              height: "100%",
              borderRight: "1px solid #3F3F46",
              overflow: "hidden",
              background: "#1F1F23",
            }}
          >
            {minimap && (
              <img
                src={minimap}
                width={380}
                height={380}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                alt=""
              />
            )}
            {card.tint && (
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                  background: card.tint,
                  opacity: 0.16,
                }}
              />
            )}
            {card.tint && (
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: 8,
                  height: "100%",
                  background: card.tint,
                }}
              />
            )}
          </div>

          <div
            style={{
              display: "flex",
              flex: 1,
              flexDirection: "column",
              justifyContent: "center",
              gap: 14,
              padding: "32px 44px",
              minWidth: 0,
            }}
          >
            <span
              style={{
                fontSize: 64,
                fontWeight: 700,
                lineHeight: 1.1,
                color: card.titleColor,
                maxWidth: 720,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {card.title}
              {card.clan ? (
                // The site's rule (`OgClanTag`): only the brackets wear the
                // clan's colour, the letters stay in the name's.
                <span style={{ marginLeft: 16 }}>
                  <OgClanTag
                    tag={card.clan.tag}
                    color={card.clan.color ? normalizeTagColor(card.clan.color) : MUTED}
                  />
                </span>
              ) : null}
            </span>
            {card.lines.map((line, index) => (
              <div
                key={index}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  fontSize: index === 0 && card.glyph ? 38 : 28,
                  fontWeight: index === 0 && card.glyph ? 700 : 400,
                  color: line.color ?? "#E4E4E7",
                  maxWidth: 720,
                  overflow: "hidden",
                  whiteSpace: "nowrap",
                }}
              >
                {index === 0 && card.glyph ? (
                  <VehicleTypeGlyph type={card.glyph} size={34} />
                ) : null}
                <span>{line.text}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex" }}>
          {card.stats.map((stat, index) => (
            <StatCard
              key={stat.label}
              label={stat.label}
              value={stat.value}
              bg={stat.bg}
              first={index === 0}
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
