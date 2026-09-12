/**
 * Builds a structured model of the customer quotation.
 *
 * Deliberately pure: no pdfmake, no docx, no DOM, no network. renderPdf.ts and
 * renderDocx.ts both consume this model, which is what keeps the two exporters
 * identical — a section can only appear in one if it appears in the other.
 *
 * Ported from the former backend/google-apps-script/DocumentModel.gs. The backend no
 * longer renders anything, so the model lives here, next to the constants it reads.
 *
 * Section order and layout follow "Anil Bh Interior 10 kw.pdf". PROJECT_PLAN.md §5.
 */

import { COMPANY } from '@/constants/config'
import {
  CLIENT_SCOPE,
  COVER_LETTER,
  PRICE_ROW_DESCRIPTION,
  SCOPE_OF_WORKS,
  SCOPE_OF_WORKS_INTRO,
  SUBSIDY_NOTE,
  TERMS_AND_CONDITIONS,
} from '@/constants/boilerplate'
import type { BomSpecRow, RichLines, RichRun } from '@/constants/bomDefaults'
import { isUsable } from '@/services/export/imageGrid'
import { CONTENT_HEIGHT, FONT, PROJECT_PAGE, SPACING } from '@/services/export/layoutSpec'
import { milestoneAmounts, printsSubsidy } from '@/services/pricing/quotationEngine'
import { formatDocumentDate, validTillIso } from '@/utils/dates'
import { formatINR } from '@/utils/formatters'

export type { RichLines, RichRun }

export type CellAlign = 'left' | 'right' | 'center'

/** One decoded photograph, ready to embed. Bytes are resolved before the model is built. */
export interface ExportImage {
  id: string
  /** Raw base64, no data: prefix. */
  base64: string
  mimeType: string
  /** Natural pixel dimensions — never guessed, so aspect ratio is always exact. */
  width: number
  height: number
}

export interface ResolvedProject {
  id: string
  name: string
  description: string
  capacity: string
  images: ExportImage[]
}

/**
 * Whether a project earns a place in the document.
 *
 * A project with no photograph the grid can actually lay out is omitted: its slot would
 * print as a caption stranded in half a page of white space, which is what shipped in
 * SGT/2026/09/B01. `isUsable` is imported rather than restated so the test that admits a
 * project and the test that lays out its photographs can never disagree.
 */
export const hasPrintablePhotos = (project: ResolvedProject): boolean =>
  project.images.some(isUsable)

/** A table cell: stacked lines of runs, plus its part in any vertical merge. */
export interface DocCell {
  lines: RichLines
  /** Number of rows this cell spans. Absent or 1 means no merge. */
  rowSpan?: number
  /** True when this cell is absorbed by a merge starting above it. */
  mergedAbove?: boolean
}

/** One bullet. `red` marks the validity line, which the reference sets in red. */
export interface Bullet {
  text: string
  red?: boolean
}

interface Base {
  /** Starts this section on a fresh page. See the page-structure note below. */
  pageBreakBefore?: boolean
}

export type Section =
  | (Base & { type: 'letterhead'; company: typeof COMPANY })
  | (Base & {
      type: 'title'
      heading: string
      client: string
      location: string
      date: string
      quotationNumber: string
    })
  | (Base & {
      type: 'coverLetter'
      salutation: string
      paragraphs: string[]
      closing: string
      signOff: string[]
      signatory: string
      signatoryPhone: string
      hasSignature: boolean
    })
  | (Base & {
      type: 'priceTable' | 'bomTable'
      heading: string
      header: string[]
      rows: DocCell[][]
      align: CellAlign[]
    })
  | (Base & { type: 'subsidyNote'; lines: string[] })
  | (Base & { type: 'bullets'; heading: string; items: Bullet[] })
  | (Base & {
      type: 'milestones'
      heading: string
      items: { percentage: number; description: string; amount: number; amountFormatted: string }[]
    })
  | (Base & {
      type: 'definitions'
      heading: string
      items: { title: string; body: RichRun[] }[]
    })
  | (Base & { type: 'projects'; heading: string; items: ResolvedProject[] })

