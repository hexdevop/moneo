// Fully client-side "try the demo" mode: no backend calls at all. Everything lives in
// localStorage, single currency (UZS, rate always 1 — no cross-currency conversion to
// duplicate from the backend's currency service). See lib/demo/adapter.ts for the axios
// adapter that routes API calls here instead of the network.
import { addMonths, endOfMonth, startOfMonth, subMonths } from "date-fns"

import { toLocalISODate } from "@/lib/format"
import type {
  Account,
  AccountType,
  Budget,
  Category,
  CategoryBreakdown,
  CategoryType,
  DashboardSummary,
  Goal,
  Page,
  RecurrenceFrequency,
  RecurringPayment,
  ThemePreference,
  Transaction,
  TransactionType,
  TrashItem,
  TrashResourceType,
  TrendPoint,
  User,
} from "@/types"

const ACTIVE_KEY = "moneo_demo_active"
const STATE_KEY = "moneo_demo_state_v1"
export const DEMO_CURRENCY = "UZS"

export class DemoApiError extends Error {
  status: number
  constructor(status: number, detail: string) {
    super(detail)
    this.status = status
  }
}

interface AccountRow {
  id: number
  name: string
  currency: string
  type: AccountType
  color: string
  is_archived: boolean
  deleted_at: string | null
}
interface CategoryRow {
  id: number
  user_id: number | null
  name: string
  type: CategoryType
  icon: string
  color: string
  deleted_at: string | null
}
interface TransactionRow {
  id: number
  account_id: number
  transfer_account_id: number | null
  category_id: number | null
  type: TransactionType
  amount: number
  currency: string
  date: string
  note: string | null
  tags: string[] | null
  fee: number | null
  deleted_at: string | null
}
interface BudgetRow {
  id: number
  category_id: number
  month: string
  limit_amount: number
  currency: string
  deleted_at: string | null
}
interface RecurringRow {
  id: number
  account_id: number
  category_id: number | null
  name: string
  amount: number
  currency: string
  frequency: RecurrenceFrequency
  next_date: string
  is_active: boolean
  deleted_at: string | null
}
interface GoalRow {
  id: number
  name: string
  target_amount: number
  current_amount: number
  currency: string
  deadline: string | null
  linked_account_id: number | null
  deleted_at: string | null
}
interface UserRow {
  id: number
  email: string
  username: string
  name: string
  base_currency: string
  theme_preference: ThemePreference
  hide_accounts_balance: boolean
  has_avatar: boolean
}

interface DemoState {
  seq: number
  user: UserRow
  accounts: AccountRow[]
  categories: CategoryRow[]
  transactions: TransactionRow[]
  budgets: BudgetRow[]
  recurring: RecurringRow[]
  goals: GoalRow[]
}

// ---- small local helpers (avoid timezone footguns from `new Date(isoString)`) ----

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
function round1(n: number): number {
  return Math.round(n * 10) / 10
}
function round4(n: number): number {
  return Math.round(n * 10000) / 10000
}
function parseISODate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number)
  return new Date(y, m - 1, d)
}
function nextId(state: DemoState): number {
  state.seq += 1
  return state.seq
}

// ---- persistence ----

function buildInitialState(): DemoState {
  return seedFixtures()
}

function loadState(): DemoState {
  try {
    const raw = localStorage.getItem(STATE_KEY)
    if (raw) return JSON.parse(raw) as DemoState
  } catch {
    // fall through to a fresh seed
  }
  const state = buildInitialState()
  saveState(state)
  return state
}

function saveState(state: DemoState): void {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state))
  } catch {
    // storage full/unavailable — demo just won't persist across reloads
  }
}

export function isDemoMode(): boolean {
  try {
    return localStorage.getItem(ACTIVE_KEY) === "1"
  } catch {
    return false
  }
}

export function enterDemoMode(): void {
  try {
    localStorage.setItem(ACTIVE_KEY, "1")
    if (!localStorage.getItem(STATE_KEY)) saveState(buildInitialState())
  } catch {
    // ignore — demo just won't be available
  }
}

export function exitDemoMode(): void {
  try {
    localStorage.removeItem(ACTIVE_KEY)
    localStorage.removeItem(STATE_KEY)
  } catch {
    // ignore
  }
}

export function resetDemoData(): void {
  saveState(buildInitialState())
}

export function getDemoUser(): User {
  return toUserOut(loadState().user)
}

// ---- output mappers (mirror the backend's *Out shapes; rate is always 1) ----

function toUserOut(row: UserRow): User {
  return { ...row }
}

function computeAccountBalances(state: DemoState): Record<number, number> {
  const balances: Record<number, number> = {}
  for (const t of state.transactions) {
    if (t.deleted_at) continue
    const signed = t.type === "income" ? t.amount : -t.amount
    balances[t.account_id] = (balances[t.account_id] ?? 0) + signed - (t.fee ?? 0)
    if (t.type === "transfer" && t.transfer_account_id != null) {
      balances[t.transfer_account_id] = (balances[t.transfer_account_id] ?? 0) + t.amount
    }
  }
  return balances
}

