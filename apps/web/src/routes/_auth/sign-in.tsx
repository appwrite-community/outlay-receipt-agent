import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { AppwriteException } from 'appwrite'
import { type FormEvent, useState } from 'react'
import { AuthCard, Field, FormBanner } from '@/components/app/AuthForm'
import { Button } from '@/components/ui/button'
import { signIn } from '@/lib/queries/account'
import { usePageTitle } from '@/lib/use-page-title'

export const Route = createFileRoute('/_auth/sign-in')({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } =>
    typeof search.redirect === 'string' && search.redirect.startsWith('/')
      ? { redirect: search.redirect }
      : {},
  component: SignIn,
})

function SignIn() {
  usePageTitle('Sign in')
  const navigate = useNavigate()
  const { redirect } = Route.useSearch()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [banner, setBanner] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setFieldError(null)
    setBanner(null)
    try {
      await signIn(email.trim(), password)
      await navigate({ href: redirect ?? '/', replace: true })
    } catch (error) {
      if (error instanceof AppwriteException && error.type === 'user_invalid_credentials') {
        setFieldError('The email or password is incorrect.')
      } else if (
        error instanceof AppwriteException &&
        error.type === 'general_rate_limit_exceeded'
      ) {
        setBanner('Too many attempts. Wait a minute, then try again.')
      } else if (error instanceof AppwriteException && error.code >= 400 && error.code < 500) {
        setBanner(error.message)
      } else {
        setBanner('Outlay could not reach the server. Check your connection and try again.')
      }
      setSubmitting(false)
    }
  }

  return (
    <AuthCard title="Sign in to Outlay" description="Pick up where the agent left off.">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        {banner && <FormBanner>{banner}</FormBanner>}
        <Field
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          autoFocus
        />
        <Field
          id="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={fieldError}
          required
        />
        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="mt-1 w-full"
          disabled={submitting || !email || !password}
        >
          Sign in
        </Button>
        <p className="text-center text-xs text-fg-2">
          New to Outlay?{' '}
          <Link
            to="/sign-up"
            search={redirect ? { redirect } : {}}
            className="font-medium text-accent-300 hover:text-fg"
          >
            Create an account
          </Link>
        </p>
      </form>
    </AuthCard>
  )
}
