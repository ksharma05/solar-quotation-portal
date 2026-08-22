import { describe, expect, it } from 'vitest'
import {
  capacityFromPanels,
  computeQuotation,
  inverterRatio,
  inverterRatioWarning,
  milestoneAmounts,
  panelCount,
  printsSubsidy,
  subsidyError,
  suggestCount,
} from '@/services/pricing/quotationEngine'
import { DEFAULT_SUBSIDY_AMOUNT } from '@/constants/config'
import { defaultBomRows } from '@/constants/bomDefaults'
import { defaultMilestones } from '@/constants/milestones'
import { quotationSchema } from '@/services/validation/quotationSchema'

describe('capacity from panel selections', () => {
  it('reproduces the Anil 10.2kW mixed-panel system', () => {
    // 7 x 590 + 10 x 615 = 4,130 + 6,150 = 10,280 Wp
    const panels = [
      { panelId: 'waaree-dcr-590', count: 7 },
      { panelId: 'waaree-ndcr-615', count: 10 },
    ]
    expect(capacityFromPanels(panels)).toBe(10_280)
    expect(panelCount(panels)).toBe(17)
  })

  it('reproduces the Vishwakarma 325kW single-panel system', () => {
    const panels = [{ panelId: 'renewsys-590', count: 551 }]
    expect(capacityFromPanels(panels)).toBe(325_090)
    expect(panelCount(panels)).toBe(551)
  })

  it('ignores unknown panels and non-positive counts', () => {
    expect(
      capacityFromPanels([
        { panelId: 'does-not-exist', count: 10 },
        { panelId: 'renewsys-590', count: 0 },
        { panelId: 'renewsys-590', count: -5 },
      ])
    ).toBe(0)
  })

  it('suggests a whole-panel count that reaches the target', () => {
    expect(suggestCount(10, 590)).toBe(17)
    expect(suggestCount(325, 590)).toBe(551)
    expect(suggestCount(0, 590)).toBe(0)
  })
})

describe('quotation totals', () => {
  it('reproduces the Anil 10.2kW figures at the default subsidy', () => {
    const totals = computeQuotation({
      capacityWp: 10_280,
      ratePerWatt: 373_116 / 10_280,
      subsidyAmount: DEFAULT_SUBSIDY_AMOUNT,
    })
    expect(totals.priceExclGst).toBeCloseTo(373_116, 6)
    expect(totals.priceInclGst).toBeCloseTo(406_323.324, 3)
    expect(totals.subsidy).toBe(78_000)
    expect(totals.finalPayable).toBeCloseTo(328_323.324, 3)
  })

  it('reproduces the Vishwakarma 325kW figures when the subsidy is zeroed', () => {
    const totals = computeQuotation({
      capacityWp: 325_090,
      ratePerWatt: 8_187_374.5 / 325_090,
      subsidyAmount: 0,
    })
    expect(totals.priceExclGst).toBeCloseTo(8_187_374.5, 4)
    expect(totals.priceInclGst).toBeCloseTo(8_916_050.83, 1)
    expect(totals.subsidy).toBe(0)
    expect(totals.finalPayable).toBeCloseTo(8_916_050.83, 1)
  })

  it('accepts an arbitrary configured subsidy', () => {
    const totals = computeQuotation({
      capacityWp: 10_280,
      ratePerWatt: 373_116 / 10_280,
      subsidyAmount: 45_000,
    })
    expect(totals.subsidy).toBe(45_000)
    expect(totals.finalPayable).toBeCloseTo(361_323.324, 3)
  })

  it('treats negative or non-finite subsidies as zero', () => {
    for (const subsidyAmount of [-5000, Number.NaN]) {
      const totals = computeQuotation({
        capacityWp: 10_280,
        ratePerWatt: 36.3,
        subsidyAmount,
      })
      expect(totals.subsidy).toBe(0)
    }
  })
})

describe('subsidy on the printed document', () => {
  it('prints the subsidy note and line when an amount is set', () => {
    expect(printsSubsidy(78_000)).toBe(true)
    expect(printsSubsidy(0.01)).toBe(true)
  })

  it('suppresses both at zero, so no "−₹0.00" reaches a commercial client', () => {
    expect(printsSubsidy(0)).toBe(false)
  })

  it('suppresses for negative and non-finite amounts', () => {
    expect(printsSubsidy(-1)).toBe(false)
    expect(printsSubsidy(Number.NaN)).toBe(false)
  })

  it('reproduces each sample document’s subsidy section', () => {
    // Anil 10.2kW carries the note; Vishwakarma 325kW has no subsidy section.
    expect(printsSubsidy(DEFAULT_SUBSIDY_AMOUNT)).toBe(true)
    expect(printsSubsidy(0)).toBe(false)
  })
})

