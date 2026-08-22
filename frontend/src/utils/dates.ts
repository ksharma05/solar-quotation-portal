/** Formats an ISO date (yyyy-mm-dd) as dd-mm-yyyy, matching the sample quotations. */
export function formatDocumentDate(iso: string): string {
  const parsed = parseIso(iso)
  if (!parsed) return iso
  const [year, month, day] = parsed
  return `${pad(day)}-${pad(month)}-${year}`
}

/** Quotation date plus its validity window, as an ISO string. */
export function validTillIso(iso: string, days: number): string | null {
  const parsed = parseIso(iso)
  if (!parsed || !Number.isFinite(days)) return null
  const [year, month, day] = parsed
  // Constructed in UTC so a local timezone can never shift the printed date.
  const date = new Date(Date.UTC(year, month - 1, day))
  date.setUTCDate(date.getUTCDate() + Math.trunc(days))
  return date.toISOString().slice(0, 10)
}

/**
 * Quotation number, format SGT/YYYY/MM/B<nn> — e.g. SGT/2026/04/B21.
 * Taken from the sample documents. PROJECT_PLAN.md §4.4.
 */
export function suggestQuotationNumber(iso: string, sequence = 1): string {
  const parsed = parseIso(iso)
  const [year, month] = parsed ?? [new Date().getFullYear(), new Date().getMonth() + 1]
  return `SGT/${year}/${pad(month)}/B${pad(sequence)}`
}

function parseIso(iso: string): [number, number, number] | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '')
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  return [year, month, day]
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}
