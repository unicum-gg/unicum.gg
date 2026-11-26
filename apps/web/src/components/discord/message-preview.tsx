import type { ReactNode } from "react";

/**
 * A Discord message as the client draws it, dark theme, for the faded preview
 * behind a Discord offer: a sentence cannot show a reader what lands in the
 * channel, a message can. Drawn in the site's own tokens rather than Discord's
 * greys, so it reads as part of the page and follows its light and dark theme;
 * only the shape and the embed's side colour are Discord's.
 */
export function DiscordMessagePreview({
  invocation,
  color,
  title,
  description,
  blockTitle,
  block,
  footer,
}: {
  /** "Koala used /player", above the reply, for a slash command. */
  invocation?: ReactNode;
  /** The embed's side colour. */
  color: string;
  title: ReactNode;
  description?: ReactNode;
  /** A field name above the block, as a vehicle heads its changes. */
  blockTitle?: ReactNode;
  /** A `diff` or table code block, already laid out line by line. */
  block: { sign?: "+" | "-" | " "; text: string }[];
  footer?: ReactNode;
}) {
  return (
    <div className="px-4 py-4 text-[15px] leading-snug text-fd-foreground sm:px-8">
      {invocation ? (
        <p className="mb-1 pl-14 text-xs text-fd-muted-foreground">{invocation}</p>
      ) : null}
      <div className="flex gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon.svg" alt="" className="size-10 shrink-0 rounded-full bg-fd-muted p-1.5" />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="font-semibold">unicum.gg</span>
            <span className="rounded-[3px] bg-[#5865f2] px-1 text-[10px] font-bold leading-[15px] text-white">
              APP
            </span>
            <span className="text-xs text-fd-muted-foreground">Today at 11:40</span>
          </div>
          <div
            className="mt-1 max-w-xl rounded border border-l-4 border-fd-border bg-fd-muted/50 px-4 py-3"
            style={{ borderLeftColor: color }}
          >
            <p className="font-semibold text-fd-primary">{title}</p>
            {description ? (
              <p className="mt-1 text-sm">{description}</p>
            ) : null}
            {blockTitle ? (
              <p className="mt-2 text-sm font-semibold">{blockTitle}</p>
            ) : null}
            <pre className="mt-1 overflow-hidden rounded border border-fd-border bg-fd-background px-2 py-1.5 font-mono text-[13px] leading-snug whitespace-pre">
              {block.map((line, i) => (
                <span
                  key={i}
                  className={
                    line.sign === "+"
                      ? "block text-green-600 dark:text-green-400"
                      : line.sign === "-"
                        ? "block text-red-600 dark:text-red-400"
                        : "block"
                  }
                >
                  {line.sign ? `${line.sign} ` : ""}
                  {line.text}
                </span>
              ))}
            </pre>
            {footer ? <p className="mt-2 text-xs text-fd-muted-foreground">{footer}</p> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
