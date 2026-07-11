"use client"

import {
  ArrowSquareOutIcon,
  BookOpenIcon,
  RankingIcon,
} from "@phosphor-icons/react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

// The phosphor icons must be resolved inside this "use client" component:
// importing them into a server component runs their createContext at module
// load and crashes the RSC render.
const ICONS = {
  external: ArrowSquareOutIcon,
  ranking: RankingIcon,
  tankopedia: BookOpenIcon,
} as const

export function PortalLinkButton({
  href,
  label = "Open on WoT portal",
  icon = "external",
}: {
  href: string
  label?: string
  icon?: keyof typeof ICONS
}) {
  const Icon = ICONS[icon]
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={label}
            className="inline-flex cursor-pointer items-center justify-center rounded-md border border-fd-border bg-fd-secondary/30 p-1.5 text-fd-muted-foreground hover:bg-fd-secondary hover:text-fd-foreground"
          >
            <Icon className="size-3.5" weight="bold" />
          </a>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
