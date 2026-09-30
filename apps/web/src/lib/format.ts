const LOCALE = 'en-US'

// Receipt dates are stored at UTC midnight, so they are always shown in UTC.
const dateFormat = new Intl.DateTimeFormat(LOCALE, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
})
const monthFormat = new Intl.DateTimeFormat(LOCALE, { month: 'long', timeZone: 'UTC' })
const shortMonthFormat = new Intl.DateTimeFormat(LOCALE, { month: 'short', timeZone: 'UTC' })
const monthYearFormat = new Intl.DateTimeFormat(LOCALE, {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})
const dateTimeFormat = new Intl.DateTimeFormat(LOCALE, { dateStyle: 'medium', timeStyle: 'short' })
const timeFormat = new Intl.DateTimeFormat(LOCALE, { timeStyle: 'short' })

export const formatDate = (iso: string) => dateFormat.format(new Date(iso))
export const formatMonth = (iso: string) => monthFormat.format(new Date(iso))
export const formatShortMonth = (iso: string) => shortMonthFormat.format(new Date(iso))
export const formatMonthYear = (iso: string) => monthYearFormat.format(new Date(iso))

/** A moment in the reader's own time zone, for tooltips on relative times. */
export const formatDateTime = (iso: string) => dateTimeFormat.format(new Date(iso))

/** "just now", "4 min ago", "Yesterday at 9:12 AM", "Sep 18" */
export function formatRelative(iso: string, now: number = Date.now()): string {
  const then = new Date(iso)
  const seconds = Math.round((now - then.getTime()) / 1000)
  if (seconds < 45) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 12) return `${hours} h ago`

  const startOfToday = new Date(now)
  startOfToday.setHours(0, 0, 0, 0)
  const startOfYesterday = startOfToday.getTime() - 24 * 60 * 60 * 1000
  if (then.getTime() >= startOfToday.getTime()) return `Today at ${timeFormat.format(then)}`
  if (then.getTime() >= startOfYesterday) return `Yesterday at ${timeFormat.format(then)}`
  return new Intl.DateTimeFormat(LOCALE, { month: 'short', day: 'numeric' }).format(then)
}

/** "850 ms", "11.4 s", "1 min 12 s" */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`
  const minutes = Math.floor(ms / 60_000)
  const seconds = Math.round((ms % 60_000) / 1000)
  return seconds ? `${minutes} min ${seconds} s` : `${minutes} min`
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** "2026-09-18" for an <input type="date">, from a stored receipt date. */
export const toDateInput = (iso: string) => iso.slice(0, 10)

/** The stored form of a receipt date: UTC midnight. */
export const fromDateInput = (value: string) => `${value}T00:00:00.000+00:00`

export function addMonths(iso: string, months: number): string {
  const date = new Date(iso)
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1)).toISOString()
}

/** "2026-09" */
export const monthKey = (iso: string) => iso.slice(0, 7)

export function pluralize(count: number, one: string, many = `${one}s`): string {
  return `${count.toLocaleString(LOCALE)} ${count === 1 ? one : many}`
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const letters = parts.length > 1 ? parts[0][0] + parts.at(-1)![0] : (parts[0] ?? '?').slice(0, 2)
  return letters.toUpperCase()
}
