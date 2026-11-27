"use client";

import { CrosshairIcon, DownloadSimpleIcon } from "@phosphor-icons/react/dist/ssr";
import Link from "@/components/link";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import ROUTES from "@/constants/routes";
import { useTranslation } from "@/hooks/use-translation";

/**
 * The column beside the minimap when the positioning guide is not in it.
 *
 * The column stays either way, so the minimap keeps one width and one place
 * from map to map and from view to view: a guide closed by the reader offers
 * itself back, and a layout nobody has recorded a battle on says why there is
 * nothing to show and how that changes.
 */
export function GuideEmpty({
  available,
  retired,
  onOpen,
}: {
  /** Whether this layout has recorded battles, so the guide was only closed. */
  available: boolean;
  /** A map the game no longer ships, where no battle will ever be recorded. */
  retired: boolean;
  onOpen: () => void;
}) {
  const { t } = useTranslation("components/maps/detail/guide-empty");
  const state = available ? "closed" : retired ? "retired" : "none";
  return (
    <Empty className="h-full border-0">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <CrosshairIcon />
        </EmptyMedia>
        <EmptyTitle>{t(`${state}-title`)}</EmptyTitle>
        <EmptyDescription>{t(`${state}-body`)}</EmptyDescription>
      </EmptyHeader>
      {state === "closed" && (
        <EmptyContent>
          <Button variant="outline" size="sm" onClick={onOpen}>
            {t("open")}
          </Button>
        </EmptyContent>
      )}
      {state === "none" && (
        <EmptyContent>
          <Button size="sm" asChild>
            <Link href={ROUTES.MOD}>
              <DownloadSimpleIcon />
              {t("mod")}
            </Link>
          </Button>
        </EmptyContent>
      )}
    </Empty>
  );
}
