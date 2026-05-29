"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { REGION_LABEL, REGIONS, type Region } from "@/services/wargaming/wot";

export function PlayerSearch() {
  const router = useRouter();
  const [region, setRegion] = useState<Region>("eu");
  const [nickname, setNickname] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = nickname.trim();
    if (!trimmed) return;
    startTransition(() => {
      router.push(`/${region}/players/${encodeURIComponent(trimmed)}`);
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full max-w-2xl flex-col gap-2 sm:flex-row"
    >
      <Select
        value={region}
        onValueChange={(value) => {
          if (value) setRegion(value as Region);
        }}
      >
        <SelectTrigger className="sm:w-28">
          <SelectValue />
        </SelectTrigger>
        <SelectPopup>
          {REGIONS.map((r) => (
            <SelectItem key={r} value={r}>
              {REGION_LABEL[r]}
            </SelectItem>
          ))}
        </SelectPopup>
      </Select>
      <Input
        type="search"
        name="nickname"
        placeholder="Player nickname"
        value={nickname}
        onValueChange={setNickname}
        autoComplete="off"
        spellCheck={false}
        className="flex-1"
      />
      <Button type="submit" loading={isPending} disabled={!nickname.trim()}>
        Search
      </Button>
    </form>
  );
}
