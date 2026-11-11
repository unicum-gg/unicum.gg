"use client";

import { AssemblingView } from "@/components/assembling-view";
import { ErrorView } from "@/components/error-view";
import { STILL_LOADING_DIGEST } from "@/lib/still-loading";
import { useEffect } from "react";

export default function ClanError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  // The endpoint asking us to come back is not a failure, and the digest is
  // the only thing that survives into production here: Next replaces a server
  // error's message with a generic one and keeps the digest it was thrown
  // with (see `lib/still-loading`).
  const assembling = error.digest === STILL_LOADING_DIGEST;

  useEffect(() => {
    if (!assembling) console.error("[clan page] error:", error);
  }, [assembling, error]);

  if (assembling) return <AssemblingView retry={retry} />;
  return <ErrorView retry={retry} digest={error.digest} />;
}
