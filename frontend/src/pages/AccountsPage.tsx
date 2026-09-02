import { motion } from "framer-motion"
import { Archive, ArchiveRestore, CreditCard, PiggyBank, Plus, Trash2, Wallet } from "lucide-react"
import { useState } from "react"
import type { FormEvent } from "react"
import { toast } from "sonner"

import { HideBalanceToggle, MASKED_BALANCE } from "@/components/HideBalanceToggle"
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
import {
  useAccounts,
  useCreateAccount,
  useDeleteAccount,
  useUpdateAccount,
} from "@/hooks/useAccounts"
import { useMe } from "@/hooks/useAuth"
import { useHideBalance } from "@/hooks/useHideBalance"
import { formatMoney } from "@/lib/format"
import type { Account, AccountType } from "@/types"

const TYPE_ICONS: Record<AccountType, typeof Wallet> = {
  cash: Wallet,
  card: CreditCard,
  deposit: PiggyBank,
  savings: PiggyBank,
  other: Wallet,
}

const TYPE_LABELS: Record<AccountType, string> = {
  cash: "Наличные",
  card: "Карта",
  deposit: "Депозит",
  savings: "Накопления",
  other: "Другое",
}

const COLORS = ["#6366f1", "#22c55e", "#f97316", "#ec4899", "#06b6d4", "#a855f7", "#64748b"]

export function AccountsPage() {
  const { data: user } = useMe()
  const { data: accounts = [], isLoading } = useAccounts(true)
  const { hidden: hideBalance } = useHideBalance()
  const [dialogOpen, setDialogOpen] = useState(false)

  const totalBalanceBase = accounts
    .filter((a) => !a.is_archived)
    .reduce((sum, a) => sum + a.balance_base, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Счета</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger render={<Button size="sm" className="gap-1.5" />}>
            <Plus className="size-4" />
            Новый счёт
          </DialogTrigger>
          <AccountFormDialog onDone={() => setDialogOpen(false)} />
        </Dialog>
      </div>

      {accounts.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-1">
              <p className="text-xs text-muted-foreground">Общий баланс</p>
              <HideBalanceToggle />
            </div>
            <p className="mt-1 text-2xl font-semibold">
              {hideBalance ? MASKED_BALANCE : formatMoney(totalBalanceBase, user?.base_currency ?? "USD")}
            </p>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Загрузка…</p>
      ) : accounts.length === 0 ? (
        <p className="text-sm text-muted-foreground">Пока нет счетов. Добавьте первый.</p>
      ) : (
        <motion.div
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
        >
          {accounts.map((account) => (
            <AccountCard key={account.id} account={account} />
          ))}
        </motion.div>
      )}
    </div>
  )
}

function AccountCard({ account }: { account: Account }) {
  const { data: user } = useMe()
  const { hidden: hideBalance } = useHideBalance()
  const updateAccount = useUpdateAccount()
  const deleteAccount = useDeleteAccount()
  const Icon = TYPE_ICONS[account.type]

  async function handleArchiveToggle() {
    await updateAccount.mutateAsync({ id: account.id, is_archived: !account.is_archived })
  }

  async function handleDelete() {
    try {
      await deleteAccount.mutateAsync(account.id)
      toast.success("Счёт перемещён в корзину")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось удалить счёт")
    }
  }

  return (
    <motion.div variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}>
      <Card className={account.is_archived ? "opacity-60" : undefined}>
        <CardContent className="pt-6">
          <div className="flex items-start justify-between">
            <div
              className="flex size-10 items-center justify-center rounded-full"
              style={{ backgroundColor: `${account.color}20`, color: account.color }}
            >
              <Icon className="size-5" />
            </div>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleArchiveToggle}
                aria-label={account.is_archived ? "Восстановить" : "Архивировать"}
              >
                {account.is_archived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
              </Button>
              <Button variant="ghost" size="icon-sm" onClick={handleDelete} aria-label="Удалить">
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>
          <p className="mt-3 font-medium">{account.name}</p>
          <p className="text-xs text-muted-foreground">{TYPE_LABELS[account.type]}</p>
          <p className="mt-3 text-xl font-semibold">
            {hideBalance ? MASKED_BALANCE : formatMoney(account.balance, account.currency)}
          </p>
          {!hideBalance && user && account.currency !== user.base_currency && (
            <p className="text-xs text-muted-foreground">
              ≈ {formatMoney(account.balance_base, user.base_currency)}
            </p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}

function AccountFormDialog({ onDone }: { onDone: () => void }) {
  const createAccount = useCreateAccount()
  const [name, setName] = useState("")
  const [currency, setCurrency] = useState("USD")
  const [type, setType] = useState<AccountType>("cash")
  const [color, setColor] = useState(COLORS[0])
  const [initialBalance, setInitialBalance] = useState("")

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    try {
      await createAccount.mutateAsync({
        name,
        currency: currency.toUpperCase(),
        type,
        color,
        initial_balance: initialBalance ? Number(initialBalance) : 0,
      })
      toast.success("Счёт создан")
      setName("")
      setInitialBalance("")
      onDone()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось создать счёт")
    }
  }

  return (
    <DialogContent className="sm:max-w-sm">
      <DialogHeader>
        <DialogTitle>Новый счёт</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label>Название</Label>
          <Input required autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Валюта</Label>
            <Input required maxLength={3} value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} />
          </div>
          <div className="space-y-1.5">
            <Label>Тип</Label>
            <Select items={TYPE_LABELS} value={type} onValueChange={(v) => setType(v as AccountType)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Начальный баланс</Label>
          <Input
            type="number"
            step="0.01"
            placeholder="0"
            value={initialBalance}
            onChange={(e) => setInitialBalance(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Цвет</Label>
          <div className="flex gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`size-7 rounded-full transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${color === c ? "ring-2 ring-offset-2 ring-ring" : ""}`}
                style={{ backgroundColor: c }}
                aria-label={c}
                aria-pressed={color === c}
              />
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button type="submit" className="w-full" disabled={createAccount.isPending}>
            Создать
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}
