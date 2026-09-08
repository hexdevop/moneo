import { HelpCircle } from "lucide-react"
import type { ReactNode } from "react"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

export function InfoTooltip({ children }: { children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger
        className="inline-flex shrink-0 text-muted-foreground outline-none hover:text-foreground"
        aria-label="Подробнее"
      >
        <HelpCircle className="size-3.5" />
      </TooltipTrigger>
      <TooltipContent>{children}</TooltipContent>
    </Tooltip>
  )
}
