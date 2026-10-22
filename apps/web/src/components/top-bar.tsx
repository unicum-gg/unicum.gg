"use client";

import Link from "@/components/link";
import ROUTES from "@/constants/routes";
import { useTranslation } from "@/hooks/use-translation";
import { FeedbackWidget } from "./feedback/feedback-widget";
import { LoginWidget } from "./login-widget";
import { MiniFundingBar } from "./support/mini-funding-bar";
import { PlayersOnline } from "./players-online";

/**
 * The persistent top strip over a subtle accent gradient: players online on the
 * left, the community funding bar in the middle, and the "Support us" CTA plus
 * the login widget on the right. Present on every page so the funding progress
 * and call to action are always in view.
 *
 * A Client Component, so its label reads the interface language off the context
 * rather than needing it threaded in: the 404 boundary renders this chrome and
 * has no route params to read the language from.
 */
export function TopBar({ feedbackEnabled }: { feedbackEnabled: boolean }) {
  const { t } = useTranslation("components/top-bar");

  return (
    <div className="border-b border-fd-border bg-fd-background">
      <div className="mx-auto w-full max-w-7xl">
        <div className="relative flex h-9 items-center justify-between gap-2 border-x border-fd-border px-4 text-xs sm:gap-3">
          {/* The slot stays even when the counter has nothing to show, so
              `justify-between` still has a left edge to push the right-hand
              group against. Without it, a Wargaming outage moves "Support
              us" and the login widget across to the other side of the
              strip, which reads as a different page rather than as a
              missing number. */}
          <div className="shrink-0">
            <PlayersOnline />
          </div>
          {/* `min-w-0` so the signed-in nickname is what truncates when the
              strip runs out of room, rather than the row overflowing the page
              and taking the horizontal scrollbar with it. */}
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            {/* /support is also linked from the footer; the persistent
                top-bar CTA doesn't need to prefetch it too. It is the only
                place the navigation offers it, the "More" menu included.
                Said here for years and never actually set, so the page was
                still fetching the whole of /support on every view. */}
            <Link
              href={ROUTES.SUPPORT}
              prefetch="intent"
              className="shrink-0 font-medium text-brand-strong transition-opacity hover:opacity-80"
            >
              {t("support")}
            </Link>
            {feedbackEnabled && <FeedbackWidget />}
            <LoginWidget />
          </div>
          {/* Centered on the container (page content) rather than the leftover
              space between the two asymmetric sides. Hidden on small screens
              where the sides would leave no room. */}
          <div className="pointer-events-none absolute inset-0 hidden items-center justify-center md:flex">
            <div className="pointer-events-auto">
              <MiniFundingBar />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
