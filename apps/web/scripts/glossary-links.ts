// Every link the automatic cross-linker makes on a short surface, with the
// sentence around it.
//
// The pass matches an entry's term and its aliases anywhere in the prose, which
// is what gives the glossary its internal linking for free and what occasionally
// links an ordinary word to a game term: "the hard cap is 445 metres" pointing
// at Base capture, "running gear" pointing at Equipment. Those only show up in
// context, so this prints the context. Anything here that reads wrong is an
// alias to drop, not a matcher to tune.
//
//   pnpm --filter @unicum.gg/web exec tsx scripts/glossary-links.ts
//   pnpm --filter @unicum.gg/web exec tsx scripts/glossary-links.ts 6
import { GlossaryBlockKind } from "@unicum.gg/shared";
import { listGlossary, renderGlossaryTerm } from "../src/services/glossary";

/** Longer surfaces are phrases, and a phrase is rarely a coincidence. */
const MAX_LENGTH = Number(process.argv[2]) || 4;

const hits: { surface: string; slug: string; where: string; context: string }[] = [];
for (const { slug } of listGlossary()) {
  const term = renderGlossaryTerm(slug);
  if (!term) continue;
  for (const block of term.body) {
    const runs =
      block.kind === GlossaryBlockKind.Paragraph
        ? [block.segments]
        : block.kind === GlossaryBlockKind.List
          ? block.items
          : [];
    for (const segments of runs) {
      segments.forEach((seg, i) => {
        if (!seg.slug || seg.text.length > MAX_LENGTH) return;
        const before = segments[i - 1]?.text.slice(-40) ?? "";
        const after = segments[i + 1]?.text.slice(0, 40) ?? "";
        hits.push({ surface: seg.text, slug: seg.slug, where: slug, context: `${before}[${seg.text}]${after}` });
      });
    }
  }
}
const bySurface = new Map<string, typeof hits>();
for (const h of hits) bySurface.set(h.surface.toLowerCase(), [...(bySurface.get(h.surface.toLowerCase()) ?? []), h]);
console.log(`${hits.length} links on surfaces of <= ${MAX_LENGTH} chars\n`);
for (const [surface, list] of [...bySurface].sort((a, z) => z[1].length - a[1].length)) {
  console.log(`  ${surface} -> ${list[0].slug}  (${list.length}x)`);
  for (const h of list.slice(0, 2)) console.log(`      ${h.where}: ...${h.context.replace(/\n/g, " ")}...`);
}
