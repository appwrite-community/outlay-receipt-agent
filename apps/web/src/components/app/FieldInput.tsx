import type { KeyboardEvent } from 'react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CATEGORIES } from '@/lib/categories'
import { currencySymbol, isCurrencyCode } from '@/lib/money'
import type { ExpenseField } from '@/lib/types'
import { cn } from '@/lib/utils'

const MAX_LENGTH: Partial<Record<ExpenseField, number>> = { merchant: 128, paymentMethod: 64, currency: 3 }

/** The right control for each expense field: text, date, amount, currency code, or category. */
export function FieldInput({
  id,
  field,
  value,
  onChange,
  currency,
  invalid,
  autoFocus,
  onKeyDown,
  className,
}: {
  id?: string
  field: ExpenseField
  value: string
  onChange: (value: string) => void
  /** The currency of amounts, for the symbol in front of them. */
  currency?: string | null
  invalid?: boolean
  autoFocus?: boolean
  onKeyDown?: (event: KeyboardEvent<HTMLElement>) => void
  className?: string
}) {
  if (field === 'category') {
    return (
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} aria-invalid={invalid} autoFocus={autoFocus} onKeyDown={onKeyDown} className={className}>
          <SelectValue placeholder="Choose a category" />
        </SelectTrigger>
        <SelectContent>
          {CATEGORIES.map(({ id: category, label, icon: Icon }) => (
            <SelectItem key={category} value={category}>
              <span className="flex items-center gap-2">
                <Icon className="size-4 text-fg-3" />
                {label}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  const shared = {
    id,
    value,
    autoFocus,
    onKeyDown,
    'aria-invalid': invalid,
    maxLength: MAX_LENGTH[field],
    onChange: (event: { target: { value: string } }) => onChange(event.target.value),
  }

  if (field === 'total' || field === 'tax') {
    const symbol = currency && isCurrencyCode(currency) ? currencySymbol(currency) : null
    return (
      <div className={cn('relative', className)}>
        {symbol && (
          <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm text-fg-3">{symbol}</span>
        )}
        <Input
          {...shared}
          inputMode="decimal"
          autoComplete="off"
          placeholder={field === 'tax' ? 'None' : '0.00'}
          className="tabular"
          style={symbol ? { paddingLeft: `${14 + symbol.length * 8}px` } : undefined}
        />
      </div>
    )
  }

  if (field === 'spentOn') return <Input {...shared} type="date" className={cn('tabular', className)} />

  if (field === 'currency') {
    return (
      <Input
        {...shared}
        onChange={(event) => onChange(event.target.value.toUpperCase())}
        autoComplete="off"
        spellCheck={false}
        placeholder="USD"
        className={cn('font-mono uppercase', className)}
      />
    )
  }

  return <Input {...shared} autoComplete="off" placeholder={field === 'paymentMethod' ? 'Not on the receipt' : undefined} className={className} />
}
