import { motion } from "framer-motion"
import { ArrowDownRight, ArrowUpRight, Wallet } from "lucide-react"
import { useMemo } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { CategoryIcon } from "@/components/CategoryIcon"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useCategoryBreakdown, useDashboardSummary, useDashboardTrend } from "@/hooks/useDashboard"
import { useMe } from "@/hooks/useAuth"
import { formatMonth, formatMoney, toLocalISODate } from "@/lib/format"

const COLORS = ["#6366f1", "#f97316", "#22c55e", "#ec4899", "#06b6d4", "#a855f7", "#f59e0b"]

export function DashboardPage() {
  const { data: user } = useMe()
  const currency = user?.base_currency ?? "USD"
  const { data: summary, isLoading: summaryLoading } = useDashboardSummary()
  const { data: trend = [] } = useDashboardTrend(6)

  const range = useMemo(() => {
    const now = new Date()
    const from = toLocalISODate(new Date(now.getFullYear(), now.getMonth(), 1))
    const to = toLocalISODate(new Date(now.getFullYear(), now.getMonth() + 1, 0))
    return { from, to }
  }, [])
  const { data: breakdown } = useCategoryBreakdown(range.from, range.to, "expense")

  const trendData = trend.map((t) => ({
    ...t,
    label: formatMonth(t.month).replace(" г.", ""),
  }))

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid gap-4 sm:grid-cols-3"
      >
        <StatCard
          title="Общий баланс"
          value={summary ? formatMoney(summary.balance_total_base, currency) : "—"}
          icon={Wallet}
          loading={summaryLoading}
        />
        <StatCard
          title="Доход за месяц"
          value={summary ? formatMoney(summary.income_base, currency) : "—"}
          icon={ArrowUpRight}
          loading={summaryLoading}
          tone="positive"
        />
        <StatCard
          title="Расход за месяц"
          value={summary ? formatMoney(summary.expense_base, currency) : "—"}
          icon={ArrowDownRight}
          loading={summaryLoading}
          tone="negative"
        />
      </motion.div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Динамика за 6 месяцев</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value) => formatMoney(Number(value), currency)}
                  contentStyle={{ borderRadius: 8, fontSize: 13 }}
                />
                <Legend />
                <Bar dataKey="income_base" name="Доход" fill="#22c55e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense_base" name="Расход" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Расходы по категориям</CardTitle>
          </CardHeader>
          <CardContent>
            {breakdown && breakdown.categories.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={breakdown.categories}
                    dataKey="amount_base"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={80}
                  >
                    {breakdown.categories.map((entry, i) => (
                      <Cell key={entry.category_id} fill={entry.color || COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatMoney(Number(value), currency)} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-16 text-center text-sm text-muted-foreground">Нет расходов за этот месяц</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Топ категорий расходов</CardTitle>
        </CardHeader>
        <CardContent>
          {summary && summary.top_expense_categories.length > 0 ? (
            <div className="space-y-3">
              {summary.top_expense_categories.map((c) => (
                <div key={c.category_id} className="flex items-center gap-3">
                  <div
                    className="flex size-8 shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: `${c.color}20`, color: c.color }}
                  >
                    <CategoryIcon name={c.icon} className="size-4" />
                  </div>
                  <span className="flex-1 text-sm font-medium">{c.name}</span>
                  <span className="text-sm text-muted-foreground">{formatMoney(c.amount_base, currency)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-sm text-muted-foreground">Нет расходов за этот месяц</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function StatCard({
  title,
  value,
  icon: Icon,
  loading,
  tone,
}: {
  title: string
  value: string
  icon: typeof Wallet
  loading?: boolean
  tone?: "positive" | "negative"
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 pt-6">
        <div
          className={
            "flex size-10 shrink-0 items-center justify-center rounded-full " +
            (tone === "positive"
              ? "bg-green-500/10 text-green-600"
              : tone === "negative"
                ? "bg-red-500/10 text-red-600"
                : "bg-primary/10 text-primary")
          }
        >
          <Icon className="size-5" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{title}</p>
          <p className="text-lg font-semibold">{loading ? "…" : value}</p>
        </div>
      </CardContent>
    </Card>
  )
}
