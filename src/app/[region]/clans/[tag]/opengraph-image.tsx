import { ImageResponse } from "next/og";
import APP, { userAgent } from "@/constants/app";
import {
  intFmt,
  loadOgAssets,
  normalizeTagColor,
  OG_CONTENT_TYPE,
  OG_SIZE,
  ogFonts,
  pctFmt,
  RATING_BG,
} from "@/lib/og";
import {
  BrandHeaderCell,
  RegionHeaderCell,
  StatCard,
} from "@/components/og";
import { getClanByTagCached } from "@/services/clans/repository";
import { getClanMembersCached } from "@/services/clans/repository/members";
import { isRegion } from "@/services/wargaming/wot";
import { winrateColor, wnxColor } from "@/services/wargaming/wot/ratings";

export const runtime = "nodejs";
export const alt = `World of Tanks clan on ${APP.NAME}`;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image({
  params,
}: {
  params: Promise<{ region: string; tag: string }>;
}) {
  const { region, tag } = await params;
  const decoded = decodeURIComponent(tag);
  const assets = await loadOgAssets();

  let displayTag = decoded;
  let name: string | null = null;
  let tagColor = "#F5F5F5";
  let members: number | null = null;
  let clanEmblemDataUrl: string | null = null;
  let avgWinrate: number | null = null;
  let avgWnx: number | null = null;
  let avgWnxRecent: number | null = null;

  if (isRegion(region)) {
    const cached = await getClanByTagCached(region, decoded);
    if (cached) {
      displayTag = cached.info.tag;
      name = cached.info.name;
      tagColor = normalizeTagColor(cached.info.color);
      members = cached.info.membersCount;

      if (cached.info.emblem) {
        try {
          const res = await fetch(cached.info.emblem, {
            headers: { "user-agent": userAgent(region) },
            signal: AbortSignal.timeout(5000),
          });
          if (res.ok) {
            const buf = await res.arrayBuffer();
            clanEmblemDataUrl = `data:image/png;base64,${Buffer.from(buf).toString("base64")}`;
          }
        } catch {
          // skip emblem on fetch failure
        }
      }

      // Ratings (wnx + wnxRecent) are pre-computed on each member row by
      // refreshClanMembers, so the OG just averages cached values — no tank
      // snapshot loading, no compute. Sub-second regardless of clan size.
      const memberStats = (
        await getClanMembersCached(region, cached.info.id)
      ).members;
      const activeOverall = memberStats.filter(
        (m) => m.overall && m.overall.battles > 0,
      );
      if (activeOverall.length > 0) {
        avgWinrate =
          average(activeOverall.map((m) => m.overall?.winsPercentage ?? 0)) /
          100;
      }
      const wnxValues = memberStats
        .map((m) => m.wnx)
        .filter((v): v is number => v !== null);
      const wnxRecentValues = memberStats
        .map((m) => m.wnxRecent)
        .filter((v): v is number => v !== null);
      if (wnxValues.length > 0) avgWnx = average(wnxValues);
      if (wnxRecentValues.length > 0) avgWnxRecent = average(wnxRecentValues);
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
              borderLeft: "1px solid #3F3F46",
            }}
          />
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
          <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
            {clanEmblemDataUrl && (
              <img
                src={clanEmblemDataUrl}
                width={140}
                height={140}
                alt=""
                style={{ objectFit: "contain" }}
              />
            )}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                flex: 1,
                minWidth: 0,
              }}
            >
              <span
                style={{
                  fontSize: 120,
                  fontWeight: 700,
                  lineHeight: 1.1,
                  color: tagColor,
                  maxWidth: clanEmblemDataUrl ? 880 : 1072,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                [{displayTag}]
              </span>
              {name && (
                <span
                  style={{
                    fontSize: 32,
                    color: "#A1A1AA",
                    maxWidth: clanEmblemDataUrl ? 880 : 1072,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {name}
                </span>
              )}
            </div>
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
              {APP.NAME}/{region}/clans/{displayTag}
            </span>
          </div>
        </div>

        <div style={{ display: "flex" }}>
          <StatCard
            label="Members"
            value={members !== null ? intFmt.format(members) : "—"}
            bg={null}
            first
          />
          <StatCard
            label="Recent WNX"
            value={avgWnxRecent !== null ? intFmt.format(avgWnxRecent) : "—"}
            bg={avgWnxRecent !== null ? RATING_BG[wnxColor(avgWnxRecent)] : null}
          />
          <StatCard
            label="WNX"
            value={avgWnx !== null ? intFmt.format(avgWnx) : "—"}
            bg={avgWnx !== null ? RATING_BG[wnxColor(avgWnx)] : null}
          />
          <StatCard
            label="Winrate"
            value={
              avgWinrate !== null ? `${pctFmt.format(avgWinrate * 100)}%` : "—"
            }
            bg={avgWinrate !== null ? RATING_BG[winrateColor(avgWinrate)] : null}
          />
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: ogFonts(assets) },
  );
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}
