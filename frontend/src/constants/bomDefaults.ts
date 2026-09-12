import { SMALL_SYSTEM_LIMIT_KW } from '@/constants/milestones'

/** One run of cell text. `bold` picks out the specification figures the reference emphasises. */
export interface RichRun {
  text: string
  bold?: boolean
}

/** A cell rendered as stacked lines, each a sequence of runs. */
export type RichLines = RichRun[][]

export interface BomSpecRow {
  material: string
  details: string
  quantity: string
  warranty: string
  /**
   * Optional rich rendering of `details` / `quantity`, used by the exporters when
   * present and ignored everywhere else.
   *
   * Additive and optional so the persisted bomJson, the Zod schema and the BOM form are
   * all untouched — `details` remains the plain-text source of truth. A row edited in
   * the form must drop these, or the document would print the stale original.
   */
  detailsRich?: RichLines
  quantityRich?: RichLines
}

/** Shorthand: one line of plain text. */
const line = (text: string): RichRun[] => [{ text }]

/** Shorthand: one line ending in an emphasised specification. */
const spec = (label: string, value: string): RichRun[] => [
  { text: label },
  { text: value, bold: true },
]

/**
 * Bill of Materials specifications, seeded by capacity and fully editable.
 *
 * These vary per project in ways no formula derives — the 10kW job uses Apollo GI
 * structure with 1-in-1-out DCDB and 3 earthing pits, the 325kW job uses AL mono rail
 * with 32-in-32-out DCDB and 9 pits. Auto-deriving this section would produce wrong
 * specifications, so defaults are a starting point only. PROJECT_PLAN.md §5.2.
 *
 * The Panels and Inverter rows are generated from the system configuration.
 */

/** Rows identical across both sample documents. */
const CONSTANT_ROWS: BomSpecRow[] = [
  {
    material: 'DC cable',
    details: 'Polycab Type 1:- 4 sq mm Tin coated Cu',
    quantity: 'As required on site',
    warranty: '1 Year',
  },
  {
    material: 'MC4 connector',
    details: 'Staubli or Lenoir Equivalent',
    quantity: '',
    warranty: '',
  },
  {
    material: 'Protection',
    // One grouped row whose Details cell stacks the three protection lines, as the
    // reference prints it. The wording of each line is unchanged.
    details:
      'Lightening Arrestor: ESE Type; Chemical GI Gel Earthing 3 no.; Cu wire down-conductor — Structure & DC Earthing: (6 sqmm), Inverter & ACDB: (6 sqmm), LA: (6 sqmm), Module to Module Earthing (4 sqmm)',
    detailsRich: [
      line('Lightening Arrestor: ESE Type'),
      line('Chemical GI Gel Earthing 3 no.'),
      line('Cu wire down-conductor'),
      spec('Structure & DC Earthing: ', '(6 sqmm)'),
      spec('Inverter & ACDB: ', '(6 sqmm)'),
      spec('LA: ', '(6 sqmm)'),
      [{ text: 'Module to Module Earthing (4 sqmm)', bold: true }],
    ],
    quantity: '',
    warranty: '',
  },
  {
    material: 'Online Monitoring',
    details: 'In built (Internet to be provided by the client up to the inverters)',
    quantity: '',
    warranty: '',
  },
]