function toAccountOut(state: DemoState, row: AccountRow): Account {
  const balance = round2(computeAccountBalances(state)[row.id] ?? 0)
  return {
    id: row.id,
    name: row.name,
    currency: row.currency,
    type: row.type,
    color: row.color,
    is_archived: row.is_archived,
    balance,
    balance_base: balance,
  }
}

function toCategoryOut(row: CategoryRow): Category {
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    type: row.type,
    icon: row.icon,
    color: row.color,
    is_preset: row.user_id === null,
  }
}

function toTransactionOut(row: TransactionRow): Transaction {
  return {
    id: row.id,
    account_id: row.account_id,
    transfer_account_id: row.transfer_account_id,
    category_id: row.category_id,
    type: row.type,
    amount: row.amount,
    currency: row.currency,
    exchange_rate_to_base: 1,
    amount_base: row.amount,
    date: row.date,
    note: row.note,
    tags: row.tags,
    fee: row.fee,
  }
}

const GREEN_THRESHOLD = 0.7
const YELLOW_THRESHOLD = 1.0

function toBudgetOut(state: DemoState, row: BudgetRow): Budget {
  const monthEnd = toLocalISODate(addMonths(parseISODate(row.month), 1))
  const spent = round2(
    state.transactions
      .filter(
        (t) =>
          !t.deleted_at &&
          t.category_id === row.category_id &&
          t.type === "expense" &&
          t.date >= row.month &&
          t.date < monthEnd
      )
      .reduce((sum, t) => sum + t.amount, 0)
  )
  const progress = row.limit_amount ? spent / row.limit_amount : 0
  const status = progress < GREEN_THRESHOLD ? "green" : progress <= YELLOW_THRESHOLD ? "yellow" : "red"
  return {
    id: row.id,
    category_id: row.category_id,
    month: row.month,
    limit_amount: row.limit_amount,
    currency: row.currency,
    spent,
    spent_base: spent,
    progress: round4(progress),
    status,
  }
}

const MONTHLY_FACTOR: Record<RecurrenceFrequency, number> = {
  weekly: 52 / 12,
  monthly: 1,
  yearly: 1 / 12,
}

function toRecurringOut(row: RecurringRow): RecurringPayment {
  return {
    id: row.id,
    account_id: row.account_id,
    category_id: row.category_id,
    name: row.name,
    amount: row.amount,
    currency: row.currency,
    frequency: row.frequency,
    next_date: row.next_date,
    is_active: row.is_active,
    monthly_amount_base: round2(row.amount * MONTHLY_FACTOR[row.frequency]),
  }
}

function monthsRemaining(deadline: string): number {
  const d = parseISODate(deadline)
  const today = new Date()
  let months = (d.getFullYear() - today.getFullYear()) * 12 + (d.getMonth() - today.getMonth())
  if (d.getDate() > today.getDate()) months += 1
  return Math.max(months, 1)
}

function toGoalOut(row: GoalRow): Goal {
  const remaining = Math.max(row.target_amount - row.current_amount, 0)
  const recommended = row.deadline && remaining > 0 ? round2(remaining / monthsRemaining(row.deadline)) : null
  return {
    id: row.id,
    name: row.name,
    target_amount: row.target_amount,
    current_amount: row.current_amount,
    current_amount_base: row.current_amount,
    currency: row.currency,
    deadline: row.deadline,
    linked_account_id: row.linked_account_id,
    progress: row.target_amount ? round4(row.current_amount / row.target_amount) : 0,
    recommended_monthly_contribution: recommended,
  }
}

// ---- ownership lookups (mirror the backend's 404/400 checks) ----

function getOwnedAccount(state: DemoState, id: number): AccountRow {
  const row = state.accounts.find((a) => a.id === id && !a.deleted_at)
  if (!row) throw new DemoApiError(404, "Счёт не найден")
  return row
}
function checkOwnedAccountRef(state: DemoState, id: number | null | undefined): void {
  if (id == null) return
  const row = state.accounts.find((a) => a.id === id)
  if (!row || row.deleted_at) throw new DemoApiError(400, "Счёт не найден")
}
function checkOwnedCategoryRef(state: DemoState, id: number | null | undefined): void {
  if (id == null) return
  const row = state.categories.find((c) => c.id === id)
  if (!row || row.deleted_at) throw new DemoApiError(400, "Категория не найдена")
}
function getOwnedCategory(state: DemoState, id: number): CategoryRow {
  const row = state.categories.find((c) => c.id === id && c.user_id === state.user.id && !c.deleted_at)
  if (!row) throw new DemoApiError(404, "Категория не найдена")
  return row
}
function getOwnedTransaction(state: DemoState, id: number): TransactionRow {
  const row = state.transactions.find((t) => t.id === id && !t.deleted_at)
  if (!row) throw new DemoApiError(404, "Транзакция не найдена")
  return row
}
function getOwnedBudget(state: DemoState, id: number): BudgetRow {
  const row = state.budgets.find((b) => b.id === id && !b.deleted_at)
  if (!row) throw new DemoApiError(404, "Бюджет не найден")
  return row
}
function getOwnedRecurring(state: DemoState, id: number): RecurringRow {
  const row = state.recurring.find((r) => r.id === id && !r.deleted_at)
  if (!row) throw new DemoApiError(404, "Регулярный платёж не найден")
  return row
}
function getOwnedGoal(state: DemoState, id: number): GoalRow {
  const row = state.goals.find((g) => g.id === id && !g.deleted_at)
  if (!row) throw new DemoApiError(404, "Цель не найдена")
  return row
}

