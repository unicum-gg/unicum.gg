"use client";

import { buttonVariants } from "fumadocs-ui/components/ui/button";
import { useEffect } from "react";
import { ErrorView } from "@/components/error-view";
import Link from "@/components/link";
import { usePathname } from "@/hooks/use-pathname";
import { useTranslation } from "@/hooks/use-translation";
import {
  STILL_LOADING_ATTEMPTS,
  STILL_LOADING_RETRY_SECONDS,
} from "@/lib/still-loading";
import { styles } from "@/lib/styles";

/**
 * How many times each path has been asked again.
 *
 * At module scope rather than in state, because the boundary UNMOUNTS on every
 * retry: a failed attempt throws again and React remounts this component from
 * scratch, so anything held in a hook starts over and the bound would never be
 * reached. Keyed by path so two entities open in one session count separately,
 * and lost on reload, which is what a reader pressing F5 means anyway.
 */
const attempts = new Map<string, number>();

/**
 * What a reader sees while the endpoint is still assembling the entity.
 *
 * Not an error: the request that was refused is what started the assembly, and
 * the endpoint answered `Retry-After` (see `lib/still-loading`). So this waits
 * that long and asks again, up to `STILL_LOADING_ATTEMPTS` times, and only then
 * shows the error it would have shown straight away.
 *
 * The wait is here rather than on the server on purpose. Asking again from the
 * server would re-queue at the very gate that is shedding, while holding the
 * render open; asking again from the browser costs the server nothing until the
 * moment it asks, and by then the assembly the first request began has usually
 * published to the cache, which the endpoint re-reads before it reaches the
 * gate at all.
 */
export function AssemblingView({ retry }: { retry: () => void }) {
  const { t } = useTranslation("components/assembling-view");
  const pathname = usePathname();

  // Read during render and incremented when an attempt is actually MADE, so
  // there is no state to set from an effect and nothing to undo: React remounts
  // this component on every retry, so the counter in the module is the only
  // thing that carries across, and the mount simply reads where it stands.
  const exhausted =
    (attempts.get(pathname) ?? 0) >= STILL_LOADING_ATTEMPTS;

  useEffect(() => {
    if (exhausted) return;
    // Counted in the callback rather than beside it: Strict Mode mounts an
    // effect twice in development and clears the first timer before it fires,
    // so counting on schedule would spend half the budget on attempts nobody
    // made.
    const timer = setTimeout(() => {
      attempts.set(pathname, (attempts.get(pathname) ?? 0) + 1);
      retry();
    }, STILL_LOADING_RETRY_SECONDS * 1000);
    return () => clearTimeout(timer);
  }, [exhausted, pathname, retry]);

  if (exhausted) return <ErrorView retry={retry} />;

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
            {t("refresh-now")}
          </button>
          <Link href="/" className={buttonVariants({ variant: "outline" })}>
            {t("back")}
          </Link>
        </div>
      </div>
    </div>
  );
}
