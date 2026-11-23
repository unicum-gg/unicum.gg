"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Interpolate } from "@/components/interpolate";
import { ClanTag } from "@/components/entity/clan-tag";
import { Switch } from "@/components/ui/switch";
import APP from "@/constants/app";
import { useTranslation } from "@/hooks/use-translation";

/** A clan as `/api/support/me` names it. */
export type SupportBoxClan = { region: string; id: number; tag: string; color: string };

/**
 * "Count my support for [TAG]": puts the supporter's pledge behind their
 * current clan, which then shows on the clan's page and on the clans board.
 * Only offered to a player who is in a clan, and only ever for that clan (the
 * endpoint reads it from our player row, never from this request).
 */
export function ClanSupportSwitch({
  currentClan,
  supportClan,
  onChange,
}: {
  currentClan: SupportBoxClan;
  supportClan: SupportBoxClan | null;
  onChange: (clan: SupportBoxClan | null) => void;
}) {
  const { t } = useTranslation("components/support/clan-switch");
  const [busy, setBusy] = useState(false);
  const checked =
    !!supportClan &&
    supportClan.region === currentClan.region &&
    supportClan.id === currentClan.id;

  async function toggle(next: boolean) {
    setBusy(true);
    onChange(next ? currentClan : null);
    try {
      const res = await fetch("/api/support/clan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dedicate: next }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { clan: SupportBoxClan | null };
      onChange(data.clan);
    } catch {
      onChange(supportClan);
      toast.error(t("could-not-update"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm">
          <Interpolate
            template={t("count-it-for")}
            values={{
              clan: (
                <ClanTag
                  tag={currentClan.tag}
                  color={currentClan.color}
                  className="font-mono font-semibold"
                />
              ),
            }}
          />
        </span>
        <Switch checked={checked} disabled={busy} onCheckedChange={toggle} />
      </div>
      <p className="text-xs text-fd-muted-foreground">
        {t("what-it-does", { NAME: APP.NAME })}
      </p>
    </div>
  );
}
