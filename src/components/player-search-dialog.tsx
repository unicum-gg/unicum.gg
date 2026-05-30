"use client";

import {
  SearchDialog,
  SearchDialogClose,
  SearchDialogContent,
  SearchDialogHeader,
  SearchDialogIcon,
  SearchDialogInput,
  SearchDialogOverlay,
  type SharedProps,
} from "fumadocs-ui/components/dialog/search";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { REGIONS, type Region } from "@/services/wargaming/wot";

export default function PlayerSearchDialog(props: SharedProps) {
  const router = useRouter();
  const [region, setRegion] = useState<Region>("eu");
  const [nickname, setNickname] = useState("");

  function submit() {
    const trimmed = nickname.trim();
    if (!trimmed) return;
    props.onOpenChange?.(false);
    setNickname("");
    router.push(`/${region}/players/${encodeURIComponent(trimmed)}`);
  }

  return (
    <SearchDialog
      search={nickname}
      onSearchChange={setNickname}
      {...props}
    >
      <SearchDialogOverlay />
      <SearchDialogContent>
        <SearchDialogHeader>
          <SearchDialogIcon />
          <SearchDialogInput
            placeholder="Player nickname"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
          />
          <SearchDialogClose />
        </SearchDialogHeader>
        <div className="flex items-center gap-2 border-t border-fd-border px-3 py-2 text-xs">
          <span className="text-fd-muted-foreground">Region:</span>
          {REGIONS.map((r) => (
            <button
              type="button"
              key={r}
              onClick={() => setRegion(r)}
              className={cn(
                "rounded px-2 py-1 font-medium uppercase",
                r === region
                  ? "bg-fd-primary text-fd-primary-foreground"
                  : "text-fd-muted-foreground hover:text-fd-foreground",
              )}
            >
              {r}
            </button>
          ))}
          <button
            type="button"
            onClick={submit}
            disabled={!nickname.trim()}
            className={cn(
              "ms-auto rounded bg-fd-primary px-3 py-1 text-xs font-medium text-fd-primary-foreground",
              !nickname.trim() && "opacity-50",
            )}
          >
            Search
          </button>
        </div>
      </SearchDialogContent>
    </SearchDialog>
  );
}
