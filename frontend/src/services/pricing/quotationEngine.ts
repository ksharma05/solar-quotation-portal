import { GST_MULTIPLIER } from '@/constants/config'
import { panelById } from '@/constants/catalogue'

/**
 * Stage 2 of the two-stage model: the customer quotation.
 * See PROJECT_PLAN.md §4.
 */

export interface PanelSelection {
  panelId: string
  count: number
}

export interface QuotationTotals {
  capacityWp: number
  panelCount: number
  priceExclGst: number
  priceInclGst: number
  subsidy: number
  finalPayable: number
}

/**
 * Capacity is derived from the panel selections, not the other way round: the Anil
 * 10.2kW job mixes 7 x 590Wp with 10 x 615Wp to reach 10,280 Wp, which no single
 * ceil(kW / wattage) can express. PROJECT_PLAN.md §4.3.
 */
export function capacityFromPanels(selections: PanelSelection[]): number {
  return selections.reduce((total, selection) => {
    const panel = panelById(selection.panelId)
    if (!panel || !Number.isFinite(selection.count) || selection.count <= 0) return total
    return total + panel.wattage * Math.floor(selection.count)
  }, 0)
}

export function panelCount(selections: PanelSelection[]): number {
  return selections.reduce(
    (total, selection) =>
      Number.isFinite(selection.count) && selection.count > 0
        ? total + Math.floor(selection.count)
        : total,
    0
  )
}

/** Suggests a whole-panel count reaching at least the target kW for a single type. */
export function suggestCount(targetKw: number, panelWattage: number): number {
  if (!Number.isFinite(targetKw) || targetKw <= 0 || panelWattage <= 0) return 0
  return Math.ceil((targetKw * 1000) / panelWattage)
}

export function computeQuotation({
  capacityWp,
  ratePerWatt,
  subsidyAmount,
}: {
  capacityWp: number
  ratePerWatt: number
  /** Rupees deducted after GST. Editable per quote; 0 for jobs that do not qualify. */
  subsidyAmount: number
}): Omit<QuotationTotals, 'panelCount'> {
  const priceExclGst = capacityWp * ratePerWatt
  const priceInclGst = priceExclGst * GST_MULTIPLIER
  const subsidy = Number.isFinite(subsidyAmount) && subsidyAmount > 0 ? subsidyAmount : 0

  return {
    capacityWp,
    priceExclGst,
    priceInclGst,
    subsidy,
    finalPayable: priceInclGst - subsidy,
  }
}

/**
 * Whether the subsidy note and the "after subsidy" line appear on the printed
 * quotation. The form always shows the field so the amount stays visible and
 * editable; the customer document suppresses it at zero, so a commercial client
 * never sees a "−₹0.00" line. PROJECT_PLAN.md §4.2.
 */
export function printsSubsidy(subsidyAmount: number): boolean {
  return Number.isFinite(subsidyAmount) && subsidyAmount > 0
}

/** A subsidy larger than the price would print a negative payable. */
export function subsidyError(subsidyAmount: number, priceInclGst: number): string | null {
  if (!Number.isFinite(subsidyAmount) || subsidyAmount < 0) return 'Enter a subsidy amount'
  if (priceInclGst > 0 && subsidyAmount > priceInclGst) {
    return 'Subsidy cannot exceed the total price'
  }
  return null
}

/** Rupee value of each milestone, against the figure the customer actually pays. */
export function milestoneAmounts(percentages: number[], finalPayable: number): number[] {
  return percentages.map((percentage) => (finalPayable * percentage) / 100)
}

/**
 * Inverter sizing relative to panel capacity, as an advisory ratio.
 *
 * Deliberately NOT a validation rule. The v2 plan specified a hard 75-85% range,
 * which would have rejected the Anil 10.2kW quotation outright — it pairs a 10kW
 * inverter with 10,280 Wp of panels, a ratio of 97.3%. The 325kW job sits at 76.9%.
 */
export function inverterRatio(inverterKw: number, capacityWp: number): number | null {
  if (capacityWp <= 0 || !Number.isFinite(inverterKw)) return null
  return (inverterKw * 1000) / capacityWp
}

/** Loose sanity band; outside it we hint, never block. */
export function inverterRatioWarning(ratio: number | null): string | null {
  if (ratio === null) return null
  if (ratio < 0.7) return 'Inverter looks undersized for this panel capacity.'
  if (ratio > 1.1) return 'Inverter looks oversized for this panel capacity.'
  return null
}
