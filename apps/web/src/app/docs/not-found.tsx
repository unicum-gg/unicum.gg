import Link from "next/link";
import { buttonVariants } from "fumadocs-ui/components/ui/button";
import { DocsBody, DocsPage, DocsTitle } from "fumadocs-ui/layouts/docs/page";
import ROUTES from "@/constants/routes";

// Docs 404: an unknown `/docs/*` path. Rendered inside the DocsLayout (so the
// endpoint sidebar stays), rather than falling back to the bare root not-found.
export default function DocsNotFound() {
  return (
    <DocsPage>
      <DocsTitle>Endpoint not found</DocsTitle>
      <DocsBody>
        <p className="text-fd-muted-foreground">
          This API reference page doesn&apos;t exist. Pick an endpoint from the
          sidebar, or head back to the overview.
        </p>
        <Link
          href={ROUTES.DOCS}
          className={buttonVariants({ variant: "primary" })}
        >
          Back to API docs
        </Link>
      </DocsBody>
    </DocsPage>
  );
}
