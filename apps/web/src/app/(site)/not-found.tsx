import { buttonVariants } from "fumadocs-ui/components/ui/button";
import { HoverPrefetchLink as Link } from "@/components/hover-prefetch-link";
import { styles } from "@/lib/styles";

// Root boundary: catches every URL that matches no route and any `notFound()`
// thrown by a segment without a closer not-found file (tanks, regions, ...).
export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col">
      <div
        className={`relative ${styles.borderX} screen-line-before flex flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center`}
      >
        <h1 className="font-heading text-3xl font-bold tracking-tight">
          Page not found
        </h1>
        <p className="max-w-md text-fd-muted-foreground">
          This page doesn&apos;t exist or may have moved. Check the URL, or
          head back to the home page.
        </p>
        <Link href="/" className={buttonVariants({ variant: "primary" })}>
          Back to home
        </Link>
      </div>
    </div>
  );
}
