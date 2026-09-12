"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "@/hooks/use-translation";
import { cn } from "@/lib/utils";
import UMAMI from "@/constants/umami";
import {
  FeedbackTopic,
  MESSAGE_MAX_LENGTH,
  SENTIMENT_EMOJI,
  SENTIMENT_ORDER,
  type FeedbackBody,
  type FeedbackSentiment,
} from "./schema";

const TOPICS = Object.values(FeedbackTopic);

/**
 * Top-bar feedback affordance: a small "Feedback" trigger that opens a popover
 * with a topic selector, a free-text field and an optional sentiment emoji row.
 * On submit it POSTs to `/api/feedback`, which forwards it to our private
 * Discord channel (attaching the sender's WG identity server-side when signed
 * in). Rendered only when the feature is configured (see the top-bar).
 */
export function FeedbackWidget() {
  const { t } = useTranslation("components/feedback/feedback-widget");
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState<FeedbackTopic | "">("");
  const [sentiment, setSentiment] = useState<FeedbackSentiment | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const canSend = !!topic && message.trim().length > 0 && !busy;

  function reset() {
    setTopic("");
    setSentiment(null);
    setMessage("");
  }

  async function submit() {
    if (!topic || !message.trim()) return;
    setBusy(true);
    try {
      const body: FeedbackBody = {
        topic,
        sentiment: sentiment ?? undefined,
        message: message.trim(),
        page: window.location.pathname + window.location.search,
        umamiSessionId: (window as unknown as Record<string, string | undefined>)[
          UMAMI.SESSION_GLOBAL
        ],
      };
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(String(res.status));
      toast.success(t("sent"));
      reset();
      setOpen(false);
    } catch {
      toast.error(t("failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="shrink-0 cursor-pointer font-medium text-fd-muted-foreground transition-colors hover:text-fd-foreground"
        >
          {t("trigger")}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-3">
        <div className="flex flex-col gap-2.5">
          <div className="text-sm font-medium text-fd-foreground">
            {t("title")}
          </div>
          <Select
            value={topic}
            onValueChange={(v) => setTopic(v as FeedbackTopic)}
          >
            <SelectTrigger className="w-full" size="sm">
              <SelectValue placeholder={t("topic-placeholder")} />
            </SelectTrigger>
            <SelectContent>
              {TOPICS.map((option) => (
                <SelectItem key={option} value={option}>
                  {t(`topics.${option}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={MESSAGE_MAX_LENGTH}
            placeholder={t("message-placeholder")}
            className="min-h-24 resize-none text-sm"
          />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              {SENTIMENT_ORDER.map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-label={t(`sentiments.${s}`)}
                  aria-pressed={sentiment === s}
                  onClick={() => setSentiment((cur) => (cur === s ? null : s))}
                  className={cn(
                    "flex size-8 cursor-pointer items-center justify-center rounded-md text-lg transition-all hover:bg-fd-accent",
                    sentiment === s
                      ? "bg-fd-accent ring-2 ring-brand"
                      : "opacity-60 hover:opacity-100",
                  )}
                >
                  {SENTIMENT_EMOJI[s]}
                </button>
              ))}
            </div>
            <Button size="sm" onClick={submit} disabled={!canSend}>
              {busy ? <Spinner className="size-4" /> : t("send")}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
