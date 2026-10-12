import { z } from "zod";
import { MAX_LOADOUTS_PER_UPLOAD } from "@unicum.gg/core/tanks/loadouts";

/**
 * What the mod may send about a player's vehicles.
 *
 * Validated rather than trusted, even though the account behind it is proven:
 * a genuine client on a patch we have not seen can still send a shape we did
 * not plan for, and a loadout that reaches the database malformed is one the
 * tank page then has to survive drawing. Everything optional is genuinely
 * optional, since the client leaves a crew empty on a vehicle nobody mans and
 * has no post progression on most of the carousel.
 *
 * A slot is a position, so `nullable()` inside the arrays is load-bearing: an
 * empty equipment slot arrives as null between two filled ones.
 */

const name = z.string().min(1).max(64);
const slots = z.array(name.nullable()).max(8);

const shell = z.object({
  id: z.number().int(),
  name: name,
  type: z.string().min(1).max(32),
  premium: z.boolean(),
  // A thousand was a guess, and the game disproved it: a vehicle whose main
  // armament is a 12.7mm machine gun carries 2700 rounds, so whole batches
  // were refused over one scout. The cap is here to reject nonsense, not to
  // second-guess the client, so it now sits far above anything the game has
  // been seen to load. `shells_loaded` is an integer column for the same
  // reason: eight kinds at this ceiling would overflow a smallint.
  count: z.number().int().min(0).max(10000),
});

const ammoLayout = z.object({
  shells: z.array(shell).max(8),
  consumables: slots,
});

const devicesLayout = z.object({
  optDevices: slots,
  boosters: slots,
});

function setupGroup<T extends z.ZodTypeAny>(layout: T) {
  return z.object({
    active: z.number().int().min(0).max(3),
    // The client caps a group at two, and a third would mean a game update we
    // have not read yet rather than a client to refuse.
    layouts: z.array(layout).max(4),
  });
}

const module_ = z.object({ id: z.number().int(), name: name });

/**
 * A field the client may leave out OR send as null, read as left out.
 *
 * `optional()` alone accepts only absence, and a client that has nothing to
 * say about a vehicle says `null`: the mod builds one object per vehicle with
 * the same keys every time, so most of a carousel arrives with
 * `progression: null` rather than without the key. Refusing that rejected
 * whole batches over the vehicles that have no post progression, which is
 * most of them.
 */
function absent<T extends z.ZodTypeAny>(schema: T) {
  return schema.nullish().transform((value) => value ?? undefined);
}

export const loadoutBody = z.object({
  tankId: z.number().int(),
  modules: absent(
    z.object({
      gun: module_.optional(),
      turret: module_.optional(),
      engine: module_.optional(),
      chassis: module_.optional(),
      radio: module_.optional(),
    }),
  ),
  crew: absent(
    z.array(
      z.object({
        role: z.string().min(1).max(32),
        skills: z.array(name).max(40),
      }),
    ).max(12),
  ),
  progression: absent(
    z.union([
      z.object({
        level: z.number().int().min(0).max(20),
        pairs: z
          .array(
            z.object({
              name: name,
              side: z.enum(["first", "second"]),
            }),
          )
          .max(20),
      }),
      z.object({ tree: z.array(z.number().int()).max(60) }),
    ]),
  ),
  setups: absent(
    z.object({
      ammo: setupGroup(ammoLayout).optional(),
      devices: setupGroup(devicesLayout).optional(),
    }),
  ),
  /**
   * Marks of excellence on this gun, 1 to 3. Absent for a gun with none.
   *
   * Read from the garage's own dossier rather than from what the hangar
   * paints: the client lets a player hide the decoration, and a figure that
   * honoured that setting would show their whole fleet losing its marks the
   * day they turned it off.
   */
  marks: absent(z.number().int().min(1).max(3)),
  /**
   * How far along the next mark is, as a percent with two decimals.
   *
   * Finer than the figure a battle reports, which rounds to the percent, and
   * this is the one the fleet is measured by: the dossier holds hundredths and
   * the mod divides them down, so 95.12 arrives as 95.12.
   *
   * Absent and not zero when it could not be read, because a gun genuinely at
   * zero and a gun we failed to read are different facts.
   */
  markPercent: absent(z.number().min(0).max(100)),
});

export const loadoutsUploadBody = z.object({
  /**
   * Named only on the unlinked path: a linked client's region comes from the
   * account the link belongs to, which is a fact rather than a claim.
   */
  region: z.string().min(2).max(8).optional(),
  loadouts: z.array(loadoutBody).max(MAX_LOADOUTS_PER_UPLOAD).default([]),
  /** Vehicles the player no longer owns, so their rows can go. */
  sold: z.array(z.number().int()).max(MAX_LOADOUTS_PER_UPLOAD).default([]),
  /**
   * Marks of excellence for every tank the account has ever PLAYED.
   *
   * A different set from `loadouts`, and deliberately so. A loadout describes
   * a tank the player owns; a mark describes something they achieved, on a
   * tank they may since have sold. The game keeps the second: its own Service
   * Record still lists a sold tank with its marks, and reading only the garage
   * answered "nothing" for sixty of one player's hundred and seventy-nine.
   *
   * Sent whole with the first batch rather than folded into the loadouts,
   * because a sold tank put through `sold` above would have each sweep add
   * then remove the same rows.
   */
  marks: z
    .array(
      z.object({
        tankId: z.number().int(),
        marks: z.number().int().min(0).max(3),
        markPercent: z.number().min(0).max(100).nullable(),
      }),
    )
    .max(2000)
    .default([]),
});

export type LoadoutsUploadBody = z.infer<typeof loadoutsUploadBody>;
