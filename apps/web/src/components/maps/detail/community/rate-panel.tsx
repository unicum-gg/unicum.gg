"use client";

import { useFormat } from "@/hooks/use-format";
import { useTranslation } from "@/hooks/use-translation";
import useSWR, { mutate } from "swr";
import { useRouter } from "@/hooks/use-router";
import { RatingBlock } from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import { Button } from "@/components/ui/button";
import { LoginButton } from "@/components/login-button";
import ROUTES from "@/constants/routes";
import { useHydrated } from "@/hooks/use-hydrated";
import { useSession } from "@/lib/auth-client";
import { unicum } from "@/services/sdk";
import { Prompt } from "@/components/tanks/detail/community/rate-form";
import { MapRateForm } from "./rate-form";

const INT_FORMAT = {} as const;

/** SWR key for the reader's own state on this map. Dropped after a write so the
 * panel reflects what was just saved rather than what it loaded with. */
function myRatingKey(region: Region, slug: string): string {
  return `map-rating:me:${region}:${slug}`;
}

/**
 * Where a reader casts or revises their opinion of the map.
 *
 * Arranged like the vehicle panel, and for the same reason: being turned away
 * is the most likely thing to happen to a first-time visitor, so the refusal is
 * treated as a real state with a real explanation rather than an error toast.
 *
 * The one thing it has to say differently is WHY. A vehicle refusal is a fact
 * about the subject ("you have twelve battles on this tank"), and nothing can
 * say that here: Wargaming publishes no per-arena record, so the gate reads the
 * account's own battle count and the screen says so. Claiming to have checked
 * whether somebody has played Prokhorovka would be claiming a check that does
 * not exist.
 */
export function MapRatePanel({
  region,
  slug,
  mapName,
}: {
  region: Region;
  slug: string;
  mapName: string;
}) {
  const { t } = useTranslation("components/maps/detail/community/rate-panel");
  const router = useRouter();
  const { data: session, isPending: sessionLoading } = useSession();
  const { data: me, isLoading } = useSWR(
    session?.user ? myRatingKey(region, slug) : null,
    () => unicum.region(region).maps(slug).ratingsMe(),
  );

  /**
   * The session is only knowable in the browser, so the server renders this
   * panel without one. Branching on `isPending` alone puts two different trees
   * on the two sides and React throws the subtree away and rebuilds it; gating
   * on hydration makes the server and the first client pass agree by
   * construction, and the placeholder below is what both of them draw.
   */
  const hydrated = useHydrated();

  if (!hydrated || sessionLoading) {
    return (
      <p className="text-sm text-fd-muted-foreground">{t("checking-record")}</p>
    );
  }

  if (!session?.user) {
    return (
      <Prompt
        title={t("have-you-played-here")}
        body={t("sign-in-to-rate")}
      >
        <LoginButton callbackURL={ROUTES.MAP(region, slug)}>
          {/* The prompt around this is a flex column, which stretches its
              children to full width unless one opts out. */}
          <Button size="sm" className="self-start">
            {t("sign-in-to-rate-it")}
          </Button>
        </LoginButton>
      </Prompt>
    );
  }

  if (isLoading || !me) {
    return (
      <p className="text-sm text-fd-muted-foreground">{t("checking-record")}</p>
    );
  }

  if (!me.eligible) {
    return <Blocked me={me} mapName={mapName} />;
  }

  return (
    <MapRateForm
      key={me.rating ? "edit" : "new"}
      region={region}
      slug={slug}
      me={me}
      onSaved={() => {
        void mutate(myRatingKey(region, slug));
        // The panel around this is server-rendered from the cached summary, and
        // the endpoint has already dropped that cache. Refreshing pulls the new
        // histogram in so the vote lands visibly rather than on the next
        // navigation.
        router.refresh();
      }}
    />
  );
}

/** The caller's own state on this map, as the endpoint answers it. Exported so
 * the form next door can take it without redeclaring the shape. */
export type OwnMapRatingState = Awaited<
  ReturnType<ReturnType<ReturnType<typeof unicum.region>["maps"]>["ratingsMe"]>
>;

/** The refusal, spelled out. Never a toast: it is the panel's whole content
 * until it stops being true. */
function Blocked({
  me,
  mapName,
}: {
  me: OwnMapRatingState;
  mapName: string;
}) {
  const { num } = useFormat();
  const { t } = useTranslation("components/maps/detail/community/rate-panel");
  const played = me.player?.battles ?? 0;
  const missing = Math.max(0, me.required - played);

  if (me.block === RatingBlock.TooFewBattles) {
    return (
      <Prompt
        title={t(missing === 1 ? "more-to-go-one" : "more-to-go", {
          count: num(INT_FORMAT).format(missing),
        })}
        // The gate's reason, said out loud. The rotation is what makes a battle
        // count a fair proxy for having been here, and a reader who is not told
        // that reads an arbitrary wall.
        body={t("too-few-battles", {
          played: num(INT_FORMAT).format(played),
          required: num(INT_FORMAT).format(me.required),
          map: mapName,
        })}
      >
        <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-sm bg-fd-border/60">
          <div
            className="h-full rounded-sm bg-fd-primary"
            style={{ width: `${Math.min(100, (played / me.required) * 100)}%` }}
          />
        </div>
      </Prompt>
    );
  }

  return (
    <Prompt
      title={t("fetching-your-record")}
      body={t("block-no-record")}
    >
      {me.votingRegion ? (
        <p className="text-xs text-fd-muted-foreground">
          {/* The caller's own server, not the page's. Someone signed in on NA
            reading the EU copy of a map page must not be told "Signed in on
            EU", on the one screen whose whole job is explaining the refusal. */}
          {t("signed-in-on", { region: me.votingRegion.toUpperCase() })}
        </p>
      ) : null}
    </Prompt>
  );
}
