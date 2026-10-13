/**
 * Packing an announcement into the messages Discord will actually accept.
 *
 * Shared by the two things that announce: the site's weekly digest, whose
 * entries the model writes, and the mod's release notes, which arrive already
 * written. Both face the same limit and the same wrong answer to it, which is
 * why this is one module. Trimming to fit was the first answer, and on a batch
 * that regularly exceeds the limit it stops being a safety net and becomes the
 * normal outcome, always dropping the same end: the last group rendered. So
 * every line is kept and the message is split, which still reads as one update
 * because only the first part carries the header and only the last the footer.
 */

/** Discord rejects a message over 2000 characters. */
const MAX_LENGTH = 2000;

/** What these lines will measure once joined by newlines. */
export function joinLength(lines: string[]): number {
  const chars = lines.reduce((total, line) => total + line.length, 0);
  return chars + Math.max(lines.length - 1, 0);
}

/**
 * The messages to post, in order, for a body of `lines` wrapped in a header and
 * a footer.
 *
 * The room left for entries is measured against the tightest part, the first,
 * which carries the header, minus the footer, whose room is reserved in every
 * part since a part only learns it is the last one once the packing is done.
 */
export function packMessages(
  lines: string[],
  header: string[],
  footer: string[],
): string[] {
  const budget = MAX_LENGTH - joinLength(header) - joinLength(footer) - 2;

  /** A single line longer than a whole message has never happened, but a model
   * answering with a paragraph, or a release note written as one, would
   * otherwise build a part Discord rejects, which is the failure this module
   * exists to prevent. */
  const clamp = (line: string): string =>
    line.length <= budget ? line : `${line.slice(0, budget - 1).trimEnd()}…`;

  const parts: string[][] = [];
  let body: string[] = [];

  const flush = (): void => {
    // A part can end on the blank line that separated two groups.
    while (body.at(-1) === "") body.pop();
    if (body.length > 0) parts.push(body);
    body = [];
  };

  for (const line of lines.map(clamp)) {
    const head = parts.length === 0 ? header : [];
    if (body.length > 0 && joinLength([...head, ...body, line]) > budget) {
      flush();
      // A part must not open on a group's blank separator.
      if (line === "") continue;
    }
    body.push(line);
  }
  flush();

  return parts.map((part, i) =>
    [
      ...(i === 0 ? header : []),
      ...part,
      ...(i === parts.length - 1 ? footer : []),
    ].join("\n"),
  );
}
