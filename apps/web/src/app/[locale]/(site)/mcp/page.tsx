import type { Metadata } from "next";
import type { SoftwareApplication, WithContext } from "schema-dts";
import {
  ChartBarIcon,
  FileCodeIcon,
  MagnifyingGlassIcon,
  PlugsConnectedIcon,
} from "@phosphor-icons/react/dist/ssr";
import Link from "@/components/link";
import { buttonVariants } from "fumadocs-ui/components/ui/button";
import { JsonLd } from "@/components/json-ld";
import { CopySnippet } from "@/components/copy-snippet";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
  PanelTitle,
} from "@/components/panel";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { TOOL_DEFS } from "@/services/mcp/tools";
import { constructMetadata } from "@/lib/metadata";
import { Interpolate } from "@/components/interpolate";
import { getTranslation } from "@/lib/translations.server";
import { breadcrumbSchema } from "@/lib/schema-org";
import { styles } from "@/lib/styles";
import { cn } from "@/lib/utils";


const MCP_ENDPOINT = `${APP.URL}/api/mcp`;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;

  const { t } = await getTranslation("app/mcp/page", locale);
  return constructMetadata({
    locale,
    title: t("title"),
    description: t("description", { name: APP.NAME }),
    ogTitle: t("og-title"),
    ogSubtitle: t("stats-for-your-ai-assistant"),
    canonical: ROUTES.MCP,
  });
}

function softwareSchema(description: string): WithContext<SoftwareApplication> {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: `${APP.NAME} MCP server`,
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Any",
    url: `${APP.URL}${ROUTES.MCP}`,
    description,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    author: { "@type": "Organization", name: APP.NAME, url: APP.URL },
  };
}

// Deep links straight to each product's "add custom connector" dialog (neither
// supports URL-prefill parameters yet, so the endpoint is pasted by hand).
const CLAUDE_ADD_CONNECTOR_URL =
  "https://claude.ai/new?modal=add-custom-connector#settings/customize-connectors";
const CHATGPT_ADD_CONNECTOR_URL =
  "https://chatgpt.com/plugins#settings/Connectors?create-connector=true&redirectAfter=%2Fplugins";

type Setup = {
  title: string;
  text: string;
  steps?: string[];
  link?: { href: string; label: string };
  snippets: { label: string; text: string }[];
};

const SETUPS: Setup[] = [
  {
    title: "claude",
    text: "available-on-claude-ai-and-the-claude-apps-f",
    link: { href: CLAUDE_ADD_CONNECTOR_URL, label: "add-to-claude" },
    steps: [
      "use-the-button-below-or-settings-connectors-",
      "name-it-and-paste-the-server-url",
      "click-add-the-tools-are-available-in-every-n",
    ],
    snippets: [
      { label: "name", text: APP.NAME },
      { label: "remote-mcp-server-url", text: MCP_ENDPOINT },
    ],
  },
  {
    title: "chatgpt",
    text: "custom-connectors-need-a-paid-plan",
    link: { href: CHATGPT_ADD_CONNECTOR_URL, label: "add-to-chatgpt" },
    steps: [
      "use-the-button-below-or-settings-connectors-",
      "name-it-and-paste-the-server-url",
      "acknowledge-the-warning-and-click-create",
    ],
    snippets: [
      { label: "name", text: APP.NAME },
      { label: "server-url", text: MCP_ENDPOINT },
    ],
  },
  {
    title: "claude-code-cursor-and-other-clients",
    text: "one-command-in-claude-code-or-the-usual-mcps",
    snippets: [
      {
        label: "claude-code",
        text: `claude mcp add --transport http unicum ${MCP_ENDPOINT}`,
      },
      {
        label: "mcpservers-entry",
        text: `{
  "mcpServers": {
    "unicum": {
      "url": "${MCP_ENDPOINT}"
    }
  }
}`,
      },
    ],
  },
];

const FEATURES = [
  {
    Icon: ChartBarIcon,
    title: "the-same-data-as-the-site",
    text: "every-tool-answers-from-the-live-unicum-gg-a",
  },
  {
    Icon: MagnifyingGlassIcon,
    title: "discoverable",
    text: "the-server-publishes-a-standard-mcp-server-c",
  },
  {
    Icon: FileCodeIcon,
    title: "generated-from-the-api",
    text: "tools-are-derived-from-the-public-openapi-sp",
  },
];

function toolParams(def: (typeof TOOL_DEFS)[number]): string {
  const req = new Set(def.inputSchema.required ?? []);
  return Object.keys(def.inputSchema.properties)
    .map((name) => (req.has(name) ? `${name}*` : name))
    .join(", ");
}

