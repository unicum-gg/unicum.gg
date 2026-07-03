import type { SWRConfiguration } from "swr";

// Default SWR fetcher. Every client hook keys on an API URL, so a plain
// fetch plus JSON parse covers them all and pages can call `useSWR(url)`
// without passing a fetcher. A non-2xx response throws so SWR surfaces it
// as an error instead of caching a bad body.
export async function fetcher(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Request failed (${res.status}) for ${url}`);
  }
  return res.json();
}

// Global SWR defaults, spread into the app-wide <SWRConfig> provider.
// `revalidateOnFocus` is off because freshness is already pushed by the
// LiveSync SSE channel: refetching on window focus would add server load
// for data we already keep live.
export const swrConfig: SWRConfiguration = {
  fetcher,
  revalidateOnFocus: false,
};
