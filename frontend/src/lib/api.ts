import axios from "axios"

import { demoAdapter } from "@/lib/demo/adapter"
import { isDemoMode } from "@/lib/demo/store"

const API_BASE = `${import.meta.env.VITE_API_URL ?? ""}/api`

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
})

api.interceptors.request.use((config) => {
  if (isDemoMode()) config.adapter = demoAdapter
  return config
})

export function avatarUrl(userId: number): string {
  return `${API_BASE}/users/${userId}/avatar`
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    return Promise.reject(
      new Error(error.response?.data?.detail ?? error.message ?? "Ошибка запроса")
    )
  }
)
