import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { api } from "@/lib/api"
import type { TrashItem, TrashResourceType } from "@/types"

export function useTrash() {
  return useQuery<TrashItem[]>({
    queryKey: ["trash"],
    queryFn: async () => {
      const { data } = await api.get<TrashItem[]>("/trash")
      return data
    },
  })
}

function invalidateAfterTrashMutation(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["trash"] })
  queryClient.invalidateQueries({ queryKey: ["accounts"] })
  queryClient.invalidateQueries({ queryKey: ["transactions"] })
  queryClient.invalidateQueries({ queryKey: ["categories"] })
  queryClient.invalidateQueries({ queryKey: ["budgets"] })
  queryClient.invalidateQueries({ queryKey: ["recurring"] })
  queryClient.invalidateQueries({ queryKey: ["goals"] })
  queryClient.invalidateQueries({ queryKey: ["dashboard"] })
}

export function useRestoreTrashItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ resourceType, id }: { resourceType: TrashResourceType; id: number }) => {
      await api.post(`/trash/${resourceType}/${id}/restore`)
    },
    onSuccess: () => invalidateAfterTrashMutation(queryClient),
  })
}

export function useDeleteForever() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ resourceType, id }: { resourceType: TrashResourceType; id: number }) => {
      await api.delete(`/trash/${resourceType}/${id}`)
    },
    onSuccess: () => invalidateAfterTrashMutation(queryClient),
  })
}
