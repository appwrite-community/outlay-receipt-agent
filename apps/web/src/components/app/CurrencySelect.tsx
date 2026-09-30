import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CURRENCIES, currencyName } from '@/lib/money'

export function CurrencySelect({
  id,
  value,
  onValueChange,
  disabled,
  className,
}: {
  id?: string
  className?: string
  value: string
  onValueChange: (value: string) => void
  disabled?: boolean
}) {
  const options: string[] = CURRENCIES.includes(value as (typeof CURRENCIES)[number])
    ? [...CURRENCIES]
    : [value, ...CURRENCIES]
  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger id={id} className={className}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((code) => (
          <SelectItem key={code} value={code}>
            <span className="font-mono text-xs text-fg-2">{code}</span>
            <span className="ml-2">{currencyName(code)}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
