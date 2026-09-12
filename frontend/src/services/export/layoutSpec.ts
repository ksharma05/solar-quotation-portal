/**
 * Every measurement, colour and font size the two exporters use.
 *
 * This module exists so renderPdf.ts and renderDocx.ts cannot drift. Neither renderer
 * may hardcode a geometry value; if a number is needed in one, it belongs here and is
 * read by both. All lengths are in points (1pt = 1/72in) unless the name says otherwise.
 *
 * Calibrated against "Anil Bh Interior 10 kw.pdf".
 */

/** A4 at 72dpi. */
export const PAGE = {
  width: 595.28,
  height: 841.89,
  marginX: 56,
  /**
   * Uniform margins: the letterhead appears on the cover only, in the body flow, and
   * the reference document has no page footers, so no page needs extra reserved space.
   */
  marginTop: 56,
  marginBottom: 56,
} as const

export const CONTENT_WIDTH = PAGE.width - PAGE.marginX * 2

/** Usable height of one page, margins removed. The project paginator budgets against it. */
export const CONTENT_HEIGHT = PAGE.height - PAGE.marginTop - PAGE.marginBottom

/** Cover-page letterhead. Centred, and printed once — never as a running header. */
export const LETTERHEAD = {
  logoWidth: 96,
  ruleThickness: 2,
  spaceAfterLogo: 4,
  spaceAfterName: 6,
  spaceAfterRule: 16,
} as const

export const COLORS = {
  ink: '#000000',
  muted: '#4A4A4A',
  /** Olive green, matching the reference's section headings. */
  heading: '#6E7B2E',
  brand: '#76892F',
  /** The orange leading "S" of the wordmark. */
  brandOrange: '#DE7A1B',
  /** The NOTE and after-subsidy lines, and the validity bullet. */
  red: '#C00000',
  rule: '#76892F',
  /** BOM header row. */
  tableHeaderBg: '#A9C23F',
  tableHeaderText: '#33401A',
  tableBorder: '#7F9A2E',
  /** Cover client block. */
  clientBoxFill: '#EAF1D3',
  clientBoxBorder: '#76892F',
  /** Project captions. */
  caption: '#6E7B2E',
} as const

export const FONT = {
  /**
   * Body text is a serif, as in the reference. Tinos is metric-compatible with Times
   * New Roman, so a Word fallback to Times lays out identically.
   */
  serif: 'Tinos',
  /** Section headings keep the display face. */
  display: 'Roboto',
  companyName: 22,
  companyDetail: 10,
  title: 13,
  heading: 12,
  body: 11,
  small: 10,
  table: 9,
  caption: 11,
} as const

export interface WordmarkSegment {
  text: string
  color: string
}

/**
 * The company name as the brand prints it: an orange leading "S", an olive "GREEN", and
 * black everywhere else.
 *
 * A function of the name rather than a literal, so COMPANY.name in constants/config.ts
 * stays the single source of truth. The joining space rides on the preceding segment, so
 * the rendered line is identical to the plain string it replaced.
 */
export function companyWordmark(name: string): WordmarkSegment[] {
  const words = name.toUpperCase().split(/\s+/).filter(Boolean)

  return words.flatMap<WordmarkSegment>((word, index) => {
    const text = index === words.length - 1 ? word : `${word} `

    if (word === 'GREEN') return [{ text, color: COLORS.heading }]

    if (index === 0 && word.startsWith('S')) {
      return [
        { text: 'S', color: COLORS.brandOrange },
        { text: text.slice(1), color: COLORS.ink },
      ]
    }

    return [{ text, color: COLORS.ink }]
  })
}

export const SPACING = {
  sectionBefore: 14,
  headingAfter: 6,
  paragraph: 6,
  listItem: 3,
  tableCellPaddingX: 5,
  tableCellPaddingY: 4,
  /** Inside the cover client block. */
  clientBoxPadding: 8,
} as const

/**
 * The cover panel holding the proposal title and the client block.
 *
 * Three columns: a fixed label column, the client's name and location, then the date and
 * quotation number. The fixed first column is what makes the location line up under the
 * name without measuring any glyphs.
 */
export const CLIENT_BOX = {
  /** Width of the "CLIENT:" label column — wide enough that the bold label never wraps. */
  labelWidth: 68,
  /** PDF gradient stops, left to right: green edges, near-white centre. */
  gradient: ['#DDE7C0', '#FFFFFF', '#DDE7C0'] as string[],
  /** OOXML shading has no gradient, so DOCX fills the panel flat. */
  flatFill: COLORS.clientBoxFill,
  /**
   * Height of the PDF gradient rectangle the panel is laid over.
   *
   * Measured off the rendered panel: three single-line rows at the sizes and padding
   * above come to 63.76pt. Every row is single-line by construction, so this is
   * deterministic — but it does have to be re-measured if a font size or the padding
   * changes, or the gradient will overhang the border or leave a sliver unfilled.
   */
  height: 63.8,
} as const

