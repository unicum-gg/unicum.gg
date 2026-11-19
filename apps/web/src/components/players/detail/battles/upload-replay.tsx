"use client";

import { useState, type DragEvent } from "react";
import { UploadSimpleIcon } from "@phosphor-icons/react";
import type { Region } from "@unicum.gg/wargaming";
import { buttonVariants } from "fumadocs-ui/components/ui/button";
import { Button } from "@/components/ui/button";
import { LoginButton } from "@/components/login-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import ROUTES from "@/constants/routes";
import { usePathname } from "@/hooks/use-pathname";
import { useRouter } from "@/hooks/use-router";
import { useTranslation } from "@/hooks/use-translation";
import { apiErrorCode, apiErrorStatus } from "@/lib/api-error";
import { useSession } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { unicum } from "@/services/sdk";
import { BattleParam, BattleTab } from "@/components/players/detail/overview/battle-types";

/** The refusals the endpoint names, each with a sentence of its own. */
const KNOWN_ERRORS = new Set([
  "not_collected",
  "archive_full",
  "not_a_replay",
  "unfinished",
  "not_yours",
  "wrong_region",
  "too_old",
  "malformed",
  "too_large",
  "too_many_uploads",
]);

/** Mirrors the endpoint's own ceiling, so a large file is refused before it travels. */
const MAX_REPLAY_BYTES = 9 * 1024 * 1024;

/**
 * Add one of your own battles from its `.wotreplay`, for players without the mod.
 *
 * The file says everything: the battle is read out of it server-side and the
 * player lands on its page, opened on the replay, which is the thing they came
 * to share.
 */
export function UploadReplayButton({
  prominent = false,
}: {
  /** The page's main action, drawn as the mod page draws its download: the
   * brand colour at the larger size. A small outline button otherwise, as on
   * a player's Battles tab, where it is one tool among others. */
  prominent?: boolean;
} = {}) {
  const { t } = useTranslation("components/players/detail/battles/upload-replay");
  const { data: session } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trigger = (
    prominent ? (
      // The mod page's own download button, same variant and size, so the
      // two main actions of the site look like one family.
      <button
        type="button"
        className={cn(buttonVariants({ variant: "primary" }), "h-10 gap-2 px-5 text-base")}
      >
        <UploadSimpleIcon weight="bold" className="size-5" />
        {t("trigger")}
      </button>
    ) : (
      <Button variant="outline" size="sm">
        <UploadSimpleIcon className="mr-1.5 size-4" />
        {t("trigger")}
      </Button>
    )
  );

  if (!session?.user) {
    return <LoginButton callbackURL={pathname}>{trigger}</LoginButton>;
  }

  function pick(next: File | null) {
    setError(null);
    if (next && next.size > MAX_REPLAY_BYTES) {
      setFile(null);
      setError(t("error.too_large"));
      return;
    }
    setFile(next);
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    pick(event.dataTransfer.files[0] ?? null);
  }

  async function send() {
    if (!file) return;
    setSending(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("replay", file);
      // The client sends a FormData as it is (multipart, boundary set by the
      // browser); the generated type describes the form's field, not the
      // object that carries it.
      const result = await unicum.replays.upload(
        form as unknown as Parameters<typeof unicum.replays.upload>[0],
      );
      router.push(
        `${ROUTES.BATTLE(result.region as Region, result.id)}?${BattleParam.Tab}=${BattleTab.Replay}`,
      );
      setOpen(false);
    } catch (err) {
      const code = apiErrorCode(err);
      setError(
        code && KNOWN_ERRORS.has(code)
          ? t(`error.${code}`)
          : apiErrorStatus(err) === 401
            ? t("error.unauthenticated")
            : t("error.unknown"),
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setFile(null);
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <label
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            "border-fd-border hover:bg-fd-accent/40 flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-8 text-center text-sm transition-colors",
            dragging && "bg-fd-accent/40 border-brand",
          )}
        >
          <UploadSimpleIcon className="text-fd-muted-foreground size-6" />
          <span className="font-medium">{file ? file.name : t("drop")}</span>
          <span className="text-fd-muted-foreground text-xs">{t("hint")}</span>
          <input
            type="file"
            accept=".wotreplay"
            className="sr-only"
            onChange={(event) => pick(event.target.files?.[0] ?? null)}
          />
        </label>

        {error ? <p className="text-sm text-red-500">{error}</p> : null}

        <DialogFooter>
          <Button onClick={send} disabled={!file || sending}>
            {sending ? t("sending") : t("send")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
