export type ThemePreference = "light" | "dark"
export type AccountType = "cash" | "card" | "deposit" | "savings" | "other"
export type CategoryType = "income" | "expense"
export type TransactionType = "income" | "expense" | "transfer"
export type RecurrenceFrequency = "weekly" | "monthly" | "yearly"
export type BudgetStatus = "green" | "yellow" | "red"

export interface User {
  id: number
  email: string
  username: string
  name: string
  base_currency: string
  theme_preference: ThemePreference
  has_avatar: boolean
}

export interface Account {
  id: number
  name: string
  currency: string
  type: AccountType
  color: string
  is_archived: boolean
  balance: number
  balance_base: number
}

export interface Category {
  id: number
  user_id: number | null
  name: string
  type: CategoryType
  icon: string
  color: string
  is_preset: boolean
}

export interface Transaction {
  id: number
  account_id: number
  transfer_account_id: number | null
  category_id: number | null
  type: TransactionType
  amount: number
  currency: string
  exchange_rate_to_base: number
  amount_base: number
  date: string
  note: string | null
  tags: string[] | null
}

export interface Page<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}

export interface Budget {
  id: number
  category_id: number
  month: string
  limit_amount: number
  currency: string
  spent: number
  spent_base: number
  progress: number
  status: BudgetStatus
}

export interface RecurringPayment {
  id: number
  account_id: number
  category_id: number | null
  name: string
  amount: number
  currency: string
  frequency: RecurrenceFrequency
  next_date: string
  is_active: boolean
  monthly_amount_base: number
}

export interface Goal {
  id: number
  name: string
  target_amount: number
  current_amount: number
  currency: string
  deadline: string | null
  linked_account_id: number | null
  progress: number
  recommended_monthly_contribution: number | null
}

export interface DashboardSummary {
  date_from: string
  date_to: string
  income_base: number
  expense_base: number
  balance_total_base: number
  currency: string
  top_expense_categories: {
    category_id: number
    name: string
    icon: string
    color: string
    amount_base: number
  }[]
}

export interface TrendPoint {
  month: string
  income_base: number
  expense_base: number
}

export interface CategoryBreakdown {
  total_base: number
  categories: {
    category_id: number
    name: string
    icon: string
    color: string
    amount_base: number
    percent: number
  }[]
}
