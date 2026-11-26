"use client";

import { GlossaryLabel } from "@/components/glossary/label";
import { useTranslation } from "@/hooks/use-translation";
import { MapCompareSlider } from "./compare-slider";
import { MapImageDialog } from "./image-dialog";
import { MapPictureBadge } from "./legend-band";

type Image = { src: string; label: string };

function Picture({ image, className }: { image: Image; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a mirror image shown as it is, like the gallery's fallbacks
    <img
      src={image.src}
      alt={image.label}
      loading="lazy"
      draggable={false}
      className={className ?? "aspect-square w-full object-cover"}
    />
  );
}

/**
 * A redrawn minimap, as the two images side by side. The change is the
 * picture, so the row shows it rather than describing it; either image opens
 * both stacked at full size, with a bar to drag between them, which is where a
 * reader finds what moved.
 */
export function MinimapRedrawnRow({
  label,
  summary,
  images,
  title,
  subtitle,
}: {
  label: string;
  summary: string;
  images: { before: Image; after: Image };
  /** The map's name and the update, for the enlarged view's heading. */
  title: string;
  subtitle?: string;
}) {
  const { t } = useTranslation("components/maps/detail/history/image-dialog");
  return (
    <li className="flex flex-col gap-2 px-4 py-2.5 text-sm">
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-fd-muted-foreground">
          <GlossaryLabel>{label}</GlossaryLabel>
        </span>
        <span className="font-medium">{summary}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {[images.before, images.after].map((image) => (
          <MapImageDialog
            key={image.src}
            title={title}
            subtitle={subtitle}
            label={t("enlarge", { map: title })}
            preview={
              <span className="relative block overflow-hidden rounded border border-fd-border">
                <Picture image={image} />
                <MapPictureBadge>{image.label}</MapPictureBadge>
              </span>
            }
          >
            <MapCompareSlider
              before={<Picture image={images.before} className="size-full object-cover" />}
              after={<Picture image={images.after} className="size-full object-cover" />}
              beforeLabel={images.before.label}
              afterLabel={images.after.label}
            />
          </MapImageDialog>
        ))}
      </div>
    </li>
  );
}