/** Verbatim from the Anil 10.2kW quotation. */
function smallSystemRows(capacityKw: number): BomSpecRow[] {
  const label = `${Math.round(capacityKw)} KW`
  return [
    {
      material: 'Module Mounting Structure',
      details:
        'Apollo GI Structure (2MM) — Leg & Rafter: 60*60*2mm, Perlin: 60*40*2mm, Bracing: 40*40*2mm, Base Plate: 8*8*6mm',
      detailsRich: [
        [{ text: 'Apollo GI Structure ' }, { text: '(2MM)', bold: true }],
        spec('Leg & Rafter: ', '60*60*2mm'),
        spec('Perlin: ', '60*40*2mm'),
        spec('Bracing: ', '40*40*2mm'),
        spec('Base Plate: ', '8*8*6mm'),
      ],
      quantity: `${label} structure`,
      warranty: '10 years from the date of commissioning.',
    },
    ...CONSTANT_ROWS.slice(0, 1),
    {
      material: 'AC Cable',
      details: 'Al. Arm wire 3.5 core:- 10 sq mm (Polycab)',
      quantity: '',
      warranty: '',
    },
    {
      material: 'DCDB',
      details: 'L&T / Polycab – 1 in 1 out (1000v spd)',
      quantity: '',
      warranty: '',
    },
    { material: 'ACDB', details: 'L&T / Polycab – 1 in 1 out', quantity: '', warranty: '' },
    ...CONSTANT_ROWS.slice(1, 2),
    {
      material: 'Wire Conduits',
      details:
        'External: PVC Cable tray; Internal: PVC PIPE (POLYCAB), Conduits supported with clamps / stands / cable tray at appropriate places',
      quantity: 'As required on site',
      // Restarts both spans: the reference prints "As required on site" and "1 Year"
      // twice, once over the cable rows and once over the conduits/protection group.
      warranty: '1 Year',
    },
    ...CONSTANT_ROWS.slice(2, 3),
    ...CONSTANT_ROWS.slice(3),
  ]
}

/** Verbatim from the Vishwakarma 325kW quotation. */
function largeSystemRows(capacityKw: number): BomSpecRow[] {
  const label = `${Math.round(capacityKw)} KW`
  return [
    {
      material: 'Module Mounting Structure',
      details: 'AL. MONO RAIL 300*125MM',
      quantity: `${label} Structure Including GI Pipe`,
      warranty: '5 years from the date of commissioning.',
    },
    ...CONSTANT_ROWS.slice(0, 1),
    {
      material: 'AC Cable',
      details: 'Al Armored wire – 3.5 core, Polycab wire - 300 sq mm',
      quantity: '',
      warranty: '',
    },
    {
      material: 'DCDB',
      details: 'L&T / Polycab – 32 in 32 out with 1000v spd each',
      quantity: '',
      warranty: '',
    },
    {
      material: 'ACDB',
      details: 'L&T / Polycab – 2 in 1 out with 630 Amps breaker',
      quantity: '',
      warranty: '',
    },
    ...CONSTANT_ROWS.slice(1, 2),
    {
      material: 'Wire Conduits',
      details:
        'External: GI Cable tray; Internal: GI Cable tray and Upvc Conduits supported with clamps / stands / cable tray at appropriate places',
      quantity: 'As required on site',
      warranty: '',
    },
    {
      material: 'Protection',
      details:
        'Lightening Arrestor: ESE Type; Copper Gel Earthing (51mm Dia) 9 no.; Cu wire down-conductor — 06 sqmm for structure, 04 sqmm Module to Module Earthing, 25 sqmm for Inverter and ACDB, 35 sqmm for L.A',
      detailsRich: [
        line('Lightening Arrestor: ESE Type'),
        line('Copper Gel Earthing (51mm Dia) 9 no.'),
        line('Cu wire down-conductor'),
        spec('', '06 sqmm for structure'),
        spec('', '04 sqmm Module to Module Earthing'),
        spec('', '25 sqmm for Inverter and ACDB'),
        spec('', '35 sqmm for L.A'),
      ],
      quantity: '',
      warranty: '',
    },
    ...CONSTANT_ROWS.slice(3),
    {
      material: 'DG Synchronise',
      details: 'Solar Power Plant is connected with DG',
      quantity: 'As required on site',
      warranty: '5 year',
    },
  ]
}

export function defaultBomRows(capacityKw: number): BomSpecRow[] {
  return capacityKw <= SMALL_SYSTEM_LIMIT_KW
    ? smallSystemRows(capacityKw)
    : largeSystemRows(capacityKw)
}
