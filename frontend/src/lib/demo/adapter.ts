// Axios adapter used instead of the network while demo mode is active (see lib/api.ts).
// Parses method+url+params+body and routes to the localStorage-backed handlers in ./store.
import type { AxiosResponse, InternalAxiosRequestConfig } from "axios"

import {
  copyBudgetsToNextMonth,
  createAccount,
  createBudget,
  createCategory,
  createGoal,
  createRecurring,
  createTransaction,
  deleteAccount,
  deleteBudget,
  deleteCategory,
  deleteForever,
  deleteGoal,
  deleteRecurring,
  deleteTransaction,
  DemoApiError,
  dashboardByCategory,
  dashboardSummary,
  dashboardTrend,
  exitDemoMode,
  getUser,
  listAccounts,
  listBudgets,
  listCategories,
  listGoals,
  listRecurring,
  listTrash,
  listTransactions,
  loadState,
  recurringSummary,
  restoreTrashItem,
  updateAccount,
  updateBudget,
  updateCategory,
  updateGoal,
  updateRecurring,
  updateTransaction,
  updateUser,
} from "@/lib/demo/store"
import type { DemoState } from "@/lib/demo/store"
import type { TransactionType } from "@/types"

function safeParse(data: unknown): Record<string, unknown> {
  if (data == null) return {}
  if (typeof data !== "string") return data as Record<string, unknown>
  try {
    return JSON.parse(data)
  } catch {
    return {}
  }
}

function matchId(url: string, prefix: string): number | null {
  const m = url.match(new RegExp(`^${prefix}/(\\d+)$`))
  return m ? Number(m[1]) : null
}

