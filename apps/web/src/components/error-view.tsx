"use client";

import { buttonVariants } from "fumadocs-ui/components/ui/button";
import Link from "@/components/link";
import { useTranslation } from "@/hooks/use-translation";
import { styles } from "@/lib/styles";

// Shared "something went wrong" card, the error twin of `NotFoundView`. Every
// entity boundary (clan, player) renders the same two lines and the same pair
// of buttons, so they say it once here rather than four times in English.
//
// The button takes Next's `retry`, never `reset`: `reset` re-renders the
// segment from what the client already holds, so an error thrown while the
// server rendered it comes straight back and the button does nothing (a player
// reported exactly that). `retry` asks the server for the segment again.
//
// The digest is what the server logged the error under, so a reader who
// reports it hands us something to match in the logs rather than a screenshot.
export function ErrorView({
  retry,
  digest,
}: {
  retry: () => void;
  digest?: string;
}) {
  const { t } = useTranslation("components/error-view");

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col">
      <div
        className={`relative ${styles.borderX} ${styles.screenLines} flex flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center`}
      >
        <h1 className="font-heading text-3xl font-bold tracking-tight">
          {t("title")}
        </h1>
        <p className="max-w-md text-fd-muted-foreground">{t("description")}</p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={retry}
            className={`${buttonVariants({ variant: "primary" })} cursor-pointer`}
          >
            {t("try-again")}
          </button>
          <Link href="/" className={buttonVariants({ variant: "outline" })}>
            {t("back")}
          </Link>
        </div>
        {digest && (
          <p className="font-mono text-xs text-fd-muted-foreground">
            {t("reference", { digest })}
          </p>
        )}
      </div>
    </div>
  );
}
