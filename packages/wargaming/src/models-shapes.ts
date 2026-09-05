// What the vehicle geometry mirror publishes, as a consumer reads it.
//
// The extraction owns these shapes and writes them; this is the reading half,
// kept beside `models-mirror.ts` because addressing a file and knowing what is
// in it are the same question. Anything drawing from the mirror (the hero's
// viewer today, an armour view later) shares them rather than describing the
// same JSON again.
//
// Source of truth: `unicum-gg/wot.build`, `lib/model.ts` and `lib/style.ts`.

/** One texture, at both definitions where the client ships both. */
export type MirrorTexture = { path: string; hd?: string; colorSpace?: string };

/** A material as a piece declares it, textures named by the slot they fill. */
export type MirrorMaterial = {
  name?: string;
  shader?: string;
  textures?: Record<string, MirrorTexture>;
  values?: Record<string, unknown>;
  doubleSided?: boolean;
  alphaTest?: number | null;
};

/** Where a decal is stuck, in the vehicle's own space. */
export type MirrorSlot = {
  kind: string;
  id: number;
  /**
   * The ray to project along, and the decal's up vector. Slots of the older
   * kinds carry these; a projection decal carries a box instead.
   */
  rayStart: number[] | null;
  rayEnd: number[] | null;
  rayUp: number[] | null;
  /** A projection decal's own box: where it sits, how it is turned, how big. */
  position: number[] | null;
  rotation: number[] | null;
  scale: number[] | null;
  /** What may go in this slot, as the tags an item must all name. */
  tags: string[];
  /** Which part the slot shows on, as an `appliedTo` bit. */
  showOn: number;
  /** How wide the mark is, in metres. */
  size: number;
  /** Mirrored onto the vehicle's other side. */
  mirrored: boolean;
  /** Named only when the slot belongs to one 3D style rather than the vehicle. */
  model: string | null;
};

/** One of a vehicle's pieces: a hull, a chassis, a turret or a gun. */
export type MirrorPiece = {
  /** File name of the geometry, relative to the vehicle's folder. */
  glb: string;
  /** Attachment points, by name, as a translation in the vehicle's space. */
  hardpoints: Record<string, number[]>;
  /**
   * One entry per mesh in the `.glb`, in the same order, listing the material
   * each of its primitives draws with.
   */
  meshes: { name: string; materials: number[] }[];
};

/** How a vehicle's tracks are drawn: one link laid along a closed path. */
export type MirrorTracks = {
  /** The piece holding the link the first run lays. */
  segment: string;
  /**
   * The piece holding the second run's link, absent on a single-run belt.
   *
   * **A belt is often two runs of two different links.** The chassis names both
   * and gives each its own start along the path, half a pitch apart, so what
   * reads as one belt is two interleaved.
   */
  segment2?: string;
  /**
   * Metres between two links of one run, as the chassis declares it.
   *
   * **Declared, not measured.** A link mesh overlaps its neighbour at the pin,
   * so its own length is not its pitch: the E 100's is 205 mm long and steps
   * 150. Absent on a vehicle whose chassis declares no spline, where a viewer
   * has nothing better than the mesh to go on.
   */
  segmentLength?: number;
  /**
   * The link the belt down the vehicle's right is made of, where it differs.
   *
   * A shoe plate is not symmetric, so the chassis names one per side, and 58
   * vehicles name two different files. Absent where both sides really are the
   * same link, which is the other 909.
   */
  segmentRight?: string;
  /** The second run's right-side link, on the same terms. */
  segment2Right?: string;
  /**
   * How many links go round, where the chassis counts them.
   *
   * A belt the client simulates as a chain rather than lays along a curve
   * declares its own count, and that is a better pitch than any length: spacing
   * this many evenly closes the loop with no part link at the join, and absorbs
   * the slack a chain carries over its return rollers.
   */
  segments?: number;
  /** Where the first run starts along the path, in metres. */
  segmentOffset?: number;
  /** Where the second run starts along the path, in metres. */
  segment2Offset?: number;
  /** Closed paths in the vehicle's space, by side, in metres. */
  paths: Record<string, number[][]>;
};

/** How a piece stretches a camouflage, which the tiling divides by. */
export type MirrorPieceCamouflage = {
  tiling: [number, number, number, number] | null;
  density: [number, number];
  aoTextureSize: [number, number];
  exclusionMask: string | null;
};

/** One of the four colours a pattern's channels select between. */
export type MirrorColour = { r: number; g: number; b: number; a: number };

export type MirrorCamouflage = {
  texture: string;
  tiling: [number, number, number, number] | null;
  tilingType: string;
  factor: [number, number];
  offset: [number, number];
  scale: number;
  rotation: Partial<Record<string, number>>;
  /** The pattern's own pixel size, which the computed tiling divides by. */
  size: [number, number] | null;
  /** How many of its channels are weights: three where its alpha is padding. */
  weights: 3 | 4;
  colors: MirrorColour[];
  gloss: [number, number, number, number];
  metallic: [number, number, number, number];
  glossMetallicMap: string | null;
  normal: { texture: string; strength: number } | null;
  emission: { texture: string; power: number } | null;
  regions: Partial<Record<string, number>>;
};

/**
 * A sticker or a line of lettering, placed by casting a ray at one of the
 * vehicle's own emblem or inscription slots.
 *
 * Which slot it lands in comes from what it is rather than from where it is
 * pointed: the client keeps emblem slots and inscription slots apart on every
 * vehicle, and an emblem goes in an emblem slot.
 */
