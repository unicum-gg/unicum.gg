import { DiscordLogoIcon } from "@phosphor-icons/react/dist/ssr";
import { Card, Cards } from "fumadocs-ui/components/card";
import { buttonVariants } from "fumadocs-ui/components/ui/button";
import Link from "next/link";
import {
  Card as HomeCard,
  CardDescription,
  CardTitle,
} from "@/components/home/card";
import { FeatureBlock } from "@/components/home/feature-block";
import { RatingScale } from "@/components/home/rating-scale";
import { TopClans } from "@/components/home/top-clans";
import { HeroVideo } from "@/components/hero-video";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelTitle,
} from "@/components/panel";
import { styles } from "@/lib/styles";

export default function HomePage() {
  return (
    <div className="mx-auto w-full max-w-7xl">
      <div
        className={`relative aspect-[16/10] ${styles.borderX} flex w-full select-none items-center justify-center overflow-hidden sm:aspect-5/2 md:aspect-auto md:h-64 ${styles.screenLines}`}
      >
        <HeroVideo />
        <div className="absolute inset-0 bg-black/40" />
        <div className="absolute inset-0 dot-pattern opacity-20" />
        <div className="relative z-10 space-y-4 px-4 text-center sm:space-y-6 sm:px-6">
          <h1 className="text-2xl font-bold text-white sm:text-4xl md:text-6xl">
            unicum.gg
          </h1>
          <p className="mx-auto max-w-2xl text-base text-white/90 sm:text-lg md:text-xl">
            World of Tanks player and clan stats. Track your progress, compare
            with others.
          </p>
        </div>
      </div>

      <Separator />

      <Panel>
        <PanelHeader>
          <PanelTitle>What you&apos;ll find here</PanelTitle>
        </PanelHeader>

        <PanelContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <FeatureBlock
              icon="📊"
              title="Player profiles"
              description="Detailed stats with overall + 24h / 7d / 30d deltas, WN7, WN8, WNX, and Personal Rating."
            />
            <FeatureBlock
              icon="🛡️"
              title="Clan pages"
              description="Members table with ratings, recent activity feed, description and clan metadata."
            />
            <FeatureBlock
              icon="📜"
              title="Clan history"
              description="Full timeline of every clan a player has been in, with roles and dates."
            />
            <FeatureBlock
              icon="⚡"
              title="Live updates"
              description="Tracked players refresh in the background every 24h via our snapshot system."
            />
            <FeatureBlock
              icon="🌍"
              title="EU / NA / ASIA"
              description="Coverage of all three Wargaming PC regions in one place."
            />
            <FeatureBlock
              icon="🆓"
              title="No login required"
              description="Browse stats freely. No account needed, no ads, just the data."
            />
          </div>
        </PanelContent>
      </Panel>

      <Separator />

      <Panel>
        <PanelHeader>
          <PanelTitle>Quick start</PanelTitle>
        </PanelHeader>

        <PanelContent>
          <div className="grid gap-3 sm:grid-cols-2">
            <HomeCard>
              <CardTitle>🔍 Find a player</CardTitle>
              <CardDescription>
                Search by nickname above. Pick your region in the dropdown.
              </CardDescription>
            </HomeCard>
            <HomeCard>
              <CardTitle>🛡️ Browse a clan</CardTitle>
              <CardDescription>
                Visit{" "}
                <code className="text-fd-foreground">/eu/clans/[TAG]</code> — e.g.{" "}
                <Link
                  href="/eu/clans/KAISN"
                  className="text-fd-foreground underline underline-offset-2"
                >
                  /eu/clans/KAISN
                </Link>
                .
              </CardDescription>
            </HomeCard>
            <HomeCard>
              <CardTitle>📈 Compare ratings</CardTitle>
              <CardDescription>
                WN7, WN8, WNX side by side with standard color thresholds.
              </CardDescription>
            </HomeCard>
            <HomeCard>
              <CardTitle>🕒 Activity timeline</CardTitle>
              <CardDescription>
                See every clan a player has been in on one visual timeline.
              </CardDescription>
            </HomeCard>
          </div>
        </PanelContent>
      </Panel>

      <Separator />

      <Panel>
        <PanelHeader>
          <PanelTitle>Join the community</PanelTitle>
        </PanelHeader>

        <PanelContent>
          <div
            className={`relative overflow-hidden rounded-lg ${styles.cardBorder} bg-gradient-to-br from-fd-primary/5 via-fd-primary/10 to-fd-primary/5 p-8`}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-transparent via-fd-primary/5 to-transparent" />
            <div className="relative space-y-4 text-center">
              <h3 className="mb-2 text-xl font-semibold">
                Connect with WoT players
              </h3>
              <p className={`${styles.mutedText} mx-auto mb-6 max-w-md`}>
                Join our Discord to chat about WoT stats, request features,
                report bugs and share your hot takes on the meta.
              </p>
              <Link
                href="https://discord.gg/pxSQgmzPTG"
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({ variant: "primary" })}
              >
                <DiscordLogoIcon weight="fill" className="mr-2 size-4" />
                Join Discord server
              </Link>
            </div>
          </div>
        </PanelContent>
      </Panel>

      <Separator />

      <div className="grid lg:grid-cols-2">
        <Panel className="flex flex-col">
          <PanelHeader>
            <PanelTitle>Top clans</PanelTitle>
          </PanelHeader>
          <PanelContent className="flex-1 p-0">
            <TopClans />
          </PanelContent>
        </Panel>

        <Panel className="flex flex-col lg:border-l-0">
          <PanelHeader>
            <PanelTitle>Rating scale</PanelTitle>
          </PanelHeader>
          <PanelContent className="flex-1 p-0">
            <RatingScale />
          </PanelContent>
        </Panel>
      </div>

      <Separator />

      <Panel>
        <PanelHeader>
          <PanelTitle>Explore</PanelTitle>
        </PanelHeader>

        <PanelContent>
          <Cards>
            <Card
              title="Top EU clan"
              description="Stats and members of KAISN, the top clan on EU server."
              href="/eu/clans/KAISN"
            />
            <Card
              title="Top NA clan"
              description="Stats and members of OTTER, the top clan on NA server."
              href="/na/clans/OTTER"
            />
            <Card
              title="Sample player"
              description="See what the profile page looks like."
              href="/eu/players/_Winnie"
            />
          </Cards>
        </PanelContent>
      </Panel>

    </div>
  );
}

function Separator({ className }: { className?: string }) {
  return (
    <div
      className={`relative flex h-8 w-full ${styles.borderX} diagonal-pattern ${className || ""}`}
    />
  );
}
