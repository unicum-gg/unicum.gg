"use client";

import { ShareNetworkIcon } from "@phosphor-icons/react";
import { useState } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ShareModal } from "./share-modal";

export function ShareButton({
  title,
  url,
  shareText,
  emailSubject,
  nativeShareTitle,
  ogImage,
}: {
  title: string;
  url: string;
  shareText: string;
  emailSubject?: string;
  nativeShareTitle?: string;
  ogImage?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Share"
              className="inline-flex cursor-pointer items-center justify-center rounded-md border border-fd-border bg-fd-secondary/30 p-1.5 text-fd-muted-foreground hover:bg-fd-secondary hover:text-fd-foreground"
            >
              <ShareNetworkIcon className="size-3.5" weight="bold" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Share</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <ShareModal
        open={open}
        onOpenChange={setOpen}
        title={title}
        url={url}
        shareText={shareText}
        emailSubject={emailSubject}
        nativeShareTitle={nativeShareTitle}
        ogImage={ogImage}
      />
    </>
  );
}
