import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { defaultBomRows } from '@/constants/bomDefaults'
import { defaultMilestones } from '@/constants/milestones'
import {
  buildWhatsAppUrl as clientBuildWhatsAppUrl,
  normaliseWhatsAppNumber as clientNormalise,
} from '@/services/quotation/whatsapp'
import { buildDocumentModel, quotationFileName } from '@/services/export/documentModel'
import type { ResolvedProject } from '@/services/export/documentModel'

/**
 * Asserts the document builder reproduces the two sample quotations.
 *
 * buildDocumentModel now lives in TypeScript (services/export/documentModel.ts) and is
 * the single source of truth: the backend no longer renders anything, so the old
 * DocumentModel.gs and PDF.gs are gone. Utils.gs, Pricing.gs, Share.gs and Email.gs are
 * still loaded below, because those DO still run server-side and must not drift from
 * their frontend counterparts.
 */

const backendDir = fileURLToPath(new URL('../../../../backend/google-apps-script/', import.meta.url))

/** A table cell's plain text, flattened out of its stacked rich runs. */
function cellText(cell: { lines: { text: string }[][] }): string {
  return cell.lines.map((runs) => runs.map((run) => run.text).join('')).join(' ')
}

/** Two photographs, enough to exercise the projects section. */
const sampleProjects: ResolvedProject[] = [
  {
    id: 'mayo',
    name: 'EPC - Mayo College Girls School, Ajmer',
    capacity: '300 KW',
    description: 'Rooftop grid-tied installation.',
    images: [
      { id: 'a', base64: 'AA==', mimeType: 'image/jpeg', width: 1600, height: 1200 },
      { id: 'b', base64: 'AA==', mimeType: 'image/jpeg', width: 1600, height: 1200 },
    ],
  },
]

interface Section {
  type: string
  heading?: string
  header?: string[]
  rows?: { lines: { text: string }[][] }[][]
  items?: unknown[]
  lines?: string[]
  [key: string]: unknown
}

function loadBackend() {
  const source = ['Utils.gs', 'Pricing.gs', 'Company.gs', 'Email.gs', 'Share.gs']
    .map((file) => readFileSync(backendDir + file, 'utf8'))
    .join('\n')
  const factory = new Function(
    `${source}
     return { buildWhatsAppUrl, buildWhatsAppMessage, normaliseWhatsAppNumber,
              buildEmailSubject, buildEmailBody, computeQuotationTotals };`
  ) as () => Record<string, (...args: never[]) => never>
  return factory()
}

const backend = loadBackend()

function quotationFor(kind: 'anil' | 'vishwakarma') {
  if (kind === 'anil') {
    return {
      leadName: 'Anil Bhaiya Ji',
      projectName: 'Ajmer, Rajasthan',
      quotationNumber: 'SGT/2026/04/B21',
      quotationDate: '2026-04-14',
      validityDays: 10,
      email: 'anil@example.com',
      phone: '9876543210',
      capacityWp: 10_280,
      ratePerWatt: 373_116 / 10_280,
      subsidyAmount: 78_000,
      inverterKw: 10,
      milestones: defaultMilestones(10.28),
      bom: defaultBomRows(10.28),
    }
  }
  return {
    leadName: 'Vishwakarma Health Care',
    projectName: 'Ajmer, Rajasthan',
    quotationNumber: 'SGT/2026/02/B09',
    quotationDate: '2026-02-02',
    validityDays: 10,
    email: '',
    phone: '',
    capacityWp: 325_090,
    ratePerWatt: 8_187_374.5 / 325_090,
    subsidyAmount: 0,
    inverterKw: 250,
    milestones: defaultMilestones(325),
    bom: defaultBomRows(325),
  }
}

function modelFor(kind: 'anil' | 'vishwakarma', projects: ResolvedProject[] = []) {
  const quotation = quotationFor(kind)
  const totals = backend.computeQuotationTotals(
    quotation.capacityWp as never,
    quotation.ratePerWatt as never,
    quotation.subsidyAmount as never
  ) as unknown as { capacityWp: number; ratePerWatt: number }
  return {
    quotation,
    totals,
    model: buildDocumentModel(
      quotation as never,
      totals as never,
      projects
    ) as unknown as { sections: Section[] },
  }
}

describe('document section order matches the DOCX samples', () => {
  it('Anil 10.2kW — with the subsidy note', () => {
    const { model } = modelFor('anil')
    expect(model.sections.map((section) => section.type)).toEqual([
      'letterhead',
      'title',
      'coverLetter',
      'priceTable',
      'subsidyNote',
      'bullets', // Terms & Conditions
      'milestones',
      'bomTable',
      'bullets', // Scope of Works
      'definitions',
      // No 'projects': none were selected. The section is omitted entirely.
    ])
  })

  it('Vishwakarma 325kW — subsidy section absent, as in the original', () => {
    const { model } = modelFor('vishwakarma')
    expect(model.sections.map((section) => section.type)).not.toContain('subsidyNote')
    expect(model.sections).toHaveLength(9)
  })
})

