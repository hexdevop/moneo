// Manually maintained release notes, one entry per git tag. When you cut a new
// version (see the tagging guide in the README), add an entry here with the same
// version number — CURRENT_VERSION and the "new" badge on the sidebar link are
// derived from CHANGELOG[0], so the newest entry must stay first.
export type ChangeType = "new" | "improved" | "fixed"

export interface ChangelogEntry {
  version: string
  date: string
  title: string
  changes: { type: ChangeType; text: string }[]
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "1.0.0",
    date: "2026-09-08",
    title: "Первый релиз",
    changes: [
      { type: "new", text: "Многовалютные счета, транзакции, бюджеты, регулярные платежи и финансовые цели" },
      { type: "new", text: "Дашборд с динамикой доходов/расходов и разбивкой трат по категориям" },
      { type: "new", text: "Корзина — удалённые счета, транзакции, категории, бюджеты, платежи и цели можно восстановить" },
      { type: "new", text: "Демо-режим без регистрации: данные хранятся только в этом браузере" },
      { type: "new", text: "Приветственное обучение и подсказки по интерфейсу для новых пользователей" },
    ],
  },
]

export const CURRENT_VERSION = CHANGELOG[0].version

const SEEN_KEY = "moneo_changelog_last_seen"

export function isChangelogUnseen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) !== CURRENT_VERSION
  } catch {
    return false
  }
}

export function markChangelogSeen(): void {
  try {
    localStorage.setItem(SEEN_KEY, CURRENT_VERSION)
  } catch {
    // ignore — worst case the "new" dot reappears next visit
  }
}
