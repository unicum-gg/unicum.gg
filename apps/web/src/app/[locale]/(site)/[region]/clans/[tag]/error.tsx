"use client";

import { ErrorView } from "@/components/error-view";
import { useEffect } from "react";

export default function ClanError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error("[clan page] error:", error);
  }, [error]);

  return <ErrorView retry={retry} digest={error.digest} />;
}
