import axios from "axios"

const API_BASE = `${import.meta.env.VITE_API_URL ?? ""}/api`

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
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
