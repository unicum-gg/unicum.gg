import sharp from "sharp";
import { vehicleRenderUrl } from "@unicum.gg/shared";

// WG's tankopedia frames every vehicle at a consistent spot in its 1920x900
// render so the tracks land on the hangar-floor rail imprints. Our wot.assets
// mirror images are per-vehicle crops with wildly varying canvases and framing,
// so they can't drop into the hero as-is (some sit centre-left, some centre-
// right, some fill the frame). This re-composits a mirror onto a transparent
// 1920x900 canvas at that exact framing, producing an image in the SAME format
// as a WG portal render so the tank hero can `object-cover` it identically to a
// real render: no per-tank CSS, no drift.
//
// Anchoring is by the vehicle's ALPHA CENTROID (centre of mass), not its
// bounding-box centre. A long gun barrel extends the axis-aligned box far to one
// side, so centring the box shoves the hull off to the other (a long-barrel TD
// ends up too far right). The thin barrel carries little area, so the centroid
// stays on the hull/turret, which is what must sit on the rails. Targets measured
// across real portal renders: centroid x ~38.7% (sd 0.4pp), y ~55.6% (sd 1.4pp).
//
// Size is NOT fixed: a fixed width blows small tanks up to 2x their real portal
// size. WG sizes each tank individually, and the ratio between its portal box
// width (fraction of 1920) and its mirror box width (fraction of the mirror
// canvas) is empirically ~0.537 (measured on vehicles that publish both; sd
// ~9%), so we derive the target width from each tank's OWN mirror box. This
// route only ever runs for mirror-ONLY tanks (portal tanks use the real render),
// so there's no ground truth to hit exactly. We bias the ratio a touch below the
// mean (0.475) because WG's mirror crops are inconsistently zoomed (a given
// tank's mirror can be ~10% larger than its sibling's) and, in the full-frame
// hero, a slightly smaller vehicle sits on the hangar floor with its tracks
// alongside the rail imprints rather than covering them. Portal-backed tanks are
// unaffected (they never use this path), so this only shrinks the mirror outliers.
const W = 1920;
const H = 900;
const CENTROID_X = 0.387;
const CENTROID_Y = 0.556;
// portal-box-width-fraction / mirror-box-width-fraction, biased just below the
// ~0.537 mean to avoid oversizing inconsistently-zoomed mirror crops.
const MIRROR_TO_PORTAL_WIDTH_RATIO = 0.475;
// Ignore near-transparent antialiasing fringe when locating the vehicle.
const ALPHA_FLOOR = 30;

/**
 * Fetch the wot.assets mirror render for `tag` and re-frame it into WG's portal
 * layout (a transparent 1920x900 PNG matching `tankopedia_images/*`). Returns
 * the PNG bytes, or `null` when there is no mirror for the tag or the vehicle
 * can't be placed (the caller then falls back to WG's covered-vehicle
 * placeholder). Fails open: any fetch/decode error yields `null`, never throws.
 */
export async function normalizeVehicleRender(
  tag: string,
): Promise<Buffer | null> {
  let buf: Buffer;
  try {
    const res = await fetch(vehicleRenderUrl(tag));
    if (!res.ok) return null; // no mirror for this tag -> caller falls back
    buf = Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }

  try {
    // Bounding box of the (transparent-margined) vehicle within the mirror.
    const { info } = await sharp(buf)
      .trim({ threshold: 10 })
      .toBuffer({ resolveWithObject: true });
    const ox = -(info.trimOffsetLeft ?? 0);
    const oy = -(info.trimOffsetTop ?? 0);
    const bw = info.width;
    const bh = info.height;

    // Alpha centroid over the whole mirror canvas (mass-weighted; the thin barrel
    // barely moves it), plus the canvas width used to scale the box.
    const { data, info: raw } = await sharp(buf)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const stride = raw.channels;
    let sx = 0;
    let sy = 0;
    let sa = 0;
    for (let y = 0; y < raw.height; y++) {
      for (let x = 0; x < raw.width; x++) {
        const a = data[(y * raw.width + x) * stride + stride - 1];
        if (a > ALPHA_FLOOR) {
          sx += x * a;
          sy += y * a;
          sa += a;
        }
      }
    }
    if (sa === 0) return null; // fully transparent -> nothing to place
    const cx = sx / sa;
    const cy = sy / sa;

    // Scale the vehicle to WG's per-tank portal size (from its own box), then
    // place it so its centroid lands on the target anchor.
    const targetW = Math.round(
      MIRROR_TO_PORTAL_WIDTH_RATIO * (bw / raw.width) * W,
    );
    const scale = targetW / bw;
    const targetH = Math.round(bh * scale);
    // Centroid position within the scaled vehicle box.
    const vcx = (cx - ox) * scale;
    const vcy = (cy - oy) * scale;
    const left = Math.round(CENTROID_X * W - vcx);
    const top = Math.round(CENTROID_Y * H - vcy);

    const vehicle = await sharp(buf)
      .extract({ left: ox, top: oy, width: bw, height: bh })
      .resize(targetW, targetH)
      .png()
      .toBuffer();

    // The barrel can extend off the canvas (exactly as WG's long-gun renders do),
    // and sharp's composite rejects negative offsets, so crop the vehicle to its
    // on-canvas region and composite at the clamped offset.
    const cropLeft = Math.max(0, -left);
    const cropTop = Math.max(0, -top);
    const cropW = Math.min(targetW - cropLeft, W - Math.max(0, left));
    const cropH = Math.min(targetH - cropTop, H - Math.max(0, top));
    if (cropW <= 0 || cropH <= 0) return null; // placed entirely off-frame
    const clipped = await sharp(vehicle)
      .extract({ left: cropLeft, top: cropTop, width: cropW, height: cropH })
      .png()
      .toBuffer();

    return await sharp({
      create: {
        width: W,
        height: H,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([
        { input: clipped, left: Math.max(0, left), top: Math.max(0, top) },
      ])
      .png()
      .toBuffer();
  } catch {
    return null;
  }
}