function route(
  state: DemoState,
  method: string,
  url: string,
  params: Record<string, unknown>,
  body: Record<string, unknown>
): { data: unknown; status: number } {
  // auth
  if (url === "/auth/me" && method === "GET") return { data: getUser(state), status: 200 }
  if (url === "/auth/me" && method === "PATCH") return { data: updateUser(state, body), status: 200 }
  if (url === "/auth/logout" && method === "POST") {
    exitDemoMode()
    return { data: null, status: 200 }
  }
  if (url === "/auth/me/avatar" && (method === "POST" || method === "DELETE")) {
    return { data: getUser(state), status: 200 }
  }
  if (
    (url === "/auth/login" ||
      url === "/auth/register" ||
      url === "/auth/forgot-password" ||
      url === "/auth/reset-password" ||
      url === "/auth/change-password") &&
    method === "POST"
  ) {
    throw new DemoApiError(400, "Недоступно в демо-режиме")
  }

  // accounts
  if (url === "/accounts" && method === "GET") return { data: listAccounts(state, Boolean(params.include_archived)), status: 200 }
  if (url === "/accounts" && method === "POST") return { data: createAccount(state, body), status: 201 }
  {
    const id = matchId(url, "/accounts")
    if (id != null && method === "PATCH") return { data: updateAccount(state, id, body), status: 200 }
    if (id != null && method === "DELETE") {
      deleteAccount(state, id)
      return { data: null, status: 204 }
    }
  }

  // categories
  if (url === "/categories" && method === "GET")
    return { data: listCategories(state, params.type as never), status: 200 }
  if (url === "/categories" && method === "POST") return { data: createCategory(state, body), status: 201 }
  {
    const id = matchId(url, "/categories")
    if (id != null && method === "PATCH") return { data: updateCategory(state, id, body), status: 200 }
    if (id != null && method === "DELETE") {
      deleteCategory(state, id)
      return { data: null, status: 204 }
    }
  }

  // transactions
  if (url === "/transactions" && method === "GET") {
    return {
      data: listTransactions(state, {
        date_from: params.date_from as string | undefined,
        date_to: params.date_to as string | undefined,
        account_id: params.account_id != null ? Number(params.account_id) : undefined,
        category_id: params.category_id != null ? Number(params.category_id) : undefined,
        type: params.type as TransactionType | undefined,
        amount_min: params.amount_min != null ? Number(params.amount_min) : undefined,
        amount_max: params.amount_max != null ? Number(params.amount_max) : undefined,
        search: params.search as string | undefined,
        page: Number(params.page ?? 1),
        page_size: Number(params.page_size ?? 50),
      }),
      status: 200,
    }
  }
  if (url === "/transactions" && method === "POST") return { data: createTransaction(state, body), status: 201 }
  {
    const id = matchId(url, "/transactions")
    if (id != null && method === "PATCH") return { data: updateTransaction(state, id, body), status: 200 }
    if (id != null && method === "DELETE") {
      deleteTransaction(state, id)
      return { data: null, status: 204 }
    }
  }

  // budgets
  if (url === "/budgets" && method === "GET") return { data: listBudgets(state, params.month as string | undefined), status: 200 }
  if (url === "/budgets" && method === "POST") return { data: createBudget(state, body), status: 201 }
  if (url === "/budgets/copy-to-next-month" && method === "POST")
    return { data: copyBudgetsToNextMonth(state, String(params.month)), status: 200 }
  {
    const id = matchId(url, "/budgets")
    if (id != null && method === "PATCH") return { data: updateBudget(state, id, body), status: 200 }
    if (id != null && method === "DELETE") {
      deleteBudget(state, id)
      return { data: null, status: 204 }
    }
  }

  // recurring
  if (url === "/recurring" && method === "GET") return { data: listRecurring(state, Boolean(params.include_inactive)), status: 200 }
  if (url === "/recurring/summary" && method === "GET") return { data: recurringSummary(state), status: 200 }
  if (url === "/recurring" && method === "POST") return { data: createRecurring(state, body), status: 201 }
  {
    const id = matchId(url, "/recurring")
    if (id != null && method === "PATCH") return { data: updateRecurring(state, id, body), status: 200 }
    if (id != null && method === "DELETE") {
      deleteRecurring(state, id)
      return { data: null, status: 204 }
    }
  }

  // goals
  if (url === "/goals" && method === "GET") return { data: listGoals(state), status: 200 }
  if (url === "/goals" && method === "POST") return { data: createGoal(state, body), status: 201 }
  {
    const id = matchId(url, "/goals")
    if (id != null && method === "PATCH") return { data: updateGoal(state, id, body), status: 200 }
    if (id != null && method === "DELETE") {
      deleteGoal(state, id)
      return { data: null, status: 204 }
    }
  }

  // trash
  if (url === "/trash" && method === "GET") return { data: listTrash(state), status: 200 }
  {
    const restoreMatch = url.match(/^\/trash\/([a-z]+)\/(\d+)\/restore$/)
    if (restoreMatch && method === "POST") {
      restoreTrashItem(state, restoreMatch[1], Number(restoreMatch[2]))
      return { data: null, status: 204 }
    }
    const deleteMatch = url.match(/^\/trash\/([a-z]+)\/(\d+)$/)
    if (deleteMatch && method === "DELETE") {
      deleteForever(state, deleteMatch[1], Number(deleteMatch[2]))
      return { data: null, status: 204 }
    }
  }

  // dashboard
  if (url === "/dashboard/summary" && method === "GET")
    return { data: dashboardSummary(state, params.date_from as string | undefined, params.date_to as string | undefined), status: 200 }
  if (url === "/dashboard/trend" && method === "GET")
    return { data: dashboardTrend(state, Number(params.months ?? 6)), status: 200 }
  if (url === "/dashboard/by-category" && method === "GET")
    return {
      data: dashboardByCategory(state, String(params.date_from), String(params.date_to), (params.type as TransactionType) ?? "expense"),
      status: 200,
    }

  throw new DemoApiError(404, "Не найдено в демо-режиме")
}

function respond(config: InternalAxiosRequestConfig, data: unknown, status: number): Promise<AxiosResponse> {
  return Promise.resolve({ data, status, statusText: "OK", headers: {}, config })
}

function fail(status: number, detail: string): Promise<never> {
  const error = new Error(detail) as Error & { response: { status: number; data: { detail: string } } }
  error.response = { status, data: { detail } }
  return Promise.reject(error)
}

export function demoAdapter(config: InternalAxiosRequestConfig): Promise<AxiosResponse> {
  const method = String(config.method ?? "get").toUpperCase()
  const url = (config.url ?? "").split("?")[0]
  const params = (config.params as Record<string, unknown>) ?? {}
  const body = safeParse(config.data)

  try {
    const state = loadState()
    const result = route(state, method, url, params, body)
    return respond(config, result.data, result.status)
  } catch (e) {
    if (e instanceof DemoApiError) return fail(e.status, e.message)
    return fail(500, e instanceof Error ? e.message : "Ошибка демо-режима")
  }
}
