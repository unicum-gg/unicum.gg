"use client";

import {
  CheckIcon,
  CopyIcon,
  DiscordLogoIcon,
  DotsThreeIcon,
  EnvelopeSimpleIcon,
  FacebookLogoIcon,
  type Icon,
  RedditLogoIcon,
  XLogoIcon,
} from "@phosphor-icons/react";
import Image from "next/image";
import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { ogImagePath } from "@/lib/og-image";
import { cn } from "@/lib/utils";

type ShareTarget = {
  name: string;
  icon: Icon;
  onSelect: () => void;
};

export function ShareModal({
  open,
  onOpenChange,
  title,
  url,
  shareText,
  emailSubject,
  nativeShareTitle,
  ogImage,
  setupParams,
  setupLabel = "Share with setup",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  url: string;
  shareText: string;
  emailSubject?: string;
  nativeShareTitle?: string;
  ogImage?: string;
  /** Extra query string (no leading `?`) to optionally append to the shared link
   * via a "Share with setup" checkbox. Omit/empty to hide the checkbox. */
  setupParams?: string;
  setupLabel?: string;
}) {
  const [copied, setCopied] = useState(false);
  // The preview that has finished loading, rather than a "loaded" flag: the
  // flag had to be cleared from an effect every time the image changed, and it
  // showed the previous card underneath for the length of that extra render.
  const [loadedOg, setLoadedOg] = useState<string | null>(null);
  const [withSetup, setWithSetup] = useState(true);

  const ogLoaded = loadedOg === ogImage;

  // The link actually shared: the clean URL, plus the current configurator setup
  // when the box is ticked and there is a setup to carry.
  const shareUrl =
    setupParams && withSetup
      ? `${url}${url.includes("?") ? "&" : "?"}${setupParams}`
      : url;

  const encodedText = encodeURIComponent(shareText);
  const encodedUrl = encodeURIComponent(shareUrl);
  const subject = encodeURIComponent(emailSubject ?? title);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not copy link");
    }
  }

  function openIntent(intent: string) {
    window.open(intent, "_blank", "noopener,noreferrer,width=600,height=500");
  }

  async function shareNative() {
    if (!navigator.share) {
      copyLink();
      return;
    }
    try {
      await navigator.share({
        title: nativeShareTitle ?? title,
        text: shareText,
        url: shareUrl,
      });
    } catch {
      // user cancelled, no toast
    }
  }

  async function copyForDiscord() {
    try {
      await navigator.clipboard.writeText(`${shareText} ${shareUrl}`);
      toast.success("Copied, paste in Discord");
    } catch {
      toast.error("Could not copy link");
    }
  }

  const targets: ShareTarget[] = [
    {
      name: "X",
      icon: XLogoIcon,
      onSelect: () =>
        openIntent(
          `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
        ),
    },
    {
      name: "Facebook",
      icon: FacebookLogoIcon,
      onSelect: () =>
        openIntent(
          `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
        ),
    },
    {
      name: "Reddit",
      icon: RedditLogoIcon,
      onSelect: () =>
        openIntent(
          `https://www.reddit.com/submit?url=${encodedUrl}&title=${encodedText}`,
        ),
    },
    {
      name: "Discord",
      icon: DiscordLogoIcon,
      onSelect: copyForDiscord,
    },
    {
      name: "Email",
      icon: EnvelopeSimpleIcon,
      onSelect: () => {
        window.location.href = `mailto:?subject=${subject}&body=${encodedText}%20${encodedUrl}`;
      },
    },
    {
      name: "More",
      icon: DotsThreeIcon,
      onSelect: shareNative,
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {ogImage && (
            <div className="relative aspect-1200/630 w-full">
              {!ogLoaded && (
                <Skeleton className="absolute inset-0 rounded-none" />
              )}
              {/* `unoptimized`, deliberately. Optimizing would save real bytes
                  (59kB raw against 17kB) but write a resized copy of every card
                  anyone opens this modal on into the server's image cache,
                  which has no bound over players, clans and tanks, and which
                  nothing else will ever read: the `og:image` meta points at
                  `/api/og/…`, so an embed never asks for the optimized one.
                  Fetching the card as-is also warms the CDN entry the embed
                  will hit, where the optimizer's server-side fetch does not. */}
              <Image
                src={ogImagePath(ogImage)}
                alt="Share preview"
                width={1200}
                height={630}
                unoptimized
                onLoad={() => setLoadedOg(ogImage)}
                className={cn(
                  "block size-full object-cover transition-opacity duration-200",
                  ogLoaded ? "opacity-100" : "opacity-0",
                )}
              />
            </div>
          )}
          <div className="space-y-2">
            <label
              htmlFor="share-link"
              className="block text-xs font-medium text-muted-foreground"
            >
              Link
            </label>
            <div className="flex gap-2">
              <Input
                id="share-link"
                value={shareUrl}
                readOnly
                className="flex-1"
              />
              <button
                type="button"
                onClick={copyLink}
                aria-label="Copy link"
                className={cn(
                  "inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-md border border-fd-border bg-fd-secondary/30 text-fd-muted-foreground transition-colors hover:bg-fd-secondary hover:text-fd-foreground",
                  copied && "text-fd-foreground",
                )}
              >
                {copied ? (
                  <CheckIcon className="size-4" weight="bold" />
                ) : (
                  <CopyIcon className="size-4" weight="bold" />
                )}
              </button>
            </div>
            {setupParams ? (
              <label className="flex cursor-pointer items-center gap-2 pt-0.5 text-xs text-muted-foreground">
                <Checkbox
                  checked={withSetup}
                  onCheckedChange={(v) => setWithSetup(v === true)}
                />
                {setupLabel}
              </label>
            ) : null}
          </div>

          <div className="space-y-2">
            <span className="block text-xs font-medium text-muted-foreground">
              Share with
            </span>
            <div className="grid grid-cols-3 gap-2">
              {targets.map((t) => (
                <button
                  key={t.name}
                  type="button"
                  onClick={t.onSelect}
                  className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border border-fd-border bg-fd-secondary/30 px-3 py-2.5 text-sm font-medium text-fd-muted-foreground transition-colors hover:bg-fd-secondary hover:text-fd-foreground"
                >
                  <t.icon className="size-4" weight="bold" />
                  {t.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
