/**
 * The identity providers a unicum.gg account can carry, as Better Auth stores
 * them in `account.provider_id`.
 *
 * `Wargaming` is the identity itself: it is what the sign-in mints the user
 * from, so it is listed here to be recognised and never to be acted on. The
 * other two are connections a player adds and removes themselves, which is
 * what `CONNECTABLE_PROVIDERS` is: the allowlist the disconnect endpoint
 * checks a path segment against, so no request can ever name the row that
 * holds the account's identity.
 */
export enum AuthProvider {
  Wargaming = "wargaming",
  Twitch = "twitch",
  Discord = "discord",
}

/** The connections a player may add and remove on their own account. */
export const CONNECTABLE_PROVIDERS = [
  AuthProvider.Twitch,
  AuthProvider.Discord,
] as const;

export type ConnectableProvider = (typeof CONNECTABLE_PROVIDERS)[number];

export function isConnectableProvider(
  value: string,
): value is ConnectableProvider {
  return (CONNECTABLE_PROVIDERS as readonly string[]).includes(value);
}
