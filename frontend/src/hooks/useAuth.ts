import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { api } from "@/lib/api"
import type { User } from "@/types"

export function useMe() {
  return useQuery<User | null>({
    queryKey: ["me"],
    queryFn: async () => {
      try {
        const { data } = await api.get<User>("/auth/me")
        return data
      } catch {
        return null
      }
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  })
}

export function useLogin() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { login: string; password: string }) => {
      const { data } = await api.post<User>("/auth/login", payload)
      return data
    },
    onSuccess: (user) => queryClient.setQueryData(["me"], user),
  })
}

export function useRegister() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      email: string
      username: string
      password: string
      name: string
      base_currency: string
    }) => {
      const { data } = await api.post<User>("/auth/register", payload)
      return data
    },
    onSuccess: (user) => queryClient.setQueryData(["me"], user),
  })
}

export function useLogout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      await api.post("/auth/logout")
    },
    onSuccess: () => queryClient.setQueryData(["me"], null),
  })
}

export function useUpdateMe() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (
      payload: Partial<Pick<User, "name" | "base_currency" | "theme_preference" | "hide_accounts_balance">>
    ) => {
      const { data } = await api.patch<User>("/auth/me", payload)
      return data
    },
    onSuccess: (user) => queryClient.setQueryData(["me"], user),
  })
}

export function useUploadAvatar() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append("file", file)
      const { data } = await api.post<User>("/auth/me/avatar", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      return data
    },
    onSuccess: (user) => queryClient.setQueryData(["me"], user),
  })
}

export function useDeleteAvatar() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.delete<User>("/auth/me/avatar")
      return data
    },
    onSuccess: (user) => queryClient.setQueryData(["me"], user),
  })
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: async (email: string) => {
      const { data } = await api.post<{ detail: string }>("/auth/forgot-password", { email })
      return data
    },
  })
}

export function useResetPassword() {
  return useMutation({
    mutationFn: async (payload: { token: string; new_password: string }) => {
      const { data } = await api.post<{ detail: string }>("/auth/reset-password", payload)
      return data
    },
  })
}

export function useChangePassword() {
  return useMutation({
    mutationFn: async (payload: { current_password: string; new_password: string }) => {
      const { data } = await api.post<{ detail: string }>("/auth/change-password", payload)
      return data
    },
  })
}
