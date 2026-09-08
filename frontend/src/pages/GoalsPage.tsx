import { Minus, PiggyBank, Plus, Target, Trash2 } from "lucide-react"
import { useState } from "react"
import type { FormEvent } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { WheelDatePicker } from "@/components/WheelDatePicker"
import { useCreateGoal, useDeleteGoal, useGoals, useUpdateGoal } from "@/hooks/useGoals"
import { useMe } from "@/hooks/useAuth"
import { formatDate, formatMoney, toLocalISODate } from "@/lib/format"
import type { Goal } from "@/types"

export function GoalsPage() {
  const { data: user } = useMe()
  const { data: goals = [], isLoading } = useGoals()
  const deleteGoal = useDeleteGoal()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [contributingGoalId, setContributingGoalId] = useState<number | null>(null)
  const contributingGoal = goals.find((g) => g.id === contributingGoalId) ?? null

  async function handleDelete(id: number) {
    try {
      await deleteGoal.mutateAsync(id)
      toast.success("Цель перемещена в корзину")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось удалить цель")
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Финансовые цели</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger render={<Button size="sm" className="gap-1.5" />}>
            <Plus className="size-4" />
            Новая цель
          </DialogTrigger>
          <GoalFormDialog defaultCurrency={user?.base_currency ?? "USD"} onDone={() => setDialogOpen(false)} />
        </Dialog>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Загрузка…</p>
      ) : goals.length === 0 ? (
        <p className="text-sm text-muted-foreground">Пока нет целей. Создайте первую.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {goals.map((goal) => (
            <Card key={goal.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Target className="size-4" />
                    </div>
                    <span className="font-medium">{goal.name}</span>
                  </div>
                  <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(goal.id)} aria-label="Удалить">
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>

                <div className="mt-4 space-y-1.5">
                  <Progress value={Math.min(goal.progress * 100, 100)} />
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{formatMoney(goal.current_amount, goal.currency)}</span>
                    <span className="text-muted-foreground">из {formatMoney(goal.target_amount, goal.currency)}</span>
                  </div>
                </div>

                {goal.deadline && (
                  <p className="mt-2 text-xs text-muted-foreground">Срок: {formatDate(goal.deadline)}</p>
                )}
                {goal.recommended_monthly_contribution != null && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Рекомендуемый взнос в месяц: {formatMoney(goal.recommended_monthly_contribution, goal.currency)}
                  </p>
                )}

                <Button
                  size="sm"
                  variant="outline"
                  className="mt-4 w-full gap-1.5"
                  onClick={() => setContributingGoalId(goal.id)}
                >
                  <PiggyBank className="size-3.5" />
                  Пополнить / снять
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!contributingGoal} onOpenChange={(open) => !open && setContributingGoalId(null)}>
        {contributingGoal && <GoalContributionDialog goal={contributingGoal} />}
      </Dialog>
    </div>
  )
}

function GoalContributionDialog({ goal }: { goal: Goal }) {
  const updateGoal = useUpdateGoal()
  const [amount, setAmount] = useState("")

  async function handleContribute(sign: 1 | -1) {
    const value = Number(amount)
    if (!amount || Number.isNaN(value) || value <= 0) return
    const next = Math.max(goal.current_amount + sign * value, 0)
    try {
      await updateGoal.mutateAsync({ id: goal.id, current_amount: next })
      toast.success(sign > 0 ? "Цель пополнена" : "Сумма списана с цели")
      setAmount("")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось изменить сумму")
    }
  }

  return (
    <DialogContent className="sm:max-w-xs">
      <DialogHeader>
        <DialogTitle>{goal.name}</DialogTitle>
      </DialogHeader>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Progress value={Math.min(goal.progress * 100, 100)} />
          <div className="flex justify-between text-sm">
            <span className="font-medium">{formatMoney(goal.current_amount, goal.currency)}</span>
            <span className="text-muted-foreground">из {formatMoney(goal.target_amount, goal.currency)}</span>
          </div>
        </div>

        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault()
            handleContribute(1)
          }}
          className="space-y-3"
        >
          <div className="space-y-1.5">
            <Label htmlFor="goal-amount">Сумма</Label>
            <Input
              id="goal-amount"
              type="number"
              min="0"
              step="0.01"
              autoFocus
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1 gap-1.5"
              disabled={updateGoal.isPending || goal.current_amount <= 0}
              onClick={() => handleContribute(-1)}
            >
              <Minus className="size-3.5" />
              Снять
            </Button>
            <Button type="submit" className="flex-1 gap-1.5" disabled={updateGoal.isPending}>
              <Plus className="size-3.5" />
              Пополнить
            </Button>
          </div>
        </form>

        <p className="text-xs text-muted-foreground">
          Деньги на цели — виртуальный резерв: они не списываются со счетов, а лишь откладываются
          «в уме». Общий баланс не меняется, но на дашборде и в счетах видно, сколько остаётся
          свободным без учёта отложенного на цели.
        </p>
      </div>
    </DialogContent>
  )
}

function GoalFormDialog({ defaultCurrency, onDone }: { defaultCurrency: string; onDone: () => void }) {
  const createGoal = useCreateGoal()
  const [name, setName] = useState("")
  const [targetAmount, setTargetAmount] = useState("")
  const [currency, setCurrency] = useState(defaultCurrency)
  const [deadline, setDeadline] = useState("")

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name || !targetAmount) return
    try {
      await createGoal.mutateAsync({
        name,
        target_amount: Number(targetAmount),
        currency: currency.toUpperCase(),
        deadline: deadline || null,
      })
      toast.success("Цель создана")
      onDone()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось создать цель")
    }
  }

  return (
    <DialogContent className="sm:max-w-sm">
      <DialogHeader>
        <DialogTitle>Новая цель</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label>Название</Label>
          <Input required autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Сумма</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              required
              value={targetAmount}
              onChange={(e) => setTargetAmount(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Валюта</Label>
            <Input required maxLength={3} value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} />
          </div>
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label>Срок (необязательно)</Label>
            {deadline && (
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setDeadline("")}
              >
                Убрать срок
              </button>
            )}
          </div>
          {deadline ? (
            <WheelDatePicker value={deadline} onChange={setDeadline} />
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDeadline(toLocalISODate(new Date()))}
            >
              Указать срок
            </Button>
          )}
        </div>
        <DialogFooter>
          <Button type="submit" className="w-full" disabled={createGoal.isPending}>
            Создать
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}
