import type { Metadata } from "next";
import type { SoftwareApplication, WithContext } from "schema-dts";
import {
  ChartBarIcon,
  FileCodeIcon,
  MagnifyingGlassIcon,
  PlugsConnectedIcon,
} from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
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
import { breadcrumbSchema } from "@/lib/schema-org";
import { styles } from "@/lib/styles";
import { cn } from "@/lib/utils";

const TITLE = `World of Tanks MCP server`;
const DESCRIPTION = `Connect Claude, Cursor or any MCP-compatible AI assistant to ${APP.NAME} and query live World of Tanks stats: players, clans, tanks, leaderboards, WN8 and WNX across EU, NA and Asia.`;

const MCP_ENDPOINT = `${APP.URL}/api/mcp`;

export async function generateMetadata(): Promise<Metadata> {
  return constructMetadata({
    title: TITLE,
    description: DESCRIPTION,
    ogTitle: "MCP server",
    ogSubtitle: "Stats for your AI assistant",
    canonical: ROUTES.MCP,
  });
}

function softwareSchema(): WithContext<SoftwareApplication> {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: `${APP.NAME} MCP server`,
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Any",
    url: `${APP.URL}${ROUTES.MCP}`,
    description: DESCRIPTION,
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
    title: "Claude",
    text: "Available on claude.ai and the Claude apps, free plan included.",
    link: { href: CLAUDE_ADD_CONNECTOR_URL, label: "Add to Claude" },
    steps: [
      "Use the button below (or Settings, Connectors, Add custom connector)",
      `Name it ${APP.NAME} and paste the server URL`,
      "Click Add, the tools are available in every new chat",
    ],
    snippets: [
      { label: "Name", text: APP.NAME },
      { label: "Remote MCP server URL", text: MCP_ENDPOINT },
    ],
  },
  {
    title: "ChatGPT",
    text: "Custom connectors need a paid plan.",
    link: { href: CHATGPT_ADD_CONNECTOR_URL, label: "Add to ChatGPT" },
    steps: [
      "Use the button below (or Settings, Connectors, Create)",
      `Name it ${APP.NAME} and paste the server URL`,
      "Acknowledge the warning and click Create",
    ],
    snippets: [
      { label: "Name", text: APP.NAME },
      { label: "Server URL", text: MCP_ENDPOINT },
    ],
  },
  {
    title: "Claude Code, Cursor and other clients",
    text: "One command in Claude Code, or the usual mcpServers entry anywhere else.",
    snippets: [
      {
        label: "Claude Code",
        text: `claude mcp add --transport http unicum ${MCP_ENDPOINT}`,
      },
      {
        label: "mcpServers entry",
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
    title: "The same data as the site",
    text: "Every tool answers from the live unicum.gg API, so WN7, WN8 and WNX match what the pages show, for any player, clan or tank.",
  },
  {
    Icon: MagnifyingGlassIcon,
    title: "Discoverable",
    text: "The server publishes a standard MCP server card and an agent skill, so agents can find and learn the tools on their own.",
  },
  {
    Icon: FileCodeIcon,
    title: "Generated from the API",
    text: "Tools are derived from the public OpenAPI spec at build time. New endpoints become new tools automatically, nothing drifts.",
  },
];

function toolParams(def: (typeof TOOL_DEFS)[number]): string {
  const req = new Set(def.inputSchema.required ?? []);
  return Object.keys(def.inputSchema.properties)
    .map((name) => (req.has(name) ? `${name}*` : name))
    .join(", ");
}

export default function McpPage() {
  return (
    <div className="mx-auto w-full max-w-7xl">
      <JsonLd data={softwareSchema()} />
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
            MCP server
          </div>
          <h1 className="mx-auto max-w-4xl font-heading text-4xl font-bold tracking-tight text-balance md:text-5xl">
            World of Tanks stats for your{" "}
            <span className="text-fd-primary">AI assistant</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-fd-muted-foreground">
            Connect Claude, Cursor or any MCP-compatible client to {APP.NAME}{" "}
            and ask about players, clans, tanks and leaderboards in plain
            language. Free, no API key required.
          </p>
          <div className="mx-auto mt-6 max-w-xl text-left">
            <CopySnippet text={MCP_ENDPOINT} />
          </div>
        </PanelContent>
      </Panel>

      <PanelSeparator />

      {/* Setup */}
      <Panel>
        <PanelHeader>
          <PanelTitle>Get connected</PanelTitle>
        </PanelHeader>
        <PanelContent className="grid gap-px p-0 md:grid-cols-3">
          {SETUPS.map(({ title, text, steps, link, snippets }) => (
            <section key={title} className="flex flex-col gap-3 p-6">
              <div>
                <h3 className="font-semibold">{title}</h3>
                <p className={styles.mutedDescription}>{text}</p>
              </div>
              {steps ? (
                <ol className="list-decimal space-y-1 pl-4 text-sm text-fd-muted-foreground">
                  {steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              ) : null}
              <div className="mt-auto space-y-2">
                {snippets.map(({ label, text: snippet }) => (
                  <div key={label} className="space-y-1">
                    <div className="text-xs text-fd-muted-foreground">
                      {label}
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
                    {link.label}
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
          <PanelTitle>Tools</PanelTitle>
        </PanelHeader>
        <PanelContent className="p-0">
          <Table className="my-0!">
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4!">Tool</TableHead>
                <TableHead>Parameters</TableHead>
                <TableHead className="pr-4!">Description</TableHead>
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
              <h3 className="font-semibold">{title}</h3>
              <p className={styles.mutedDescription}>{text}</p>
            </div>
          ))}
        </PanelContent>
      </Panel>

      <PanelSeparator />

      {/* Pointers */}
      <Panel>
        <PanelContent className="px-4 py-6 text-center text-sm text-fd-muted-foreground">
          Prefer raw HTTP? The same data is on the{" "}
          <Link href={ROUTES.DOCS} className="text-fd-foreground underline-offset-2 hover:underline">
            public API
          </Link>
          . Agents can also discover this server via{" "}
          <a
            href="/.well-known/mcp/server-card.json"
            className="font-mono text-xs text-fd-foreground underline-offset-2 hover:underline"
          >
            /.well-known/mcp/server-card.json
          </a>
          .
        </PanelContent>
      </Panel>
    </div>
  );
}
