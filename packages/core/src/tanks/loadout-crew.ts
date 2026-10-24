import { sql } from "drizzle-orm";
import type { CrewSkillUsage, LoadoutMode } from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import { db } from "@unicum.gg/core/db";
import {
  battlesCte,
  PER_PLAYER_COLUMNS,
  PERFORMANCE_COLUMNS,
  performanceOf,
  type PerformanceRow,
  type RatingContext,
} from "@unicum.gg/core/tanks/loadout-sql";

type CrewRow = PerformanceRow & {
  role: string;
  skill: string;
  crews: string | number;
};

/**
 * Every skill each seat had trained, and how the battles fought with it went.
 *
 * Read from `crew_role_skills`, which names the seat beside each skill
 * (`gunner:gunner_sniper`), so a skill is measured on the seat that actually
 * carried it: the five skills every seat can learn are five different rows per
 * seat, which is the whole point for brotherhood or repair, whose effect
 * depends on how many of the crew trained it.
 *
 * Counted like the setups: players who ran it, battles it was in, and the
 * figures of those battles beside the same players' overall ones. `DISTINCT`
 * per battle, because a vehicle seating a role twice lists its skills twice.
 *
 * The share is over the players whose crew has that seat at all. Crews are not
 * the same size (a three-man crew has no loader), so dividing by everyone
 * would report that half the players never train their loader on a tank that
 * has none.
 */
export async function crewSkillUsage(
  region: Region,
  tankId: number,
  mode: LoadoutMode,
  context: RatingContext,
): Promise<CrewSkillUsage[]> {
  const rows = (await db.execute(sql`
    WITH observed AS (${battlesCte(region, tankId, mode)}),
    trained AS (
      SELECT o.*, t.role, t.skill
      FROM observed o
      CROSS JOIN LATERAL (
        SELECT DISTINCT split_part(entry, ':', 1) AS role,
                        split_part(entry, ':', 2) AS skill
        FROM unnest(COALESCE(o.crew_role_skills, '{}')) entry
        WHERE position(':' IN entry) > 0
      ) t
    ),
    seats AS (
      SELECT role, COUNT(DISTINCT account_id) AS crews FROM trained GROUP BY role
    ),
    per_player AS (
      SELECT role, skill, account_id, ${PER_PLAYER_COLUMNS}
      FROM trained
      GROUP BY role, skill, account_id
    )
    SELECT p.role, p.skill, s.crews, ${PERFORMANCE_COLUMNS}
    FROM per_player p
    JOIN seats s ON s.role = p.role
    GROUP BY p.role, p.skill, s.crews
    ORDER BY players DESC, battles DESC, p.skill ASC
  `)) as unknown as CrewRow[];

  return rows.map((row) => {
    const count = Number(row.players);
    const crews = Number(row.crews);
    return {
      role: row.role,
      skill: row.skill,
      count,
      battles: Number(row.battles),
      crews,
      share: crews > 0 ? count / crews : 0,
      performance: performanceOf(row, context),
    };
  });
}
