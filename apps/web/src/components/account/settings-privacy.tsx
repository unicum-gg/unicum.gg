"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useSWRConfig } from "swr";
import { useSession } from "@/lib/auth-client";
import Link from "@/components/link";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import ROUTES from "@/constants/routes";
import { useTranslation } from "@/hooks/use-translation";
import { wgIdentityFromEmail } from "@/lib/wg-session";
import { applyBattlesPrivacy } from "@/services/swr/battles-privacy";
import { SettingsRow } from "./settings-row";

type PrivacyState = {
  loggedIn: boolean;
  supporter: boolean;
  loadoutsHidden: boolean;
  battlesHidden: boolean;
};

/** The switches this section draws, named as `/api/account/me` names them. */
type PrivacySwitch = "loadoutsHidden" | "battlesHidden";

/**
 * What the account chooses to publish about itself.
 *
 * The loadouts the game mod uploads, first. They had no control on the site at
 * all: the flag has existed in `loadout_privacy` since the mod shipped and was
 * reachable only from the mod's own settings window, so a player who had
 * uninstalled it, or who was simply sitting at their profile, could not take
 * their builds off the tables that quote them.
 *
 * Then the battle list, which everybody may hide: it was asked for by players
 * whose team practice would otherwise be one profile tab away from whoever
 * they face next, and most of them have never installed the mod at all, since
 * a battle reaches us through whoever in it did.
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

  const { cache, mutate } = useSWRConfig();
  const { data: session } = useSession();
  const accountId = wgIdentityFromEmail(session?.user?.email)?.accountId;

  const toggle = useCallback(
    (key: PrivacySwitch, hidden: boolean) => {
      // Moved before the request and put back if it fails, so the switch
      // answers the press rather than the round trip. A switch that waits reads
      // as a switch that did not take.
      setState((prev) => (prev ? { ...prev, [key]: hidden } : prev));
      setSaving(true);
      fetch("/api/account/me", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ [key]: hidden }),
      })
        .then((r) => {
          if (!r.ok) throw new Error(String(r.status));
          // The profile under the dialog follows at once, rather than at the
          // next reload: the battle list appears or disappears as the switch
          // moves.
          if (key === "battlesHidden" && accountId !== undefined) {
            applyBattlesPrivacy(cache, mutate, accountId, hidden);
          }
        })
        .catch(() => {
          setState((prev) => (prev ? { ...prev, [key]: !hidden } : prev));
          toast.error(t("could-not-save"));
        })
        .finally(() => setSaving(false));
    },
    [t, cache, mutate, accountId],
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
      {/* First, as the one every player can use: the loadout switch below is
          a supporter's, and its note about what keeps counting closes the
          section because it is about that switch alone. */}
      <SettingsRow
        label={t("hide-battles")}
        description={t("hide-battles-description")}
      >
        <Switch
          checked={state.battlesHidden}
          onCheckedChange={(hidden) => toggle("battlesHidden", hidden)}
          disabled={saving}
          aria-label={t("hide-battles")}
        />
      </SettingsRow>
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
          onCheckedChange={(hidden) => toggle("loadoutsHidden", hidden)}
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
