/** Company details as printed on the quotation letterhead. Source: sample DOCX files. */
export const COMPANY = {
  name: 'Solar Green Technology',
  address: 'Ajmer, Rajasthan',
  phone: '+91-7610000632',
  email: 'technosolargreen@gmail.com',
  gstin: '08BLWPA1147G1Z3',
  signatory: 'Vardhman Aameria',
} as const

/**
 * Blended GST factor. 70% of value is treated as supply @ 5%, 30% as installation
 * @ 18%: (0.70 x 1.05) + (0.30 x 1.18) = 1.089. Verified against both sample
 * quotations. See PROJECT_PLAN.md §4.1.
 */
export const GST_MULTIPLIER = 1.089

/**
 * Default subsidy, pre-filled on every quotation and editable per quote.
 * Set to 0 on jobs that do not qualify. PROJECT_PLAN.md §4.2.
 */
export const DEFAULT_SUBSIDY_AMOUNT = 78_000

/** Default quotation validity, in days from the issue date. */
export const QUOTE_VALIDITY_DAYS = 10
