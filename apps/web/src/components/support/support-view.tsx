import { CostBreakdown } from "@/components/coverage/cost-breakdown";
import { Panel, PanelContent, PanelSeparator } from "@/components/panel";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { cn } from "@/lib/utils";
import { unicum } from "@/services/sdk";
import { Region } from "@unicum.gg/wargaming";
import { FundingBar } from "./funding-bar";
import { SupportBox } from "./support-box";

const MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

/**
 * The /support page body (server component): a clean hero, the funding bar +
 * pay-what-you-want checkout, the real infrastructure cost (reused from the
 * coverage page) and the supporters podium. A single column of full-width
 * panels so the page borders stay continuous down to the footer.
 */
export async function SupportView() {
  const [coverage, podium] = await Promise.all([
    unicum.region(Region.EU).coverage(),
    unicum.support.podium(),
  ]);
  const { supporters, monthlyPledgedCents, receivedCents } = podium;
  // Stripe collects in EUR and the bills are in EUR, so nothing is converted
  // here: the funding bar renders the conversion at the live rate.
  const costs = coverage.infrastructure.costs;
  const monthlyPledgedEur = monthlyPledgedCents / 100;
  const receivedEur = receivedCents / 100;
  // eslint-disable-next-line react-hooks/purity -- server component, evaluated once per render; passed down so the client bar computes the same figures the prerendered HTML did
  const nowMs = Date.now();
  const top = supporters.slice(0, 3);
  const rest = supporters.slice(3);

  return (
    <div className="mx-auto w-full max-w-7xl">
      <Panel>
        <PanelContent className="px-4 py-12 text-center">
          <div className="mb-2 text-sm uppercase tracking-wide text-fd-muted-foreground">
            Community-funded · Ad-free
          </div>
          <h1 className="font-heading text-4xl font-bold tracking-tight md:text-5xl">
            Support <span className="text-brand">{APP.NAME}</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-fd-muted-foreground">
            {APP.NAME} is free, open-source and ad-free, and it runs at a loss.
            No ads, ever. If it is useful to you, chip in what you want from €3
            per month and keep the World of Tanks tracker alive and growing.
          </p>
        </PanelContent>
      </Panel>

      <PanelSeparator />

      <Panel>
        <PanelContent className="grid grid-cols-1 p-0 md:grid-cols-2 md:divide-x md:divide-fd-border">
          <section className="space-y-6 p-6">
            <div className="space-y-3">
              <h2 className="text-xl font-semibold">How {APP.NAME} is funded</h2>
              <p className="text-sm text-fd-muted-foreground">
                No ads, no investors, no data selling. {APP.NAME} is funded
                entirely by the people who use it.
              </p>
              <p className="text-sm text-fd-muted-foreground">
                It runs on a single OVH VPS, and every euro goes back into
                the project: the server, the database, the
                Wargaming-whitelisted egress IPs that let us refresh more
                players, and the occasional push to get it in front of more
                people. Supporters cover the monthly bill; anything extra goes
                into more throughput and new features.
              </p>
            </div>
            <FundingBar
              costs={costs}
              monthlyPledgedEur={monthlyPledgedEur}
              receivedEur={receivedEur}
              supporterCount={supporters.length}
              nowMs={nowMs}
            />
          </section>
          <section className="space-y-6 p-6">
            <div className="space-y-3">
              <h2 className="text-xl font-semibold">Become a supporter</h2>
              <p className="text-sm text-fd-muted-foreground">
                Every euro keeps {APP.NAME} running. Supporters get a badge on
                their player page and a place on the podium below, but nothing
                is ever locked behind it and there will never be ads. It is a
                monthly subscription you fully control.
              </p>
            </div>
            <SupportBox />
          </section>
        </PanelContent>
      </Panel>

      <PanelSeparator />

      <Panel>
        <PanelContent className="grid grid-cols-1 p-0 md:grid-cols-2 md:divide-x md:divide-fd-border">
          <section className="space-y-4 p-4">
            <h2 className="text-xl font-semibold">Where your money goes</h2>
            <CostBreakdown costs={costs} />
            <p className="text-xs text-fd-muted-foreground">
              The exact same numbers as the{" "}
              <a
                className="underline underline-offset-2 hover:opacity-80"
                href={ROUTES.COVERAGE(Region.EU)}
              >
                coverage page
              </a>
              .
            </p>
          </section>

          <section className="space-y-6 p-4">
            <h2 className="text-xl font-semibold">Top supporters</h2>
            {supporters.length === 0 ? (
              <p className="py-10 text-center text-sm text-fd-muted-foreground">
                No supporters yet. Be the first on the podium.
              </p>
            ) : (
              <div className="space-y-6">
                <ol className="flex items-end justify-center gap-3">
                  {top.map((s) => (
                    <li
                      key={s.rank}
                      className={cn(
                        "flex flex-1 flex-col items-center gap-2 rounded-lg border border-fd-border p-4 text-center",
                        s.rank === 1 && "order-2 bg-brand/10",
                        s.rank === 2 && "order-1",
                        s.rank === 3 && "order-3",
                      )}
                    >
                      <span className="text-3xl">{MEDAL[s.rank]}</span>
                      <span
                        className={cn(
                          "w-full truncate text-sm font-semibold",
                          s.anonymous && "font-normal italic opacity-70",
                        )}
                        title={s.name}
                      >
                        {s.name}
                      </span>
                    </li>
                  ))}
                </ol>
                {rest.length > 0 && (
                  <ol className="flex flex-col divide-y divide-fd-border text-sm">
                    {rest.map((s) => (
                      <li key={s.rank} className="flex items-center gap-3 py-2">
                        <span className="w-6 shrink-0 text-center tabular-nums text-fd-muted-foreground">
                          {s.rank}
                        </span>
                        <span
                          className={cn(
                            "truncate",
                            s.anonymous && "italic opacity-70",
                          )}
                          title={s.name}
                        >
                          {s.name}
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            )}
          </section>
        </PanelContent>
      </Panel>
    </div>
  );
}
