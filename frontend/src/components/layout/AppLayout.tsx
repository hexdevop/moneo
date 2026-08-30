import { motion } from "framer-motion"
import {
  LayoutDashboard,
  ListTree,
  LogOut,
  Plus,
  Repeat,
  Settings,
  Target,
  Trash2,
  Wallet,
  WalletCards,
} from "lucide-react"
import { useState } from "react"
import { NavLink, Outlet } from "react-router-dom"

import { ThemeToggle } from "@/components/ThemeToggle"
import { TransactionForm } from "@/components/TransactionForm"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { useLogout, useMe } from "@/hooks/useAuth"
import { avatarUrl } from "@/lib/api"
import { initials } from "@/lib/format"
import { cn } from "@/lib/utils"

const NAV_ITEMS = [
  { to: "/", label: "Дашборд", icon: LayoutDashboard, end: true },
  { to: "/transactions", label: "Транзакции", icon: ListTree },
  { to: "/accounts", label: "Счета", icon: Wallet },
  { to: "/budgets", label: "Бюджеты", icon: WalletCards },
  { to: "/recurring", label: "Подписки", icon: Repeat },
  { to: "/goals", label: "Цели", icon: Target },
  { to: "/trash", label: "Корзина", icon: Trash2 },
  { to: "/settings", label: "Настройки", icon: Settings },
]

export function AppLayout() {
  const { data: user } = useMe()
  const logout = useLogout()
  const [quickAddOpen, setQuickAddOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-card px-4 py-6 md:flex">
        <div className="mb-8 px-2 text-xl font-semibold tracking-tight">Moneo</div>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )
              }
            >
              <item.icon className="size-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-4 border-t border-border pt-4">
          {user && (
            <div className="mb-2 flex items-center gap-2 px-2">
              <Avatar size="sm">
                {user.has_avatar && <AvatarImage src={avatarUrl(user.id)} alt={user.name} />}
                <AvatarFallback className="text-xs">{initials(user.name)}</AvatarFallback>
              </Avatar>
              <span className="truncate text-sm text-muted-foreground">{user.name}</span>
            </div>
          )}
          <Button variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={() => logout.mutate()}>
            <LogOut className="size-4" />
            Выйти
          </Button>
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border px-4 py-3 md:px-8">
          <nav className="flex gap-1 overflow-x-auto md:hidden">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    "flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium",
                    isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                  )
                }
              >
                <item.icon className="size-3.5" />
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
          </div>
        </header>

        <motion.main
          className="flex-1 px-4 py-6 md:px-8"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          <Outlet />
        </motion.main>
      </div>

      <Button
        size="icon"
        className="fixed bottom-6 right-6 size-14 rounded-full shadow-lg"
        onClick={() => setQuickAddOpen(true)}
        aria-label="Добавить транзакцию"
      >
        <Plus className="size-6" />
      </Button>
      <TransactionForm open={quickAddOpen} onOpenChange={setQuickAddOpen} />
    </div>
  )
}
