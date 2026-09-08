import { Bug, Sparkles, Wrench } from "lucide-react"
import { useEffect } from "react"

import { GithubIcon } from "@/components/icons/GithubIcon"
import { Badge } from "@/components/ui/badge"
import { CHANGELOG, markChangelogSeen, type ChangeType } from "@/lib/changelog"
import { formatDate } from "@/lib/format"

const TYPE_ICON: Record<ChangeType, typeof Sparkles> = {
  new: Sparkles,
  improved: Wrench,
  fixed: Bug,
}

const TYPE_LABEL: Record<ChangeType, string> = {
  new: "Новое",
  improved: "Улучшено",
  fixed: "Исправлено",
}

const TYPE_COLOR: Record<ChangeType, string> = {
  new: "text-primary",
  improved: "text-amber-500",
  fixed: "text-green-500",
}

export function ChangelogPage() {
  useEffect(() => {
    markChangelogSeen()
  }, [])

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Что нового</h1>
          <p className="text-sm text-muted-foreground">История обновлений Moneo по версиям</p>
        </div>
        <a
          href="https://github.com/hexdevop/moneo"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <GithubIcon className="size-4" />
          Исходный код на GitHub
        </a>
      </div>

      <div className="space-y-8">
        {CHANGELOG.map((entry) => (
          <div key={entry.version} className="relative border-l border-border pl-6">
            <span className="absolute top-1 -left-[5px] size-2 rounded-full bg-primary" />
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">v{entry.version}</Badge>
              <span className="text-sm text-muted-foreground">{formatDate(entry.date)}</span>
            </div>
            <h2 className="mt-1.5 font-medium">{entry.title}</h2>
            <ul className="mt-3 space-y-2">
              {entry.changes.map((change, i) => {
                const Icon = TYPE_ICON[change.type]
                return (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Icon className={`mt-0.5 size-3.5 shrink-0 ${TYPE_COLOR[change.type]}`} />
                    <span>
                      <span className="text-muted-foreground">{TYPE_LABEL[change.type]}:</span> {change.text}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
