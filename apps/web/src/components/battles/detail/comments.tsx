"use client";

import useSWR from "swr";
import { useState } from "react";
import { usePathname } from "@/hooks/use-pathname";
import {
  BattleCommentStatus,
  MAX_BATTLE_COMMENT_LENGTH,
  MIN_BATTLE_COMMENT_LENGTH,
} from "@unicum.gg/shared";
import { isRegion, type Region } from "@unicum.gg/wargaming";
import Link from "@/components/link";
import { LoginButton } from "@/components/login-button";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelTitle,
} from "@/components/panel";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import ROUTES from "@/constants/routes";
import { useFormat } from "@/hooks/use-format";
import { useTranslation } from "@/hooks/use-translation";
import { apiErrorStatus } from "@/lib/api-error";
import { useSession } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { wgIdentityFromEmail } from "@/lib/wg-session";
import { unicum } from "@/services/sdk";

type BattleComment = {
  id: number;
  nickname: string;
  accountId: number;
  authorRegion: string;
  body: string;
  createdAt: string | Date;
  status: BattleCommentStatus;
  inBattle: boolean;
};

export type CommentsPayload = { comments: BattleComment[]; open: boolean };

const DATE_PATTERN = "d MMM yyyy, HH:mm";

/**
 * What players wrote under the battle's replay.
 *
 * Moderated before it is shown, like the reviews on a vehicle's or a map's
 * Community tab and through the same queue, so a comment just written is shown
 * to its author with "awaiting moderation" and to nobody else. Signed with the
 * author's name, unlike those reviews: a comment on somebody's battle is a
 * conversation, and a conversation needs to know who is talking. Whether the
 * author fought in the battle is said beside the name.
 */
export function BattleComments({
  region,
  battleId,
  initial,
}: {
  region: Region;
  battleId: string;
  /** The published comments, read by the server, so they are in the HTML. The
   * reader's own unpublished ones arrive once the browser knows who they are. */
  initial?: CommentsPayload | null;
}) {
  const { t } = useTranslation("components/battles/detail/comments");
  const { date } = useFormat();
  const when = date(DATE_PATTERN);
  const pathname = usePathname();
  const { data: session } = useSession();
  const me = wgIdentityFromEmail(session?.user?.email);
  const battle = unicum.region(region).battles(battleId);
  const key = `${battle.comments().url()}#${session?.user?.id ?? "anon"}`;
  const { data, mutate, isLoading } = useSWR(
    key,
    () => battle.comments().then((r) => r as unknown as CommentsPayload),
    // Shown until the reader's own answer arrives, rather than a spinner.
    { fallbackData: initial ?? undefined, keepPreviousData: true },
  );
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const comments = data?.comments ?? [];
  const published = comments.filter((c) => c.status === BattleCommentStatus.Approved);
  const length = draft.trim().length;
  const sendable =
    length >= MIN_BATTLE_COMMENT_LENGTH && length <= MAX_BATTLE_COMMENT_LENGTH;

  async function send() {
    setSending(true);
    setError(null);
    try {
      await battle.comment({ body: draft.trim() });
      setDraft("");
      await mutate();
    } catch (err) {
      const status = apiErrorStatus(err);
      setError(
        status === 429
          ? t("error.rate-limited")
          : status === 401
            ? t("error.unauthenticated")
            : t("error.unknown"),
      );
    } finally {
      setSending(false);
    }
  }

  async function remove(id: number) {
    await battle.commentDelete({ id }).catch(() => null);
    await mutate();
  }

  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>
          {published.length > 0
            ? t("title-count", { count: published.length })
            : t("title")}
        </PanelTitle>
      </PanelHeader>
      <PanelContent className="flex flex-col gap-4">
        {!data && isLoading ? (
          // A few comments' worth of shape: a name and date, then the text.
          <div className="flex flex-col gap-4" aria-busy="true">
            {[70, 45].map((width) => (
              <div key={width} className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-3.5" style={{ width: `${width}%` }} />
              </div>
            ))}
          </div>
        ) : comments.length === 0 ? (
          <p className="text-sm text-fd-muted-foreground">{t("empty")}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-fd-border">
            {comments.map((comment) => {
              const mine =
                me !== null &&
                me.accountId === comment.accountId &&
                me.region === comment.authorRegion;
              const author = isRegion(comment.authorRegion) ? comment.authorRegion : region;
              return (
                <li key={comment.id} className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                    <Link
                      href={ROUTES.PLAYER(author, comment.nickname)}
                      className="font-medium hover:underline"
                    >
                      {comment.nickname}
                    </Link>
                    {comment.inBattle ? (
                      <span className="rounded bg-fd-secondary px-1.5 py-0.5 text-xs text-fd-muted-foreground">
                        {t("in-battle")}
                      </span>
                    ) : null}
                    <span className="text-xs text-fd-muted-foreground">
                      {when.format(new Date(comment.createdAt))}
                    </span>
                    {comment.status === BattleCommentStatus.Pending ? (
                      <span className="text-xs text-amber-500">{t("pending")}</span>
                    ) : comment.status === BattleCommentStatus.Rejected ? (
                      <span className="text-xs text-red-500">{t("rejected")}</span>
                    ) : null}
                    {mine && comment.status !== BattleCommentStatus.Rejected ? (
                      <button
                        type="button"
                        onClick={() => remove(comment.id)}
                        className="ms-auto cursor-pointer text-xs text-fd-muted-foreground underline-offset-2 hover:text-fd-foreground hover:underline"
                      >
                        {t("delete")}
                      </button>
                    ) : null}
                  </div>
                  <p
                    className={cn(
                      "text-sm whitespace-pre-wrap break-words",
                      comment.status !== BattleCommentStatus.Approved && "text-fd-muted-foreground",
                    )}
                  >
                    {comment.body}
                  </p>
                </li>
              );
            })}
          </ul>
        )}

        {data && !data.open ? null : !session?.user ? (
          <div>
            <LoginButton callbackURL={pathname}>
              <Button variant="outline" size="sm">
                {t("log-in")}
              </Button>
            </LoginButton>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <Textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              maxLength={MAX_BATTLE_COMMENT_LENGTH}
              placeholder={t("placeholder")}
              rows={3}
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-fd-muted-foreground">{t("moderated")}</span>
              <Button size="sm" onClick={send} disabled={!sendable || sending}>
                {sending ? t("sending") : t("send")}
              </Button>
            </div>
            {error ? <p className="text-sm text-red-500">{error}</p> : null}
          </div>
        )}
      </PanelContent>
    </Panel>
  );
}