// ---- accounts ----

export function listAccounts(state: DemoState, includeArchived: boolean): Account[] {
  return state.accounts
    .filter((a) => !a.deleted_at && (includeArchived || !a.is_archived))
    .map((a) => toAccountOut(state, a))
}

export function createAccount(state: DemoState, payload: Record<string, unknown>): Account {
  const id = nextId(state)
  const row: AccountRow = {
    id,
    name: String(payload.name),
    currency: String(payload.currency ?? DEMO_CURRENCY).toUpperCase(),
    type: payload.type as AccountType,
    color: String(payload.color),
    is_archived: false,
    deleted_at: null,
  }
  state.accounts.push(row)
  const initialBalance = Number(payload.initial_balance ?? 0)
  if (initialBalance) {
    state.transactions.push({
      id: nextId(state),
      account_id: id,
      transfer_account_id: null,
      category_id: null,
      type: initialBalance > 0 ? "income" : "expense",
      amount: Math.abs(initialBalance),
      currency: row.currency,
      date: toLocalISODate(new Date()),
      note: "Начальный баланс",
      tags: null,
      fee: null,
      deleted_at: null,
    })
  }
  saveState(state)
  return toAccountOut(state, row)
}

export function updateAccount(state: DemoState, id: number, payload: Record<string, unknown>): Account {
  const row = getOwnedAccount(state, id)
  Object.assign(row, payload)
  saveState(state)
  return toAccountOut(state, row)
}

export function deleteAccount(state: DemoState, id: number): void {
  const row = getOwnedAccount(state, id)
  row.deleted_at = new Date().toISOString()
  saveState(state)
}

// ---- categories ----

export function listCategories(state: DemoState, type: CategoryType | undefined): Category[] {
  return state.categories
    .filter((c) => !c.deleted_at && (c.user_id === null || c.user_id === state.user.id) && (!type || c.type === type))
    .map(toCategoryOut)
}

export function createCategory(state: DemoState, payload: Record<string, unknown>): Category {
  const row: CategoryRow = {
    id: nextId(state),
    user_id: state.user.id,
    name: String(payload.name),
    type: payload.type as CategoryType,
    icon: String(payload.icon),
    color: String(payload.color),
    deleted_at: null,
  }
  state.categories.push(row)
  saveState(state)
  return toCategoryOut(row)
}

export function updateCategory(state: DemoState, id: number, payload: Record<string, unknown>): Category {
  const row = getOwnedCategory(state, id)
  Object.assign(row, payload)
  saveState(state)
  return toCategoryOut(row)
}

export function deleteCategory(state: DemoState, id: number): void {
  const row = getOwnedCategory(state, id)
  row.deleted_at = new Date().toISOString()
  saveState(state)
}

// ---- transactions ----

export interface TransactionListParams {
  date_from?: string
  date_to?: string
  account_id?: number
  category_id?: number
  type?: TransactionType
  amount_min?: number
  amount_max?: number
  search?: string
  page: number
  page_size: number
}

export function listTransactions(state: DemoState, filters: TransactionListParams): Page<Transaction> {
  let items = state.transactions.filter((t) => !t.deleted_at)
  if (filters.date_from) items = items.filter((t) => t.date >= filters.date_from!)
  if (filters.date_to) items = items.filter((t) => t.date <= filters.date_to!)
  if (filters.account_id != null) items = items.filter((t) => t.account_id === Number(filters.account_id))
  if (filters.category_id != null) items = items.filter((t) => t.category_id === Number(filters.category_id))
  if (filters.type) items = items.filter((t) => t.type === filters.type)
  if (filters.amount_min != null) items = items.filter((t) => t.amount >= Number(filters.amount_min))
  if (filters.amount_max != null) items = items.filter((t) => t.amount <= Number(filters.amount_max))
  if (filters.search) {
    const q = filters.search.toLowerCase()
    items = items.filter((t) => (t.note ?? "").toLowerCase().includes(q) || (t.tags ?? []).includes(filters.search!))
  }
  items = [...items].sort((a, b) => (a.date === b.date ? b.id - a.id : a.date < b.date ? 1 : -1))

  const total = items.length
  const page = filters.page || 1
  const pageSize = filters.page_size || 50
  const start = (page - 1) * pageSize
  return {
    items: items.slice(start, start + pageSize).map(toTransactionOut),
    total,
    page,
    page_size: pageSize,
  }
}

