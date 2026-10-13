"use client";

import { useLocale } from "@onruntime/translations/react";
import { SealCheckIcon, WarningCircleIcon } from "@phosphor-icons/react/dist/ssr";
import { useTranslation } from "@/hooks/use-translation";
import { LoginButton } from "@/components/login-button";
import { Button } from "@/components/ui/button";
import ROUTES from "@/constants/routes";
import type { Region } from "@unicum.gg/wargaming";

/**
 * What the figure above it was priced from, which is the one thing this page
 * had no way to say.
 *
 * Wargaming answers a stranger with a row per vehicle the account has ever had
 * and `in_garage: null` on every one of them, so an unverified reading prices
 * vehicles sold years ago (60 of 185 on a measured account) and misses every
 * vehicle bought and never driven. Only the account's own access token turns
 * that into a real garage, which is why the unverified state ends in an
 * invitation rather than in an apology: signing in is not a nag here, it is the
 * only thing that can answer the question the page is asking.
 *
 * Shown to every visitor, not only to the owner: one sign-in makes the profile
 * right for everybody, so a reader who lands on an unverified account is being
 * told what they are looking at, and a reader who lands on a verified one is
 * being told the figure is real.
 */
export function GarageVerification({
  region,
  nickname,
  verifiedAt,
}: {
  region: Region;
  nickname: string;
  /** ISO timestamp of the last reading, or null when there has never been one. */
  verifiedAt: string | null | undefined;
}) {
  const { locale } = useLocale();
  const { t } = useTranslation("components/players/detail/value/verification");

  if (verifiedAt) {
    const date = new Date(verifiedAt);
    return (
      <div className="flex items-start gap-2 rounded-md border border-emerald-500/25 bg-emerald-500/5 px-3 py-2">
        <SealCheckIcon
          weight="duotone"
          className="mt-0.5 size-4 shrink-0 text-emerald-500"
        />
        <p className="text-xs leading-relaxed text-fd-muted-foreground">
          <span className="font-medium text-fd-foreground">
            {t("verified-garage")}
          </span>{" "}
          {t("confirmed-by-the-owner-on", {
            date: new Intl.DateTimeFormat(locale, {
              dateStyle: "long",
            }).format(date),
          })}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-fd-border bg-fd-muted/30 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-2">
        <WarningCircleIcon
          weight="duotone"
          className="mt-0.5 size-4 shrink-0 text-amber-500"
        />
        <p className="text-xs leading-relaxed text-fd-muted-foreground">
          <span className="font-medium text-fd-foreground">
            {t("unverified-garage")}
          </span>{" "}
          {t("counts-every-vehicle-ever-driven")}
        </p>
      </div>
      <LoginButton
        callbackURL={ROUTES.PLAYER_VALUE(region, nickname)}
      >
        <Button size="sm" variant="outline" className="shrink-0">
          {t("verify-my-garage")}
        </Button>
      </LoginButton>
    </div>
  );
}
