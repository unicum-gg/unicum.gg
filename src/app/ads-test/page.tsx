import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { env } from "env";
import { AdFormat } from "@/components/ads/ad-config";
import { AdUnit } from "@/components/ads/ad-unit";

// Verification harness for UNI-38: three stub units exercising reserved space,
// lazy-load and consent gating. Never indexed; dark in production unless ads
// are explicitly enabled.
export const metadata: Metadata = {
  title: "AdUnit test harness",
  robots: { index: false, follow: false },
};

export default function Page() {
  if (process.env.NODE_ENV === "production" && !env.NEXT_PUBLIC_ADS_ENABLED) {
    notFound();
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">AdUnit CLS test harness</h1>
        <p className="text-sm text-muted-foreground">
          Three stub units render their reserved boxes immediately. No
          adsbygoogle request fires until Consent Mode resolves, and the
          reserved space keeps CLS at zero. Tall spacers push the lower units
          offscreen so lazy-load is observable.
        </p>
      </header>

      <AdUnit
        slot="0000000001"
        format={AdFormat.Banner}
        page="ads-test"
        region="eu"
      />

      <div className="h-[1200px] rounded-md border border-dashed border-border" />

      <AdUnit
        slot="0000000002"
        format={AdFormat.Rectangle}
        page="ads-test"
        region="eu"
      />

      <div className="h-[1200px] rounded-md border border-dashed border-border" />

      <AdUnit
        slot="0000000003"
        format={AdFormat.InFeed}
        page="ads-test"
        region="eu"
        layoutKey="-fb+5w+4e-db+86"
      />
    </main>
  );
}
