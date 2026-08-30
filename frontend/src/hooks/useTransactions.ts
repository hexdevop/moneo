import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { api } from "@/lib/api"
import type { Page, Transaction, TransactionType } from "@/types"

export interface TransactionFilters {
  date_from?: string
  date_to?: string
  account_id?: number
  category_id?: number
  type?: TransactionType
  amount_min?: number
  amount_max?: number
  search?: string
  page?: number
  page_size?: number
}

export function useTransactions(filters: TransactionFilters) {
  return useQuery<Page<Transaction>>({
    queryKey: ["transactions", filters],
    queryFn: async () => {
      const { data } = await api.get<Page<Transaction>>("/transactions", { params: filters })
      return data
    },
    placeholderData: keepPreviousData,
  })
}

export interface TransactionInput {
  account_id: number
  transfer_account_id?: number | null
  category_id?: number | null
  type: TransactionType
  amount: number
  currency: string
  date: string
  note?: string | null
  tags?: string[] | null
  fee?: number | null
}

function invalidateAfterMutation(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["transactions"] })
  queryClient.invalidateQueries({ queryKey: ["accounts"] })
  queryClient.invalidateQueries({ queryKey: ["budgets"] })
  queryClient.invalidateQueries({ queryKey: ["dashboard"] })
}

export function useCreateTransaction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: TransactionInput) => {
      const { data } = await api.post<Transaction>("/transactions", payload)
      return data
    },
    onSuccess: () => invalidateAfterMutation(queryClient),
  })
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<TransactionInput> & { id: number }) => {
      const { data } = await api.patch<Transaction>(`/transactions/${id}`, payload)
      return data
    },
    onSuccess: () => invalidateAfterMutation(queryClient),
  })
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/transactions/${id}`)
    },
    onSuccess: () => invalidateAfterMutation(queryClient),
  })
}
