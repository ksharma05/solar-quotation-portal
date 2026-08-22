export interface ApiSuccess<T> {
  ok: true
  data: T
}

export interface ApiFailure {
  ok: false
  error: string
  message: string
}

export type ApiResult<T> = ApiSuccess<T> | ApiFailure

const ENDPOINT = import.meta.env.VITE_GAS_ENDPOINT as string | undefined

/**
 * Posts to the Apps Script web app.
 *
 * Content-Type is deliberately `text/plain`. Apps Script has no doOptions hook and
 * cannot answer a CORS preflight, so the request must stay a "simple request" —
 * a JSON content type or any custom header would trigger preflight and fail.
 * PROJECT_PLAN.md §7.2.
 */
export async function post<T>(
  action: string,
  payload: Record<string, unknown> = {},
  options: { timeoutMs?: number } = {}
): Promise<ApiResult<T>> {
  if (!ENDPOINT) {
    return {
      ok: false,
      error: 'NOT_CONFIGURED',
      message: 'VITE_GAS_ENDPOINT is not set. Copy .env.example to .env.local.',
    }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 30_000)

  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, ...payload }),
      redirect: 'follow',
      signal: controller.signal,
    })

    if (!response.ok) {
      return {
        ok: false,
        error: 'HTTP_' + response.status,
        message: `Server responded ${response.status}`,
      }
    }

    const body = (await response.json()) as Record<string, unknown>
    if (body.ok === true) {
      return { ok: true, data: body as T }
    }

    return {
      ok: false,
      error: String(body.error ?? 'UNKNOWN'),
      message: String(body.message ?? 'Request failed'),
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return { ok: false, error: 'TIMEOUT', message: 'The server took too long to respond' }
    }
    return {
      ok: false,
      error: 'NETWORK',
      message: 'Could not reach the server. Check your connection.',
    }
  } finally {
    clearTimeout(timeout)
  }
}

export const isConfigured = (): boolean => Boolean(ENDPOINT)
