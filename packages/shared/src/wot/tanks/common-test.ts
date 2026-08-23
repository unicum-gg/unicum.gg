/**
 * Which game client a vehicle's characteristics are read from.
 *
 * A Common Test runs its own client, and what it changes about a vehicle is the
 * whole reason players read a test build: the tank page can therefore be shown
 * on either one. Distinct from a "build" everywhere else in the tank page,
 * which means the setup a player assembles (modules, equipment, crew).
 */
export enum TankClient {
  /** This region's live client: what everyone is playing right now. */
  Live = "live",
  /** The Common Test client: unreleased, and still subject to change. */
  CommonTest = "ct",
}

/** Narrow an untrusted string (a query param) to a client, defaulting to live. */
export function toTankClient(value: string | null | undefined): TankClient {
  return value === TankClient.CommonTest ? TankClient.CommonTest : TankClient.Live;
}

/**
 * How a vehicle names the client it is being read on, when one string has to
 * carry both: `amx-13-90@ct`.
 *
 * A comparison addresses its columns by slug, in the path, which leaves no room
 * for a query param per column and no way to tell two columns of the same
 * vehicle apart. Suffixing the slug does both, and stays readable in a link.
 */
export const TANK_CLIENT_SEPARATOR = "@";

/** A vehicle on a given client: what a comparison column is. */
export type TankRef = { slug: string; client: TankClient };

/** Read `slug` or `slug@ct`. An unknown suffix reads as live rather than
 * failing: this comes out of a URL anyone can type. */
export function parseTankRef(raw: string): TankRef {
  const trimmed = raw.trim().toLowerCase();
  const at = trimmed.lastIndexOf(TANK_CLIENT_SEPARATOR);
  if (at <= 0) return { slug: trimmed, client: TankClient.Live };
  return {
    slug: trimmed.slice(0, at),
    client: toTankClient(trimmed.slice(at + 1)),
  };
}

/** Write a ref back. Live carries no suffix, so an ordinary comparison keeps
 * the URL it has always had. */
export function formatTankRef({ slug, client }: TankRef): string {
  return client === TankClient.CommonTest
    ? `${slug}${TANK_CLIENT_SEPARATOR}${client}`
    : slug;
}
