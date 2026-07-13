import type { z } from "zod";

/**
 * Return a route's JSON body typed against its documented Zod response schema,
 * so the handler and the OpenAPI spec can't silently drift: passing a shape the
 * schema doesn't describe is a compile error (`data` is `z.infer<typeof
 * schema>`). Compile-time only in production (zero runtime cost); in dev the
 * body is also validated and any mismatch is logged, so drift surfaces at once.
 */
export function jsonResponse<S extends z.ZodType>(
  schema: S,
  data: z.infer<S>,
  init?: ResponseInit,
): Response {
  if (process.env.NODE_ENV !== "production") {
    const parsed = schema.safeParse(data);
    if (!parsed.success) {
      console.error(
        "[jsonResponse] response does not match its documented schema:",
        parsed.error.issues,
      );
    }
  }
  return Response.json(data, init);
}
