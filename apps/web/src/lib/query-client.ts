import { QueryClient } from '@tanstack/react-query'
import { AppwriteException } from 'appwrite'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Realtime keeps the cache fresh, so there is no need to refetch on focus.
      staleTime: 60_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) =>
        !(error instanceof AppwriteException && error.code >= 400 && error.code < 500) && failureCount < 2,
    },
  },
})

/** The message to show a person for a failed request. */
export function errorMessage(error: unknown, fallback = 'Something went wrong. Try again.'): string {
  if (error instanceof AppwriteException && error.code >= 400 && error.code < 500 && error.message) return error.message
  if (error instanceof TypeError) return 'Outlay could not reach the server. Check your connection and try again.'
  return fallback
}
