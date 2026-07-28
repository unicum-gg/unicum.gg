import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@unicum.gg/core/auth";
import { isRegion } from "@unicum.gg/wargaming";
import { simulateWorkflow } from "@unicum.gg/core/clans/boost-workflow/console";

// Officer-only "test run": dry-run a workflow config against the live clan now.
// Session-authenticated, never cacheable, not part of the public API/SDK.
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ region: string; tag: string }> };

const bodySchema = z
  .object({
    name: z.string().max(80).default(""),
    enabled: z.boolean(),
    timezone: z.string().min(1).max(64),
    days: z.number().int().min(0).max(127),
    windowStart: z.number().int().min(0).max(1439),
    windowEnd: z.number().int().min(1).max(1440),
    minOnline: z.number().int().min(1).max(100),
    reserves: z
      .array(z.object({ type: z.string().min(1).max(64), level: z.number().int().min(1).max(20) }))
      .max(20),
  })
  .refine((v) => v.windowStart < v.windowEnd, {
    message: "window_start must be before window_end",
    path: ["windowStart"],
  });

export async function POST(req: Request, { params }: Params): Promise<Response> {
  const { region } = await params;
  if (!isRegion(region)) {
    return NextResponse.json({ error: "invalid_region" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const session = await auth.api.getSession({ headers: await headers() });
  const result = await simulateWorkflow(region, session?.user?.id, parsed.data);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 403 });
  }
  return NextResponse.json(result);
}
