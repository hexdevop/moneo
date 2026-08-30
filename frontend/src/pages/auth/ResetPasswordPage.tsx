import { useState } from "react"
import type { FormEvent } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useResetPassword } from "@/hooks/useAuth"

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get("token") ?? ""
  const navigate = useNavigate()
  const resetPassword = useResetPassword()
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  const mismatch = confirmPassword.length > 0 && password !== confirmPassword

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (password !== confirmPassword) return
    try {
      await resetPassword.mutateAsync({ token, new_password: password })
      toast.success("Пароль изменён, теперь можно войти")
      navigate("/login")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось сбросить пароль")
    }
  }

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Ссылка недействительна</CardTitle>
            <CardDescription>В ссылке отсутствует токен сброса пароля</CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/forgot-password" className="text-sm text-foreground underline underline-offset-4">
              Запросить новую ссылку
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Новый пароль</CardTitle>
          <CardDescription>Введите новый пароль для вашего аккаунта</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="password">Новый пароль</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-password">Повторите пароль</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                aria-invalid={mismatch}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              {mismatch && <p className="text-xs text-destructive">Пароли не совпадают</p>}
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={resetPassword.isPending || mismatch || !confirmPassword}
            >
              {resetPassword.isPending ? "Сохранение…" : "Сохранить пароль"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
