import { sql } from "drizzle-orm";
import {
  type LoadoutMode,
  LoadoutItemKind,
  type PopularSetup,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import { db } from "@unicum.gg/core/db";
import {
  battlesCte,
  mergePlayer,
  PER_PLAYER_COLUMNS,
  performanceOf,
  rollUp,
  type PerPlayerRow,
  type RatingContext,
} from "@unicum.gg/core/tanks/loadout-sql";
import { fieldModSlots } from "@unicum.gg/core/wargaming/wot/tanks/field-mods";

/**
 * The field modification trees the counted battles were played with, one row
 * per complete tree.
 *
 * A whole tree and not one modification at a time, because that is what a
 * player chooses and what a reader copies: five pairs, each taken one way or
 * the other, read together. One row per modification said that a pair was
 * popular and nothing about what it was combined with. The taken sides are
 * listed in the tree's own order, so two trees line up step by step.
 *
 * The only family rolled up in TypeScript, and only its last step. A recording
 * stores the modifications as packed integers that mean something only against
 * the vehicle's own post-progression tree, so Postgres folds the battles by
 * (packed value, player) and the decoding happens here, once per distinct
 * value: a vehicle's players settle on a handful of trees, so that is a few
 * catalogue lookups, both cached, however many battles there are.
 */

type PackedRow = PerPlayerRow & {
  tank_id: string | number;
  account_id: string | number;
  field_mods_packed: (string | number)[];
};

export async function fieldModUsage(
  region: Region,
  /** The vehicle first, then its twins when the reader asked for them. */
  tankIds: number[],
  mode: LoadoutMode,
  sample: number,
  context: RatingContext,
): Promise<PopularSetup[]> {
  const rows = (await db.execute(sql`
    WITH observed AS (${battlesCte(region, tankIds, mode)})
    SELECT tank_id, field_mods_packed, account_id, ${PER_PLAYER_COLUMNS}
    FROM observed
    WHERE field_mods_packed IS NOT NULL AND cardinality(field_mods_packed) > 0
    GROUP BY tank_id, field_mods_packed, account_id
  `)) as unknown as PackedRow[];
  if (rows.length === 0) return [];

  // Keyed on the vehicle as well as the value: read across twins, each battle
  // decodes against the tree of the vehicle it was fought in.
  const keyOf = (row: PackedRow) =>
    `${row.tank_id}:${row.field_mods_packed.map(Number).join(",")}`;
  const distinct = new Map<string, { tankId: number; packed: number[] }>();
  for (const row of rows) {
    distinct.set(keyOf(row), {
      tankId: Number(row.tank_id),
      packed: row.field_mods_packed.map(Number),
    });
  }
  const decoded = new Map<string, string[]>();
  await Promise.all(
    [...distinct].map(async ([id, { tankId, packed }]) => {
      const slots = await fieldModSlots(region, tankId, packed).catch(() => []);
      decoded.set(
        id,
        slots.flatMap((slot) => (slot.taken && slot.key ? [slot.key] : [])),
      );
    }),
  );

  // Per tree, per player: two packed values can decode to the same choices
  // (the packing also carries the steps that are not a choice), so the
  // player's counters are summed under the tree rather than counted twice.
  const byTree = new Map<string, { items: string[]; players: Map<string, PerPlayerRow> }>();
  for (const row of rows) {
    const items = decoded.get(keyOf(row)) ?? [];
    if (items.length === 0) continue;
    const id = items.join("|");
    const tree = byTree.get(id) ?? { items, players: new Map<string, PerPlayerRow>() };
    byTree.set(id, tree);
    const account = String(row.account_id);
    const held = tree.players.get(account);
    tree.players.set(account, held ? mergePlayer(held, row) : row);
  }

  return [...byTree.values()]
    .map(({ items, players }) => {
      const rolled = rollUp([...players.values()]);
      const count = Number(rolled.players);
      return {
        kind: LoadoutItemKind.FieldMod,
        items,
        count,
        battles: Number(rolled.battles),
        share: sample > 0 ? count / sample : 0,
        performance: performanceOf(rolled, context),
      };
    })
    .sort((a, b) => b.count - a.count || b.battles - a.battles);
}
