import { AnimatePresence, motion } from "framer-motion"
import { Plus, Sparkles, Target, Wallet } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { isOnboardingDismissed, setOnboardingDismissed } from "@/lib/onboarding"
import { cn } from "@/lib/utils"

function IntroIllustration() {
  return (
    <div className="flex h-28 items-center justify-center">
      <div className="relative flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
        <motion.span
          className="absolute inset-0 rounded-full bg-primary/20"
          animate={{ scale: [1, 1.5, 1], opacity: [0.6, 0, 0.6] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />
        <Sparkles className="size-7" />
      </div>
    </div>
  )
}

function AccountsIllustration() {
  return (
    <div className="flex h-28 items-center justify-center gap-3">
      <div className="flex h-16 w-20 flex-col justify-between rounded-lg bg-gradient-to-br from-primary/70 to-primary p-2 text-primary-foreground shadow-sm">
        <Wallet className="size-4" />
        <span className="text-[9px] leading-tight font-medium opacity-90">Основная карта</span>
      </div>
      <div className="relative flex h-16 w-28 flex-col justify-center overflow-hidden rounded-lg border border-border bg-card px-2">
        <motion.div
          className="flex items-center justify-between rounded bg-muted px-1.5 py-1 text-[10px]"
          animate={{ opacity: [0, 1, 1, 0], y: [10, 0, 0, -10] }}
          transition={{ duration: 2.6, repeat: Infinity, times: [0, 0.25, 0.8, 1] }}
        >
          <span className="text-muted-foreground">Еда</span>
          <span className="font-medium text-red-400">-45 000</span>
        </motion.div>
        <motion.div
          className="absolute -right-2 -bottom-2 flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow"
          animate={{ scale: [1, 1.15, 1] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        >
          <Plus className="size-3.5" />
        </motion.div>
      </div>
    </div>
  )
}

function BudgetIllustration() {
  return (
    <div className="flex h-28 flex-col justify-center gap-2 px-4">
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>Развлечения</span>
        <span>из 400 000 UZS</span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
        <motion.div
          className="h-full rounded-full"
          animate={{
            width: ["4%", "55%", "85%", "100%"],
            backgroundColor: ["#22c55e", "#22c55e", "#eab308", "#ef4444"],
          }}
          transition={{ duration: 3, repeat: Infinity, repeatDelay: 0.6, times: [0, 0.4, 0.75, 1] }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span className="text-green-500">● до 70%</span>
        <span className="text-yellow-500">● до 100%</span>
        <span className="text-red-500">● больше</span>
      </div>
    </div>
  )
}

function GoalIllustration() {
  const radius = 26
  const circumference = 2 * Math.PI * radius
  return (
    <div className="relative flex h-28 items-center justify-center">
      <svg width="72" height="72" viewBox="0 0 72 72" className="-rotate-90">
        <circle cx="36" cy="36" r={radius} fill="none" strokeWidth="6" className="stroke-muted" />
        <motion.circle
          cx="36"
          cy="36"
          r={radius}
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          className="stroke-primary"
          strokeDasharray={circumference}
          animate={{ strokeDashoffset: [circumference, circumference * 0.35] }}
          transition={{ duration: 2.2, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }}
        />
      </svg>
      <Target className="absolute size-5 text-primary" />
    </div>
  )
}

const STEPS = [
  {
    Illustration: IntroIllustration,
    title: "Добро пожаловать в Moneo",
    description: "Учёт счетов, транзакций, бюджетов и целей в одном месте. Покажем, с чего начать.",
  },
  {
    Illustration: AccountsIllustration,
    title: "Счета и транзакции",
    description:
      "Заведите счёт (карта, наличные, вклад) в разделе «Счета», а доходы, расходы и переводы добавляйте кнопкой «+» внизу справа.",
  },
  {
    Illustration: BudgetIllustration,
    title: "Бюджеты и дашборд",
    description: "Задайте лимиты по категориям в разделе «Бюджеты» — дашборд и графики соберутся сами по вашим транзакциям.",
  },
  {
    Illustration: GoalIllustration,
    title: "Цели",
    description: "Деньги, отложенные на цель, — виртуальный резерв, счета при этом не трогаются. Готовы начать?",
  },
]

const slideVariants = {
  enter: (direction: number) => ({ x: direction > 0 ? 32 : -32, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({ x: direction > 0 ? -32 : 32, opacity: 0 }),
}

export function WelcomeModal() {
  const [open, setOpen] = useState(() => !isOnboardingDismissed())
  const [step, setStep] = useState(0)
  const [direction, setDirection] = useState(1)
  const [dontShowAgain, setDontShowAgain] = useState(false)

  function close() {
    setOnboardingDismissed(dontShowAgain)
    setOpen(false)
  }

  function goTo(next: number) {
    setDirection(next > step ? 1 : -1)
    setStep(next)
  }

  const current = STEPS[step]
  const isLast = step === STEPS.length - 1

  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent className="overflow-hidden sm:max-w-sm">
        <AnimatePresence mode="wait" custom={direction} initial={false}>
          <motion.div
            key={step}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <current.Illustration />
            <DialogHeader>
              <DialogTitle>{current.title}</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">{current.description}</p>
          </motion.div>
        </AnimatePresence>

        <div className="flex justify-center gap-1.5">
          {STEPS.map((s, i) => (
            <button
              key={s.title}
              type="button"
              aria-label={`Шаг ${i + 1}`}
              onClick={() => goTo(i)}
              className="p-1"
            >
              <span className={cn("block h-1.5 w-1.5 rounded-full transition-colors", i === step ? "bg-primary" : "bg-muted")} />
            </button>
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
            <Button type="button" variant="outline" className="flex-1" onClick={() => goTo(step - 1)}>
              Назад
            </Button>
          )}
          <Button type="button" className="flex-1" onClick={() => (isLast ? close() : goTo(step + 1))}>
            {isLast ? "Начать" : "Далее"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
