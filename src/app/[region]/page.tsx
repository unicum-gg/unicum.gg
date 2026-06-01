import { notFound, redirect } from "next/navigation";
import { HomePage } from "@/components/home/home-page";
import { isRegion, Region } from "@/services/wargaming/wot";

export const revalidate = 60;

export default async function Page({
  params,
}: {
  params: Promise<{ region: string }>;
}) {
  const { region } = await params;
  if (!isRegion(region)) notFound();
  if (region === Region.EU) redirect("/");

  return <HomePage regionOverride={region} />;
}
