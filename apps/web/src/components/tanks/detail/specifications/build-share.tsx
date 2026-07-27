"use client";

import { useState } from "react";
import {
  CheckIcon,
  LinkIcon,
  ShareNetworkIcon,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import type { Region } from "@unicum.gg/wargaming";
import { unicumPublic } from "@/services/sdk";
import { ShareModal } from "@/components/share-modal";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { SETUP_PARAM } from "@/components/tanks/detail/specifications/config-url";

/**
 * The in-configurator "share this build" affordance: a prominent button opening
 * the full Share modal (setup pre-included) plus a one-click copy shortcut. It is
 * rendered only when the tank deviates from stock, so it surfaces exactly when
 * the user has built something worth sharing.
 */
export function BuildShare({
  region,
  tankName,
  slug,
  setupToken,
}: {
  region: Region;
  tankName: string;
  slug: string;
  /** The current setup token (from `encodeSetup`); the affordance appends it. */
  setupToken: string;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const cleanUrl = `${APP.URL}${ROUTES.TANK(region, slug)}`;
  const setupParams = `${SETUP_PARAM}=${setupToken}`;
  const buildUrl = `${cleanUrl}?${setupParams}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(buildUrl);
      setCopied(true);
      toast.success("Build link copied");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not copy link");
    }
  }

  return (
    <>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-[#f25322] px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-[#f25322]/90"
        >
          <ShareNetworkIcon className="size-3.5" weight="bold" />
          Share build
        </button>
        <button
          type="button"
          onClick={copy}
          aria-label="Copy build link"
          className="inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md border border-fd-border bg-fd-secondary/30 text-fd-muted-foreground transition-colors hover:bg-fd-secondary hover:text-fd-foreground"
        >
          {copied ? (
            <CheckIcon className="size-3.5" weight="bold" />
          ) : (
            <LinkIcon className="size-3.5" weight="bold" />
          )}
        </button>
      </div>

      <ShareModal
        open={open}
        onOpenChange={setOpen}
        title={`Share ${tankName}`}
        url={cleanUrl}
        shareText={`Check out this ${tankName} build on ${APP.NAME}`}
        ogImage={unicumPublic.og.region(region).tanks(slug).url()}
        setupParams={setupParams}
        setupLabel="Include setup"
      />
    </>
  );
}
