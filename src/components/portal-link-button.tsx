"use client"

import { ArrowSquareOutIcon } from "@phosphor-icons/react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export function PortalLinkButton({ href }: { href: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open on WoT portal"
            className="inline-flex cursor-pointer items-center justify-center rounded-md border border-fd-border bg-fd-secondary/30 p-1.5 text-fd-muted-foreground hover:bg-fd-secondary hover:text-fd-foreground"
          >
            <ArrowSquareOutIcon className="size-3.5" weight="bold" />
          </a>
        </TooltipTrigger>
        <TooltipContent>Open on WoT portal</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
