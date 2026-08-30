import { Plus, Target, Trash2 } from "lucide-react"
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
import { useCreateGoal, useDeleteGoal, useGoals, useUpdateGoal } from "@/hooks/useGoals"
import { useMe } from "@/hooks/useAuth"
import { formatDate, formatMoney } from "@/lib/format"

export function GoalsPage() {
  const { data: user } = useMe()
  const { data: goals = [], isLoading } = useGoals()
  const deleteGoal = useDeleteGoal()
  const updateGoal = useUpdateGoal()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [contributionDraft, setContributionDraft] = useState<Record<number, string>>({})

  async function handleDelete(id: number) {
    try {
      await deleteGoal.mutateAsync(id)
      toast.success("Цель удалена")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось удалить цель")
    }
  }

  async function handleAddContribution(id: number, currentAmount: number) {
    const raw = contributionDraft[id]
    const value = Number(raw)
    if (!raw || Number.isNaN(value) || value <= 0) return
    await updateGoal.mutateAsync({ id, current_amount: currentAmount + value })
    setContributionDraft((d) => ({ ...d, [id]: "" }))
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

                <div className="mt-4 flex gap-2">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Пополнить на…"
                    className="h-8"
                    value={contributionDraft[goal.id] ?? ""}
                    onChange={(e) => setContributionDraft((d) => ({ ...d, [goal.id]: e.target.value }))}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleAddContribution(goal.id, goal.current_amount)}
                  >
                    Добавить
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
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
          <Label>Срок (необязательно)</Label>
          <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
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
