import { TriangleAlert } from 'lucide-react'
import type { ComponentProps, ReactNode } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function AuthCard({ title, description, children }: { title: string; description: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-surface-1/90 shadow-[0_24px_48px_-24px_rgb(0_0_0/0.8)] backdrop-blur-sm">
      <div className="px-6 pt-6 pb-5">
        <h1 className="text-lg font-semibold text-fg">{title}</h1>
        <p className="mt-1 text-sm text-fg-2">{description}</p>
      </div>
      <div className="border-t border-border px-6 py-5">{children}</div>
    </div>
  )
}

/** A labeled input with its error message underneath. */
export function Field({
  id,
  label,
  error,
  hint,
  ...props
}: ComponentProps<'input'> & { id: string; label: string; error?: string | null; hint?: string }) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} aria-invalid={Boolean(error)} aria-describedby={describedBy} className="h-9" {...props} />
      {error ? (
        <p id={`${id}-error`} className="text-xs text-crit">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="text-xs text-fg-3">
            {hint}
          </p>
        )
      )}
    </div>
  )
}

export function FormBanner({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className="mb-4 flex gap-2.5 rounded-md border border-crit-line bg-crit-tint px-3 py-2.5 text-xs text-fg">
      <TriangleAlert className="mt-px size-3.5 shrink-0 text-crit" />
      <span>{children}</span>
    </div>
  )
}
