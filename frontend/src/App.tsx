import { MotionConfig } from "framer-motion"
import { Route, Routes } from "react-router-dom"

import { ProtectedRoute } from "@/components/ProtectedRoute"
import { ThemeProvider } from "@/components/ThemeProvider"
import { Toaster } from "@/components/ui/sonner"
import { AccountsPage } from "@/pages/AccountsPage"
import { ForgotPasswordPage } from "@/pages/auth/ForgotPasswordPage"
import { LoginPage } from "@/pages/auth/LoginPage"
import { RegisterPage } from "@/pages/auth/RegisterPage"
import { ResetPasswordPage } from "@/pages/auth/ResetPasswordPage"
import { BudgetsPage } from "@/pages/BudgetsPage"
import { DashboardPage } from "@/pages/DashboardPage"
import { GoalsPage } from "@/pages/GoalsPage"
import { RecurringPage } from "@/pages/RecurringPage"
import { SettingsPage } from "@/pages/SettingsPage"
import { TransactionsPage } from "@/pages/TransactionsPage"
import { TrashPage } from "@/pages/TrashPage"

export default function App() {
  return (
    <ThemeProvider>
      <MotionConfig reducedMotion="user">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/accounts" element={<AccountsPage />} />
            <Route path="/transactions" element={<TransactionsPage />} />
            <Route path="/budgets" element={<BudgetsPage />} />
            <Route path="/recurring" element={<RecurringPage />} />
            <Route path="/goals" element={<GoalsPage />} />
            <Route path="/trash" element={<TrashPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Routes>
        <Toaster />
      </MotionConfig>
    </ThemeProvider>
  )
}
