import { motion } from "framer-motion"
import { useState } from "react"
import type { FormEvent } from "react"
import { Link, Navigate } from "react-router-dom"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useMe, useRegister } from "@/hooks/useAuth"

const CURRENCIES = ["USD", "EUR", "UZS", "RUB", "GBP"]

export function RegisterPage() {
  const { data: user } = useMe()
  const register = useRegister()
  const [email, setEmail] = useState("")
  const [username, setUsername] = useState("")
  const [name, setName] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [baseCurrency, setBaseCurrency] = useState("USD")

  const mismatch = confirmPassword.length > 0 && password !== confirmPassword

  if (user) return <Navigate to="/" replace />

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (password !== confirmPassword) return
    try {
      await register.mutateAsync({ email, username, name, password, base_currency: baseCurrency })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось зарегистрироваться")
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="w-full max-w-sm"
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Регистрация</CardTitle>
            <CardDescription>Создайте аккаунт Moneo</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Имя</Label>
                <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="username">Логин</Label>
                <Input
                  id="username"
                  required
                  minLength={3}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Пароль</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
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
              <div className="space-y-1.5">
                <Label>Базовая валюта</Label>
                <Select
                  items={Object.fromEntries(CURRENCIES.map((c) => [c, c]))}
                  value={baseCurrency}
                  onValueChange={(v) => v && setBaseCurrency(v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full" disabled={register.isPending || mismatch || !confirmPassword}>
                Зарегистрироваться
              </Button>
            </form>
            <p className="mt-4 text-center text-sm text-muted-foreground">
              Уже есть аккаунт?{" "}
              <Link to="/login" className="text-foreground underline underline-offset-4">
                Войти
              </Link>
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
