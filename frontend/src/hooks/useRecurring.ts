import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { api } from "@/lib/api"
import type { RecurrenceFrequency, RecurringPayment } from "@/types"

export function useRecurringPayments(includeInactive = false) {
  return useQuery<RecurringPayment[]>({
    queryKey: ["recurring", includeInactive],
    queryFn: async () => {
      const { data } = await api.get<RecurringPayment[]>("/recurring", {
        params: { include_inactive: includeInactive },
      })
      return data
    },
  })
}

export function useRecurringSummary() {
  return useQuery<{ monthly_total_base: number; currency: string; count: number }>({
    queryKey: ["recurring", "summary"],
    queryFn: async () => {
      const { data } = await api.get("/recurring/summary")
      return data
    },
  })
}

export interface RecurringInput {
  account_id: number
  category_id?: number | null
  name: string
  amount: number
  currency: string
  frequency: RecurrenceFrequency
  next_date: string
}

function invalidateRecurring(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["recurring"] })
}

export function useCreateRecurring() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: RecurringInput) => {
      const { data } = await api.post<RecurringPayment>("/recurring", payload)
      return data
    },
    onSuccess: () => invalidateRecurring(queryClient),
  })
}

export function useUpdateRecurring() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      ...payload
    }: Partial<RecurringInput> & { id: number; is_active?: boolean }) => {
      const { data } = await api.patch<RecurringPayment>(`/recurring/${id}`, payload)
      return data
    },
    onSuccess: () => invalidateRecurring(queryClient),
  })
}

export function useDeleteRecurring() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/recurring/${id}`)
    },
    onSuccess: () => invalidateRecurring(queryClient),
  })
}
