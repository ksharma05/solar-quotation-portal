import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { quotationSchema } from '@/services/validation/quotationSchema'
import { packImageGrid } from '@/services/export/imageGrid'
import { buildDocumentModel, paginateProjects } from '@/services/export/documentModel'
import { COLORS, IMAGE_GRID, PROJECT_PAGE, companyWordmark } from '@/services/export/layoutSpec'
import { defaultBomRows } from '@/constants/bomDefaults'
import { defaultMilestones } from '@/constants/milestones'
import { computeQuotation } from '@/services/pricing/quotationEngine'
import type { ExportImage, ResolvedProject } from '@/services/export/documentModel'

/**
 * Covers the reference-projects feature end to end, minus the network: the persisted
 * column, the server-side mirror of the new field, and the three edge cases the
 * exporters must survive.
 */

const backendDir = fileURLToPath(
  new URL('../../../../backend/google-apps-script/', import.meta.url)
)
const read = (file: string): string => readFileSync(backendDir + file, 'utf8')

/** A stand-in for the half-page a project is usually given. */
const BUDGET = 320

function photo(id: string, width = 1600, height = 1200): ExportImage {
  return { id, base64: 'AA==', mimeType: 'image/jpeg', width, height }
}

function project(overrides: Partial<ResolvedProject> = {}): ResolvedProject {
  return {
    id: 'p1',
    name: 'EPC - Mayo College Girls School, Ajmer',
    capacity: '300 KW',
    description: 'Rooftop grid-tied installation.',
    images: [],
    ...overrides,
  }
}

function modelWith(projects: ResolvedProject[]) {
  const quotation = {
    leadName: 'Anil Bhaiya Ji',
    projectName: 'Ajmer, Rajasthan',
    quotationNumber: 'SGT/2026/04/B21',
    quotationDate: '2026-04-14',
    validityDays: 10,
    inverterKw: 10,
    milestones: defaultMilestones(10.28),
    bom: defaultBomRows(10.28),
  }
  const totals = {
    ...computeQuotation({ capacityWp: 10_280, ratePerWatt: 36.3, subsidyAmount: 78_000 }),
    ratePerWatt: 36.3,
  }
  return buildDocumentModel(quotation, totals, projects)
}

describe('referenceProjectIds is persisted', () => {
  it('is a column on the Quotations sheet', () => {
    expect(read('Sheets.gs')).toContain("'referenceProjectIds',")
  })

  it('repairs a header row written before the column existed', () => {
    const sheets = read('Sheets.gs')
    // Without this, every read of HEADERS.length columns throws on an older sheet.
    expect(sheets).toContain('function ensureHeaders(sheet)')
    expect(sheets).toContain('ensureHeaders(sheet)')
  })

  it('reads back as an empty list on rows that predate it', () => {
    expect(read('Sheets.gs')).toContain('output.referenceProjectIds = safeParse(')
  })

  it('is mirrored by the server-side validator', () => {
    const validation = read('Validation.gs')
    expect(validation).toContain('referenceProjectIds: sanitiseIds(input.referenceProjectIds)')
    expect(validation).toContain('function sanitiseIds(value)')
  })

  it('defaults to an empty selection in the client schema', () => {
    const parsed = quotationSchema.safeParse({
      leadName: 'Anil Bhaiya Ji',
      projectName: 'Ajmer, Rajasthan',
      quotationNumber: 'SGT/2026/04/B21',
      quotationDate: '2026-04-14',
      validityDays: 10,
      panels: [{ panelId: 'waaree-dcr-590', count: 17 }],
      inverterId: 'sungrow-10',
      subsidyAmount: 78_000,
      milestones: defaultMilestones(10.28),
      bom: defaultBomRows(10.28),
    })
    expect(parsed.success).toBe(true)
    if (parsed.success) expect(parsed.data.referenceProjectIds).toEqual([])
  })
})

