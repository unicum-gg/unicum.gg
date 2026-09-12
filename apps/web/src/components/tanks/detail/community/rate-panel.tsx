"use client";

import { useFormat } from "@/hooks/use-format";
import { useTranslation } from "@/hooks/use-translation";
import useSWR, { mutate } from "swr";
import { useRouter } from "@/hooks/use-router";
import { RATING_BLOCK_MESSAGE, RatingBlock } from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import { Button } from "@/components/ui/button";
import { LoginButton } from "@/components/login-button";
import ROUTES from "@/constants/routes";
import { useHydrated } from "@/hooks/use-hydrated";
import { useSession } from "@/lib/auth-client";
import { unicum } from "@/services/sdk";
import { Prompt, RateForm } from "./rate-form";

const INT_FORMAT = {} as const;

/** SWR key for the reader's own state on this tank. Dropped after a write so
 * the panel reflects what was just saved rather than what it loaded with. */
function myRatingKey(region: Region, slug: string): string {
  return `tank-rating:me:${region}:${slug}`;
}

/**
 * Where a reader casts or revises their opinion of the tank.
 *
 * Everything about this panel is arranged around one fact: the vote is gated on
 * having played the vehicle, and being turned away is the most likely thing to
 * happen to a first-time visitor. So the refusal is treated as a real state
 * with a real explanation, not an error toast. Someone twelve battles short is
 * told they are twelve battles short; someone we have never snapshotted is told
 * we have just gone to ask Wargaming, because that is what the endpoint did.
 *
 * The vote itself is two taps. The seven detailed axes are behind a disclosure
 * and stay optional forever: an average is only worth reading if enough people
 * cast it, so the thing everyone is asked for has to cost nothing. The written
 * opinion is last, and is the only part that waits on a moderator.
 */
export function RatePanel({
  region,
  slug,
  tankName,
}: {
  region: Region;
  slug: string;
  tankName: string;
}) {
  const { t } = useTranslation("components/tanks/detail/community/rate-panel");
  const router = useRouter();
  const { data: session, isPending: sessionLoading } = useSession();
  const { data: me, isLoading } = useSWR(
    session?.user ? myRatingKey(region, slug) : null,
    () => unicum.region(region).tanks(slug).ratingsMe(),
  );

  /**
   * The session is only knowable in the browser, so the server renders this
   * panel without one. Branching on `isPending` alone put two different trees
   * on the two sides and React threw the subtree away and rebuilt it; gating on
   * hydration makes the server and the first client pass agree by construction,
   * and the placeholder below is what both of them draw.
   *
   * Treating "pending" as "signed out" would also match, but it flashes a
   * sign-in prompt at somebody already signed in, on the one control this page
   * exists for.
   */
  const hydrated = useHydrated();

  if (!hydrated || sessionLoading) {
    return (
      <p className="text-sm text-fd-muted-foreground">
        {t("checking-your-record-on-this")}</p>
    );
  }

  if (!session?.user) {
    return (
      <Prompt
        title={t("have-you-played", { tank: tankName })}
        body={t("sign-in-with-your-wargaming-account-to-rate-")}
      >
        <LoginButton callbackURL={`${ROUTES.TANK(region, slug)}/community`}>
          <Button size="sm">{t("sign-in-to-rate-it")}</Button>
        </LoginButton>
      </Prompt>
    );
  }

  if (isLoading || !me) {
    return (
      <p className="text-sm text-fd-muted-foreground">
        {t("checking-your-record-on-this")}</p>
    );
  }

  if (!me.eligible) {
    return <Blocked me={me} tankName={tankName} />;
  }

  return (
    <RateForm
      key={me.rating ? "edit" : "new"}
      region={region}
      slug={slug}
      me={me}
      onSaved={() => {
        void mutate(myRatingKey(region, slug));
        // The tab around this panel is server-rendered from the cached summary,
        // and the endpoint has already dropped that cache. Refreshing pulls the
        // new histogram in so the vote lands visibly rather than on the next
        // navigation.
        router.refresh();
      }}
    />
  );
}

/** The caller's own state on this tank, as the endpoint answers it. Exported so
 * the form next door can take it without redeclaring the shape. */
export type OwnRatingState = Awaited<
  ReturnType<ReturnType<ReturnType<typeof unicum.region>["tanks"]>["ratingsMe"]>
>;

/** The refusal, spelled out. Never a toast: it is the panel's whole content
 * until it stops being true. */
function Blocked({
  me,
  tankName,
}: {
  me: OwnRatingState;
  tankName: string;
}) {
  const { num } = useFormat();
  const { t } = useTranslation("components/tanks/detail/community/rate-panel");
  const played = me.record?.battles ?? 0;
  const missing = Math.max(0, me.required - played);

  if (me.block === RatingBlock.TooFewBattles) {
    return (
      <Prompt
        title={t(missing === 1 ? "more-to-go-one" : "more-to-go", {
          count: num(INT_FORMAT).format(missing),
        })}
        body={t("too-few-battles", {
          played: num(INT_FORMAT).format(played),
          tank: tankName,
          required: me.required,
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
      title={
        me.block === RatingBlock.NoRecord
          ? t("fetching-your-garage")
          : t("you-have-not-played", { tank: tankName })
      }
      body={
        me.block
          ? RATING_BLOCK_MESSAGE[me.block]
          : "We could not read your record on this tank."
      }
    >
      {me.player && me.votingRegion ? (
        <p className="text-xs text-fd-muted-foreground">
          {/* The caller's own server, not the page's. Someone signed in on NA
            reading the EU copy of a tank page was being told "Signed in on EU"
            beside their NA battle count, on the one screen whose whole job is
            explaining the refusal. */}
          {t("signed-in-on", { region: me.votingRegion.toUpperCase() })}
          {me.player.battles != null
            ? ` · ${t("battles-overall", {
                battles: num(INT_FORMAT).format(me.player.battles),
              })}`
            : null}
        </p>
      ) : null}
    </Prompt>
  );
}
