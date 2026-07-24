import Link from "next/link";
import { notFound } from "next/navigation";
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from "fumadocs-ui/layouts/docs/page";
import { OpenAPIPage } from "@/components/api-page";
import { openapi } from "@/lib/openapi";
import { source } from "@/lib/docs-source";

// One prerendered page per OpenAPI endpoint, plus the `/docs` overview index.
export function generateStaticParams() {
  return [{ slug: [] as string[] }, ...source.generateParams()];
}

export default async function Page({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug } = await params;
  const page = source.getPage(slug);
  if (page) {
    const data = page.data;
    return (
      <DocsPage full toc={data.toc}>
        <DocsTitle>{data.title}</DocsTitle>
        <DocsDescription>{data.description}</DocsDescription>
        <DocsBody>
          <OpenAPIPage {...data.getOpenAPIPageProps()} />
        </DocsBody>
      </DocsPage>
    );
  }
  if (slug && slug.length > 0) notFound();

  // `/docs` index: an overview built from the spec's `info`, since the OpenAPI
  // source only generates per-endpoint pages (all listed in the sidebar).
  const schemas = await openapi.getSchemas();
  const info = Object.values(schemas)[0]?.bundled.info;
  return (
    <DocsPage>
      <DocsTitle>{info?.title ?? "API reference"}</DocsTitle>
      <DocsDescription>{info?.description}</DocsDescription>
      <DocsBody>
        <p>
          Pick an endpoint from the sidebar to see its parameters, responses and
          an interactive playground. This is the same public read API the site
          and the SDK use, served across EU, NA and Asia.
        </p>
        <p>
          The raw OpenAPI schema is at{" "}
          <Link href="/api/openapi.json">/api/openapi.json</Link>.
        </p>
      </DocsBody>
    </DocsPage>
  );
}
