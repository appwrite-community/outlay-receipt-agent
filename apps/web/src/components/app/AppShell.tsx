import { type ReactNode, createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { ACCEPT_ATTRIBUTE, intake } from '@/lib/intake'
import { useRealtimeSync } from '@/lib/realtime'
import { DropOverlay } from './DropOverlay'
import { IntakeSheet } from './IntakeSheet'
import { MobileNav, Sidebar } from './Sidebar'

const FilePickerContext = createContext<() => void>(() => {})

/** Opens the system file picker for receipts. */
export const useFilePicker = () => useContext(FilePickerContext)

function isTyping(target: EventTarget | null) {
  return target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
}

export function AppShell({ children }: { children: ReactNode }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const openPicker = useCallback(() => inputRef.current?.click(), [])

  useRealtimeSync(true)

  // Press U anywhere to upload.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== 'u' || event.metaKey || event.ctrlKey || event.altKey) return
      if (isTyping(event.target) || document.querySelector('[role="dialog"], [role="menu"]')) return
      event.preventDefault()
      openPicker()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [openPicker])

  // Dragging files over the window shows the drop overlay.
  useEffect(() => {
    let depth = 0
    const hasFiles = (event: DragEvent) => event.dataTransfer?.types.includes('Files') ?? false
    function onDragEnter(event: DragEvent) {
      if (!hasFiles(event)) return
      depth += 1
      setDragging(true)
    }
    function onDragLeave(event: DragEvent) {
      if (!hasFiles(event)) return
      depth = Math.max(0, depth - 1)
      if (depth === 0) setDragging(false)
    }
    function onDragOver(event: DragEvent) {
      if (hasFiles(event)) event.preventDefault()
    }
    function onDrop(event: DragEvent) {
      if (!hasFiles(event)) return
      event.preventDefault()
      depth = 0
      setDragging(false)
      const files = Array.from(event.dataTransfer?.files ?? [])
      if (files.length) intake.add(files)
    }
    window.addEventListener('dragenter', onDragEnter)
    window.addEventListener('dragleave', onDragLeave)
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragenter', onDragEnter)
      window.removeEventListener('dragleave', onDragLeave)
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('drop', onDrop)
    }
  }, [])

  return (
    <FilePickerContext.Provider value={openPicker}>
      <div className="flex min-h-dvh">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <MobileNav />
          {children}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT_ATTRIBUTE}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => {
          const files = Array.from(event.target.files ?? [])
          if (files.length) intake.add(files)
          event.target.value = ''
        }}
      />
      <DropOverlay visible={dragging} />
      <IntakeSheet />
    </FilePickerContext.Provider>
  )
}
