import Link from "next/link";
import ROUTES from "@/constants/routes";
import { LoginWidget } from "./login-widget";
import { MiniFundingBar } from "./support/mini-funding-bar";
import { PlayersOnline } from "./players-online";

/**
 * The persistent top strip over a subtle accent gradient: players online on the
 * left, the community funding bar in the middle, and the "Support us" CTA plus
 * the login widget on the right. Present on every page so the funding progress
 * and call to action are always in view.
 */
export function TopBar() {
  return (
    <div className="border-b border-fd-border bg-fd-background">
      <div className="mx-auto w-full max-w-7xl">
        <div className="relative flex h-9 items-center justify-between gap-3 border-x border-fd-border px-4 text-xs">
          <PlayersOnline />
          <div className="flex items-center gap-3">
            <Link
              href={ROUTES.SUPPORT}
              className="shrink-0 font-medium text-[#f25322] transition-opacity hover:opacity-80"
            >
              Support us
            </Link>
            <LoginWidget />
          </div>
          {/* Centered on the container (page content) rather than the leftover
              space between the two asymmetric sides. Hidden on small screens
              where the sides would leave no room. */}
          <div className="pointer-events-none absolute inset-0 hidden items-center justify-center md:flex">
            <div className="pointer-events-auto">
              <MiniFundingBar />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
