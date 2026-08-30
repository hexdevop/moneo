import { Loader2 } from "lucide-react"
import { Navigate } from "react-router-dom"

import { AppLayout } from "@/components/layout/AppLayout"
import { useMe } from "@/hooks/useAuth"

export function ProtectedRoute() {
  const { data: user, isLoading } = useMe()

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <AppLayout />
}
