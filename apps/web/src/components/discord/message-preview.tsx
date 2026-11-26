import type { ReactNode } from "react";

/**
 * A Discord message as the client draws it, dark theme, for the faded preview
 * behind a Discord offer: a sentence cannot show a reader what lands in the
 * channel, a message can. Always on Discord's own colours, whatever the site's
 * theme, since it is a picture of their client and not a part of ours.
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
    <div className="bg-[#313338] px-4 py-4 font-sans text-[15px] leading-snug text-[#dbdee1] sm:px-8">
      {invocation ? (
        <p className="mb-1 pl-14 text-xs text-[#949ba4]">{invocation}</p>
      ) : null}
      <div className="flex gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon.svg" alt="" className="size-10 shrink-0 rounded-full bg-[#1e1f22] p-1.5" />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="font-semibold text-[#f2f3f5]">unicum.gg</span>
            <span className="rounded-[3px] bg-[#5865f2] px-1 text-[10px] font-bold leading-[15px] text-white">
              APP
            </span>
            <span className="text-xs text-[#949ba4]">Today at 11:40</span>
          </div>
          <div
            className="mt-1 max-w-xl rounded border-l-4 bg-[#2b2d31] px-4 py-3"
            style={{ borderLeftColor: color }}
          >
            <p className="font-semibold text-[#00a8fc]">{title}</p>
            {description ? (
              <p className="mt-1 text-sm">{description}</p>
            ) : null}
            {blockTitle ? (
              <p className="mt-2 text-sm font-semibold text-[#f2f3f5]">{blockTitle}</p>
            ) : null}
            <pre className="mt-1 overflow-hidden rounded border border-[#1e1f22] bg-[#1e1f22] px-2 py-1.5 font-mono text-[13px] leading-snug whitespace-pre">
              {block.map((line, i) => (
                <span
                  key={i}
                  className={
                    line.sign === "+"
                      ? "block text-[#6ac46a]"
                      : line.sign === "-"
                        ? "block text-[#f26b6b]"
                        : "block"
                  }
                >
                  {line.sign ? `${line.sign} ` : ""}
                  {line.text}
                </span>
              ))}
            </pre>
            {footer ? <p className="mt-2 text-xs text-[#949ba4]">{footer}</p> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
