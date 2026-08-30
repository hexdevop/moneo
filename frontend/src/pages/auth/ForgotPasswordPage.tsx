import { useState } from "react"
import type { FormEvent } from "react"
import { Link } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useForgotPassword } from "@/hooks/useAuth"

export function ForgotPasswordPage() {
  const forgotPassword = useForgotPassword()
  const [email, setEmail] = useState("")

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    await forgotPassword.mutateAsync(email)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Восстановление пароля</CardTitle>
          <CardDescription>Отправим ссылку для сброса пароля на email</CardDescription>
        </CardHeader>
        <CardContent>
          {forgotPassword.isSuccess ? (
            <p className="text-sm text-muted-foreground">
              Если такой email зарегистрирован, на него отправлена ссылка для сброса пароля.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={forgotPassword.isPending}>
                Отправить ссылку
              </Button>
            </form>
          )}
          <p className="mt-4 text-center text-sm text-muted-foreground">
            <Link to="/login" className="text-foreground underline underline-offset-4">
              Вернуться ко входу
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
