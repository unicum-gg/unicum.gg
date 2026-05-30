import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/services/db";
import { cronLeader } from "@/services/db/schema";

const INSTANCE_ID = randomUUID();
const LEASE_DURATION_MS = 90 * 1000;

export function getInstanceId(): string {
  return INSTANCE_ID;
}

export async function tryAcquireLease(): Promise<boolean> {
  const nowIso = new Date().toISOString();
  const expiresIso = new Date(Date.now() + LEASE_DURATION_MS).toISOString();

  const result = (await db.execute(sql`
    INSERT INTO ${cronLeader} (id, instance_id, acquired_at, expires_at)
    VALUES (1, ${INSTANCE_ID}, ${nowIso}, ${expiresIso})
    ON CONFLICT (id) DO UPDATE
    SET instance_id = EXCLUDED.instance_id,
        acquired_at = EXCLUDED.acquired_at,
        expires_at = EXCLUDED.expires_at
    WHERE ${cronLeader}.expires_at < ${nowIso}
       OR ${cronLeader}.instance_id = EXCLUDED.instance_id
    RETURNING instance_id
  `)) as unknown as Array<{ instance_id: string }>;

  return result.length > 0 && result[0].instance_id === INSTANCE_ID;
}
