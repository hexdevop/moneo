import { useEffect, useState } from "react"
import type { FormEvent } from "react"
import { toast } from "sonner"

import { CategoryIcon } from "@/components/CategoryIcon"
import { Button } from "@/components/ui/button"
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { useAccounts } from "@/hooks/useAccounts"
import { useCategories } from "@/hooks/useCategories"
import { useCreateTransaction, useUpdateTransaction } from "@/hooks/useTransactions"
import { toLocalISODate } from "@/lib/format"
import type { Transaction, TransactionType } from "@/types"

const COMMON_CURRENCIES = ["USD", "EUR", "UZS", "RUB", "GBP"]

interface TransactionFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  transaction?: Transaction
  defaultAccountId?: number
}

export function TransactionForm({
  open,
  onOpenChange,
  transaction,
  defaultAccountId,
}: TransactionFormProps) {
  const isEdit = Boolean(transaction)
  const { data: accounts = [] } = useAccounts()
  const [type, setType] = useState<TransactionType>(transaction?.type ?? "expense")
  const { data: categories = [] } = useCategories(type === "transfer" ? undefined : type)

  const [accountId, setAccountId] = useState<number | undefined>(
    transaction?.account_id ?? defaultAccountId ?? accounts[0]?.id
  )
  const [transferAccountId, setTransferAccountId] = useState<number | undefined>(
    transaction?.transfer_account_id ?? undefined
  )
  const [categoryId, setCategoryId] = useState<number | undefined>(
    transaction?.category_id ?? undefined
  )
  const [amount, setAmount] = useState(transaction ? String(transaction.amount) : "")
  const [currency, setCurrency] = useState(transaction?.currency ?? "")
  const [date, setDate] = useState(transaction?.date ?? toLocalISODate(new Date()))
  const [note, setNote] = useState(transaction?.note ?? "")
  const [tags, setTags] = useState(transaction?.tags?.join(", ") ?? "")

  const createMutation = useCreateTransaction()
  const updateMutation = useUpdateTransaction()
  const pending = createMutation.isPending || updateMutation.isPending

  useEffect(() => {
    if (!open) return
    const account = accounts.find((a) => a.id === accountId)
    if (account && !currency) setCurrency(account.currency)
  }, [open, accountId, accounts, currency])

  useEffect(() => {
    if (!open) {
      setType(transaction?.type ?? "expense")
      setAccountId(transaction?.account_id ?? defaultAccountId ?? accounts[0]?.id)
      setTransferAccountId(transaction?.transfer_account_id ?? undefined)
      setCategoryId(transaction?.category_id ?? undefined)
      setAmount(transaction ? String(transaction.amount) : "")
      setCurrency(transaction?.currency ?? "")
      setDate(transaction?.date ?? toLocalISODate(new Date()))
      setNote(transaction?.note ?? "")
      setTags(transaction?.tags?.join(", ") ?? "")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!accountId || !amount || !currency || !date) return

    const payload = {
      account_id: accountId,
      transfer_account_id: type === "transfer" ? transferAccountId : null,
      category_id: type === "transfer" ? null : categoryId,
      type,
      amount: Number(amount),
      currency: currency.toUpperCase(),
      date,
      note: note || null,
      tags: tags
        ? tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        : null,
    }

    try {
      if (isEdit && transaction) {
        await updateMutation.mutateAsync({ id: transaction.id, ...payload })
        toast.success("Транзакция обновлена")
      } else {
        await createMutation.mutateAsync(payload)
        toast.success("Транзакция добавлена")
      }
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось сохранить транзакцию")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Изменить транзакцию" : "Новая транзакция"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Tabs value={type} onValueChange={(v) => setType(v as TransactionType)}>
            <TabsList className="w-full">
              <TabsTrigger value="expense" className="flex-1">
                Расход
              </TabsTrigger>
              <TabsTrigger value="income" className="flex-1">
                Доход
              </TabsTrigger>
              <TabsTrigger value="transfer" className="flex-1">
                Перевод
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="grid grid-cols-2 gap-3">
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

            {type === "transfer" ? (
              <div className="space-y-1.5">
                <Label>На счёт</Label>
                <Select
                  items={Object.fromEntries(
                    accounts.filter((a) => a.id !== accountId).map((a) => [String(a.id), a.name])
                  )}
                  value={transferAccountId ? String(transferAccountId) : ""}
                  onValueChange={(v) => setTransferAccountId(Number(v))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Выберите счёт" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts
                      .filter((a) => a.id !== accountId)
                      .map((a) => (
                        <SelectItem key={a.id} value={String(a.id)}>
                          {a.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
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
                        <span className="flex items-center gap-2">
                          <CategoryIcon name={c.icon} className="size-3.5" style={{ color: c.color }} />
                          {c.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Сумма</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Валюта</Label>
              <Input
                list="currencies"
                required
                maxLength={3}
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              />
              <datalist id="currencies">
                {COMMON_CURRENCIES.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Дата</Label>
            <Input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Заметка</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          </div>

          <div className="space-y-1.5">
            <Label>Теги (через запятую)</Label>
            <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="кафе, поездка" />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending} className="w-full">
              {isEdit ? "Сохранить" : "Добавить"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
