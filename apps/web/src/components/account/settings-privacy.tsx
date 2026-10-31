"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import Link from "@/components/link";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import ROUTES from "@/constants/routes";
import { useTranslation } from "@/hooks/use-translation";
import { SettingsRow } from "./settings-row";

type PrivacyState = {
  loggedIn: boolean;
  supporter: boolean;
  loadoutsHidden: boolean;
};

/**
 * What the account chooses to publish about itself.
 *
 * One switch today, the loadouts the game mod uploads. It had no control on the
 * site at all: the flag has existed in `loadout_privacy` since the mod shipped
 * and was reachable only from the mod's own settings window, so a player who
 * had uninstalled it, or who was simply sitting at their profile, could not
 * take their builds off the tables that quote them.
 *
 * The switch is drawn for everybody and disabled for a non-supporter, rather
 * than hidden from them. Hiding it is what makes a feature invisible to exactly
 * the people it is offered to, and the row is also the only place the site says
 * this choice exists at all.
 */
export function SettingsPrivacy() {
  const { t } = useTranslation("components/account/settings");
  const [state, setState] = useState<PrivacyState | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/account/me")
      .then((r) => r.json() as Promise<PrivacyState>)
      .then((data) => {
        if (alive) setState(data);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const toggle = useCallback(
    (hidden: boolean) => {
      // Moved before the request and put back if it fails, so the switch
      // answers the press rather than the round trip. A switch that waits reads
      // as a switch that did not take.
      setState((prev) => (prev ? { ...prev, loadoutsHidden: hidden } : prev));
      setSaving(true);
      fetch("/api/account/me", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ loadoutsHidden: hidden }),
      })
        .then((r) => {
          if (!r.ok) throw new Error(String(r.status));
        })
        .catch(() => {
          setState((prev) =>
            prev ? { ...prev, loadoutsHidden: !hidden } : prev,
          );
          toast.error(t("could-not-save"));
        })
        .finally(() => setSaving(false));
    },
    [t],
  );

  if (!state) {
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-fd-muted-foreground">
        <Spinner />
        {t("loading")}
      </div>
    );
  }

  return (
    <div>
      <SettingsRow
        label={t("hide-loadouts")}
        description={
          state.supporter ? (
            t("hide-loadouts-description")
          ) : (
            <>
              {t("hide-loadouts-description")}{" "}
              <Link
                href={ROUTES.SUPPORT}
                className="text-fd-foreground underline underline-offset-2"
              >
                {t("supporters-only")}
              </Link>
            </>
          )
        }
      >
        <Switch
          checked={state.loadoutsHidden}
          onCheckedChange={toggle}
          disabled={!state.supporter || saving}
          aria-label={t("hide-loadouts")}
        />
      </SettingsRow>
      {/* Said in the section rather than in the row above, because it is about
          what the switch does NOT do: the uploads carry on and the figures keep
          their sample, which is the half a reader would otherwise assume they
          had just turned off. Unticking the mod's own sharing is the other
          thing, and it deletes. */}
      <p className="mt-4 text-xs text-fd-muted-foreground">
        {t("loadouts-still-counted")}
      </p>
    </div>
  );
}
