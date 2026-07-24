"use client";

import { createOpenAPIPage } from "fumadocs-openapi/ui";

// The client component that renders one endpoint's reference + fumadocs' own
// interactive playground (its native one, no Scalar dependency). Fed by
// `getOpenAPIPageProps()` on the server.
export const OpenAPIPage = createOpenAPIPage();
