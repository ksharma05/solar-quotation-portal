import { describe, expect, it } from 'vitest'
import { systemBomRows } from '@/services/quotation/documentBom'
import { defaultBomRows } from '@/constants/bomDefaults'
import { formatDocumentDate, suggestQuotationNumber, validTillIso } from '@/utils/dates'
import { formatINR, formatRate } from '@/utils/formatters'
import { capacityFromPanels, computeQuotation } from '@/services/pricing/quotationEngine'

describe('document dates', () => {
  it('formats as dd-mm-yyyy like the samples', () => {
    expect(formatDocumentDate('2026-04-14')).toBe('14-04-2026')
    expect(formatDocumentDate('2026-02-02')).toBe('02-02-2026')
  })

  it('reproduces the Anil validity window: 14-04 + 10 days = 24-04', () => {
    const till = validTillIso('2026-04-14', 10)
    expect(till).toBe('2026-04-24')
    expect(formatDocumentDate(till!)).toBe('24-04-2026')
  })

  it('rolls across month and year boundaries', () => {
    expect(validTillIso('2026-12-28', 10)).toBe('2027-01-07')
    expect(validTillIso('2026-02-25', 10)).toBe('2026-03-07')
  })

  it('returns the input unchanged when it is not a date', () => {
    expect(formatDocumentDate('')).toBe('')
    expect(validTillIso('not-a-date', 10)).toBeNull()
  })
})

describe('quotation number', () => {
  it('matches the SGT/YYYY/MM/Bnn format of both samples', () => {
    expect(suggestQuotationNumber('2026-04-14', 21)).toBe('SGT/2026/04/B21')
    expect(suggestQuotationNumber('2026-02-02', 9)).toBe('SGT/2026/02/B09')
  })
})

describe('system BOM rows', () => {
  it('describes the Anil mixed-panel system as the document does', () => {
    const rows = systemBomRows(
      [
        { panelId: 'waaree-dcr-590', count: 7 },
        { panelId: 'waaree-ndcr-615', count: 10 },
      ],
      'sungrow-10'
    )

    const panels = rows.find((row) => row.material === 'Panels')
    expect(panels?.details).toContain('WAAREE DCR:- 590Wp (7 no.)')
    expect(panels?.details).toContain('WAAREE NDCR:- 615Wp (10 no.)')
    expect(panels?.quantity).toBe('Monocrystalline – 10280 Watt – 590 & 615 watt/Panel = 17 Panels')
    expect(panels?.warranty).toContain('12 years product warranty')

    const inverter = rows.find((row) => row.material === 'Inverter')
    expect(inverter?.quantity).toBe('10 KW - 3 Phase')
  })

  it('describes the Vishwakarma single-panel system', () => {
    const rows = systemBomRows([{ panelId: 'renewsys-590', count: 551 }], 'sungrow-250')
    const panels = rows.find((row) => row.material === 'Panels')
    expect(panels?.quantity).toBe('Monocrystalline – 325090 Watt – 590 watt/Panel = 551 Panels')
    expect(rows.find((row) => row.material === 'Inverter')?.quantity).toBe('250 KW - 3 Phase')
  })

  it('omits rows it cannot derive', () => {
    expect(systemBomRows([], '')).toHaveLength(0)
    expect(systemBomRows([{ panelId: 'renewsys-590', count: 0 }], 'bogus')).toHaveLength(0)
  })
})

describe('BOM specification defaults', () => {
  it('seeds the small-system specifications for a 10kW job', () => {
    const rows = defaultBomRows(10.28)
    const find = (material: string) => rows.find((row) => row.material === material)

    expect(find('Module Mounting Structure')?.details).toContain('Apollo GI Structure')
    expect(find('Module Mounting Structure')?.warranty).toContain('10 years')
    expect(find('DCDB')?.details).toContain('1 in 1 out')
    expect(find('AC Cable')?.details).toContain('10 sq mm')
    expect(find('Earthing')?.details).toContain('Chemical GI Gel Earthing 3 no.')
    expect(find('DG Synchronise')).toBeUndefined()
  })

  it('seeds the large-system specifications for a 325kW job', () => {
    const rows = defaultBomRows(325)
    const find = (material: string) => rows.find((row) => row.material === material)

    expect(find('Module Mounting Structure')?.details).toContain('AL. MONO RAIL')
    expect(find('Module Mounting Structure')?.warranty).toContain('5 years')
    expect(find('DCDB')?.details).toContain('32 in 32 out')
    expect(find('ACDB')?.details).toContain('630 Amps')
    expect(find('AC Cable')?.details).toContain('300 sq mm')
    expect(find('Earthing')?.details).toContain('Copper Gel Earthing (51mm Dia) 9 no.')
    expect(find('DG Synchronise')?.warranty).toBe('5 year')
  })

  it('carries no prices anywhere in the specification table', () => {
    for (const capacity of [10.28, 325]) {
      for (const row of defaultBomRows(capacity)) {
        const text = `${row.material} ${row.details} ${row.quantity} ${row.warranty}`
        expect(text).not.toMatch(/₹/)
      }
    }
  })

  it('labels the structure with the system capacity', () => {
    expect(defaultBomRows(325).find((r) => r.material === 'Module Mounting Structure')?.quantity)
      .toBe('325 KW Structure Including GI Pipe')
  })
})

/** End-to-end: the figures as they appear on the printed page. */
describe('printed figures reproduce the sample documents', () => {
  it('Anil 10.2kW', () => {
    const capacityWp = capacityFromPanels([
      { panelId: 'waaree-dcr-590', count: 7 },
      { panelId: 'waaree-ndcr-615', count: 10 },
    ])
    const ratePerWatt = 373_116 / capacityWp
    const totals = computeQuotation({ capacityWp, ratePerWatt, subsidyAmount: 78_000 })

    expect(capacityWp).toBe(10_280)
    expect(formatRate(ratePerWatt)).toBe('₹36.30')
    expect(formatINR(totals.priceExclGst)).toBe('₹3,73,116.00')
    expect(formatINR(totals.priceInclGst)).toBe('₹4,06,323.32')
    expect(formatINR(totals.finalPayable)).toBe('₹3,28,323.32')
  })

  it('Vishwakarma 325kW', () => {
    const capacityWp = capacityFromPanels([{ panelId: 'renewsys-590', count: 551 }])
    const ratePerWatt = 8_187_374.5 / capacityWp
    const totals = computeQuotation({ capacityWp, ratePerWatt, subsidyAmount: 0 })

    expect(capacityWp).toBe(325_090)
    expect(formatRate(ratePerWatt)).toBe('₹25.18')
    expect(formatINR(totals.priceExclGst)).toBe('₹81,87,374.50')
    expect(formatINR(totals.priceInclGst)).toBe('₹89,16,050.83')
  })
})
