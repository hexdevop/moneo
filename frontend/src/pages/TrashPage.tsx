import { Repeat, RotateCcw, Tag, Target, Trash2, Wallet, WalletCards, ListTree } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useDeleteForever, useRestoreTrashItem, useTrash } from "@/hooks/useTrash"
import { formatDate } from "@/lib/format"
import type { TrashItem, TrashResourceType } from "@/types"

const RESOURCE_ICONS: Record<TrashResourceType, typeof Wallet> = {
  account: Wallet,
  transaction: ListTree,
  category: Tag,
  budget: WalletCards,
  recurring: Repeat,
  goal: Target,
}

const RESOURCE_LABELS: Record<TrashResourceType, string> = {
  account: "Счёт",
  transaction: "Транзакция",
  category: "Категория",
  budget: "Бюджет",
  recurring: "Регулярный платёж",
  goal: "Цель",
}

export function TrashPage() {
  const { data: items = [], isLoading } = useTrash()
  const restore = useRestoreTrashItem()
  const [pendingDelete, setPendingDelete] = useState<TrashItem | null>(null)

  async function handleRestore(item: TrashItem) {
    try {
      await restore.mutateAsync({ resourceType: item.resource_type, id: item.id })
      toast.success("Восстановлено")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось восстановить")
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Корзина</h1>
        <p className="text-sm text-muted-foreground">
          Удалённые объекты хранятся здесь — их можно восстановить или удалить навсегда
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Загрузка…</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Корзина пуста</p>
          ) : (
            <div className="divide-y divide-border">
              {items.map((item) => {
                const Icon = RESOURCE_ICONS[item.resource_type]
                return (
                  <div key={`${item.resource_type}-${item.id}`} className="flex items-center gap-3 py-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <Icon className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{item.label}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {RESOURCE_LABELS[item.resource_type]}
                        {item.subtitle ? ` · ${item.subtitle}` : ""} · удалено {formatDate(item.deleted_at)}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleRestore(item)}
                        aria-label="Восстановить"
                      >
                        <RotateCcw className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setPendingDelete(item)}
                        aria-label="Удалить навсегда"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <DeleteForeverDialog item={pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)} />
    </div>
  )
}

function DeleteForeverDialog({
  item,
  onOpenChange,
}: {
  item: TrashItem | null
  onOpenChange: (open: boolean) => void
}) {
  const deleteForever = useDeleteForever()

  async function handleConfirm() {
    if (!item) return
    try {
      await deleteForever.mutateAsync({ resourceType: item.resource_type, id: item.id })
      toast.success("Удалено навсегда")
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось удалить")
    }
  }

  return (
    <Dialog open={item !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Удалить навсегда?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          «{item?.label}» будет удалено безвозвратно. Это действие нельзя отменить.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={deleteForever.isPending}>
            Удалить навсегда
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
