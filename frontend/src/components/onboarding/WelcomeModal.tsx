import { LayoutDashboard, Sparkles, Target, Wallet } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { isOnboardingDismissed, setOnboardingDismissed } from "@/lib/onboarding"
import { cn } from "@/lib/utils"

const STEPS = [
  {
    icon: Sparkles,
    title: "Добро пожаловать в Moneo",
    description: "Учёт счетов, транзакций, бюджетов и целей в одном месте. Покажем, с чего начать.",
  },
  {
    icon: Wallet,
    title: "Счета и транзакции",
    description:
      "Заведите счёт (карта, наличные, вклад) в разделе «Счета», а доходы, расходы и переводы добавляйте кнопкой «+» внизу справа.",
  },
  {
    icon: LayoutDashboard,
    title: "Бюджеты и дашборд",
    description: "Задайте лимиты по категориям в разделе «Бюджеты» — дашборд и графики соберутся сами по вашим транзакциям.",
  },
  {
    icon: Target,
    title: "Цели",
    description: "Деньги, отложенные на цель, — виртуальный резерв, счета при этом не трогаются. Готовы начать?",
  },
]

export function WelcomeModal() {
  const [open, setOpen] = useState(() => !isOnboardingDismissed())
  const [step, setStep] = useState(0)
  const [dontShowAgain, setDontShowAgain] = useState(false)

  function close() {
    setOnboardingDismissed(dontShowAgain)
    setOpen(false)
  }

  const current = STEPS[step]
  const isLast = step === STEPS.length - 1

  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <current.icon className="size-5" />
          </div>
          <DialogTitle>{current.title}</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">{current.description}</p>

        <div className="flex justify-center gap-1.5">
          {STEPS.map((s, i) => (
            <span key={s.title} className={cn("h-1.5 w-1.5 rounded-full", i === step ? "bg-primary" : "bg-muted")} />
          ))}
        </div>

        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            className="size-3.5 rounded border-border accent-primary"
            checked={dontShowAgain}
            onChange={(e) => setDontShowAgain(e.target.checked)}
          />
          Больше не показывать
        </label>

        <div className="flex gap-2">
          {step > 0 && (
            <Button type="button" variant="outline" className="flex-1" onClick={() => setStep((s) => s - 1)}>
              Назад
            </Button>
          )}
          <Button type="button" className="flex-1" onClick={() => (isLast ? close() : setStep((s) => s + 1))}>
            {isLast ? "Начать" : "Далее"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