export interface DocumentModel {
  sections: Section[]
}

export interface QuotationInput {
  leadName: string
  projectName: string
  quotationNumber: string
  quotationDate: string
  validityDays: number
  inverterKw: number
  milestones: { percentage: number; description: string }[]
  bom: BomSpecRow[]
}

export interface TotalsInput {
  capacityWp: number
  ratePerWatt: number
  priceExclGst: number
  priceInclGst: number
  subsidy: number
  finalPayable: number
}

/**
 * Page structure, read out of both sample DOCX files.
 *
 * Neither sample contains a single <w:br w:type="page"/>. Each authors exactly one
 * section break — after the sign-off — and produces the rest of its pagination with runs
 * of up to 22 consecutive empty paragraphs. That padding is calibrated to one specific
 * content length, so a longer BOM or an extra milestone slides every page after it.
 *
 * These flags reproduce the boundaries the reference lands on, deterministically.
 */
const BREAKS_BEFORE_PRICE_TABLE = true
const BREAKS_BEFORE_BOM_TABLE = true
const BREAKS_BEFORE_SCOPE_OF_WORKS = true
const BREAKS_BEFORE_PROJECTS = true

/** A project's place on the page, decided once and used by both renderers. */
export interface ProjectSlot {
  project: ResolvedProject
  /** Starts a new page before this project. */
  pageBreakBefore: boolean
  /** Vertical points this project may occupy, caption included. */
  budget: number
  /** The photographs actually laid out, capped at PROJECT_PAGE.maxPhotos. */
  images: ExportImage[]
}

/**
 * Vertical room a project's caption needs.
 *
 * Deliberately generous: over-reserving shrinks the collage a little, while
 * under-reserving pushes a caption past the bottom margin and breaks the page count.
 */
export function captionHeight(project: ResolvedProject): number {
  const lines =
    1 +
    (project.capacity ? 1 : 0) +
    (project.description
      ? Math.ceil(project.description.length / PROJECT_PAGE.captionCharsPerLine)
      : 0)

  return lines * FONT.caption * PROJECT_PAGE.captionLineHeight + SPACING.sectionBefore
}

/**
 * Projects per page: one on the first, two on every page after — except a project with
 * more than PROJECT_PAGE.fullPageThreshold photographs, which takes a page of its own.
 *
 * Each page holds two half-slots. A project claims one or two of them, and gets the
 * matching share of the page as its height budget; packImageGrid never lets a collage
 * outgrow that budget, so the pagination holds by construction.
 */
export function paginateProjects(items: ResolvedProject[]): ProjectSlot[] {
  const halfPage = (CONTENT_HEIGHT - PROJECT_PAGE.betweenProjects) / 2
  let remaining = 0

  return items.map((project, index) => {
    const images = project.images.slice(0, PROJECT_PAGE.maxPhotos)

    // The first project shares the page with the section heading and takes what is left
    // of it, matching the reference document's opening projects page.
    if (index === 0) {
      remaining = 0
      return {
        project,
        images,
        pageBreakBefore: false,
        budget: CONTENT_HEIGHT - PROJECT_PAGE.headingReserve,
      }
    }

    const cost = images.length > PROJECT_PAGE.fullPageThreshold ? 2 : 1
    const pageBreakBefore = cost > remaining
    if (pageBreakBefore) remaining = 2
    remaining -= cost

    return {
      project,
      images,
      pageBreakBefore,
      budget: cost === 2 ? CONTENT_HEIGHT : halfPage,
    }
  })
}

const PRICE_TABLE_ALIGN: CellAlign[] = ['center', 'left', 'right', 'right', 'right', 'right']
const BOM_TABLE_ALIGN: CellAlign[] = ['left', 'left', 'center', 'center']

