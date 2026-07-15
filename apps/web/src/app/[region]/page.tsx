import { notFound, redirect } from "next/navigation";
import { HomePage } from "@/components/home/home-page";
import ROUTES from "@/constants/routes";
import { isRegion, Region } from "@unicum.gg/wargaming";



// ISR: served as prerendered HTML and revalidated in the background, so
// navigation stays instant while the data follows the endpoints' cadence.
// The SDK calls fail-soft to an empty shell at build time (a build must not
// depend on a running API); the first revalidation after deploy fills it in.
export const dynamic = "force-static";
export const revalidate = 60;

export async function generateStaticParams() {
  return [Region.NA, Region.ASIA].map((region) => ({ region }));
}

export default async function Page({
  params,
}: {
  params: Promise<{ region: string }>;
}) {
  const { region } = await params;
  if (!isRegion(region)) notFound();
  if (region === Region.EU) redirect(ROUTES.HOME(Region.EU));

  return <HomePage regionOverride={region} />;
}

