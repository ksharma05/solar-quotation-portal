import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { computeQuotation, printsSubsidy } from '@/services/pricing/quotationEngine'
import { formatINR } from '@/utils/formatters'
import { GST_MULTIPLIER } from '@/constants/config'

/**
 * The Apps Script backend recomputes every total rather than trusting the client, so
 * the two implementations must agree exactly. These tests load the real .gs sources
 * and run them, which catches drift the moment either side changes.
 */

const backendDir = fileURLToPath(new URL('../../../../backend/google-apps-script/', import.meta.url))

function loadGs(...files: string[]): Record<string, (...args: never[]) => unknown> {
  const source = files.map((file) => readFileSync(backendDir + file, 'utf8')).join('\n')
  const exported = [
    'computeQuotationTotals',
    'computeMilestoneAmounts',
    'printsSubsidy',
    'formatINR',
    'formatDocumentDate',
    'addDaysIso',
    'GST_MULTIPLIER',
  ]
  const factory = new Function(
    `${source}\nreturn { ${exported.join(', ')} };`
  ) as () => Record<string, (...args: never[]) => unknown>
  return factory()
}

const backend = loadGs('Pricing.gs', 'Utils.gs')

describe('backend mirrors the frontend pricing', () => {
  it('uses the same GST multiplier', () => {
    expect(backend.GST_MULTIPLIER).toBe(GST_MULTIPLIER)
    expect(backend.GST_MULTIPLIER).toBe(1.089)
  })

  it.each([
    ['Anil 10.2kW', 10_280, 373_116 / 10_280, 78_000],
    ['Vishwakarma 325kW', 325_090, 8_187_374.5 / 325_090, 0],
    ['arbitrary subsidy', 10_280, 36.3, 45_000],
    ['zero capacity', 0, 36.3, 0],
  ])('%s produces identical totals on both sides', (_label, capacityWp, rate, subsidy) => {
    const client = computeQuotation({
      capacityWp,
      ratePerWatt: rate,
      subsidyAmount: subsidy,
    })
    const server = backend.computeQuotationTotals(
      capacityWp as never,
      rate as never,
      subsidy as never
    ) as ReturnType<typeof computeQuotation>

    expect(server.priceExclGst).toBe(client.priceExclGst)
    expect(server.priceInclGst).toBe(client.priceInclGst)
    expect(server.subsidy).toBe(client.subsidy)
    expect(server.finalPayable).toBe(client.finalPayable)
  })

  it('agrees on when the subsidy section prints', () => {
    for (const amount of [78_000, 0, -1, 0.01]) {
      expect(backend.printsSubsidy(amount as never)).toBe(printsSubsidy(amount))
    }
  })

  it('splits milestones identically', () => {
    const server = backend.computeMilestoneAmounts(
      [50, 40, 10] as never,
      328_323.324 as never
    ) as number[]
    expect(server[0]).toBeCloseTo(164_161.662, 6)
    expect(server.reduce((sum, value) => sum + value, 0)).toBeCloseTo(328_323.324, 6)
  })
})

describe('backend formatting matches the printed documents', () => {
  it.each([
    [373_116, '₹3,73,116.00'],
    [406_323.324, '₹4,06,323.32'],
    [328_323.324, '₹3,28,323.32'],
    [8_187_374.5, '₹81,87,374.50'],
    [3_591_104, '₹35,91,104.00'],
    [0, '₹0.00'],
  ])('formats %d with Indian digit grouping', (value, expected) => {
    expect(backend.formatINR(value as never)).toBe(expected)
    // And the client agrees, once the U+00A0 that Intl inserts is removed.
    expect(formatINR(value).replace(/[\s]/g, '')).toBe(expected)
  })

  it('formats dates and validity windows like the samples', () => {
    expect(backend.formatDocumentDate('2026-04-14' as never)).toBe('14-04-2026')
    expect(backend.addDaysIso('2026-04-14' as never, 10 as never)).toBe('2026-04-24')
    expect(backend.addDaysIso('2026-12-28' as never, 10 as never)).toBe('2027-01-07')
  })
})
