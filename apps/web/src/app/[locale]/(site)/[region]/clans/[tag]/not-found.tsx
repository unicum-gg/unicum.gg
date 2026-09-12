"use client";

import { NotFoundView } from "@/components/not-found-view";
import { useTranslation } from "@/hooks/use-translation";

// The shared 404 card with this entity's own two lines. A client component so
// it can read the dictionary: Next renders `not-found` with no params, so there
// is no locale to hand a server component, and the provider above already
// carries the reader's.
export default function NotFound() {
  const { t } = useTranslation("app/clans/not-found");
  return <NotFoundView title={t("title")} description={t("description")} />;
}
