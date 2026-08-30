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
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { useAccounts } from "@/hooks/useAccounts"
import { useCategories } from "@/hooks/useCategories"
import { useCreateTransaction, useUpdateTransaction } from "@/hooks/useTransactions"
import { toLocalISODate } from "@/lib/format"
import type { Transaction, TransactionType } from "@/types"

const COMMON_CURRENCIES = ["USD", "EUR", "UZS", "RUB", "GBP"]
const FEE_PRESETS = [0.1, 0.2, 0.5, 1, 2]

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
  const [feeEnabled, setFeeEnabled] = useState(Boolean(transaction?.fee))
  const [feeMode, setFeeMode] = useState<"percent" | "fixed">(transaction?.fee ? "fixed" : "percent")
  const [feePercent, setFeePercent] = useState("")
  const [fee, setFee] = useState(transaction?.fee ? String(transaction.fee) : "")

  const selectedAccount = accounts.find((a) => a.id === accountId)

  useEffect(() => {
    if (feeMode !== "percent") return
    const pct = Number(feePercent)
    const amt = Number(amount)
    setFee(pct > 0 && amt > 0 ? (amt * (pct / 100)).toFixed(2) : "")
  }, [feeMode, feePercent, amount])

  const createMutation = useCreateTransaction()
  const updateMutation = useUpdateTransaction()
  const pending = createMutation.isPending || updateMutation.isPending

  useEffect(() => {
    if (!open) return
    const account = accounts.find((a) => a.id === accountId)
    if (account && !currency) setCurrency(account.currency)
  }, [open, accountId, accounts, currency])

  useEffect(() => {
    if (open) {
      setType(transaction?.type ?? "expense")
      setAccountId(transaction?.account_id ?? defaultAccountId ?? accounts[0]?.id)
      setTransferAccountId(transaction?.transfer_account_id ?? undefined)
      setCategoryId(transaction?.category_id ?? undefined)
      setAmount(transaction ? String(transaction.amount) : "")
      setCurrency(transaction?.currency ?? "")
      setDate(transaction?.date ?? toLocalISODate(new Date()))
      setNote(transaction?.note ?? "")
      setTags(transaction?.tags?.join(", ") ?? "")
      setFeeEnabled(Boolean(transaction?.fee))
      setFeeMode(transaction?.fee ? "fixed" : "percent")
      setFeePercent("")
      setFee(transaction?.fee ? String(transaction.fee) : "")
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
      fee: feeEnabled && fee ? Number(fee) : null,
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

          {selectedAccount?.type === "card" && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="fee-toggle">Комиссия за операцию</Label>
                <Switch id="fee-toggle" checked={feeEnabled} onCheckedChange={setFeeEnabled} />
              </div>
              {feeEnabled && (
                <div className="space-y-2 rounded-md border border-border p-3">
                  <Tabs value={feeMode} onValueChange={(v) => setFeeMode(v as "percent" | "fixed")}>
                    <TabsList className="w-full">
                      <TabsTrigger value="percent" className="flex-1">
                        % от суммы
                      </TabsTrigger>
                      <TabsTrigger value="fixed" className="flex-1">
                        Сумма
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>

                  {feeMode === "percent" ? (
                    <>
                      <div className="flex flex-wrap gap-1.5">
                        {FEE_PRESETS.map((p) => (
                          <Button
                            key={p}
                            type="button"
                            size="sm"
                            variant={feePercent === String(p) ? "default" : "outline"}
                            onClick={() => setFeePercent(String(p))}
                          >
                            {p}%
                          </Button>
                        ))}
                      </div>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Свой процент"
                        value={feePercent}
                        onChange={(e) => setFeePercent(e.target.value)}
                      />
                      {fee && (
                        <p className="text-xs text-muted-foreground">
                          Комиссия: {fee} {currency}
                        </p>
                      )}
                    </>
                  ) : (
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Сумма комиссии"
                      value={fee}
                      onChange={(e) => setFee(e.target.value)}
                    />
                  )}
                </div>
              )}
            </div>
          )}

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
