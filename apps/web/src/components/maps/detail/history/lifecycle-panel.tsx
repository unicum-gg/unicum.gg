import { dateFormat } from "@/lib/format";
import { getTranslation } from "@/lib/translations.server";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelTitle,
} from "@/components/panel";
import { MAP_HISTORY_TRACKING_START, type MapDetail } from "@unicum.gg/shared";
import { LifecyclePicture } from "./lifecycle-picture";

const DATE_PATTERN = "d MMM yyyy";

async function LifecycleRow({
  label,
  version,
  at,
  before = false,
  locale,
}: {
  label: string;
  version: string;
  at: string | Date | null;
  before?: boolean;
  locale: string;
}) {
  const { t } = await getTranslation(
    "components/maps/detail/history/index",
    locale,
  );
  const date = (pattern: string) => dateFormat(locale, pattern);
  return (
    <li className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm">
      <span className="text-fd-muted-foreground">{label}</span>
      <span className="font-medium">
        {t(before ? "before-update" : "update", { version })}
        {at ? (
          <span className="ml-2 text-xs font-normal text-fd-muted-foreground">
            {date(DATE_PATTERN).format(new Date(at))}
          </span>
        ) : null}
      </span>
    </li>
  );
}

/**
 * When the map entered the game and, if it has gone, when it left; beside it,
 * the map as it was when it arrived, so "added in 0.7.0" can be looked at
 * rather than only read.
 */
export async function MapLifecyclePanel({
  detail,
  addedVersion,
  addedAt,
  removedVersion,
  removedAt,
  present,
  arrivalImage,
  locale,
}: {
  detail: MapDetail;
  addedVersion: string | null;
  addedAt: string | Date | null;
  removedVersion: string | null;
  removedAt: string | Date | null;
  present: boolean;
  /** The minimap the map arrived with, and the version it is from. Null when
   * that image is not known. */
  arrivalImage: { src: string; label: string } | null;
  locale: string;
}) {
  const { t } = await getTranslation(
    "components/maps/detail/history/index",
    locale,
  );
  return (
    <Panel>
      <PanelHeader>
        <PanelTitle as="h3" className="text-base">{t("in-the-game")}</PanelTitle>
      </PanelHeader>
      <PanelContent className="p-0">
        <div className={arrivalImage ? "grid sm:grid-cols-[minmax(0,1fr)_16rem]" : undefined}>
          <ul className="divide-y divide-fd-border">
            {addedVersion ? (
              <LifecycleRow
                label={t("added")}
                version={addedVersion}
                at={addedAt}
                locale={locale}
              />
            ) : (
              // Already in the client when tracking started: the real date is
              // unknown, so all we can say is that it came before.
              <LifecycleRow
                label={t("added")}
                version={MAP_HISTORY_TRACKING_START.version}
                at={null}
                before
                locale={locale}
              />
            )}
            {!present && removedVersion ? (
              <LifecycleRow
                label={t("removed")}
                version={removedVersion}
                at={removedAt}
                locale={locale}
              />
            ) : null}
          </ul>
          {arrivalImage ? (
            <div className="border-t border-fd-border sm:border-t-0 sm:border-l">
              <LifecyclePicture
                then={arrivalImage.src}
                latest={detail.minimapUrl}
                label={t("update", { version: arrivalImage.label })}
                title={detail.name}
                subtitle={t("added")}
              />
            </div>
          ) : null}
        </div>
      </PanelContent>
    </Panel>
  );
}
