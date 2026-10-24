import { PuzzlePieceIcon } from "@phosphor-icons/react/dist/ssr";
import { buttonVariants } from "fumadocs-ui/components/ui/button";
import Link from "@/components/link";
import { Panel, PanelContent } from "@/components/panel";
import ROUTES from "@/constants/routes";
import { getTranslation } from "@/lib/translations.server";

/**
 * A vehicle with no recorded battle to count.
 *
 * The common case today, and it is not a failure: there is no Wargaming
 * endpoint this could have fallen back to, so an empty tab here means exactly
 * what it says, nobody running the mod has played this tank in a Random battle
 * lately. Which makes this the one state where explaining the mod is useful
 * rather than promotional: a reader who opened this tab wanted to know what
 * people fit to this vehicle, and they are one install away from being the
 * reason the answer exists.
 */
export async function LoadoutsEmpty({
  tankName,
  locale,
}: {
  tankName: string;
  locale: string;
}) {
  const { t } = await getTranslation(
    "components/tanks/detail/loadouts/empty",
    locale,
  );

  return (
    <Panel>
      <PanelContent className="flex flex-col items-center gap-3 py-10 text-center">
        <PuzzlePieceIcon className="size-8 text-fd-muted-foreground" weight="duotone" />
        <p className="text-sm font-medium">{t("nothing-yet", { tank: tankName })}</p>
        <p className="max-w-md text-sm text-fd-muted-foreground">
          {t("why-empty")}
        </p>
        <Link href={ROUTES.MOD} className={buttonVariants({ color: "secondary" })}>
          {t("get-the-mod")}
        </Link>
      </PanelContent>
    </Panel>
  );
}
