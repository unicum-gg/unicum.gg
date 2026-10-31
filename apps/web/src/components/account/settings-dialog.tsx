"use client";

import {
  ShieldIcon,
  SignOutIcon,
  UserIcon,
  type Icon,
} from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTranslation } from "@/hooks/use-translation";
import { signOut } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { Connections } from "./connections";
import { consumeConnectionsFlag } from "./return-path";
import { SettingsPrivacy } from "./settings-privacy";
import { SettingsRow } from "./settings-row";

/** The sections of the dialog, in the order the rail lists them. */
enum SettingsSection {
  /** Who you are here, and what you have connected to it. */
  Account = "account",
  /** What the account publishes about itself. */
  Privacy = "privacy",
}

const SECTIONS: { section: SettingsSection; icon: Icon }[] = [
  { section: SettingsSection.Account, icon: UserIcon },
  { section: SettingsSection.Privacy, icon: ShieldIcon },
];

/**
 * The account's settings, as one dialog with a rail of sections.
 *
 * It is the ACCOUNT's settings and not the site's, which is the line that
 * decides what may be added to it: the rating metric, the server, the language
 * and the theme belong to the browser, are offered to a reader who has never
 * logged in, and stay in the nav and the footer where a logged-out reader can
 * reach them. Everything here needs a session to mean anything.
 *
 * A dialog rather than a page, for the reason `Connections` already carried: a
 * page would be an address with nothing at it for anybody but its owner, a
 * canonical and 36 hreflang alternates for a panel whose only crawlable state
 * is a prompt to log in. It grew a rail because the connections stopped being
 * the whole of it.
 *
 * Only the active section is mounted. Each one reads `/api/account/me` when it
 * opens, so a reader who never leaves the first section never pays for the
 * second, and this dialog is reachable from the top bar of every page.
 */
export function SettingsDialog({
  open,
  onOpenChange,
  /**
   * Reopen when the page carries the flag an OAuth round trip set.
   *
   * Only ONE mount on a page may claim this, or every instance would open at
   * once. Connecting is started from the Account section, so that is where the
   * return lands.
   */
  reopenOnReturn = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reopenOnReturn?: boolean;
}) {
  const { t } = useTranslation("components/account/settings");
  const [section, setSection] = useState(SettingsSection.Account);

  useEffect(() => {
    if (!reopenOnReturn) return;
    // Reading the flag is also what clears it, so this must run once on arrival
    // rather than whenever `onOpenChange` happens to be a new function. It
    // lands on the Account section with no help: the round trip left the site,
    // so this component is mounting fresh on its default.
    if (consumeConnectionsFlag()) onOpenChange(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reopenOnReturn]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* The primitive pads and scrolls itself, which a two-pane layout has to
          take back: the rail runs to the edges and the right pane owns the
          scroll, so a long section cannot push the rail out of reach. The fixed
          height is what stops the dialog resizing under the reader as they move
          between a three-row section and a one-row one. */}
      <DialogContent className="grid max-h-[calc(100dvh-2rem)] grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0 sm:h-[30rem] sm:max-w-3xl">
        <DialogHeader className="border-fd-border border-b px-5 py-4 pr-12">
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription className="sr-only">
            {t("description")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-col sm:flex-row">
          <nav
            aria-label={t("title")}
            className="flex shrink-0 gap-1 overflow-x-auto border-fd-border border-b p-2 sm:w-52 sm:flex-col sm:overflow-x-visible sm:overflow-y-auto sm:border-r sm:border-b-0"
          >
            {SECTIONS.map(({ section: key, icon: SectionIcon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setSection(key)}
                aria-current={section === key ? "page" : undefined}
                className={cn(
                  "flex shrink-0 cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors",
                  section === key
                    ? "bg-fd-secondary text-fd-foreground"
                    : "text-fd-muted-foreground hover:bg-fd-secondary/50 hover:text-fd-foreground",
                )}
              >
                <SectionIcon className="size-4 shrink-0" weight="bold" />
                <span className="truncate">{t(`section-${key}`)}</span>
              </button>
            ))}
          </nav>

          <div className="min-w-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
            <h3 className="font-semibold text-fd-foreground text-sm">
              {t(`section-${section}`)}
            </h3>
            <p className="mt-1 mb-2 text-fd-muted-foreground text-xs">
              {t(`section-${section}-description`)}
            </p>
            {section === SettingsSection.Account ? (
              <AccountSection />
            ) : (
              <SettingsPrivacy />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The connected accounts, and the way out.
 *
 * Signing out lives here rather than in the top bar, where it used to be an
 * icon next to the nickname: it is the one account action a reader performs
 * deliberately and almost never, which is the opposite of what earns a
 * permanent place in a 36 pixel strip.
 */
function AccountSection() {
  const { t } = useTranslation("components/account/settings");
  return (
    <>
      <Connections />
      <SettingsRow label={t("log-out")} description={t("log-out-description")}>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            signOut({
              fetchOptions: { onSuccess: () => window.location.reload() },
            })
          }
        >
          <SignOutIcon className="size-4" weight="bold" />
          {t("log-out")}
        </Button>
      </SettingsRow>
    </>
  );
}
