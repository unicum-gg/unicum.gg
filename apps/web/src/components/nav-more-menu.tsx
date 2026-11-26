"use client";

import { type ReactNode, useSyncExternalStore } from "react";
import { CaretDownIcon } from "@phosphor-icons/react/dist/ssr";
import {
  NavbarMenu,
  NavbarMenuContent,
  NavbarMenuLink,
  NavbarMenuTrigger,
} from "fumadocs-ui/layouts/home/navbar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "fumadocs-ui/components/ui/collapsible";
import { NavigationMenuLink } from "fumadocs-ui/components/ui/navigation-menu";
import Link from "@/components/link";

/**
 * Which section is unfolded in the burger panel, at most one.
 *
 * A module-level store rather than state: the menus are five separate entries
 * in the nav's `links` array, so they share no parent of ours to hold it,
 * fumadocs renders each where it likes. Opening them independently let all five
 * stand open at once, which is thirty links and a panel running well past the
 * bottom of a phone.
 */
let openSection: string | null = null;
const listeners = new Set<() => void>();

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

function setOpenSection(id: string | null): void {
  openSection = id;
  listeners.forEach((notify) => notify());
}

export type MoreMenuItem = {
  text: string;
  description: string;
  url: string;
  icon: ReactNode;
};

/** The width of the row the `i`th card falls in. */
function rowOf(rows: readonly (4 | 5)[], i: number): 4 | 5 {
  let seen = 0;
  for (const size of rows) {
    seen += size;
    if (i < seen) return size;
  }
  return rows[rows.length - 1] ?? 4;
}

/**
 * A nav dropdown: an icon + title + description card per destination, matching
 * what fumadocs renders for a `menu` link. Shared by the "More" menu and, via
 * `NavSectionMenu`, by every section, so they look and behave identically.
 *
 * Not force-mounted. It once was, to keep the links in the served HTML for
 * crawlers, but a force-mounted Radix content loses its `data-state` the moment
 * any menu opens, so several of them stop hiding and stack on screen. The
 * crawlability that bought is now covered by the footer, which links every one
 * of these destinations, so the panel can mount on open the plain Radix way and
 * only the hovered menu ever shows.
 *
 * It renders twice, and that is the only way a phone gets these links at all.
 * A dropdown here is a Radix `NavigationMenu` item, and fumadocs draws every
 * open menu into ONE viewport shared with the burger panel: below `sm` the
 * sections are rendered inside that panel, so opening one asked the viewport to
 * show the section instead of the panel it was already showing. It measured the
 * new content at zero height, the whole menu collapsed, and nothing was
 * reachable. So the dropdown is the desktop half and a collapsible list is the
 * phone's, each hidden where the other belongs.
 */
export function NavMoreMenu({
  id,
  text,
  items,
  rows,
  active = false,
}: {
  /** Stable key for the one-open-at-a-time rule on a phone. */
  id: string;
  text: string;
  items: MoreMenuItem[];
  /**
   * How many cards each row holds, when the rows are not all one width: the
   * More menu is a family of four over a family of five, each row filling the
   * width. Only 4 and 5 are laid out (a 20-column grid, a card spanning 5 or
   * 4 of them); omitted, the menu is full rows of four or three as before.
   */
  rows?: readonly (4 | 5)[];
  /** Highlights the trigger for the section the reader is on, like the plain
   * section link did. Always false for the "More" menu, which is no section. */
  active?: boolean;
}) {
  return (
    <>
      <NavbarMenu className="max-sm:hidden">
        <NavbarMenuTrigger
          data-active={active}
          className="data-[active=true]:text-fd-primary"
        >
          {text}
        </NavbarMenuTrigger>
        {/* Full rows in every menu: eight cards are two rows of four (Tanks,
            Maps), three are one row of three (Players, Clans), and More is a
            row of four over a row of five. The fumadocs default of three
            columns left eight as 3 + 3 + 2. */}
        <NavbarMenuContent
          className={rows ? "lg:grid-cols-20" : items.length >= 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"}
        >
          {items.map((item, i) => (
            <NavbarMenuLink
              key={item.url}
              href={item.url}
              aria-label={item.text}
              className={rows ? (rowOf(rows, i) === 5 ? "lg:col-span-4" : "lg:col-span-5") : undefined}
            >
              <div className="w-fit rounded-md border bg-fd-muted p-1 [&_svg]:size-4">
                {item.icon}
              </div>
              <p className="text-base font-medium">{item.text}</p>
              <p className="text-sm text-fd-muted-foreground empty:hidden">
                {item.description}
              </p>
            </NavbarMenuLink>
          ))}
        </NavbarMenuContent>
      </NavbarMenu>
      <MobileSection id={id} text={text} items={items} active={active} />
    </>
  );
}

/**
 * The same destinations on a phone: a row that unfolds in place, inside the
 * burger panel rather than over it.
 *
 * Closed by default and one at a time, since the five sections hold thirty
 * links between them and a panel that opens on all of them is a page of its
 * own. The descriptions are dropped for the same reason: they are what makes
 * the desktop card readable at a glance and what would make this a wall of
 * text.
 */
function MobileSection({
  id,
  text,
  items,
  active,
}: {
  id: string;
  text: string;
  items: MoreMenuItem[];
  active: boolean;
}) {
  // `false` on the server and on the first client render, so nothing unfolds
  // under hydration.
  const open = useSyncExternalStore(
    subscribe,
    () => openSection === id,
    () => false,
  );

  return (
    <Collapsible
      open={open}
      onOpenChange={(next) => setOpenSection(next ? id : null)}
      className="sm:hidden"
    >
      <CollapsibleTrigger
        data-active={active}
        className="group flex w-full cursor-pointer items-center justify-between gap-2 py-1.5 text-fd-muted-foreground transition-colors hover:text-fd-accent-foreground data-[active=true]:font-medium data-[active=true]:text-fd-primary"
      >
        {text}
        <CaretDownIcon className="size-4 transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ms-1 flex flex-col border-s border-fd-border ps-3">
          {items.map((item) => (
            // Radix's own link, so picking one closes the burger panel behind
            // it. A plain anchor navigates and leaves the menu standing open
            // over the page it just went to.
            <NavigationMenuLink key={item.url} asChild>
              <Link
                href={item.url}
                className="inline-flex items-center gap-2 py-1.5 text-fd-muted-foreground transition-colors hover:text-fd-accent-foreground [&_svg]:size-4"
              >
                {item.icon}
                {item.text}
              </Link>
            </NavigationMenuLink>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
