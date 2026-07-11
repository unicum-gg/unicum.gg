import { ImageResponse } from "next/og";
import APP from "@/constants/app";
import {
  fetchImageDataUrl,
  hangarBgDataUrl,
  loadOgAssets,
  OG_CONTENT_TYPE,
  OG_SIZE,
  ogFonts,
  RATING_BG,
  ratingFmt,
} from "@/lib/og";
import {
  BrandHeaderCell,
  RegionHeaderCell,
  StatCard,
  VehicleTypeGlyph,
} from "@/components/og";
import { VEHICLE_CLASS_LABEL_FULL } from "@unicum.gg/core/constants/tanks";
import { getTankBySlug } from "@unicum.gg/core/wargaming/wot/tanks/resolve";
import { getTopPlayersByTank } from "@unicum.gg/core/wargaming/wot/players/top/by-tank";
import { isRegion } from "@unicum.gg/wargaming/region";
import { wnxColor } from "@unicum.gg/core/wargaming/wot/ratings";
import { toRoman } from "roman-numerals";

export const runtime = "nodejs";
export const alt = `World of Tanks tank stats on ${APP.NAME}`;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image({
  params,
}: {
  params: Promise<{ region: string; slug: string }>;
}) {
  const { region, slug } = await params;
  const [assets, hangarBg] = await Promise.all([
    loadOgAssets(),
    hangarBgDataUrl,
  ]);

  let name = slug;
  let subtitle = "World of Tanks tank stats";
  let tierLabel = "—";
  let classLabel = "—";
  let vehicleType: string | null = null;
  let renderDataUrl: string | null = null;
  let topNick: string | null = null;
  let topWnx: number | null = null;

  if (isRegion(region)) {
    const tank = await getTankBySlug(region, slug);
    if (tank) {
      const { meta, tankId } = tank;
      name = meta.name;
      vehicleType = meta.type;
      tierLabel = meta.tier ? toRoman(meta.tier) : String(meta.tier);
      classLabel = VEHICLE_CLASS_LABEL_FULL[meta.type] ?? meta.type;
      subtitle = `Tier ${tierLabel} ${meta.nation.toUpperCase()} ${classLabel.toLowerCase()}`;
      const tagSlug = meta.tag.toLowerCase();
      const [top, render] = await Promise.all([
        getTopPlayersByTank(region, tankId, "wnx", 1),
        fetchImageDataUrl(
          `https://eu-wotp.wgcdn.co/dcont/tankopedia_images/${tagSlug}/${tagSlug}_image.png`,
        ),
      ]);
      renderDataUrl = render;
      const best = top.results[0];
      if (best) {
        topNick = best.nickname;
        topWnx = best.value;
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
              gap: 20,
              padding: "20px 32px",
              borderLeft: "1px solid #3F3F46",
              fontSize: 34,
              fontWeight: 700,
            }}
          >
            <span style={{ color: "#f25322" }}>{tierLabel}</span>
            <span style={{ color: "#A1A1AA", fontWeight: 400, fontSize: 28 }}>
              {classLabel}
            </span>
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
          {/* Hangar-floor backdrop (the tankopedia detail scene). */}
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
          {/* High-res vehicle render sitting on the floor. */}
          {renderDataUrl && (
            <img
              src={renderDataUrl}
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
          {/* Left fade keeps the name legible over the render. */}
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
                  fontSize: 110,
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
              <span style={{ fontSize: 28, color: "#D4D4D8" }}>{subtitle}</span>
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
                {APP.NAME}/{region}/tanks/{slug}
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: "flex" }}>
          <StatCard label="Tier" value={tierLabel} bg={null} first />
          <StatCard
            label="Class"
            value={
              vehicleType ? (
                <VehicleTypeGlyph type={vehicleType} size={46} />
              ) : (
                classLabel
              )
            }
            bg={null}
          />
          <StatCard label="Best player" value={topNick ?? "—"} bg={null} />
          <StatCard
            label="Top WNX"
            value={topWnx !== null ? ratingFmt.format(topWnx) : "—"}
            bg={topWnx !== null ? RATING_BG[wnxColor(topWnx)] : null}
          />
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: ogFonts(assets) },
  );
}
