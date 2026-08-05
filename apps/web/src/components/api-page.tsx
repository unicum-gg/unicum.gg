"use client";

import { createOpenAPIPage } from "fumadocs-openapi/ui";
import {
  DefaultCollapsiblePanel,
  type CollapsiblePanelProps,
} from "fumadocs-openapi/playground/client";

// The client component that renders one endpoint's reference + fumadocs' own
// interactive playground (its native one, no Scalar dependency). Fed by
// `getOpenAPIPageProps()` on the server.
export const OpenAPIPage = createOpenAPIPage({
  playground: {
    components: {
      // Open the parameter panels (Path, Query, Headers, Body) on arrival.
      // fumadocs collapses them by default, which hides the very thing the
      // page is about: on `GET /{region}/maps/search` a reader landed on two
      // shut rows labelled "Path" and "Query" and had to click to discover
      // that `region` and `q` exist. Our endpoints take a handful of
      // parameters each, so there is nothing to fold away.
      CollapsiblePanel: (props: CollapsiblePanelProps) => (
        <DefaultCollapsiblePanel defaultOpen {...props} />
      ),
    },
  },
});