export function createTransaction(state: DemoState, payload: Record<string, unknown>): Transaction {
  const accountId = Number(payload.account_id)
  checkOwnedAccountRef(state, accountId)
  const transferAccountId = payload.transfer_account_id != null ? Number(payload.transfer_account_id) : null
  checkOwnedAccountRef(state, transferAccountId)
  const categoryId = payload.category_id != null ? Number(payload.category_id) : null
  checkOwnedCategoryRef(state, categoryId)

  const row: TransactionRow = {
    id: nextId(state),
    account_id: accountId,
    transfer_account_id: transferAccountId,
    category_id: categoryId,
    type: payload.type as TransactionType,
    amount: Number(payload.amount),
    currency: String(payload.currency).toUpperCase(),
    date: String(payload.date),
    note: (payload.note as string | null | undefined) ?? null,
    tags: (payload.tags as string[] | null | undefined) ?? null,
    fee: payload.fee != null ? Number(payload.fee) : null,
    deleted_at: null,
  }
  state.transactions.push(row)
  saveState(state)
  return toTransactionOut(row)
}

export function updateTransaction(state: DemoState, id: number, payload: Record<string, unknown>): Transaction {
  const row = getOwnedTransaction(state, id)
  if ("account_id" in payload) checkOwnedAccountRef(state, Number(payload.account_id))
  if ("transfer_account_id" in payload) checkOwnedAccountRef(state, payload.transfer_account_id as number | null)
  if ("category_id" in payload) checkOwnedCategoryRef(state, payload.category_id as number | null)
  if ("currency" in payload) payload.currency = String(payload.currency).toUpperCase()
  Object.assign(row, payload)
  saveState(state)
  return toTransactionOut(row)
}

export function deleteTransaction(state: DemoState, id: number): void {
  const row = getOwnedTransaction(state, id)
  row.deleted_at = new Date().toISOString()
  saveState(state)
}

// ---- budgets ----

export function listBudgets(state: DemoState, month: string | undefined): Budget[] {
  return state.budgets
    .filter((b) => !b.deleted_at && (!month || b.month === month))
    .sort((a, b) => (a.month < b.month ? 1 : -1))
    .map((b) => toBudgetOut(state, b))
}

export function createBudget(state: DemoState, payload: Record<string, unknown>): Budget {
  const categoryId = Number(payload.category_id)
  checkOwnedCategoryRef(state, categoryId)
  const month = String(payload.month)
  const exists = state.budgets.some((b) => !b.deleted_at && b.category_id === categoryId && b.month === month)
  if (exists) throw new DemoApiError(409, "Бюджет на эту категорию и месяц уже существует")

  const row: BudgetRow = {
    id: nextId(state),
    category_id: categoryId,
    month,
    limit_amount: Number(payload.limit_amount),
    currency: String(payload.currency).toUpperCase(),
    deleted_at: null,
  }
  state.budgets.push(row)
  saveState(state)
  return toBudgetOut(state, row)
}

export function updateBudget(state: DemoState, id: number, payload: Record<string, unknown>): Budget {
  const row = getOwnedBudget(state, id)
  Object.assign(row, payload)
  saveState(state)
  return toBudgetOut(state, row)
}

export function deleteBudget(state: DemoState, id: number): void {
  const row = getOwnedBudget(state, id)
  row.deleted_at = new Date().toISOString()
  saveState(state)
}

export function copyBudgetsToNextMonth(state: DemoState, month: string): Budget[] {
  const nextMonth = toLocalISODate(addMonths(parseISODate(month), 1))
  const current = state.budgets.filter((b) => !b.deleted_at && b.month === month)
  const existingNext = new Set(
    state.budgets.filter((b) => !b.deleted_at && b.month === nextMonth).map((b) => b.category_id)
  )
  const created: BudgetRow[] = []
  for (const b of current) {
    if (existingNext.has(b.category_id)) continue
    const row: BudgetRow = {
      id: nextId(state),
      category_id: b.category_id,
      month: nextMonth,
      limit_amount: b.limit_amount,
      currency: b.currency,
      deleted_at: null,
    }
    state.budgets.push(row)
    created.push(row)
  }
  saveState(state)
  return created.map((b) => toBudgetOut(state, b))
}

// ---- recurring payments ----

export function listRecurring(state: DemoState, includeInactive: boolean): RecurringPayment[] {
  return state.recurring
    .filter((r) => !r.deleted_at && (includeInactive || r.is_active))
    .sort((a, b) => (a.next_date < b.next_date ? -1 : 1))
    .map(toRecurringOut)
}