describe('every project action is routed and defined', () => {
  const code = read('Code.gs')
  const projects = read('Projects.gs')

  it.each([
    ['listProjects', 'handleListProjects'],
    ['saveProject', 'handleSaveProject'],
    ['deleteProject', 'handleDeleteProject'],
    ['uploadProjectImage', 'handleUploadProjectImage'],
    ['deleteProjectImage', 'handleDeleteProjectImage'],
    ['getProjectImages', 'handleGetProjectImages'],
  ])('%s -> %s', (action, handler) => {
    expect(code).toContain(`case '${action}':`)
    expect(projects).toContain(`function ${handler}(`)
  })

  it('leaves no caller of the deleted Apps Script renderer', () => {
    const all = ['Code.gs', 'Email.gs', 'Sheets.gs', 'Validation.gs', 'Projects.gs']
      .map(read)
      .join('\n')
    expect(all).not.toMatch(/generateQuotationPdf|buildDocumentModel|DocumentApp/)
  })
})

describe('the edge cases the exporters must survive', () => {
  it('omits the section entirely when nothing is selected', () => {
    const model = modelWith([])
    expect(model.sections.find((section) => section.type === 'projects')).toBeUndefined()
  })

  // A photograph-less project used to print as a caption holding down half a page of
  // white space. SGT/2026/09/B01 went out with four such pages, so the project is now
  // omitted and the operator is warned in the form instead.
  it('omits a project that has no photographs, and the section with it', () => {
    const model = modelWith([project({ images: [] })])
    expect(model.sections.find((section) => section.type === 'projects')).toBeUndefined()
  })

  it('keeps only the projects that have photographs, in the operator’s order', () => {
    const model = modelWith([
      project({ id: 'bare', name: 'No photographs', images: [] }),
      project({ id: 'shown', name: 'Has photographs', images: [photo('a'), photo('b')] }),
      project({ id: 'bare-too', name: 'Also none', images: [] }),
    ])
    const section = model.sections.find((s) => s.type === 'projects')!
    const items = section.items as ResolvedProject[]

    expect(items.map((item) => item.id)).toEqual(['shown'])
    expect(packImageGrid(items[0].images, { budget: BUDGET })).not.toEqual([])
  })

  // Same outcome by a different route: bytes arrived, but nothing in them can be laid
  // out. Admitting the project here would reintroduce exactly the blank slot above.
  it('omits a project whose every photograph is unusable', () => {
    const model = modelWith([
      project({
        images: [
          { id: 'empty', base64: '', mimeType: 'image/jpeg', width: 1600, height: 1200 },
          { id: 'sizeless', base64: 'AA==', mimeType: 'image/jpeg', width: 0, height: 0 },
        ],
      }),
    ])
    expect(model.sections.find((section) => section.type === 'projects')).toBeUndefined()
  })

  it('skips an unreadable photograph rather than guessing its size', () => {
    const usable = photo('good')
    const rows = packImageGrid(
      [
        usable,
        { ...photo('no-dimensions'), width: 0, height: 0 },
        { ...photo('not-a-number'), width: Number.NaN, height: 100 },
        { ...photo('no-bytes'), base64: '' },
      ],
      { budget: BUDGET }
    )

    expect(rows.flatMap((row) => row.cells.map((cell) => cell.image.id))).toEqual(['good'])
  })
})

