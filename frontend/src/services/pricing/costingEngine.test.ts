import { describe, expect, it } from 'vitest'
import {
  computeTotals,
  createLines,
  priceFromRate,
  rateFromPrice,
  recalcAll,
  setLinePrice,
  setLineRate,
} from '@/services/pricing/costingEngine'
import { COSTING_LINES, REFERENCE_CAPACITY_W } from '@/constants/costingLines'

/**
 * Reference job: 125 KW with 100 KW inverter, Waaree Mittal Hospital.
 * Source: Book1 (1).xlsx. These figures are the contract — if they drift, the
 * engine no longer reproduces the sheet the business actually uses.
 */
describe('costing engine — 125kW reference job', () => {
  const lines = createLines(REFERENCE_CAPACITY_W)
  const totals = computeTotals(lines)

  it('seeds all 15 lines', () => {
    expect(lines).toHaveLength(15)
  })

  it('derives ₹28.710457/W (Book1 D19)', () => {
    expect(totals.totalRatePerWatt).toBeCloseTo(28.71045730732331, 10)
  })

  it('totals ₹35,91,104 excluding GST (Book1 E19)', () => {
    expect(totals.totalCostExclGst).toBeCloseTo(3_591_104, 6)
  })

  it('computes the payable as excl-GST × 1.089 (Book1 G20)', () => {
    expect(totals.payable).toBeCloseTo(3_910_712.256, 3)
  })

  it('reports per-line GST of ₹3,47,554 as internal reference (Book1 G19)', () => {
    expect(totals.totalWithLineGst).toBeCloseTo(3_938_658.2, 1)
    expect(totals.totalLineGst).toBeCloseTo(347_554.2, 1)
  })

  it('keeps the per-line GST total distinct from the payable', () => {
    // 9.68% vs 8.9% — conflating these was the v2 plan's error.
    expect(totals.totalWithLineGst).not.toBeCloseTo(totals.payable, 0)
  })

  it.each([
    ['solar-panel', 16.3, 2_038_804],
    ['inverter', 2.0786696514230893, 260_000],
    ['structure', 2.0051167252958106, 250_800],
    ['acdb-dcdb', 0.6918771985929005, 86_540],
    ['ac-wire', 0.27982091461464664, 35_000],
    ['dc-wire', 0.4661016949152542, 58_300],
    ['earthing-la-labour', 0.17588743204349216, 22_000],
    ['earthing-wire', 0.582027502398465, 72_800],
    ['transportation', 0.11992324912056283, 15_000],
    ['welding-labour', 2, 250_160],
    ['ctpt-coil', 0.07834985609210106, 9_800],
    ['mib-box', 0.027982091461464662, 3_500],
    ['solar-meter', 0.13991045730732332, 17_500],
    ['miscellaneous', 0.8074832107451231, 101_000],
    ['solar-green-share', 2.9573073233130796, 369_900],
  ])('line %s derives ₹%f/W from ₹%d', (id, expectedRate, expectedPrice) => {
    const line = lines.find((candidate) => candidate.id === id)
    expect(line).toBeDefined()
    expect(line!.rate).toBeCloseTo(expectedRate, 10)
    expect(line!.price).toBeCloseTo(expectedPrice, 6)
  })

  it('splits GST 5% on panel and inverter, 18% on the rest', () => {
    const fivePercent = COSTING_LINES.filter((def) => def.gstRate === 5).map((def) => def.id)
    expect(fivePercent).toEqual(['solar-panel', 'inverter'])
    expect(totals.gstByClass[5]).toBeCloseTo((2_038_804 + 260_000) * 0.05, 6)
  })

  it('marks Solar Green Share as the margin line', () => {
    const margin = COSTING_LINES.filter((def) => def.margin)
    expect(margin).toHaveLength(1)
    expect(margin[0].id).toBe('solar-green-share')
  })
})