export function recurringSummary(state: DemoState): { monthly_total_base: number; currency: string; count: number } {
  const rows = state.recurring.filter((r) => !r.deleted_at && r.is_active)
  const total = round2(rows.reduce((sum, r) => sum + r.amount * MONTHLY_FACTOR[r.frequency], 0))
  return { monthly_total_base: total, currency: state.user.base_currency, count: rows.length }
}

export function createRecurring(state: DemoState, payload: Record<string, unknown>): RecurringPayment {
  checkOwnedAccountRef(state, Number(payload.account_id))
  checkOwnedCategoryRef(state, payload.category_id as number | null | undefined)
  const row: RecurringRow = {
    id: nextId(state),
    account_id: Number(payload.account_id),
    category_id: (payload.category_id as number | null | undefined) ?? null,
    name: String(payload.name),
    amount: Number(payload.amount),
    currency: String(payload.currency).toUpperCase(),
    frequency: payload.frequency as RecurrenceFrequency,
    next_date: String(payload.next_date),
    is_active: true,
    deleted_at: null,
  }
  state.recurring.push(row)
  saveState(state)
  return toRecurringOut(row)
}

export function updateRecurring(state: DemoState, id: number, payload: Record<string, unknown>): RecurringPayment {
  const row = getOwnedRecurring(state, id)
  if ("account_id" in payload) checkOwnedAccountRef(state, Number(payload.account_id))
  if ("category_id" in payload) checkOwnedCategoryRef(state, payload.category_id as number | null)
  Object.assign(row, payload)
  saveState(state)
  return toRecurringOut(row)
}

export function deleteRecurring(state: DemoState, id: number): void {
  const row = getOwnedRecurring(state, id)
  row.deleted_at = new Date().toISOString()
  saveState(state)
}

// ---- goals ----

export function listGoals(state: DemoState): Goal[] {
  return state.goals
    .filter((g) => !g.deleted_at)
    .sort((a, b) => a.id - b.id)
    .map(toGoalOut)
}

export function createGoal(state: DemoState, payload: Record<string, unknown>): Goal {
  checkOwnedAccountRef(state, payload.linked_account_id as number | null | undefined)
  const row: GoalRow = {
    id: nextId(state),
    name: String(payload.name),
    target_amount: Number(payload.target_amount),
    current_amount: 0,
    currency: String(payload.currency).toUpperCase(),
    deadline: (payload.deadline as string | null | undefined) ?? null,
    linked_account_id: (payload.linked_account_id as number | null | undefined) ?? null,
    deleted_at: null,
  }
  state.goals.push(row)
  saveState(state)
  return toGoalOut(row)
}

export function updateGoal(state: DemoState, id: number, payload: Record<string, unknown>): Goal {
  const row = getOwnedGoal(state, id)
  if ("linked_account_id" in payload) checkOwnedAccountRef(state, payload.linked_account_id as number | null)
  Object.assign(row, payload)
  saveState(state)
  return toGoalOut(row)
}

export function deleteGoal(state: DemoState, id: number): void {
  const row = getOwnedGoal(state, id)
  row.deleted_at = new Date().toISOString()
  saveState(state)
}

// ---- auth ----

export function getUser(state: DemoState): User {
  return toUserOut(state.user)
}

export function updateUser(state: DemoState, payload: Record<string, unknown>): User {
  Object.assign(state.user, payload)
  saveState(state)
  return toUserOut(state.user)
}

// ---- trash ----

function formatMonthShort(month: string): string {
  const [y, m] = month.split("-")
  return `${m}.${y}`
}

export function listTrash(state: DemoState): TrashItem[] {
  const items: TrashItem[] = []
  for (const a of state.accounts) if (a.deleted_at) items.push({ resource_type: "account", id: a.id, label: a.name, subtitle: null, deleted_at: a.deleted_at })
  for (const t of state.transactions)
    if (t.deleted_at)
      items.push({ resource_type: "transaction", id: t.id, label: `${t.amount} ${t.currency}`, subtitle: t.note, deleted_at: t.deleted_at })
  for (const c of state.categories) if (c.deleted_at) items.push({ resource_type: "category", id: c.id, label: c.name, subtitle: null, deleted_at: c.deleted_at })
  for (const b of state.budgets)
    if (b.deleted_at) {
      const category = state.categories.find((c) => c.id === b.category_id)
      items.push({
        resource_type: "budget",
        id: b.id,
        label: category?.name ?? "Категория удалена",
        subtitle: formatMonthShort(b.month),
        deleted_at: b.deleted_at,
      })
    }
  for (const r of state.recurring)
    if (r.deleted_at) items.push({ resource_type: "recurring", id: r.id, label: r.name, subtitle: `${r.amount} ${r.currency}`, deleted_at: r.deleted_at })
  for (const g of state.goals) if (g.deleted_at) items.push({ resource_type: "goal", id: g.id, label: g.name, subtitle: null, deleted_at: g.deleted_at })
  return items.sort((a, b) => (a.deleted_at < b.deleted_at ? 1 : -1))
}

