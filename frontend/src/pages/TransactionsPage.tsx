import {
  ArrowLeftRight,
  ArrowDownLeft,
  ArrowUpRight,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
} from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

import { CategoryIcon } from "@/components/CategoryIcon"
import { TransactionForm } from "@/components/TransactionForm"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { WheelDatePicker } from "@/components/WheelDatePicker"
import { useAccounts } from "@/hooks/useAccounts"
import { useCategories } from "@/hooks/useCategories"
import { useDeleteTransaction, useInfiniteTransactions } from "@/hooks/useTransactions"
import type { TransactionFilters } from "@/hooks/useTransactions"
import { formatDate, formatMoney, toLocalISODate } from "@/lib/format"
import type { Transaction, TransactionType } from "@/types"

const TYPE_ICON: Record<TransactionType, typeof ArrowUpRight> = {
  income: ArrowUpRight,
  expense: ArrowDownLeft,
  transfer: ArrowLeftRight,
}

interface DatePreset {
  label: string
  range: () => { date_from?: string; date_to?: string }
}

const DATE_PRESETS: DatePreset[] = [
  {
    label: "Сегодня",
    range: () => {
      const today = toLocalISODate(new Date())
      return { date_from: today, date_to: today }
    },
  },
  {
    label: "7 дней",
    range: () => {
      const to = new Date()
      const from = new Date()
      from.setDate(to.getDate() - 6)
      return { date_from: toLocalISODate(from), date_to: toLocalISODate(to) }
    },
  },
  {
    label: "Этот месяц",
    range: () => {
      const now = new Date()
      return {
        date_from: toLocalISODate(new Date(now.getFullYear(), now.getMonth(), 1)),
        date_to: toLocalISODate(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
      }
    },
  },
  {
    label: "Этот год",
    range: () => {
      const now = new Date()
      return {
        date_from: toLocalISODate(new Date(now.getFullYear(), 0, 1)),
        date_to: toLocalISODate(new Date(now.getFullYear(), 11, 31)),
      }
    },
  },
  { label: "Всё время", range: () => ({ date_from: undefined, date_to: undefined }) },
]

export function TransactionsPage() {
  const { data: accounts = [] } = useAccounts()
  const { data: categories = [] } = useCategories()
  const [filters, setFilters] = useState<TransactionFilters>({})
  const [search, setSearch] = useState("")
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [customRangeOpen, setCustomRangeOpen] = useState(false)
  const queryFilters = { ...filters, search: search || undefined }
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteTransactions(queryFilters)
  const deleteTransaction = useDeleteTransaction()

  const [formOpen, setFormOpen] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | undefined>()

  const sentinelRef = useRef<HTMLDivElement>(null)

  // Listen on the capture phase so this catches scroll events from the actual
  // scrolling ancestor (AppLayout's <main>), which "scroll" doesn't bubble to.
  useEffect(() => {
    function handleScroll(e: Event) {
      const el = e.target
      if (!(el instanceof HTMLElement) || !sentinelRef.current || !el.contains(sentinelRef.current)) return
      if (el.scrollHeight - el.scrollTop - el.clientHeight < 300 && hasNextPage && !isFetchingNextPage) {
        fetchNextPage()
      }
    }
    window.addEventListener("scroll", handleScroll, true)
    return () => window.removeEventListener("scroll", handleScroll, true)
  }, [fetchNextPage, hasNextPage, isFetchingNextPage])

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
      toast.success("Транзакция перемещена в корзину")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось удалить транзакцию")
    }
  }

  function resetFilters() {
    setFilters({})
    setCustomRangeOpen(false)
  }

  const categoryById = new Map(categories.map((c) => [c.id, c]))
  const accountById = new Map(accounts.map((a) => [a.id, a]))
  const items = useMemo(() => data?.pages.flatMap((p) => p.items) ?? [], [data])
  const total = data?.pages[0]?.total ?? 0

  const activePresetLabel = useMemo(() => {
    if (customRangeOpen) return undefined
    const match = DATE_PRESETS.find((p) => {
      const r = p.range()
      return r.date_from === filters.date_from && r.date_to === filters.date_to
    })
    return match?.label
  }, [filters.date_from, filters.date_to, customRangeOpen])

  const activeFilterCount =
    (filters.type ? 1 : 0) +
    (filters.account_id ? 1 : 0) +
    (filters.category_id ? 1 : 0) +
    (filters.date_from || filters.date_to ? 1 : 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Транзакции</h1>
        <Button size="sm" className="gap-1.5" onClick={openCreate}>
          <Plus className="size-4" />
          Добавить
        </Button>
      </div>

      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Поиск по заметке или тегу"
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button
          variant={activeFilterCount > 0 ? "default" : "outline"}
          className="shrink-0 gap-1.5"
          onClick={() => setFiltersOpen(true)}
        >
          <SlidersHorizontal className="size-4" />
          <span className="hidden sm:inline">Фильтры</span>
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="ml-0.5">
              {activeFilterCount}
            </Badge>
          )}
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Загрузка…</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {search || activeFilterCount > 0
                ? "Ничего не найдено — попробуйте изменить фильтры"
                : "Пока нет транзакций. Добавьте первую кнопкой «Добавить»."}
            </p>
          ) : (
            <div className="divide-y divide-border">
              {items.map((t) => {
                const category = t.category_id ? categoryById.get(t.category_id) : undefined
                const account = accountById.get(t.account_id)
                const Icon = TYPE_ICON[t.type]
                const sign = t.type === "income" ? "+" : t.type === "expense" ? "-" : ""
                return (
                  <div
                    key={t.id}
                    onClick={() => openEdit(t)}
                    className="flex cursor-pointer items-center gap-3 py-3 transition-colors hover:bg-muted/50"
                  >
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
                    <div className="flex shrink-0 gap-1" onClick={(e) => e.stopPropagation()}>
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

          <div ref={sentinelRef} className="h-px" />
          {isFetchingNextPage && (
            <p className="pt-4 text-center text-sm text-muted-foreground">Загрузка…</p>
          )}
          {!isLoading && items.length > 0 && !hasNextPage && (
            <p className="pt-4 text-center text-xs text-muted-foreground">
              Показаны все транзакции ({total})
            </p>
          )}
        </CardContent>
      </Card>

      <TransactionForm open={formOpen} onOpenChange={setFormOpen} transaction={editingTransaction} />

      <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Фильтры</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Период</Label>
              <div className="flex flex-wrap gap-2">
                {DATE_PRESETS.map((preset) => (
                  <Button
                    key={preset.label}
                    type="button"
                    size="sm"
                    variant={activePresetLabel === preset.label ? "default" : "outline"}
                    onClick={() => {
                      setCustomRangeOpen(false)
                      setFilters((f) => ({ ...f, ...preset.range() }))
                    }}
                  >
                    {preset.label}
                  </Button>
                ))}
                <Button
                  type="button"
                  size="sm"
                  variant={customRangeOpen ? "default" : "outline"}
                  onClick={() => setCustomRangeOpen((v) => !v)}
                >
                  Свой период
                </Button>
              </div>

              {customRangeOpen && (
                <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">С какой даты</Label>
                    <WheelDatePicker
                      value={filters.date_from ?? toLocalISODate(new Date())}
                      onChange={(v) => setFilters((f) => ({ ...f, date_from: v }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">По какую дату</Label>
                    <WheelDatePicker
                      value={filters.date_to ?? toLocalISODate(new Date())}
                      onChange={(v) => setFilters((f) => ({ ...f, date_to: v }))}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Тип</Label>
              <Select
                items={{ all: "Все типы", income: "Доход", expense: "Расход", transfer: "Перевод" }}
                value={filters.type ?? "all"}
                onValueChange={(v) => setFilters((f) => ({ ...f, type: v === "all" ? undefined : (v as TransactionType) }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Тип" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все типы</SelectItem>
                  <SelectItem value="income">Доход</SelectItem>
                  <SelectItem value="expense">Расход</SelectItem>
                  <SelectItem value="transfer">Перевод</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Счёт</Label>
              <Select
                items={{ all: "Все счета", ...Object.fromEntries(accounts.map((a) => [String(a.id), a.name])) }}
                value={filters.account_id ? String(filters.account_id) : "all"}
                onValueChange={(v) => setFilters((f) => ({ ...f, account_id: v === "all" ? undefined : Number(v) }))}
              >
                <SelectTrigger className="w-full">
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
            </div>

            <div className="space-y-1.5">
              <Label>Категория</Label>
              <Select
                items={{ all: "Все категории", ...Object.fromEntries(categories.map((c) => [String(c.id), c.name])) }}
                value={filters.category_id ? String(filters.category_id) : "all"}
                onValueChange={(v) => setFilters((f) => ({ ...f, category_id: v === "all" ? undefined : Number(v) }))}
              >
                <SelectTrigger className="w-full">
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
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={resetFilters}>
              Сбросить
            </Button>
            <Button onClick={() => setFiltersOpen(false)}>Готово</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
