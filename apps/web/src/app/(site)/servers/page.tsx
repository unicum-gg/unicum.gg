import type { Metadata } from "next";
import { serversMetadata } from "@/app/(site)/[region]/servers/page";
import { ServersView } from "@/components/servers";
import { Region } from "@unicum.gg/wargaming";

// EU shortcut: /servers renders the same page as /eu/servers. ISR on the same
// window as the regional one.
export const dynamic = "force-static";
export const revalidate = 300;

export function generateMetadata(): Promise<Metadata> {
  return serversMetadata(Region.EU);
}

export default async function ServersPageEU() {
  return <ServersView region={Region.EU} />;
}
