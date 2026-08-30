import { Camera, Loader2, Plus, Trash2 } from "lucide-react"
import { useRef, useState } from "react"
import type { ChangeEvent, FormEvent } from "react"
import { toast } from "sonner"

import { CategoryIcon } from "@/components/CategoryIcon"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  useChangePassword,
  useDeleteAvatar,
  useMe,
  useUpdateMe,
  useUploadAvatar,
} from "@/hooks/useAuth"
import { useCategories, useCreateCategory, useDeleteCategory } from "@/hooks/useCategories"
import { avatarUrl } from "@/lib/api"
import { initials } from "@/lib/format"
import type { CategoryType } from "@/types"

const ALLOWED_AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"]
const MAX_AVATAR_SIZE = 2 * 1024 * 1024

const CURRENCIES = ["USD", "EUR", "UZS", "RUB", "GBP"]
const CATEGORY_COLORS = ["#6366f1", "#22c55e", "#f97316", "#ec4899", "#06b6d4", "#a855f7", "#64748b"]
const CATEGORY_ICONS = [
  "circle",
  "tag",
  "star",
  "coffee",
  "shopping-bag",
  "car",
  "home",
  "heart",
  "book-open",
  "briefcase",
]

export function SettingsPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Настройки</h1>
        <p className="text-sm text-muted-foreground">Профиль, категории и безопасность аккаунта</p>
      </div>

      <ProfileIdentityCard />

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Профиль</TabsTrigger>
          <TabsTrigger value="categories">Категории</TabsTrigger>
          <TabsTrigger value="security">Безопасность</TabsTrigger>
        </TabsList>
        <TabsContent value="profile" className="mt-6">
          <ProfileTab />
        </TabsContent>
        <TabsContent value="categories" className="mt-6">
          <CategoriesTab />
        </TabsContent>
        <TabsContent value="security" className="mt-6">
          <SecurityTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function ProfileIdentityCard() {
  const { data: user } = useMe()
  const uploadAvatar = useUploadAvatar()
  const deleteAvatar = useDeleteAvatar()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pending = uploadAvatar.isPending || deleteAvatar.isPending

  if (!user) return null

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      toast.error("Поддерживаются только изображения JPEG, PNG или WebP")
      return
    }
    if (file.size > MAX_AVATAR_SIZE) {
      toast.error("Файл слишком большой (максимум 2 МБ)")
      return
    }
    uploadAvatar.mutate(file, {
      onError: (err) => toast.error(err instanceof Error ? err.message : "Не удалось загрузить фото"),
    })
  }

  async function handleDelete() {
    try {
      await deleteAvatar.mutateAsync()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось удалить фото")
    }
  }

  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={pending}
        className="group relative shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-label="Изменить фото профиля"
      >
        <Avatar size="lg">
          {user.has_avatar && <AvatarImage src={avatarUrl(user.id)} alt={user.name} />}
          <AvatarFallback className="text-base font-medium">{initials(user.name)}</AvatarFallback>
        </Avatar>
        <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/0 opacity-0 transition-opacity group-hover:bg-black/40 group-hover:opacity-100">
          <Camera className="size-4 text-white" />
        </span>
        {pending && (
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-background/70">
            <Loader2 className="size-4 animate-spin" />
          </span>
        )}
      </button>

      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{user.name}</p>
        <p className="truncate text-sm text-muted-foreground">
          {user.email} · @{user.username}
        </p>
        <div className="mt-1.5 flex gap-3">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={pending}
            className="text-xs font-medium text-primary hover:underline disabled:pointer-events-none disabled:opacity-50"
          >
            Изменить фото
          </button>
          {user.has_avatar && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={pending}
              className="text-xs font-medium text-destructive hover:underline disabled:pointer-events-none disabled:opacity-50"
            >
              Удалить фото
            </button>
          )}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  )
}