describe('the photo grid', () => {
  it('pairs photographs up, leading with a wide one when the count is odd', () => {
    expect(packImageGrid([photo('a')], { budget: BUDGET }).map((row) => row.cells.length)).toEqual([
      1,
    ])
    expect(
      packImageGrid([photo('a'), photo('b')], { budget: BUDGET }).map((row) => row.cells.length)
    ).toEqual([2])
    expect(
      packImageGrid([photo('a'), photo('b'), photo('c')], { budget: BUDGET }).map(
        (row) => row.cells.length
      )
    ).toEqual([1, 2])
    expect(
      packImageGrid([photo('a'), photo('b'), photo('c'), photo('d')], { budget: BUDGET }).map(
        (row) => row.cells.length
      )
    ).toEqual([2, 2])
  })

  it('keeps every tile in a row the same size and never outgrows the budget', () => {
    const rows = packImageGrid([photo('a'), photo('b'), photo('c'), photo('d'), photo('e')], {
      budget: BUDGET,
    })

    for (const row of rows) {
      expect(new Set(row.cells.map((cell) => cell.tileWidth)).size).toBe(1)
      expect(new Set(row.cells.map((cell) => cell.tileHeight)).size).toBe(1)
    }

    const used =
      rows.reduce((sum, row) => sum + row.height, 0) + IMAGE_GRID.rowGap * (rows.length - 1)
    expect(used).toBeLessThanOrEqual(BUDGET + 0.01)
  })

  it('scales a collage down to fit a slot too short for it', () => {
    const photos = [photo('a', 1000, 2000), photo('b', 1000, 2000), photo('c', 1000, 2000)]
    const roomy = packImageGrid(photos, { budget: 2000 })
    const cramped = packImageGrid(photos, { budget: 200 })

    const height = (rows: ReturnType<typeof packImageGrid>): number =>
      rows.reduce((sum, row) => sum + row.height, 0) + IMAGE_GRID.rowGap * (rows.length - 1)

    expect(height(roomy)).toBeGreaterThan(height(cramped))
    expect(height(cramped)).toBeLessThanOrEqual(200.01)
  })

  it('preserves aspect ratio and never overflows its tile', () => {
    const rows = packImageGrid([photo('tall', 800, 1600), photo('wide', 2000, 500)], {
      budget: BUDGET,
    })

    for (const cell of rows.flatMap((row) => row.cells)) {
      const source = cell.image.width / cell.image.height
      expect(cell.width / cell.height).toBeCloseTo(source, 2)
      expect(cell.width).toBeLessThanOrEqual(cell.tileWidth + 0.01)
      expect(cell.height).toBeLessThanOrEqual(cell.tileHeight + 0.01)
    }
  })
})

describe('project pagination', () => {
  const withPhotos = (id: string, count: number): ResolvedProject =>
    project({ id, images: Array.from({ length: count }, (_, at) => photo(`${id}-${at}`)) })

  it('keeps one project on the heading page, then two per page', () => {
    const slots = paginateProjects([
      withPhotos('a', 2),
      withPhotos('b', 2),
      withPhotos('c', 2),
      withPhotos('d', 2),
      withPhotos('e', 2),
    ])

    expect(slots.map((slot) => slot.pageBreakBefore)).toEqual([false, true, false, true, false])
  })

  it('gives a project with more than four photographs a page of its own', () => {
    const slots = paginateProjects([
      withPhotos('a', 1),
      withPhotos('big', 6),
      withPhotos('c', 2),
      withPhotos('d', 2),
    ])

    expect(slots.map((slot) => slot.pageBreakBefore)).toEqual([false, true, true, false])
    expect(slots[1].budget).toBeGreaterThan(slots[2].budget)
  })

  it('caps the photographs it lays out rather than shrinking them to thumbnails', () => {
    const [slot] = paginateProjects([withPhotos('many', PROJECT_PAGE.maxPhotos + 4)])
    expect(slot.images).toHaveLength(PROJECT_PAGE.maxPhotos)
  })
})

describe('the brand wordmark', () => {
  it('colours the O of SOLAR orange and GREEN olive, leaving the rest black', () => {
    expect(companyWordmark('Solar Green Technology')).toEqual([
      { text: 'S', color: COLORS.ink },
      { text: 'O', color: COLORS.brandOrange },
      { text: 'LAR ', color: COLORS.ink },
      { text: 'GREEN ', color: COLORS.heading },
      { text: 'TECHNOLOGY', color: COLORS.ink },
    ])
  })

  it('still spells the name out exactly, uppercased', () => {
    const name = 'Solar Green Technology'
    expect(
      companyWordmark(name)
        .map((segment) => segment.text)
        .join('')
    ).toBe(name.toUpperCase())
  })
})