/** The reference prints a space between the rupee sign and the figure. */
export function money(value: number): string {
  return formatINR(value).replace(/^(\D*₹)\s*/u, '$1 ')
}

const plain = (text: string): DocCell => ({ lines: [[{ text }]] })

/**
 * Splits a paragraph around a verbatim phrase the reference sets in bold.
 * Returns the whole paragraph as one plain run when the phrase is absent.
 */
function emphasised(body: string, phrase?: string): RichRun[] {
  if (!phrase) return [{ text: body }]
  const at = body.indexOf(phrase)
  if (at < 0) return [{ text: body }]
  return [
    { text: body.slice(0, at) },
    { text: phrase, bold: true },
    { text: body.slice(at + phrase.length) },
  ].filter((run) => run.text.length > 0)
}

/**
 * Turns the BOM's empty cells into vertical merges.
 *
 * An empty Quantity or Warranty already means "same as the row above" — that is exactly
 * how both sample documents read, and why those fields are blank in bomDefaults.ts.
 * Deriving the merge here rather than storing it keeps the persisted BOM unchanged and
 * works just as well for a BOM the operator has edited by hand.
 */
function withVerticalMerges(rows: DocCell[][], columns: number[]): DocCell[][] {
  for (const column of columns) {
    let origin: DocCell | null = null

    for (const row of rows) {
      const cell = row[column]
      if (!cell) continue

      const isEmpty = cell.lines.every((linex) => linex.every((run) => !run.text.trim()))
      if (isEmpty && origin) {
        cell.mergedAbove = true
        origin.rowSpan = (origin.rowSpan ?? 1) + 1
      } else if (!isEmpty) {
        origin = cell
      }
    }
  }
  return rows
}

/** A BOM cell, preferring the rich rendering when the defaults supplied one. */
function bomCell(text: string, rich?: RichLines): DocCell {
  if (rich && rich.length > 0) return { lines: rich }
  return plain(text)
}

/**
 * @param projects the reference projects the operator selected, with their photographs
 *                 already decoded. An empty list omits the section entirely.
 */
