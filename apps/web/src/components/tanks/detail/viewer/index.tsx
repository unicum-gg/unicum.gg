"use client";

import { type RefObject, useEffect, useRef } from "react";

import { AimDial } from "@/components/tanks/detail/viewer/aim-dial";
import { ArmourReadout } from "@/components/tanks/detail/viewer/readout";
import type { HeroShell } from "@/components/tanks/detail/viewer/shell-rules";
import { HERO_COLUMN } from "@/components/tanks/detail/viewer/column";
import { Presentation } from "@/components/tanks/detail/viewer/presentation";
import { ViewerControls } from "@/components/tanks/detail/viewer/controls";
import { openStage } from "@/components/tanks/detail/viewer/open";
import { useHeroAim } from "@/components/tanks/detail/viewer/use-hero-aim";
import { useHeroDress } from "@/components/tanks/detail/viewer/use-hero-dress";
import {
  useHeroLink,
  usePublishedHero,
} from "@/components/tanks/detail/viewer/use-hero-link";
import { useHeroDesk } from "@/components/tanks/detail/viewer/use-hero-desk";
import { useHeroStage } from "@/components/tanks/detail/viewer/use-hero-stage";
import { useHeroShot } from "@/components/tanks/detail/viewer/use-hero-shot";
import type { Shot } from "@/services/tank-viewer/armour";


// The vehicle, drawn from the geometry mirror, standing where the render was.
//
// **The picture stays the page's first paint.** A vehicle is around five
// megabytes of meshes and textures, so making it the hero's own content would
// trade a fast page for a slow one. It is built behind the render and fades in
// once it is ready, and a vehicle the mirror does not carry simply never fades.

