import { HoverPrefetchLink as Link } from "@/components/hover-prefetch-link";
import { buttonVariants } from "fumadocs-ui/components/ui/button";
import { styles } from "@/lib/styles";
import { type Region } from "@unicum.gg/wargaming";

// Distinct from the not-found page: the nickname resolves on Wargaming, but the
// account has been locked, so there are no stats to show. Shared by the server
// page (direct/crawler hit, from the endpoint's 403) and the client profile (a
// soft nav whose SWR fetch comes back 403 account_locked).
export function AccountLockedView({
  nickname,
  region,
}: {
  nickname: string;
  region: Region;
}) {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col">
      <div
        className={`relative ${styles.borderX} screen-line-before flex flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center`}
      >
        <h1 className="font-heading text-3xl font-bold tracking-tight">
          Account locked
        </h1>
        <p className="max-w-md text-fd-muted-foreground">
          <span className="font-semibold text-fd-foreground">{nickname}</span>{" "}
          exists on {region.toUpperCase()}, but Wargaming has locked this
          account, so its stats are not available.
        </p>
        <Link href="/" className={buttonVariants({ variant: "primary" })}>
          Back to home
        </Link>
      </div>
    </div>
  );
}
