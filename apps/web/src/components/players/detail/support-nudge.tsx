"use client";

import { XIcon } from "@phosphor-icons/react";
import { useState } from "react";
import useSWR from "swr";
import { SUPPORT_MIN_CENTS } from "@unicum.gg/shared";
import { Crest, CrestKind } from "@/components/entity/badges/crest";
import Link from "@/components/link";
import { Panel, PanelContent, PanelSeparator } from "@/components/panel";
import { Button } from "@/components/ui/button";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import STORAGE from "@/constants/storage";
import { useMoney } from "@/hooks/use-money";
import { useTranslation } from "@/hooks/use-translation";
import { unicum } from "@/services/sdk";

/** How long "not now" holds. Long enough that a player who said no is not
 * asked again on every visit, short enough that the ask comes back once the
 * bill has moved on. */
const SNOOZE_MS = 30 * 24 * 60 * 60 * 1000;

function snoozedUntil(): number {
  try {
    const raw = window.localStorage.getItem(
      STORAGE.LOCAL_STORAGE.SUPPORT_NUDGE_DISMISSED,
    );
    const at = raw ? Number(raw) : NaN;
    return Number.isFinite(at) ? at + SNOOZE_MS : 0;
  } catch {
    return 0;
  }
}

function snooze() {
  try {
    window.localStorage.setItem(
      STORAGE.LOCAL_STORAGE.SUPPORT_NUDGE_DISMISSED,
      String(Date.now()),
    );
  } catch {
    // Storage blocked: the panel just comes back next visit.
  }
}

/**
 * The support ask, on the one page where a reader has just been given
 * something: their own profile. Only the signed-in owner who holds no monthly
 * pledge ever sees it, and only on the client (the page is cached for
 * everyone), so it costs the public render nothing.
 *
 * It reads the same SWR entry as the top bar's funding bar, so it adds no
 * request. Someone who already gave once is thanked rather than asked from
 * scratch, since what they have not done is the recurring half, which is what
 * keeps the server bill covered.
 */
export function SupportNudge({ contributedCents }: { contributedCents: number }) {
  const { t } = useTranslation("components/players/detail/support-nudge");
  const money = useMoney();
  // Read straight from storage: this only mounts once the owner's support
  // status has arrived, never during hydration, so there is no server render
  // for it to disagree with.
  const [visible, setVisible] = useState(() => Date.now() >= snoozedUntil());
  const { data } = useSWR("support-funding", () => unicum.support.funding(), {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });

  if (!visible || !data) return null;

  const min = money.format(SUPPORT_MIN_CENTS / 100);
  const gave = contributedCents > 0;

  return (
    <>
      <PanelSeparator />
      <Panel>
        <PanelContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <span className="mt-0.5 shrink-0">
              <Crest kind={CrestKind.Supporter} size={28} />
            </span>
            <div className="flex min-w-0 flex-col gap-1.5">
              <p className="font-heading text-sm font-semibold">
                {t("title", { NAME: APP.NAME, pct: data.pct })}
              </p>
              <span className="relative h-1.5 w-full max-w-64 overflow-hidden rounded-full bg-fd-border/70">
                <span
                  className="absolute inset-y-0 left-0 rounded-full bg-brand"
                  style={{ width: `${data.pct}%` }}
                />
              </span>
              <p className="text-sm text-fd-muted-foreground">
                {gave
                  ? t("body-gave", {
                      given: money.format(contributedCents / 100),
                      min,
                    })
                  : t("body", {
                      NAME: APP.NAME,
                      received: money.format(data.receivedEur),
                      goal: money.format(data.goalEur),
                      min,
                    })}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 self-end sm:self-center">
            <Button asChild size="sm">
              <Link href={ROUTES.SUPPORT} prefetch="intent">
                {gave ? t("cta-gave") : t("cta")}
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              aria-label={t("dismiss")}
              title={t("dismiss")}
              onClick={() => {
                snooze();
                setVisible(false);
              }}
            >
              <XIcon className="size-4" />
            </Button>
          </div>
        </PanelContent>
      </Panel>
    </>
  );
}
