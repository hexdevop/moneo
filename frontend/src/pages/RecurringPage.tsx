import { Pause, Play, Plus, Repeat, Trash2 } from "lucide-react"
import { useState } from "react"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAccounts } from "@/hooks/useAccounts"
import { useCategories } from "@/hooks/useCategories"
import {
  useCreateRecurring,
  useDeleteRecurring,
  useRecurringPayments,
  useRecurringSummary,
  useUpdateRecurring,
} from "@/hooks/useRecurring"
import { useMe } from "@/hooks/useAuth"
import { formatDate, formatMoney, toLocalISODate } from "@/lib/format"
import type { RecurrenceFrequency } from "@/types"

const FREQUENCY_LABELS: Record<RecurrenceFrequency, string> = {
  weekly: "Еженедельно",
  monthly: "Ежемесячно",
  yearly: "Ежегодно",
}

export function RecurringPage() {
  const { data: user } = useMe()
  const { data: payments = [], isLoading } = useRecurringPayments(true)
  const { data: summary } = useRecurringSummary()
  const updateRecurring = useUpdateRecurring()
  const deleteRecurring = useDeleteRecurring()
  const { data: categories = [] } = useCategories()
  const { data: accounts = [] } = useAccounts()
  const [dialogOpen, setDialogOpen] = useState(false)

  const categoryById = new Map(categories.map((c) => [c.id, c]))
  const accountById = new Map(accounts.map((a) => [a.id, a]))

  async function toggleActive(id: number, is_active: boolean) {
    await updateRecurring.mutateAsync({ id, is_active: !is_active })
  }

  async function handleDelete(id: number) {
    try {
      await deleteRecurring.mutateAsync(id)
      toast.success("Регулярный платёж перемещён в корзину")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось удалить")
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Регулярные платежи</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger render={<Button size="sm" className="gap-1.5" />}>
            <Plus className="size-4" />
            Новый платёж
          </DialogTrigger>
          <RecurringFormDialog onDone={() => setDialogOpen(false)} />
        </Dialog>
      </div>

      {summary && (
        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Repeat className="size-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Суммарная ежемесячная нагрузка</p>
              <p className="text-lg font-semibold">
                {formatMoney(summary.monthly_total_base, user?.base_currency ?? "USD")}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Загрузка…</p>
      ) : payments.length === 0 ? (
        <p className="text-sm text-muted-foreground">Пока нет регулярных платежей. Добавьте первый — например, подписку.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {payments.map((p) => {
            const category = p.category_id ? categoryById.get(p.category_id) : undefined
            return (
              <Card key={p.id} className={p.is_active ? undefined : "opacity-60"}>
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
                      <span className="font-medium">{p.name}</span>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => toggleActive(p.id, p.is_active)}
                        aria-label={p.is_active ? "Приостановить" : "Возобновить"}
                      >
                        {p.is_active ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
                      </Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(p.id)} aria-label="Удалить">
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                  <p className="mt-3 text-lg font-semibold">{formatMoney(p.amount, p.currency)}</p>
                  <p className="text-xs text-muted-foreground">
                    {FREQUENCY_LABELS[p.frequency]} · {accountById.get(p.account_id)?.name}
                  </p>
                  <p className="text-xs text-muted-foreground">Следующее списание: {formatDate(p.next_date)}</p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

function RecurringFormDialog({ onDone }: { onDone: () => void }) {
  const { data: accounts = [] } = useAccounts()
  const createRecurring = useCreateRecurring()
  const [name, setName] = useState("")
  const [accountId, setAccountId] = useState<number | undefined>(accounts[0]?.id)
  const [categoryId, setCategoryId] = useState<number | undefined>()
  const { data: categories = [] } = useCategories("expense")
  const [amount, setAmount] = useState("")
  const [currency, setCurrency] = useState("USD")
  const [frequency, setFrequency] = useState<RecurrenceFrequency>("monthly")
  const [nextDate, setNextDate] = useState(toLocalISODate(new Date()))

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!accountId || !amount) return
    try {
      await createRecurring.mutateAsync({
        account_id: accountId,
        category_id: categoryId,
        name,
        amount: Number(amount),
        currency: currency.toUpperCase(),
        frequency,
        next_date: nextDate,
      })
      toast.success("Регулярный платёж создан")
      onDone()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось создать платёж")
    }
  }

  return (
    <DialogContent className="sm:max-w-sm">
      <DialogHeader>
        <DialogTitle>Новый регулярный платёж</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label>Название</Label>
          <Input required autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Сумма</Label>
            <Input type="number" min="0" step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Валюта</Label>
            <Input required maxLength={3} value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Счёт</Label>
          <Select
            items={Object.fromEntries(accounts.map((a) => [String(a.id), a.name]))}
            value={accountId ? String(accountId) : ""}
            onValueChange={(v) => setAccountId(Number(v))}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Выберите счёт" />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={String(a.id)}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
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
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Периодичность</Label>
            <Select items={FREQUENCY_LABELS} value={frequency} onValueChange={(v) => setFrequency(v as RecurrenceFrequency)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(FREQUENCY_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Дата списания</Label>
            <Input type="date" required value={nextDate} onChange={(e) => setNextDate(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button type="submit" className="w-full" disabled={createRecurring.isPending}>
            Создать
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}
