import { useQuery } from '@tanstack/react-query'
import { type FormEvent, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { accountQuery, homeCurrency, updateProfile } from '@/lib/queries/account'
import { errorMessage } from '@/lib/query-client'
import { CurrencySelect } from './CurrencySelect'

export function SettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { data: user } = useQuery(accountQuery)
  const [name, setName] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open && user) {
      setName(user.name)
      setCurrency(homeCurrency(user))
    }
  }, [open, user])

  if (!user) return null
  const unchanged = name.trim() === user.name && currency === homeCurrency(user)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!user || !name.trim()) return
    setSaving(true)
    try {
      await updateProfile(user, { name: name.trim(), currency })
      toast.success('Settings saved')
      onOpenChange(false)
    } catch (error) {
      toast.error(errorMessage(error, 'Could not save your settings. Try again.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
            <DialogDescription>These settings apply to your account on every device.</DialogDescription>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="settings-name">Name</Label>
              <Input id="settings-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={128} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="settings-currency">Home currency</Label>
              <CurrencySelect id="settings-currency" value={currency} onValueChange={setCurrency} />
              <p className="text-xs text-fg-3">
                Totals and charts use this currency. The agent also uses it when a receipt shows only a symbol.
              </p>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={saving || unchanged || !name.trim()}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
