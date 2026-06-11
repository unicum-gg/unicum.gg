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
import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  url: string;
  shareText: string;
  emailSubject?: string;
  nativeShareTitle?: string;
  ogImage?: string;
}) {
  const [copied, setCopied] = useState(false);

  const encodedText = encodeURIComponent(shareText);
  const encodedUrl = encodeURIComponent(url);
  const subject = encodeURIComponent(emailSubject ?? title);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
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
        url,
      });
    } catch {
      // user cancelled, no toast
    }
  }

  async function copyForDiscord() {
    try {
      await navigator.clipboard.writeText(`${shareText} ${url}`);
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
            // eslint-disable-next-line @next/next/no-img-element -- dynamic OG route, Next/Image optimizer adds overhead
            <img
              src={ogImage}
              alt="Share preview"
              width={1200}
              height={630}
              className="block aspect-1200/630 w-full object-cover"
            />
          )}
          <div className="space-y-2">
            <label
              htmlFor="share-link"
              className="block text-xs font-medium text-muted-foreground"
            >
              Link
            </label>
            <div className="flex gap-2">
              <Input id="share-link" value={url} readOnly className="flex-1" />
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
