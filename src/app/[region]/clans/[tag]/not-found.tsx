import { buttonVariants } from "fumadocs-ui/components/ui/button";
import Link from "next/link";
import { styles } from "@/lib/styles";

export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col">
      <div
        className={`relative ${styles.borderX} ${styles.screenLines} flex flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center`}
      >
        <h1 className="font-heading text-3xl font-bold tracking-tight">
          Clan not found
        </h1>
        <p className="max-w-md text-fd-muted-foreground">
          Check the tag and region — the same tag can exist on different
          servers.
        </p>
        <Link href="/" className={buttonVariants({ variant: "primary" })}>
          Back to home
        </Link>
      </div>
    </div>
  );
}
