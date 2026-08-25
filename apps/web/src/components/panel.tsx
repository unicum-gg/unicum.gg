import React from "react";
import { styles } from "@/lib/styles";
import { cn } from "@/lib/utils";

function Panel({
  className,
  screenLines = true,
  ...props
}: React.ComponentProps<"section"> & { screenLines?: boolean }) {
  return (
    <section
      className={cn(
        "border-x border-fd-border",
        screenLines && "screen-line-before screen-line-after",
        className,
      )}
      {...props}
    />
  );
}

function PanelHeader({
  className,
  screenLines = true,
  ...props
}: React.ComponentProps<"div"> & { screenLines?: boolean }) {
  return (
    <div
      className={cn(
        "px-4 py-3",
        screenLines && "screen-line-after",
        className,
      )}
      {...props}
    />
  );
}

function PanelTitle({
  className,
  as: Tag = "h2",
  ...props
}: React.ComponentProps<"h2"> & {
  /** The heading level. A panel is a section of the page, so `h2` is the
   * default; pass `h3` when the panel is itself one entry of a section that
   * already carries an `h2`, so the outline says which section it belongs to. */
  as?: "h2" | "h3" | "h4";
}) {
  return (
    <Tag
      className={cn("text-xl font-semibold", className)}
      {...props}
    />
  );
}

function PanelContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={cn("p-4", className)} {...props} />
  );
}

function PanelSeparator({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative flex h-8 w-full diagonal-pattern",
        styles.borderX,
        className,
      )}
    />
  );
}

export { Panel, PanelContent, PanelHeader, PanelSeparator, PanelTitle };