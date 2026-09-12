"use client";

import { ErrorView } from "@/components/error-view";
import { useEffect } from "react";

export default function ClanError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[clan page] error:", error);
  }, [error]);

  return <ErrorView reset={reset} />;
}
