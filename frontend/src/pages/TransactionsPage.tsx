import { ArrowLeftRight, ArrowDownLeft, ArrowUpRight, Pencil, Plus, Search, Trash2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { CategoryIcon } from "@/components/CategoryIcon"
import { TransactionForm } from "@/components/TransactionForm"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAccounts } from "@/hooks/useAccounts"
import { useCategories } from "@/hooks/useCategories"
import { useDeleteTransaction, useTransactions } from "@/hooks/useTransactions"
import type { TransactionFilters } from "@/hooks/useTransactions"
import { formatDate, formatMoney } from "@/lib/format"
import type { Transaction, TransactionType } from "@/types"

const PAGE_SIZE = 20

const TYPE_ICON: Record<TransactionType, typeof ArrowUpRight> = {
  income: ArrowUpRight,
  expense: ArrowDownLeft,
  transfer: ArrowLeftRight,
}

export function TransactionsPage() {
  const { data: accounts = [] } = useAccounts()
  const { data: categories = [] } = useCategories()
  const [filters, setFilters] = useState<TransactionFilters>({ page: 1, page_size: PAGE_SIZE })
  const [search, setSearch] = useState("")
  const { data, isLoading } = useTransactions({ ...filters, search: search || undefined })
  const deleteTransaction = useDeleteTransaction()

  const [formOpen, setFormOpen] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | undefined>()

  function openEdit(transaction: Transaction) {
    setEditingTransaction(transaction)
    setFormOpen(true)
  }

  function openCreate() {
    setEditingTransaction(undefined)
    setFormOpen(true)
  }

  async function handleDelete(id: number) {
    try {
      await deleteTransaction.mutateAsync(id)
      toast.success("Транзакция удалена")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось удалить транзакцию")
    }
  }

  const categoryById = new Map(categories.map((c) => [c.id, c]))
  const accountById = new Map(accounts.map((a) => [a.id, a]))

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Транзакции</h1>
        <Button size="sm" className="gap-1.5" onClick={openCreate}>
          <Plus className="size-4" />
          Добавить
        </Button>
      </div>

      <Card>
        <CardContent className="flex flex-wrap gap-2 pt-6">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Поиск по заметке или тегу"
              className="pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select
            items={{ all: "Все типы", income: "Доход", expense: "Расход", transfer: "Перевод" }}
            value={filters.type ?? "all"}
            onValueChange={(v) => setFilters((f) => ({ ...f, type: v === "all" ? undefined : (v as TransactionType), page: 1 }))}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Тип" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все типы</SelectItem>
              <SelectItem value="income">Доход</SelectItem>
              <SelectItem value="expense">Расход</SelectItem>
              <SelectItem value="transfer">Перевод</SelectItem>
            </SelectContent>
          </Select>
          <Select
            items={{ all: "Все счета", ...Object.fromEntries(accounts.map((a) => [String(a.id), a.name])) }}
            value={filters.account_id ? String(filters.account_id) : "all"}
            onValueChange={(v) => setFilters((f) => ({ ...f, account_id: v === "all" ? undefined : Number(v), page: 1 }))}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Счёт" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все счета</SelectItem>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={String(a.id)}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            items={{ all: "Все категории", ...Object.fromEntries(categories.map((c) => [String(c.id), c.name])) }}
            value={filters.category_id ? String(filters.category_id) : "all"}
            onValueChange={(v) => setFilters((f) => ({ ...f, category_id: v === "all" ? undefined : Number(v), page: 1 }))}
          >
            <SelectTrigger className="w-[170px]">
              <SelectValue placeholder="Категория" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все категории</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="date"
            className="w-[150px]"
            value={filters.date_from ?? ""}
            onChange={(e) => setFilters((f) => ({ ...f, date_from: e.target.value || undefined, page: 1 }))}
          />
          <Input
            type="date"
            className="w-[150px]"
            value={filters.date_to ?? ""}
            onChange={(e) => setFilters((f) => ({ ...f, date_to: e.target.value || undefined, page: 1 }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Загрузка…</p>
          ) : !data || data.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {search || filters.type || filters.account_id || filters.category_id || filters.date_from || filters.date_to
                ? "Ничего не найдено — попробуйте изменить фильтры"
                : "Пока нет транзакций. Добавьте первую кнопкой «Добавить»."}
            </p>
          ) : (
            <div className="divide-y divide-border">
              {data.items.map((t) => {
                const category = t.category_id ? categoryById.get(t.category_id) : undefined
                const account = accountById.get(t.account_id)
                const Icon = TYPE_ICON[t.type]
                const sign = t.type === "income" ? "+" : t.type === "expense" ? "-" : ""
                return (
                  <div key={t.id} className="flex items-center gap-3 py-3">
                    <div
                      className="flex size-9 shrink-0 items-center justify-center rounded-full"
                      style={{
                        backgroundColor: category ? `${category.color}20` : "var(--muted)",
                        color: category?.color ?? "var(--muted-foreground)",
                      }}
                    >
                      {category ? <CategoryIcon name={category.icon} className="size-4" /> : <Icon className="size-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {category?.name ?? (t.type === "transfer" ? "Перевод" : "Без категории")}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {account?.name} · {formatDate(t.date)}
                        {t.note ? ` · ${t.note}` : ""}
                      </p>
                    </div>
                    <p
                      className={
                        "shrink-0 text-sm font-semibold " +
                        (t.type === "income" ? "text-green-600" : t.type === "expense" ? "text-red-600" : "")
                      }
                    >
                      {sign}
                      {formatMoney(t.amount, t.currency)}
                    </p>
                    <div className="flex shrink-0 gap-1">
                      <Button variant="ghost" size="icon-sm" onClick={() => openEdit(t)} aria-label="Изменить">
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(t.id)} aria-label="Удалить">
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {data && data.total > PAGE_SIZE && (
            <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Страница {filters.page} из {totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={(filters.page ?? 1) <= 1}
                  onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) - 1 }))}
                >
                  Назад
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={(filters.page ?? 1) >= totalPages}
                  onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) + 1 }))}
                >
                  Далее
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <TransactionForm open={formOpen} onOpenChange={setFormOpen} transaction={editingTransaction} />
    </div>
  )
}