describe('subsidy validation', () => {
  it('rejects a subsidy larger than the total price', () => {
    expect(subsidyError(500_000, 406_323.32)).toMatch(/cannot exceed/)
  })

  it('accepts a subsidy at or below the total, and zero', () => {
    expect(subsidyError(78_000, 406_323.32)).toBeNull()
    expect(subsidyError(0, 406_323.32)).toBeNull()
    expect(subsidyError(406_323.32, 406_323.32)).toBeNull()
  })

  it('rejects a negative subsidy', () => {
    expect(subsidyError(-1, 406_323.32)).toMatch(/Enter a subsidy/)
  })

  it('does not complain before a capacity exists', () => {
    expect(subsidyError(78_000, 0)).toBeNull()
  })
})

describe('milestone amounts', () => {
  it('splits the payable and sums back to it', () => {
    const amounts = milestoneAmounts([50, 40, 10], 328_323.324)
    expect(amounts[0]).toBeCloseTo(164_161.662, 3)
    expect(amounts.reduce((sum, value) => sum + value, 0)).toBeCloseTo(328_323.324, 6)
  })

  it('seeds 3 milestones for small systems, 5 for large', () => {
    expect(defaultMilestones(10.28)).toHaveLength(3)
    expect(defaultMilestones(325)).toHaveLength(5)
    expect(defaultMilestones(15)).toHaveLength(3)
    expect(defaultMilestones(15.1)).toHaveLength(5)
  })

  it('ships defaults that already total 100%', () => {
    for (const capacity of [10.28, 325]) {
      const total = defaultMilestones(capacity).reduce((sum, m) => sum + m.percentage, 0)
      expect(total).toBe(100)
    }
  })
})

describe('inverter sizing is advisory, not a rule', () => {
  it('accepts the Anil pairing at 97.3%', () => {
    // The v2 plan's hard 75-85% rule would have rejected this real quotation.
    const ratio = inverterRatio(10, 10_280)
    expect(ratio).toBeCloseTo(0.97276, 5)
    expect(inverterRatioWarning(ratio)).toBeNull()
  })

  it('accepts the Vishwakarma pairing at 76.9%', () => {
    const ratio = inverterRatio(250, 325_090)
    expect(ratio).toBeCloseTo(0.7690, 4)
    expect(inverterRatioWarning(ratio)).toBeNull()
  })

  it('hints when clearly under- or oversized', () => {
    expect(inverterRatioWarning(inverterRatio(10, 325_090))).toMatch(/undersized/)
    expect(inverterRatioWarning(inverterRatio(250, 10_280))).toMatch(/oversized/)
  })
})

describe('quotation schema', () => {
  const valid = {
    leadName: 'Anil Bhaiya Ji',
    projectName: 'Ajmer, Rajasthan',
    email: '',
    phone: '',
    quotationNumber: 'SGT/2026/04/B21',
    quotationDate: '2026-04-14',
    validityDays: 10,
    panels: [
      { panelId: 'waaree-dcr-590', count: 7 },
      { panelId: 'waaree-ndcr-615', count: 10 },
    ],
    inverterId: 'sungrow-10',
    subsidyAmount: DEFAULT_SUBSIDY_AMOUNT,
    milestones: defaultMilestones(10.28),
    bom: defaultBomRows(10.28),
  }

  it('accepts a faithful reconstruction of the Anil quotation', () => {
    expect(quotationSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects milestones that do not total 100%', () => {
    const result = quotationSchema.safeParse({
      ...valid,
      milestones: [
        { percentage: 50, description: 'Advance with Work Order' },
        { percentage: 40, description: 'After installation' },
      ],
    })
    expect(result.success).toBe(false)
    expect(JSON.stringify(result)).toContain('must be exactly 100%')
  })

  it('allows fractional splits that total 100%', () => {
    const result = quotationSchema.safeParse({
      ...valid,
      milestones: [
        { percentage: 33.33, description: 'Advance with Work Order' },
        { percentage: 33.33, description: 'After installation' },
        { percentage: 33.34, description: 'On commissioning' },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('rejects a duplicated panel type', () => {
    const result = quotationSchema.safeParse({
      ...valid,
      panels: [
        { panelId: 'waaree-dcr-590', count: 7 },
        { panelId: 'waaree-dcr-590', count: 10 },
      ],
    })
    expect(result.success).toBe(false)
    expect(JSON.stringify(result)).toContain('already listed')
  })

  it('rejects a bad phone but allows an empty one', () => {
    expect(quotationSchema.safeParse({ ...valid, phone: '12345' }).success).toBe(false)
    expect(quotationSchema.safeParse({ ...valid, phone: '9876543210' }).success).toBe(true)
    expect(quotationSchema.safeParse({ ...valid, phone: '' }).success).toBe(true)
  })

  it('rejects fractional panel counts', () => {
    const result = quotationSchema.safeParse({
      ...valid,
      panels: [{ panelId: 'renewsys-590', count: 7.5 }],
    })
    expect(result.success).toBe(false)
  })
})
