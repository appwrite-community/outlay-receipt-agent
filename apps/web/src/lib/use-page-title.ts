import { useEffect } from 'react'

export function usePageTitle(title: string | null | undefined) {
  useEffect(() => {
    document.title = title ? `${title} · Outlay` : 'Outlay'
  }, [title])
}
