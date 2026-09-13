import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { mapChangesMetadata } from "@/app/[locale]/(site)/[region]/maps/changes/page";
import { MapChangesView } from "@/components/maps/list/changes/view";
import { paginatedMetadata } from "@/lib/metadata";
import { parsePageNumber } from "@/lib/page-number";
import { Region } from "@unicum.gg/wargaming";

// One page of the section above, at `/page/<n>`.
//
// Never the address a reader sees: `proxy.ts` rewrites `?page=<n>` here and
// sends this path back to the query form, so the section has one public URL per
// page and the canonical below declares that one. The route exists because a
// static page cannot read a query param, and a page of a leaderboard that only
// appears after hydration is a page no crawler ever reads.
//
// Nothing is prerendered at build: a board nobody reads past its first page
// costs nothing, and the ISR cache fills in whatever is actually asked for.
// `dynamicParams` is deliberately left alone (see the maps battle-type routes:
// with our own cache handler, turning it off answers a permanent 404).
export const dynamic = "force-static";
export const revalidate = 1800;

export function generateStaticParams() {
  return [];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; n: string }>;
}): Promise<Metadata> {
  const { locale, n } = await params;
  const page = parsePageNumber(n);
  if (page === null) return {};
  return paginatedMetadata(await mapChangesMetadata(Region.EU, locale), {
    page,
    locale,
  });
}

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; n: string }>;
}) {
  const { locale, n } = await params;
  const page = parsePageNumber(n);
  if (page === null) notFound();
  return (
    <MapChangesView locale={locale} region={Region.EU} page={page} />
  );
}
