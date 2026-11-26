import type { Metadata } from "next";
import { calendarMetadata } from "@/app/[locale]/(site)/[region]/calendar/page";
import { CalendarView } from "@/components/calendar";
import { Region } from "@unicum.gg/wargaming";
import { withDictionaries } from "@/components/dictionaries";

// EU shortcut: /calendar renders the same page as /eu/calendar. ISR on the same
// window as the regional one.
export const dynamic = "force-static";
export const revalidate = 600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return calendarMetadata(Region.EU, locale);
}

async function CalendarPageEU({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <CalendarView locale={locale} region={Region.EU} />;
}

export default withDictionaries("[locale]/(site)/calendar", CalendarPageEU);
