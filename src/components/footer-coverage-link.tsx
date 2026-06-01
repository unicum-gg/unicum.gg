"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ROUTES from "@/constants/routes";
import STORAGE from "@/constants/storage";
import { useCookie } from "@/hooks/use-cookie";
import { styles } from "@/lib/styles";
import { isRegion, Region } from "@/services/wargaming/wot";

function regionFromPath(pathname: string): Region | undefined {
  if (pathname === "/") return Region.EU;
  const segment = pathname.split("/")[1];
  return isRegion(segment) ? segment : undefined;
}

export function FooterCoverageLink() {
  const pathname = usePathname();
  const [stored] = useCookie(STORAGE.COOKIES.REGION, Region.EU);
  const region: Region =
    regionFromPath(pathname) ?? (isRegion(stored) ? stored : Region.EU);

  return (
    <Link href={ROUTES.COVERAGE(region)} className={styles.linkHover}>
      Coverage
    </Link>
  );
}
