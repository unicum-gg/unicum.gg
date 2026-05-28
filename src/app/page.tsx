import { PlayerSearch } from "@/components/player-search";

export default function Home() {
  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-6 dark:bg-black">
      <main className="flex w-full max-w-2xl flex-col items-center gap-8 py-24 text-center">
        <div className="flex flex-col items-center gap-3">
          <h1 className="font-heading text-5xl font-bold tracking-tight text-foreground sm:text-6xl">
            unicum.gg
          </h1>
          <p className="max-w-md text-base text-muted-foreground sm:text-lg">
            Stats World of Tanks. Cherchez un joueur par pseudo.
          </p>
        </div>
        <PlayerSearch />
      </main>
    </div>
  );
}
