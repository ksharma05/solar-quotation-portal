export interface MilestoneDefault {
  percentage: number
  description: string
}

/** Verbatim from the Anil 10.2kW quotation. */
export const SMALL_SYSTEM_MILESTONES: readonly MilestoneDefault[] = [
  { percentage: 50, description: 'Advance with Work Order' },
  { percentage: 40, description: 'After Installation of Structure and panel' },
  { percentage: 10, description: 'On successful final commissioning of Project' },
] as const

/** Verbatim from the Vishwakarma 325kW quotation. */
export const LARGE_SYSTEM_MILESTONES: readonly MilestoneDefault[] = [
  { percentage: 20, description: 'Advance with Work Order' },
  { percentage: 40, description: 'After Delivery and Installation of Structure and earthing' },
  { percentage: 20, description: 'After Delivery of modules and Electrical wiring Material' },
  { percentage: 15, description: 'After Delivery of all material' },
  { percentage: 5, description: 'After successfully commissioning of Project' },
] as const

/** Capacity in kW at or below which the 3-milestone schedule is used. */
export const SMALL_SYSTEM_LIMIT_KW = 15

export function defaultMilestones(capacityKw: number): MilestoneDefault[] {
  const source =
    capacityKw <= SMALL_SYSTEM_LIMIT_KW ? SMALL_SYSTEM_MILESTONES : LARGE_SYSTEM_MILESTONES
  return source.map((milestone) => ({ ...milestone }))
}