describe('the priced table', () => {
  it('carries exactly one row and the Anil figures', () => {
    const { model } = modelFor('anil')
    const table = model.sections.find((section) => section.type === 'priceTable')!

    expect(table.rows).toHaveLength(1)
    expect(table.heading).toBe('QUOTATION (10.28 KW – Panels with 10 KW inverter)')
    expect(table.rows![0].map(cellText)).toEqual([
      '1',
      'Supply of equipments and installation & commissioning',
      '10280 Wp',
      '₹ 36.30/WATT',
      // The reference prints a space after the rupee sign.
      '₹ 3,73,116.00',
      '₹ 4,06,323.32',
    ])
  })

  it('carries the Vishwakarma figures', () => {
    const { model } = modelFor('vishwakarma')
    const table = model.sections.find((section) => section.type === 'priceTable')!
    expect(cellText(table.rows![0][3])).toBe('₹ 25.18/WATT')
    expect(cellText(table.rows![0][4])).toBe('₹ 81,87,374.50')
    expect(cellText(table.rows![0][5])).toBe('₹ 89,16,050.83')
  })
})

describe('the costing sheet never reaches the customer', () => {
  const forbidden = [
    'Solar Green Share',
    'Welding & Labour',
    'CTPT',
    'MIB Box',
    'ACDB / DCDB',
    'Miscellaneous (',
  ]

  it.each(['anil', 'vishwakarma'] as const)('%s document contains no costing line', (kind) => {
    const { model } = modelFor(kind)
    const serialised = JSON.stringify(model)
    for (const term of forbidden) {
      expect(serialised).not.toContain(term)
    }
  })

  it('the BOM table carries no prices', () => {
    const { model } = modelFor('anil')
    const bom = model.sections.find((section) => section.type === 'bomTable')!
    expect(JSON.stringify(bom.rows)).not.toMatch(/₹/)
  })
})

describe('subsidy note', () => {
  it('states the amount and the after-subsidy total', () => {
    const { model } = modelFor('anil')
    const note = model.sections.find((section) => section.type === 'subsidyNote')!
    expect(note.lines![0]).toContain('₹ 78,000.00')
    expect(note.lines![1]).toBe('Total Project cost after subsidy :- ₹ 3,28,323.32')
  })
})

describe('milestones on the document', () => {
  it('reproduces the Anil 50/40/10 split in rupees', () => {
    const { model } = modelFor('anil')
    const section = model.sections.find((s) => s.type === 'milestones')!
    const items = section.items as { percentage: number; amount: number; amountFormatted: string }[]

    expect(items).toHaveLength(3)
    expect(items[0].percentage).toBe(50)
    expect(items[0].amountFormatted).toBe('₹ 1,64,161.66')
    expect(items.reduce((sum, item) => sum + item.amount, 0)).toBeCloseTo(328_323.324, 6)
  })

  it('reproduces the Vishwakarma 5-stage split', () => {
    const { model } = modelFor('vishwakarma')
    const section = model.sections.find((s) => s.type === 'milestones')!
    expect(section.items).toHaveLength(5)
  })
})

describe('validity line', () => {
  it('prints the computed expiry date', () => {
    const { model } = modelFor('anil')
    const terms = model.sections.find(
      (section) => section.type === 'bullets' && section.heading === 'TERMS & CONDITIONS'
    )!
    const validity = (terms.items as { text: string; red?: boolean }[]).find((item) =>
      item.text.startsWith('Above given quotation')
    )
    expect(validity?.text).toBe('Above given quotation is valid till 10 days i.e. 24-04-2026')
    // The reference sets this one bullet in red; the others stay black.
    expect(validity?.red).toBe(true)
    expect((terms.items as { red?: boolean }[]).filter((item) => item.red)).toHaveLength(1)
  })
})

describe('layout fidelity to the original DOCX', () => {
  it('omits the projects section entirely when none are selected', () => {
    const { model } = modelFor('anil')
    expect(model.sections.find((section) => section.type === 'projects')).toBeUndefined()
  })

  it('renders only the projects the operator selected', () => {
    const { model } = modelFor('anil', sampleProjects)
    const projects = model.sections.find((section) => section.type === 'projects')!
    const items = projects.items as { name: string; capacity: string; images: unknown[] }[]

    expect(projects.heading).toBe('SOME OF OUR PROJECTS:')
    expect(items).toHaveLength(1)
    expect(items[0].name).toContain('Mayo College Girls School')
    expect(items[0].images).toHaveLength(2)
  })

  it('starts the projects section, the price table, the BOM and the scope on new pages', () => {
    const { model } = modelFor('anil', sampleProjects)
    const broken = model.sections
      .filter((section) => section.pageBreakBefore)
      .map((section) => section.heading ?? section.type)

    expect(broken).toEqual([
      'QUOTATION (10.28 KW – Panels with 10 KW inverter)',
      'BILL OF MATERIALS',
      'SCOPE OF WORKS:',
      'SOME OF OUR PROJECTS:',
    ])
  })

  it('marks the sign-off as carrying a signature image', () => {
    const { model } = modelFor('anil')
    const cover = model.sections.find((section) => section.type === 'coverLetter')!
    expect(cover.hasSignature).toBe(true)
  })
})

