import { useQueries, useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { FileText, FileUp, X } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { Tooltip } from '@/components/ui/tooltip'
import { categoryLabel } from '@/lib/categories'
import { formatBytes } from '@/lib/format'
import { type Upload, intake, reportsProgress, useIntake } from '@/lib/intake'
import { formatMoney } from '@/lib/money'
import { deleteExpense, retryExpense } from '@/lib/queries/changes'
import { activityQuery, expenseQuery } from '@/lib/queries/expenses'
import { errorMessage } from '@/lib/query-client'
import type { Expense } from '@/lib/types'
import { cn } from '@/lib/utils'
import { ActivityTimeline } from './ActivityTimeline'
import { useFilePicker } from './AppShell'
import { AgentPulse, StatusChip } from './StatusChip'

type Phase = 'blocked' | 'uploading' | 'upload-failed' | 'waiting' | Expense['status']

function phaseOf(upload: Upload, expense: Expense | null | undefined): Phase {
  if (upload.state === 'blocked') return 'blocked'
  if (upload.state === 'uploading') return 'uploading'
  if (upload.state === 'failed') return 'upload-failed'
  return expense?.status ?? 'waiting'
}

const ACTIVE: Phase[] = ['uploading', 'waiting', 'processing']
const NEEDS_YOU: Phase[] = ['needs_review', 'failed', 'rejected', 'blocked', 'upload-failed']

/** Each upload with the expense the agent created for it, kept current by Realtime. */
function useIntakeCards() {
  const { uploads, open } = useIntake()
  const uploaded = uploads.filter((upload) => upload.state === 'uploaded')
  const expenses = useQueries({ queries: uploaded.map((upload) => expenseQuery(upload.fileId)) })
  const byFileId = new Map(uploaded.map((upload, index) => [upload.fileId, expenses[index]?.data]))
  const cards = uploads.map((upload) => {
    const expense = byFileId.get(upload.fileId)
    return { upload, expense, phase: phaseOf(upload, expense) }
  })
  return { cards, open }
}

export function useIntakeSummary() {
  const { cards } = useIntakeCards()
  const active = cards.filter((card) => ACTIVE.includes(card.phase)).length
  return {
    total: cards.length,
    active,
    done: cards.length - active,
    needsAttention: cards.filter((card) => NEEDS_YOU.includes(card.phase)).length,
  }
}

function Thumbnail({ upload }: { upload: Upload }) {
  return (
    <div className="grid h-14 w-11 shrink-0 place-items-center overflow-hidden rounded-md border border-border bg-surface-2">
      {upload.previewUrl ? (
        <img src={upload.previewUrl} alt="" className="size-full object-cover" />
      ) : (
        <FileText className="size-4 text-fg-3" />
      )}
    </div>
  )
}

function StateLine({
  phase,
  upload,
  expense,
}: {
  phase: Phase
  upload: Upload
  expense: Expense | null | undefined
}) {
  switch (phase) {
    case 'uploading': {
      const measured = reportsProgress(upload.file)
      return (
        <div className="flex items-center gap-2.5">
          <span className="w-24 shrink-0 text-xs text-fg-2 tabular">
            {measured ? `Uploading ${upload.progress}%` : 'Uploading'}
          </span>
          <div className="relative h-1 flex-1 overflow-hidden rounded-full bg-surface-3">
            {measured ? (
              <div
                className="h-full rounded-full bg-accent-400 transition-[width] duration-200"
                style={{ width: `${upload.progress}%` }}
              />
            ) : (
              <div className="absolute inset-y-0 w-1/3 animate-indeterminate rounded-full bg-accent-400" />
            )}
          </div>
        </div>
      )
    }
    case 'waiting':
      return (
        <span className="flex items-center gap-2 text-xs text-fg-2">
          <AgentPulse />
          Waiting for the agent
        </span>
      )
    case 'processing':
      return <StatusChip status="processing" label="Agent is reading" />
    case 'ready':
      return (
        <StatusChip
          status="ready"
          label={[
            'Filed',
            expense?.category && categoryLabel(expense.category),
            expense?.totalMinor != null &&
              expense.currency &&
              formatMoney(expense.totalMinor, expense.currency),
          ]
            .filter(Boolean)
            .join(' · ')}
        />
      )
    case 'needs_review': {
      const count = expense?.openFlags ?? 1
      return (
        <StatusChip
          status="needs_review"
          label={`${count} ${count === 1 ? 'field' : 'fields'} to review`}
        />
      )
    }
    case 'rejected':
      return <StatusChip status="rejected" />
    case 'failed':
      return <StatusChip status="failed" label="Could not file" />
    case 'blocked':
      return <StatusChip status="failed" label="Not uploaded" />
    case 'upload-failed':
      return <StatusChip status="failed" label="Upload failed" />
  }
}

function IntakeCard({
  upload,
  expense,
  phase,
}: {
  upload: Upload
  expense: Expense | null | undefined
  phase: Phase
}) {
  const [busy, setBusy] = useState(false)
  const { data: steps = [] } = useQuery({
    ...activityQuery(upload.fileId),
    enabled: Boolean(expense),
  })
  const finished = !ACTIVE.includes(phase)
  const extension = upload.file.name.split('.').pop()?.toUpperCase()

  async function run(action: () => Promise<void>, failure: string) {
    setBusy(true)
    try {
      await action()
    } catch (error) {
      toast.error(errorMessage(error, failure))
    } finally {
      setBusy(false)
    }
  }

  const reason =
    phase === 'blocked' || phase === 'upload-failed'
      ? upload.error
      : phase === 'rejected' || phase === 'failed'
        ? expense?.failureReason
        : phase === 'needs_review'
          ? steps.findLast((step) => step.kind === 'flagged')?.detail
          : phase === 'ready'
            ? expense?.agentSummary
            : null

  return (
    <li
      className={cn(
        'animate-rise rounded-lg border bg-surface-1 p-3 transition-colors',
        phase === 'processing' ? 'border-accent-line' : 'border-border',
      )}
    >
      <div className="flex gap-3">
        <Thumbnail upload={upload} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <Tooltip content={upload.file.name}>
                <p className="truncate font-mono text-xs text-fg">{upload.file.name}</p>
              </Tooltip>
              <p className="mt-0.5 text-2xs text-fg-3 tabular">
                {formatBytes(upload.file.size)} · {extension}
              </p>
            </div>
            {finished && (
              <Button
                variant="ghost"
                size="icon-sm"
                className="-mt-1 -mr-1"
                onClick={() => intake.dismiss(upload.key)}
                aria-label="Dismiss"
              >
                <X />
              </Button>
            )}
          </div>
          <div className="mt-2">
            <StateLine phase={phase} upload={upload} expense={expense} />
          </div>
        </div>
      </div>

      {phase === 'processing' && steps.length > 0 && (
        <div className="mt-3 border-t border-border pt-3">
          <ActivityTimeline steps={steps} working compact />
        </div>
      )}

      {reason && finished && <p className="mt-2.5 text-xs text-fg-2">{reason}</p>}

      {expense && (phase === 'ready' || phase === 'needs_review') && (
        <div className="mt-3 flex justify-end gap-2">
          {phase === 'ready' ? (
            <Button asChild size="sm">
              <Link
                to="/expenses/$expenseId"
                params={{ expenseId: expense.$id }}
                onClick={() => intake.setOpen(false)}
              >
                Open
              </Link>
            </Button>
          ) : (
            <Button asChild size="sm" variant="primary">
              <Link
                to="/review/$expenseId"
                params={{ expenseId: expense.$id }}
                onClick={() => intake.setOpen(false)}
              >
                Review
              </Link>
            </Button>
          )}
        </div>
      )}
      {expense && phase === 'rejected' && (
        <div className="mt-3 flex justify-end gap-2">
          <Button
            size="sm"
            disabled={busy}
            onClick={() => run(() => retryExpense(expense), 'Could not retry. Try again.')}
          >
            Retry
          </Button>
          <Button
            size="sm"
            disabled={busy}
            onClick={() =>
              run(async () => {
                await deleteExpense(expense)
                intake.dismiss(upload.key)
              }, 'Could not delete this upload. Try again.')
            }
          >
            Delete
          </Button>
        </div>
      )}
      {expense && phase === 'failed' && (
        <div className="mt-3 flex justify-end">
          <Button
            size="sm"
            variant="primary"
            disabled={busy}
            onClick={() => run(() => retryExpense(expense), 'Could not retry. Try again.')}
          >
            Retry
          </Button>
        </div>
      )}
      {phase === 'upload-failed' && (
        <div className="mt-3 flex justify-end">
          <Button size="sm" onClick={() => intake.retry(upload.key)}>
            Try again
          </Button>
        </div>
      )}
    </li>
  )
}

/** The panel that follows each upload from the first byte to a filed expense. */
export function IntakeSheet() {
  const { cards, open } = useIntakeCards()
  const pickFiles = useFilePicker()
  const active = cards.filter((card) => ACTIVE.includes(card.phase)).length
  const done = cards.length - active

  return (
    <Sheet open={open} onOpenChange={intake.setOpen} modal={false}>
      <SheetContent
        overlay={false}
        onInteractOutside={(event) => event.preventDefault()}
        className="md:w-[420px]"
      >
        <div className="shrink-0 border-b border-border px-5 pt-4 pb-4">
          <SheetTitle className="text-md font-semibold">Intake</SheetTitle>
          <SheetDescription className="mt-0.5 text-xs text-fg-2 tabular">
            {cards.length === 0
              ? 'Receipts you drop appear here while the agent files them.'
              : active > 0
                ? `Filing ${active} of ${cards.length} · ${done} done`
                : `${cards.length} ${cards.length === 1 ? 'upload' : 'uploads'} processed`}
          </SheetDescription>
          {cards.length > 0 && (
            <div className="mt-3 h-1 overflow-hidden rounded-full bg-surface-3">
              <div
                className="h-full rounded-full bg-accent-400 transition-[width] duration-300"
                style={{ width: `${(done / cards.length) * 100}%` }}
              />
            </div>
          )}
        </div>

        {cards.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
            <div className="grid size-11 place-items-center rounded-lg border border-border bg-surface-2 text-fg-2">
              <FileUp className="size-5" />
            </div>
            <p className="text-sm text-fg-2">Drop receipts anywhere, or choose files.</p>
            <Button variant="primary" onClick={pickFiles}>
              Choose files
            </Button>
          </div>
        ) : (
          <ul className="flex flex-1 flex-col gap-2.5 overflow-y-auto p-4" aria-live="polite">
            {cards.map((card) => (
              <IntakeCard key={card.upload.key} {...card} />
            ))}
          </ul>
        )}

        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border px-4 py-3">
          <p className="text-2xs text-fg-3">JPG, PNG, WEBP, or PDF up to 10 MB</p>
          <Button size="sm" onClick={pickFiles}>
            Add files
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
