import React from "react";
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
  ...props
}: React.ComponentProps<"h2">) {
  return (
    <h2
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

export { Panel, PanelContent, PanelHeader, PanelTitle };