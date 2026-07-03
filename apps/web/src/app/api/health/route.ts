/**
 * Health check
 * @description Liveness probe. Referenced as the `status` link relation in the
 * API catalog (`/.well-known/api-catalog`) and usable as a plain uptime check.
 * @response HealthResponse
 * @tag System
 * @openapi
 */
export function GET(): Response {
  return Response.json({ status: "ok" });
}
