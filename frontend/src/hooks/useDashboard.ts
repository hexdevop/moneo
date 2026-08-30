import { useQuery } from "@tanstack/react-query"

import { api } from "@/lib/api"
import type { CategoryBreakdown, DashboardSummary, TrendPoint } from "@/types"

export function useDashboardSummary(dateFrom?: string, dateTo?: string) {
  return useQuery<DashboardSummary>({
    queryKey: ["dashboard", "summary", dateFrom, dateTo],
    queryFn: async () => {
      const { data } = await api.get<DashboardSummary>("/dashboard/summary", {
        params: { date_from: dateFrom, date_to: dateTo },
      })
      return data
    },
  })
}

export function useDashboardTrend(months = 6) {
  return useQuery<TrendPoint[]>({
    queryKey: ["dashboard", "trend", months],
    queryFn: async () => {
      const { data } = await api.get<TrendPoint[]>("/dashboard/trend", { params: { months } })
      return data
    },
  })
}

export function useCategoryBreakdown(dateFrom: string, dateTo: string, type: "income" | "expense" = "expense") {
  return useQuery<CategoryBreakdown>({
    queryKey: ["dashboard", "by-category", dateFrom, dateTo, type],
    queryFn: async () => {
      const { data } = await api.get<CategoryBreakdown>("/dashboard/by-category", {
        params: { date_from: dateFrom, date_to: dateTo, type },
      })
      return data
    },
    enabled: Boolean(dateFrom && dateTo),
  })
}
