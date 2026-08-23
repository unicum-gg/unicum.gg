import { formatTankRef, TankClient, toTankClient } from "@unicum.gg/shared";

/**
 * How a comparison column is identified and named.
 *
 * A column is a vehicle on a game client, not a vehicle: a comparison can hold
 * the same tank twice, once live and once as the running Common Test has it,
 * which is what a test build is read for. So neither the slug nor the name is
 * enough on its own, and everything that keys, links to or labels a column goes
 * through here rather than reaching for `slug`.
 *
 * `client` is a bare string, narrowed on the way in, because these run on both
 * sides of the HTTP boundary: a TypeScript enum does not survive it (the SDK
 * types the field as its literal union), and a comparison is cached for an hour,
 * so a payload assembled before the field existed carries no client at all. Both
 * read as live rather than as `slug@undefined` in a URL.
 */
export type ColumnRef = { slug: string; client?: string };

/** Which client a column is on, whatever shape the field arrived in. */
export const columnClient = (v: ColumnRef): TankClient => toTankClient(v.client);

/** True when the column shows the test build rather than the live one. */
export const isTestColumn = (v: ColumnRef): boolean =>
  columnClient(v) === TankClient.CommonTest;

/** A column's reference, as it appears in the path: `is-7` or `is-7@ct`. */
export const vehicleRef = (v: ColumnRef): string =>
  formatTankRef({ slug: v.slug, client: columnClient(v) });

/** A column's name, told apart from its twin only when it has one. */
export const vehicleLabel = (v: ColumnRef & { meta: { name: string } }): string =>
  isTestColumn(v) ? `${v.meta.name} (Common Test)` : v.meta.name;
