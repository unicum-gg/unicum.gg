"use client";

import { MapOverlayColor } from "@/components/maps/change-format";
import { useTranslation } from "@/hooks/use-translation";
import { MapCompareSlider } from "./compare-slider";
import { MapImageDialog } from "./image-dialog";
import { MapLegendBand, MapPictureBadge } from "./legend-band";

/** One drawn change: where the ground moved, or what was built. */
export type MapOverlayLayer = {
  id: string;
  label: string;
  summary: string;
  base: string;
  layer: string;
  legend: { color: MapOverlayColor; label: string }[];
};

const SWATCH: Record<MapOverlayColor, string> = {
  [MapOverlayColor.Raised]: "#ff4628",
  [MapOverlayColor.Lowered]: "#288cff",
  [MapOverlayColor.Added]: "#30d158",
  [MapOverlayColor.Removed]: "#ff453a",
};

function Base({ src }: { src: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a mirror image shown as it is, like the gallery's fallbacks
    <img
      src={src}
      alt=""
      loading="lazy"
      draggable={false}
      className="absolute inset-0 size-full object-cover saturate-50"
    />
  );
}

function Layered({ shown }: { shown: MapOverlayLayer }) {
  return (
    <>
      <Base src={shown.base} />
      {/* eslint-disable-next-line @next/next/no-img-element -- the transparent layer drawn over it */}
      <img
        src={shown.layer}
        alt={shown.summary}
        loading="lazy"
        draggable={false}
        className="absolute inset-0 size-full object-cover"
      />
    </>
  );
}

function Legend({ shown, large }: { shown: MapOverlayLayer; large?: boolean }) {
  return (
    <MapLegendBand
      large={large}
      items={shown.legend.map(({ color, label }) => ({ label, color: SWATCH[color] }))}
    />
  );
}

/**
 * One change an update drew on the map (the ground reshaped, or the objects
 * built and pulled down), over its newer minimap, in the column beside the rows
 * that state it. A version that did both gets two pictures rather than one
 * behind a switch: stacked, the two layers cover each other.
 *
 * The picture opens at full size with a bar to drag across it, the bare map on
 * one side and the layer on the other, so what lies under a patch of colour can
 * be seen without losing where it was.
 */
export function MapOverlayPicture({
  shown,
  title,
  subtitle,
}: {
  shown: MapOverlayLayer;
  /** The map's name and the update, for the enlarged view's heading. */
  title: string;
  subtitle?: string;
}) {
  const { t } = useTranslation("components/maps/detail/history/image-dialog");
  return (
    <MapImageDialog
      title={title}
      subtitle={[subtitle, shown.label].filter(Boolean).join(" · ")}
      label={t("enlarge", { map: title })}
      preview={
        <span className="relative block aspect-square w-full overflow-hidden">
          <Layered shown={shown} />
          <MapPictureBadge>{shown.label}</MapPictureBadge>
          <Legend shown={shown} />
        </span>
      }
    >
      <MapCompareSlider
        before={<Base src={shown.base} />}
        after={<Layered shown={shown} />}
        beforeLabel={t("map-only")}
        afterLabel={shown.label}
        legend={<Legend shown={shown} large />}
      />
    </MapImageDialog>
  );
}
