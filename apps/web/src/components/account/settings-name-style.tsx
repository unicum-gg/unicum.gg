"use client";

import { DiceFiveIcon, LockSimpleIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { toast } from "sonner";
import { useSWRConfig } from "swr";
import {
  DEFAULT_NAME_STYLE,
  NameColor,
  NameEffect,
  NameFont,
  type NameStyle,
} from "@unicum.gg/shared";
import { Crest, CrestKind } from "@/components/entity/badges/crest";
import Link from "@/components/link";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import ROUTES from "@/constants/routes";
import { useAccount, type AccountState } from "@/hooks/use-account";
import { useTranslation } from "@/hooks/use-translation";
import { useSession } from "@/lib/auth-client";
import type { unicum } from "@/services/sdk";
import { NameStyleChoices } from "./name-style/choices";
import { NameStylePreview } from "./name-style/preview";
import { SettingsSkeleton } from "./settings-skeleton";

type SupporterTiers = Awaited<ReturnType<typeof unicum.support.tiers>>;

function pick<T>(values: T[]): T {
  return values[Math.floor(Math.random() * values.length)];
}

/** A style drawn at random, for the reader who wants to be shown one. */
function surprise(): NameStyle {
  const colors = Object.values(NameColor);
  const color = pick(colors);
  return {
    font: pick(Object.values(NameFont)),
    effect: pick(Object.values(NameEffect)),
    color,
    color2: pick(colors.filter((c) => c !== color)),
  };
}

/**
 * How the account's nickname is drawn across the site, chosen the way Discord
 * has members choose theirs: the reader's own profile and leaderboard row
 * redrawn as they pick, and nothing applied until asked.
 *
 * **Open to everybody, kept by supporters.** A reader who does not support the
 * site can try every font, effect and colour on their own name, which is the
 * whole pitch; what is locked is applying it, and the lock says where to go.
 * Same reasoning as the privacy switches beside it, drawn for everybody and
 * disabled for a non-supporter: hiding the section would hide the feature from
 * exactly the people it is offered to.
 */
export function SettingsNameStyle() {
  const { t } = useTranslation("components/account/settings");
  const { data: account, mutate: mutateAccount } = useAccount();
  const { data: session } = useSession();
  const { mutate } = useSWRConfig();
  const saved = account?.nameStyle ?? null;
  const [draft, setDraft] = useState<NameStyle | null>(null);
  const [busy, setBusy] = useState(false);
  const style = draft ?? saved ?? DEFAULT_NAME_STYLE;

  if (!account || !account.wargaming || !session?.user?.name) {
    return <SettingsSkeleton rows={3} />;
  }
  const nickname = session.user.name;
  const region = account.wargaming.region;
  const isSupporter = account.supporter;

  async function save(next: NameStyle | null) {
    setBusy(true);
    try {
      const res = await fetch("/api/support/name-style", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ style: next }),
      });
      if (!res.ok) throw new Error(String(res.status));
      void mutateAccount(
        (prev: AccountState | undefined) =>
          prev ? { ...prev, nameStyle: next } : prev,
        { revalidate: false },
      );
      setDraft(null);
      // Every nickname on the site reads this entry. It is written in place
      // rather than refetched: the endpoint is served with a five-minute
      // max-age, so a refetch reads the browser's copy, the old style.
      const key = nickname.toLowerCase();
      void mutate(
        "support-tiers",
        (prev: SupporterTiers | undefined) =>
          prev && {
            ...prev,
            supporters: prev.supporters.map((s) =>
              s.region === region && s.nickname.toLowerCase() === key
                ? { ...s, style: next }
                : s,
            ),
          },
        { revalidate: false },
      );
      toast.success(next ? t("name-style-saved") : t("name-style-cleared"));
    } catch {
      toast.error(t("could-not-save"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-6 pt-2">
      <div className="flex flex-col gap-0.5">
        <p className="font-heading text-base font-semibold">{t("name-style-title")}</p>
        <p className="text-xs text-fd-muted-foreground">{t("name-style-description")}</p>
      </div>
      <NameStylePreview region={region} nickname={nickname} style={style} />
      <NameStyleChoices
        style={style}
        onChange={(patch) => setDraft({ ...style, ...patch })}
      />
      {/* The bar stays in reach at the foot of the pane however far the
          choices scroll, which is where Discord keeps its own. */}
      <div className="sticky -bottom-4 -mx-5 -mb-4 flex flex-wrap items-center justify-end gap-2 border-t border-fd-border bg-background px-5 py-3">
        {isSupporter ? (
          saved && (
            <Button
              variant="ghost"
              size="sm"
              className="mr-auto"
              disabled={busy}
              onClick={() => save(null)}
            >
              {t("name-style-clear")}
            </Button>
          )
        ) : (
          <p className="mr-auto flex items-center gap-2 text-xs text-fd-muted-foreground">
            <Crest kind={CrestKind.Supporter} size={16} />
            {t("name-style-locked")}
          </p>
        )}
        <Button variant="secondary" size="sm" onClick={() => setDraft(surprise())}>
          <DiceFiveIcon className="size-4" />
          {t("name-style-surprise")}
        </Button>
        {isSupporter ? (
          <Button
            size="sm"
            disabled={busy || draft === null}
            onClick={() => save(style)}
          >
            {busy ? <Spinner /> : t("name-style-apply")}
          </Button>
        ) : (
          <Button size="sm" asChild>
            <Link href={ROUTES.SUPPORT} prefetch="intent">
              <LockSimpleIcon className="size-4" weight="bold" />
              {t("name-style-unlock")}
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
