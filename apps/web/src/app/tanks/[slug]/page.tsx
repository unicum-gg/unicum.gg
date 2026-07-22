import type { Metadata } from "next";
import {
  generateMetadata as generateRegionMetadata,
  renderTankPage,
} from "@/app/[region]/tanks/[slug]/page";
import { tankDetailTabFromQuery } from "@/components/tanks/detail/tabs";
import { Region } from "@unicum.gg/wargaming";

// EU shortcut: /tanks/:slug renders the same page as /eu/tanks/:slug.
export function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  return generateRegionMetadata({
    params: params.then(({ slug }) => ({ region: Region.EU, slug })),
  });
}

export default async function TankPageEU({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  return renderTankPage(Region.EU, slug, tankDetailTabFromQuery(sp.tab));
}
