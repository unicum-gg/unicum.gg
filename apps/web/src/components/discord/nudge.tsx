"use client";

import { DiscordLogoIcon } from "@phosphor-icons/react/dist/ssr";
import APP from "@/constants/app";
import { usePathname } from "@/hooks/use-pathname";
import { useTranslation } from "@/hooks/use-translation";
import { localizePath } from "@/lib/translations";
import { Button } from "@/components/ui/button";

/**
 * What someone is offered right after they have given us something.
 *
 * Shown on the three screens that follow a contribution, a suggested video, a
 * written opinion, a piece of feedback, because that is the one moment the
 * invitation is not an interruption: they have just done something for the
 * site, and what is being offered is where the rest of it is discussed.
 *
 * Two different asks, and the difference matters. Linking a Discord account is
 * what lets a moderator's verdict reach the person who sent the thing in: it is
 * the only channel we have, since a Wargaming login carries no address we could
 * write to. Joining the server is the community, and it is also what makes the
 * first one work at all, since Discord refuses a direct message from a bot that
 * shares no server with the recipient. So someone who has not linked is shown
 * both, and the wording never promises a message we might not be able to
 * deliver.
 */

/** Which contribution this is following, since what can be promised differs by
 * one. */
export enum NudgeSubject {
  Video = "video",
  Review = "review",
  /** Feedback takes an anonymous message and promises no reply, so the only
   * honest ask is the server itself, whatever the sender has linked. */
  Feedback = "feedback",
}

export function DiscordNudge({
  subject,
  /** Whether the contributor's Discord is linked, from the submission's own
   * response. Ignored on feedback, which has no verdict to deliver. */
  linked,
}: {
  subject: NudgeSubject;
  linked?: boolean;
}) {
  const { t, locale } = useTranslation("components/discord/nudge");
  // Re-prefixed on the way out: the hook strips the language so callers can
  // read WHERE the reader is, and this is the other question, where to send
  // them back to. Without it a French reader returns to the English copy.
  const back = localizePath(usePathname(), locale);
  // Only where a verdict is actually coming: there is nothing to link for on a
  // message nobody will answer.
  const askToLink = subject !== NudgeSubject.Feedback && linked === false;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-fd-border bg-fd-muted/40 p-3">
      <p className="text-xs text-fd-muted-foreground">
        {subject === NudgeSubject.Feedback
          ? t("feedback")
          : askToLink
            ? t(`unlinked.${subject}`)
            : t(`linked.${subject}`)}
      </p>
      <div className="flex flex-wrap gap-2">
        {askToLink ? (
          <Button size="sm" variant="secondary" asChild>
            {/* A plain anchor rather than a router push: the route hands off to
                Discord's OAuth, so there is nothing for the client router to
                render. `return` is narrowed to a same-origin path server-side. */}
            <a href={`/api/link/discord?return=${encodeURIComponent(back)}`}>
              <DiscordLogoIcon className="size-4" />
              {t("link-my-discord")}
            </a>
          </Button>
        ) : null}
        <Button size="sm" variant={askToLink ? "ghost" : "secondary"} asChild>
          <a
            href={APP.EXTERNAL.DISCORD}
            target="_blank"
            rel="noopener noreferrer"
          >
            <DiscordLogoIcon className="size-4" />
            {t("join-the-server")}
          </a>
        </Button>
      </div>
    </div>
  );
}
