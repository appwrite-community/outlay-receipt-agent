import { queryOptions } from '@tanstack/react-query'
import { AppwriteException, ID } from 'appwrite'
import { account } from '../appwrite'
import { queryClient } from '../query-client'
import type { Preferences, User } from '../types'

// Remembers that this browser has signed in before. Without it, a signed-out
// visit would first send an account request that can only fail.
const SESSION_HINT = 'outlay.signedIn'

async function getAccount(): Promise<User | null> {
  if (!localStorage.getItem(SESSION_HINT)) return null
  try {
    return await account.get<Preferences>()
  } catch (error) {
    if (error instanceof AppwriteException && error.code === 401) {
      localStorage.removeItem(SESSION_HINT)
      return null
    }
    throw error
  }
}

export const accountQuery = queryOptions({
  queryKey: ['account'],
  queryFn: getAccount,
  staleTime: Number.POSITIVE_INFINITY,
})

export const homeCurrency = (user: User) => user.prefs.currency ?? 'USD'

export async function signIn(email: string, password: string): Promise<User> {
  await account.createEmailPasswordSession({ email, password })
  localStorage.setItem(SESSION_HINT, '1')
  return refreshAccount()
}

export async function signUp(input: { name: string; email: string; password: string; currency: string }): Promise<User> {
  await account.create({ userId: ID.unique(), email: input.email, password: input.password, name: input.name })
  await account.createEmailPasswordSession({ email: input.email, password: input.password })
  localStorage.setItem(SESSION_HINT, '1')
  // The intake agent reads the home currency from the account preferences.
  await account.updatePrefs<Preferences>({ prefs: { currency: input.currency } })
  return refreshAccount()
}

export async function signOut(): Promise<void> {
  await account.deleteSession({ sessionId: 'current' })
  localStorage.removeItem(SESSION_HINT)
  queryClient.setQueryData(accountQuery.queryKey, null)
}

/** Drops everything cached for the person who signed out. */
export function forgetSignedOutData(): void {
  queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== 'account' })
}

export async function updateProfile(user: User, changes: { name: string; currency: string }): Promise<User> {
  if (changes.name !== user.name) await account.updateName({ name: changes.name })
  if (changes.currency !== homeCurrency(user)) {
    await account.updatePrefs<Preferences>({ prefs: { ...user.prefs, currency: changes.currency } })
  }
  return refreshAccount()
}

async function refreshAccount(): Promise<User> {
  const user = await account.get<Preferences>()
  queryClient.setQueryData(accountQuery.queryKey, user)
  return user
}
