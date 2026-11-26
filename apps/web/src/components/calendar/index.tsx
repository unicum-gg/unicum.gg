import {
  CalendarKind,
  calendarKind,
  calendarTitle,
  isCalendarMoment,
} from "@unicum.gg/shared";
import { REGION_EMOJI, REGION_LABEL, type Region } from "@unicum.gg/wargaming";
import type { z } from "zod";
import type { CalendarResponse } from "@/app/api/[region]/calendar/schema.api";
import { DiscordOffer, type DiscordOfferEvent } from "@/components/discord/offer";
import { DiscordOfferKind } from "@/components/discord/offer-kind";
import { Interpolate } from "@/components/interpolate";
import { JsonLd } from "@/components/json-ld";
import { Panel, PanelContent, PanelSeparator } from "@/components/panel";
import { dateFormat } from "@/lib/format";
import { calendarEventSchema } from "@/lib/schema-org";
import { getTranslation } from "@/lib/translations.server";
import { buildSafe, unicum } from "@/services/sdk";
import { CalendarBoard } from "./board";

type Calendar = z.infer<typeof CalendarResponse>;

/**
 * The entry the Discord offer's preview announces: what is on now and ends
 * first, else the next to start, else the latest. Updates are moments, so they
 * never count as on now.
 */
function featuredEntry(entries: Calendar["entries"], now: Date): DiscordOfferEvent | null {
  const span = (e: Calendar["entries"][number]) => !isCalendarMoment(e.start, e.end);
  const live = entries
    .filter((e) => span(e) && e.start <= now && e.end > now)
    .sort((a, b) => a.end.getTime() - b.end.getTime());
  const next = entries
    .filter((e) => e.start > now)
    .sort((a, b) => a.start.getTime() - b.start.getTime());
  const entry = live[0] ?? next[0] ?? entries.at(-1);
  if (!entry) return null;
  // The card as the bot posts it: in English, the server's language.
  return {
    title: entry.title,
    category: entry.category,
    color: entry.color,
    start: entry.start,
    end: entry.end,
    banner: entry.banner ?? entry.thumbnail,
  };
}

/**
 * The calendar page for one region: Wargaming's official calendar, as we
 * recorded it.
 *
 * The portal shows the current week and forgets it, so what this page adds is
 * the record: what ran, when, on which region, kept from the day the capture
 * started. Everything is rendered from one payload, and the list and month
 * views switch client-side so the page stays static.
 */
export async function CalendarView({ region, locale }: { region: Region; locale: string }) {
  const { t } = await getTranslation("components/calendar/index", locale);
  const calendar = (await buildSafe(() => unicum.region(region).calendar(), {
    region,
    recordedSince: null,
    entries: [],
  })) as Calendar;
  const label = REGION_LABEL[region];
  const renderedAt = new Date();
  // Marked up: the in-game events still to come or running. Never the sales,
  // updates or Battle Pass seasons, which Google does not accept as events
  // (see `calendarEventSchema`), and never the past, which no search result
  // would show.
  const events = calendar.entries.filter(
    (entry) => calendarKind(entry.icon) === CalendarKind.Event && entry.end > renderedAt,
  );

  return (
    <div className="mx-auto w-full max-w-7xl">
      {events.map((entry) => (
        <JsonLd
          key={entry.id}
          data={calendarEventSchema({
            name: calendarTitle(entry.titles, locale, entry.title),
            start: entry.start,
            end: entry.end,
            link: entry.link,
            image: entry.banner ?? entry.thumbnail,
            description: t("event-description", { label }),
          })}
        />
      ))}
      <Panel>
        <PanelContent className="px-4 py-12 text-center">
          <div className="mb-2 text-sm uppercase tracking-wide text-fd-muted-foreground">
            {REGION_EMOJI[region]} {label}
          </div>
          <h1 className="font-heading text-4xl font-bold tracking-tight md:text-5xl">
            <Interpolate
              template={t("title")}
              values={{ calendar: <span className="text-brand">{t("calendar")}</span> }}
            />
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-fd-muted-foreground">
            {t("intro", { label })}
          </p>
          {calendar.recordedSince ? (
            <p className="mx-auto mt-2 max-w-2xl text-sm text-fd-muted-foreground">
              {t("recorded-since", {
                date: dateFormat(locale, "d MMMM yyyy").format(calendar.recordedSince),
              })}
            </p>
          ) : null}
        </PanelContent>
      </Panel>

      <PanelSeparator />

      <CalendarBoard
        entries={calendar.entries}
        renderedAt={renderedAt}
        recordedSince={calendar.recordedSince}
      />

      <PanelSeparator />
      <Panel>
        <DiscordOffer
          kind={DiscordOfferKind.Events}
          name=""
          region={region}
          event={featuredEntry(calendar.entries, renderedAt)}
        />
      </Panel>
    </div>
  );
}
