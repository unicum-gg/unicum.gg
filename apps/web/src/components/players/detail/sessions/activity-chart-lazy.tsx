"use client";

import dynamic from "next/dynamic";

// The lazy boundary for the activity histogram, like the profile's rating chart
// and the tank page's marks charts. recharts is the heaviest dependency in the
// client bundle (107 KB gzipped), and the Sessions tab is the only place on the
// profile that draws this one, so a static import would make every other view
// download it for nothing. `ssr: false` keeps the chunk out of the initial
// graph; the placeholder reserves the chart's exact height so swapping the real
// one in shifts nothing.
export const PlayerActivityChart = dynamic(
  () =>
    import("@/components/players/detail/sessions/activity-chart").then(
      (m) => m.PlayerActivityChart,
    ),
  { ssr: false, loading: () => <div className="h-48 w-full" /> },
);
