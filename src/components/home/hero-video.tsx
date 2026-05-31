'use client';

import { PauseIcon, PlayIcon, SpinnerIcon } from '@phosphor-icons/react';
import { buttonVariants } from 'fumadocs-ui/components/ui/button';
import STORAGE from '@/constants/storage';
import { useVideoControl } from '@/hooks/use-video-control';
import { cn } from '@/lib/utils';

export function HeroVideo() {
  const { videoRef, isPlaying, isLoading, isVideoVisible, toggle } = useVideoControl({
    storageKey: STORAGE.LOCAL_STORAGE.HERO_VIDEO_PLAYING,
    defaultPlaying: true
  });

  return (
    <div className="absolute inset-0" style={{backgroundImage: "url('//eu-wotp.wgcdn.co/static/6.10.0_4edfb4/wotp_static/img/core/frontend/scss/common/blocks/video-bg/img/promo-mobile.jpg')"}}>
      <video 
        ref={videoRef}
        loop 
        muted 
        playsInline 
        className={cn(
          "absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-out",
          isVideoVisible ? "opacity-100" : "opacity-0"
        )}
        poster="//eu-wotp.wgcdn.co/static/6.10.0_4edfb4/wotp_static/img/core/frontend/scss/common/blocks/video-bg/img/poster.jpg"
      >
        <source src="//eu-wotp.wgcdn.co/static/6.10.0_4edfb4/wotp_static/img/core/frontend/scss/common/blocks/video-bg/img/video-bg.mp4" type="video/mp4" />
        <source src="//eu-wotp.wgcdn.co/static/6.10.0_4edfb4/wotp_static/img/core/frontend/scss/common/blocks/video-bg/img/video-bg.webm" type="video/webm" />
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