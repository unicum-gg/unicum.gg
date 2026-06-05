import Link from "next/link";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { styles } from "@/lib/styles";
import { Region } from "@/services/wargaming/wot";
import { FooterCoverageLink } from "./footer-coverage-link";

export function Footer() {
  return (
    <div className="mx-auto w-full max-w-7xl">
      <div
        className={`relative flex h-8 w-full ${styles.borderX} diagonal-pattern`}
      />
      <footer className="screen-line-before border-x border-fd-border">
        <div className="space-y-3 p-4 text-center">
          <div className="text-sm text-fd-muted-foreground">
            Built for the World of Tanks community
          </div>
          <div className="flex justify-center gap-4 text-sm">
            <Link
              href={ROUTES.PLAYER(Region.EU, "_Winnie")}
              className={styles.linkHover}
            >
              Player example
            </Link>
            <Link
              href={ROUTES.CLAN(Region.EU, "KAIZN")}
              className={styles.linkHover}
            >
              Clan example
            </Link>
            <FooterCoverageLink />
            <Link
              href={APP.EXTERNAL.GITHUB}
              className={styles.linkHover}
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </Link>
          </div>
          <div className="space-y-1 text-xs text-fd-muted-foreground">
            <div>© 2026 {APP.NAME}</div>
            <div>Not affiliated with Wargaming</div>
          </div>
        </div>
      </footer>
    </div>
  );
}
