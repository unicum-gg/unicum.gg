"use client";

import { useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTranslation } from "@/hooks/use-translation";
import { Connections } from "./connections";
import { consumeConnectionsFlag } from "./return-path";

/**
 * The connected accounts, as a dialog.
 *
 * Controlled rather than wrapping its own trigger, like `ShareModal` and unlike
 * `LoginButton`: one of its callers is a `DropdownMenuItem`, and a
 * `DialogTrigger` nested in a menu is the Radix footgun where the menu
 * unmounts the trigger on select before the dialog has opened. The caller holds
 * the boolean and renders this as a sibling of its menu.
 *
 * `Connections` is mounted only while open, which is deliberate: it reads a
 * per-session endpoint, and this sits in the top bar of every page on the site.
 */
export function ConnectionsDialog({
  open,
  onOpenChange,
  /**
   * Reopen when the page carries the flag an OAuth round trip set.
   *
   * Only ONE mount on a page may claim this, or every instance would open at
   * once. The top bar is the one that does, since it is on every page; the
   * profile menu and the support box are extra doors to the same room.
   */
  reopenOnReturn = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reopenOnReturn?: boolean;
}) {
  const { t } = useTranslation("components/account/connections");

  useEffect(() => {
    if (!reopenOnReturn) return;
    // Reading the flag is also what clears it, so this must run once on arrival
    // rather than whenever `onOpenChange` happens to be a new function.
    if (consumeConnectionsFlag()) onOpenChange(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reopenOnReturn]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <Connections />
      </DialogContent>
    </Dialog>
  );
}
