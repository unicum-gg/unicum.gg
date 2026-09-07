import { UnicumError } from "@unicum.gg/sdk";

/**
 * The endpoint's own name for what went wrong, out of the body it answers with.
 *
 * Read rather than inferred from the status, because our own endpoints answer
 * one status for several things: the video routes answer 404 for submissions
 * being unconfigured, an unknown map, an unknown tank and an unknown clan tag
 * alike, and telling someone standing on [FAME]'s page that we do not track
 * [FAME] is the kind of wrong a status code cannot help with.
 */
export function apiErrorCode(err: unknown): string | null {
  if (!(err instanceof UnicumError)) return null;
  const body = err.body;
  if (typeof body !== "object" || body === null) return null;
  const code = (body as { error?: unknown }).error;
  return typeof code === "string" ? code : null;
}

/** The status of a failed SDK call, or 0 for anything that never reached the
 * endpoint (a dropped connection, a client-side throw). */
export function apiErrorStatus(err: unknown): number {
  return err instanceof UnicumError ? err.status : 0;
}
