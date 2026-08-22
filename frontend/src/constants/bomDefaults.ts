import { SMALL_SYSTEM_LIMIT_KW } from '@/constants/milestones'

export interface BomSpecRow {
  material: string
  details: string
  quantity: string
  warranty: string
}

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
    details: 'Lightening Arrestor: ESE Type',
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
      warranty: '',
    },
    ...CONSTANT_ROWS.slice(2, 3),
    {
      material: 'Earthing',
      details: 'Chemical GI Gel Earthing 3 no.',
      quantity: '',
      warranty: '',
    },
    {
      material: 'Earthing wire',
      details:
        'Cu wire down-conductor — Structure & DC Earthing: (6 sqmm), Inverter & ACDB: (6 sqmm), LA: (6 sqmm), Module to Module Earthing (4 sqmm)',
      quantity: '',
      warranty: '',
    },
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
    ...CONSTANT_ROWS.slice(2, 3),
    {
      material: 'Earthing',
      details: 'Copper Gel Earthing (51mm Dia) 9 no.',
      quantity: '',
      warranty: '',
    },
    {
      material: 'Earthing wire',
      details:
        'Cu wire down-conductor — 06 sqmm for structure, 04 sqmm Module to Module Earthing, 25 sqmm for Inverter and ACDB, 35 sqmm for L.A',
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
