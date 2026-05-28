import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-1 items-center justify-center px-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <h1 className="font-heading text-3xl font-bold tracking-tight">
          Joueur introuvable
        </h1>
        <p className="max-w-md text-muted-foreground">
          Vérifiez le pseudo et la région — un même pseudo peut exister sur des
          serveurs différents.
        </p>
        <Link href="/" className="text-sm font-medium underline">
          Retour à l&apos;accueil
        </Link>
      </div>
    </div>
  );
}
