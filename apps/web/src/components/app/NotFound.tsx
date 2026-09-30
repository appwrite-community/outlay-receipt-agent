import { Link } from '@tanstack/react-router'
import { FileQuestion } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { usePageTitle } from '@/lib/use-page-title'
import { EmptyState } from './EmptyState'

export function NotFound() {
  usePageTitle('Page not found')
  return (
    <div className="grid min-h-svh place-items-center">
      <EmptyState icon={FileQuestion} title="This page does not exist" description="Check the address, or go back to your overview.">
        <Button asChild variant="primary">
          <Link to="/">Go to overview</Link>
        </Button>
      </EmptyState>
    </div>
  )
}
