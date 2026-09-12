"use client";

import { useTranslation } from "@/hooks/use-translation";
import { CopySimpleIcon } from "@phosphor-icons/react";
import { useRouter } from "@/hooks/use-router";
import { toast } from "sonner";
import type { Region } from "@unicum.gg/wargaming";
import { TankSearchPopover } from "@/components/tanks/tank-search-popover";
import ROUTES from "@/constants/routes";
import { SETUP_PARAM } from "@/components/tanks/detail/specifications/config-url";

/**
 * Carry the current build to another vehicle: pick a target tank and open its
 * page with this tank's `setup` token applied. The token is tank-agnostic, so
 * the target's configurator keeps what it supports (equipment, consumables,
 * directives, crew skills/level, field-mod level) and resets what is vehicle-
 * specific (gun/shell, modules, role-slot categories) to stock. Rendered only
 * when a setup exists, alongside the share affordance.
 */
export function CopyToTank({
  region,
  slug,
  setupToken,
}: {
  region: Region;
  /** The current tank's slug, excluded from the target list. */
  slug: string;
  /** The current setup token (from `encodeSetup`). */
  setupToken: string;
}) {
  const { t } = useTranslation("components/tanks/detail/specifications/copy-to-tank");
  const router = useRouter();

  return (
    <TankSearchPopover
      region={region}
      excludeSlugs={new Set([slug])}
      onPick={(tank) => {
        router.push(
          `${ROUTES.TANK(region, tank.slug)}?${SETUP_PARAM}=${setupToken}`,
        );
        toast.success(`Build copied to ${tank.name}`);
      }}
      triggerAriaLabel={t("copy-build-to-another-tank")}
      tooltip={t("copy-build-to-another-tank")}
      placeholder={t("copy-to-tank")}
      triggerClassName="inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md border border-fd-border bg-fd-secondary/30 text-fd-muted-foreground transition-colors hover:bg-fd-secondary hover:text-fd-foreground"
      triggerContent={<CopySimpleIcon className="size-3.5" weight="bold" />}
    />
  );
}
