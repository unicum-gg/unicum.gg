/**
 * How many vehicles a comparison holds, shared by everything that has to agree
 * on it: the page, the public endpoint, the OG card and the hook that mounts the
 * columns.
 *
 * The maximum is a hard ceiling rather than a preference. `useCompareBuilds`
 * calls `useTankBuild` a fixed number of times because the rules of hooks forbid
 * a loop, so raising this means adding calls there too; declared here so the
 * other three readers can never drift from it silently.
 */
export const MAX_COMPARE_TANKS = 4;

/** Below two vehicles there is nothing to compare. */
export const MIN_COMPARE_TANKS = 2;
