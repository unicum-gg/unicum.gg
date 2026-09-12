"use client";

import { useFormat } from "@/hooks/use-format";
import { useTranslation } from "@/hooks/use-translation";
import { useLocale } from "@onruntime/translations/react";
import { Interpolate } from "@/components/interpolate";
import { joinNames } from "@/lib/list-format";
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

// A moment rather than a day: this is when the reserve last fired.
const DATE_PATTERN = "d MMM yyyy, HH:mm";

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
  const { t } = useTranslation("components/clans/detail/boost-workflow-card");
  const { date } = useFormat();
  const { locale } = useLocale();
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
      toast.error(t("could-not-save-the-workflow"));
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
      toast.success(t("workflow-removed"));
    } catch {
      toast.error(t("could-not-remove-the-workflow"));
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
      toast.error(t("test-run-failed"));
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
            placeholder={t("workflow-name-e-g-weekday")}
            className="h-8 max-w-xs font-medium"
          />
          <div className="flex items-center gap-2">
            <Switch
              checked={form.enabled}
              onCheckedChange={(v) => patch({ enabled: v })}
              id={`en-${uid}`}
            />
            <Label htmlFor={`en-${uid}`} className="cursor-pointer text-sm">
              {form.enabled ? t("enabled") : t("disabled")}
            </Label>
          </div>
        </PanelHeader>

        <PanelContent className="flex flex-col gap-5">
          <div className="flex flex-wrap items-end gap-5">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-fd-muted-foreground">
                {t("active-days")}</Label>
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
              <Label className="text-xs text-fd-muted-foreground">{t("from")}</Label>
              <Input
                type="time"
                value={form.start}
                onChange={(e) => patch({ start: e.target.value })}
                className="w-28"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-fd-muted-foreground">{t("to")}</Label>
              <Input
                type="time"
                value={form.end}
                onChange={(e) => patch({ end: e.target.value })}
                className="w-28"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-fd-muted-foreground">
                {t("min-online")}</Label>
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
              {t("times-are-in-your-timezone", { tz: tzLabel(tz) })}</p>
            {!windowValid && (
              <p className="text-xs text-red-500">
                {t("the-end-time-must-be")}</p>
            )}
            {!minOnlineValid && (
              <p className="text-xs text-red-500">
                {t("minimum-online-must-be-between")}</p>
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
              {t("schedule-preview")}</Label>
            <BoostSchedulePreview
              windowStart={startMin}
              windowEnd={endMin}
              blockMin={blockMin}
              reserves={scheduleReserves}
            />
            {activeSelected.length > 0 && (
              /* One sentence with the reserves as a hole, and its own key for
                 the plural: a language does not necessarily change the verb
                 where English changes "is" to "are". */
              <p className="text-xs text-fd-muted-foreground">
                {t(
                  activeSelected.length > 1
                    ? "already-running-many"
                    : "already-running-one",
                  {
                    reserves: joinNames(
                      activeSelected.map((r) => r.name),
                      locale,
                    ),
                    start: form.start,
                  },
                )}
              </p>
            )}
          </div>

          {sim && <BoostSimResult sim={sim} />}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-fd-muted-foreground">
              {workflow && (
                <span>
                  <Interpolate
                    template={t("runs-on")}
                    values={{
                      owner: (
                        <span className="font-medium text-fd-foreground">
                          {isOwner
                            ? t("your-account")
                            : workflow.ownerName || t("another-officer")}
                        </span>
                      ),
                    }}
                  />{" "}
                </span>
              )}
              {workflow?.status === "token_expired" && `${t("session-expired")} `}
              {workflow?.lastActivatedAt &&
                `${t("last-activated", {
                  when: date(DATE_PATTERN).format(
                    new Date(workflow.lastActivatedAt),
                  ),
                })} `}
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                onClick={testRun}
                disabled={simming || !formValid}
              >
                {simming ? t("testing") : t("test-run")}
              </Button>
              {(workflow || onDiscardDraft) && (
                <Button variant="ghost" onClick={remove} disabled={saving}>
                  {workflow ? t("delete") : t("discard")}
                </Button>
              )}
              {workflow && !isOwner && (
                <Button
                  variant="secondary"
                  onClick={() => save(true)}
                  disabled={saving || !formValid}
                >
                  {t("run-on-my-account")}</Button>
              )}
              <Button onClick={() => save()} disabled={saving || !formValid}>
                {saving ? t("saving") : t("save")}
              </Button>
            </div>
          </div>
        </PanelContent>
      </Panel>
    </>
  );
}
