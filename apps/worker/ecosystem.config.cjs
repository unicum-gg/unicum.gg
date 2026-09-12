const path = require("node:path");

// The worker is two jobs with different scaling laws, so it runs as two kinds of
// process under one supervisor rather than as two Coolify resources (which would
// mean maintaining the same 18 secrets, DATABASE_URL and the WG ids among them,
// in two places and keeping them in sync by hand).
//
// - crons: a singleton by nature. A second copy of the changelog post or the
//   server sampler is a bug, not throughput. The DB lease already enforces that,
//   and one process is ample for work that spends its life waiting on a clock.
// - pipeline: the opposite. Its queue is the players table itself, claimed FOR
//   UPDATE SKIP LOCKED, so any number of processes drain it safely. Node is
//   single-threaded, so THIS COUNT IS THE PIPELINE'S CPU CEILING: production
//   measured one process pinned at 106% CPU while Postgres sat 85% idle and the
//   WG budget ran at 15%. Nothing upstream was saturated; the one thread was.
const pipelineInstances = Number(process.env.WORKER_PIPELINE_INSTANCES || 1);

// Postgres runs max_connections=200 and this service's slice of it is 40 (see
// AGENTS.md, "Connection budget"). Every process opens its OWN pool, so the
// budget is divided here rather than inherited: N processes each reading the
// full DB_BACKGROUND_POOL_MAX would open N times the budget and quietly eat the
// headroom the on-host build and the dev worktrees depend on.
//
// The crons share is fixed rather than divided: it is one process whatever the
// pipeline does, and its work (the clan backfill, the nightly leaderboard walk)
// is paced by remote hosts, not by pool depth.
//
// Raising `pipelineInstances` past what the budget divides into comfortably means
// raising DB_BACKGROUND_POOL_MAX too, not letting the floor shrink every pool
// until they all starve. The 4 floor is the signal that the budget needs a look.
const backgroundBudget = Number(process.env.DB_BACKGROUND_POOL_MAX || 40);
const CRONS_POOL_MAX = 16;
const pipelinePoolMax = Math.max(
  4,
  Math.floor((backgroundBudget - CRONS_POOL_MAX) / pipelineInstances),
);

// Same arithmetic, and the same reason, as apps/web/ecosystem.config.cjs: V8
// sizes its heap from HOST RAM and never reads the container's cgroup limit, so
// a worker left alone grows toward ~4 GiB while the container is capped far
// lower. The kernel then kills it before V8 ever sees a reason to collect. That
// is not theory here: on 2026-09-12 the web container's cgroup reported its
// limit hit 566,380 times and 12 processes OOM-killed, each leaving a 2 GB core
// dump, because PM2 watched each process against a threshold no single one ever
// reached while their SUM sat against the container ceiling.
//
// So: take the budget, divide it across every process, and derive the heap
// ceiling one NON_HEAP_MB below the kill threshold, so V8 collects on its own
// and max_memory_restart goes back to being a leak net. The budget must stay
// BELOW the container's memory limit, with room for the PM2 master and spikes.
const NON_HEAP_MB = 550;
const memoryBudgetMb = Number(process.env.WORKER_MEMORY_BUDGET_MB || 5200);
const shareMb = Math.floor(memoryBudgetMb / (1 + pipelineInstances));
const heapCapMb = Math.max(512, shareMb - NON_HEAP_MB);
const killAtMb = heapCapMb + NON_HEAP_MB;

// tsx as a loader rather than as the binary, so PM2 owns the process (and can
// restart one kind without the other) instead of supervising a shim.
const interpreterArgs = `--import tsx --max-old-space-size=${heapCapMb}`;
const cwd = __dirname;
const script = path.join(__dirname, "src/index.ts");

const base = {
  script,
  cwd,
  interpreter: "node",
  interpreter_args: interpreterArgs,
  exec_mode: "fork",
  max_memory_restart: `${killAtMb}M`,
  // Let the shutdown handler finish the chunk in flight and release its rows.
  kill_timeout: 15000,
};

module.exports = {
  apps: [
    {
      ...base,
      name: "unicum-worker-crons",
      instances: 1,
      env: {
        NODE_ENV: "production",
        WORKER_ROLE: "crons",
        DB_BACKGROUND_POOL_MAX: String(CRONS_POOL_MAX),
      },
    },
    {
      ...base,
      name: "unicum-worker-pipeline",
      instances: pipelineInstances,
      env: {
        NODE_ENV: "production",
        WORKER_ROLE: "pipeline",
        DB_BACKGROUND_POOL_MAX: String(pipelinePoolMax),
      },
    },
  ],
};
