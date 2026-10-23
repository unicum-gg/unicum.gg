import { iconUrl } from "@unicum.gg/wargaming";
import { minimapUrl } from "@unicum.gg/shared";
import type { PlayerBattleRow } from "./battles-table";

/**
 * Three battles as the panel draws them, for the profile of a player nobody has
 * shared a battle for yet.
 *
 * Invented, and shown only behind the offer to install the mod, faded, inert
 * and labelled as an example: their whole job is to show what the panel turns
 * into, which a sentence cannot. The maps, vehicles and equipment are real so
 * the rows draw exactly as a shared battle would, and the figures are in the
 * range a good tier X game lands in, so the ratings take the colours a reader
 * would hope to see on their own page.
 */

/** WG's own encyclopedia pictures for a piece of equipment. */
const ARTEFACT = "https://api.worldoftanks.eu/static/2.77.0/wot/encyclopedia/artefact";
const AMMO = iconUrl("ammopanel/ammo");
const FIELD_MODS = iconUrl(
  "vehPostProgression/actionItems/pairModifications/80x80",
);

const slot = (image: string, overlay: string | null = null) => ({
  filled: true,
  name: null,
  image,
  overlay,
});

const BOUNTY = iconUrl("artefact/equipmentTrophyUpgraded_overlay.png");

const LOADOUT = {
  devices: [
    slot(`${ARTEFACT}/rammer.png`, BOUNTY),
    slot(`${ARTEFACT}/turbocharger.png`, BOUNTY),
    slot(`${ARTEFACT}/improvedVentilation.png`),
  ],
  consumables: [
    slot(`${ARTEFACT}/smallRepairkit.png`),
    slot(`${ARTEFACT}/smallMedkit.png`),
    slot(`${ARTEFACT}/cocacola.png`),
  ],
  shells: [
    { name: "", image: `${AMMO}/ARMOR_PIERCING.png` },
    { name: "", image: `${AMMO}/HOLLOW_CHARGE.png` },
    { name: "", image: `${AMMO}/HIGH_EXPLOSIVE.png` },
  ],
  fieldMods: [
    slot(`${FIELD_MODS}/betterFriction.png`),
    slot(`${FIELD_MODS}/improvedScope.png`),
    slot(`${FIELD_MODS}/improvedObservationDevice.png`),
    slot(`${FIELD_MODS}/improvedChassisStability.png`),
  ],
};

const RANDOM = 1;

function battle(
  id: string,
  startedAt: string,
  map: string,
  gameplay: string,
  duration: number,
  outcome: PlayerBattleRow["outcome"],
  tank: NonNullable<PlayerBattleRow["tank"]>,
  own: Partial<PlayerBattleRow["own"]>,
  rating: number,
): PlayerBattleRow {
  return {
    id,
    startedAt,
    map,
    mapImage: minimapUrl(map),
    mapOverlay: null,
    mapBounds: null,
    gameplay,
    battleType: RANDOM,
    duration,
    team: 1,
    outcome,
    tank,
    ...LOADOUT,
    own: {
      damage: 0,
      radio: 0,
      track: 0,
      stun: 0,
      blocked: 0,
      spotted: 0,
      kills: 0,
      xp: 0,
      deathReason: -1,
      ...own,
    },
    // One figure across the three metrics: the preview only ever shows the
    // reader's own, and this is an illustration rather than a computation.
    rating: { wn7: rating, wn8: rating, wnx: rating },
    players: 30,
    reporters: 1,
    personal: null,
  };
}

export const EXAMPLE_BATTLES: PlayerBattleRow[] = [
  battle(
    "example-1",
    "2026-10-21T20:28:00.000Z",
    "05_prohorovka",
    "ctf",
    344,
    "win",
    {
      id: 10785,
      name: "T110E5",
      shortName: "T110E5",
      tier: 10,
      type: "heavyTank",
      nation: "usa",
      tag: "A69_T110E5",
      slug: "t110e5",
    },
    { damage: 5412, radio: 820, blocked: 3150, spotted: 2, kills: 3, xp: 1648 },
    3480,
  ),
  battle(
    "example-2",
    "2026-10-21T20:14:00.000Z",
    "02_malinovka",
    "ctf",
    421,
    "win",
    {
      id: 16897,
      name: "Object 140",
      shortName: "Obj. 140",
      tier: 10,
      type: "mediumTank",
      nation: "ussr",
      tag: "R97_Object_140",
      slug: "obj-140",
    },
    { damage: 4107, radio: 2260, track: 410, blocked: 650, spotted: 5, kills: 2, xp: 1402 },
    2920,
  ),
  battle(
    "example-3",
    "2026-10-21T19:58:00.000Z",
    "18_cliff",
    "ctf",
    298,
    "loss",
    {
      id: 14609,
      name: "Leopard 1",
      shortName: "Leopard 1",
      tier: 10,
      type: "mediumTank",
      nation: "germany",
      tag: "G89_Leopard1",
      slug: "leopard-1",
    },
    { damage: 3215, radio: 1490, spotted: 4, kills: 1, xp: 1105, deathReason: 0 },
    2140,
  ),
];
