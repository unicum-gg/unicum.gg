"use client";

import { ShareNetworkIcon } from "@phosphor-icons/react";
import { useState } from "react";
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
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Share"
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-fd-border bg-fd-secondary/30 px-3 py-1.5 text-xs font-medium text-fd-muted-foreground hover:bg-fd-secondary hover:text-fd-foreground"
      >
        <ShareNetworkIcon className="size-3.5" weight="bold" />
        Share
      </button>
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
