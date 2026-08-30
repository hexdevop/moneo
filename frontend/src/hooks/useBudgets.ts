import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { api } from "@/lib/api"
import type { Budget } from "@/types"

export function useBudgets(month?: string) {
  return useQuery<Budget[]>({
    queryKey: ["budgets", month],
    queryFn: async () => {
      const { data } = await api.get<Budget[]>("/budgets", { params: { month } })
      return data
    },
  })
}

export interface BudgetInput {
  category_id: number
  month: string
  limit_amount: number
  currency: string
}

export function useCreateBudget() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: BudgetInput) => {
      const { data } = await api.post<Budget>("/budgets", payload)
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["budgets"] }),
  })
}

export function useUpdateBudget() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, limit_amount }: { id: number; limit_amount: number }) => {
      const { data } = await api.patch<Budget>(`/budgets/${id}`, { limit_amount })
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["budgets"] }),
  })
}

export function useDeleteBudget() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/budgets/${id}`)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["budgets"] }),
  })
}

export function useCopyBudgetsToNextMonth() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (month: string) => {
      const { data } = await api.post<Budget[]>("/budgets/copy-to-next-month", null, {
        params: { month },
      })
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["budgets"] }),
  })
}
