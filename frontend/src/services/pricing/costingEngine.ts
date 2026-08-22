import { COSTING_LINES, REFERENCE_CAPACITY_W } from '@/constants/costingLines'
import { GST_MULTIPLIER } from '@/constants/config'
import type { CostingLine, CostingTotals, EntryMode, GstRate } from '@/types'

/**
 * Stage 1 of the two-stage model: the internal costing sheet.
 *
 * The estimator enters actual rupee costs; ₹/W is derived. The sum of the derived
 * rates is the only value that crosses into the customer quotation.
 *
 * See PROJECT_PLAN.md §3.
 */

/** price / capacity, guarding division by zero on an empty sheet. */
export function rateFromPrice(price: number, capacityW: number): number {
  if (!Number.isFinite(capacityW) || capacityW <= 0) return 0
  return price / capacityW
}

/** capacity × rate. */
export function priceFromRate(rate: number, capacityW: number): number {
  if (!Number.isFinite(capacityW) || capacityW <= 0) return 0
  return rate * capacityW
}

/** Sets the price and derives the rate, marking the line cost-driven. */
export function setLinePrice(line: CostingLine, price: number, capacityW: number): CostingLine {
  return { ...line, price, rate: rateFromPrice(price, capacityW), entryMode: 'cost' }
}

/** Sets the rate and derives the price, marking the line rate-driven. */
export function setLineRate(line: CostingLine, rate: number, capacityW: number): CostingLine {
  return { ...line, rate, price: priceFromRate(rate, capacityW), entryMode: 'rate' }
}

/**
 * Re-resolves a line against a new capacity. Each entry mode holds a different
 * value fixed: a rate-driven line's cost scales with capacity, while a cost-driven
 * line's rupee cost stays put and its ₹/W moves.
 */
export function recalcLine(line: CostingLine, capacityW: number): CostingLine {
  return line.entryMode === 'rate'
    ? { ...line, price: priceFromRate(line.rate, capacityW) }
    : { ...line, rate: rateFromPrice(line.price, capacityW) }
}

export function recalcAll(lines: CostingLine[], capacityW: number): CostingLine[] {
  return lines.map((line) => recalcLine(line, capacityW))
}

/** A fresh sheet seeded from the reference job's rupee costs. */
export function createLines(capacityW: number): CostingLine[] {
  return COSTING_LINES.map((def) => {
    const base: CostingLine = {
      id: def.id,
      price: def.referencePrice,
      rate: 0,
      entryMode: def.defaultEntryMode,
    }
    if (def.defaultEntryMode === 'rate') {
      // Recover the reference rate at the reference capacity, then scale.
      const rate = rateFromPrice(def.referencePrice, REFERENCE_CAPACITY_W)
      return { ...base, rate, price: priceFromRate(rate, capacityW) }
    }
    return { ...base, rate: rateFromPrice(def.referencePrice, capacityW) }
  })
}

const gstRateById = new Map<string, GstRate>(COSTING_LINES.map((def) => [def.id, def.gstRate]))

export function computeTotals(lines: CostingLine[]): CostingTotals {
  const gstByClass: Record<GstRate, number> = { 5: 0, 18: 0 }
  let totalRatePerWatt = 0
  let totalCostExclGst = 0

  for (const line of lines) {
    totalRatePerWatt += line.rate
    totalCostExclGst += line.price

    const gstRate = gstRateById.get(line.id)
    if (gstRate !== undefined) {
      gstByClass[gstRate] += line.price * (gstRate / 100)
    }
  }

  const totalLineGst = gstByClass[5] + gstByClass[18]

  return {
    totalRatePerWatt,
    totalCostExclGst,
    gstByClass,
    totalLineGst,
    totalWithLineGst: totalCostExclGst + totalLineGst,
    // The payable uses the blended 8.9% factor, NOT the per-line GST above.
    // Book1 G20 is `=E19*1.089`. See PROJECT_PLAN.md §3.4.
    payable: totalCostExclGst * GST_MULTIPLIER,
  }
}

/** Entry mode of a line as currently held. */
export function entryModeOf(lines: CostingLine[], id: string): EntryMode | undefined {
  return lines.find((line) => line.id === id)?.entryMode
}
