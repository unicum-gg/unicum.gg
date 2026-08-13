import type { NextConfig } from "next";

import { AGENT_DISCOVERY_LINK } from "../src/constants/agent-discovery";

export const headers: NextConfig["headers"] = async () => [
  // Advertise discovery on every page (and route), not just the homepage.
  // Excludes Next internals/assets under `_next/`, and the Markdown twins:
  // a header set here REPLACES the handler's own `Link`, and theirs carries
  // the canonical pointing back at the HTML page. They re-advertise
  // discovery themselves, from the same constant (`agentDiscoveryLink`).
  {
    source: "/((?!_next/|api/md/)(?!.*\\.md$).*)",
    headers: [{ key: "Link", value: AGENT_DISCOVERY_LINK }],
  },
];
