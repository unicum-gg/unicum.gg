"use client";

import Link from "next/link";
import ROUTES from "@/constants/routes";
import { useRegion } from "@/hooks/use-region";
import { styles } from "@/lib/styles";

export function FooterCoverageLink() {
  const { region } = useRegion();
  return (
    <Link
      href={ROUTES.COVERAGE(region)}
      className={styles.linkHover}
    >
      Coverage
    </Link>
  );
}
