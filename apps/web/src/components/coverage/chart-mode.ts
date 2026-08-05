// Whether a coverage chart plots the raw per-day counts or their running total.
//
// It lives apart from `coverage-charts` so the (server) view can pick a default
// mode without statically importing the chart module, which would drag recharts
// back into the page's initial bundle and defeat the lazy boundary in
// `coverage-charts-lazy`.
export enum ChartMode {
  Daily = "daily",
  Cumulative = "cumulative",
}
