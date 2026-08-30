/** Local Y-M-D, unlike toISOString() which shifts across UTC and can land on the wrong day/month. */
export function toLocalISODate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `${amount.toFixed(2)} ${currency}`
  }
}

export function formatDate(date: string): string {
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short", year: "numeric" }).format(
    new Date(date)
  )
}

export function formatMonth(date: string): string {
  const formatted = new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" }).format(
    new Date(date)
  )
  return formatted.charAt(0).toUpperCase() + formatted.slice(1)
}

export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
}
