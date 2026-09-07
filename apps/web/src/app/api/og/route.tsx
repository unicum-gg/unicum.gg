import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { BRAND_COLOR } from "@unicum.gg/shared";
import { BrandHeaderCell } from "@/components/og";
import {
  CREST_ASPECT,
  fitTextSize,
  loadOgAssets,
  loadOgCrest,
  OG_BG,
  OG_BORDER,
  OG_CACHE_CONTROL,
  OG_HEADER_HEIGHT,
  OG_SIZE,
  ogFonts,
} from "@/lib/og";

export const runtime = "nodejs";

// The title takes the largest size that keeps it on one line, because a two-line
// title is what makes a card look broken ("World of / Tanks"). It only wraps
// once even 78px cannot hold it on one line, which the clamp below bounds to two
// lines. The text runs over the crest rather than stopping short of it: the
// crest is barely off the background and the title is pure white, so nothing is
// lost by using the full width.
const TITLE_SIZES = [108, 98, 88, 78] as const;
const TITLE_WIDTH = 980;
const SUBTITLE_WIDTH = 820;

// Both strings come straight off the query string, so the card has to hold its
// shape for anything at all, not just for the text our own pages pass. The
// character limits bound the height, and `wordBreak` below bounds the width:
// a single word longer than the box has no break to wrap on, so without it a
// title of 16 W's runs straight off the right edge instead of wrapping.
const MAX_TITLE_CHARS = 32;
const MAX_SUBTITLE_CHARS = 72;

/** Cut on a word boundary where there is one close enough to the limit. */
function clamp(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

// The crest is sized past the card and anchored off the right edge, so what
// lands on the card is a crop of the mask rather than a logo sitting in a
// corner. It starts below the brand header rather than behind it: the header
// cell has no background of its own, so a crest running under it would show
// through the one element every card shares. It hangs off its own clipping box
// rather than off the card, because an absolute child overflowing the card
// paints OVER the shell's hairline border and eats the right edge of the frame.
// Pixel values, since the whole card is a fixed 1200x630.
const CREST_HEIGHT = 1020;
const CREST_RIGHT = -235;
const CREST_TOP = OG_HEADER_HEIGHT;

/**
 * Generic OG card
 * @description A generic 1200×630 PNG social card with a customizable title and subtitle, used as the link-unfurl image for pages without a dedicated per-entity card.
 * @queryParams ogTextQuery
 * @response ogImageResponse
 * @responseContentType image/png
 * @tag OG Images
 * @openapi
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const title = clamp(
    searchParams.get("title") ?? "World of Tanks",
    MAX_TITLE_CHARS,
  );
  const subtitle = clamp(
    searchParams.get("subtitle") ?? "player, clan & tank stats",
    MAX_SUBTITLE_CHARS,
  );

  const [assets, crestSrc] = await Promise.all([loadOgAssets(), loadOgCrest()]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          background: OG_BG,
          color: "#F5F5F5",
          fontFamily: "Figtree",
          border: OG_BORDER,
        }}
      >
        <div
          style={{
            display: "flex",
            position: "absolute",
            top: CREST_TOP,
            left: 0,
            right: 0,
            bottom: 0,
            overflow: "hidden",
          }}
        >
          <img
            src={crestSrc}
            height={CREST_HEIGHT}
            width={CREST_HEIGHT / CREST_ASPECT}
            alt=""
            style={{ position: "absolute", top: 0, right: CREST_RIGHT }}
          />
        </div>

        <div style={{ display: "flex", borderBottom: OG_BORDER }}>
          <div style={{ display: "flex", flex: 1 }} />
          <BrandHeaderCell logoSrc={assets.logoSrc} />
        </div>

        <div
          style={{
            display: "flex",
            flex: 1,
            flexDirection: "column",
            justifyContent: "flex-end",
            padding: "56px 56px 56px 60px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
            <div
              style={{
                display: "flex",
                width: 64,
                height: 5,
                background: BRAND_COLOR,
              }}
            />
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <span
                style={{
                  fontSize: fitTextSize(title, TITLE_WIDTH, TITLE_SIZES),
                  fontWeight: 700,
                  color: "#FFFFFF",
                  lineHeight: 0.98,
                  wordBreak: "break-word",
                  maxWidth: TITLE_WIDTH,
                }}
              >
                {title}
              </span>
              <span
                style={{
                  fontSize: 40,
                  color: "#A1A1AA",
                  lineHeight: 1.25,
                  wordBreak: "break-word",
                  maxWidth: SUBTITLE_WIDTH,
                }}
              >
                {subtitle}
              </span>
            </div>
          </div>
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
