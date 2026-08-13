"use client";

import Image from "next/image";
import { useState } from "react";
import { PlusIcon, UsersIcon } from "@phosphor-icons/react";
import type { Region } from "@unicum.gg/wargaming";
import { reserveIconUrl } from "@unicum.gg/shared";
import { RelativeTime } from "@/components/relative-time";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useBoostConsole } from "@/hooks/use-boost-console";
import { BoostConsolePreview } from "@/components/clans/detail/boost-console-preview";
import { WorkflowCard } from "@/components/clans/detail/boost-workflow-card";
import { ClanBoostDiscord } from "@/components/clans/detail/boost-discord";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
  PanelTitle,
} from "@/components/panel";
import { Button } from "@/components/ui/button";

/**
 * Officer-only console: the clan's Stronghold boost workflows. A clan can have
 * several (weekday XP boosts, weekend credits…), each its own panel. Self-hides
 * unless the logged-in user is an officer of THIS clan; visitors see a teaser.
 * Follows the clan-tab panel grammar (tagged headers, diagonal separators).
 */
export function ClanBoostConsole({
  region,
  tag,
  clanId,
}: {
  region: Region;
  tag: string;
  clanId: number;
}) {
  const { data, mutate } = useBoostConsole(region, tag);
  const [drafts, setDrafts] = useState<number[]>([]);

  // Show the teaser straight away rather than an empty tab: almost nobody
  // landing here is an officer of this clan, and the teaser is what they came
  // for. Only its closing call to action waits for `data`, since that is the
  // one part that depends on who is watching.
  if (!data)
    return <BoostConsolePreview region={region} tag={tag} />;
  const manageable =
    data.canManage === true && data.clanId === clanId ? data : null;
  if (!manageable) {
    return (
      <BoostConsolePreview
        region={region}
        tag={tag}
        loggedOut={data.canManage === false && data.reason === "not_logged_in"}
      />
    );
  }

  const { onlineNow, membersCount, workflows, reserves, activations } =
    manageable;
  const viewerAccountId = manageable.viewerAccountId;
  // Always show at least one workflow form: with nothing saved and no drafts,
  // render a blank starter form (not dismissible) so an officer can fill it in
  // right away instead of facing an empty state.
  const showStarter = workflows.length === 0 && drafts.length === 0;

  return (
    <>
      <PanelSeparator />
      <div className="screen-line-before screen-line-after grid md:grid-cols-2">
      <Panel screenLines={false}>
        <PanelHeader className="flex min-h-14 flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <PanelTitle className="flex items-center gap-2">
            Stronghold boosts
            <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">
              Officer
            </span>
          </PanelTitle>
          <span className="flex items-center gap-1.5 text-sm text-fd-muted-foreground">
            <UsersIcon className="size-4" />
            <span className="font-medium tabular-nums text-fd-foreground">
              {onlineNow}
            </span>
            <span>/ {membersCount} online</span>
          </span>
        </PanelHeader>
        <PanelContent className="flex flex-col items-start gap-4">
          <p className="text-sm text-fd-muted-foreground">
            Each workflow activates its reserves during a time window, once enough
            members are in a live game session. Runs on your account, no need to
            be online. Add as many as you need.
          </p>
          <Button
            variant="secondary"
            onClick={() => setDrafts((d) => [...d, (d[d.length - 1] ?? 0) + 1])}
          >
            <PlusIcon className="size-4" /> Add workflow
          </Button>
        </PanelContent>
      </Panel>
        <ClanBoostDiscord
          region={region}
          tag={tag}
          className="md:border-l-0"
        />
      </div>

      {workflows.map((wf) => (
        <WorkflowCard
          key={wf.id}
          region={region}
          tag={tag}
          reserves={reserves}
          workflow={wf}
          viewerAccountId={viewerAccountId}
          mutate={mutate}
        />
      ))}
      {drafts.map((d) => (
        <WorkflowCard
          key={`draft-${d}`}
          region={region}
          tag={tag}
          reserves={reserves}
          workflow={null}
          viewerAccountId={viewerAccountId}
          mutate={mutate}
          onDiscardDraft={() => setDrafts((list) => list.filter((x) => x !== d))}
        />
      ))}
      {showStarter && (
        <WorkflowCard
          key="starter"
          region={region}
          tag={tag}
          reserves={reserves}
          workflow={null}
          viewerAccountId={viewerAccountId}
          mutate={mutate}
        />
      )}

      {activations.length > 0 && (
        <>
          <PanelSeparator />
          <Panel>
            <PanelHeader>
              <PanelTitle>recent activations</PanelTitle>
            </PanelHeader>
            <PanelContent className="p-0">
              <Table className="my-0! border-t border-fd-border [&_tbody_td:first-child]:pl-4! [&_tbody_td:last-child]:pr-4! [&_thead_th:first-child]:pl-4! [&_thead_th:last-child]:pr-4!">
                <TableHeader>
                  <TableRow>
                    <TableHead>Reserve</TableHead>
                    <TableHead>Boost</TableHead>
                    <TableHead>Workflow</TableHead>
                    <TableHead className="text-right!">Online</TableHead>
                    <TableHead className="text-right!">When</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activations.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>
                        <span className="flex items-center gap-2">
                          <Image
                            src={reserveIconUrl(a.reserveType)}
                            alt=""
                            width={24}
                            height={24}
                            className="size-6 shrink-0"
                          />
                          <span className="font-medium">{a.reserveName}</span>
                          <span className="text-fd-muted-foreground">
                            L{a.reserveLevel}
                          </span>
                        </span>
                      </TableCell>
                      <TableCell className="tabular-nums text-brand">
                        {a.percent != null ? `+${a.percent}%` : "—"}
                      </TableCell>
                      <TableCell className="text-fd-muted-foreground">
                        {a.workflowName || "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {a.onlineCount}
                      </TableCell>
                      <TableCell className="text-right text-xs text-fd-muted-foreground">
                        <RelativeTime date={new Date(a.activatedAt)} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </PanelContent>
          </Panel>
        </>
      )}
    </>
  );
}
