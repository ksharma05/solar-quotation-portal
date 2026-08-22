export interface PanelSpec {
  id: string
  name: string
  /** Watt-peak per panel. */
  wattage: number
  warranty: string
}

export interface InverterSpec {
  id: string
  name: string
  /** Rated capacity in kW. */
  capacityKw: number
  phase: string
  warranty: string
}

/** Panels quoted on the sample documents. */
export const PANELS: readonly PanelSpec[] = [
  {
    id: 'renewsys-590',
    name: 'RENEWSYS Bi-Facial Monocrystalline',
    wattage: 590,
    warranty: '12 years product warranty and 25 years linear power warranty',
  },
  {
    id: 'waaree-dcr-590',
    name: 'WAAREE DCR',
    wattage: 590,
    warranty: '12 years product warranty and 25 years linear power warranty',
  },
  {
    id: 'waaree-ndcr-615',
    name: 'WAAREE NDCR',
    wattage: 615,
    warranty: '12 years product warranty and 25 years linear power warranty',
  },
] as const

export const INVERTERS: readonly InverterSpec[] = [
  {
    id: 'sungrow-250',
    name: 'Sungrow',
    capacityKw: 250,
    phase: '3 Phase',
    warranty: '10/7 years warranty by the manufacturer',
  },
  {
    id: 'sungrow-10',
    name: 'Sungrow (String type Inverter)',
    capacityKw: 10,
    phase: '3 Phase',
    warranty: '5/10 years warranty by the manufacturer',
  },
  {
    id: 'waaree-string-10',
    name: 'Waaree (String type Inverter)',
    capacityKw: 10,
    phase: '3 Phase',
    warranty: '5/10 years warranty by the manufacturer',
  },
] as const

export const panelById = (id: string): PanelSpec | undefined =>
  PANELS.find((panel) => panel.id === id)

export const inverterById = (id: string): InverterSpec | undefined =>
  INVERTERS.find((inverter) => inverter.id === id)
