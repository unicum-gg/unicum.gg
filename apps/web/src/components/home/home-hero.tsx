"use client";

import { HeroVideo } from "@/components/home/hero-video";
import APP from "@/constants/app";
import { styles } from "@/lib/styles";

/**
 * The decorative video hero shown when nobody tracked is streaming, or when the
 * visitor has hidden the live-streamers rail. When `onShowStreams` is provided
 * (i.e. streams exist but are hidden), a small pill lets them bring the rail
 * back.
 */
export function HomeHero({
  onShowStreams,
  streamingCount = 0,
}: {
  onShowStreams?: () => void;
  streamingCount?: number;
}) {
  return (
    <div
      className={`relative aspect-16/10 ${styles.borderX} flex w-full select-none items-center justify-center overflow-hidden sm:aspect-5/2 md:aspect-auto md:h-64 ${styles.screenLines}`}
    >
      <HeroVideo />
      <div className="absolute inset-0 bg-black/40" />
      <div className="absolute inset-0 dot-pattern opacity-20" />
      {onShowStreams ? (
        <button
          type="button"
          onClick={onShowStreams}
          className="absolute right-3 top-3 z-20 inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-black/50 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm transition-colors hover:bg-black/70"
        >
          <span className="text-[#eb0400]">●</span>
          {streamingCount} streaming now
        </button>
      ) : null}
      <div className="relative z-10 space-y-4 px-4 text-center sm:space-y-6 sm:px-6">
        <h1 className="text-2xl font-bold text-white sm:text-4xl md:text-6xl">
          {APP.NAME}
        </h1>
        <p className="mx-auto max-w-2xl text-base text-white/90 sm:text-lg md:text-xl">
          World of Tanks player, clan and tank stats. Track your progress,
          compare with others.
        </p>
      </div>
    </div>
  );
}
