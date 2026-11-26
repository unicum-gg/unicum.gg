"use client";

import { useTranslation } from "@/hooks/use-translation";
import { MapCompareSlider } from "./compare-slider";
import { MapImageDialog } from "./image-dialog";
import { MapPictureBadge } from "./legend-band";

function Picture({ src, alt }: { src: string; alt: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a mirror image shown as it is, like the gallery's fallbacks
    <img
      src={src}
      alt={alt}
      loading="lazy"
      draggable={false}
      className="absolute inset-0 size-full object-cover"
    />
  );
}

/**
 * The map as it was when it entered the game, beside the line that says when.
 *
 * Opened, it sits under the bar against the latest minimap, which is the
 * comparison a reader asking "what did it look like" is really making.
 */
export function LifecyclePicture({
  then,
  latest,
  label,
  title,
  subtitle,
}: {
  /** The minimap at that version. */
  then: string;
  /** The map's latest minimap. */
  latest: string;
  /** What `then` is (the version), for its badge and the bar's left side. */
  label: string;
  title: string;
  subtitle?: string;
}) {
  const { t } = useTranslation("components/maps/detail/history/image-dialog");
  return (
    <MapImageDialog
      title={title}
      subtitle={subtitle}
      label={t("enlarge", { map: title })}
      preview={
        <span className="relative block aspect-square w-full overflow-hidden">
          <Picture src={then} alt={label} />
          <MapPictureBadge>{label}</MapPictureBadge>
        </span>
      }
    >
      <MapCompareSlider
        before={<Picture src={then} alt={label} />}
        after={<Picture src={latest} alt={t("latest")} />}
        beforeLabel={label}
        afterLabel={t("latest")}
      />
    </MapImageDialog>
  );
}
