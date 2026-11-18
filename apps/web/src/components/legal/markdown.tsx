import { Fragment, type ReactNode } from "react";
import type { Nodes, RootContent } from "mdast";
import { fromMarkdown } from "mdast-util-from-markdown";
import Link from "@/components/link";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
  PanelTitle,
} from "@/components/panel";
import { dropEmptyLines, fillLegal } from "./values";

// The glossary's link: dotted underline that warms to the brand on hover.
const LINK_CLASS =
  "text-fd-foreground underline decoration-fd-border decoration-dotted underline-offset-4 transition-colors hover:decoration-fd-primary";

/**
 * A legal document's markdown, one panel per `##` section, so it reads like
 * every other page of the site (titled panels between hatched separators)
 * rather than like a wall of prose.
 *
 * The documents use a deliberately small subset (headings, paragraphs, lists,
 * bold, italics, links, inline code, rules), so this walks the tree itself
 * rather than pulling in a markdown renderer for seven node types.
 *
 * `{token}`s are filled from `LEGAL_VALUES` before parsing, which is how a SIRET
 * or an address stays one constant instead of thirty-six copies a translator
 * could get wrong. A link whose target is a token (`[legal notice]({company-page})`)
 * works the same way.
 */
export function LegalSections({ source }: { source: string }) {
  const root = fromMarkdown(fillLegal(dropEmptyLines(source)));
  const sections: { title: RootContent[]; body: RootContent[] }[] = [];
  for (const node of root.children) {
    if (node.type === "heading" && node.depth <= 2) {
      sections.push({ title: node.children, body: [] });
    } else if (sections.length) {
      sections.at(-1)!.body.push(node);
    } else {
      sections.push({ title: [], body: [node] });
    }
  }

  return sections.map((section, index) => (
    <Fragment key={index}>
      <PanelSeparator />
      <Panel>
        {section.title.length ? (
          <PanelHeader>
            <PanelTitle>{section.title.map((n, i) => render(n, i))}</PanelTitle>
          </PanelHeader>
        ) : null}
        <PanelContent className="max-w-3xl space-y-4 px-4 pb-6">
          {section.body.map((n, i) => render(n, i))}
        </PanelContent>
      </Panel>
    </Fragment>
  ));
}

function render(node: Nodes, key?: number): ReactNode {
  const children = () =>
    "children" in node
      ? node.children.map((child, index) => render(child, index))
      : null;

  switch (node.type) {
    case "heading":
      return (
        <h3 key={key} className="pt-2 font-semibold">
          {children()}
        </h3>
      );
    case "paragraph":
      return (
        <p key={key} className="leading-7 text-fd-muted-foreground">
          {children()}
        </p>
      );
    case "list":
      return (
        <ul key={key} className="space-y-2 pl-1">
          {node.children.map((item, index) => (
            <li key={index} className="flex gap-2 leading-7 text-fd-muted-foreground">
              <span aria-hidden className="text-fd-primary">
                {node.ordered ? `${(node.start ?? 1) + index}.` : "•"}
              </span>
              <span>
                {/* A tight item wraps its text in a paragraph; unwrapping it
                    keeps the item one line rather than a spaced block. */}
                {item.children.map((child, i) =>
                  child.type === "paragraph"
                    ? child.children.map((inner, j) => render(inner, j))
                    : render(child, i),
                )}
              </span>
            </li>
          ))}
        </ul>
      );
    case "strong":
      return (
        <strong key={key} className="font-medium text-fd-foreground">
          {children()}
        </strong>
      );
    case "emphasis":
      return <em key={key}>{children()}</em>;
    case "inlineCode":
      return (
        <code key={key} className="font-mono text-sm text-fd-foreground">
          {node.value}
        </code>
      );
    case "link":
      // A page of ours goes through the localised link, so a French reader
      // stays on the French page it names.
      return node.url.startsWith("/") ? (
        <Link key={key} href={node.url} className={LINK_CLASS}>
          {children()}
        </Link>
      ) : (
        <a
          key={key}
          href={node.url}
          className={LINK_CLASS}
          {...(/^https?:/.test(node.url)
            ? { target: "_blank", rel: "noopener noreferrer" }
            : {})}
        >
          {children()}
        </a>
      );
    case "thematicBreak":
      return <hr key={key} className="border-fd-border" />;
    case "break":
      return <br key={key} />;
    case "text":
      return node.value;
    default:
      return null;
  }
}
