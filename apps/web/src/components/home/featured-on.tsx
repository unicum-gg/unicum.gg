import Image from "next/image";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelTitle,
} from "@/components/panel";

type Mention = {
  name: string;
  /** Where they mention us, keyed by our locale when they wrote it in several. */
  href: string;
  hrefByLocale?: Partial<Record<string, string>>;
  /**
   * Greyscale and light on transparent, so one file serves both themes (inverted on light).
   * Absent when theirs cannot be drawn in one colour, and the name stands alone.
   */
  logo?: { src: string; width: number; height: number };
  /** A wordmark already spells the name, a square mark does not. */
  wordmark: boolean;
};

const MENTIONS: Mention[] = [
  {
    name: "The Armored Patrol",
    href: "https://thearmoredpatrol.com/2026/10/26/unicum-gg-a-new-wot-stats-website/",
    logo: {
      src: "/press/the-armored-patrol-white.png",
      width: 768,
      height: 68,
    },
    wordmark: true,
  },
  {
    name: "Battle-Conquest",
    href: "https://battle-conquest.eu/forum/t/site-updates-unicum-mod-beta-is-here-2",
    hrefByLocale: {
      fr: "https://battle-conquest.eu/forum/t/mises-a-jour-du-site-arrivee-du-mod-unicum-en-beta-1",
    },
    logo: { src: "/press/battle-conquest-white.png", width: 80, height: 82 },
    wordmark: false,
  },
  {
    name: "wotportal.cz",
    href: "https://wotportal.cz/",
    wordmark: false,
  },
];

/**
 * The community sites that mention us, each linking to where they do.
 *
 * Plain followed links rendered on the server, like `ListedOn`: they linked to
 * us first, and a link back is the thanks.
 */
export function FeaturedOn({
  title,
  locale,
}: {
  title: string;
  locale: string;
}) {
  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>{title}</PanelTitle>
      </PanelHeader>

      <PanelContent className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6 py-8">
        {MENTIONS.map((mention) => (
          <a
            key={mention.name}
            href={mention.hrefByLocale?.[locale] ?? mention.href}
            target="_blank"
            rel="noopener"
            className="flex items-center gap-3 opacity-80 transition-opacity hover:opacity-100"
          >
            {mention.logo ? (
              <Image
                src={mention.logo.src}
                alt={mention.name}
                width={mention.logo.width}
                height={mention.logo.height}
                className={`${mention.wordmark ? "h-7" : "h-9"} w-auto invert dark:invert-0`}
              />
            ) : null}
            {mention.wordmark ? null : (
              <span
                className={`${mention.logo ? "text-xl" : "text-[2rem] leading-none"} font-extrabold uppercase tracking-tight text-fd-foreground`}
              >
                {mention.name}
              </span>
            )}
          </a>
        ))}
      </PanelContent>
    </Panel>
  );
}
