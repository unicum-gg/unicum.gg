import Link from "next/link";
import {
  GlossaryBlockKind,
  type GlossaryRenderedBlock,
  type GlossarySegment,
} from "@unicum.gg/shared";
import ROUTES from "@/constants/routes";

/**
 * A definition's prose, with the terms it names already resolved to links by
 * the API. Rendering runs on the server, so a crawler reads the whole entry and
 * every cross-link in the HTML.
 */
function Segments({ segments }: { segments: GlossarySegment[] }) {
  return (
    <>
      {segments.map((segment, index) =>
        segment.slug ? (
          <Link
            key={index}
            href={ROUTES.GLOSSARY_TERM(segment.slug)}
            className="text-fd-foreground underline decoration-fd-border decoration-dotted underline-offset-4 transition-colors hover:decoration-fd-primary"
          >
            {segment.text}
          </Link>
        ) : (
          <span key={index}>{segment.text}</span>
        ),
      )}
    </>
  );
}

export function GlossaryBody({ body }: { body: GlossaryRenderedBlock[] }) {
  return (
    <div className="space-y-4">
      {body.map((block, index) => {
        switch (block.kind) {
          case GlossaryBlockKind.Paragraph:
            return (
              <p key={index} className="text-fd-muted-foreground leading-7">
                <Segments segments={block.segments} />
              </p>
            );
          case GlossaryBlockKind.List:
            return (
              <ul key={index} className="space-y-2 pl-1">
                {block.items.map((item, itemIndex) => (
                  <li
                    key={itemIndex}
                    className="flex gap-2 text-fd-muted-foreground leading-7"
                  >
                    <span aria-hidden className="text-fd-primary">
                      &bull;
                    </span>
                    <span>
                      <Segments segments={item} />
                    </span>
                  </li>
                ))}
              </ul>
            );
          case GlossaryBlockKind.Formula:
            return (
              <figure
                key={index}
                className="rounded-md border border-fd-border bg-fd-secondary/30 px-4 py-3"
              >
                {/* A long formula scrolls inside its own box rather than
                    wrapping mid-expression or widening the page. */}
                <code className="block overflow-x-auto text-sm text-fd-foreground whitespace-pre">
                  {block.expression}
                </code>
                {block.note ? (
                  <figcaption className="mt-2 text-sm text-fd-muted-foreground">
                    {block.note}
                  </figcaption>
                ) : null}
              </figure>
            );
        }
      })}
    </div>
  );
}
