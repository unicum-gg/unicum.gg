import {
  drawableAxes,
  MAX_STARS,
  MIN_AXIS_VOTES,
  RATING_COLOR_HEX,
  starRatingColor,
  TANK_RATING_AXIS_LABEL,
  TANK_RATING_AXIS_SHORT,
  type AxisVerdict,
} from "@unicum.gg/shared";
import { Stars, StarValue } from "./stars";

const intFmt = new Intl.NumberFormat("en-US");

/**
 * The community's read of a tank, axis by axis.
 *
 * Hand-drawn SVG rather than a chart library: it is seven points on a circle,
 * it has no interaction worth the bundle, and drawing it here means it renders
 * on the server. On eleven hundred tank pages that is the difference between a
 * shape in the HTML and a shape that appears after hydration.
 *
 * It is only drawn once enough people have filled in the optional axes. Below
 * that the polygon is one person's opinion rendered as geometry, which reads as
 * far more authoritative than it is.
 */

/**
 * The canvas is wider than it is tall, and the polygon is not centred in a
 * square inside it.
 *
 * Labels sit outside the ring, and the ones at three and nine o'clock run
 * horizontally away from it, so a square canvas clips them: at seven axes the
 * side labels start about 98 units out and need another 40, which a 240-wide
 * box does not have. The extra width is margin for text, not for the shape, so
 * the radius stays where it was and only the horizontal centre moves.
 */
const WIDTH = 320;
const HEIGHT = 240;
const CENTRE_X = WIDTH / 2;
const CENTRE_Y = HEIGHT / 2;
const RADIUS = 78;
/** How far past the ring the labels sit. */
const LABEL_GAP = 22;
/** Rings at each whole star, so the shape can be read against the scale rather
 * than against itself. */
const RINGS = MAX_STARS;

type Point = { x: number; y: number };

/** Where an axis sits on the circle. Starts at the top and goes clockwise, the
 * direction a reader's eye takes, and the order the axes are declared in. */
function pointAt(index: number, count: number, distance: number): Point {
  const angle = (index / count) * Math.PI * 2 - Math.PI / 2;
  return {
    x: CENTRE_X + Math.cos(angle) * distance,
    y: CENTRE_Y + Math.sin(angle) * distance,
  };
}

function polygon(points: Point[]): string {
  return points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
}

export function AxisRadar({
  axes,
  axisVotes,
}: {
  axes: AxisVerdict[];
  axisVotes: number;
}) {
  const drawable = drawableAxes(axes);
  if (drawable.length < 3 || axisVotes < MIN_AXIS_VOTES) {
    return <NotEnoughAxisVotes votes={axisVotes} />;
  }

  const count = drawable.length;
  const shape = drawable.map((axis, i) =>
    pointAt(i, count, ((axis.value ?? 0) / MAX_STARS) * RADIUS),
  );
  // The polygon is painted at the colour its own mean would earn, so a weak
  // tank does not draw the same picture as a strong one in a different shape.
  const mean =
    drawable.reduce((sum, a) => sum + (a.value ?? 0), 0) / drawable.length;
  const colour = RATING_COLOR_HEX[starRatingColor(mean)];

  return (
    <div className="flex flex-col items-center gap-4 lg:flex-row lg:items-start lg:gap-8">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full max-w-[300px] shrink-0"
        role="img"
        aria-label="Community rating by axis"
      >
        {Array.from({ length: RINGS }, (_, ring) => (
          <polygon
            key={ring}
            points={polygon(
              drawable.map((_, i) =>
                pointAt(i, count, (RADIUS * (ring + 1)) / RINGS),
              ),
            )}
            className="fill-none stroke-fd-border"
            strokeWidth={ring === RINGS - 1 ? 1 : 0.5}
          />
        ))}
        {drawable.map((_, i) => {
          const end = pointAt(i, count, RADIUS);
          return (
            <line
              key={i}
              x1={CENTRE_X}
              y1={CENTRE_Y}
              x2={end.x}
              y2={end.y}
              className="stroke-fd-border"
              strokeWidth={0.5}
            />
          );
        })}
        <polygon
          points={polygon(shape)}
          fill={colour}
          fillOpacity={0.22}
          stroke={colour}
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
        {shape.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={2.5} fill={colour} />
        ))}
        {drawable.map((axis, i) => {
          const label = pointAt(i, count, RADIUS + LABEL_GAP);
          return (
            <text
              key={axis.axis}
              x={label.x}
              y={label.y}
              textAnchor={
                Math.abs(label.x - CENTRE_X) < 6
                  ? "middle"
                  : label.x > CENTRE_X
                    ? "start"
                    : "end"
              }
              dominantBaseline="middle"
              className="fill-fd-muted-foreground text-[9px]"
            >
              {/* The short form here and the full one in the list below: the
                ring has about nine characters of room at the sides, and the
                full labels were being clipped mid-word. */}
              {TANK_RATING_AXIS_SHORT[axis.axis]}
            </text>
          );
        })}
      </svg>

      {/* The same seven numbers, spelled out. The polygon says which way the
        tank leans, the list says by how much, and one of the two is what
        someone actually came for. */}
      <ul className="flex w-full flex-col gap-1.5">
        {drawable.map((axis) => (
          <li
            key={axis.axis}
            className="grid grid-cols-[1fr_auto_auto] items-center gap-3 text-sm"
          >
            <span className="text-fd-muted-foreground">
              {TANK_RATING_AXIS_LABEL[axis.axis]}
            </span>
            <Stars value={axis.value} size={12} />
            <StarValue value={axis.value} className="w-9 text-right text-xs" />
          </li>
        ))}
        <li className="pt-1 text-xs text-fd-muted-foreground">
          From {intFmt.format(axisVotes)} detailed{" "}
          {axisVotes === 1 ? "vote" : "votes"}.
        </li>
      </ul>
    </div>
  );
}

function NotEnoughAxisVotes({ votes }: { votes: number }) {
  return (
    <p className="text-sm text-fd-muted-foreground">
      {votes === 0
        ? "Nobody has filled in the detailed axes yet."
        : `Only ${intFmt.format(votes)} detailed ${votes === 1 ? "vote" : "votes"} so far.`}{" "}
      The breakdown appears at {MIN_AXIS_VOTES}, so the shape says something
      about the tank rather than about one person.
    </p>
  );
}
