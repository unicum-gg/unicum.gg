import { HomePage } from "@/components/home/home-page";


// ISR: served as prerendered HTML and revalidated in the background, so
// navigation stays instant while the data follows the endpoints' cadence.
// The SDK calls fail-soft to an empty shell at build time (a build must not
// depend on a running API); the first revalidation after deploy fills it in.
export const dynamic = "force-static";
export const revalidate = 60;

export default async function Page() {
  return <HomePage />;
}

