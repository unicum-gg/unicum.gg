"use client";

import { buttonVariants } from "fumadocs-ui/components/ui/button";
import Link from "next/link";
import { useEffect } from "react";
import { styles } from "@/lib/styles";

export default function PlayerError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[player page] error:", error);
  }, [error]);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col">
      <div
        className={`relative ${styles.borderX} ${styles.screenLines} flex flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center`}
      >
        <h1 className="font-heading text-3xl font-bold tracking-tight">
          Something went wrong
        </h1>
        <p className="max-w-md text-fd-muted-foreground">
          The Wargaming API didn&apos;t respond properly. This is usually a
          temporary issue on their side.
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={reset}
            className={`${buttonVariants({ variant: "primary" })} cursor-pointer`}
          >
            Try again
          </button>
          <Link href="/" className={buttonVariants({ variant: "outline" })}>
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
