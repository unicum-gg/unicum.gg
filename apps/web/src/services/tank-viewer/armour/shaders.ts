// The game's penetration rules, worked out per pixel.
//
// **Carried over from the pipeline's own viewer, rule for rule.** Every figure
// here is the game's, not a judgement about what looks right, and the one thing
// that must not happen to this file is someone improving it: an armour view that
// is nearly correct is worse than none, because it answers confidently.
//
// Its source of truth stays `unicum-gg/wot.build`, `preview/live.html`.

/**
 * How a pixel's armour is classified once the layers are added up.
 *
 * The gathering pass packs its findings into one float per pixel and these are
 * the values it writes, so they are numbers rather than an enum: they cross into
 * GLSL, where there is nothing else to be.
 */
export const KIND = {
  none: 0,
  armour: 1,
  module: 2,
  unknown: 3,
  overmatched: 4,
  screenOnly: 5,
  optics: 6,
} as const;

/** Stands in for an impossible thickness, which is how a ricochet travels. */
export const BLOCKED = 1e6;

/** How far the penetration roll reaches either side of the nominal value. */
export const SPREAD = 0.25;

/** Where each pass draws, so the two gatherings can be kept apart. */
export const LAYER = { shape: 1, solid: 2, screen: 3 } as const;

/**
 * Named parts of a vehicle that are not armour at all: the optics, the breech
 * and the road wheels are modules, drawn so the shape reads but never answering
 * a penetration question.
 */
export const MODULE = /^(surveyingDevice|gunBreech|wheel|gun)$/;

/** The vision blocks and periscopes, which the client names on their own. */
export const OPTIC = /^surveyingDevice$/;

/** The shells that punch through rather than burn through. */
export const SOLID_SHOT = /^ARMOR_PIERCING/;

/** Tracks are the screen every vehicle carries. */
export const TRACK = /Track$/;

/**
 * How much a face is turned into the light, from nothing to fully lit.
 *
 * It never darkens: the colour a surface is given is the colour it shows at its
 * dullest, and a face turned towards the light is lifted towards white from
 * there. Shading the other way, by multiplying a colour down, is what made every
 * grey here read as dirty next to a viewer that lights its model properly.
 */
const LIGHTING = `
  float relief(vec3 n) {
    float top = max(dot(n, normalize(vec3(0.45, 0.82, 0.35))), 0.0);
    float side = max(dot(n, normalize(vec3(-0.7, 0.3, 0.6))), 0.0);
    return clamp(top * 0.72 + side * 0.28, 0.0, 1.0);
  }
`;

/**
 * The rules themselves.
 *
 * - the impact angle is measured off the plate's own normal
 * - a shell straightens by its normalisation, and by more when its calibre is
 *   over twice the plate: the two-calibre rule
 * - it cannot ricochet at all once its calibre reaches three times the plate:
 *   the three-calibre rule
 * - what is left of the angle stretches the plate by one over its cosine
 */
const RULES = `
  uniform float penetration;
  uniform float caliber;
  uniform float normalisation;
  uniform float ricochetAngle;
  uniform float calibreRules;
  uniform float byThickness;

  // Nearly every vehicle declares a few plates at zero. They are the openings in
  // a hull, not steel, so a shell goes straight through and there is nothing for
  // a calibre rule to act on.
  bool overmatches(float thickness) {
    return thickness > 0.0 && calibreRules > 0.5 && caliber >= 3.0 * thickness;
  }

  float effectiveThickness(float thickness, float facing) {
    float angle = degrees(acos(clamp(facing, 0.0, 1.0)));
    float straighten = normalisation;
    if (calibreRules > 0.5 && caliber > 2.0 * thickness) straighten *= (1.4 * caliber) / (2.0 * thickness);
    if (!overmatches(thickness) && angle >= ricochetAngle) return ${BLOCKED.toFixed(1)};
    float left = max(angle - straighten, 0.0);
    return thickness / max(cos(radians(left)), 0.02);
  }
`;

export const VERTEX = `
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vNormal = normalize(mat3(modelMatrix) * normal);
    vec4 world = modelMatrix * vec4(position, 1.0);
    vView = cameraPosition - world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

/**
 * A surface of the vehicle itself: whatever a shell reaches first and would
 * actually damage.
 */
export const SOLID = `
  precision highp float;
  varying vec3 vNormal;
  varying vec3 vView;
  uniform float thickness;
  uniform float kind;
  ${LIGHTING}
  ${RULES}
  void main() {
    vec3 n = normalize(vNormal);
    // A collision mesh is a shell, so a face turned away from the camera is lit
    // as if it were turned towards it. Without this the inside of a hull comes
    // out black wherever it shows through an opening.
    if (!gl_FrontFacing) n = -n;
    float facing = abs(dot(n, normalize(vView)));
    bool armour = kind == ${KIND.armour.toFixed(1)};
    // Reading the plate rather than the shot: what it is, not what a shell would
    // make of it, so neither the angle nor the calibre rules come into it.
    float own = !armour ? 0.0
      : byThickness > 0.5 ? thickness
      : effectiveThickness(thickness, facing);
    float said = armour && byThickness < 0.5 && overmatches(thickness)
      ? ${KIND.overmatched.toFixed(1)}
      : kind;
    gl_FragColor = vec4(0.0, said, own, relief(n));
  }
`;

/**
 * A screen drawn for its own sake, so that one standing in front of open air
 * still has a shape and a light on it. It writes no depth, so the vehicle behind
 * it paints over it in the pass that follows.
 */
export const SCREEN_SHAPE = `
  precision highp float;
  varying vec3 vNormal;
  varying vec3 vView;
  uniform float thickness;
  ${LIGHTING}
  void main() {
    vec3 n = normalize(vNormal);
    if (!gl_FrontFacing) n = -n;
    gl_FragColor = vec4(0.0, ${KIND.screenOnly.toFixed(1)}, thickness, relief(n));
  }
