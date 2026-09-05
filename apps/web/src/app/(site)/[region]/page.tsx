import { notFound, redirect } from "next/navigation";
import { HomePage } from "@/components/home/home-page";
import ROUTES from "@/constants/routes";
import { isRegion, Region } from "@unicum.gg/wargaming";



// ISR: served as prerendered HTML and revalidated in the background, so
// navigation stays instant while the data follows the endpoints' cadence.
// The SDK calls fail-soft to an empty shell at build time (a build must not
// depend on a running API); the first revalidation after deploy fills it in.
//
// The top tables come from the leaderboard cron, which runs hourly on the hour,
// so nothing on this page can change more than once an hour. It was 60s, which
// regenerated sixty times per data cycle: one render fans out to every rating
// metric across every region and every period, so that is roughly 3200 SDK
// calls an hour spent re-deriving a page that did not change.
//
// 600 rather than the 3600 the board pages use, because this page's clock and
// the cron's are unaligned: at 3600 a visitor could see figures up to two hours
// old, where 600 bounds it near the data's own cadence while still removing
// nine tenths of the work.
export const dynamic = "force-static";
export const revalidate = 600;

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

