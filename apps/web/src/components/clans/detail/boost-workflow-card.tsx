"use client";

import { useId, useState } from "react";
import { toast } from "sonner";
import type { KeyedMutator } from "swr";
import type { Region } from "@unicum.gg/wargaming";
import {
  boostConsoleKey,
  type BoostConsoleData,
  type ReserveOption,
  type WorkflowRow,
} from "@/hooks/use-boost-console";
import { BoostSchedulePreview } from "@/components/clans/detail/boost-schedule";
import { BoostReservesPicker } from "@/components/clans/detail/boost-reserves-picker";
import {
  BoostSimResult,
  type SimResult,
} from "@/components/clans/detail/boost-sim-result";
import {
  DAY_LABELS,
  browserTz,
  fromHHMM,
  toHHMM,
  tzLabel,
} from "@/components/clans/detail/boost-time";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
} from "@/components/panel";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Form = {
  name: string;
  enabled: boolean;
  days: number;
  start: string;
  end: string;
  minOnline: number;
  picked: Record<string, number>;
};

const draftForm = (): Form => ({
  name: "",
  enabled: true,
  days: 127,
  start: "18:00",
  end: "22:00",
  minOnline: 10,
  picked: {},
});

const formFrom = (wf: WorkflowRow): Form => ({
  name: wf.name,
  enabled: wf.enabled,
  days: wf.days,
  start: toHHMM(wf.windowStart),
  end: toHHMM(wf.windowEnd),
  minOnline: wf.minOnline,
  picked: Object.fromEntries(wf.reserves.map((r) => [r.type, r.level])),
});

