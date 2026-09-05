"use client";

import { useMemo } from "react";
import useSWR from "swr";
import { moneyFormatter, type MoneyFormatter } from "@unicum.gg/shared";
import { unicum } from "@/services/sdk";
import { useRegion } from "./use-region";

/**
 * Formatter for the site's own money figures (funding, infrastructure cost).
 * Those are all held in euros, and shown in the visitor's regional currency at
 * the live rate — never at a rate stored alongside the amount, which is what
 * used to make them wrong.
 *
 * Client-side because /support and /coverage are prerendered: the region comes
 * from the cookie, so the currency can only be known once we are in the browser.
 * Rates move daily and the endpoint is CDN-cached, so one shared SWR key serves
 * every money component on the page.
 */
export function useMoney(): MoneyFormatter {
  const { region } = useRegion();
  const { data } = useSWR("exchange-rates", () => unicum.rates(), {
    revalidateOnFocus: false,
    revalidateIfStale: false,
    dedupingInterval: 3_600_000,
  });
  return useMemo(() => moneyFormatter(region, data), [region, data]);
}
