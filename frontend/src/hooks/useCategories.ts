import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { api } from "@/lib/api"
import type { Category, CategoryType } from "@/types"

export function useCategories(type?: CategoryType) {
  return useQuery<Category[]>({
    queryKey: ["categories", type],
    queryFn: async () => {
      const { data } = await api.get<Category[]>("/categories", { params: { type } })
      return data
    },
  })
}

export interface CategoryInput {
  name: string
  type: CategoryType
  icon: string
  color: string
}

export function useCreateCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CategoryInput) => {
      const { data } = await api.post<Category>("/categories", payload)
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["categories"] }),
  })
}

export function useUpdateCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<CategoryInput> & { id: number }) => {
      const { data } = await api.patch<Category>(`/categories/${id}`, payload)
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["categories"] }),
  })
}

export function useDeleteCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/categories/${id}`)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["categories"] }),
  })
}
