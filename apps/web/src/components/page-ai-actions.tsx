"use client";

import { ArrowSquareOutIcon } from "@phosphor-icons/react";
import { usePathname } from "@/hooks/use-pathname";
import {
  AnthropicIcon,
  OpenAiIcon,
  SciraIcon,
} from "@/components/brand-icons";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useTranslation } from "@/hooks/use-translation";
import APP from "@/constants/app";

/**
 * Dropdown-menu items to hand the current page to an LLM: every page has a
 * Markdown twin (`<path>.md`, rendered by `/api/md`), so we deep-link
 * ChatGPT/Claude/Scira with a prompt pointing at that `.md` URL for the model to
 * read. Returns bare `<DropdownMenuItem>`s so a parent menu places them inline.
 *
 * Perplexity was dropped: it disabled reading a URL a user hands it, and it is
 * absent from Cloudflare's verified-bot directory, so our page challenge catches
 * it. It answered from its own index instead of ever requesting the page.
 */
export function PageAiActions() {
  const { t } = useTranslation("components/actions-menu");
  const pathname = usePathname();
  const mdUrl = `${APP.URL}${pathname}.md`;
  const q = `Read this World of Tanks stats page and help me analyze it: ${mdUrl}`;

  const targets = [
    {
      name: "ChatGPT",
      icon: <OpenAiIcon />,
      href: `https://chatgpt.com/?${new URLSearchParams({ hints: "search", prompt: q })}`,
    },
    {
      name: "Claude",
      icon: <AnthropicIcon />,
      href: `https://claude.ai/new?${new URLSearchParams({ q })}`,
    },
    {
      name: "Scira AI",
      icon: <SciraIcon />,
      href: `https://scira.ai/?${new URLSearchParams({ q })}`,
    },
  ];

  return (
    <>
      {targets.map((target) => (
        <DropdownMenuItem key={target.href} asChild>
          <a href={target.href} target="_blank" rel="nofollow noopener noreferrer">
            {target.icon}
            {/* One sentence with the product as a hole, not three labels: the
                three differ only by a name that is never translated. */}
            {t("open-in", { target: target.name })}
            <ArrowSquareOutIcon className="ml-auto size-3 text-fd-muted-foreground" />
          </a>
        </DropdownMenuItem>
      ))}
    </>
  );
}
