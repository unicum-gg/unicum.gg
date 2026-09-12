import { NotFoundView } from "@/components/not-found-view";
import { SiteChrome } from "@/components/site-chrome";

// Root not-found: the global boundary for URLs that match no route at all (and
// any `notFound()` without a closer boundary, e.g. outside the `(site)` group).
// The root layout is chrome-less (so `/docs` can be standalone), so this wraps
// the 404 in `SiteChrome` itself to keep the nav + footer.
export default function NotFound() {
  return (
    <SiteChrome>
      <NotFoundView />
    </SiteChrome>
  );
}
