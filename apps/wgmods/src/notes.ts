// A release's Markdown notes, as the plain text the hub shows.
//
// The hub renders a change log as bare text, so a `### Added` heading and its
// dashes reach the reader as typed. Its own form also stops a change log at
// 1000 characters, so a long release keeps what fits and says what it left out.
const MAX_LENGTH = 1000;

type Section = { heading: string; items: string[] };

function parse(markdown: string): { intro: string[]; sections: Section[] } {
  const intro: string[] = [];
  const sections: Section[] = [];
  let item: string[] | undefined;
  const flush = () => {
    if (item) sections.at(-1)?.items.push(item.join(" "));
    item = undefined;
  };
  for (const raw of markdown.replace(/<!--[\s\S]*?-->/g, "").split("\n")) {
    const line = raw.trim();
    if (/^##\s/.test(line)) continue;
    const heading = /^###\s+(.+)$/.exec(line);
    if (heading) {
      flush();
      sections.push({ heading: heading[1], items: [] });
    } else if (line.startsWith("- ")) {
      flush();
      item = [line.slice(2)];
    } else if (!line) {
      flush();
    } else if (item) {
      item.push(line);
    } else if (!sections.length) {
      intro.push(line);
    }
  }
  flush();
  return { intro, sections };
}

const sentence = (text: string) => (/[.!?]$/.test(text) ? text : `${text}.`);

export function plainNotes(markdown: string): string {
  const { intro, sections } = parse(markdown);
  const render = (kept: Section[], left: number) =>
    [intro.join(" "), ...kept.filter((section) => section.items.length).map((section) => `${section.heading}: ${section.items.map(sentence).join(" ")}`), left ? `And ${left} smaller ${left === 1 ? "change" : "changes"}.` : ""]
      .filter(Boolean)
      .join("\n\n");

  const total = sections.reduce((sum, section) => sum + section.items.length, 0);
  const kept = sections.map((section) => ({ heading: section.heading, items: [] as string[] }));
  let count = 0;
  sections.forEach((section, index) => {
    for (const text of section.items) {
      kept[index].items.push(text);
      // Measured with the closing line it would need if this were the last.
      if (render(kept, total - count - 1).length > MAX_LENGTH) kept[index].items.pop();
      else count += 1;
    }
  });
  return render(kept, total - count);
}
