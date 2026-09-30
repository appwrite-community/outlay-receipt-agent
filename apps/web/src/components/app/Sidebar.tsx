import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import {
  ChevronsUpDown,
  LayoutGrid,
  LogOut,
  Menu,
  ReceiptText,
  ScanSearch,
  Settings,
} from 'lucide-react'
import { type ComponentType, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { Tooltip } from '@/components/ui/tooltip'
import { intake } from '@/lib/intake'
import { accountQuery, forgetSignedOutData, signOut } from '@/lib/queries/account'
import { reviewQueueQuery } from '@/lib/queries/expenses'
import { errorMessage } from '@/lib/query-client'
import { useMediaQuery } from '@/lib/use-media-query'
import { cn } from '@/lib/utils'
import { AgentPulse } from './StatusChip'
import { UserAvatar } from './Avatar'
import { useIntakeSummary } from './IntakeSheet'
import { Logo, LogoMark } from './Logo'
import { SettingsDialog } from './SettingsDialog'

type NavItem = {
  to: '/' | '/expenses' | '/review'
  label: string
  icon: ComponentType<{ className?: string }>
}

const NAV: NavItem[] = [
  { to: '/', label: 'Overview', icon: LayoutGrid },
  { to: '/expenses', label: 'Expenses', icon: ReceiptText },
  { to: '/review', label: 'Review', icon: ScanSearch },
]

function NavLinks({ compact = false, onNavigate }: { compact?: boolean; onNavigate?: () => void }) {
  const { data: queue } = useQuery(reviewQueueQuery)
  const reviewCount = queue?.length ?? 0

  return (
    <nav className="flex flex-col gap-0.5" aria-label="Main">
      {NAV.map(({ to, label, icon: Icon }) => {
        const badge = to === '/review' && reviewCount > 0 ? reviewCount : null
        const link = (
          <Link
            key={to}
            to={to}
            onClick={onNavigate}
            activeOptions={{ exact: to === '/' }}
            className={cn(
              'group relative flex h-8 items-center gap-2.5 rounded-md px-2 text-sm font-medium text-fg-2 transition-colors duration-[120ms] hover:bg-surface-2 hover:text-fg data-[status=active]:bg-surface-2 data-[status=active]:text-fg',
              compact && 'justify-center px-0',
            )}
          >
            <Icon className="size-4 shrink-0 text-fg-3 transition-colors group-hover:text-fg-2 group-data-[status=active]:text-fg" />
            {!compact && <span className="flex-1 truncate">{label}</span>}
            {badge !== null &&
              (compact ? (
                <span
                  className="absolute top-1 right-2 size-1.5 rounded-full bg-warn"
                  aria-label={`${badge} to review`}
                />
              ) : (
                <span className="min-w-5 rounded-full border border-warn-line bg-warn-tint px-1.5 text-center text-2xs font-semibold text-warn tabular">
                  {badge}
                </span>
              ))}
          </Link>
        )
        return compact ? (
          <Tooltip key={to} content={badge ? `${label} (${badge})` : label} side="right">
            {link}
          </Tooltip>
        ) : (
          link
        )
      })}
    </nav>
  )
}

/** Shows how many uploads the agent is still working on. Opens the intake sheet. */
function IntakeIndicator({ compact }: { compact?: boolean }) {
  const summary = useIntakeSummary()
  if (summary.total === 0) return null

  const label =
    summary.active > 0
      ? `Filing ${summary.active} ${summary.active === 1 ? 'receipt' : 'receipts'}`
      : 'Intake'
  const detail =
    summary.active > 0
      ? `${summary.done} of ${summary.total} done`
      : summary.needsAttention > 0
        ? `${summary.needsAttention} ${summary.needsAttention === 1 ? 'needs' : 'need'} you`
        : `${summary.total} processed`

  if (compact) {
    return (
      <Tooltip content={`${label} · ${detail}`} side="right">
        <button
          type="button"
          onClick={() => intake.setOpen(true)}
          className="mx-auto grid size-8 place-items-center rounded-md border border-accent-line bg-accent-tint"
          aria-label={`${label}, ${detail}`}
        >
          <AgentPulse />
        </button>
      </Tooltip>
    )
  }

  return (
    <button
      type="button"
      onClick={() => intake.setOpen(true)}
      className={cn(
        'relative flex w-full items-center gap-2.5 overflow-hidden rounded-md border px-2.5 py-2 text-left transition-colors',
        summary.active > 0
          ? 'agent-sweep border-accent-line bg-accent-tint hover:bg-[rgb(143_132_255/0.16)]'
          : 'border-border bg-surface-1 hover:bg-surface-2',
      )}
    >
      {summary.active > 0 ? <AgentPulse /> : <span className="size-2 rounded-full bg-fg-3" />}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-medium text-fg">{label}</span>
        <span className="block truncate text-2xs text-fg-2 tabular">{detail}</span>
      </span>
      <span className="text-2xs font-medium text-fg-2">Open</span>
    </button>
  )
}

function UserMenu({ compact }: { compact?: boolean }) {
  const { data: user } = useQuery(accountQuery)
  const navigate = useNavigate()
  const [settingsOpen, setSettingsOpen] = useState(false)
  if (!user) return null

  async function handleSignOut() {
    try {
      await signOut()
      intake.reset()
      await navigate({ to: '/sign-in' })
      forgetSignedOutData()
    } catch (error) {
      toast.error(errorMessage(error, 'Could not sign out. Try again.'))
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              'flex w-full items-center gap-2.5 rounded-md p-1.5 text-left transition-colors hover:bg-surface-2 data-[state=open]:bg-surface-2',
              compact && 'justify-center',
            )}
            aria-label="Account menu"
          >
            <UserAvatar name={user.name} className="size-7 text-2xs" />
            {!compact && (
              <>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium text-fg">{user.name}</span>
                  <span className="block truncate text-2xs text-fg-3">{user.email}</span>
                </span>
                <ChevronsUpDown className="size-3.5 text-fg-3" />
              </>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side="top"
          align="start"
          className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-52"
        >
          <DropdownMenuLabel className="truncate">{user.email}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setSettingsOpen(true)}>
            <Settings />
            Settings
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={handleSignOut}>
            <LogOut />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  )
}

/** Full sidebar from 1024 px, icons only from 768 px, hidden below. */
export function Sidebar() {
  const wide = useMediaQuery('(min-width: 1024px)')
  const visible = useMediaQuery('(min-width: 768px)')
  if (!visible) return null
  const compact = !wide
  return (
    <aside
      aria-label="Sidebar"
      className="sticky top-0 hidden h-dvh w-16 shrink-0 flex-col border-r border-border bg-surface-1 md:flex lg:w-[232px]"
    >
      <div className={cn('flex h-14 shrink-0 items-center px-4', compact && 'justify-center px-0')}>
        <Link to="/" className="rounded-md" aria-label="Outlay overview">
          {compact ? (
            <span className="grid size-7 place-items-center rounded-md border border-border bg-surface-2 text-fg">
              <LogoMark className="size-[18px]" />
            </span>
          ) : (
            <Logo />
          )}
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto px-3 pt-2">
        <NavLinks compact={compact} />
      </div>
      <div className="flex flex-col gap-2 p-3">
        <IntakeIndicator compact={compact} />
        <UserMenu compact={compact} />
      </div>
    </aside>
  )
}

/** The top bar and menu sheet on phones. */
export function MobileNav() {
  const [open, setOpen] = useState(false)
  const hasSidebar = useMediaQuery('(min-width: 768px)')
  if (hasSidebar) return null
  return (
    <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-surface-1 px-4 md:hidden">
      <Link to="/" aria-label="Outlay overview">
        <Logo />
      </Link>
      <Button variant="ghost" size="icon" onClick={() => setOpen(true)} aria-label="Open menu">
        <Menu />
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="gap-4 p-4 pt-5">
          <SheetTitle className="px-1 text-sm font-semibold">Menu</SheetTitle>
          <SheetDescription className="sr-only">
            Go to a page or open your account settings.
          </SheetDescription>
          <NavLinks onNavigate={() => setOpen(false)} />
          <IntakeIndicator />
          <UserMenu />
        </SheetContent>
      </Sheet>
    </div>
  )
}
