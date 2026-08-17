import type { ReactNode } from "react";
import {
  NavbarMenu,
  NavbarMenuContent,
  NavbarMenuLink,
  NavbarMenuTrigger,
} from "fumadocs-ui/layouts/home/navbar";

export type MoreMenuItem = {
  text: string;
  description: string;
  url: string;
  icon: ReactNode;
};

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
 */
export function NavMoreMenu({
  text,
  items,
  active = false,
}: {
  text: string;
  items: MoreMenuItem[];
  /** Highlights the trigger for the section the reader is on, like the plain
   * section link did. Always false for the "More" menu, which is no section. */
  active?: boolean;
}) {
  return (
    <NavbarMenu>
      <NavbarMenuTrigger
        data-active={active}
        className="data-[active=true]:text-fd-primary"
      >
        {text}
      </NavbarMenuTrigger>
      <NavbarMenuContent>
        {items.map((item) => (
          <NavbarMenuLink key={item.url} href={item.url} aria-label={item.text}>
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
  );
}
