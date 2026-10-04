"use client";

import {
  DiscordLogoIcon,
  GameControllerIcon,
  TwitchLogoIcon,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useState } from "react";
import { AuthProvider, type WgIdentity } from "@unicum.gg/shared";
import { REGION_LABEL } from "@unicum.gg/wargaming";
import { LoginButton } from "@/components/login-button";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useTranslation } from "@/hooks/use-translation";
import { useSession } from "@/lib/auth-client";
import { ConnectionRow } from "./connection-row";
import { returnHere } from "./return-path";

type AccountState = {
  loggedIn: boolean;
  twitchAvailable: boolean;
  discordAvailable: boolean;
  wargaming: (WgIdentity & { connectedAt: string }) | null;
  twitch: { login: string | null; connectedAt: string } | null;
  discord: {
    username: string | null;
    globalName: string | null;
    connectedAt: string;
  } | null;
};

/**
 * The account's connected accounts, and the only place on the site that can
 * take one off again.
 *
 * It lives in a dialog rather than on a page of its own. Everything here is one
 * session's own, so a page would have been an address with nothing at it for
 * anybody but its owner: a canonical, 36 hreflang alternates and a sitemap
 * exclusion carried for a panel three rows tall, whose only honest crawlable
 * state is a prompt to log in. The dialog mounts nothing until it is opened, so
 * it also costs a reader who never opens it exactly nothing, which the page did
 * not.
 *
 * It refetches on its own after a disconnect rather than trusting the local
 * state, since the server does more than delete a row (a Twitch disconnect also
 * delists the channel) and this should show what actually happened.
 */
export function Connections() {
  const { t } = useTranslation("components/account/connections");
  const { data: session, isPending } = useSession();
  const [state, setState] = useState<AccountState | null>(null);

  // One read, two callers: the effect below on open, and `refresh` after a
  // disconnect. It returns the payload rather than writing the state itself, so
  // the write happens in each caller's own callback (the effect must not call
  // setState in its body, which is what `react-hooks/set-state-in-effect` is
  // about, and only the effect has an "is this still mounted" answer).
  const read = useCallback(
    (): Promise<AccountState> =>
      fetch("/api/account/me").then((r) => r.json() as Promise<AccountState>),
    [],
  );

  const refresh = useCallback(() => {
    read()
      .then(setState)
      .catch(() => {});
  }, [read]);

  useEffect(() => {
    let alive = true;
    read()
      .then((data) => {
        if (alive) setState(data);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [read, session?.user?.id]);

  if (isPending || !state) {
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-fd-muted-foreground">
        <Spinner />
        {t("loading")}
      </div>
    );
  }

  if (!state.loggedIn) {
    return (
      <div className="py-2">
        <p className="text-sm text-fd-muted-foreground">{t("log-in-first")}</p>
        <LoginButton callbackURL={returnHere()}>
          <Button size="sm" className="mt-3">
            {t("log-in")}
          </Button>
        </LoginButton>
      </div>
    );
  }

  const discord = state.discord;
  return (
    <div>
      {state.wargaming ? (
        <WargamingRow identity={state.wargaming} name={session?.user?.name} />
      ) : null}

      {state.twitchAvailable ? (
        <ConnectionRow
          provider={AuthProvider.Twitch}
          copy={{
            name: "Twitch",
            purpose: t("twitch-purpose"),
            consequence: t("twitch-consequence"),
          }}
          icon={<TwitchLogoIcon className="size-4" weight="bold" />}
          connectedSince={
            state.twitch ? new Date(state.twitch.connectedAt) : null
          }
          accountLabel={state.twitch?.login ?? null}
          // The server resume point rather than `linkSocial`, so both providers
          // take the same road back: it is what carries `return`, and there is
          // no page to come back to any more, only the one we are standing on.
          onConnect={() => {
            window.location.href = `/api/connect/twitch?return=${encodeURIComponent(
              returnHere(),
            )}`;
          }}
          onDisconnected={refresh}
        />
      ) : null}

      {state.discordAvailable ? (
        <ConnectionRow
          provider={AuthProvider.Discord}
          copy={{
            name: "Discord",
            purpose: t("discord-purpose"),
            consequence: t("discord-consequence"),
          }}
          icon={<DiscordLogoIcon className="size-4" weight="bold" />}
          connectedSince={discord ? new Date(discord.connectedAt) : null}
          accountLabel={
            discord?.username
              ? discord.globalName
                ? `${discord.globalName} (@${discord.username})`
                : `@${discord.username}`
              : null
          }
          // The link route rather than `/api/connect/discord`, which is the
          // supporter claim: that one refuses anybody without an active pledge
          // and lands on the role sync.
          onConnect={() => {
            window.location.href = `/api/link/discord?return=${encodeURIComponent(
              returnHere(),
            )}`;
          }}
          onDisconnected={refresh}
        />
      ) : null}
    </div>
  );
}

/**
 * The Wargaming account, which carries no button.
 *
 * It is not a connection among the others: it is what the account IS, minted by
 * the sign-in, so there is nothing to connect and disconnecting it would mean
 * deleting the account. Shown anyway, because a list of what is connected that
 * leaves out the identity everything hangs off reads as though the two rows
 * below were the whole account.
 */
function WargamingRow({
  identity,
  name,
}: {
  identity: WgIdentity & { connectedAt: string };
  name?: string | null;
}) {
  const { t } = useTranslation("components/account/connections");
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-fd-border py-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-fd-secondary/40 text-fd-muted-foreground">
        <GameControllerIcon className="size-4" weight="bold" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          {/* Keyed rather than written here: the brand is invariant but the
              phrase around it is not, and the login modal's own translations
              already say so ("Wargaming.net-ID" in Swedish, "ID
              Wargaming.net" in Vietnamese). */}
          <span className="text-sm font-medium">{t("wargaming-id")}</span>
          <span className="truncate text-xs text-fd-muted-foreground tabular-nums">
            {name ? `${name} · ` : ""}
            {REGION_LABEL[identity.region]}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-fd-muted-foreground">
          {t("wargaming-is-the-identity")}
        </p>
      </div>
    </div>
  );
}