`;

/**
 * A screen: spaced armour with the vehicle somewhere behind it. Screens are
 * drawn additively over whatever the pass above found, so a pixel ends up
 * carrying the sum of everything the shell has to cross.
 */
export const SCREEN = `
  precision highp float;
  varying vec3 vNormal;
  varying vec3 vView;
  uniform float thickness;
  ${RULES}
  void main() {
    float facing = abs(dot(normalize(vNormal), normalize(vView)));
    gl_FragColor = vec4(effectiveThickness(thickness, facing), 0.0, 0.0, 0.0);
  }
`;

/** Adding the layers up and saying what a player would see. */
export const COMPOSE = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D gathered;
  uniform sampler2D screenShapes;
  uniform sampler2D gatheredDepth;
  uniform sampler2D screenDepth;
  uniform float penetration;
  uniform float byThickness;
  uniform vec3 rampNone;
  uniform vec3 rampEven;
  uniform vec3 rampAlways;
  uniform vec3 colourRicochet;
  uniform vec3 colourOvermatch;
  uniform vec2 armourRange;
  uniform vec3 colourModule;
  uniform vec3 colourOptics;
  uniform vec3 colourUnknown;

  // A screen is not on the penetration scale at all: it stops nothing by itself.
  // It gets a scale of its own instead, running from blue where it is as thick
  // as the vehicle's own armour to violet where it is barely a skirt, so a
  // player can tell one from the other at a glance.
  /** Where a thickness sits in this vehicle's own span, 0 thin to 1 thick. */
  float share(float thickness) {
    return clamp((thickness - armourRange.x) / max(armourRange.y - armourRange.x, 1.0), 0.0, 1.0);
  }

  vec3 fromHue(float hue) {
    // Fully saturated, half lightness: the hue alone carries it.
    vec3 k = mod(vec3(5.0, 3.0, 1.0) + (hue / 360.0) * 6.0, 6.0);
    return 1.0 - clamp(min(k, min(4.0 - k, vec3(1.0))), 0.0, 1.0);
  }

  vec3 screenColour(float thickness) {
    // A track is spaced armour like any other, but it is also the one part of a
    // vehicle every player already recognises, so it keeps the neutral grey
    // rather than joining the scale.
    if (thickness < 0.0) return colourModule;
    return fromHue((1.0 - share(thickness)) * 120.0 + 200.0);
  }

  void main() {
    vec4 g = texture2D(gathered, vUv);
    float screens = g.r;
    float kind = g.g;
    float own = g.b;
    float lift = g.a;

    // A screen shows in its own right in two cases: where the vehicle covers
    // nothing at all behind it, and where it stands in front of a module, since
    // a track really does hide the road wheel behind it. Over armour it stays a
    // layer to be counted, never something drawn on top, which is the whole
    // point of adding the thicknesses up.
    vec4 only = texture2D(screenShapes, vUv);
    bool screenAhead = only.g > 0.0 && texture2D(screenDepth, vUv).r < texture2D(gatheredDepth, vUv).r;
    bool nothingBehind = kind == ${KIND.none.toFixed(1)};
    bool hidesModule = kind == ${KIND.module.toFixed(1)} && screenAhead;
    float screenThickness = 0.0;
    if (only.g > 0.0 && (nothingBehind || hidesModule)) {
      kind = only.g;
      lift = only.a;
      screens = 0.0;
      screenThickness = only.b;
    }

    // Nothing of the vehicle here, and no screen either: let what is behind show
    // through rather than painting over it.
    if (kind == ${KIND.none.toFixed(1)}) discard;

    vec3 tint;
    if (kind == ${KIND.screenOnly.toFixed(1)}) {
      tint = screenColour(screenThickness);
    } else if (kind == ${KIND.optics.toFixed(1)}) {
      tint = colourOptics;
    } else if (kind == ${KIND.module.toFixed(1)}) {
      tint = colourModule;
    } else if (kind == ${KIND.unknown.toFixed(1)}) {
      tint = colourUnknown;
    } else if (byThickness > 0.5) {
      // Thin runs green, thick runs red, over this vehicle's own span.
      tint = fromHue((1.0 - share(own)) * 120.0);
    } else {
      float total = screens + own;
      if (total >= ${(BLOCKED / 2).toFixed(1)}) {
        tint = colourRicochet;
      } else if (kind == ${KIND.overmatched.toFixed(1)}) {
        tint = colourOvermatch;
      } else {
        float low = penetration * ${(1 - SPREAD).toFixed(2)};
        float high = penetration * ${(1 + SPREAD).toFixed(2)};
        float odds = clamp((high - total) / max(high - low, 0.001), 0.0, 1.0);
        tint = odds > 0.5
          ? mix(rampEven, rampAlways, (odds - 0.5) * 2.0)
          : mix(rampNone, rampEven, odds * 2.0);
      }
    }
    // A face turned into the light is lifted towards white, never dimmed, so
    // every colour here shows at least the value it was given.
    tint = mix(tint, vec3(1.0), lift * 0.22);
    // A screen is worth seeing in its own right: it is the difference between a
    // flank and a flank with a skirt over it. It is laid over the answer rather
    // than replacing it, so the colour underneath still shows through.
    if (only.g > 0.0 && screenAhead && kind != ${KIND.screenOnly.toFixed(1)}) {
      tint = mix(tint, screenColour(only.b), only.b < 0.0 ? 0.5 : 0.7);
    }
    gl_FragColor = vec4(tint, 1.0);
  }
`;
