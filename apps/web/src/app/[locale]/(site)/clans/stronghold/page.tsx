import { redirect } from "next/navigation";
import { localizePath } from "@/lib/translations";

export default async function StrongholdRootPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(localizePath("/clans/stronghold/advances", locale));
}
