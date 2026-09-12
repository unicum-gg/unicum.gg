import { NotFoundView } from "@/components/not-found-view";

// Catches `notFound()` thrown by a site segment without a closer not-found file
// (tanks, regions, …). Renders inside the `(site)` chrome (top bar + nav +
// footer).
export default function NotFound() {
  return <NotFoundView />;
}
