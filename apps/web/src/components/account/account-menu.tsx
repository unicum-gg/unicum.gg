"use client";

import {
  CaretDownIcon,
  GearSixIcon,
  HeartIcon,
  PlusIcon,
  ShieldIcon,
  SignOutIcon,
  UserIcon,
} from "@phosphor-icons/react";
import { useState } from "react";
import { REGION_LABEL } from "@unicum.gg/wargaming";
import Link from "@/components/link";
import { ClanTag } from "@/components/entity/clan-tag";
import { LoginModal } from "@/components/login-modal";
import { SettingsDialog } from "@/components/account/settings-dialog";
import { Dialog } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ROUTES from "@/constants/routes";
import { useTranslation } from "@/hooks/use-translation";
import { authClient, signOut } from "@/lib/auth-client";
import { wgIdentityFromEmail } from "@/lib/wg-session";
import { type DeviceAccount, useDeviceAccounts } from "./use-device-accounts";

type ActiveSession = {
  session: { token: string };
  user: { id: string; email: string; name: string };
};

/**
 * The signed-in half of the top bar: the nickname and clan tag as ONE trigger,
 * opening everything the account can do. They were two links and a settings
 * gear, which left no room for the account switcher and spent three targets of
 * a 36 pixel strip on things a reader opens rarely.
 *
 * Every switch and sign-out ends in a full reload, like the settings dialog's
 * sign-out always has: the session is read by server components, SWR keys and
 * cookie-painted CSS alike, and a client refresh would leave some of them on
 * the previous account.
 */
export function AccountMenu({ active }: { active: ActiveSession }) {
  const { t } = useTranslation("components/account/account-menu");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const accounts = useDeviceAccounts(active);
  const wg = wgIdentityFromEmail(active.user.email);
  const current = accounts?.find((a) => a.userId === active.user.id);
  const others = accounts?.filter((a) => a.userId !== active.user.id) ?? [];
  const clan = current?.clan ?? null;

  const reload = () => window.location.reload();
  const switchTo = (account: DeviceAccount) =>
    authClient.multiSession
      .setActive({ sessionToken: account.sessionToken })
      .then(reload);
  // Signing out of the active account alone hands the session to the next one
  // still signed in (the plugin picks it), or signs out entirely if none is.
  const logOut = () =>
    authClient.multiSession
      .revoke({ sessionToken: active.session.token })
      .then(reload);
  const logOutAll = () =>
    signOut({ fetchOptions: { onSuccess: reload } });

  return (
    <>
      <DropdownMenu>
        {/* The nickname is the one thing here with no bound: a player names
            themselves, and the strip is as narrow on a phone as on a desktop,
            so it truncates first rather than pushing the tag off the edge. */}
        <DropdownMenuTrigger className="group flex min-w-0 cursor-pointer items-baseline gap-1 text-fd-foreground focus-visible:outline-none">
          <span className="truncate font-medium tabular-nums">
            {active.user.name}
          </span>
          {clan && (
            <span className="shrink-0 tabular-nums">
              <ClanTag tag={clan.tag} color={clan.color} />
            </span>
          )}
          <CaretDownIcon
            className="size-3 shrink-0 self-center text-fd-muted-foreground transition-[color,rotate] group-hover:text-fd-foreground group-aria-expanded:rotate-180 group-aria-expanded:text-fd-foreground"
            weight="bold"
            aria-hidden
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="min-w-56 [&_[role=menuitem]]:cursor-pointer"
        >
          <AccountLabel
            nickname={active.user.name}
            clan={clan}
            region={wg?.region ?? null}
          />
          <DropdownMenuSeparator />
          {wg && (
            <DropdownMenuItem asChild>
              <Link href={ROUTES.PLAYER(wg.region, active.user.name)}>
                <UserIcon weight="bold" />
                {t("profile")}
              </Link>
            </DropdownMenuItem>
          )}
          {wg && clan && (
            <DropdownMenuItem asChild>
              <Link href={ROUTES.CLAN(wg.region, clan.tag)}>
                <ShieldIcon weight="bold" />
                {t("clan")}
              </Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={() => setSettingsOpen(true)}>
            <GearSixIcon weight="bold" />
            {t("settings")}
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={ROUTES.SUPPORT}>
              <HeartIcon weight="fill" className="text-brand" />
              {t("support")}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {others.length > 0 && (
            <>
              <DropdownMenuLabel>{t("switch-account")}</DropdownMenuLabel>
              {others.map((account) => (
                <DropdownMenuItem
                  key={account.userId}
                  onSelect={() => void switchTo(account)}
                  className="justify-between gap-4"
                >
                  <AccountName nickname={account.nickname} clan={account.clan} />
                  {account.region && (
                    <span className="text-xs text-muted-foreground">
                      {REGION_LABEL[account.region]}
                    </span>
                  )}
                </DropdownMenuItem>
              ))}
            </>
          )}
          <DropdownMenuItem onSelect={() => setAddOpen(true)}>
            <PlusIcon weight="bold" />
            {t("add-account")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => void logOut()}>
            <SignOutIcon weight="bold" />
            {t("log-out")}
          </DropdownMenuItem>
          {others.length > 0 && (
            <DropdownMenuItem onSelect={() => void logOutAll()} inset>
              {t("log-out-all")}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        claimHash
      />
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        {addOpen && <LoginModal />}
      </Dialog>
    </>
  );
}

function AccountName({
  nickname,
  clan,
}: {
  nickname: string;
  clan: DeviceAccount["clan"];
}) {
  return (
    <span className="flex min-w-0 items-baseline gap-1">
      <span className="truncate font-medium tabular-nums">{nickname}</span>
      {clan && (
        <span className="shrink-0 tabular-nums">
          <ClanTag tag={clan.tag} color={clan.color} />
        </span>
      )}
    </span>
  );
}

function AccountLabel({
  nickname,
  clan,
  region,
}: {
  nickname: string;
  clan: DeviceAccount["clan"];
  region: DeviceAccount["region"];
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-1.5 py-1 text-sm">
      <AccountName nickname={nickname} clan={clan} />
      {region && (
        <span className="text-xs text-muted-foreground">
          {REGION_LABEL[region]}
        </span>
      )}
    </div>
  );
}
