"use client";

import dynamic from "next/dynamic";

// The lazy boundary for the Marks charts. recharts is the heaviest dependency
// in the client bundle (107 KB gzipped, 372 KB parsed), and the tank page draws
// these two charts on the Marks tab only, so a static import made every other
// tab download it for nothing.
//
// The boundary has to be its own Client Component: the consumer
// (`mastery/index.tsx`) is a Server Component, and Next does not code-split a
// Client Component dynamically imported from one (nor does it allow
// `ssr: false` there). `ssr: false` is the part that keeps the chunk out of the
// initial graph, since a server-rendered lazy component still has to download
// it to hydrate. The placeholder reserves the chart's exact height so swapping
// the real one in shifts nothing.
export const MarksHistoryChart = dynamic(
  () =>
    import("@/components/tanks/detail/marks/mastery/history-chart").then(
      (m) => m.MarksHistoryChart,
    ),
  { ssr: false, loading: () => <div className="h-56 w-full" /> },
);
