import { z } from 'zod'
import { PANELS, INVERTERS } from '@/constants/catalogue'

const panelIds = PANELS.map((panel) => panel.id) as [string, ...string[]]
const inverterIds = INVERTERS.map((inverter) => inverter.id) as [string, ...string[]]

export const MIN_CAPACITY_KW = 1
export const MAX_CAPACITY_KW = 500

export const panelSelectionSchema = z.object({
  panelId: z.enum(panelIds),
  count: z
    .number({ invalid_type_error: 'Enter a panel count' })
    .int('Whole panels only')
    .min(1, 'At least 1 panel'),
})

export const milestoneSchema = z.object({
  percentage: z
    .number({ invalid_type_error: 'Enter a percentage' })
    .min(0.01, 'Must be above 0')
    .max(100, 'Cannot exceed 100'),
  description: z.string().trim().min(3, 'Describe this milestone'),
})

const richLinesSchema = z.array(z.array(z.object({ text: z.string(), bold: z.boolean().optional() })))

export const bomRowSchema = z.object({
  material: z.string().trim().min(1, 'Material is required'),
  details: z.string(),
  quantity: z.string(),
  warranty: z.string(),
  /**
   * Generated rich rendering of `details` / `quantity`, carried through untouched.
   * Editing the plain field in the form clears these — see BomSpecsForm — or the
   * document would print the stale original.
   */
  detailsRich: richLinesSchema.optional(),
  quantityRich: richLinesSchema.optional(),
})

export const quotationSchema = z
  .object({
    leadName: z.string().trim().min(3, 'Client name is required'),
    projectName: z.string().trim().min(3, 'Project or location is required'),
    email: z.union([z.string().trim().email('Enter a valid email'), z.literal('')]).optional(),
    phone: z
      .union([
        z
          .string()
          .trim()
          .regex(/^[6-9]\d{9}$/, 'Enter a 10-digit Indian mobile number'),
        z.literal(''),
      ])
      .optional(),

    quotationNumber: z.string().trim().min(3, 'Quotation number is required'),
    quotationDate: z.string().min(1, 'Date is required'),
    validityDays: z.number().int().min(1).max(90),

    panels: z.array(panelSelectionSchema).min(1, 'Add at least one panel type'),
    inverterId: z.enum(inverterIds),

    subsidyAmount: z
      .number({ invalid_type_error: 'Enter a subsidy amount' })
      .min(0, 'Cannot be negative'),

    milestones: z.array(milestoneSchema).min(2, 'At least two milestones'),

    bom: z.array(bomRowSchema).min(1, 'The bill of materials cannot be empty'),

    /**
     * Reference projects to print. Empty is valid and common — the document then omits
     * the "Some of our projects" section entirely.
     */
    referenceProjectIds: z.array(z.string()).default([]),
  })
  .superRefine((value, ctx) => {
    // Milestones must total exactly 100%. Tolerance absorbs float drift from
    // fractional entries such as 33.33 / 33.33 / 33.34.
    const total = value.milestones.reduce((sum, milestone) => sum + milestone.percentage, 0)
    if (Math.abs(total - 100) > 0.001) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['milestones'],
        message: `Milestones total ${total.toFixed(2)}% — must be exactly 100%`,
      })
    }

    // A panel type appearing twice would silently double a line on the BOM.
    const seen = new Set<string>()
    value.panels.forEach((panel, index) => {
      if (seen.has(panel.panelId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['panels', index, 'panelId'],
          message: 'This panel type is already listed — change it or merge the counts',
        })
      }
      seen.add(panel.panelId)
    })
  })

export type QuotationFormValues = z.infer<typeof quotationSchema>

/** Capacity is derived, so it is range-checked separately from the schema. */
export function capacityError(capacityWp: number): string | null {
  const kw = capacityWp / 1000
  if (capacityWp <= 0) return 'Add panels to establish the system capacity'
  if (kw < MIN_CAPACITY_KW) return `Minimum system size is ${MIN_CAPACITY_KW} kW`
  if (kw > MAX_CAPACITY_KW) return `Maximum system size is ${MAX_CAPACITY_KW} kW`
  return null
}
