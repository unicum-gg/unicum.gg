import {
  bucketEdges,
  type DistributionBucket,
} from "@unicum.gg/shared";

/** One row of a `width_bucket` histogram query. */
export type BucketRow = { metric: string; bucket: number; n: number };

/**
 * Fill a bucket series from the rows `width_bucket` produced.
 *
 * `width_bucket` answers 0 for a value below the range and `steps + 1` for one
 * above, which is exactly the two overflow buckets `bucketEdges` describes, so
 * the index it returns is the index into that array.
 */
export function toBuckets(
  rows: BucketRow[],
  metric: string,
  range: { min: number; max: number; steps: number },
  domain: { min: number; max: number },
): DistributionBucket[] {
  const edges = bucketEdges(range, domain);
  const counts = new Map(
    rows.filter((r) => r.metric === metric).map((r) => [r.bucket, r.n]),
  );
  const filled = edges.map((edge, i) => ({ ...edge, count: counts.get(i) ?? 0 }));

  // Trim an overflow bucket that caught nothing, at either end, once. Win rate
  // has players under 30% and ratings have players above 3000, so those
  // buckets earn their column; nobody is below a rating of zero, and drawing
  // "below 0" as an empty column would invent a region of the scale. Only the
  // two ends are considered, so an empty bucket inside the range keeps its slot
  // and the axis stays evenly spaced. Trimmed after the counts are placed, so
  // the index stays aligned with `width_bucket` while it matters.
  if (filled.length > 0 && filled[0].count === 0) filled.shift();
  if (filled.length > 0 && filled[filled.length - 1].count === 0) filled.pop();
  return filled;
}
