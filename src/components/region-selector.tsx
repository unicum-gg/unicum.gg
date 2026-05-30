"use client";

import { useLocalStorage } from "usehooks-ts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  isRegion,
  REGION_EMOJI,
  REGION_LABEL,
  REGIONS,
  Region,
} from "@/services/wargaming/wot";

const STORAGE_KEY = "unicum.region";
const DEFAULT_REGION: Region = Region.EU;

export function RegionSelector() {
  const [stored, setStored] = useLocalStorage<string>(
    STORAGE_KEY,
    DEFAULT_REGION,
  );
  const region: Region = isRegion(stored) ? stored : DEFAULT_REGION;

  return (
    <Select
      value={region}
      onValueChange={(v) => {
        if (isRegion(v)) setStored(v);
      }}
    >
      <SelectTrigger
        size="sm"
        aria-label="Region"
        className="h-8 w-fit gap-1.5 rounded-full border-fd-border bg-fd-secondary/50 px-2.5 text-xs font-medium uppercase"
      >
        <SelectValue>
          <RegionItem region={region} />
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {REGIONS.map((r) => (
          <SelectItem key={r} value={r}>
            <RegionItem region={r} />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function RegionItem({ region }: { region: Region }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span aria-hidden className="text-base leading-none">
        {REGION_EMOJI[region]}
      </span>
      {REGION_LABEL[region]}
    </span>
  );
}