const RESOURCE_ARRAYS = {
  account: "accounts",
  transaction: "transactions",
  category: "categories",
  budget: "budgets",
  recurring: "recurring",
  goal: "goals",
} as const satisfies Record<TrashResourceType, keyof DemoState>

function findTrashed(state: DemoState, resourceType: string, id: number) {
  const key = RESOURCE_ARRAYS[resourceType as TrashResourceType]
  if (!key) throw new DemoApiError(404, "Неизвестный тип объекта")
  const arr = state[key] as { id: number; deleted_at: string | null }[]
  const row = arr.find((r) => r.id === id && r.deleted_at)
  if (!row) throw new DemoApiError(404, "Объект не найден в корзине")
  return { arr, row }
}

export function restoreTrashItem(state: DemoState, resourceType: string, id: number): void {
  const { row } = findTrashed(state, resourceType, id)
  row.deleted_at = null
  saveState(state)
}

export function deleteForever(state: DemoState, resourceType: string, id: number): void {
  const { arr, row } = findTrashed(state, resourceType, id)
  if (resourceType === "account") {
    const inUse = state.transactions.some((t) => !t.deleted_at && (t.account_id === id || t.transfer_account_id === id))
    if (inUse) throw new DemoApiError(409, "У счёта есть активные транзакции — сначала удалите их из корзины навсегда")
    const inUseRecurring = state.recurring.some((r) => !r.deleted_at && r.account_id === id)
    if (inUseRecurring)
      throw new DemoApiError(409, "У счёта есть активные регулярные платежи — сначала удалите их из корзины навсегда")
  }
  if (resourceType === "category") {
    const inUse = state.transactions.some((t) => !t.deleted_at && t.category_id === id)
    if (inUse) throw new DemoApiError(409, "Категория используется в транзакциях")
  }
  arr.splice(arr.indexOf(row), 1)
  saveState(state)
}

// ---- dashboard ----

function monthBounds(d: Date): [string, string] {
  return [toLocalISODate(startOfMonth(d)), toLocalISODate(endOfMonth(d))]
}

function topCategories(
  state: DemoState,
  from: string,
  to: string,
  type: TransactionType,
  limit: number
): { category_id: number; name: string; icon: string; color: string; amount_base: number }[] {
  const totals = new Map<number, number>()
  for (const t of state.transactions) {
    if (t.deleted_at || t.type !== type || t.category_id == null) continue
    if (t.date < from || t.date > to) continue
    totals.set(t.category_id, (totals.get(t.category_id) ?? 0) + t.amount)
  }
  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([categoryId, total]) => {
      const category = state.categories.find((c) => c.id === categoryId)
      return {
        category_id: categoryId,
        name: category?.name ?? "",
        icon: category?.icon ?? "circle",
        color: category?.color ?? "#64748b",
        amount_base: round2(total),
      }
    })
}

export function dashboardSummary(state: DemoState, dateFrom?: string, dateTo?: string): DashboardSummary {
  let from = dateFrom
  let to = dateTo
  if (!from || !to) {
    const [start, end] = monthBounds(new Date())
    from = from ?? start
    to = to ?? end
  }
  const inRange = state.transactions.filter((t) => !t.deleted_at && t.date >= from! && t.date <= to!)
  const income = round2(inRange.filter((t) => t.type === "income").reduce((sum, t) => sum + t.amount, 0))
  const expense = round2(inRange.filter((t) => t.type === "expense").reduce((sum, t) => sum + t.amount, 0))
  const balances = computeAccountBalances(state)
  const activeAccounts = state.accounts.filter((a) => !a.deleted_at && !a.is_archived)
  const balanceTotal = round2(activeAccounts.reduce((sum, a) => sum + (balances[a.id] ?? 0), 0))

  return {
    date_from: from!,
    date_to: to!,
    income_base: income,
    expense_base: expense,
    balance_total_base: balanceTotal,
    currency: state.user.base_currency,
    top_expense_categories: topCategories(state, from!, to!, "expense", 5),
  }
}

export function dashboardByCategory(state: DemoState, from: string, to: string, type: TransactionType): CategoryBreakdown {
  const categories = topCategories(state, from, to, type, 1000)
  const total = round2(categories.reduce((sum, c) => sum + c.amount_base, 0))
  return {
    total_base: total,
    categories: categories.map((c) => ({ ...c, percent: total ? round1((c.amount_base / total) * 100) : 0 })),
  }
}

