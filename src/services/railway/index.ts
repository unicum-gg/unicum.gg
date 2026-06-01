import { env } from "env";

const ENDPOINT = "https://backboard.railway.com/graphql/v2";

type Measurement =
  | "CPU_USAGE"
  | "MEMORY_USAGE_GB"
  | "DISK_USAGE_GB"
  | "NETWORK_TX_GB"
  | "NETWORK_RX_GB"
  | "BACKUP_USAGE_GB";

const MEASUREMENTS: Measurement[] = [
  "CPU_USAGE",
  "MEMORY_USAGE_GB",
  "DISK_USAGE_GB",
  "NETWORK_TX_GB",
  "NETWORK_RX_GB",
  "BACKUP_USAGE_GB",
];

const MINUTES_PER_MONTH = 30 * 24 * 60;

// Railway's GraphQL API only exposes raw usage units per project (vCPU-minutes,
// GB-RAM-minutes, GB, GB-minutes) — never dollars. Their own dashboard does the
// same conversion client-side using the published rates from
// https://docs.railway.com/pricing. Update these constants if Railway changes
// the public pricing grid.
const RATE_USD_PER_UNIT: Record<Measurement, number> = {
  CPU_USAGE: 0.000463, // per vCPU-minute
  MEMORY_USAGE_GB: 0.000231, // per GB-RAM-minute
  DISK_USAGE_GB: 0.15 / MINUTES_PER_MONTH, // $0.15/GB-month → per GB-minute
  BACKUP_USAGE_GB: 0.15 / MINUTES_PER_MONTH,
  NETWORK_TX_GB: 0.05, // per GB egress
  NETWORK_RX_GB: 0, // ingress is free
};

export type RailwayCostBreakdown = {
  memory: number;
  cpu: number;
  network: number;
  volume: number;
  total: number;
};

export type RailwayBilling = {
  workspaceName: string;
  plan: string;
  current: RailwayCostBreakdown;
  estimated: RailwayCostBreakdown;
  billingPeriod: { start: Date; end: Date };
  fetchedAt: Date;
};

type UsageRow = { value: number; measurement: Measurement };
type EstimatedRow = { estimatedValue: number; measurement: Measurement };

type GraphQLResponse = {
  data?: {
    project: {
      workspace: {
        name: string;
        plan: string;
        customer: { billingPeriod: { start: string; end: string } };
      };
    };
    usage: UsageRow[];
    estimatedUsage: EstimatedRow[];
  };
  errors?: { message: string }[];
};

const QUERY = `query Billing(
  $projectId: String!,
  $measurements: [MetricMeasurement!]!,
) {
  project(id: $projectId) {
    workspace {
      name
      plan
      customer { billingPeriod { start end } }
    }
  }
  usage(projectId: $projectId, measurements: $measurements) {
    value measurement
  }
  estimatedUsage(projectId: $projectId, measurements: $measurements) {
    estimatedValue measurement
  }
}`;

function breakdown(
  byMeasurement: Map<Measurement, number>,
): RailwayCostBreakdown {
  let cpu = 0;
  let memory = 0;
  let network = 0;
  let volume = 0;
  for (const m of MEASUREMENTS) {
    const usd = (byMeasurement.get(m) ?? 0) * RATE_USD_PER_UNIT[m];
    if (m === "CPU_USAGE") cpu += usd;
    else if (m === "MEMORY_USAGE_GB") memory += usd;
    else if (m === "NETWORK_TX_GB" || m === "NETWORK_RX_GB") network += usd;
    else volume += usd;
  }
  return { cpu, memory, network, volume, total: cpu + memory + network + volume };
}

export async function getRailwayBilling(): Promise<RailwayBilling | null> {
  if (!env.RAILWAY_API_TOKEN || !env.RAILWAY_PROJECT_ID) return null;

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Project-Access-Token": env.RAILWAY_API_TOKEN,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: QUERY,
      variables: {
        projectId: env.RAILWAY_PROJECT_ID,
        measurements: MEASUREMENTS,
      },
    }),
    next: { revalidate: 600 },
  });

  if (!res.ok) {
    console.warn(`[railway] HTTP ${res.status}`);
    return null;
  }

  const body = (await res.json()) as GraphQLResponse;
  if (body.errors?.length || !body.data) {
    console.warn(
      "[railway] graphql errors:",
      body.errors?.map((e) => e.message).join(", "),
    );
    return null;
  }

  const { project, usage, estimatedUsage } = body.data;
  const currentMap = new Map<Measurement, number>(
    usage.map((u) => [u.measurement, u.value]),
  );
  const estimatedMap = new Map<Measurement, number>(
    estimatedUsage.map((u) => [u.measurement, u.estimatedValue]),
  );

  return {
    workspaceName: project.workspace.name,
    plan: project.workspace.plan,
    current: breakdown(currentMap),
    estimated: breakdown(estimatedMap),
    billingPeriod: {
      start: new Date(project.workspace.customer.billingPeriod.start),
      end: new Date(project.workspace.customer.billingPeriod.end),
    },
    fetchedAt: new Date(),
  };
}
