import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import Link from "@/components/link";
import { styles } from "@/lib/styles";
import { cn } from "@/lib/utils";

/**
 * The "see all" link on the right of a panel's header, styled like the top
 * players' own, for a panel that shows the first few of a list living on
 * another page. In the header rather than under the cards, so it reads before
 * the reader has scrolled past what it leads to. No hooks, so a server or a
 * client panel can both render it with the words it already holds.
 */
export function PanelHeaderLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className={cn(
        styles.linkHover,
        "inline-flex shrink-0 items-center gap-1 text-xs font-medium uppercase tracking-wide text-fd-muted-foreground",
      )}
    >
      {children}
      <ArrowRight className="size-3.5" />
    </Link>
  );
}
