"use client";

import { ArrowSquareOutIcon } from "@phosphor-icons/react";
import { usePathname } from "next/navigation";
import {
  AnthropicIcon,
  OpenAiIcon,
  PerplexityIcon,
} from "@/components/brand-icons";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import APP from "@/constants/app";

/**
 * Dropdown-menu items to hand the current page to an LLM: every page has a
 * Markdown twin (`<path>.md`, rendered by `/api/md`), so we deep-link
 * ChatGPT/Claude/Perplexity with a prompt pointing at that `.md` URL for the
 * model to read. Returns bare `<DropdownMenuItem>`s so a parent menu places them
 * inline.
 */
export function PageAiActions() {
  const pathname = usePathname();
  const mdUrl = `${APP.URL}${pathname}.md`;
  const q = `Read this World of Tanks stats page and help me analyze it: ${mdUrl}`;

  const targets = [
    {
      label: "Open in ChatGPT",
      icon: <OpenAiIcon />,
      href: `https://chatgpt.com/?${new URLSearchParams({ hints: "search", q })}`,
    },
    {
      label: "Open in Claude",
      icon: <AnthropicIcon />,
      href: `https://claude.ai/new?${new URLSearchParams({ q })}`,
    },
    {
      label: "Open in Perplexity",
      icon: <PerplexityIcon />,
      href: `https://www.perplexity.ai/search?${new URLSearchParams({ q })}`,
    },
  ];

  return (
    <>
      {targets.map((t) => (
        <DropdownMenuItem key={t.href} asChild>
          <a href={t.href} target="_blank" rel="noreferrer">
            {t.icon}
            {t.label}
            <ArrowSquareOutIcon className="ml-auto size-3 text-fd-muted-foreground" />
          </a>
        </DropdownMenuItem>
      ))}
    </>
  );
}
