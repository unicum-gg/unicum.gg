import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { playerMarksMetadata } from "@/app/[locale]/(site)/[region]/players/marks/page";
import { MarksLandingView } from "@/components/players/list/marks/view";
import PAGINATION from "@/constants/pagination";
import ROUTES from "@/constants/routes";
import { paginatedMetadata } from "@/lib/metadata";
import { parsePageNumber } from "@/lib/page-number";
import { localizePath } from "@/lib/translations";
import { isRegion, Region } from "@unicum.gg/wargaming";

// One page of the section above, at `/page/<n>`.
//
// Never the address a reader sees: `proxy.ts` rewrites `?page=<n>` here and
// sends this path back to the query form, so the section has one public URL per
// page and the canonical below declares that one. The route exists because a
// static page cannot read a query param, and a page of a leaderboard that only
// appears after hydration is a page no crawler ever reads.
export const dynamic = "force-static";
export const revalidate = 1800;

export function generateStaticParams() {
  return [];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; region: string; n: string }>;
}): Promise<Metadata> {
  const { locale, region, n } = await params;
  const page = parsePageNumber(n);
  if (page === null || !isRegion(region)) return {};
  return paginatedMetadata(await playerMarksMetadata(region, locale), {
    page,
    locale,
  });
}

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; region: string; n: string }>;
}) {
  const { locale, region, n } = await params;
  const page = parsePageNumber(n);
  if (page === null || !isRegion(region)) notFound();
  // EU reads at the region-less address, its pages included, like the section.
  if (region === Region.EU) {
    redirect(
      `${localizePath(ROUTES.PLAYERS_MARKS(Region.EU), locale)}?${PAGINATION.PARAM}=${page}`,
    );
  }
  return (
    <MarksLandingView
      locale={locale}
      region={region}
      language={null}
      page={page}
    />
  );
}
