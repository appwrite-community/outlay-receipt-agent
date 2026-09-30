import { ExternalLink, ImageOff, Minus, Plus, RotateCw } from 'lucide-react'
import { type PointerEvent, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip } from '@/components/ui/tooltip'
import { storage } from '@/lib/appwrite'
import { formatBytes } from '@/lib/format'
import { BUCKET_ID } from '@/lib/ids'
import type { Expense } from '@/lib/types'
import { useElementSize } from '@/lib/use-element-size'
import { cn } from '@/lib/utils'
import { PdfPages } from './PdfPages'

const ZOOM_STEPS = [1, 1.5, 2, 3]
const MAX_ZOOM = 4
const PADDING = 24

/**
 * A link to one private receipt. The token in the expense row opens this file
 * only, so it works in an <img> or a new tab without a session cookie.
 */
export function receiptUrl(expense: Pick<Expense, '$id' | 'viewToken'>): string | null {
  if (!expense.viewToken) return null
  return storage.getFileView({ bucketId: BUCKET_ID, fileId: expense.$id, token: expense.viewToken })
}

/** Shows a receipt image or PDF with zoom, rotate, and pan. */
export function ReceiptViewer({ expense, className }: { expense: Expense; className?: string }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const { width, height } = useElementSize(scrollRef)
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null)
  const focus = useRef({ x: 0.5, y: 0.5 })
  const url = receiptUrl(expense)
  const isPdf = expense.mimeType === 'application/pdf'

  // A different receipt starts at the default view.
  useEffect(() => {
    focus.current = { x: 0.5, y: 0.5 }
    setZoom(1)
    setRotation(0)
    setNatural(null)
    setFailed(false)
  }, [expense.$id])

  const onPdfError = useCallback(() => setFailed(true), [])

  // Zooming keeps the same part of the receipt in the middle of the panel.
  const changeZoom = useCallback((next: (value: number) => number) => {
    const element = scrollRef.current
    if (element) {
      focus.current = {
        x: (element.scrollLeft + element.clientWidth / 2) / element.scrollWidth,
        y: (element.scrollTop + element.clientHeight / 2) / element.scrollHeight,
      }
    }
    setZoom(next)
  }, [])

  useLayoutEffect(() => {
    const element = scrollRef.current
    if (!element) return
    element.scrollLeft = focus.current.x * element.scrollWidth - element.clientWidth / 2
    element.scrollTop = focus.current.y * element.scrollHeight - element.clientHeight / 2
  }, [zoom])

  // Ctrl or Cmd with the wheel zooms, like a map.
  useEffect(() => {
    const element = scrollRef.current
    if (!element) return
    function onWheel(event: WheelEvent) {
      if (!event.ctrlKey && !event.metaKey) return
      event.preventDefault()
      changeZoom((value) => Math.min(MAX_ZOOM, Math.max(1, value * (event.deltaY < 0 ? 1.1 : 1 / 1.1))))
    }
    element.addEventListener('wheel', onWheel, { passive: false })
    return () => element.removeEventListener('wheel', onWheel)
  }, [changeZoom])

  const zoomIn = () => changeZoom((value) => ZOOM_STEPS.find((step) => step > value + 0.01) ?? MAX_ZOOM)
  const zoomOut = () => changeZoom((value) => [...ZOOM_STEPS].reverse().find((step) => step < value - 0.01) ?? 1)

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    const element = scrollRef.current
    if (!element || zoom === 1 || event.button !== 0) return
    drag.current = { x: event.clientX, y: event.clientY, left: element.scrollLeft, top: element.scrollTop }
    element.setPointerCapture(event.pointerId)
  }
  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const element = scrollRef.current
    if (!element || !drag.current) return
    element.scrollLeft = drag.current.left - (event.clientX - drag.current.x)
    element.scrollTop = drag.current.top - (event.clientY - drag.current.y)
  }
  const onPointerUp = () => {
    drag.current = null
  }

  // Fit the whole image inside the panel, then scale by the zoom.
  const turned = rotation % 180 !== 0
  const box = { width: Math.max(0, width - PADDING * 2), height: Math.max(0, height - PADDING * 2) }
  let image: { width: number; height: number; frameWidth: number; frameHeight: number } | null = null
  if (natural && box.width > 0 && box.height > 0) {
    const shownWidth = turned ? natural.height : natural.width
    const shownHeight = turned ? natural.width : natural.height
    const fit = Math.min(box.width / shownWidth, box.height / shownHeight, 1.5) * zoom
    image = {
      width: natural.width * fit,
      height: natural.height * fit,
      frameWidth: shownWidth * fit,
      frameHeight: shownHeight * fit,
    }
  }

  return (
    <div className={cn('flex min-h-0 flex-col overflow-hidden bg-surface-1', className)}>
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-3">
        <p className="min-w-0 flex-1 truncate font-mono text-xs text-fg-2">
          {expense.fileName}
          {expense.sizeBytes !== null && <span className="text-fg-3"> · {formatBytes(expense.sizeBytes)}</span>}
        </p>
        <div className="flex items-center gap-0.5">
          <Tooltip content="Zoom out">
            <Button variant="ghost" size="icon-sm" onClick={zoomOut} disabled={zoom <= 1} aria-label="Zoom out">
              <Minus />
            </Button>
          </Tooltip>
          <button
            type="button"
            onClick={() => changeZoom(() => 1)}
            className="h-7 w-12 rounded-sm text-center font-mono text-2xs text-fg-2 tabular hover:bg-surface-2 hover:text-fg"
            aria-label="Reset zoom"
          >
            {Math.round(zoom * 100)}%
          </button>
          <Tooltip content="Zoom in">
            <Button variant="ghost" size="icon-sm" onClick={zoomIn} disabled={zoom >= MAX_ZOOM} aria-label="Zoom in">
              <Plus />
            </Button>
          </Tooltip>
          <span className="mx-1 h-4 w-px bg-border-strong" />
          <Tooltip content="Rotate">
            <Button variant="ghost" size="icon-sm" onClick={() => setRotation((value) => (value + 90) % 360)} aria-label="Rotate">
              <RotateCw />
            </Button>
          </Tooltip>
          {url && (
            <Tooltip content="Open original">
              <Button asChild variant="ghost" size="icon-sm">
                <a href={url} target="_blank" rel="noreferrer" aria-label="Open original">
                  <ExternalLink />
                </a>
              </Button>
            </Tooltip>
          )}
        </div>
      </div>

      <div
        ref={scrollRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className={cn(
          'dotted-grid relative min-h-0 flex-1 overflow-auto bg-bg',
          zoom > 1 && 'cursor-grab active:cursor-grabbing',
        )}
      >
        {failed ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
            <ImageOff className="size-6 text-fg-3" />
            <p className="text-sm text-fg-2">This receipt could not be loaded.</p>
            <Button
              size="sm"
              onClick={() => {
                setFailed(false)
                setNatural(null)
                setAttempt((value) => value + 1)
              }}
            >
              Try again
            </Button>
          </div>
        ) : !url ? (
          <div className="flex h-full items-center justify-center p-6">
            <Skeleton className="aspect-[3/4] h-[70%] max-h-[560px] rounded-sm" />
          </div>
        ) : isPdf ? (
          <div className="mx-auto" style={{ width: width * zoom - PADDING * 2, padding: `${PADDING}px 0` }}>
            {width > 0 && (
              <PdfPages key={attempt} url={url} width={width * zoom - PADDING * 2} rotation={rotation} onError={onPdfError} />
            )}
          </div>
        ) : (
          <div className="flex min-h-full min-w-full w-max items-center justify-center" style={{ padding: PADDING }}>
            {!image && <Skeleton className="aspect-[3/4] h-[70%] max-h-[560px] rounded-sm" />}
            <div
              className={cn('relative shrink-0', !image && 'absolute opacity-0')}
              style={image ? { width: image.frameWidth, height: image.frameHeight } : undefined}
            >
              <img
                key={attempt}
                src={url}
                alt={`Receipt ${expense.fileName}`}
                draggable={false}
                onLoad={(event) => setNatural({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
                onError={() => setFailed(true)}
                className="absolute top-1/2 left-1/2 max-w-none rounded-sm shadow-[0_12px_32px_-12px_rgb(0_0_0/0.9)] select-none"
                style={
                  image
                    ? { width: image.width, height: image.height, transform: `translate(-50%, -50%) rotate(${rotation}deg)` }
                    : { width: 1, height: 1 }
                }
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
