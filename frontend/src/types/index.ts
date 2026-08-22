/** GST class applied to a costing line. Internal reference only — see CostingTotals. */
export type GstRate = 5 | 18

/**
 * Which field the estimator types, and which is derived.
 *  - 'rate': user enters ₹/W, price = capacity × rate  (scales with capacity)
 *  - 'cost': user enters ₹ total, rate = price / capacity  (fixed rupee cost)
 *
 * Mirrors Book1.xlsx, where D4/D13 are typed and the rest are `=E/C`.
 */
export type EntryMode = 'rate' | 'cost'

/** Static definition of one of the 15 costing lines. */
export interface CostingLineDef {
  id: string
  sno: number
  description: string
  gstRate: GstRate
  /** Default entry mode; the estimator may type into either field. */
  defaultEntryMode: EntryMode
  /** Reference value from the 125kW job, used to seed a new sheet. */
  referencePrice: number
  /** True for the margin line, which must never reach a customer document. */
  margin?: boolean
}

/** Live state of one costing line. `price` and `rate` are always kept consistent. */
export interface CostingLine {
  id: string
  /** Rupees, excluding GST. */
  price: number
  /** Rupees per watt. */
  rate: number
  entryMode: EntryMode
}

export interface CostingTotals {
  /** Σ of all line rates. The only value that crosses into the customer quotation. */
  totalRatePerWatt: number
  /** Σ of all line prices, excluding GST. */
  totalCostExclGst: number
  /** Per-line GST, split by class. Internal reference — does not drive the payable. */
  gstByClass: Record<GstRate, number>
  totalLineGst: number
  /** Σ of price × (1 + gst). Internal reference figure (Book1 G19). */
  totalWithLineGst: number
  /** The customer-facing figure: totalCostExclGst × 1.089 (Book1 G20). */
  payable: number
}
