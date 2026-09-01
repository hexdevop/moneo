import { useEffect, useRef } from "react"

import { cn } from "@/lib/utils"

const ITEM_HEIGHT = 36
const VISIBLE_ROWS = 5
const PAD_ROWS = (VISIBLE_ROWS - 1) / 2

const MONTH_LABELS = [
  "Янв",
  "Фев",
  "Мар",
  "Апр",
  "Май",
  "Июн",
  "Июл",
  "Авг",
  "Сен",
  "Окт",
  "Ноя",
  "Дек",
]

const MIN_YEAR = 2000
const MAX_YEAR = new Date().getFullYear() + 1

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

interface WheelColumnProps {
  values: number[]
  labels?: string[]
  selected: number
  onSelect: (value: number) => void
  className?: string
}

function WheelColumn({ values, labels, selected, onSelect, className }: WheelColumnProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const mountedRef = useRef(false)
  // While true, ignore scroll events: a programmatic scrollTo (from a click or from
  // syncing to a new `selected`) fires the same scroll events as a user drag, and
  // without this guard the mid-animation scroll position gets misread as the user's
  // choice and stomps the value that was just set.
  const programmaticRef = useRef(false)
  const clearProgrammaticRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const selectedIndex = Math.max(0, values.indexOf(selected))

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const target = selectedIndex * ITEM_HEIGHT
    if (Math.abs(el.scrollTop - target) > ITEM_HEIGHT / 2) {
      programmaticRef.current = true
      if (clearProgrammaticRef.current) clearTimeout(clearProgrammaticRef.current)
      clearProgrammaticRef.current = setTimeout(() => {
        programmaticRef.current = false
      }, 450)
      el.scrollTo({ top: target, behavior: mountedRef.current ? "smooth" : "auto" })
    }
    mountedRef.current = true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIndex])

  function handleScroll() {
    if (programmaticRef.current) return
    const el = containerRef.current
    if (!el) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const index = Math.min(values.length - 1, Math.max(0, Math.round(el.scrollTop / ITEM_HEIGHT)))
      const value = values[index]
      if (value !== undefined && value !== selected) onSelect(value)
    }, 120)
  }

  return (
    <div
      ref={containerRef}
      role="listbox"
      aria-label="Выбор значения"
      onScroll={handleScroll}
      className={cn(
        "wheel-fade scrollbar-none h-[180px] snap-y snap-mandatory overflow-y-auto overscroll-contain",
        className
      )}
      style={{ paddingBlock: ITEM_HEIGHT * PAD_ROWS }}
    >
      {values.map((value, i) => (
        <button
          key={value}
          type="button"
          role="option"
          aria-selected={value === selected}
          className={cn(
            "flex h-9 w-full shrink-0 snap-center items-center justify-center text-sm tabular-nums transition-colors",
            value === selected ? "font-semibold text-foreground" : "text-muted-foreground"
          )}
          onClick={() => onSelect(value)}
        >
          {labels ? labels[i] : value}
        </button>
      ))}
    </div>
  )
}

interface WheelDatePickerProps {
  value: string
  onChange: (value: string) => void
}

export function WheelDatePicker({ value, onChange }: WheelDatePickerProps) {
  const [y, m, d] = value.split("-").map(Number)
  const year = y || new Date().getFullYear()
  const month = m || 1
  const day = d || 1

  const years = Array.from({ length: MAX_YEAR - MIN_YEAR + 1 }, (_, i) => MIN_YEAR + i)
  const months = Array.from({ length: 12 }, (_, i) => i + 1)
  const dayCount = daysInMonth(year, month)
  const days = Array.from({ length: dayCount }, (_, i) => i + 1)

  function emit(nextYear: number, nextMonth: number, nextDay: number) {
    const clampedDay = Math.min(nextDay, daysInMonth(nextYear, nextMonth))
    const iso = `${nextYear.toString().padStart(4, "0")}-${nextMonth.toString().padStart(2, "0")}-${clampedDay.toString().padStart(2, "0")}`
    onChange(iso)
  }

  return (
    <div className="relative rounded-lg border border-border bg-muted/30">
      <div
        className="pointer-events-none absolute inset-x-0 top-1/2 h-9 -translate-y-1/2 border-y border-border/80"
        aria-hidden
      />
      <div className="flex">
        <WheelColumn values={days} selected={day} onSelect={(v) => emit(year, month, v)} className="flex-1" />
        <WheelColumn
          values={months}
          labels={MONTH_LABELS}
          selected={month}
          onSelect={(v) => emit(year, v, day)}
          className="flex-[1.3]"
        />
        <WheelColumn values={years} selected={year} onSelect={(v) => emit(v, month, day)} className="flex-1" />
      </div>
    </div>
  )
}
