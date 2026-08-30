import { ChevronLeft, ChevronRight, CopyPlus, Plus, Trash2 } from "lucide-react"
import { useMemo, useState } from "react"
import type { FormEvent } from "react"
import { toast } from "sonner"

import { CategoryIcon } from "@/components/CategoryIcon"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useCategories } from "@/hooks/useCategories"
import {
  useBudgets,
  useCopyBudgetsToNextMonth,
  useCreateBudget,
  useDeleteBudget,
} from "@/hooks/useBudgets"
import { useMe } from "@/hooks/useAuth"
import { formatMonth, formatMoney, toLocalISODate } from "@/lib/format"

const STATUS_COLOR: Record<string, string> = {
  green: "bg-green-500",
  yellow: "bg-yellow-500",
  red: "bg-red-500",
}

function monthToISO(year: number, month: number) {
  return toLocalISODate(new Date(year, month, 1))
}

export function BudgetsPage() {
  const now = new Date()
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() })
  const month = monthToISO(cursor.year, cursor.month)
  const { data: user } = useMe()
  const { data: budgets = [], isLoading } = useBudgets(month)
  const { data: categories = [] } = useCategories("expense")
  const deleteBudget = useDeleteBudget()
  const copyBudgets = useCopyBudgetsToNextMonth()
  const [dialogOpen, setDialogOpen] = useState(false)

  const usedCategoryIds = new Set(budgets.map((b) => b.category_id))
  const availableCategories = categories.filter((c) => !usedCategoryIds.has(c.id))
  const categoryById = new Map(categories.map((c) => [c.id, c]))

  function shiftMonth(delta: number) {
    setCursor((c) => {
      const d = new Date(c.year, c.month + delta, 1)
      return { year: d.getFullYear(), month: d.getMonth() }
    })
  }

  async function handleDelete(id: number) {
    await deleteBudget.mutateAsync(id)
  }

  async function handleCopy() {
    try {
      const created = await copyBudgets.mutateAsync(month)
      toast.success(created.length > 0 ? `Перенесено бюджетов: ${created.length}` : "Нечего переносить")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось перенести бюджеты")
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Бюджеты</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => shiftMonth(-1)} aria-label="Предыдущий месяц">
            <ChevronLeft className="size-4" />
          </Button>
          <span className="w-36 text-center text-sm font-medium">{formatMonth(month)}</span>
          <Button variant="outline" size="icon" onClick={() => shiftMonth(1)} aria-label="Следующий месяц">
            <ChevronRight className="size-4" />
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleCopy} disabled={copyBudgets.isPending}>
            <CopyPlus className="size-4" />
            Перенести на след. месяц
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger
              render={<Button size="sm" className="gap-1.5" disabled={availableCategories.length === 0} />}
            >
              <Plus className="size-4" />
              Новый бюджет
            </DialogTrigger>
            <BudgetFormDialog
              month={month}
              categories={availableCategories}
              defaultCurrency={user?.base_currency ?? "USD"}
              onDone={() => setDialogOpen(false)}
            />
          </Dialog>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Загрузка…</p>
      ) : budgets.length === 0 ? (
        <p className="text-sm text-muted-foreground">На этот месяц бюджеты не заданы — создайте первый, чтобы отслеживать расходы</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {budgets.map((budget) => {
            const category = categoryById.get(budget.category_id)
            return (
              <Card key={budget.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      {category && (
                        <div
                          className="flex size-8 items-center justify-center rounded-full"
                          style={{ backgroundColor: `${category.color}20`, color: category.color }}
                        >
                          <CategoryIcon name={category.icon} className="size-4" />
                        </div>
                      )}
                      <span className="font-medium">{category?.name ?? "Категория"}</span>
                    </div>
                    <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(budget.id)} aria-label="Удалить">
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                  <div className="mt-4 space-y-1.5">
                    <Progress value={Math.min(budget.progress * 100, 100)} indicatorClassName={STATUS_COLOR[budget.status]} />
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{formatMoney(budget.spent, budget.currency)}</span>
                      <span className="text-muted-foreground">из {formatMoney(budget.limit_amount, budget.currency)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

function BudgetFormDialog({
  month,
  categories,
  defaultCurrency,
  onDone,
}: {
  month: string
  categories: { id: number; name: string }[]
  defaultCurrency: string
  onDone: () => void
}) {
  const createBudget = useCreateBudget()
  const [categoryId, setCategoryId] = useState<number | undefined>(categories[0]?.id)
  const [limitAmount, setLimitAmount] = useState("")
  const currency = useMemo(() => defaultCurrency, [defaultCurrency])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!categoryId || !limitAmount) return
    try {
      await createBudget.mutateAsync({
        category_id: categoryId,
        month,
        limit_amount: Number(limitAmount),
        currency,
      })
      toast.success("Бюджет создан")
      setLimitAmount("")
      onDone()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось создать бюджет")
    }
  }

  return (
    <DialogContent className="sm:max-w-sm">
      <DialogHeader>
        <DialogTitle>Новый бюджет</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label>Категория</Label>
          <Select
            items={Object.fromEntries(categories.map((c) => [String(c.id), c.name]))}
            value={categoryId ? String(categoryId) : ""}
            onValueChange={(v) => setCategoryId(Number(v))}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Выберите категорию" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Лимит ({currency})</Label>
          <Input
            type="number"
            min="0"
            step="0.01"
            required
            value={limitAmount}
            onChange={(e) => setLimitAmount(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button type="submit" className="w-full" disabled={createBudget.isPending}>
            Создать
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}
