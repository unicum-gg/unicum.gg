import { Interpolate } from "@/components/interpolate";
import { getTranslation } from "@/lib/translations.server";
import Link from "@/components/link";
import { buttonVariants } from "fumadocs-ui/components/ui/button";
import { styles } from "@/lib/styles";
import { type Region } from "@unicum.gg/wargaming";

// Distinct from the not-found page: the nickname resolves on Wargaming, but the
// account has been locked, so there are no stats to show. Shared by the server
// page (direct/crawler hit, from the endpoint's 403) and the client profile (a
// soft nav whose SWR fetch comes back 403 account_locked).
export async function AccountLockedView({
  nickname,
  region,
  locale,
}: {
  nickname: string;
  region: Region;
  locale: string;
}) {
  const { t } = await getTranslation(
    "components/players/detail/account-locked",
    locale,
  );
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col">
      <div
        className={`relative ${styles.borderX} screen-line-before flex flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center`}
      >
        <h1 className="font-heading text-3xl font-bold tracking-tight">
          {t("title")}
        </h1>
        <p className="max-w-md text-fd-muted-foreground">
          <Interpolate
            template={t("body", { region: region.toUpperCase() })}
            values={{
              nickname: (
                <span className="font-semibold text-fd-foreground">
                  {nickname}
                </span>
              ),
            }}
          />
        </p>
        <Link href="/" className={buttonVariants({ variant: "primary" })}>
          {t("back-to-home")}
        </Link>
      </div>
    </div>
  );
}
