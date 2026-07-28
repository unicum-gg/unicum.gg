import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@unicum.gg/core/auth";
import { isRegion } from "@unicum.gg/wargaming";
import {
  createWorkflow,
  deleteWorkflow,
  loadBoostConsole,
  updateWorkflow,
} from "@unicum.gg/core/clans/boost-workflow/console";

// Officer-only, session-authenticated, per-session — never cacheable. Not part
// of the public API (no @openapi), so it's excluded from the OpenAPI/SDK surface.
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ region: string; tag: string }> };

async function currentUserId(): Promise<string | undefined> {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user?.id;
}

/** The officer console: all workflows, live online, and available reserves. */
export async function GET(_req: Request, { params }: Params): Promise<Response> {
  const { region } = await params;
  if (!isRegion(region)) {
    return NextResponse.json({ error: "invalid_region" }, { status: 400 });
  }
  return NextResponse.json(await loadBoostConsole(region, await currentUserId()));
}

const workflowSchema = z
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

/** Create a new workflow for the caller's own clan (officer only). */
export async function POST(req: Request, { params }: Params): Promise<Response> {
  const { region } = await params;
  if (!isRegion(region)) {
    return NextResponse.json({ error: "invalid_region" }, { status: 400 });
  }
  const parsed = workflowSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const result = await createWorkflow(region, await currentUserId(), parsed.data);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 403 });
  }
  return NextResponse.json(result);
}

const updateSchema = z
  .object({ id: z.string().uuid(), claim: z.boolean().optional() })
  .and(workflowSchema);

/** Update one workflow by id (officer only, scoped to their own clan). Pass
 * `claim: true` to also take over ownership (run it on the caller's account). */
export async function PUT(req: Request, { params }: Params): Promise<Response> {
  const { region } = await params;
  if (!isRegion(region)) {
    return NextResponse.json({ error: "invalid_region" }, { status: 400 });
  }
  const parsed = updateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const { id, claim, ...input } = parsed.data;
  const result = await updateWorkflow(
    region,
    await currentUserId(),
    id,
    input,
    claim,
  );
  if ("error" in result) {
    const status = result.error === "not_found" ? 404 : 403;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json(result);
}

/** Delete one workflow by id (officer only, scoped to their own clan). */
export async function DELETE(req: Request, { params }: Params): Promise<Response> {
  const { region } = await params;
  if (!isRegion(region)) {
    return NextResponse.json({ error: "invalid_region" }, { status: 400 });
  }
  const id = new URL(req.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "missing_id" }, { status: 400 });
  }
  const result = await deleteWorkflow(region, await currentUserId(), id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 403 });
  }
  return NextResponse.json({ ok: true });
}
