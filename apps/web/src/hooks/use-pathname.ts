"use client";

import { usePathname as useNextPathname } from "next/navigation";
import { splitLocale } from "@/lib/translations";

/**
 * The current path with its language prefix removed.
 *
 * Everything that reads the URL to work out *where* the reader is (which region,
 * which section, which tab) wants the path as the routes declare it, and the
 * language is not part of that: `/fr/na/players` is the same place as
 * `/na/players`. Next's own `usePathname` returns the address bar, where the
 * prefix is, so a first-segment check like `regionFromPathname` would read `fr`
 * as the region and every section would stop lighting up in the navbar.
 *
 * Use `usePathname` from `next/navigation` directly when the address itself is
 * the subject, which is the language menu and nothing else so far.
 */
export function usePathname(): string {
  return splitLocale(useNextPathname()).rest;
}
