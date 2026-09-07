"use client";

import { useCallback, useSyncExternalStore } from "react";
import useSWR from "swr";
import type { Region } from "@unicum.gg/wargaming";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LoginButton } from "@/components/login-button";
import { apiErrorStatus } from "@/lib/api-error";
import { unicum } from "@/services/sdk";
import { VideoEditFields, type EditableVideo } from "./edit-fields";
import {
  readEditParam,
  readEditToken,
  subscribeToEditParam,
  writeEditParam,
} from "./edit-param";

/**
 * Which suggestion is being corrected, and how to open or close the form.
 *
 * Held in the URL rather than beside it, so the one dialog serves both people
 * who reach it: the author presses the pencil on their own queued row, and a
 * moderator arrives on a link from the moderation channel with the id and their
 * ticket already in it.
 *
 * The server snapshot is null, so prerendered HTML carries no dialog and
 * hydration matches; React re-reads the URL immediately after and opens it.
 */
export function useVideoEditing(): {
  editingId: number | null;
  editToken: string | null;
  edit: (id: number | null) => void;
} {
  const editingId = useSyncExternalStore(
    subscribeToEditParam,
    readEditParam,
    () => null,
  );
  const editToken = useSyncExternalStore(
    subscribeToEditParam,
    readEditToken,
    () => null,
  );
  const edit = useCallback((id: number | null) => writeEditParam(id), []);

  return { editingId, editToken, edit };
}

/**
 * The form that corrects a suggestion, over the page it was opened from.
 *
 * A dialog rather than a page of its own: a correction is a small act on a row
 * that is on screen, and sending someone away from the list they are reading to
 * perform it, then back, is a journey for a typo. The moderator's link opens
 * the same dialog on the page the video lives on.
 *
 * Mounted once by the player provider, so every list under it can open it, and
 * keyed on the row so each opening starts from stored values rather than from
 * whatever the previous correction left behind.
 */
export function VideoEditDialog({
  region,
  id,
  token,
  onClose,
}: {
  region: Region;
  id: number;
  token?: string;
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      {/* Wider and scrollable, like the suggestion form it mirrors: the preview
          is a 16:9 player above a dozen fields, which the primitive's default
          size cannot hold. The `sm:` prefix is load-bearing, since the
          primitive caps itself with `sm:max-w-md`. */}
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Correct a suggestion</DialogTitle>
          <DialogDescription>
            Change anything that is wrong, the vehicle included. Saving sends it
            back to the moderation queue, so a video that is live comes down
            until it is approved again.
          </DialogDescription>
        </DialogHeader>
        <EditBody region={region} id={id} token={token} onDone={onClose} />
      </DialogContent>
    </Dialog>
  );
}

/**
 * Loads the row, then hands it to the fields.
 *
 * Read from the browser rather than on the server, because who may see this row
 * is decided by a session cookie or by a signed link, and the page around it
 * has neither to offer the API on the reader's behalf. The fields are only
 * mounted once it is here, so they start on stored values instead of filling in
 * from an effect a keystroke could race.
 */
function EditBody({
  region,
  id,
  token,
  onDone,
}: {
  region: Region;
  id: number;
  token?: string;
  onDone: () => void;
}) {
  const { data, error, isLoading } = useSWR(
    `video-edit:${region}:${id}:${token ?? ""}`,
    () =>
      unicum
        .region(region)
        .videosEditable({ id, token })
        .then((v) => v as unknown as EditableVideo),
    // One row, read once: a correction is a single sitting, and refetching
    // under a half-filled form would be the one thing worse than a stale one.
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      shouldRetryOnError: false,
    },
  );

  if (isLoading) {
    return <p className="text-sm text-fd-muted-foreground">Loading…</p>;
  }
  if (error || !data) {
    return <EditError status={error ? apiErrorStatus(error) : 404} token={token} />;
  }
  return (
    <VideoEditFields
      region={region}
      video={data}
      token={token}
      onDone={onDone}
    />
  );
}

/**
 * Why the form is not here, said plainly.
 *
 * The three refusals mean different things to the person reading them: signed
 * out is a step to take, someone else's is a wall, and an expired link is a
 * button to press again in Discord. A single "something went wrong" would leave
 * a moderator retrying a link that will never work again.
 */
function EditError({ status, token }: { status: number; token?: string }) {
  if (status === 401) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-sm">
          Log in with the account that suggested this video to correct it.
        </p>
        <LoginButton>
          <Button variant="outline" size="sm">
            Log in
          </Button>
        </LoginButton>
      </div>
    );
  }
  return (
    <p className="text-sm">
      {status === 403
        ? token
          ? "That link has expired. Press Edit again on the card in Discord for a fresh one."
          : "This suggestion is not yours to correct."
        : status === 404
          ? "There is no suggestion with that id."
          : "Could not load that suggestion. Try again in a moment."}
    </p>
  );
}
