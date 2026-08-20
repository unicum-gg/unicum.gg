// Compile the glossary's markdown into the module the service reads.
//
// The entries are markdown with frontmatter because they are prose, and prose is
// written and reviewed as prose. They live at `content/glossary/<category>/
// <slug>.md`, outside `src` because they are content and not code: the folder is
// the category and the filename is the slug, so the frontmatter only carries
// what the path cannot say.
//
// They are compiled rather than read at runtime for the same reason the route
// registries are: Turbopack traces imports, not `fs` calls on paths it cannot
// resolve, so markdown read at runtime would not travel into the standalone
// output. Generated on predev/prebuild/postinstall, next to the other
// `*.generated.ts`.
//
//   pnpm --filter @unicum.gg/web exec tsx scripts/generate-glossary.ts
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { frontmatter } from "fumadocs-core/content/md/frontmatter";
import type { Nodes, RootContent } from "mdast";
// Deep, env-free subpaths rather than the barrel: this runs on postinstall,
// where the barrel's `env.ts` validation would throw for want of WG app ids.
// Same exception `services/openapi/enum-sources.ts` takes, for the same reason.
import {
  GlossaryCategory,
  isGlossaryCategory,
} from "@unicum.gg/shared/glossary/category";
import {
  GlossaryBlockKind,
  type GlossaryBlock,
  type GlossaryEntry,
} from "@unicum.gg/shared/glossary/entry";
import { GlossaryLinkTarget } from "@unicum.gg/shared/glossary/links";

const ENTRIES_DIR = new URL("../content/glossary/", import.meta.url).pathname;
const OUT = new URL(
  "../src/services/glossary/entries.generated.ts",
  import.meta.url,
).pathname;

type Frontmatter = Partial<
  Pick<GlossaryEntry, "term" | "aliases" | "related" | "links" | "anchors" | "autoLink">
>;

/** Split a document into its frontmatter and the prose after it, with the same
 * reader fumadocs uses for its own content. */
function split(source: string, file: string): { data: Frontmatter; body: string } {
  const { data, content } = frontmatter(source);
  if (!data || typeof data !== "object") throw new Error(`${file}: no frontmatter`);
  return { data: data as Frontmatter, body: content.trim() };
}

/**
 * Markdown to blocks, over a real mdast tree rather than a hand-rolled reader.
 *
 * The mapping is deliberately narrow: a paragraph, a list, and a fenced
 * `formula` block whose first line is the expression and whose remainder is the
 * note. Anything else, a heading, a table, a blockquote, is a document
 * structure this glossary does not have, and it throws rather than being
 * silently dropped from a published page.
 *
 * The prose stays plain text on purpose. It is what the cross-linking pass
 * reads, what the API serves as segments and what the Markdown twin re-emits,
 * so inline formatting would have to survive three renderings to be worth it.
 */
function inlineText(node: Nodes, file: string): string {
  if (node.type === "text" || node.type === "inlineCode") return node.value;
  if ("children" in node && node.children) {
    return node.children.map((child) => inlineText(child, file)).join("");
  }
  throw new Error(`${file}: unsupported inline markdown (${node.type})`);
}

function toBlock(node: RootContent, file: string): GlossaryBlock {
  switch (node.type) {
    case "paragraph":
      return { kind: GlossaryBlockKind.Paragraph, text: inlineText(node, file) };
    case "list":
      return {
        kind: GlossaryBlockKind.List,
        items: node.children.map((item) => inlineText(item, file)),
      };
    case "code": {
      if (node.lang !== "formula") {
        throw new Error(`${file}: unknown code fence "${node.lang ?? ""}"`);
      }
      const [expression, ...rest] = node.value.split("\n");
      const note = rest.join("\n").trim();
      return {
        kind: GlossaryBlockKind.Formula,
        expression: expression.trim(),
        ...(note ? { note } : {}),
      };
    }
    default:
      throw new Error(`${file}: unsupported block (${node.type})`);
  }
}