function ProfileTab() {
  const { data: user } = useMe()
  const updateMe = useUpdateMe()
  const [name, setName] = useState(user?.name ?? "")
  const [baseCurrency, setBaseCurrency] = useState(user?.base_currency ?? "USD")

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    try {
      await updateMe.mutateAsync({ name, base_currency: baseCurrency })
      toast.success("Профиль обновлён")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось обновить профиль")
    }
  }

  if (!user) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Личные данные</CardTitle>
        <CardDescription>Имя и базовая валюта используются во всех отчётах и графиках</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="settings-name">Имя</Label>
              <Input id="settings-name" value={name} onChange={(e) => setName(e.target.value)} />
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
          </div>

          <Separator />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="settings-email">Email</Label>
              <Input id="settings-email" value={user.email} disabled />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="settings-username">Логин</Label>
              <Input id="settings-username" value={user.username} disabled />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Email и логин используются для входа и пока не могут быть изменены.
          </p>

          <Button type="submit" disabled={updateMe.isPending}>
            {updateMe.isPending ? "Сохранение…" : "Сохранить"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function CategoriesTab() {
  const [type, setType] = useState<CategoryType>("expense")
  const { data: categories = [] } = useCategories(type)
  const createCategory = useCreateCategory()
  const deleteCategory = useDeleteCategory()
  const [name, setName] = useState("")
  const [icon, setIcon] = useState(CATEGORY_ICONS[0])
  const [color, setColor] = useState(CATEGORY_COLORS[0])

  const custom = categories.filter((c) => !c.is_preset)
  const presets = categories.filter((c) => c.is_preset)

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    try {
      await createCategory.mutateAsync({ name: name.trim(), type, icon, color })
      setName("")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось создать категорию")
    }
  }

  async function handleDelete(id: number) {
    try {
      await deleteCategory.mutateAsync(id)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось удалить категорию")
    }
  }

  return (
    <div className="space-y-6">
      <Tabs value={type} onValueChange={(v) => setType(v as CategoryType)}>
        <TabsList>
          <TabsTrigger value="expense">Расходы</TabsTrigger>
          <TabsTrigger value="income">Доходы</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Стандартные категории</CardTitle>
          <CardDescription>Предустановлены для всех пользователей, их нельзя изменить или удалить</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {presets.map((c) => (
            <span
              key={c.id}
              className="flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs"
            >
              <CategoryIcon name={c.icon} className="size-3.5" style={{ color: c.color }} />
              {c.name}
            </span>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Свои категории</CardTitle>
          <CardDescription>Добавляйте категории под свои привычки — с иконкой и цветом</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {custom.length > 0 && (
            <div className="space-y-2">
              {custom.map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                  <span className="flex items-center gap-2 text-sm">
                    <span
                      className="flex size-6 items-center justify-center rounded-full"
                      style={{ backgroundColor: `${c.color}20`, color: c.color }}
                    >
                      <CategoryIcon name={c.icon} className="size-3.5" />
                    </span>
                    {c.name}
                  </span>
                  <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(c.id)} aria-label="Удалить">
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={handleCreate} className="space-y-3 rounded-lg border border-dashed border-border p-3">
            <Input placeholder="Название категории" value={name} onChange={(e) => setName(e.target.value)} />
            <div className="flex flex-wrap items-center gap-3">
              <Select value={icon} onValueChange={(v) => v && setIcon(v)}>
                <SelectTrigger className="w-[130px]">
                  <span className="flex items-center gap-1.5">
                    <CategoryIcon name={icon} className="size-3.5" />
                    <SelectValue />
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_ICONS.map((iconName) => (
                    <SelectItem key={iconName} value={iconName}>
                      <span className="flex items-center gap-2">
                        <CategoryIcon name={iconName} className="size-3.5" />
                        {iconName}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex gap-1.5">
                {CATEGORY_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`size-6 rounded-full transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${color === c ? "ring-2 ring-offset-2 ring-ring" : ""}`}
                    style={{ backgroundColor: c }}
                    aria-label={c}
                    aria-pressed={color === c}
                  />
                ))}
              </div>
              <Button type="submit" size="sm" className="ml-auto gap-1.5" disabled={createCategory.isPending}>
                <Plus className="size-4" />
                Добавить
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

function SecurityTab() {
  const changePassword = useChangePassword()
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (newPassword !== confirmPassword) return
    try {
      await changePassword.mutateAsync({ current_password: currentPassword, new_password: newPassword })
      toast.success("Пароль изменён")
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось изменить пароль")
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Смена пароля</CardTitle>
        <CardDescription>Рекомендуем уникальный пароль длиной от 8 символов</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="max-w-sm space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="current-password">Текущий пароль</Label>
            <Input
              id="current-password"
              type="password"
              autoComplete="current-password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-password">Новый пароль</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-password">Повторите новый пароль</Label>
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
          <Button type="submit" disabled={changePassword.isPending || mismatch || !confirmPassword}>
            {changePassword.isPending ? "Сохранение…" : "Изменить пароль"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
