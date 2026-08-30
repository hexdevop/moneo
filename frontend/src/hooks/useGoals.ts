import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { api } from "@/lib/api"
import type { Goal } from "@/types"

export function useGoals() {
  return useQuery<Goal[]>({
    queryKey: ["goals"],
    queryFn: async () => {
      const { data } = await api.get<Goal[]>("/goals")
      return data
    },
  })
}

export interface GoalInput {
  name: string
  target_amount: number
  currency: string
  deadline?: string | null
  linked_account_id?: number | null
}

export function useCreateGoal() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: GoalInput) => {
      const { data } = await api.post<Goal>("/goals", payload)
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["goals"] }),
  })
}

export function useUpdateGoal() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<GoalInput> & { id: number; current_amount?: number }) => {
      const { data } = await api.patch<Goal>(`/goals/${id}`, payload)
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["goals"] }),
  })
}

export function useDeleteGoal() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/goals/${id}`)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["goals"] }),
  })
}
