"use client";

import dynamic from "next/dynamic";

// The lazy boundary for the coverage charts. recharts is the heaviest
// dependency in the client bundle (107 KB gzipped, 372 KB parsed) and these
// four charts sit at the bottom of the page, well below the fold, so there is
// no reason to make it part of the initial download.
//
// The boundary has to be its own Client Component: `coverage-view` is a Server
// Component, and Next does not code-split a Client Component dynamically
// imported from one (nor does it allow `ssr: false` there). `ssr: false` is the
// part that keeps the chunk out of the initial graph, since a server-rendered
// lazy component still has to download it to hydrate.
//
// The placeholder mirrors the chart's own layout (a one-line header above an
// `h-48` plot) so the swap to the real chart shifts nothing.
export const CoverageAreaChart = dynamic(
  () =>
    import("@/components/coverage/coverage-charts").then(
      (m) => m.CoverageAreaChart,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-2">
        <div className="h-4" />
        <div className="h-48 w-full" />
      </div>
    ),
  },
);