export function WorkflowCard({
  region,
  tag,
  reserves,
  workflow,
  viewerAccountId,
  mutate,
  onDiscardDraft,
}: {
  region: Region;
  tag: string;
  reserves: ReserveOption[];
  workflow: WorkflowRow | null;
  viewerAccountId: number;
  mutate: KeyedMutator<BoostConsoleData>;
  onDiscardDraft?: () => void;
}) {
  const [form, setForm] = useState<Form>(() =>
    workflow ? formFrom(workflow) : draftForm(),
  );
  const [saving, setSaving] = useState(false);
  const [simming, setSimming] = useState(false);
  const [sim, setSim] = useState<SimResult | null>(null);
  const uid = useId();
  const tz = workflow?.timezone ?? browserTz();
  const patch = (values: Partial<Form>) => setForm((f) => ({ ...f, ...values }));
  // A new/draft card is owned by the viewer on save; a saved one by whoever's
  // token runs it. Only that owner can't be someone else without a takeover.
  const isOwner = !workflow || workflow.ownerAccountId === viewerAccountId;

  // A window can't cross midnight (the server rejects To ≤ From too); surface it
  // in the form so the officer isn't left with a generic save error.
  const startMin = fromHHMM(form.start);
  const endMin = fromHHMM(form.end);
  const windowValid = endMin > startMin;
  const minOnlineValid =
    Number.isFinite(form.minOnline) &&
    form.minOnline >= 1 &&
    form.minOnline <= 100;
  const formValid = windowValid && minOnlineValid;

  // Live schedule forecast from the current selection.
  const picked = reserves.filter((r) => r.type in form.picked);
  const blockMin = picked.length
    ? Math.max(...picked.map((r) => Math.round(r.durationSec / 60)))
    : 120;
  const scheduleReserves = picked.map((r) => ({
    type: r.type,
    name: r.name,
    percent:
      r.levels.find((l) => l.level === form.picked[r.type])?.percent ?? null,
  }));
  const activeSelected = picked.filter((r) => r.activeUntil);

  const key = boostConsoleKey(region, tag);
  const body = () => ({
    name: form.name,
    enabled: form.enabled,
    timezone: tz,
    days: form.days,
    windowStart: startMin,
    windowEnd: endMin,
    minOnline: form.minOnline,
    reserves: Object.entries(form.picked).map(([type, level]) => ({
      type,
      level,
    })),
  });

  async function save(claim = false) {
    setSaving(true);
    try {
      const res = await fetch(key, {
        method: workflow ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          workflow ? { id: workflow.id, claim, ...body() } : body(),
        ),
      });
      if (!res.ok) throw new Error(String(res.status));
      await mutate();
      onDiscardDraft?.();
      toast.success(claim ? "Now running on your account" : "Workflow saved");
    } catch {
      toast.error("Could not save the workflow");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!workflow) {
      onDiscardDraft?.();
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${key}?id=${workflow.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(String(res.status));
      await mutate();
      toast.success("Workflow removed");
    } catch {
      toast.error("Could not remove the workflow");
    } finally {
      setSaving(false);
    }
  }

  async function testRun() {
    setSimming(true);
    try {
      const res = await fetch(`${key}/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body()),
      });
      if (!res.ok) throw new Error(String(res.status));
      setSim(await res.json());
    } catch {
      toast.error("Test run failed");
    } finally {
      setSimming(false);
    }
  }

  return (
    <>
      <PanelSeparator />
      <Panel>
        <PanelHeader className="flex flex-wrap items-center justify-between gap-3">
          <Input
            value={form.name}
            onChange={(e) => patch({ name: e.target.value })}
            placeholder="Workflow name (e.g. Weekday evenings)"
            className="h-8 max-w-xs font-medium"
          />
          <div className="flex items-center gap-2">
            <Switch
              checked={form.enabled}
              onCheckedChange={(v) => patch({ enabled: v })}
              id={`en-${uid}`}
            />
            <Label htmlFor={`en-${uid}`} className="cursor-pointer text-sm">
              {form.enabled ? "Enabled" : "Disabled"}
            </Label>
          </div>
        </PanelHeader>

        <PanelContent className="flex flex-col gap-5">
          <div className="flex flex-wrap items-end gap-5">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-fd-muted-foreground">
                Active days
              </Label>
              <div className="flex gap-1">
                {DAY_LABELS.map((d, i) => {
                  const on = (form.days & (1 << i)) !== 0;
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => patch({ days: form.days ^ (1 << i) })}
                      className={
                        on
                          ? "size-8 rounded-md bg-brand text-xs font-semibold text-white"
                          : "size-8 rounded-md border border-fd-border text-xs font-medium text-fd-muted-foreground hover:bg-fd-accent"
                      }
                    >
                      {d[0]}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-fd-muted-foreground">From</Label>
              <Input
                type="time"
                value={form.start}
                onChange={(e) => patch({ start: e.target.value })}
                className="w-28"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-fd-muted-foreground">To</Label>
              <Input
                type="time"
                value={form.end}
                onChange={(e) => patch({ end: e.target.value })}
                className="w-28"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-fd-muted-foreground">
                Min online
              </Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={form.minOnline}
                onChange={(e) => patch({ minOnline: Number(e.target.value) })}
                className="w-20"
              />
            </div>
          </div>

          <div className="-mt-2 flex flex-col gap-1">
            <p className="text-xs text-fd-muted-foreground">
              Times are in {tzLabel(tz)}, your timezone.
            </p>
            {!windowValid && (
              <p className="text-xs text-red-500">
                The end time must be after the start time. A window cannot run
                past midnight.
              </p>
            )}
            {!minOnlineValid && (
              <p className="text-xs text-red-500">
                Minimum online must be between 1 and 100.
              </p>
            )}
          </div>

          <BoostReservesPicker
            reserves={reserves}
            picked={form.picked}
            tz={tz}
            uid={uid}
            onChange={(next) => patch({ picked: next })}
          />

          <div className="flex flex-col gap-2">
            <Label className="text-xs text-fd-muted-foreground">
              Schedule preview
            </Label>
            <BoostSchedulePreview
              windowStart={startMin}
              windowEnd={endMin}
              blockMin={blockMin}
              reserves={scheduleReserves}
            />
            {activeSelected.length > 0 && (
              <p className="text-xs text-fd-muted-foreground">
                {activeSelected.map((r) => r.name).join(", ")}{" "}
                {activeSelected.length > 1 ? "are" : "is"} already running. The
                workflow never stacks, it waits for that to expire, then
                re-activates if you are still in the window (so it starts later
                than {form.start} today).
              </p>
            )}
          </div>

          {sim && <BoostSimResult sim={sim} />}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-fd-muted-foreground">
              {workflow && (
                <span>
                  Runs on{" "}
                  <span className="font-medium text-fd-foreground">
                    {isOwner
                      ? "your account"
                      : workflow.ownerName || "another officer"}
                  </span>
                  .{" "}
                </span>
              )}
              {workflow?.status === "token_expired" &&
                "That Wargaming session expired, it needs a fresh login to keep running. "}
              {workflow?.lastActivatedAt &&
                `Last activated ${new Date(workflow.lastActivatedAt).toLocaleString()}.`}
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                onClick={testRun}
                disabled={simming || !formValid}
              >
                {simming ? "Testing…" : "Test run"}
              </Button>
              {(workflow || onDiscardDraft) && (
                <Button variant="ghost" onClick={remove} disabled={saving}>
                  {workflow ? "Delete" : "Discard"}
                </Button>
              )}
              {workflow && !isOwner && (
                <Button
                  variant="secondary"
                  onClick={() => save(true)}
                  disabled={saving || !formValid}
                >
                  Run on my account
                </Button>
              )}
              <Button onClick={() => save()} disabled={saving || !formValid}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        </PanelContent>
      </Panel>
    </>
  );
}
