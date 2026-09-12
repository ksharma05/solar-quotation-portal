export interface ApiSuccess<T> {
  ok: true
  data: T
}

export interface ApiFailure {
  ok: false
  error: string
  message: string
  /**
   * What the server actually sent, when it sent something unusable — an HTML error
   * page, an empty body, a non-200 status. Diagnostics only; never shown to the
   * operator, but it is the difference between "something went wrong" and a fix.
   */
  detail?: string
}

export type ApiResult<T> = ApiSuccess<T> | ApiFailure

const ENDPOINT = import.meta.env.VITE_GAS_ENDPOINT as string | undefined

/**
 * Actions that can be replayed without changing anything.
 *
 * The distinction matters because Apps Script answers a POST with a 302 to a
 * one-shot `googleusercontent.com/macros/echo` URL, and that URL intermittently
 * 404s *after the script has already run*. Retrying a read costs a round trip;
 * retrying `saveQuotation` would file the same quotation in the sheet twice.
 */
const RETRYABLE_ACTIONS = new Set([
  'ping',
  'listProjects',
  'listQuotations',
  'getQuotation',
  'getProjectImages',
  'whatsAppLink',
  'diagnostics',
])

/** Failures worth one more attempt: the request never reached the script, or its answer was lost. */
const TRANSIENT_ERRORS = new Set(['HTTP_404', 'HTTP_500', 'HTTP_502', 'HTTP_503', 'BAD_RESPONSE'])

const snippet = (text: string): string =>
  text.length > 300 ? `${text.slice(0, 300)}…` : text || '(empty body)'

/**
 * Posts to the Apps Script web app.
 *
 * Content-Type is deliberately `text/plain`. Apps Script has no doOptions hook and
 * cannot answer a CORS preflight, so the request must stay a "simple request" —
 * a JSON content type or any custom header would trigger preflight and fail.
 * PROJECT_PLAN.md §7.2.
 */
async function attempt<T>(
  action: string,
  payload: Record<string, unknown>,
  timeoutMs: number
): Promise<ApiResult<T>> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(ENDPOINT!, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, ...payload }),
      redirect: 'follow',
      signal: controller.signal,
    })

    // Read as text, not JSON: a failed Apps Script call answers with an HTML error
    // page, and response.json() would throw it away as an indistinguishable
    // "network" fault. `response.url` is the address *after* the 302, which is the
    // one that actually failed.
    const text = await response.text()

    if (!response.ok) {
      return {
        ok: false,
        error: `HTTP_${response.status}`,
        message: `Server responded ${response.status}`,
        detail: `${response.url}\n${snippet(text)}`,
      }
    }

    let body: Record<string, unknown>
    try {
      body = JSON.parse(text) as Record<string, unknown>
    } catch {
      return {
        ok: false,
        error: 'BAD_RESPONSE',
        message: 'The server sent something that was not a valid response.',
        detail: `${response.url}\n${snippet(text)}`,
      }
    }

    if (body.ok === true) return { ok: true, data: body as T }

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
      detail: String((error as Error).message ?? error),
    }
  } finally {
    clearTimeout(timeout)
  }
}

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

  const timeoutMs = options.timeoutMs ?? 30_000
  let result = await attempt<T>(action, payload, timeoutMs)

  if (!result.ok && TRANSIENT_ERRORS.has(result.error) && RETRYABLE_ACTIONS.has(action)) {
    console.warn(`[api] ${action} failed (${result.error}), retrying once:`, result.detail)
    await new Promise((resolve) => setTimeout(resolve, 600))
    result = await attempt<T>(action, payload, timeoutMs)
  }

  if (!result.ok) {
    console.error(`[api] ${action} failed: ${result.error} — ${result.message}`, result.detail ?? '')
  }

  return result
}

export const isConfigured = (): boolean => Boolean(ENDPOINT)