export function dashboardTrend(state: DemoState, months: number): TrendPoint[] {
  const start = startOfMonth(subMonths(new Date(), months - 1))
  const result: TrendPoint[] = []
  for (let i = 0; i < months; i++) {
    const [from, to] = monthBounds(addMonths(start, i))
    const inRange = state.transactions.filter((t) => !t.deleted_at && t.date >= from && t.date <= to)
    result.push({
      month: from,
      income_base: round2(inRange.filter((t) => t.type === "income").reduce((sum, t) => sum + t.amount, 0)),
      expense_base: round2(inRange.filter((t) => t.type === "expense").reduce((sum, t) => sum + t.amount, 0)),
    })
  }
  return result
}

// ---- fixtures: ~6 months of a plausible Uzbekistan budget, all in UZS ----

const PRESET_CATEGORIES: { name: string; type: CategoryType; icon: string; color: string }[] = [
  { name: "Еда", type: "expense", icon: "utensils", color: "#f97316" },
  { name: "Транспорт", type: "expense", icon: "car", color: "#3b82f6" },
  { name: "Жильё", type: "expense", icon: "home", color: "#8b5cf6" },
  { name: "Развлечения", type: "expense", icon: "gamepad-2", color: "#ec4899" },
  { name: "Здоровье", type: "expense", icon: "heart-pulse", color: "#ef4444" },
  { name: "Одежда", type: "expense", icon: "shirt", color: "#14b8a6" },
  { name: "Связь и интернет", type: "expense", icon: "wifi", color: "#06b6d4" },
  { name: "Образование", type: "expense", icon: "book-open", color: "#6366f1" },
  { name: "Подписки", type: "expense", icon: "repeat", color: "#a855f7" },
  { name: "Перевод близким", type: "expense", icon: "send", color: "#f43f5e" },
  { name: "Дал в долг", type: "expense", icon: "hand-coins", color: "#eab308" },
  { name: "Вернул долг", type: "expense", icon: "undo-2", color: "#84cc16" },
  { name: "Прочее", type: "expense", icon: "more-horizontal", color: "#64748b" },
  { name: "Зарплата", type: "income", icon: "banknote", color: "#22c55e" },
  { name: "Фриланс", type: "income", icon: "briefcase", color: "#0ea5e9" },
  { name: "Инвестиции", type: "income", icon: "trending-up", color: "#10b981" },
  { name: "Подарки", type: "income", icon: "gift", color: "#f59e0b" },
  { name: "От близких", type: "income", icon: "send", color: "#f43f5e" },
  { name: "Взял в долг", type: "income", icon: "landmark", color: "#eab308" },
  { name: "Долг вернули", type: "income", icon: "hand-coins", color: "#84cc16" },
  { name: "Прочее", type: "income", icon: "more-horizontal", color: "#64748b" },
]

function monthStart(monthsAgo: number): string {
  return toLocalISODate(startOfMonth(subMonths(new Date(), monthsAgo)))
}
function dayInMonth(monthsAgo: number, day: number): string {
  const start = startOfMonth(subMonths(new Date(), monthsAgo))
  const lastDay = endOfMonth(start).getDate()
  return toLocalISODate(new Date(start.getFullYear(), start.getMonth(), Math.min(day, lastDay)))
}