export function TankViewer({
  code,
  shells,
  builds,
  mechanic,
  onAbsent,
  column,
}: {
  /** The code the game gives it, which is the folder's name, `R45_IS-7`. */
  code: string;
  /**
   * The shells the live view can answer for, by the gun that loads them, the
   * standard one first within each.
   *
   * Empty, or missing what the rules need, and the live view is not offered at
   * all: normalisation and the ricochet angle are not figures worth guessing.
   */
  shells?: Record<string, HeroShell[]>;
  /**
   * Every module combination, with the game's own name for each module.
   *
   * The configurator lives in a tab and the vehicle in the hero, so the two are
   * siblings rather than parent and child: what they share is the URL the
   * configurator already writes its choice into. Read from there, the hero can
   * mount the gun the reader picked without either knowing about the other.
   */
  builds?: {
    modules: Record<string, number | null>;
    keys: Record<string, string>;
  }[];
  /**
   * Which mechanic this vehicle's second state is, where it has one.
   *
   * The client tags all seven of them `siegeMode`, so the mark cannot be called
   * "siege" for every vehicle that has one: a Panhard EBR locks its wheels for
   * the road, an IS-3-II fires two guns, and this one recalibrates its shells.
   */
  mechanic?: string | null;
  /**
   * Said where this vehicle has no model to draw, rather than when one is
   * ready. The caller shows its picture on that alone: waiting is not a state
   * worth putting on the page, and having nothing to show is.
   */
  onAbsent?: () => void;
  /**
   * The page's column, which the vehicle is framed within rather than the
   * canvas. The hero runs the full width of the window and the reading does
   * not: the title, the panels and the controls all keep to this column, so a
   * vehicle anchored to the canvas would slide away from them as the window
   * widened. Absent, the canvas is its own frame.
   */
  column?: RefObject<HTMLElement | null>;
}) {
  const { fitted, opening } = useHeroLink(builds);
  const canvas = useRef<HTMLCanvasElement>(null);
  /**
   * The outgoing view, held still while the new one takes its place.
   *
   * **A photograph rather than a blend.** The three views are not variations of
   * one picture: two of them replace the render wholesale and the switch
   * between reading a plate and reading a shot is a branch in the shader, not a
   * factor to tween. Mixing them properly would mean computing both answers for
   * every pixel of the crossing. Keeping the last frame and dissolving it costs
   * one copy, and it reads the same.
   */
  const ghost = useRef<HTMLCanvasElement>(null);
  const stage = useHeroStage({ canvas, ghost });
  const { view, shown, hullDown, reading } = stage;
  /**
   * Which of them the view is answering for. The standard one until asked.
   *
   * **Shared with the Ammunition panel below**, so the two ends of the page
   * agree on what is being fired. Matched on the round rather than handed
   * across as a number: the panel offers what the gun loads and the hero only
   * the rounds whose rules it can answer for, so the lists differ.
   */
  // **The rounds of the gun that is on the vehicle**, which is not always the
  // one it was sold with. Falls back to the first build's, the way a page with
  // nothing chosen on it shows the stock loadout.
  const firing = useHeroShot({
    shells,
    builds,
    fitted,
    mechanic,
    opensOn: opening.shot,
  });
  const { shell, deployed, engage } = firing;
  const fire = useRef<((shot: Shot | null) => void) | null>(null);
  // Read through a ref so a shell chosen after the model loaded reaches the
  // rules without rebuilding the vehicle around it.
  const shellRef = useRef<Shot | null | undefined>(shell);
  useEffect(() => {
    shellRef.current = shell;
    // **The readout reads this ref every frame, and the picture does not.** The
    // plates hold the shot in uniforms of their own, so a round nobody hands
    // them leaves the vehicle painted for the last one while the panel under
    // the cursor answers for the new one.
    fire.current?.(shell);
  }, [shell]);
  const dressing = useHeroDress({ code, opening });
  /** The dial's own updater, filled by it and called once an ask is taken. */
  const aiming = useHeroAim({ deployed, mechanic, engage });
  const { aim, watch, takeAim, aimed } = aiming;

  const held = useRef<HTMLDivElement>(null);
  const desk = useHeroDesk({ held, sharp: dressing.sharp });
  const { liked, centred, presentation } = desk;
  usePublishedHero({ view, dressing, firing, hullDown, aimed });
  useEffect(() => {
    const surface = canvas.current;
    if (!surface) return;
    let live = true;
    // **Filled in the moment the loop exists, not when the build finishes.**
    // A vehicle takes seconds to fetch and a reader can pick another gun in
    // the middle of it. Read off the promise, the two ways of closing it
    // arrived after the cleanup that needed them had already run, so an
    // interrupted build left its loop, its observers and its listeners
    // running on a canvas the next vehicle was about to draw on.
    const closing: { freeze?: () => void; stop?: () => void } = {};
    void openStage(
      surface,
      () => live,
      {
        held,
        shellRef,
        fire,
        ...desk.handles,
        ...stage.handles,
        ...aiming.handles,
        ...dressing.handles,
        skin: dressing.skin,
        liked,
        column,
      },
      {
        code,
        skin: dressing.skin,
        fitted,
        liked,
        opening,
        applyStance: aiming.applyStance,
        takeAim,
        onAbsent,
        column,
      },
      closing,
    );

    return () => {
      live = false;
      // **The vehicle being left stays on screen while the next one is built.**
      // Torn down bare, the picture emptied the moment a reader clicked another
      // tank and stayed empty for the ten seconds it takes to fetch and build
      // one, then faded in from nothing. Holding the frame turns that into one
      // vehicle giving way to another.
      closing.freeze?.();
      closing.stop?.();
    };
    // `opening` and `takeAim` are both fixed for the life of the component, so
    // naming them here costs no rebuild: the link is read once into state and
    // the aim is a callback over refs.
  }, [
    aiming.handles,
    aiming.applyStance,
    dressing.handles,
    code,
    column,
    dressing.skin,
    onAbsent,
    fitted,
    liked,
    fire,
    shellRef,
    opening,
    takeAim,
    liked.centred,
    desk.handles,
    stage.handles,
  ]);

  const filling = presentation !== Presentation.Inline;
  return (
    // **The viewer holds its own box.** It used to be handed one by the stage,
    // which is fine while the picture stays in the band and no use at all once
    // it has to leave it: filling the window is this element becoming fixed,
    // and filling the screen is the browser being handed this element.
    <div
      ref={held}
      className={
        filling ? "fixed inset-0 z-50 bg-background" : "absolute inset-0"
      }
    >
      {/* Not in the column: it is put where the cursor is, and the cursor goes
        wherever the picture does. */}
      <ArmourReadout reading={reading} />
      {/*
        **Short enough to soften the edge, not long enough to be an arrival.**
        Three quarters of a second read as the vehicle turning up, and a turning
        up is a loading screen wearing something nicer. A fifth of a second sits
        under the threshold where the eye follows a movement rather than finding
        the picture already there, so it takes the hardness off the first frame
        without putting a wait back on the page.
      */}
      <canvas
        ref={canvas}
        aria-hidden
        className={`absolute inset-0 h-full w-full ${
          stage.crossing ? "" : "transition-opacity duration-700"
        } ${shown ? "opacity-100" : "opacity-0"}`}
      />
      {/*
        The frame the last view left behind, dissolved over the new one. It is
        transparent whenever nothing is crossing, and never takes the pointer:
        the vehicle underneath stays turnable through it.
      */}
      <canvas
        ref={ghost}
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
      />
      {shown ? (
        // **The panels are reading, so they keep to the column.** The picture
        // runs to the edges of the window and they do not: left against the
        // canvas they ended up out at the margins, further from the vehicle
        // they describe on every wider screen, and lined up with nothing else
        // on the page.
        <div className={`pointer-events-none absolute inset-0 ${HERO_COLUMN}`}>
          {/* **One stack, bottom left, rather than each panel placing itself.**
            They did, and it held only while the row was short: the moment it
            grew a shell to build it ran under the cost panel on the other side
            and the legend sat on top of it. Stacked, the row can wrap and the
            legend is pushed up by exactly as much as it grows. The width is
            capped short of the cost panel for the same reason: the two share
            this band and neither is told about the other. */}
          {/*
            Where the camera stands. It sits opposite the controls, in the
            corner the reader is not reaching into, and lifts clear of the cost
            panel while the picture is still in the band: the two share that
            corner and neither is told about the other. Filling the window or
            the screen leaves the panel behind, so it drops back down.
          */}
          {/* Pointer events are turned back on here because the band this sits
            in has them off: the picture underneath has to stay draggable
            through the chrome, so the column refuses them and each control
            that wants them asks for itself. Without this the dial is drawn,
            reads correctly, and cannot be pointed at. */}
          <div
            className="pointer-events-auto absolute right-3 z-10"
            style={{
              // Filling the window or the screen leaves the cost behind on the
              // page, so there is nothing left to clear.
              bottom: filling || desk.clearance === null ? 12 : desk.clearance,
            }}
          >
            <AimDial
              sweep={aiming.reach?.sweep}
              arc={aiming.reach?.arc}
              hullPitch={aiming.reach?.hullPitch}
              aimRef={aim}
              watchRef={watch}
              onAim={takeAim}
            />
          </div>
          {/* **One band, grouped by what each control is about.** The width is
            capped short of the cost panel on the other side: the two share this
            corner and neither is told about the other. */}
          <div className="absolute bottom-3 left-3 max-w-[calc(100%-1.5rem)] sm:max-w-[calc(100%-21rem)]">
            <ViewerControls
              centred={centred}
              onRecentre={() => desk.recentring(!centred)}
              // Offered for anything that can be undone, which is not only the
              // camera: a reader who has done nothing but point the gun still
              // has something to put back.
              resettable={
                stage.moved || centred || aimed !== null || hullDown
              }
              onReset={stage.restore}
              hullDown={hullDown}
              onHullDown={() => stage.ridging(!hullDown)}
              canDeploy={aiming.canDeploy}
              mechanic={mechanic ?? null}
              deployed={deployed}
              onDeploy={aiming.setDeploy}
              cinematic={desk.cinematic}
              onCinematic={desk.setCinematic}
              presentation={presentation}
              onPresentation={desk.present}
              shells={firing.loaded}
              round={firing.round}
              onRound={firing.setRound}
              pen={firing.pen}
              calibre={firing.calibre}
              norm={firing.norm}
              ricochet={firing.ricochet}
              kind={firing.kind}
              onTune={firing.tune}
              onKind={firing.setKind}
              carried={firing.loaded.map((one) => one.shot.kind)}
              range={stage.range}
              works={stage.works}
              onWork={stage.operate}
              rolls={stage.rolls}
              rolling={desk.rolling}
              onRolling={() => desk.setRolling((on) => !on)}
              sharp={dressing.sharp}
              sharpenable={dressing.sharpenable}
              onSharpen={() => dressing.setSharp((on) => !on)}
              marks={dressing.marks}
              markable={dressing.markable}
              onMarks={dressing.setMarks}
              cuts={dressing.cuts}
              cutNames={dressing.cutNames}
              cut={dressing.skin}
              onCut={dressing.cutInto}
              wardrobe={dressing.wardrobe}
              worn={dressing.worn}
              onWear={dressing.wear}
              season={dressing.season}
              onSeason={dressing.setSeason}
              view={view}
              views={stage.views}
              onView={stage.showing}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