describe('bidirectional entry', () => {
  const capacity = 125_080

  it('derives the rate when a price is typed', () => {
    const line = setLinePrice(
      { id: 'inverter', price: 0, rate: 0, entryMode: 'cost' },
      260_000,
      capacity
    )
    expect(line.rate).toBeCloseTo(2.0786696514230893, 10)
    expect(line.entryMode).toBe('cost')
  })

  it('derives the price when a rate is typed', () => {
    const line = setLineRate(
      { id: 'solar-panel', price: 0, rate: 0, entryMode: 'rate' },
      16.3,
      capacity
    )
    expect(line.price).toBeCloseTo(2_038_804, 6)
    expect(line.entryMode).toBe('rate')
  })

  it('round-trips price → rate → price', () => {
    const rate = rateFromPrice(86_540, capacity)
    expect(priceFromRate(rate, capacity)).toBeCloseTo(86_540, 6)
  })

  it('returns zero rather than Infinity at zero capacity', () => {
    expect(rateFromPrice(100_000, 0)).toBe(0)
    expect(priceFromRate(16.3, 0)).toBe(0)
    expect(rateFromPrice(100_000, Number.NaN)).toBe(0)
  })
})

describe('capacity changes', () => {
  it('scales a rate-driven line and holds its ₹/W', () => {
    const [line] = recalcAll(
      [{ id: 'solar-panel', price: 2_038_804, rate: 16.3, entryMode: 'rate' }],
      250_160
    )
    expect(line.rate).toBe(16.3)
    expect(line.price).toBeCloseTo(4_077_608, 6)
  })

  it('holds a cost-driven line’s rupees and moves its ₹/W', () => {
    const [line] = recalcAll(
      [{ id: 'transportation', price: 15_000, rate: 0.11992324912056283, entryMode: 'cost' }],
      250_160
    )
    expect(line.price).toBe(15_000)
    expect(line.rate).toBeCloseTo(0.05996162456028142, 10)
  })

  it('halves the total rate when capacity doubles with all costs fixed', () => {
    const lines = createLines(REFERENCE_CAPACITY_W).map((line) => ({
      ...line,
      entryMode: 'cost' as const,
    }))
    const doubled = computeTotals(recalcAll(lines, REFERENCE_CAPACITY_W * 2))
    expect(doubled.totalRatePerWatt).toBeCloseTo(28.71045730732331 / 2, 10)
    expect(doubled.totalCostExclGst).toBeCloseTo(3_591_104, 6)
  })
})

/**
 * The two historical quotations. The costing sheet produces the rate; these assert
 * the rate carries through to the figures printed on the customer documents.
 *
 * Both documents print the rate rounded to 2dp while the underlying value carries
 * more precision — 10,280 × 36.30 is 3,73,164, but the document says 3,73,116, so
 * the true rate is 36.2953. Store full precision; round only for display.
 */
describe('historical quotations', () => {
  it('Anil 10.2kW — 10,280 Wp, prints ₹36.30/W', () => {
    const exclGst = 373_116
    const rate = exclGst / 10_280
    expect(rate).toBeCloseTo(36.29533073929961, 10)
    expect(Number(rate.toFixed(2))).toBe(36.3)
    expect(exclGst * 1.089).toBeCloseTo(406_323.324, 3)
  })

  it('Vishwakarma 325kW — 3,25,090 Wp, prints ₹25.18/W', () => {
    const exclGst = 8_187_374.5
    const rate = exclGst / 325_090
    expect(rate).toBeCloseTo(25.184947245378204, 10)
    expect(Number(rate.toFixed(2))).toBe(25.18)
    expect(exclGst * 1.089).toBeCloseTo(8_916_050.83, 1)
  })

  it('the printed 2dp rate would not reproduce either total', () => {
    // Guards against anyone "simplifying" by storing the rounded rate.
    expect(10_280 * 36.3).not.toBeCloseTo(373_116, 0)
    expect(325_090 * 25.18).not.toBeCloseTo(8_187_374.5, 0)
  })
})
