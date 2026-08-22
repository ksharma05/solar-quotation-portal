import { useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AuthLayout } from '@/components/ui/auth-layout'
import { Button } from '@/components/ui/button'
import { Heading } from '@/components/ui/heading'
import { Input } from '@/components/ui/input'
import { Field, Label } from '@/components/ui/fieldset'
import { Text } from '@/components/ui/text'
import { FormError } from '@/components/common/FormError'
import { COMPANY } from '@/constants/config'
import { isConfigured } from '@/services/api/client'
import { useAuthStore } from '@/stores/authStore'

export function LoginPage() {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const signIn = useAuthStore((state) => state.signIn)
  const navigate = useNavigate()
  const location = useLocation()

  const from = (location.state as { from?: string } | null)?.from ?? '/'

  const onSubmit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault()
    setError('')

    if (!/^\d{4}$/.test(pin)) {
      setError('Enter your 4-digit PIN')
      inputRef.current?.focus()
      return
    }

    setBusy(true)
    const result = await signIn(pin)
    setBusy(false)

    if (!result.ok) {
      setError(result.message ?? 'Sign in failed')
      setPin('')
      inputRef.current?.focus()
      return
    }
    navigate(from, { replace: true })
  }

  return (
    <AuthLayout>
      <form onSubmit={onSubmit} className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center">
          <img src="/logo.png" alt="" className="size-16 object-contain" />
          <Heading className="mt-4">{COMPANY.name}</Heading>
          <Text className="mt-1 text-sm/6">Quotation Portal</Text>
        </div>

        <Field className="mt-8">
          <Label>PIN</Label>
          <Input
            ref={inputRef}
            autoFocus
            type="password"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={4}
            placeholder="••••"
            value={pin}
            // Digits only, so a stray character cannot silently fail validation.
            onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 4))}
            className="text-center"
          />
        </Field>

        {error && <FormError className="mt-3">{error}</FormError>}

        {!isConfigured() && (
          <Text className="mt-3 text-xs/5">
            No backend configured. Set <code>VITE_GAS_ENDPOINT</code> in{' '}
            <code>.env.local</code> to sign in.
          </Text>
        )}

        <Button type="submit" className="mt-6 w-full" disabled={busy || pin.length !== 4}>
          {busy ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </AuthLayout>
  )
}