export default async function McpPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const { t } = await getTranslation("app/mcp/page", locale);

  return (
    <div className="mx-auto w-full max-w-7xl">
      <JsonLd data={softwareSchema(t("description", { name: APP.NAME }))} />
      <JsonLd
        data={breadcrumbSchema([
          { name: APP.NAME, url: APP.URL },
          { name: "MCP server", url: `${APP.URL}${ROUTES.MCP}` },
        ])}
      />

      {/* Hero — same treatment as the bot landing: eyebrow, big heading with
          orange keyword spans, muted subline. */}
      <Panel>
        <PanelContent className="px-4 py-12 text-center sm:py-16">
          <div className="mb-2 inline-flex items-center gap-1.5 text-sm uppercase tracking-wide text-fd-muted-foreground">
            <PlugsConnectedIcon weight="fill" className="size-4 text-fd-primary" />
            {t("mcp-server")}
          </div>
          <h1 className="mx-auto max-w-4xl font-heading text-4xl font-bold tracking-tight text-balance md:text-5xl">
            <Interpolate
              template={t("hero")}
              values={{
                assistant: (
                  <span className="text-fd-primary">{t("ai-assistant")}</span>
                ),
              }}
            />
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-fd-muted-foreground">
            {t("connect-claude-cursor-or-any", { NAME: APP.NAME })}</p>
          <div className="mt-6 inline-block max-w-full text-left">
            <CopySnippet text={MCP_ENDPOINT} />
          </div>
        </PanelContent>
      </Panel>

      <PanelSeparator />

      {/* Setup */}
      <Panel>
        <PanelHeader>
          <PanelTitle>{t("get-connected")}</PanelTitle>
        </PanelHeader>
        <PanelContent className="grid gap-px p-0 md:grid-cols-3">
          {SETUPS.map(({ title, text, steps, link, snippets }) => (
            <section key={title} className="flex flex-col gap-3 p-6">
              <div>
                <h3 className="font-semibold">{t(title)}</h3>
                <p className={styles.mutedDescription}>{t(text)}</p>
              </div>
              {steps ? (
                <ol className="list-decimal space-y-1 pl-4 text-sm text-fd-muted-foreground">
                  {steps.map((step) => (
                    <li key={step}>{t(step, { NAME: APP.NAME })}</li>
                  ))}
                </ol>
              ) : null}
              <div className="mt-auto space-y-2">
                {snippets.map(({ label, text: snippet }) => (
                  <div key={label} className="space-y-1">
                    <div className="text-xs text-fd-muted-foreground">
                      {t(label)}
                    </div>
                    <CopySnippet text={snippet} />
                  </div>
                ))}
                {link ? (
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      buttonVariants({ variant: "primary" }),
                      "h-9 w-full gap-2 px-4",
                    )}
                  >
                    <PlugsConnectedIcon weight="bold" className="size-4" />
                    {t(link.label)}
                  </a>
                ) : null}
              </div>
            </section>
          ))}
        </PanelContent>
      </Panel>

      <PanelSeparator />

      {/* Tools — derived from the OpenAPI spec, the exact list the server
          registers. Required parameters are marked with an asterisk. */}
      <Panel>
        <PanelHeader>
          <PanelTitle>{t("tools")}</PanelTitle>
        </PanelHeader>
        <PanelContent className="p-0">
          <Table className="my-0!">
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4!">{t("tool")}</TableHead>
                <TableHead>{t("parameters")}</TableHead>
                <TableHead className="pr-4!">{t("description-column")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {TOOL_DEFS.map((def) => (
                <TableRow key={def.name}>
                  <TableCell className="pl-4! align-top font-mono text-xs whitespace-nowrap">
                    {def.name}
                  </TableCell>
                  <TableCell className="align-top font-mono text-xs text-fd-muted-foreground">
                    {toolParams(def) || "—"}
                  </TableCell>
                  <TableCell className="pr-4! align-top text-sm text-fd-muted-foreground">
                    {def.description}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </PanelContent>
      </Panel>

      <PanelSeparator />

      {/* Why */}
      <Panel>
        <PanelContent className="grid gap-px p-0 sm:grid-cols-3">
          {FEATURES.map(({ Icon, title, text }) => (
            <div key={title} className="flex flex-col gap-2 p-6">
              <Icon weight="duotone" className="size-6 text-fd-primary" />
              <h3 className="font-semibold">{t(title)}</h3>
              <p className={styles.mutedDescription}>{t(text)}</p>
            </div>
          ))}
        </PanelContent>
      </Panel>

      <PanelSeparator />

      {/* Pointers */}
      <Panel>
        <PanelContent className="px-4 py-6 text-center text-sm text-fd-muted-foreground">
          <Interpolate
            template={t("prefer-raw-http")}
            values={{
              docs: (
                <Link
                  href={ROUTES.DOCS}
                  className="text-fd-foreground underline-offset-2 hover:underline"
                >
                  {t("public-api")}
                </Link>
              ),
              card: (
                <a
                  href="/.well-known/mcp/server-card.json"
                  className="font-mono text-xs text-fd-foreground underline-offset-2 hover:underline"
                >
                  /.well-known/mcp/server-card.json
                </a>
              ),
            }}
          />
        </PanelContent>
      </Panel>
    </div>
  );
}
