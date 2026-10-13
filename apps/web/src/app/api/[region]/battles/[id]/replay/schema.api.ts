import * as z from "zod";

/**
 * One vehicle's path through the battle.
 *
 * `[tenths of a second, x, z]`, in the arena's own metres, thinned to two
 * samples a second and rounded to whole metres: a tank moves eight metres
 * between samples on a map drawn five hundred pixels across for a kilometre,
 * so four pixels. No height, because a minimap is a plan view and a tank on a
 * hill is at the same place on it as one under the hill.
 */
export const BattleReplayTrack = z.object({
  id: z.number().meta({
    description:
      "The battle-scoped vehicle id, the same one the battle's participants are keyed by.",
  }),
  team: z.number().meta({
    description:
      "Which side the vehicle fought on, so the tracks can be coloured without loading the battle's own document. 0 when the results name no team for it.",
  }),
  diedAt: z.number().nullable().meta({
    description:
      "The clock tick this vehicle was destroyed, or null if it survived or the recording cannot say. In the recording's clock, which runs about fifty seconds ahead of the battle's because it starts during the countdown.",
  }),
  maxHealth: z.number().meta({
    description: "Hit points at full, zero when the battle's results do not name any.",
  }),
  health: z.array(z.array(z.number()).length(2)).meta({
    description:
      "Hit points over time, as [clock tick, hit points], one entry per change. Starts implicitly at maxHealth. A vehicle the recording client lost sight of keeps the last value it was told, so a track can end above the health the results record: the same fog of war the positions have.",
  }),
  points: z.array(z.array(z.number()).length(3)).meta({
    description:
      "The path, as [clock ticks since the battle started, x, z in the arena's own metres]. Every position the recording client was shown, which is about ten a second; only the moments the vehicle actually moved are kept, so between two points it stood still.",
  }),
});

export const BattleReplayChatLine = z.object({
  at: z.number().meta({
    description:
      "The clock tick the line was sent, in the same clock the tracks use.",
  }),
  from: z.string().meta({
    description:
      "Who typed it, with their clan tag when they had one, exactly as the game wrote it into the recording.",
  }),
  vehicle: z.string().nullable().meta({
    description: "The vehicle they were in, or null when the line carries none.",
  }),
  text: z.string().meta({
    description:
      "What they typed, as plain text. The game stores the line as markup; it is taken apart on the way out, so this is never HTML and must never be rendered as any.",
  }),
  ally: z.boolean().meta({
    description:
      "Whether the sender was on the recording client's own side, read off the colour the game painted the line, which is the only side information the line carries. Always false for a quick command, which carries no colour.",
  }),
  command: z.string().nullable().meta({
    description:
      "The quick command this line is, as the game names it internally (`RELOADINGGUN`, `SOS`, `ATTACK_BASE`), or null for a line somebody typed. The reload callouts, the map pings and the radial menu all travel as an action id on a different packet from the chat, and arrive resolved into the client's own words; repeats inside the game's own five-second cooldown are folded, since a held marker re-sends itself twice a second.",
  }),
  where: z
    .object({ x: z.number(), z: z.number() })
    .nullable()
    .meta({
      description:
        "Where on the map the command pinged, in the arena's own metres, the same frame the tracks use. Null for a command that pings nothing, which is most of them.",
    }),
  target: z.number().nullable().meta({
    description:
      "The vehicle a command is about, to match against this battle's own vehicle ids, and null when it is about nobody. The game's messages name it: `Requesting fire at %(target)s!`.",
  }),
  reloadTime: z.number().nullable().meta({
    description: "Seconds left on a reload, for the callouts whose text says so, rounded.",
  }),
  label: z.string().nullable().meta({
    description: "A base or objective label the message names, when it names one.",
  }),
  sender: z.number().nullable().meta({
    description:
      "Who sent a quick command, as an id to match against this battle's own vehicle ids, and null for a typed line. On a real recording it is the sender's vehicle id, the same one the tracks are keyed by; it is not that for every command, a waypoint's being plainly something else, so it is worth showing only where it names a vehicle that was in this battle.",
  }),
});

export const BattleReplayDeath = z.object({
  at: z.number().meta({
    description: "The clock tick the vehicle was destroyed, in the recording's clock.",
  }),
  victim: z.number().meta({ description: "The vehicle that died." }),
  by: z.number().nullable().meta({
    description:
      "The vehicle that finished it, or null: either nobody did (fire, drowning, a fall) or the recording client never saw the shot, since damage only reaches a client for a vehicle it can see.",
  }),
  damage: z.number().nullable().meta({
    description: "What the killing blow took, in hit points, when the recording heard it.",
  }),
  reason: z.number().nullable().meta({
    description:
      "How it died, as the game's own `deathReason`: 0 and 30 a shot, 1 fire, 2 ramming, 3 a crash, 5 drowning, 7 overturning, 12 self-destruction, and so on. The game names each one under `common/vehicleState/dead<reason>`, which is what turns a row of this timeline into the sentence the battle results would print.",
  }),
});

