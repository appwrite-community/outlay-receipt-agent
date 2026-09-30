import { useEffect, useRef, useState } from 'react'
import { Skeleton } from '@/components/ui/skeleton'

type LoadingTask = ReturnType<(typeof import('pdfjs-dist'))['getDocument']>
type PdfDocument = Awaited<LoadingTask['promise']>

/** Loads pdf.js only when a PDF is shown. Vite bundles the worker. */
async function openPdf(url: string): Promise<LoadingTask> {
  const [pdfjs, { default: workerUrl }] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ])
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
  return pdfjs.getDocument({ url, verbosity: pdfjs.VerbosityLevel.ERRORS })
}

function PdfPage({
  pdf,
  number,
  width,
  rotation,
}: {
  pdf: PdfDocument
  number: number
  width: number
  rotation: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    let cancelled = false
    let task: { cancel: () => void; promise: Promise<void> } | undefined
    pdf.getPage(number).then((page) => {
      const canvas = canvasRef.current
      if (cancelled || !canvas) return
      const base = page.getViewport({ scale: 1, rotation })
      const ratio = window.devicePixelRatio || 1
      const viewport = page.getViewport({ scale: (width / base.width) * ratio, rotation })
      canvas.width = Math.floor(viewport.width)
      canvas.height = Math.floor(viewport.height)
      canvas.style.width = `${width}px`
      canvas.style.height = `${Math.floor(viewport.height / ratio)}px`
      task = page.render({ canvas, viewport })
      task.promise.catch(() => {})
    })
    return () => {
      cancelled = true
      task?.cancel()
    }
  }, [pdf, number, width, rotation])

  return (
    <canvas
      ref={canvasRef}
      className="block rounded-sm bg-white shadow-[0_8px_24px_-12px_rgb(0_0_0/0.8)]"
    />
  )
}

/** Every page of a PDF receipt, stacked, `width` px wide. */
export function PdfPages({
  url,
  width,
  rotation,
  onError,
}: {
  url: string
  width: number
  rotation: number
  onError: () => void
}) {
  const [pdf, setPdf] = useState<PdfDocument | null>(null)

  useEffect(() => {
    let cancelled = false
    let task: LoadingTask | undefined
    setPdf(null)
    openPdf(url)
      .then((opened) => {
        task = opened
        if (cancelled) return void opened.destroy()
        return opened.promise.then((document) => !cancelled && setPdf(document))
      })
      .catch(() => !cancelled && onError())
    return () => {
      cancelled = true
      void task?.destroy()
    }
  }, [url, onError])

  if (!pdf) return <Skeleton className="rounded-sm" style={{ width, height: width * 1.294 }} />

  return (
    <div className="flex flex-col gap-4">
      {Array.from({ length: pdf.numPages }, (_, index) => (
        <PdfPage key={index} pdf={pdf} number={index + 1} width={width} rotation={rotation} />
      ))}
    </div>
  )
}