async function readEntries(): Promise<GlossaryEntry[]> {
  // `mdast-util-from-markdown` is ESM-only and this script transpiles to CJS,
  // so it is pulled in dynamically rather than at the top.
  const { fromMarkdown } = await import("mdast-util-from-markdown");
  const entries: GlossaryEntry[] = [];
  for (const category of readdirSync(ENTRIES_DIR, { withFileTypes: true })) {
    if (!category.isDirectory()) continue;
    if (!isGlossaryCategory(category.name)) {
      throw new Error(`entries/${category.name} is not a glossary category`);
    }
    const dir = join(ENTRIES_DIR, category.name);
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".md")).sort()) {
      const slug = file.slice(0, -3);
      const { data, body } = split(readFileSync(join(dir, file), "utf8"), `${category.name}/${file}`);
      if (!data.term) throw new Error(`${category.name}/${file}: missing "term"`);
      const tree = fromMarkdown(body);
      const blocks = tree.children.map((node) => toBlock(node, `${category.name}/${file}`));
      const [first, ...rest] = blocks;
      if (!first || first.kind !== GlossaryBlockKind.Paragraph) {
        throw new Error(`${category.name}/${file}: the first block must be the one-sentence definition`);
      }
      entries.push({
        slug,
        term: data.term,
        aliases: data.aliases ?? [],
        category: category.name,
        short: first.text,
        body: rest,
        related: data.related ?? [],
        ...(data.links ? { links: data.links } : {}),
        ...(data.anchors ? { anchors: data.anchors } : {}),
        ...(data.autoLink === false ? { autoLink: false } : {}),
      });
    }
  }
  return entries;
}

/** Emit enum members by name rather than by value, so the generated module is
 * typed the same way a hand-written one would be. */
function member<T extends Record<string, string>>(enumObject: T, value: string, name: string): string {
  const key = Object.entries(enumObject).find(([, v]) => v === value)?.[0];
  if (!key) throw new Error(`${value} is not a ${name}`);
  return `${name}.${key}`;
}

const str = (value: string): string => JSON.stringify(value);

function renderBlock(block: GlossaryBlock): string {
  switch (block.kind) {
    case GlossaryBlockKind.Paragraph:
      return `{ kind: GlossaryBlockKind.Paragraph, text: ${str(block.text)} }`;
    case GlossaryBlockKind.List:
      return `{ kind: GlossaryBlockKind.List, items: [${block.items.map(str).join(", ")}] }`;
    case GlossaryBlockKind.Formula:
      return `{ kind: GlossaryBlockKind.Formula, expression: ${str(block.expression)}${block.note ? `, note: ${str(block.note)}` : ""} }`;
  }
}

function renderEntry(entry: GlossaryEntry): string {
  const lines = [
    `    slug: ${str(entry.slug)},`,
    `    term: ${str(entry.term)},`,
    `    aliases: [${entry.aliases.map(str).join(", ")}],`,
    `    category: ${member(GlossaryCategory, entry.category, "GlossaryCategory")},`,
    `    short: ${str(entry.short)},`,
    `    body: [\n${entry.body.map((b) => `      ${renderBlock(b)},`).join("\n")}\n    ],`,
    `    related: [${entry.related.map(str).join(", ")}],`,
  ];
  if (entry.links?.length) {
    const links = entry.links.map((l) => {
      const parts = [`target: ${member(GlossaryLinkTarget, l.target, "GlossaryLinkTarget")}`];
      if (l.slug) parts.push(`slug: ${str(l.slug)}`);
      if (l.label) parts.push(`label: ${str(l.label)}`);
      return `{ ${parts.join(", ")} }`;
    });
    lines.push(`    links: [${links.join(", ")}],`);
  }
  if (entry.anchors) {
    const parts: string[] = [];
    if (entry.anchors.specKeys?.length) parts.push(`specKeys: [${entry.anchors.specKeys.map(str).join(", ")}]`);
    if (entry.anchors.labels?.length) parts.push(`labels: [${entry.anchors.labels.map(str).join(", ")}]`);
    lines.push(`    anchors: { ${parts.join(", ")} },`);
  }
  if (entry.autoLink === false) lines.push(`    autoLink: false,`);
  return `  {\n${lines.join("\n")}\n  },`;
}

async function main() {
  const entries = await readEntries();
  const file = `// AUTO-GENERATED by scripts/generate-glossary.ts — do not edit.
// The source is the markdown under \`content/glossary/<category>/<slug>.md\`.
import {
  GlossaryBlockKind,
  GlossaryCategory,
  GlossaryLinkTarget,
  type GlossaryEntry,
} from "@unicum.gg/shared";

export const GLOSSARY_ENTRIES: GlossaryEntry[] = [
${entries.map(renderEntry).join("\n")}
];
`;
  writeFileSync(OUT, file, "utf8");
  console.log(
    `[glossary] ${entries.length} markdown entries → src/services/glossary/entries.generated.ts`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
