import { motion } from "framer-motion"
import {
  LayoutDashboard,
  ListTree,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
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

import { WelcomeModal } from "@/components/onboarding/WelcomeModal"
import { ThemeToggle } from "@/components/ThemeToggle"
import { TransactionForm } from "@/components/TransactionForm"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { useLogout, useMe } from "@/hooks/useAuth"
import { avatarUrl } from "@/lib/api"
import { isDemoMode } from "@/lib/demo/store"
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

// Sidebar visible + expanded on desktop by default; hidden off-canvas on phones
// until opened. Same boolean, same toggle button — CSS decides what it means.
const isDesktop = () => window.innerWidth >= 768

export function AppLayout() {
  const { data: user } = useMe()
  const logout = useLogout()
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [open, setOpen] = useState(isDesktop)

  function closeOnMobile() {
    if (!isDesktop()) setOpen(false)
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background md:flex-row">
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-card px-4 py-6 transition-transform duration-200 md:static md:z-auto md:translate-x-0 md:transition-[width] md:duration-150",
          open ? "translate-x-0" : "-translate-x-full",
          open ? "md:w-60 md:px-4" : "md:w-16 md:px-2"
        )}
      >
        <div className={cn("mb-8 flex items-center gap-2 px-2", !open && "md:justify-center md:px-0")}>
          <span className={cn("text-xl font-semibold tracking-tight", !open && "md:hidden")}>Moneo</span>
          {isDemoMode() && (
            <span
              className={cn(
                "rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400",
                !open && "md:hidden"
              )}
            >
              Демо
            </span>
          )}
        </div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={closeOnMobile}
              title={!open ? item.label : undefined}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  !open && "md:justify-center md:px-0",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )
              }
            >
              <item.icon className="size-4 shrink-0" />
              <span className={cn(!open && "md:hidden")}>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="mt-4 border-t border-border pt-4">
          {user && (
            <div className={cn("mb-2 flex items-center gap-2 px-2", !open && "md:justify-center md:px-0")}>
              <Avatar size="sm" title={!open ? user.name : undefined}>
                {user.has_avatar && <AvatarImage src={avatarUrl(user.id)} alt={user.name} />}
                <AvatarFallback className="text-xs">{initials(user.name)}</AvatarFallback>
              </Avatar>
              <span className={cn("truncate text-sm text-muted-foreground", !open && "md:hidden")}>{user.name}</span>
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            className={cn("w-full justify-start gap-2", !open && "md:justify-center md:px-0")}
            onClick={() => logout.mutate()}
            title={!open ? "Выйти" : undefined}
          >
            <LogOut className="size-4" />
            <span className={cn(!open && "md:hidden")}>Выйти</span>
          </Button>
        </div>
      </aside>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <header className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3 md:px-8">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Скрыть меню" : "Показать меню"}
            title={open ? "Скрыть меню" : "Показать меню"}
          >
            {open ? <PanelLeftClose className="size-4" /> : <PanelLeftOpen className="size-4" />}
          </Button>
          <span className="text-lg font-semibold tracking-tight md:hidden">Moneo</span>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
          </div>
        </header>

        <motion.main
          className="min-h-0 flex-1 overflow-y-auto px-4 py-6 md:px-8"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          <Outlet />
        </motion.main>
      </div>

      <Button
        size="icon"
        className="fixed right-4 bottom-6 size-14 rounded-full shadow-lg md:right-6"
        onClick={() => setQuickAddOpen(true)}
        aria-label="Добавить транзакцию"
      >
        <Plus className="size-6" />
      </Button>
      <TransactionForm open={quickAddOpen} onOpenChange={setQuickAddOpen} />
      <WelcomeModal />
    </div>
  )
}
