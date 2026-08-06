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
 * The nav's "More" dropdown, built by hand instead of through fumadocs'
 * `type: "menu"` link, for one reason: `forceMount`.
 *
 * A Radix navigation menu mounts its content when it opens, so with the stock
 * link these items existed only after a click. They were absent from the server
 * HTML entirely, which means no crawler ever saw a link to the bot, the MCP
 * server, the API or the support page from any page of the site: four
 * destinations with no internal links pointing at them. `forceMount` keeps the
 * panel in the DOM and lets Radix hide it with `data-state`, so the links are
 * crawlable while the menu still behaves exactly as before.
 *
 * The markup mirrors what fumadocs renders for a `menu` item (icon banner,
 * title, description), so nothing changes on screen.
 */
export function NavMoreMenu({
  text,
  items,
}: {
  text: string;
  items: MoreMenuItem[];
}) {
  return (
    <NavbarMenu>
      <NavbarMenuTrigger>{text}</NavbarMenuTrigger>
      {/* `forceMount` alone leaves the panel on screen, since Radix normally
          hides it by unmounting. It still marks the state, so hide it while
          closed. `hidden` keeps the links in the served HTML, which is the
          whole point: a crawler reads the source, it does not open menus. */}
      <NavbarMenuContent forceMount className="data-[state=closed]:hidden">
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
