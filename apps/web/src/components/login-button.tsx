"use client";

import { type ReactElement, useState } from "react";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { LoginModal } from "./login-modal";

/**
 * Every "log in with Wargaming" entry point on the site. It wraps the caller's
 * own trigger (`asChild`, so each surface keeps its button or link styling) and
 * opens the region picker instead of jumping straight to one region's WG
 * portal, which used to be whichever region the reader happened to be browsing.
 */
export function LoginButton({
  callbackURL,
  children,
}: {
  /** Same-origin path to land on once logged in. Defaults to the home page. */
  callbackURL?: string;
  children: ReactElement;
}) {
  const [open, setOpen] = useState(false);
  // The picker is closed on nearly every page view (a logged-out tank page
  // carries three of these), so its hooks and cookie listener should not run
  // until someone actually asks to log in. Mounted on first open and kept from
  // then on, rather than torn down on close, so the dialog keeps its exit
  // animation.
  const [everOpened, setEverOpened] = useState(false);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setEverOpened(true);
        setOpen(next);
      }}
    >
      {/* `DialogTrigger`, not a bare click handler: it is what returns focus to
          the trigger on close, announces the button as opening a dialog, and
          gives the child the `type="button"` a `<Button>` does not default to. */}
      <DialogTrigger asChild>{children}</DialogTrigger>
      {everOpened && <LoginModal callbackURL={callbackURL} />}
    </Dialog>
  );
}
