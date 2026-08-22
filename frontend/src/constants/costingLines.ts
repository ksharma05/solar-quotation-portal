import type { CostingLineDef } from '@/types'

/**
 * The 15 costing lines, with reference values from the 125kW Waaree Mittal Hospital
 * job (Book1 (1).xlsx, capacity 125,080 W). Those values seed a new sheet; the
 * estimator then adjusts them per project.
 *
 * Solar Panel and Welding & Labour are rate-driven in the source sheet
 * (`E = C * D`); every other line is cost-driven (`D = E / C`).
 *
 * See PROJECT_PLAN.md §3.
 */
export const COSTING_LINES: readonly CostingLineDef[] = [
  {
    id: 'solar-panel',
    sno: 1,
    description: 'Solar Panel',
    gstRate: 5,
    defaultEntryMode: 'rate',
    referencePrice: 2_038_804,
  },
  {
    id: 'inverter',
    sno: 2,
    description: 'Inverter',
    gstRate: 5,
    defaultEntryMode: 'cost',
    referencePrice: 260_000,
  },
  {
    id: 'structure',
    sno: 3,
    description: 'Structure',
    gstRate: 18,
    defaultEntryMode: 'cost',
    referencePrice: 250_800,
  },
  {
    id: 'acdb-dcdb',
    sno: 4,
    description: 'ACDB / DCDB',
    gstRate: 18,
    defaultEntryMode: 'cost',
    referencePrice: 86_540,
  },
  {
    id: 'ac-wire',
    sno: 5,
    description: 'AC wire',
    gstRate: 18,
    defaultEntryMode: 'cost',
    referencePrice: 35_000,
  },
  {
    id: 'dc-wire',
    sno: 6,
    description: 'DC Wire',
    gstRate: 18,
    defaultEntryMode: 'cost',
    referencePrice: 58_300,
  },
  {
    id: 'earthing-la-labour',
    sno: 7,
    description: 'Earthing + LA + Earthing labour',
    gstRate: 18,
    defaultEntryMode: 'cost',
    referencePrice: 22_000,
  },
  {
    id: 'earthing-wire',
    sno: 8,
    description: 'Earthing wire',
    gstRate: 18,
    defaultEntryMode: 'cost',
    referencePrice: 72_800,
  },
  {
    id: 'transportation',
    sno: 9,
    description: 'Transportation',
    gstRate: 18,
    defaultEntryMode: 'cost',
    referencePrice: 15_000,
  },
  {
    id: 'welding-labour',
    sno: 10,
    description: 'Welding & Labour',
    gstRate: 18,
    defaultEntryMode: 'rate',
    referencePrice: 250_160,
  },
  {
    id: 'ctpt-coil',
    sno: 11,
    description: 'CTPT Coil',
    gstRate: 18,
    defaultEntryMode: 'cost',
    referencePrice: 9_800,
  },
  {
    id: 'mib-box',
    sno: 12,
    description: 'MIB Box',
    gstRate: 18,
    defaultEntryMode: 'cost',
    referencePrice: 3_500,
  },
  {
    id: 'solar-meter',
    sno: 13,
    description: 'Solar meter / Net Meter',
    gstRate: 18,
    defaultEntryMode: 'cost',
    referencePrice: 17_500,
  },
  {
    id: 'miscellaneous',
    sno: 14,
    description:
      'Miscellaneous (structure items, nut bolts, walkway, water pipeline, GI cable tray, civil material)',
    gstRate: 18,
    defaultEntryMode: 'cost',
    referencePrice: 101_000,
  },
  {
    id: 'solar-green-share',
    sno: 15,
    description: 'Solar Green Share',
    gstRate: 18,
    defaultEntryMode: 'cost',
    referencePrice: 369_900,
    margin: true,
  },
] as const

/** Capacity of the reference job, in watts. */
export const REFERENCE_CAPACITY_W = 125_080
