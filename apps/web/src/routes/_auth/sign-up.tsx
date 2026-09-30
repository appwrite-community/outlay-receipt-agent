import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { AppwriteException } from 'appwrite'
import { type FormEvent, useState } from 'react'
import { AuthCard, Field, FormBanner } from '@/components/app/AuthForm'
import { CurrencySelect } from '@/components/app/CurrencySelect'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { signUp } from '@/lib/queries/account'
import { usePageTitle } from '@/lib/use-page-title'

export const Route = createFileRoute('/_auth/sign-up')({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } =>
    typeof search.redirect === 'string' && search.redirect.startsWith('/') ? { redirect: search.redirect } : {},
  component: SignUp,
})

type Errors = { email?: string; password?: string }

const PASSWORD_ERRORS: Record<string, string> = {
  password_personal_data: 'Choose a password that does not include your name or email.',
  password_pwned: 'This password appears in known data breaches. Choose a different one.',
  password_recently_used: 'Choose a password you have not used before.',
}

function SignUp() {
  usePageTitle('Create an account')
  const navigate = useNavigate()
  const { redirect } = Route.useSearch()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<Errors>({})
  const [banner, setBanner] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setBanner(null)
    if (password.length < 8) {
      setErrors({ password: 'Use at least 8 characters.' })
      return
    }
    setErrors({})
    setSubmitting(true)
    try {
      await signUp({ name: name.trim(), email: email.trim(), password, currency })
      await navigate({ href: redirect ?? '/', replace: true })
    } catch (error) {
      if (error instanceof AppwriteException && error.type === 'user_already_exists') {
        setErrors({ email: 'An account with this email already exists. Sign in instead.' })
      } else if (error instanceof AppwriteException && PASSWORD_ERRORS[error.type]) {
        setErrors({ password: PASSWORD_ERRORS[error.type] })
      } else if (error instanceof AppwriteException && error.code >= 400 && error.code < 500) {
        setBanner(error.message)
      } else {
        setBanner('Outlay could not reach the server. Check your connection and try again.')
      }
      setSubmitting(false)
    }
  }

  return (
    <AuthCard title="Create your Outlay account" description="Upload a receipt and the agent files it for you.">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        {banner && <FormBanner>{banner}</FormBanner>}
        <Field id="name" label="Name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} required autoFocus />
        <Field
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={errors.email}
          required
        />
        <Field
          id="password"
          label="Password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={errors.password}
          hint="At least 8 characters."
          required
        />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="currency">Home currency</Label>
          <CurrencySelect id="currency" value={currency} onValueChange={setCurrency} className="h-9" />
        </div>
        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="mt-1 w-full"
          disabled={submitting || !name.trim() || !email.trim() || !password}
        >
          Create account
        </Button>
        <p className="text-center text-xs text-fg-2">
          Already have an account?{' '}
          <Link to="/sign-in" search={redirect ? { redirect } : {}} className="font-medium text-accent-300 hover:text-fg">
            Sign in
          </Link>
        </p>
      </form>
    </AuthCard>
  )
}
