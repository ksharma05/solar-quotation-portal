import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Subheading } from '@/components/ui/heading'
import { Text } from '@/components/ui/text'
import { FormError } from '@/components/common/FormError'
import { isConfigured } from '@/services/api/client'
import { diagnostics, type DiagnosticsResult } from '@/services/api/quotationApi'
import { useAuthStore } from '@/stores/authStore'

/**
 * Probes each Google service the backend depends on.
 *
 * A deployment authorised before PDF and email support existed is missing those
 * OAuth scopes, and the resulting failure is otherwise indistinguishable from a
 * code bug. This says which one broke.
 */
export function Diagnostics() {
  const token = useAuthStore((state) => state.token)
  const [result, setResult] = useState<DiagnosticsResult | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const run = async (): Promise<void> => {
    setBusy(true)
    setError('')
    setResult(null)

    const response = await diagnostics(token!)
    setBusy(false)

    if (!response.ok) return setError(response.message)
    setResult(response.data)
  }

  if (!isConfigured() || !token) {
    return (
      <section>
        <Subheading>Backend diagnostics</Subheading>
        <Text className="mt-1 text-xs/5">Sign in with a configured backend to run checks.</Text>
      </section>
    )
  }

  return (
    <section>
      <Subheading>Backend diagnostics</Subheading>
      <Text className="mt-1 text-xs/5">
        Checks Sheets, Docs, Drive, the logo and the mail quota. Run this first if PDF or email
        fails.
      </Text>

      <Button outline className="mt-4" onClick={run} disabled={busy}>
        {busy ? 'Running…' : 'Run diagnostics'}
      </Button>

      {error && <FormError className="mt-3">{error}</FormError>}

      {result && (
        <div className="mt-4 space-y-2">
          {Object.entries(result.checks).map(([name, check]) => (
            <div
              key={name}
              className="flex items-start justify-between gap-4 rounded-lg border border-zinc-950/10 px-3 py-2 dark:border-white/10"
            >
              <div className="min-w-0">
                <div className="text-sm/6 font-medium">{name}</div>
                <div className="text-xs/5 break-words text-zinc-500 dark:text-zinc-400">
                  {check.detail}
                </div>
              </div>
              <span
                className={
                  check.ok
                    ? 'shrink-0 text-sm/6 text-green-700 dark:text-green-400'
                    : 'shrink-0 text-sm/6 text-red-600 dark:text-red-400'
                }
              >
                {check.ok ? 'OK' : 'FAILED'}
              </span>
            </div>
          ))}

          {result.failures.length > 0 && (
            <FormError className="mt-2">
              Failing: {result.failures.join(', ')}. If these mention permission or
              authorisation, re-authorise the script and deploy a new version.
            </FormError>
          )}
        </div>
      )}
    </section>
  )
}
