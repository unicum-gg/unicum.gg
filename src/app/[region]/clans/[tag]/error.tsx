"use client";

import Link from "next/link";
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

  return (
    <div className="flex flex-1 items-center justify-center px-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <h1 className="font-heading text-3xl font-bold tracking-tight">
          Something went wrong
        </h1>
        <p className="max-w-md text-muted-foreground">
          The Wargaming API didn't respond properly. This is usually a temporary
          issue on their side.
        </p>
        <div className="flex gap-3 text-sm font-medium">
          <button
            type="button"
            onClick={reset}
            className="cursor-pointer underline underline-offset-2 hover:text-foreground"
          >
            Try again
          </button>
          <Link
            href="/"
            className="underline underline-offset-2 hover:text-foreground"
          >
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
