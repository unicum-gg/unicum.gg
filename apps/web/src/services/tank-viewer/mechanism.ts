import * as THREE from "three";

/**
 * The mechanism a handful of vehicles carry, and playing it.
 *
 * **Almost no tank has one.** Everything else that moves on a vehicle is driven
 * from a state rather than keyframed: a wheel turns with the ground, a hull
 * kneels on its suspension, a barrel recoils. A mechanism is the exception, and
 * the game keeps it as an animation because there is nothing to derive it from:
 * the Pz.Kpfw. Neu's gun opens six chambers, holds them two seconds and closes,
 * and no number anywhere in its specification says so.
 *
 * The clip ships inside the piece's own `.glb`, so this is only the player: it
 * finds what a loaded piece brought, runs one at a time, and stops of its own
 * accord at the end rather than looping, because the cycle is a thing the gun
 * does once per shot.
 */
export type Mechanism = {
  /** The clips this vehicle has, by name, empty for all but a few. */
  readonly clips: string[];
  /** Whether one is running, which is what the render loop watches. */
  running(): boolean;
  /**
   * Run one from the beginning. Returns how long it runs, in seconds.
   *
   * Without a name it takes the next in the list, which is what makes a pair
   * read the way the vehicle works it: a Strv opening onto its pillbox and
   * closing again are two clips, and asking for both at once would play them
   * over each other.
   */
  play(name?: string): number;
  /** Advance the running clip. */
  tick(seconds: number): void;
  /** Put the vehicle back the way it rests. */
  stop(): void;
};

/** A piece as it was loaded: its scene, and whatever animation came with it. */
export type Animated = { scene: THREE.Object3D; clips: THREE.AnimationClip[] };

export function mechanism(pieces: Animated[]): Mechanism {
  const players: { mixer: THREE.AnimationMixer; action: THREE.AnimationAction }[] = [];
  const names: string[] = [];
  for (const piece of pieces) {
    if (piece.clips.length === 0) continue;
    const mixer = new THREE.AnimationMixer(piece.scene);
    for (const clip of piece.clips) {
      const action = mixer.clipAction(clip);
      // The cycle runs once and holds where it ends, which for these clips is
      // where it started: the chambers close again before the last key.
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
      players.push({ mixer, action });
      if (!names.includes(clip.name)) names.push(clip.name);
    }
  }

  let running = false;
  /** Which clip the next unnamed call takes, so a pair plays in order. */
  let next = 0;

  return {
    clips: names,
    running: () => running,
    play(name) {
      const wanted = players.filter(
        (p) => p.action.getClip().name === (name ?? names[next % names.length]),
      );
      if (name === undefined) next++;
      if (wanted.length === 0) return 0;
      // **One clip writes the bones at a time.** A finished action holds its
      // end pose rather than releasing it, which is what keeps a vehicle open
      // between the opening and the closing, and two of them left running
      // would have the mixer average the two poses instead.
      for (const player of players) {
        if (!wanted.includes(player)) player.action.stop();
      }
      running = true;
      let longest = 0;
      for (const { action } of wanted) {
        action.reset();
        action.play();
        longest = Math.max(longest, action.getClip().duration);
      }
      return longest;
    },
    tick(seconds) {
      if (!running) return;
      let any = false;
      for (const { mixer, action } of players) {
        if (!action.isRunning()) continue;
        mixer.update(seconds);
        any = true;
      }
      running = any;
    },
    stop() {
      running = false;
      for (const { mixer, action } of players) {
        action.stop();
        // A stopped action leaves the bones where it left them, so the mixer is
        // stepped once more with nothing playing to put the piece back at rest.
        mixer.update(0);
      }
    },
  };
}
