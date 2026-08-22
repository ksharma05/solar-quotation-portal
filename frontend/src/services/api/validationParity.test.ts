import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { quotationSchema } from '@/services/validation/quotationSchema'
import { defaultBomRows } from '@/constants/bomDefaults'
import { defaultMilestones } from '@/constants/milestones'

/**
 * Server-side validation is the actual control — the endpoint is reachable directly,
 * so the Zod schema is only a convenience. These tests run the real Validation.gs and
 * assert it rejects everything the client rejects, and for the same reasons.
 */

const backendDir = fileURLToPath(new URL('../../../../backend/google-apps-script/', import.meta.url))

interface ValidationResult {
  ok: boolean
  error?: string
  message?: string
  errors?: string[]
  value?: Record<string, unknown>
}

function loadValidator(): (input: unknown) => ValidationResult {
  const source = ['Pricing.gs', 'Validation.gs']
    .map((file) => readFileSync(backendDir + file, 'utf8'))
    .join('\n')
  const factory = new Function(`${source}\nreturn validateQuotation;`) as () => (
    input: unknown
  ) => ValidationResult
  return factory()
}

const validateQuotation = loadValidator()

/** Shape the server expects: flat, with capacity and rate already resolved. */
const serverPayload = {
  leadName: 'Anil Bhaiya Ji',
  projectName: 'Ajmer, Rajasthan',
  quotationNumber: 'SGT/2026/04/B21',
  quotationDate: '2026-04-14',
  validityDays: 10,
  email: 'anil@example.com',
  phone: '9876543210',
  capacityWp: 10_280,
  ratePerWatt: 373_116 / 10_280,
  subsidyAmount: 78_000,
  inverterKw: 10,
  milestones: defaultMilestones(10.28),
  bom: defaultBomRows(10.28),
}

/** Equivalent client-side shape, for cross-checking the same decision. */
const clientPayload = {
  leadName: 'Anil Bhaiya Ji',
  projectName: 'Ajmer, Rajasthan',
  quotationNumber: 'SGT/2026/04/B21',
  quotationDate: '2026-04-14',
  validityDays: 10,
  email: 'anil@example.com',
  phone: '9876543210',
  panels: [
    { panelId: 'waaree-dcr-590', count: 7 },
    { panelId: 'waaree-ndcr-615', count: 10 },
  ],
  inverterId: 'sungrow-10',
  subsidyAmount: 78_000,
  milestones: defaultMilestones(10.28),
  bom: defaultBomRows(10.28),
}

describe('server accepts a valid quotation', () => {
  it('accepts the Anil reconstruction, as the client does', () => {
    expect(validateQuotation(serverPayload).ok).toBe(true)
    expect(quotationSchema.safeParse(clientPayload).success).toBe(true)
  })

  it('returns the normalised value for persistence', () => {
    const result = validateQuotation(serverPayload)
    expect(result.value?.capacityWp).toBe(10_280)
    expect(result.value?.inverterKw).toBe(10)
    expect(result.value?.leadName).toBe('Anil Bhaiya Ji')
  })

  it('trims whitespace rather than rejecting it', () => {
    const result = validateQuotation({ ...serverPayload, leadName: '  Anil Bhaiya Ji  ' })
    expect(result.ok).toBe(true)
    expect(result.value?.leadName).toBe('Anil Bhaiya Ji')
  })
})

describe('server rejects what the client rejects', () => {
  it.each([
    ['short client name', { leadName: 'A' }, /Client name/],
    ['missing project', { projectName: '' }, /Project or location/],
    ['missing quotation number', { quotationNumber: '' }, /Quotation number/],
    ['bad email', { email: 'not-an-email' }, /Email/],
    ['bad phone', { phone: '12345' }, /Phone/],
    ['zero capacity', { capacityWp: 0 }, /Capacity/],
    ['over-max capacity', { capacityWp: 600_000 }, /Maximum system size/],
    ['under-min capacity', { capacityWp: 500 }, /Minimum system size/],
    ['zero rate', { ratePerWatt: 0 }, /Rate per watt/],
    ['negative subsidy', { subsidyAmount: -1 }, /negative/],
    ['subsidy above total', { subsidyAmount: 10_000_000 }, /cannot exceed/],
    ['empty bom', { bom: [] }, /bill of materials/],
  ])('rejects %s', (_label, patch, pattern) => {
    const result = validateQuotation({ ...serverPayload, ...patch })
    expect(result.ok).toBe(false)
    expect(result.message).toMatch(pattern)
  })

  it('rejects milestones that do not total 100%, like the client', () => {
    const milestones = [
      { percentage: 50, description: 'Advance with Work Order' },
      { percentage: 40, description: 'After installation' },
    ]
    const server = validateQuotation({ ...serverPayload, milestones })
    const client = quotationSchema.safeParse({ ...clientPayload, milestones })

    expect(server.ok).toBe(false)
    expect(client.success).toBe(false)
    expect(server.message).toMatch(/must be exactly 100%/)
  })

  it('accepts a fractional split totalling 100%, like the client', () => {
    const milestones = [
      { percentage: 33.33, description: 'Advance with Work Order' },
      { percentage: 33.33, description: 'After installation' },
      { percentage: 33.34, description: 'On commissioning' },
    ]
    expect(validateQuotation({ ...serverPayload, milestones }).ok).toBe(true)
    expect(quotationSchema.safeParse({ ...clientPayload, milestones }).success).toBe(true)
  })

  it('requires a description on every milestone', () => {
    const result = validateQuotation({
      ...serverPayload,
      milestones: [
        { percentage: 50, description: '' },
        { percentage: 50, description: 'On commissioning' },
      ],
    })
    expect(result.ok).toBe(false)
    expect(result.message).toMatch(/description/)
  })

  it('allows empty optional contact details', () => {
    expect(validateQuotation({ ...serverPayload, email: '', phone: '' }).ok).toBe(true)
  })
})

describe('server survives hostile input', () => {
  it.each([
    ['null', null],
    ['undefined', undefined],
    ['a string', 'not an object'],
    ['a number', 42],
    ['an empty object', {}],
  ])('rejects %s without throwing', (_label, input) => {
    expect(() => validateQuotation(input)).not.toThrow()
    expect(validateQuotation(input).ok).toBe(false)
  })

  it('rejects non-array milestones and bom without throwing', () => {
    expect(validateQuotation({ ...serverPayload, milestones: 'nope' }).ok).toBe(false)
    expect(validateQuotation({ ...serverPayload, bom: { not: 'an array' } }).ok).toBe(false)
  })

  it('does not trust a client-supplied total', () => {
    // Extra fields are ignored entirely; only inputs are carried through.
    const result = validateQuotation({
      ...serverPayload,
      priceInclGst: 1,
      finalPayable: 1,
      totals: { anything: true },
    })
    expect(result.ok).toBe(true)
    expect(result.value).not.toHaveProperty('priceInclGst')
    expect(result.value).not.toHaveProperty('finalPayable')
    expect(result.value).not.toHaveProperty('totals')
  })
})
