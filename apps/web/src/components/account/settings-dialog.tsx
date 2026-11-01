"use client";

import {
  CreditCardIcon,
  ShieldIcon,
  SignOutIcon,
  UserIcon,
  type Icon,
} from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTranslation } from "@/hooks/use-translation";
import { signOut, useSession } from "@/lib/auth-client";
import { preloadAccount, useAccount } from "@/hooks/use-account";
import { cn } from "@/lib/utils";
import { Connections } from "./connections";
import { consumeConnectionsFlag } from "./return-path";
import { SettingsBilling } from "./settings-billing";
import { SettingsPrivacy } from "./settings-privacy";
import { SettingsRow } from "./settings-row";

/** The sections of the dialog, in the order the rail lists them. */
enum SettingsSection {
  /** Who you are here, and what you have connected to it. */
  Account = "account",
  /** What the account publishes about itself. */
  Privacy = "privacy",
  /** What the account gives the site, and where to change it. */
  Billing = "billing",
}

const SECTIONS: { section: SettingsSection; icon: Icon }[] = [
  { section: SettingsSection.Account, icon: UserIcon },
  { section: SettingsSection.Privacy, icon: ShieldIcon },
  { section: SettingsSection.Billing, icon: CreditCardIcon },
];

/** `#settings` opens the dialog, `#settings/<section>` opens it there. */
const HASH_PREFIX = "#settings";

/** The section an address asks for: null when it asks for no dialog at all. */
function sectionFromHash(hash: string): SettingsSection | null {
  if (hash !== HASH_PREFIX && !hash.startsWith(`${HASH_PREFIX}/`)) return null;
  const asked = hash.slice(HASH_PREFIX.length + 1);
  return (Object.values(SettingsSection) as string[]).includes(asked)
    ? (asked as SettingsSection)
    : SettingsSection.Account;
}

/** Rewrite the address's hash in place, keeping the router's own state. */
function replaceHash(hash: string): void {
  const { pathname, search } = window.location;
  window.history.replaceState(window.history.state, "", `${pathname}${search}${hash}`);
}

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
 * Only the active section is mounted, and every section reads the same
 * `/api/account/me` entry. It is preloaded as soon as a session exists, once
 * the page has settled, so the dialog opens already filled rather than on a
 * loading state: a settings panel that makes its owner wait reads as a slow
 * site. The skeleton only shows for a reader quick enough to beat it.
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
  /**
   * Open when the address asks for it (`#settings/privacy`), on arrival and
   * whenever the hash changes. Like the flag above, only ONE mount on a page may
   * read the address: the top bar's, which is on every page a signed-in reader
   * sees. Every mount WRITES it while open, so the address always names the
   * section on screen and can be pasted to somebody.
   */
  claimHash = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reopenOnReturn?: boolean;
  claimHash?: boolean;
}) {
  const { t } = useTranslation("components/account/settings");
  // Started from the address, so a mount that arrives already open (the top
  // bar's widget mounts once the session has been read) lands on the section
  // the address names rather than on the default for a frame.
  const [section, setSection] = useState(
    () =>
      (claimHash && typeof window !== "undefined"
        ? sectionFromHash(window.location.hash)
        : null) ?? SettingsSection.Account,
  );
  const { data: session } = useSession();
  const signedIn = !!session?.user;

  const { data: account } = useAccount(open);
  // The billing section only exists where the site takes money. Offered while
  // the answer is still on its way, since the rail must not shift under the
  // reader for the common case.
  const sections = SECTIONS.filter(
    ({ section: key }) =>
      key !== SettingsSection.Billing || account?.billing !== null,
  );

  useEffect(() => {
    if (!claimHash) return;
    const follow = () => {
      const asked = sectionFromHash(window.location.hash);
      if (!asked) return;
      setSection(asked);
      onOpenChange(true);
    };
    follow();
    window.addEventListener("hashchange", follow);
    return () => window.removeEventListener("hashchange", follow);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claimHash]);

  // Written in place rather than pushed: a section change is not a page the
  // back button should step through. Only cleared by the mount that had it
  // open, or a closed mount would wipe the address before the claiming one
  // has read it.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open) {
      replaceHash(`${HASH_PREFIX}/${section}`);
      wasOpen.current = true;
    } else if (wasOpen.current) {
      wasOpen.current = false;
      if (sectionFromHash(window.location.hash)) replaceHash("");
    }
  }, [open, section]);

  useEffect(() => {
    if (!signedIn) return;
    // Off the critical path: the page's own requests go first.
    const idle = window.requestIdleCallback ?? ((cb) => window.setTimeout(cb, 1));
    const handle = idle(() => preloadAccount());
    return () => (window.cancelIdleCallback ?? window.clearTimeout)(handle);
  }, [signedIn]);

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
            {sections.map(({ section: key, icon: SectionIcon }) => (
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
            ) : section === SettingsSection.Privacy ? (
              <SettingsPrivacy />
            ) : (
              <SettingsBilling />
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