export type MirrorDecal = {
  texture: string;
  /** `emblem` or `inscription`, read from the key the client names it under. */
  kind: string;
  /** Whether the client mirrors it onto the vehicle's other side. */
  mirror: boolean;
  regions: Partial<Record<string, number>>;
};

/**
 * A decal projected into one of the vehicle's projection slots.
 *
 * Unlike an emblem, this one carries a box: the slot says where it sits, how it
 * is turned and how big, and the item says which slots it may go in by naming
 * their tags.
 */
export type MirrorProjectionDecal = {
  texture: string;
  /** The tags a slot must all carry for this to go in it. */
  tags: string[];
  /** One of the client's three sizes, already resolved. */
  scale: number;
  mirror: boolean;
};

export type MirrorOutfit = {
  season: string;
  camouflages: MirrorCamouflage[];
  paints: { color: MirrorColour; gloss: number; metallic: number; regions: Record<string, number> }[];
  regionColors: Partial<Record<string, MirrorColour[]>>;
  regionFinish: Partial<Record<string, { gloss: number; metallic: number }[]>>;
  decals: MirrorDecal[];
  projected: MirrorProjectionDecal[];
  marks: string[];
};

export type MirrorStyle = {
  id: number;
  name: string;
  icon?: string;
  outfits: MirrorOutfit[];
};

/**
 * A vehicle's patch on the shared style catalogue.
 *
 * The recipes are published once at the root, since they are the same on every
 * vehicle that can wear them; a vehicle keeps which of them it is offered and
 * the handful whose tiling the client tuned for it.
 */
export type MirrorStylePatch = {
  offers: number[];
  tiling: [number, number, number, [number, number, number, number]][];
};


/** The manifest a viewer reads before anything else. */
/** A road wheel the skin can turn, and what it takes to turn it in place. */
/** One arm of a levered suspension, and the wheel it carries. */
export type MirrorLever = {
  /** The bone the arm's own geometry is bound to. */
  bone: string;
  /** Where it hinges on the hull, in the vehicle's space. */
  pivot: number[];
  /** The wheel it carries, by bone. */
  wheel: string;
  /** The length of belt that wheel stands on, by bone, where there is one. */
  track?: string | null;
};

export type MirrorWheel = {
  /** The bone to turn, as the skin names it. */
  bone: string;
  /** Where its axle sits, so the turn happens about the right point. */
  axle: number[];
  /** How far the rim stands from that axle, so a turn can match a distance. */
  radius: number;
  /**
   * The circle the belt runs on around it, which is not the rim: a drive
   * sprocket carries its track in the tooth roots and an idler stands it off.
   */
  wrap: number;
};

export type MirrorModel = {
  features?: string[];
  hullPosition?: number[] | null;
  pieces: Record<string, MirrorPiece>;
  materials: MirrorMaterial[];
  wheels?: MirrorWheel[];
  /**
   * The arms a levered suspension hangs its wheels from.
   *
   * Only the vehicles that aim by kneeling carry these. The hull tips on them
   * while the wheels stay on the ground, so an arm has to swing by exactly the
   * angle its hinge moved through.
   */
  levers?: MirrorLever[];
  /**
   * The wheels that ride the ground rather than the body, by bone.
   *
   * **Said by the chassis, not inferred from the arms it draws.** An arm is
   * only needed to show one swinging; which wheels stay on the ground is a fact
   * about the vehicle, and two of them declare twelve arms while binding no
   * geometry to any. Read from the arms alone, those came out with every wheel
   * bolted to the body, so nothing held still when it tipped.
   */
  carried?: string[];
  /**
   * Which piece each module draws, by the name the game's own scripts give it.
   *
   * `_150mm_KwK44_L38` is the E 100's second gun and draws `Gun_06`. The key is
   * the one the derived specs are tagged with, which is the only name the
   * mirror and a catalogue built on WG's module ids have in common: without it
   * a viewer can only show whichever piece happens to sort first, and a reader
   * upgrading a gun sees the old one.
   */
  modules?: Record<string, string>;
  /**
   * The running gear that rides clear of the ground, by bone.
   *
   * The half of the chassis a kneeling vehicle carries with its body: the
   * return rollers and the belt they hold up. What is not here is on the
   * ground and stays there.
   */
  riders?: string[];
  tracks?: MirrorTracks;
  skins?: string[];
  slots?: Record<string, MirrorSlot[]>;
  camouflage?: Record<string, MirrorPieceCamouflage>;
  camouflageDensity?: [number, number];
  marks?: string[];
  /** The file naming this vehicle's patch on the shared catalogue. */
  styles?: string;
};

/**
 * Which vehicles the mirror carries, and where each one's geometry sits.
 *
 * Keyed by the code the game gives a vehicle, valued by the path under
 * `vehicles/` its files are published at, `russian/R45_IS-7`. The two halves are
 * both unguessable: the nation folder is not the nation the scripts name, and
 * the folder is not always the vehicle's own code, since a quarter of the
 * catalogue draws from another vehicle's meshes.
 *
 * It doubles as the list of what the mirror carries: a site drawing from a wider
 * catalogue reads a miss here as "fall back to a picture".
 */
export type MirrorIndex = Record<string, string>;
