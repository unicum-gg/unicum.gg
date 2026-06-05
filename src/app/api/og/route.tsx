import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { BrandHeaderCell } from "@/components/og";
import { loadOgAssets, OG_SIZE, ogFonts } from "@/lib/og";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const title = searchParams.get("title") ?? "World of Tanks";
  const subtitle = searchParams.get("subtitle") ?? "player & clan stats";

  const assets = await loadOgAssets();

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
          <div style={{ display: "flex", flex: 1 }} />
          <BrandHeaderCell logoSrc={assets.logoSrc} />
        </div>

        <div
          style={{
            display: "flex",
            flex: 1,
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "72px 56px 40px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <span
              style={{
                fontSize: 110,
                fontWeight: 700,
                lineHeight: 1.05,
                color: "#F5F5F5",
              }}
            >
              {title}
            </span>
            <span
              style={{
                fontSize: 110,
                fontWeight: 700,
                lineHeight: 1.05,
                color: "#A1A1AA",
              }}
            >
              {subtitle}
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
            <span>unicum.gg</span>
          </div>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: ogFonts(assets) },
  );
}
