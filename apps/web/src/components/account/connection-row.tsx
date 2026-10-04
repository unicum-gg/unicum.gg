"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useTranslation } from "@/hooks/use-translation";
import { useFormat } from "@/hooks/use-format";
import type { ConnectableProvider } from "@unicum.gg/shared";

const DATE_PATTERN = "d MMM yyyy";

/** Everything one row needs that is not the account's own state. */
export type ConnectionCopy = {
  /** The service's own name, which is a proper noun and never translated. */
  name: string;
  /** What this connection is for, in one line. */
  purpose: string;
  /** What disconnecting actually gives up, named before the button is pressed
   * rather than discovered afterwards. */
  consequence: string;
};

/**
 * One connectable account.
 *
 * The confirm is the row itself rather than a dialog, which is not only a
 * matter of weight: this list is already inside one, and a second overlay on
 * top of the first is two scrims, two focus traps and an escape key that means
 * different things depending on how far in you are. Expanding in place keeps
 * the other rows visible, which is what a reader about to give something up
 * should be able to see.
 *
 * Confirmed at all, unlike the rating withdrawal elsewhere on the site, because
 * the consequence is somewhere the reader cannot see from here: dropping Twitch
 * delists the channel from the live rail, dropping Discord gives the supporter
 * role up.
 */
export function ConnectionRow({
  provider,
  copy,
  icon,
  connectedSince,
  /** The connected account as a reader recognises it (a channel, a handle), or
   * null when we hold the link but could not resolve a name for it. */
  accountLabel,
  /** What starts the OAuth when nothing is connected. */
  onConnect,
  onDisconnected,
}: {
  provider: ConnectableProvider;
  copy: ConnectionCopy;
  icon: ReactNode;
  connectedSince: Date | null;
  accountLabel: string | null;
  onConnect: () => void;
  onDisconnected: () => void;
}) {
  const { t } = useTranslation("components/account/connections");
  const { date } = useFormat();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const connected = connectedSince !== null;

  async function disconnect() {
    setBusy(true);
    try {
      const res = await fetch(`/api/disconnect/${provider}`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(String(res.status));
      setConfirming(false);
      toast.success(t("disconnected", { name: copy.name }));
      onDisconnected();
    } catch {
      toast.error(t("could-not-disconnect", { name: copy.name }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border-b border-fd-border py-3 last:border-b-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-fd-secondary/40 text-fd-muted-foreground">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-sm font-medium">{copy.name}</span>
            {connected && accountLabel ? (
              <span className="truncate text-xs text-fd-muted-foreground">
                {accountLabel}
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-xs text-fd-muted-foreground">
            {connected
              ? t("connected-since", {
                  date: date(DATE_PATTERN).format(connectedSince),
                })
              : copy.purpose}
          </p>
        </div>
        {connected ? (
          <Button
            size="sm"
            variant="ghost"
            // `aria-expanded` is honest here (the panel below is this
            // button's disclosure), but the ghost variant styles that state
            // with the foreground colour, which repainted the one destructive
            // control on the page as a primary one the moment it was armed.
            className="text-destructive hover:text-destructive aria-expanded:text-destructive"
            onClick={() => setConfirming((open) => !open)}
            aria-expanded={confirming}
          >
            {t("disconnect")}
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={onConnect}>
            {t("connect")}
          </Button>
        )}
      </div>

      {confirming ? (
        <div className="mt-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
          <p className="text-sm font-medium">
            {t("disconnect-name", { name: copy.name })}
          </p>
          <p className="mt-1 text-xs text-fd-muted-foreground">
            {copy.consequence}
          </p>
          <div className="mt-3 flex items-center gap-2">
            <Button
              size="sm"
              variant="destructive"
              onClick={disconnect}
              disabled={busy}
            >
              {busy ? <Spinner /> : null}
              {t("disconnect")}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setConfirming(false)}
              disabled={busy}
            >
              {t("cancel")}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
