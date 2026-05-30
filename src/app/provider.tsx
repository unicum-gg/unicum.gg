"use client";

import { RootProvider } from "fumadocs-ui/provider/next";
import dynamic from "next/dynamic";
import type { ReactNode } from "react";

const SearchDialog = dynamic(
  () => import("@/components/search-dialog"),
);

export function Provider({ children }: { children: ReactNode }) {
  return (
    <RootProvider search={{ SearchDialog }}>{children}</RootProvider>
  );
}