/** Column widths, in points. A null entry takes the remaining width. */
export const TABLE_WIDTHS = {
  price: [30, null, 62, 70, 88, 88] as (number | null)[],
  bom: [72, null, 116, 84] as (number | null)[],
} as const

/**
 * Reference-project photo grid.
 *
 * The reference prints photographs nearly edge to edge with hairline gutters. Tile SIZES
 * are not set here: they come from the page budget a project is given, so that the
 * collage always fills its slot exactly and the pagination below holds by construction.
 */
export const IMAGE_GRID = {
  columns: 2,
  gutter: 4,
  rowGap: 4,
} as const

/**
 * How reference projects are distributed over pages.
 *
 * One project shares the page with the section heading; every page after holds two,
 * unless a project carries enough photographs to deserve a page of its own.
 */
export const PROJECT_PAGE = {
  /** More photographs than this and the project takes a whole page. */
  fullPageThreshold: 4,
  /** Hard cap: extras are dropped rather than shrinking every tile to a thumbnail. */
  maxPhotos: 8,
  /** Room the "SOME OF OUR PROJECTS:" heading takes on the first projects page. */
  headingReserve: SPACING.sectionBefore + FONT.heading + SPACING.headingAfter,
  /** Gap between the two projects sharing a page. */
  betweenProjects: SPACING.sectionBefore,
  /** Leading multiplier used when reserving vertical room for a caption line. */
  captionLineHeight: 1.3,
  /** Characters that fit on one caption line at FONT.small across CONTENT_WIDTH. */
  captionCharsPerLine: 95,
} as const

/**
 * Resolves the null ("remaining space") entries in a width list to real points.
 *
 * The result is the TOTAL width of each column, padding included, summing to
 * CONTENT_WIDTH. That is what OOXML's w:tcW means, so renderDocx.ts uses these
 * directly. pdfmake instead treats a column width as the width of its CONTENT and adds
 * cell padding on top, so it must go through pdfColumnWidths() below.
 */
export function resolveWidths(widths: (number | null)[], total = CONTENT_WIDTH): number[] {
  const fixed = widths.reduce<number>((sum, width) => sum + (width ?? 0), 0)
  const flexible = widths.filter((width) => width === null).length
  const share = flexible > 0 ? Math.max(0, total - fixed) / flexible : 0
  return widths.map((width) => width ?? share)
}

/**
 * The same columns, adjusted for pdfmake.
 *
 * pdfmake adds paddingLeft + paddingRight to every declared column width, so handing it
 * widths that already sum to CONTENT_WIDTH overflows the page by columns x 2 x padding
 * — 60pt on the six-column price table, which ran the last column off the right edge.
 *
 * `padding` must match the horizontal padding the table's layout actually applies: the
 * client panel pads with clientBoxPadding, not tableCellPaddingX.
 */
export function pdfColumnWidths(
  widths: (number | null)[],
  total = CONTENT_WIDTH,
  padding: number = SPACING.tableCellPaddingX
): number[] {
  return resolveWidths(widths, total).map((width) => Math.max(0, width - padding * 2))
}

/**
 * Ligature substitution is disabled document-wide.
 *
 * NOTE the shape: fontkit reads an ARRAY as "enable these tags" (`features[tag] = true`),
 * so a list of "-liga" strings would enable a nonexistent feature rather than disable
 * anything. Only the object form can switch one off.
 *
 * pdfkit's toUnicodeCmap joins a multi-codepoint glyph's characters with a SPACE —
 * emitting <0066 0069> for the "fi" ligature, where a bfrange destination must be one
 * contiguous hex string. Readers take only the first value, so the PDF's text layer
 * reads "fnal", "fnd" and "fle". The glyphs draw correctly; only copy, paste and search
 * are wrong. Turning ligatures off means no multi-codepoint glyph is ever emitted, which
 * sidesteps the bug without patching pdfkit.
 */
export const FONT_FEATURES = {
  liga: false,
  dlig: false,
  clig: false,
  hlig: false,
  rlig: false,
} as const

/** Points → half-points, the unit docx uses for font sizes. */
export const halfPoints = (points: number): number => Math.round(points * 2)

/** Points → twips, the unit docx uses for lengths. */
export const twips = (points: number): number => Math.round(points * 20)
