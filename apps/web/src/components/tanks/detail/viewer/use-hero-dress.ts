"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { preferences } from "@/components/tanks/detail/viewer/preferences";
import type { Definition } from "@/services/tank-viewer";
import type { SkinFace } from "@/services/tank-viewer/styles";
import type { MirrorStyle } from "@unicum.gg/wargaming";

// What the vehicle is wearing: its texture set, its marks, and its livery.
//
// **One cluster because they are one question.** All three are answered by the
// mirror once the vehicle is built, all three are put back from a shared link,
// and two of them exclude each other. Kept apart they were three sets of state,
// three refs mirroring them for the render loop, and the rule about the third
// written into the markup of a button.

/** How a vehicle is dressed, and everything the picture is told about it. */
export function useHeroDress({
  code,
  opening,
}: {
  /** The vehicle, so a livery chosen for one is not worn by the next. */
  code: string;
  opening: { marks?: number; cut?: string; season?: string };
}) {
  /**
   * Which of the two texture sets the vehicle wears.
   *
   * **Built standard, then sharpened.** The two sets differ only in the side of
   * the maps, so the larger one changes nothing a reader needs before the tank
   * is on screen, and waiting for it would put the whole vehicle behind the
   * slowest download in it. So the build asks for the standard set, which is
   * what makes the first paint quick, and the sharper one is swapped in over
   * the top of a tank already being looked at.
   */
  // Seeded from what the reader last chose, like the rest of their desk, and
  // written back with it: the whole set is remembered under one key.
  const [sharp, setSharp] = useState(() => preferences().sharp);
  /** Whether the mirror carries the larger set for this vehicle at all. */
  const [sharpenable, setSharpenable] = useState(false);
  const define = useRef<((next: Definition) => void) | null>(null);
  const sharpRef = useRef(sharp);
  useEffect(() => {
    sharpRef.current = sharp;
    define.current?.(sharp ? "hd" : "sd");
  }, [sharp]);
  /**
   * How many marks of excellence the gun is wearing.
   *
   * Held here rather than inside the build, because a vehicle is rebuilt every
   * time a 3D style is put on it and a reader who asked for three marks means
   * three marks on whichever skin they end up looking at.
   */
  const [marks, setMarks] = useState(() => opening.marks ?? 0);
  /** How many the mirror has a texture for here, zero where it has none. */
  const [markable, setMarkable] = useState(0);
  const insignia = useRef<((count: number) => void) | null>(null);
  const marksRef = useRef(marks);
  useEffect(() => {
    marksRef.current = marks;
    insignia.current?.(marks);
  }, [marks]);
  /**
   * The 3D style on the vehicle, stamped with the vehicle it was chosen for.
   *
   * A style belongs to one tank, and this outlives a navigation to the next:
   * unstamped, opening another vehicle would ask the mirror for a folder named
   * after the last one's livery and come back with nothing at all.
   */
  const [cut, setCut] = useState<{ code: string; name: string } | null>(() =>
    opening.cut ? { code, name: opening.cut } : null,
  );
  const skin = cut?.code === code ? cut.name : null;
  /** The 3D styles this vehicle ships, which is empty until one is generated. */
  const [cuts, setCuts] = useState<string[]>([]);
  /** What each 3D style is called, so the wardrobe offers names not folders. */
  const [cutNames, setCutNames] = useState<Record<string, SkinFace>>({});
  /** What this vehicle can be dressed in, once the mirror has said. */
  const [wardrobe, setWardrobe] = useState<MirrorStyle[]>([]);
  const [worn, setWorn] = useState<MirrorStyle | null>(null);
  const [season, setSeason] = useState(() => opening.season ?? "summer");
  const dress = useRef<
    ((style: MirrorStyle | null, when: string) => void) | null
  >(null);
  useEffect(() => {
    dress.current?.(worn, season);
  }, [worn, season]);
  /** Whether the paint the link named has been put on, which happens once. */
  const painted = useRef(false);
  /**
   * **A 3D style is a whole style, not a coat of paint.** The game will not let
   * a player wear both: cutting a tank as the Tiger Claw is choosing its
   * camouflage too, and a 2D style laid over it would describe a vehicle nobody
   * can build. So each of these takes the other one off.
   */
  const cutInto = useCallback(
    (name: string | null) => {
      setCut(name ? { code, name } : null);
      if (name) setWorn(null);
    },
    [code],
  );
  const wear = useCallback((style: MirrorStyle | null) => {
    setWorn(style);
    if (style) setCut(null);
  }, []);
  /**
   * What the picture is handed, as one object that never changes.
   *
   * **The scene is rebuilt whenever what it was opened with changes**, and
   * everything here is a ref or a state setter, which React keeps for the life
   * of the component. Held in one memo, the vehicle is opened with the same
   * object every render and stays where it is.
   */
  const handles = useMemo(
    () => ({
      define,
      dress,
      insignia,
      marksRef,
      painted,
      sharpRef,
      setCutNames,
      setCuts,
      setMarkable,
      setSharpenable,
      setWardrobe,
      setWorn,
    }),
    [],
  );
  return {
    handles,
    sharp,
    setSharp,
    sharpenable,
    setSharpenable,
    define,
    sharpRef,
    marks,
    setMarks,
    markable,
    setMarkable,
    insignia,
    marksRef,
    skin,
    cuts,
    setCuts,
    cutNames,
    setCutNames,
    cutInto,
    wardrobe,
    setWardrobe,
    worn,
    setWorn,
    wear,
    season,
    setSeason,
    dress,
    painted,
  };
}
