import { Eye, EyeOff } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useHideBalance } from "@/hooks/useHideBalance"

export function HideBalanceToggle({ className }: { className?: string }) {
  const { hidden, toggle, isPending } = useHideBalance()

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={toggle}
      disabled={isPending}
      aria-label={hidden ? "Показать баланс" : "Скрыть баланс"}
      className={className}
    >
      {hidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
    </Button>
  )
}

export const MASKED_BALANCE = "••••••"
