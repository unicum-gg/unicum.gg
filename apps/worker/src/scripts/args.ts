import { REGIONS, isRegion, type Region } from "@unicum.gg/wargaming";

// Argument parsing shared by the region-scoped worker scripts, all of which take
// the same shape: bare region names to narrow the run, and `--flag value` for
// the rest. It was copied into each of them, which is how one of the copies
// came to reject a flag with no value while the others read it as NaN.

/** The regions named on the command line, or every region when none is. */
export function regionArgs(argv: string[] = process.argv.slice(2)): Region[] {
  const named = argv.filter((a) => isRegion(a)) as Region[];
  return named.length > 0 ? named : [...REGIONS];
}

/**
 * A numeric flag, or undefined when it is absent.
 *
 * Undefined rather than NaN for a flag given without a value, so a mistyped
 * `--limit` reads as "no limit" (the documented default) instead of poisoning
 * every comparison it takes part in.
 */
export function numberArg(
  flag: string,
  argv: string[] = process.argv.slice(2),
): number | undefined {
  const at = argv.indexOf(flag);
  if (at < 0) return undefined;
  const value = Number(argv[at + 1]);
  return Number.isFinite(value) ? value : undefined;
}
