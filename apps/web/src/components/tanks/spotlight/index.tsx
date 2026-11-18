"use client";

import type { z } from "zod";
import { ArrowRight } from "lucide-react";
import type { Region } from "@unicum.gg/wargaming";
import type { TankSpotlightResponse } from "@/app/api/[region]/tanks/spotlight/schema.api";
import Link from "@/components/link";
import { CommonTestBadge } from "@/components/entity/badges/common-test-badge";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelTitle,
} from "@/components/panel";
import { TankCard } from "@/components/tanks/tank-card";
import { useTranslation } from "@/hooks/use-translation";

export type SpotlightTankRow = z.infer<
  typeof TankSpotlightResponse
>["tanks"][number];

/** Four to a row at full width, so the eight make two. */
const CARD_SIZES = "(min-width: 1024px) 25vw, 50vw";

/**
 * The newest vehicles, at the top of the catalogue and on the home page: the
 * ones about to ship, then the ones that just did, each card saying which
 * update it arrived in. Which eight they are is the endpoint's business.
 */
export function TankSpotlight({
  region,
  tanks,
  moreHref,
}: {
  region: Region;
  tanks: SpotlightTankRow[];
  /** Where the rest of them are, for a page showing only the first few. */
  moreHref?: string;
}) {
  const { t } = useTranslation("components/tanks/spotlight");
  if (tanks.length === 0) return null;
  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>{t("title")}</PanelTitle>
      </PanelHeader>
      <PanelContent className="px-4 py-4">
        {/* `grid-cols-2` spelled out: an implicit column is sized to its
            content, which let a card grow past the page on a phone. */}
        <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {tanks.map(({ identity, releasedIn }) => (
            <li key={identity.tankId}>
              <TankCard
                region={region}
                identity={identity}
                sizes={CARD_SIZES}
                badge={releasedIn ? null : <CommonTestBadge size={14} />}
                caption={
                  releasedIn
                    ? t("update", { version: releasedIn })
                    : t("common-test")
                }
              />
            </li>
          ))}
        </ul>
        {moreHref ? (
          <div className="mt-3 flex justify-end">
            <Link
              href={moreHref}
              className="inline-flex items-center gap-1.5 text-xs text-fd-muted-foreground transition-colors hover:text-fd-foreground"
            >
              {t("see-all")}
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        ) : null}
      </PanelContent>
    </Panel>
  );
}
