import { notFound, redirect } from "next/navigation";
import { HomePage } from "@/components/home/home-page";
import ROUTES from "@/constants/routes";
import { isRegion, Region } from "@/services/wargaming/wot";

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

export const dynamic = "force-static";
export const revalidate = 60;
