"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { Shot } from "@/services/tank-viewer/armour";
import {
  matchRound,
  rankOf,
  useAmmoChoice,
} from "@/components/tanks/detail/ammo-context";
import { modeKindFor } from "@/components/tanks/detail/mode-marks";
import { useVehicleModeChoice } from "@/components/tanks/detail/mode-context";
import type { HeroShell } from "@/components/tanks/detail/viewer/shell-rules";

// Which round the hero is answering for, and what a reader has done to it.
//
// **The picture and the ammunition panel are asking one question**, from either
// end of the page: what happens when this shell meets this plate. So the round
// is not the viewer's own state, it is the page's, and this is where the two
// meet. What is the viewer's own is the editing: a reader can tune a shot's
// figures to ask about a shell nobody has, and those edits belong to the round
// they were made against rather than to the vehicle.

export function useHeroShot({
  shells,
  builds,
  fitted,
  mechanic,
  opensOn,
}: {
  /** Every round each gun of this vehicle can load, by the gun's own key. */
  shells?: Record<string, HeroShell[]>;
  builds?: { keys?: { gun?: string } }[];
  /** The gun the reader has picked, where they have picked one. */
  fitted?: { gun: string } | undefined;
  /** Which mechanic the vehicle's second state is, since one of them recalibrates. */
  mechanic?: string | null;
  /** The shot the page was opened on, which only a shared link ever carries. */
  opensOn?: {
    pen: number;
    caliber: number;
    norm: number;
    ricochet: number;
    kind: string;
  };
}) {
  const loaded = useMemo(
    () =>
      // `keys` is optional the same way it is where the mounted build is read:
      // a payload from before it existed, or one a cache is still holding, has
      // configs with no names on their modules at all.
      shells?.[fitted?.gun ?? builds?.[0]?.keys?.gun ?? ""] ??
      shells?.[Object.keys(shells)[0] ?? ""] ??
      [],
    [shells, fitted, builds],
  );
  /**
   * Whether the reader has planted the vehicle, for one that can deploy.
   *
   * **The same state the characteristics are read on**, which is the switch
   * beside their title. A vehicle that has planted itself is a different tank:
   * its gun travels further and its hull tips, and the table says so. Planted
   * in one and not the other, the page draws one vehicle over the numbers of
   * another.
   */
  const { engaged, engage } = useVehicleModeChoice();
  const deployed = engaged !== null && engaged === modeKindFor(mechanic ?? null);
  const { picked, choose } = useAmmoChoice();
  const shared = matchRound(
    picked,
    loaded.map((one) => ({
      kind: one.shot.kind,
      damage: one.damage,
      penetration: one.penetration,
    })),
  );
  const round = shared >= 0 ? shared : 0;
  const setRound = (next: number) => {
    const one = loaded[next];
    choose(
      one
        ? {
            kind: one.shot.kind,
            damage: one.damage,
            penetration: one.penetration,
            // Which of the rounds these three figures cannot tell apart, so a
            // gun that lists two of a kind can have its second one picked.
            nth: rankOf(
              loaded.map((each) => ({
                kind: each.shot.kind,
                damage: each.damage,
                penetration: each.penetration,
              })),
              next,
            ),
          }
        : null,
    );
  };
  const round0 = loaded[round] ?? loaded[0] ?? null;
  /**
   * The round the view answers for, as the vehicle is standing.
   *
   * **A calibrated gun fires a different shell.** Deploying the Pz.Kpfw. Neu
   * opens the extra chambers in its gun and buys penetrating power with armour
   * damage: five more degrees of normalisation and five more before the shell
   * glances off. Both of those decide whether a plate is beaten, so answering
   * with the travelling figures while the tank is planted would be answering
   * about a shell it is not firing.
   */
  const base = useMemo(
    () =>
      deployed && round0?.deployed
        ? { ...round0, shot: round0.deployed }
        : round0,
    [deployed, round0],
  );
  /**
   * The shot a reader is building, held as typed.
   *
   * **Strings rather than numbers, so a half-typed one is still a field.** Held
   * as numbers, clearing the box to type `250` would put the shell's own figure
   * straight back after the first keystroke, and every edit would have to be
   * made from the right-hand end.
   *
   * **And stamped with the round it was built against, rather than reset when
   * that changes.** An edit belongs to the shell it was made for, and carrying
   * it onto the next one would quietly answer for a shell nobody has. Stamping
   * says so in the value: a stamp that no longer matches is simply not read,
   * where clearing the fields from an effect would be one render of the old
   * numbers under the new shell, and a write during render besides.
   */
  const [edits, setEdits] = useState<
    | {
        round: number;
        pen: string;
        calibre: string;
        norm: string;
        ricochet: string;
        kind: string;
        /**
         * Whether these came in on a link rather than from this reader.
         *
         * **A shared shot outlives the round it lands on.** The stamp is an
         * index into this vehicle's rounds, and the round a token names is
         * settled a moment later than the shot is: the panel resolves it, tells
         * the hero, and only then does the index hold still. Stamped with
         * whatever was current at the first render, the link's figures were
         * thrown away before the page had finished opening.
         */
        link?: boolean;
      }
    | undefined
  >(undefined);
  const typed = edits && (edits.link || edits.round === round) ? edits : undefined;
  const asTyped = (own: number | undefined) =>
    own === undefined ? "" : String(own);
  const pen = typed?.pen ?? asTyped(base?.shot.penetration);
  const calibre = typed?.calibre ?? asTyped(base?.shot.caliber);
  const norm = typed?.norm ?? asTyped(base?.shot.normalisation);
  const ricochet = typed?.ricochet ?? asTyped(base?.shot.ricochet);
  const kind = typed?.kind ?? base?.shot.kind ?? "";
  const tune = (patch: {
    pen?: string;
    calibre?: string;
    norm?: string;
    ricochet?: string;
    kind?: string;
    // Touched by hand, so it belongs to the round it was made against from
    // here on, the way every edit does.
  }) => setEdits({ round, pen, calibre, norm, ricochet, kind, ...patch });
  /**
   * Change what kind of shell this is.
   *
   * **A kind this vehicle carries brings its own figures with it.** Normalisation
   * and the ricochet angle belong to the round rather than to the reader, so
   * where there is a real one to read them off, they are read rather than left
   * on the last shell's. Where there is not, they stay put and in plain sight in
   * their own boxes: this offers the reader the numbers rather than inventing
   * them behind a label.
   */
  const setKind = (next: string) => {
    const real = loaded.find((one) => one.shot.kind === next);
    tune({
      kind: next,
      ...(real
        ? {
            norm: String(real.shot.normalisation),
            ricochet: String(real.shot.ricochet),
          }
        : {}),
    });
  };
  const shell = useMemo<Shot | null>(() => {
    if (!base) return null;
    // A field that is empty, or not a number, or below zero, is a reader
    // mid-edit rather than a claim about a shell, so the round's own figure
    // stands. Zero is a real answer for normalisation, and not for the rest.
    const asked = (as: string, own: number, floor = 0) => {
      const value = Number(as);
      return Number.isFinite(value) && value >= floor && as.trim() !== ""
        ? value
        : own;
    };
    return {
      penetration: asked(pen, base.shot.penetration, 1),
      caliber: asked(calibre, base.shot.caliber, 1),
      normalisation: asked(norm, base.shot.normalisation),
      ricochet: asked(ricochet, base.shot.ricochet),
      kind,
    };
  }, [base, pen, calibre, norm, ricochet, kind]);
  /** Whether the shot the link carried has been put back, which happens once. */
  const tuned = useRef(false);

  // Once the round it belongs to is known: the same token can name a round and
  // a shot built from it, and an edit stamped with the wrong one is not read at
  // all. Its own mark rather than the one the build uses, which may well have
  // run first and would then have swallowed this.
  useEffect(() => {
    if (tuned.current || !opensOn) return;
    tuned.current = true;
    const one = opensOn;
    setEdits({
      round,
      link: true,
      pen: String(one.pen),
      calibre: String(one.caliber),
      norm: String(one.norm),
      ricochet: String(one.ricochet),
      kind: one.kind,
    });
  }, [round, opensOn]);
  /**
   * And once that round holds still, the link's shot becomes its own.
   *
   * **The exemption was meant to last until the round settled, not for ever.**
   * A shot that goes on ignoring the stamp follows the reader onto every other
   * round they pick, so a link carrying a built shot answered for a HEAT shell
   * with the penetration, the calibre and even the kind of the one it was
   * written about. Stamped after a frame in which the round did not move, it
   * behaves from then on like any other edit: it belongs to that round and is
   * left behind when the reader leaves it.
   */
  useEffect(() => {
    if (!edits?.link) return;
    const settled = requestAnimationFrame(() =>
      setEdits((held) => (held?.link ? { ...held, round, link: false } : held)),
    );
    return () => cancelAnimationFrame(settled);
  }, [edits?.link, round]);

  return {
    loaded,
    round,
    setRound,
    shell,
    deployed,
    engage,
    kind,
    setKind,
    tune,
    pen,
    calibre,
    norm,
    ricochet,
  };
}
