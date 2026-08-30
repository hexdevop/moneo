import { motion } from "framer-motion"
import { useState } from "react"
import type { FormEvent } from "react"
import { Link, Navigate } from "react-router-dom"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useLogin, useMe } from "@/hooks/useAuth"

export function LoginPage() {
  const { data: user } = useMe()
  const login = useLogin()
  const [loginValue, setLoginValue] = useState("")
  const [password, setPassword] = useState("")

  if (user) return <Navigate to="/" replace />

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    try {
      await login.mutateAsync({ login: loginValue, password })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось войти")
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="w-full max-w-sm"
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Moneo</CardTitle>
            <CardDescription>Войдите, чтобы продолжить учёт финансов</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="login">Email или логин</Label>
                <Input
                  id="login"
                  required
                  autoFocus
                  value={loginValue}
                  onChange={(e) => setLoginValue(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Пароль</Label>
                  <Link to="/forgot-password" className="text-xs text-muted-foreground hover:text-foreground">
                    Забыли пароль?
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={login.isPending}>
                Войти
              </Button>
            </form>
            <p className="mt-4 text-center text-sm text-muted-foreground">
              Нет аккаунта?{" "}
              <Link to="/register" className="text-foreground underline underline-offset-4">
                Зарегистрироваться
              </Link>
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
