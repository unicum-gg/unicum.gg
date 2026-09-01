"use client";

import {
  ArrowRightIcon,
  ArrowSquareOutIcon,
  GithubLogoIcon,
  type Icon,
  KeyIcon,
  ShieldCheckIcon,
} from "@phosphor-icons/react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import STORAGE from "@/constants/storage";
import { useCookie } from "@/hooks/use-cookie";
import { useRegion } from "@/hooks/use-region";
import { cn } from "@/lib/utils";
import {
  isRegion,
  REGION_EMOJI,
  REGION_LABEL,
  REGION_PORTAL_HOST,
  REGIONS,
  type Region,
} from "@unicum.gg/wargaming";

// The exact file this modal hands the player over to. Linking the login code
// itself, rather than the repository, is the difference between "we are open
// source" and something a suspicious player can actually go and read.
const AUTH_SOURCE_URL = `${APP.EXTERNAL.GITHUB}/blob/main/packages/core/src/auth/wargaming.ts`;

/**
 * Region picker for Wargaming.net ID login. A WG account lives on exactly one
 * region's account server, and the region a reader is browsing says nothing
 * about which: a NA player reaches us through a shared EU link like anyone
 * else. Sending them to the EU portal by default lands them on a login form
 * their account does not exist behind, and for the players who hold an account
 * on two regions it silently signs them in as the wrong one. So the region is
 * asked for here rather than inferred, and the one a login actually completed
 * on is remembered (by the callback, not by this click) for next time.
 *
 * This is the dialog body, not a standalone modal: `LoginButton` owns the
 * `Dialog` and its trigger, and only mounts this once the picker is opened.
 */
export function LoginModal({
  callbackURL,
}: {
  /**
   * Same-origin path to land on once logged in. Defaults to the page the
   * player is on, which is what the top-bar login wants: logging in is not a
   * destination, it is something you do in passing.
   */
  callbackURL?: string;
}) {
  const { region: browsing } = useRegion();
  // Read from `window` rather than `useSearchParams`, which would opt every
  // page carrying the top-bar widget out of static rendering. Safe here because
  // this body only ever mounts client-side, after a click, so there is no
  // server-rendered value for it to disagree with, and `useRegion` re-renders
  // it on navigation so the path stays current.
  const pathname = usePathname();
  const here =
    typeof window === "undefined"
      ? pathname
      : `${window.location.pathname}${window.location.search}`;
  const destination = callbackURL ?? here;
  // Read-only: the cookie is written by the WG callback once a login has
  // actually been verified, so what it holds is a region the player really
  // logged in on rather than one they clicked.
  const [stored] = useCookie(STORAGE.COOKIES.AUTH_REGION, "");
  // Their own last login beats the region they happen to be reading, which is
  // only ever a guess.
  const remembered = isRegion(stored) ? stored : null;
  const suggested = remembered ?? browsing;

  return (
    /* Wider than the dialog default (`sm:max-w-md`, which the share modal
       keeps): with the three portals and the reassurance under them, that width
       came out taller than it was wide. Still short of the `sm:max-w-3xl` the
       video-submission forms use, since this is a choice between three things,
       not a form. */
    <DialogContent className="sm:max-w-xl">
      <DialogHeader>
        <DialogTitle>Log in with Wargaming.net ID</DialogTitle>
        <DialogDescription>
          Pick the region your World of Tanks account is on. It does not have to
          be the region you are browsing.
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-2">
        {REGIONS.map((region) => (
          <RegionChoice
            key={region}
            region={region}
            suggested={region === suggested}
            note={
              region === suggested
                ? remembered
                  ? "Last used"
                  : "Browsing"
                : null
            }
            callbackURL={destination}
          />
        ))}
      </div>

      <Assurances />
    </DialogContent>
  );
}

/**
 * What a player worried about their account needs to know before clicking, and
 * nothing they cannot check themselves. We are new and we are asking them to
 * log in with the account they have spent years on, so this says where the
 * password is actually typed (Wargaming's own domain, shown on each choice
 * above), what we get back, and where to read the code that does it.
 */
function Assurances() {
  return (
    <div className="flex flex-col gap-2.5 rounded-lg border border-fd-border bg-fd-secondary/20 p-3">
      <Assurance icon={ShieldCheckIcon}>
        You sign in on Wargaming&apos;s own page, not here. Your password is
        never typed on {APP.NAME} and never reaches us.
      </Assurance>
      <Assurance icon={KeyIcon}>
        What Wargaming hands back is a token that reads your own account data.
        It is stored encrypted and renewed while your account stays linked, and
        it only ever acts for you where you set that up yourself, like your
        clan&apos;s reserve schedule.
      </Assurance>
      <Assurance icon={GithubLogoIcon}>
        {APP.NAME} is open source.{" "}
        <a
          href={AUTH_SOURCE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-fd-foreground underline underline-offset-2 hover:text-brand"
        >
          Read the login code
          <ArrowSquareOutIcon className="size-3" weight="bold" />
        </a>{" "}
        before you trust it.
      </Assurance>
    </div>
  );
}

function Assurance({
  icon: Icon,
  children,
}: {
  icon: Icon;
  children: ReactNode;
}) {
  return (
    <p className="flex items-start gap-2 text-xs leading-relaxed text-fd-muted-foreground">
      <Icon
        aria-hidden
        className="mt-0.5 size-3.5 shrink-0 text-fd-muted-foreground"
        weight="bold"
      />
      <span>{children}</span>
    </p>
  );
}

function RegionChoice({
  region,
  suggested,
  note,
  callbackURL,
}: {
  region: Region;
  suggested: boolean;
  note: string | null;
  callbackURL?: string;
}) {
  return (
    // A real link, not a button: this leaves the app for WG's own login page,
    // so the browser should treat it as navigation (middle click, right click,
    // status bar).
    <a
      href={ROUTES.AUTH_SIGN_IN(region, callbackURL)}
      className={cn(
        "group flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors",
        suggested
          ? "border-brand/40 bg-brand/5 hover:bg-brand/10"
          : "border-fd-border bg-fd-secondary/30 hover:bg-fd-secondary",
      )}
    >
      <span aria-hidden className="text-xl leading-none">
        {REGION_EMOJI[region]}
      </span>
      <span className="flex flex-col">
        <span className="text-sm font-medium text-fd-foreground">
          {REGION_LABEL[region]}
        </span>
        <span className="text-xs text-fd-muted-foreground">
          {REGION_PORTAL_HOST[region]}
        </span>
      </span>
      <span className="ml-auto flex items-center gap-2">
        {note && (
          <span className="text-xs text-fd-muted-foreground">{note}</span>
        )}
        <ArrowRightIcon
          className="size-4 text-fd-muted-foreground transition-transform group-hover:translate-x-0.5"
          weight="bold"
        />
      </span>
    </a>
  );
}
