import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { api } from "@/lib/api"
import type { Account, AccountType } from "@/types"

export function useAccounts(includeArchived = false) {
  return useQuery<Account[]>({
    queryKey: ["accounts", includeArchived],
    queryFn: async () => {
      const { data } = await api.get<Account[]>("/accounts", {
        params: { include_archived: includeArchived },
      })
      return data
    },
  })
}

export interface AccountInput {
  name: string
  currency: string
  type: AccountType
  color: string
  initial_balance?: number
}

export function useCreateAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: AccountInput) => {
      const { data } = await api.post<Account>("/accounts", payload)
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["accounts"] }),
  })
}

export function useUpdateAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<AccountInput> & { id: number; is_archived?: boolean }) => {
      const { data } = await api.patch<Account>(`/accounts/${id}`, payload)
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["accounts"] }),
  })
}

export function useDeleteAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/accounts/${id}`)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["accounts"] }),
  })
}
