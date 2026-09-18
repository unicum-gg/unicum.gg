"use client";

import { PuzzlePieceIcon } from "@phosphor-icons/react/dist/ssr";
import { regionFromPathname } from "@unicum.gg/wargaming";
import Link from "@/components/link";
import ROUTES from "@/constants/routes";
import { usePathname } from "@/hooks/use-pathname";
import { useTranslation } from "@/hooks/use-translation";

/**
 * The game mod's place in the navbar, beside the catalogue sections.
 *
 * It lived in the "More" menu, among the integrations and the pages about the
 * project, where the one thing a reader can actually install stayed invisible
 * until they opened a dropdown. Here it is a plain link, not a dropdown: the
 * page has no sub-pages, and a trigger that opens nothing is a small betrayal.
 *
 * The brand colour and the icon are the whole point: every other item of that
 * row is grey text, so this one reads as something on offer rather than one
 * more section, and it costs the row ~90px, which the gap before the search box
 * holds down to a 1280px window.
 */
export function NavMod() {
  const pathname = usePathname();
  const { t } = useTranslation("components/nav-mod");

  // Active on /mod, region prefix aside, the way the section menus decide.
  const segments = pathname.split("/").filter(Boolean);
  const index = regionFromPathname(pathname) === null ? 0 : 1;
  const active = segments[index] === "mod";

  return (
    <Link
      href={ROUTES.MOD}
      data-active={active}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-md p-2 text-sm font-medium text-brand transition-opacity hover:opacity-80 data-[active=true]:opacity-80 [&_svg]:size-4"
    >
      <PuzzlePieceIcon weight="fill" />
      {t("label")}
    </Link>
  );
}
