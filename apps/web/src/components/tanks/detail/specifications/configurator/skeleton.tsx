import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
  PanelTitle,
} from "@/components/panel";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { TankCharacteristics } from "@/components/tanks/detail/specifications/characteristics";

/** A rounded slot/device box placeholder (size-14 by default, like the real
 * ammo / equipment / consumable / directive tiles). */
function Box({ className }: { className?: string }) {
  return <Skeleton className={cn("size-14 rounded-lg", className)} />;
}

/** One configurator editor panel: a bordered header (static title) over its
 * content, matching `<Tank* screenLines={false} headerBorder />`. */
function EditorPanel({
  title,
  contentClassName,
  headerRight,
  children,
}: {
  title: string;
  contentClassName: string;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Panel screenLines={false}>
      <PanelHeader
        screenLines={false}
        className="flex items-center justify-between gap-4 border-b border-fd-border"
      >
        <PanelTitle>{title}</PanelTitle>
        {headerRight}
      </PanelHeader>
      <PanelContent className={contentClassName}>{children}</PanelContent>
    </Panel>
  );
}

/** A labelled tile column: a box over a small caption, like the ammo shells
 * (short name + stats) or an equipment slot (box + category glyphs). */
function LabeledTile() {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <Box />
      <div className="flex flex-col items-center gap-0.5">
        <Skeleton className="h-3.5 w-8" />
        <Skeleton className="h-2.5 w-16" />
      </div>
    </div>
  );
}

function AmmoSkeleton() {
  return (
    <EditorPanel title="Ammunition" contentClassName="px-4 py-6">
      <div className="flex flex-wrap gap-3">
        {Array.from({ length: 4 }, (_, i) => (
          <LabeledTile key={i} />
        ))}
      </div>
    </EditorPanel>
  );
}

function BoxRow({ count }: { count: number }) {
  return (
    <div className="flex flex-wrap gap-3">
      {Array.from({ length: count }, (_, i) => (
        <Box key={i} />
      ))}
    </div>
  );
}

function Divider() {
  return <div className="-mx-4 border-t border-fd-border" />;
}

function EquipmentSkeleton() {
  return (
    <EditorPanel title="Equipment" contentClassName="space-y-5 px-4 py-6">
      {/* Slot row: a box over its category glyphs. */}
      <div className="flex flex-wrap gap-3">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="flex flex-col items-center gap-1.5">
            <Box />
            <div className="flex gap-1">
              <Skeleton className="size-5 rounded" />
              <Skeleton className="size-5 rounded" />
            </div>
          </div>
        ))}
      </div>
      <Divider />
      <BoxRow count={14} />
      <Divider />
      <BoxRow count={3} />
    </EditorPanel>
  );
}

function ConsumablesSkeleton() {
  return (
    <EditorPanel title="Consumables" contentClassName="space-y-5 px-4 py-6">
      <BoxRow count={3} />
      <Divider />
      <BoxRow count={7} />
    </EditorPanel>
  );
}

function DirectivesSkeleton() {
  return (
    <EditorPanel title="Directives" contentClassName="px-4 py-6">
      <BoxRow count={13} />
    </EditorPanel>
  );
}

function FieldModsSkeleton() {
  return (
    <EditorPanel
      title="Field Modifications"
      contentClassName="overflow-x-auto px-4 py-6"
    >
      <div className="relative flex items-start gap-6">
        <div className="absolute top-6 right-2 left-2 border-t border-fd-border" />
        {Array.from({ length: 5 }, (_, i) => (
          <div
            key={i}
            className="relative flex min-w-14 flex-col items-center gap-3"
          >
            <Skeleton className="size-12 rounded-lg" />
            <div className="flex flex-col gap-2">
              <Skeleton className="size-12 rounded-lg" />
              <Skeleton className="size-12 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </EditorPanel>
  );
}

function CrewSkeleton() {
  // Skill counts per member — the commander carries the most, matching the
  // real crew grid's tallest column.
  const members = [12, 10, 9, 9, 8];
  return (
    <EditorPanel
      title="Crew Skills"
      contentClassName="space-y-5 px-4 py-6"
      headerRight={
        <div className="flex items-center gap-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-8" />
        </div>
      }
    >
      {members.map((skills, m) => (
        <div key={m} className="space-y-2">
          <div className="flex items-center gap-2.5">
            <Skeleton className="size-11 rounded-md" />
            <Skeleton className="h-3 w-40 max-w-full" />
          </div>
          {/* The real crew grid wraps each member's skills over a couple of
              rows (common + role skills); two rows lands the tallest column. */}
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: skills }, (_, i) => (
                <Skeleton key={i} className="size-11 rounded-lg" />
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: Math.max(3, skills - 4) }, (_, i) => (
                <Skeleton key={i} className="size-11 rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      ))}
    </EditorPanel>
  );
}

/** One module / research node card: an icon over tier + name + cost lines. */
function ModuleNode() {
  return (
    <div className="flex w-24 shrink-0 flex-col items-center gap-1.5 p-1">
      <div className="flex h-7 w-full items-center justify-center">
        <Skeleton className="h-6 w-10" />
      </div>
      <Skeleton className="h-2.5 w-6" />
      <Skeleton className="h-3 w-16" />
      <Skeleton className="h-2.5 w-12" />
    </div>
  );
}

function ModulesSkeleton() {
  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>
          <span className="flex h-7 items-center">
            <Skeleton className="h-4 w-28" />
          </span>
        </PanelTitle>
      </PanelHeader>
      <PanelContent className="py-6">
        <div className="overflow-hidden px-4">
          <div className="flex flex-col gap-6">
            {Array.from({ length: 5 }, (_, row) => (
              <div key={row} className="flex gap-10">
                {Array.from({ length: 4 }, (_, col) => (
                  <ModuleNode key={col} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </PanelContent>
    </Panel>
  );
}

/**
 * The loading twin of TankConfigurator. It can't reuse the real (stateful,
 * hook-heavy) component, so it mirrors its layout section by section: the
 * characteristics table (its own `loading` twin, zero drift), the two-column
 * editor block (ammunition / equipment / consumables / directives / field mods
 * on the left, crew on the right), and the modules tech-tree rail. Each section
 * reuses the real panel structure + tile dimensions so heights line up.
 * Rendered by `<TankConfigurator loading />`.
 */
export function TankConfiguratorSkeleton() {
  return (
    <>
      <TankCharacteristics loading />

      <PanelSeparator />
      <div className="screen-line-before screen-line-after grid grid-cols-2 items-stretch">
        <div className="flex flex-col">
          <div className="flex flex-col divide-y divide-fd-border">
            <AmmoSkeleton />
            <EquipmentSkeleton />
            <ConsumablesSkeleton />
            <DirectivesSkeleton />
            <FieldModsSkeleton />
          </div>
          <div aria-hidden className="flex-1 border-x border-fd-border" />
        </div>
        <div className="flex flex-col">
          <div className="flex flex-col divide-y divide-fd-border">
            <CrewSkeleton />
          </div>
          <div aria-hidden className="flex-1 border-x border-fd-border" />
        </div>
      </div>

      <PanelSeparator />
      <ModulesSkeleton />
    </>
  );
}
