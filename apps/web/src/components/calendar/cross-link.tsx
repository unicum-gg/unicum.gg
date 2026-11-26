import { CalendarDotsIcon } from "@phosphor-icons/react/dist/ssr";
import type { Region } from "@unicum.gg/wargaming";
import { ArrowRight } from "lucide-react";
import Link from "@/components/link";
import { Panel } from "@/components/panel";
import ROUTES from "@/constants/routes";
import { getTranslation } from "@/lib/translations.server";

/**
 * A line pointing to the calendar, at the foot of the pages about something
 * the calendar dates (an Onslaught season, a Maneuvers edition, the tournaments,
 * the next update), so a reader asking "when is the next one" has somewhere to
 * go. A server component taking `locale`, since every page it sits on is one.
 */
export async function CalendarCrossLink({
  region,
  locale,
}: {
  region: Region;
  locale: string;
}) {
  const { t } = await getTranslation("components/calendar/cross-link", locale);
  return (
    <Panel>
      <Link
        href={ROUTES.CALENDAR(region)}
        className="group flex items-center gap-3 px-4 py-4 transition-colors hover:bg-fd-secondary/40"
      >
        <CalendarDotsIcon className="size-5 shrink-0 text-brand" />
        <span className="flex-1 text-sm">
          <span className="font-medium">{t("title")}</span>{" "}
          <span className="text-fd-muted-foreground">{t("body")}</span>
        </span>
        <ArrowRight className="size-4 shrink-0 text-fd-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </Link>
    </Panel>
  );
}
