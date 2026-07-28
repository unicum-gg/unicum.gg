"use client";

import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { DiscordLogoIcon } from "@phosphor-icons/react";
import type { Region } from "@unicum.gg/wargaming";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelTitle,
} from "@/components/panel";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type GuildOption = { id: string; name: string; botPresent: boolean };
type Destination = {
  guildId: string;
  channelId: string;
  guildName: string;
  channelName: string;
};
type DiscordData = {
  canManage: boolean;
  destination: Destination | null;
  connected: GuildOption[] | null;
};
type Channel = { id: string; name: string };

const fetchJson = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
};

/**
 * Officer-only Discord destination for the clan's boost notifications. Our bot
 * posts directly (no webhook): the officer connects Discord (which also joins
 * them to our community server), picks a server + channel, and we store it.
 */
export function ClanBoostDiscord({
  region,
  tag,
  className,
}: {
  region: Region;
  tag: string;
  className?: string;
}) {
  const key = `/api/${region}/clans/${encodeURIComponent(tag)}/boosts/discord`;
  const { data, mutate } = useSWR<DiscordData>(key, fetchJson, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });

  const [editing, setEditing] = useState(false);
  const [guildId, setGuildId] = useState("");
  const [channelId, setChannelId] = useState("");
  const [busy, setBusy] = useState(false);

  // Only list channels once a guild the bot is actually in is picked — otherwise
  // the Channel select isn't rendered and the request would be wasted.
  const guildHasBot = data?.connected?.find((g) => g.id === guildId)?.botPresent;
  const { data: channelData } = useSWR<{ channels: Channel[] }>(
    guildId && guildHasBot ? `${key}/channels?guildId=${guildId}` : null,
    fetchJson,
  );
  const channels = channelData?.channels ?? [];

  if (!data?.canManage) return null;

  const dest = data.destination;
  const connectHref = `/api/discord/boost?continue=${encodeURIComponent(
    typeof window !== "undefined"
      ? window.location.pathname + window.location.search
      : "",
  )}`;
  const guilds = data.connected ?? [];
  const selectedGuild = guilds.find((g) => g.id === guildId);

  async function save() {
    const g = guilds.find((x) => x.id === guildId);
    const c = channels.find((x) => x.id === channelId);
    if (!g || !c) return;
    setBusy(true);
    try {
      const res = await fetch(key, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guildId: g.id,
          channelId: c.id,
          guildName: g.name,
          channelName: c.name,
        }),
      });
      if (!res.ok) throw new Error();
      await mutate();
      setEditing(false);
      toast.success("Discord channel connected");
    } catch {
      toast.error("Could not save the channel");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      const res = await fetch(key, { method: "DELETE" });
      if (!res.ok) throw new Error(String(res.status));
      await mutate();
      toast.success("Discord notifications removed");
    } catch {
      toast.error("Could not remove the destination");
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    try {
      const res = await fetch(`${key}/test`, { method: "POST" });
      if (!res.ok) throw new Error();
      toast.success("Test message sent");
    } catch {
      toast.error("Could not send the test (is the bot allowed to post there?)");
    } finally {
      setBusy(false);
    }
  }

  const showPicker = editing || !dest;

  return (
    // The neighbouring intro Panel's full-width screen-lines already draw this
    // row's top/bottom hairlines, so we drop ours to avoid a doubled border.
    <Panel screenLines={false} className={className}>
        <PanelHeader className="flex min-h-14 items-center">
          <PanelTitle className="flex items-center gap-2">
            Discord notifications
            <DiscordLogoIcon className="size-5 text-fd-muted-foreground" />
          </PanelTitle>
        </PanelHeader>
        <PanelContent className="flex flex-col items-start gap-4">
          {dest && !editing && (
            <>
              <p className="text-sm text-fd-muted-foreground">
                Boost activations are posted to{" "}
                <span className="font-medium text-fd-foreground">
                  #{dest.channelName || dest.channelId}
                </span>{" "}
                in{" "}
                <span className="font-medium text-fd-foreground">
                  {dest.guildName || "your server"}
                </span>
                .
              </p>
              <div className="flex flex-wrap gap-2">
                <Button onClick={test} disabled={busy}>
                  Send test
                </Button>
                <Button variant="secondary" onClick={() => setEditing(true)}>
                  Change channel
                </Button>
                <Button variant="ghost" onClick={remove} disabled={busy}>
                  Remove
                </Button>
              </div>
            </>
          )}

          {showPicker && !data.connected && (
            <>
              <p className="max-w-2xl text-sm text-fd-muted-foreground">
                Connect Discord to post boost activations to a channel you choose.
                You&apos;ll also be added to our community server. Pick which
                server to add the bot to on the Discord screen.
              </p>
              <Button asChild>
                <a href={connectHref}>
                  <DiscordLogoIcon className="size-4" /> Connect Discord
                </a>
              </Button>
            </>
          )}

          {showPicker && data.connected && (
            <>
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs text-fd-muted-foreground">Server</Label>
                  <Select
                    value={guildId}
                    onValueChange={(v) => {
                      setGuildId(v);
                      setChannelId("");
                    }}
                  >
                    <SelectTrigger className="w-56">
                      <SelectValue placeholder="Pick a server" />
                    </SelectTrigger>
                    <SelectContent>
                      {guilds.map((g) => (
                        <SelectItem key={g.id} value={g.id}>
                          {g.name}
                          {!g.botPresent ? " (bot not added)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedGuild && selectedGuild.botPresent && (
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs text-fd-muted-foreground">
                      Channel
                    </Label>
                    <Select value={channelId} onValueChange={setChannelId}>
                      <SelectTrigger className="w-56">
                        <SelectValue placeholder="Pick a channel" />
                      </SelectTrigger>
                      <SelectContent>
                        {channels.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            #{c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {selectedGuild && !selectedGuild.botPresent && (
                <p className="text-sm text-fd-muted-foreground">
                  Our bot isn&apos;t in <b>{selectedGuild.name}</b> yet.{" "}
                  <a href={connectHref} className="text-brand hover:underline">
                    Add the bot
                  </a>{" "}
                  (pick this server on the Discord screen), then come back.
                </p>
              )}

              <div className="flex gap-2">
                <Button onClick={save} disabled={busy || !guildId || !channelId}>
                  {busy ? "Saving…" : "Save"}
                </Button>
                {editing && (
                  <Button variant="ghost" onClick={() => setEditing(false)}>
                    Cancel
                  </Button>
                )}
                <Button variant="ghost" asChild>
                  <a href={connectHref}>Reconnect / add another server</a>
                </Button>
              </div>
            </>
          )}
        </PanelContent>
    </Panel>
  );
}
