const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const inrWhole = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})

const plain = new Intl.NumberFormat('en-IN')

/** ₹3,591,104.00 in Indian digit grouping. */
export function formatINR(value: number): string {
  return Number.isFinite(value) ? inr.format(value) : '—'
}

export function formatINRWhole(value: number): string {
  return Number.isFinite(value) ? inrWhole.format(value) : '—'
}

/**
 * Rate per watt for display. Both sample quotations print 2dp while storing more
 * precision, so display and stored precision must never be conflated — see
 * PROJECT_PLAN.md §4.1.
 */
export function formatRate(value: number, digits = 2): string {
  return Number.isFinite(value) ? `₹${value.toFixed(digits)}` : '—'
}

/** 125,080 Wp */
export function formatWatts(value: number): string {
  return Number.isFinite(value) ? `${plain.format(Math.round(value))} Wp` : '—'
}

/** Parses user input, tolerating commas, ₹ and stray spaces. Returns null if unusable. */
export function parseNumeric(input: string): number | null {
  const cleaned = input.replace(/[₹,\s]/g, '')
  if (cleaned === '' || cleaned === '.' || cleaned === '-') return null
  const value = Number(cleaned)
  return Number.isFinite(value) ? value : null
}
