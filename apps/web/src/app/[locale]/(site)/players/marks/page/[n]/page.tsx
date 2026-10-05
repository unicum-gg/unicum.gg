import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { playerMarksMetadata } from "@/app/[locale]/(site)/[region]/players/marks/page";
import { MarksLandingView } from "@/components/players/list/marks/view";
import { paginatedMetadata } from "@/lib/metadata";
import { parsePageNumber } from "@/lib/page-number";
import { Region } from "@unicum.gg/wargaming";

// One page of the EU shortcut, at `/players/marks/page/<n>`. The proxy rewrites
// `?page=<n>` here and sends this path back to the query form.
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
  return paginatedMetadata(await playerMarksMetadata(Region.EU, locale), {
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
    <MarksLandingView
      locale={locale}
      region={Region.EU}
      language={null}
      page={page}
    />
  );
}
