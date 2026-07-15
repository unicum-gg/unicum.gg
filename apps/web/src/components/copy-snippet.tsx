"use client";

import { CheckIcon, CopyIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * A one-shot code snippet with a copy button, for install instructions
 * (MCP configs, CLI one-liners). Multi-line snippets keep their formatting.
 */
export function CopySnippet({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable (permissions, http): leave the text selectable.
    }
  }

  return (
    <div
      className={cn(
        "relative rounded-md border border-fd-border bg-fd-secondary/50",
        className,
      )}
    >
      <pre className="overflow-x-auto p-3 pr-12 font-mono text-xs leading-relaxed">
        {text}
      </pre>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? "Copied" : "Copy to clipboard"}
        className="absolute top-2 right-2 rounded-md border border-fd-border bg-fd-background p-1.5 text-fd-muted-foreground transition-colors hover:text-fd-foreground"
      >
        {copied ? (
          <CheckIcon className="size-3.5 text-green-500" weight="bold" />
        ) : (
          <CopyIcon className="size-3.5" weight="bold" />
        )}
      </button>
    </div>
  );
}
