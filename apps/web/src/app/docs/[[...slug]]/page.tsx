import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, Cards } from "fumadocs-ui/components/card";
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from "fumadocs-ui/layouts/docs/page";
import { OpenAPIPage } from "@/components/api-page";
import { JsonLd } from "@/components/json-ld";
import { openapi } from "@/lib/openapi";
import { getDocsSections, source } from "@/lib/docs-source";
import { constructMetadata } from "@/lib/metadata";
import { breadcrumbSchema } from "@/lib/schema-org";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";

// One prerendered page per OpenAPI endpoint, plus the `/docs` overview and each
// `/docs/{tag}` section landing.
export async function generateStaticParams() {
  const sections = await getDocsSections();
  return [
    { slug: [] as string[] },
    ...sections.map((section) => ({ slug: [section.slug] })),
    ...source.generateParams(),
  ];
}

/**
 * Per-page metadata. Without it every endpoint page inherits the layout's title,
 * so the ~60 of them shipped as identical "API Docs" entries to search engines
 * and to anything reading the page's own `<title>`. The three shapes below
 * mirror the three the component renders.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = source.getPage(slug);
  if (page) {
    const data = page.data as { title?: string; description?: string };
    return constructMetadata({
      title: `${data.title ?? page.url} | API`,
      description: data.description ?? APP.DESCRIPTION,
      ogTitle: data.title,
      ogSubtitle: "API reference",
      canonical: page.url,
    });
  }

  const sections = await getDocsSections();
  const section = slug?.length === 1 && sections.find((s) => s.slug === slug[0]);
  if (section) {
    return constructMetadata({
      title: `${section.name} API`,
      description:
        section.description ??
        `Every ${section.name.toLowerCase()} endpoint of the ${APP.NAME} public API, with its parameters and response shape.`,
      ogTitle: section.name,
      ogSubtitle: "API reference",
      canonical: `${ROUTES.DOCS}/${section.slug}`,
    });
  }

  return constructMetadata({
    title: "API reference",
    description: `Interactive reference for the ${APP.NAME} public API: player, clan and tank search, leaderboards and live updates across EU, NA and Asia.`,
    ogTitle: "API reference",
    canonical: ROUTES.DOCS,
  });
}

type Crumb = { name: string; href: string };

// Visible breadcrumb (the endpoint pages use DocsPage's own tree-aware one; this
// renders the trail for the custom overview + section pages, which aren't tree
// nodes). The matching schema.org BreadcrumbList is emitted separately.
function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="mb-4 flex flex-wrap items-center gap-1.5 text-sm text-fd-muted-foreground"
    >
      {items.map((item, i) => (
        <span key={item.href} className="flex items-center gap-1.5">
          {i > 0 ? <span aria-hidden>/</span> : null}
          {i < items.length - 1 ? (
            <Link href={item.href} className="hover:text-fd-foreground">
              {item.name}
            </Link>
          ) : (
            <span className="text-fd-foreground">{item.name}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

const crumbSchema = (items: Crumb[]) =>
  breadcrumbSchema(
    items.map((item) => ({ name: item.name, url: `${APP.URL}${item.href}` })),
  );

export default async function Page({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug } = await params;
  const sections = await getDocsSections();
  const page = source.getPage(slug);

  // An individual endpoint page.
  if (page) {
    const data = page.data;
    const title = data.title ?? page.url;
    const section = sections.find((s) => s.slug === slug?.[0]);
    const crumbs: Crumb[] = [
      { name: "API docs", href: ROUTES.DOCS },
      ...(section
        ? [{ name: section.name, href: `${ROUTES.DOCS}/${section.slug}` }]
        : []),
      { name: title, href: page.url },
    ];
    return (
      <>
        <JsonLd data={crumbSchema(crumbs)} />
        <DocsPage
          full
          toc={data.toc}
          breadcrumb={{ includeRoot: { url: ROUTES.DOCS }, includePage: true }}
        >
          <DocsTitle>{title}</DocsTitle>
          {/* OpenAPIPage renders the operation description itself (with code
              spans), so we don't add a DocsDescription — that would double it. */}
          <DocsBody>
            <OpenAPIPage {...data.getOpenAPIPageProps()} />
          </DocsBody>
        </DocsPage>
      </>
    );
  }

  // A `/docs/{tag}` section landing: a card per endpoint in the section.
  if (slug && slug.length === 1) {
    const section = sections.find((s) => s.slug === slug[0]);
    if (!section) notFound();
    const crumbs: Crumb[] = [
      { name: "API docs", href: ROUTES.DOCS },
      { name: section.name, href: `${ROUTES.DOCS}/${section.slug}` },
    ];
    return (
      <>
        <JsonLd data={crumbSchema(crumbs)} />
        <DocsPage>
          <Breadcrumbs items={crumbs} />
          <DocsTitle>{section.name}</DocsTitle>
          {section.description ? (
            <DocsDescription>{section.description}</DocsDescription>
          ) : null}
          <DocsBody>
            <Cards>
              {section.pages.map((p) => (
                <Card
                  key={p.url}
                  title={p.title}
                  description={p.description}
                  href={p.url}
                />
              ))}
            </Cards>
          </DocsBody>
        </DocsPage>
      </>
    );
  }
  if (slug && slug.length > 0) notFound();

  // The `/docs` overview: a card per section.
  const schemas = await openapi.getSchemas();
  const info = Object.values(schemas)[0]?.bundled.info;
  return (
    <DocsPage>
      <DocsTitle>{info?.title ?? "API reference"}</DocsTitle>
      <DocsDescription>{info?.description}</DocsDescription>
      <DocsBody>
        <p>
          The same public read API the site and the SDK use, served across EU, NA
          and Asia. Pick a section, or grab the raw{" "}
          <Link href="/api/openapi.json">OpenAPI schema</Link>.
        </p>
        <Cards>
          {sections.map((section) => (
            <Card
              key={section.slug}
              title={section.name}
              description={
                section.description ??
                `${section.pages.length} endpoint${section.pages.length === 1 ? "" : "s"}`
              }
              href={`${ROUTES.DOCS}/${section.slug}`}
            />
          ))}
        </Cards>
      </DocsBody>
    </DocsPage>
  );
}
