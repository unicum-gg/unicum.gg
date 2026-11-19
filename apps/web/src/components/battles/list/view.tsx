import { REGION_EMOJI, REGION_LABEL, type Region } from "@unicum.gg/wargaming";
import { BattleMode, LATEST_BATTLE_VERSION } from "@unicum.gg/shared";
import { Interpolate } from "@/components/interpolate";
import Link from "@/components/link";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
  PanelTitle,
} from "@/components/panel";
import ROUTES from "@/constants/routes";
import { getTranslation } from "@/lib/translations.server";
import { buildSafe, unicum } from "@/services/sdk";
import { UploadReplayButton } from "@/components/players/detail/battles/upload-replay";
import {
  BattlesCatalog,
  type BattlesCatalogPayload,
} from "./catalog";

/**
 * The battles section: every battle whose replay was archived, shared by
 * players running the mod or uploaded as a file here.
 *
 * Shaped like the site's other catalogue pages (the listing hero, then the
 * list), and it names replays as much as battles, since that is the word a
 * player searching for one types.
 */
export async function BattlesView({
  region,
  locale,
}: {
  region: Region;
  locale: string;
}) {
  const { t } = await getTranslation("app/battles/page", locale);
  const initial = await buildSafe(
    () =>
      unicum
        .region(region)
        // What the page opens on, which the client keeps as its defaults:
        // random battles of the newest update, by damage.
        .battles.list({
          facets: "true",
          language: locale,
          mode: BattleMode.Random,
          version: LATEST_BATTLE_VERSION,
        })
        .then((r) => r as unknown as BattlesCatalogPayload),
    null,
  );

  return (
    <div className="mx-auto w-full max-w-7xl">
      {/* The site's listing hero, the one /maps, /tanks and /tournaments open
          with, so this section reads as a sibling rather than a design of its
          own. */}
      <Panel>
        <PanelContent className="px-4 py-12 text-center">
          <div className="mb-2 text-sm tracking-wide text-fd-muted-foreground uppercase">
            {REGION_EMOJI[region]} {REGION_LABEL[region]}
          </div>
          <h1 className="font-heading text-4xl font-bold tracking-tight md:text-5xl">
            <Interpolate
              template={t("title")}
              values={{
                battles: <span className="text-brand">{t("title-battles")}</span>,
              }}
            />
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-fd-muted-foreground">
            {t("intro")}
          </p>
          <div className="mt-6 flex flex-col items-center gap-2">
            <UploadReplayButton prominent />
            {/* The other way in, for whoever would rather not upload by hand:
                the mod sends every battle as it ends. Said under the button,
                as the mod page says where else the mod can be had. */}
            <p className="text-xs text-fd-muted-foreground">
              <Interpolate
                template={t("upload-mod")}
                values={{
                  mod: (
                    <Link
                      href={ROUTES.MOD}
                      className="underline underline-offset-2 hover:text-fd-foreground"
                    >
                      {t("upload-mod-link")}
                    </Link>
                  ),
                }}
              />
            </p>
          </div>
        </PanelContent>
      </Panel>

      <PanelSeparator />

      <BattlesCatalog region={region} initial={initial} />

      <PanelSeparator />

      {/* What a reader looking for replays needs to know, in prose: where they
          come from, what a battle page holds, and how to add one's own. */}
      <Panel>
        <PanelHeader>
          <PanelTitle>{t("about-title")}</PanelTitle>
        </PanelHeader>
        <PanelContent className="flex max-w-3xl flex-col gap-3 text-sm text-fd-muted-foreground">
          <p>{t("about-sources")}</p>
          <p>{t("about-page")}</p>
          <p>
            <Interpolate
              template={t("about-share")}
              values={{
                mod: (
                  <Link href={ROUTES.MOD} className="text-brand hover:underline">
                    {t("about-share-mod")}
                  </Link>
                ),
              }}
            />
          </p>
        </PanelContent>
      </Panel>
    </div>
  );
}