describe('WhatsApp deep link', () => {
  it('normalises Indian numbers to the 91XXXXXXXXXX form', () => {
    expect(backend.normaliseWhatsAppNumber('9876543210' as never)).toBe('919876543210')
    expect(backend.normaliseWhatsAppNumber('+91 98765 43210' as never)).toBe('919876543210')
    expect(backend.normaliseWhatsAppNumber('09876543210' as never)).toBe('919876543210')
    expect(backend.normaliseWhatsAppNumber('' as never)).toBe('')
  })

  it('builds a wa.me link with the message URL-encoded', () => {
    const { quotation, totals } = modelFor('anil')
    const url = backend.buildWhatsAppUrl(
      quotation as never,
      totals as never,
      'https://drive.google.com/file/d/abc/view' as never
    ) as unknown as string

    expect(url.startsWith('https://wa.me/919876543210?text=')).toBe(true)
    expect(url).not.toMatch(/\s/)
    const text = decodeURIComponent(url.split('?text=')[1])
    expect(text).toContain('Your solar quotation is ready.')
    expect(text).toContain('After subsidy: ₹3,28,323.32')
    expect(text).toContain('https://drive.google.com/file/d/abc/view')
  })

  it('omits the after-subsidy line when there is no subsidy', () => {
    const { quotation, totals } = modelFor('vishwakarma')
    const url = backend.buildWhatsAppUrl(quotation as never, totals as never, '' as never) as unknown as string
    expect(decodeURIComponent(url)).not.toContain('After subsidy')
  })
})

describe('email', () => {
  it('subjects the message with the quotation number and capacity', () => {
    const { quotation, totals } = modelFor('anil')
    expect(backend.buildEmailSubject(quotation as never, totals as never)).toBe(
      'Solar Quotation SGT/2026/04/B21 — 10.28 kW Solar Power Plant'
    )
  })

  it('includes the subsidy breakdown only when one applies', () => {
    const anil = modelFor('anil')
    const vish = modelFor('vishwakarma')
    expect(backend.buildEmailBody(anil.quotation as never, anil.totals as never)).toContain(
      'Payable after subsidy: ₹3,28,323.32'
    )
    expect(backend.buildEmailBody(vish.quotation as never, vish.totals as never)).not.toContain(
      'Payable after subsidy'
    )
  })
})

describe('PDF filename', () => {
  it('is built from the quotation number and client, stripped of path characters', () => {
    expect(
      quotationFileName(
        { quotationNumber: 'SGT/2026/04/B21', leadName: 'Anil Bhaiya Ji' },
        'pdf'
      )
    ).toBe('SGT-2026-04-B21 - Anil Bhaiya Ji.pdf')
  })
})

describe('client and server build the same WhatsApp link', () => {
  it.each(['anil', 'vishwakarma'] as const)('%s', (kind) => {
    const { quotation, totals } = modelFor(kind)
    const pdfUrl = 'https://drive.google.com/file/d/abc/view'

    const server = backend.buildWhatsAppUrl(
      quotation as never,
      totals as never,
      pdfUrl as never
    ) as unknown as string

    const client = clientBuildWhatsAppUrl(
      {
        leadName: quotation.leadName,
        quotationNumber: quotation.quotationNumber,
        phone: quotation.phone,
        capacityWp: totals.capacityWp,
        priceInclGst: (totals as unknown as { priceInclGst: number }).priceInclGst,
        finalPayable: (totals as unknown as { finalPayable: number }).finalPayable,
        subsidy: (totals as unknown as { subsidy: number }).subsidy,
      },
      pdfUrl
    )

    // Intl inserts U+00A0 in currency output; the .gs formatter uses a plain space.
    expect(decodeURIComponent(client).replace(/\s/g, '')).toBe(
      decodeURIComponent(server).replace(/\s/g, '')
    )
  })

  it('normalises numbers identically', () => {
    for (const phone of ['9876543210', '+91 98765 43210', '09876543210', '']) {
      expect(clientNormalise(phone)).toBe(backend.normaliseWhatsAppNumber(phone as never))
    }
  })
})
