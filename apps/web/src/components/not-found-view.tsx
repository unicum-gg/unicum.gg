"use client";

import { buttonVariants } from "fumadocs-ui/components/ui/button";
import Link from "@/components/link";
import { useTranslation } from "@/hooks/use-translation";
import { styles } from "@/lib/styles";

// Shared "page not found" card. Rendered by the root `not-found` (global
// unmatched URLs) and the `(site)` one (site-route `notFound()` without a closer
// boundary) so the 404 looks the same whether or not the site chrome is present.
//
// The entity boundaries (a clan tag, a player nickname) pass their own two
// lines, since "the same tag can exist on different servers" is the one thing
// worth saying there. They pass words rather than keys: each already reads its
// own namespace, and a component taking a key would have to be told which one.
export function NotFoundView({
  title,
  description,
}: {
  title?: string;
  description?: string;
} = {}) {
  const { t } = useTranslation("components/not-found-view");

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col">
      <div
        className={`relative ${styles.borderX} screen-line-before flex flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center`}
      >
        <h1 className="font-heading text-3xl font-bold tracking-tight">
          {title ?? t("title")}
        </h1>
        <p className="max-w-md text-fd-muted-foreground">
          {description ?? t("description")}
        </p>
        <Link href="/" className={buttonVariants({ variant: "primary" })}>
          {t("back")}
        </Link>
      </div>
    </div>
  );
}