function seedFixtures(): DemoState {
  const state: DemoState = {
    seq: 0,
    user: {
      id: 1,
      email: "demo@moneo.local",
      username: "demo",
      name: "Гость",
      base_currency: DEMO_CURRENCY,
      theme_preference: "light",
      hide_accounts_balance: false,
      has_avatar: false,
    },
    accounts: [],
    categories: [],
    transactions: [],
    budgets: [],
    recurring: [],
    goals: [],
  }

  for (const c of PRESET_CATEGORIES) state.categories.push({ id: nextId(state), user_id: null, deleted_at: null, ...c })
  const expense: Record<string, number> = {}
  const income: Record<string, number> = {}
  for (const c of state.categories) {
    if (c.type === "expense") expense[c.name] = c.id
    else income[c.name] = c.id
  }

  function addAccount(name: string, type: AccountType, color: string, initialBalance: number): AccountRow {
    const row: AccountRow = { id: nextId(state), name, currency: DEMO_CURRENCY, type, color, is_archived: false, deleted_at: null }
    state.accounts.push(row)
    if (initialBalance) {
      state.transactions.push({
        id: nextId(state),
        account_id: row.id,
        transfer_account_id: null,
        category_id: null,
        type: initialBalance > 0 ? "income" : "expense",
        amount: Math.abs(initialBalance),
        currency: DEMO_CURRENCY,
        date: monthStart(6),
        note: "Начальный баланс",
        tags: null,
        fee: null,
        deleted_at: null,
      })
    }
    return row
  }

  const card = addAccount("Основная карта", "card", "#10B981", 9_500_000)
  const cash = addAccount("Наличные", "cash", "#f59e0b", 1_200_000)
  const savings = addAccount("Сберегательный счёт", "savings", "#06b6d4", 3_000_000)

  function addTxn(
    accountId: number,
    type: TransactionType,
    amount: number,
    onDate: string,
    categoryId: number | null = null,
    note: string | null = null,
    tags: string[] | null = null,
    fee: number | null = null,
    transferAccountId: number | null = null
  ) {
    state.transactions.push({
      id: nextId(state),
      account_id: accountId,
      transfer_account_id: transferAccountId,
      category_id: categoryId,
      type,
      amount,
      currency: DEMO_CURRENCY,
      date: onDate,
      note,
      tags,
      fee,
      deleted_at: null,
    })
  }

  // 6 months of salary + a couple of one-off incomes
  for (let i = 0; i < 6; i++) {
    const monthsAgo = 5 - i
    addTxn(card.id, "income", 7_200_000 + i * 150_000, dayInMonth(monthsAgo, 5), income["Зарплата"], "Зарплата")
  }
  addTxn(card.id, "income", 1_800_000, dayInMonth(4, 18), income["Фриланс"], "Проект для клиента")
  addTxn(card.id, "income", 1_200_000, dayInMonth(3, 2), income["Фриланс"], "Дизайн лендинга")
  addTxn(cash.id, "income", 400_000, dayInMonth(4, 9), income["Подарки"], "На день рождения")
  addTxn(card.id, "income", 500_000, dayInMonth(1, 20), income["Долг вернули"], "Вернул Тимур")

  const expensePlan: Record<string, number[]> = {
    Еда: [850_000, 900_000, 780_000, 950_000, 880_000, 920_000],
    Транспорт: [180_000, 150_000, 200_000, 170_000, 160_000, 190_000],
    Жильё: [1_500_000, 1_500_000, 1_500_000, 1_600_000, 1_600_000, 1_600_000],
    Развлечения: [250_000, 320_000, 180_000, 450_000, 300_000, 500_000],
    Здоровье: [0, 120_000, 0, 180_000, 0, 90_000],
    Одежда: [0, 300_000, 0, 0, 400_000, 0],
    "Связь и интернет": [80_000, 80_000, 80_000, 80_000, 85_000, 85_000],
    Образование: [0, 0, 200_000, 0, 0, 200_000],
    Подписки: [45_000, 45_000, 65_000, 65_000, 65_000, 65_000],
  }
  for (const [categoryName, values] of Object.entries(expensePlan)) {
    values.forEach((amount, i) => {
      if (amount) addTxn(card.id, "expense", amount, dayInMonth(5 - i, 15), expense[categoryName])
    })
  }

  addTxn(card.id, "expense", 500_000, dayInMonth(3, 14), expense["Перевод близким"], "Маме на лекарства", ["семья"])
  addTxn(card.id, "expense", 700_000, dayInMonth(2, 3), expense["Дал в долг"], "Одолжил другу", ["долг"])
  addTxn(cash.id, "expense", 400_000, dayInMonth(1, 1), expense["Вернул долг"], "Отдал брату")
  addTxn(card.id, "expense", 200_000, dayInMonth(0, 12), expense["Прочее"], "Снятие в банкомате другого банка", null, 5_000)
  addTxn(card.id, "transfer", 500_000, dayInMonth(0, 15), null, "Перекинул на подушку", null, null, cash.id)

  for (const [categoryName, limit] of [
    ["Еда", 1_000_000],
    ["Транспорт", 200_000],
    ["Развлечения", 400_000],
    ["Подписки", 70_000],
  ] as [string, number][]) {
    state.budgets.push({
      id: nextId(state),
      category_id: expense[categoryName],
      month: monthStart(0),
      limit_amount: limit,
      currency: DEMO_CURRENCY,
      deleted_at: null,
    })
  }

  const today = new Date()
  for (const [name, amount, categoryName, nextInDays] of [
    ["Netflix", 45_000, "Подписки", 5],
    ["Спортзал", 150_000, "Здоровье", 1],
    ["Мобильная связь", 85_000, "Связь и интернет", 10],
  ] as [string, number, string, number][]) {
    state.recurring.push({
      id: nextId(state),
      account_id: card.id,
      category_id: expense[categoryName],
      name,
      amount,
      currency: DEMO_CURRENCY,
      frequency: "monthly",
      next_date: toLocalISODate(new Date(today.getFullYear(), today.getMonth(), today.getDate() + nextInDays)),
      is_active: true,
      deleted_at: null,
    })
  }

  state.goals.push({
    id: nextId(state),
    name: "Отпуск в Дубае",
    target_amount: 15_000_000,
    current_amount: 6_200_000,
    currency: DEMO_CURRENCY,
    deadline: toLocalISODate(addMonths(today, 8)),
    linked_account_id: null,
    deleted_at: null,
  })
  state.goals.push({
    id: nextId(state),
    name: "Финансовая подушка",
    target_amount: 20_000_000,
    current_amount: 5_000_000,
    currency: DEMO_CURRENCY,
    deadline: null,
    linked_account_id: savings.id,
    deleted_at: null,
  })

  return state
}

export { loadState }
export type { DemoState }