export function buildDocumentModel(
  quotation: QuotationInput,
  totals: TotalsInput,
  projects: ResolvedProject[] = []
): DocumentModel {
  const capacityKw = totals.capacityWp / 1000
  const validTill = validTillIso(quotation.quotationDate, quotation.validityDays)
  const amounts = milestoneAmounts(
    quotation.milestones.map((milestone) => Number(milestone.percentage)),
    totals.finalPayable
  )

  const sections: Section[] = []

  // Cover page only, centred, in the body flow — the reference has no running header.
  sections.push({ type: 'letterhead', company: COMPANY })

  // Printed once. Both samples repeat this block verbatim; that is a copy-paste
  // artifact in the source documents, not a design choice.
  sections.push({
    type: 'title',
    heading: `EPC PROPOSAL FOR ${capacityKw.toFixed(2)} KW GRID TIED SOLAR POWER PLANT`,
    client: quotation.leadName,
    location: quotation.projectName,
    date: formatDocumentDate(quotation.quotationDate),
    quotationNumber: quotation.quotationNumber,
  })

  sections.push({
    type: 'coverLetter',
    salutation: 'Respected Sir,',
    paragraphs: [...COVER_LETTER],
    closing: 'Thanking you.',
    signOff: ['Warm Regards,', `From ${COMPANY.name}`, COMPANY.address],
    signatory: COMPANY.signatory,
    signatoryPhone: COMPANY.phone,
    hasSignature: true,
  })

  sections.push({
    type: 'priceTable',
    pageBreakBefore: BREAKS_BEFORE_PRICE_TABLE,
    heading: `QUOTATION (${capacityKw.toFixed(2)} KW – Panels with ${quotation.inverterKw} KW inverter)`,
    header: [
      'S.No.',
      'DESCRIPTION',
      'CAPACITY ( Watt )',
      'RATE/ WATT',
      'PRICE ( ₹ ) (Excl. GST)',
      'PRICE ( ₹ ) Incl. GST',
    ],
    align: PRICE_TABLE_ALIGN,
    // Exactly one priced row. The 15 costing lines never appear on this document.
    rows: [
      [
        plain('1'),
        plain(PRICE_ROW_DESCRIPTION),
        plain(`${totals.capacityWp} Wp`),
        plain(`₹ ${totals.ratePerWatt.toFixed(2)}/WATT`),
        plain(money(totals.priceExclGst)),
        plain(money(totals.priceInclGst)),
      ],
    ],
  })

  // Suppressed entirely at zero, so a commercial client never sees a nil subsidy.
  if (printsSubsidy(totals.subsidy)) {
    sections.push({
      type: 'subsidyNote',
      lines: SUBSIDY_NOTE(money(totals.subsidy), money(totals.finalPayable)),
    })
  }

  const terms: Bullet[] = TERMS_AND_CONDITIONS.map((text) => ({ text }))
  if (validTill) {
    // The reference sets the validity line in red; the rest stay black.
    terms.push({
      text: `Above given quotation is valid till ${quotation.validityDays} days i.e. ${formatDocumentDate(validTill)}`,
      red: true,
    })
  }
  sections.push({ type: 'bullets', heading: 'TERMS & CONDITIONS', items: terms })

  sections.push({
    type: 'milestones',
    heading: 'TERMS OF PAYMENT',
    items: quotation.milestones.map((milestone, index) => ({
      percentage: Number(milestone.percentage),
      description: String(milestone.description),
      amount: amounts[index],
      amountFormatted: money(amounts[index]),
    })),
  })

  sections.push({
    type: 'bomTable',
    pageBreakBefore: BREAKS_BEFORE_BOM_TABLE,
    heading: 'BILL OF MATERIALS',
    header: ['Material', 'Details', 'Quantity', 'Warranty'],
    align: BOM_TABLE_ALIGN,
    rows: withVerticalMerges(
      quotation.bom.map((row) => [
        plain(String(row.material ?? '')),
        bomCell(String(row.details ?? ''), row.detailsRich),
        bomCell(String(row.quantity ?? ''), row.quantityRich),
        plain(String(row.warranty ?? '')),
      ]),
      // Quantity and Warranty only. A blank Material or Details is genuinely blank.
      [2, 3]
    ),
  })

  sections.push({
    type: 'bullets',
    pageBreakBefore: BREAKS_BEFORE_SCOPE_OF_WORKS,
    heading: 'SCOPE OF WORKS:',
    // All eight are bullets in the reference, the lead-in included.
    items: [SCOPE_OF_WORKS_INTRO, ...SCOPE_OF_WORKS].map((text) => ({ text })),
  })

  sections.push({
    type: 'definitions',
    heading: 'CLIENT SCOPE:',
    items: CLIENT_SCOPE.map((item) => ({
      title: item.title,
      body: emphasised(item.body, item.emphasise),
    })),
  })

  // Omitted entirely when nothing is selected, or when nothing selected has a
  // photograph to show — no heading, no empty page.
  const printable = projects.filter(hasPrintablePhotos)
  if (printable.length > 0) {
    sections.push({
      type: 'projects',
      pageBreakBefore: BREAKS_BEFORE_PROJECTS,
      heading: 'SOME OF OUR PROJECTS:',
      items: printable,
    })
  }

  return { sections }
}

/** Filename for a generated document, safe for Drive, Windows and email attachments. */
export function quotationFileName(
  quotation: { quotationNumber?: string; leadName?: string },
  extension: 'pdf' | 'docx'
): string {
  const strip = (value: string): string => value.replace(/[\\/:*?"<>|]/g, '-')
  const safeNumber = strip(String(quotation.quotationNumber || 'quotation'))
  const safeName = strip(String(quotation.leadName || ''))
  return `${`${safeNumber} - ${safeName}`.trim()}.${extension}`
}