/** One kind of round the recording player loaded, and how many. */
export const BattleReplayLoadoutShell = z.object({
  name: z.string().meta({
    description:
      "The client's own name for the round, scoped to its nation, the same name the garage loadouts are stored under.",
  }),
  type: z.string().meta({
    description:
      "ARMOR_PIERCING, ARMOR_PIERCING_CR, HOLLOW_CHARGE or HIGH_EXPLOSIVE, which is what picks the round's icon.",
  }),
  premium: z.boolean().meta({
    description: "Whether the round costs gold.",
  }),
  count: z.number().meta({ description: "How many of them were loaded." }),
});

/** One crew member, with the seat they sat in. */
export const BattleReplayLoadoutCrew = z.object({
  role: z.string().meta({
    description: "commander, gunner, driver, radioman or loader.",
  }),
  skills: z.array(z.string()).meta({
    description: "Skills trained, in the order they were learned.",
  }),
});

/**
 * What the recording player had fitted for one life.
 *
 * Only theirs. The server strips the optional devices out of every other
 * vehicle's public information before it goes on the wire, so a replay holds
 * exactly one equipped vehicle however many took part: across seven recordings,
 * 443 of 443 public descriptors carried no devices, and a thirty-player battle's
 * arena list holds twenty-nine stripped descriptors beside one complete. The
 * other players' MODULES are a separate fact and not this.
 *
 * The layout published is the ACTIVE one, not both. A vehicle can be on its
 * second ammunition setup and its first equipment setup at once, and only the
 * ones in use were played; publishing the other would describe a setup the
 * battle never saw.
 */
export const BattleReplayLoadout = z.object({
  vehicle: z.number().meta({
    description:
      "The vehicle entity this life belongs to. Lives in a respawn mode share a battle but not a tank, so this is what tells them apart.",
  }),
  at: z.number().meta({
    description:
      "The clock tick the loadout was sent, in the same clock the tracks use, which places the life within the battle.",
  }),
  optDevices: z.array(z.string().nullable()).meta({
    description:
      "The optional devices fitted, by slot. A free slot is a null in place, because a device's category and grade depend on which slot it sits in. A name this site does not know is also null.",
  }),
  boosters: z.array(z.string().nullable()).meta({
    description: "Directives fitted, by slot, a free one being null.",
  }),
  consumables: z.array(z.string().nullable()).meta({
    description: "Consumables carried, by slot, a free one being null.",
  }),
  shells: z.array(BattleReplayLoadoutShell).meta({
    description: "The rounds loaded, in the client's own order.",
  }),
  crew: z.array(BattleReplayLoadoutCrew).meta({
    description:
      "The crew, one entry per seat, each with its own skills. Kept per seat rather than flattened: for the five skills every seat can learn, how many of the crew trained it is the whole effect, and a deduplicated list cannot say.",
  }),
});

export const BattleReplayResponse = z.object({
  duration: z.number().meta({
    description: "How long the recording runs, in seconds.",
  }),
  ticksPerSecond: z.number().meta({
    description:
      "Clock ticks a second in each point's first value. Hundredths, so a point's instant in seconds is its tick divided by this.",
  }),
  startsAt: z.number().meta({
    description:
      "The clock tick the countdown ends and the battle begins. Zero when it cannot be worked out. Before it every vehicle sits on its spawn without moving, and since positions are only recorded when they change, a reader must treat that stretch as everybody being visible rather than nobody.",
  }),
  chat: z.array(BattleReplayChatLine).meta({
    description:
      "Every line typed in the battle, in order. Empty for a battle nobody spoke in, which is the commoner case: two of four real recordings carried none at all.",
  }),
  deaths: z.array(BattleReplayDeath).meta({
    description:
      "Every vehicle destroyed, in order. The timing is the battle's own, so a tank nobody watched die is still here; the killer is the recording's, so it is null wherever the client could not see the shot.",
  }),
  mapImage: z.string().nullable().meta({
    description:
      "The minimap this battle was played on, resolved for its own mode. Here as well as on the battle itself so a caller holding only this answer can draw the positions on something.",
  }),
  mapBounds: z
    .object({
      bottomLeft: z.object({ x: z.number(), z: z.number() }),
      upperRight: z.object({ x: z.number(), z: z.number() }),
    })
    .nullable()
    .meta({
      description:
        "The arena's extent in metres, which is what turns a position in these tracks into a place on `mapImage`. Same shape as on the battle itself.",
    }),
  mapOverlay: z.unknown().nullable().meta({
    description: "The mode's own overlay for that map, when it has one.",
  }),
  tracks: z.array(BattleReplayTrack).meta({
    description:
      "One entry per vehicle this battle's recording client could see. A vehicle it never spotted has no track, which is honest fog of war rather than a gap.",
  }),
  loadouts: z.array(BattleReplayLoadout).meta({
    description:
      "What the player who recorded this had fitted, one entry per life: one for an ordinary battle, one per tank taken out in a mode with respawns. Only ever theirs, and empty for a recording whose client version this cannot be read from.",
  }),
});
