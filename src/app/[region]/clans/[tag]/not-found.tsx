import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-1 items-center justify-center px-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <h1 className="font-heading text-3xl font-bold tracking-tight">
          Clan not found
        </h1>
        <p className="max-w-md text-muted-foreground">
          Check the tag and region — the same tag can exist on different
          servers.
        </p>
        <Link href="/" className="text-sm font-medium underline">
          Back to home
        </Link>
      </div>
    </div>
  );
}
