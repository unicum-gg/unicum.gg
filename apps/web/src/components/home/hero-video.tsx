'use client';

import { PauseIcon, PlayIcon, SpinnerIcon } from '@phosphor-icons/react';
import { buttonVariants } from 'fumadocs-ui/components/ui/button';
import { promoVideoAssetUrl } from '@unicum.gg/wargaming';
import STORAGE from '@/constants/storage';
import { useRegion } from '@/hooks/use-region';
import { useVideoControl } from '@/hooks/use-video-control';
import { cn } from '@/lib/utils';

export function HeroVideo() {
  const { region } = useRegion();
  const { videoRef, isPlaying, isLoading, isVideoVisible, toggle } = useVideoControl({
    storageKey: STORAGE.LOCAL_STORAGE.HERO_VIDEO_PLAYING,
    defaultPlaying: true
  });

  return (
    <div className="absolute inset-0" style={{backgroundImage: `url('${promoVideoAssetUrl(region, 'promo-mobile.jpg')}')`}}>
      <video
        ref={videoRef}
        loop
        muted
        playsInline
        className={cn(
          "absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-out",
          isVideoVisible ? "opacity-100" : "opacity-0"
        )}
        poster={promoVideoAssetUrl(region, 'poster.jpg')}
      >
        <source src={promoVideoAssetUrl(region, 'video-bg.mp4')} type="video/mp4" />
        <source src={promoVideoAssetUrl(region, 'video-bg.webm')} type="video/webm" />
      </video>
      
      {/* Video Control Button */}
      <button
        onClick={toggle}
        className={cn(
          buttonVariants({ size: "icon-xs" }),
          "absolute bottom-3 right-3 sm:bottom-4 sm:right-4 z-20 backdrop-blur-sm border border-white/20 cursor-pointer"
        )}
        aria-label="Play/Pause video"
      >
        {isLoading ? (
          <SpinnerIcon className="size-4 animate-spin text-white" />
        ) : isPlaying ? (
          <PauseIcon weight="fill" className="size-4 text-white" />
        ) : (
          <PlayIcon weight="fill" className="size-4 text-white" />
        )}
      </button>
    </div>
  );
}