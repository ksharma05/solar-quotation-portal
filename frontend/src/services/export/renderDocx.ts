/**
 * Renders the document model to DOCX with the `docx` library.
 *
 * Deliberately a section-for-section mirror of renderPdf.ts: same order, same headings,
 * same table columns, same photo grid, every measurement read from layoutSpec.ts. If a
 * section is added to one renderer it must be added to the other, and the shared model
 * is what makes that omission visible.
 *
 * Calibrated against "Anil Bh Interior 10 kw.pdf".
 */

import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  HeightRule,
  ImageRun,
  LineRuleType,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  VerticalMergeType,
  WidthType,
  type ISectionOptions,
} from 'docx'
import { COMPANY } from '@/constants/config'
import { LOGO, SIGNATURE, type BrandAsset } from '@/services/export/brandAssets'
import { packImageGrid } from '@/services/export/imageGrid'
import {
  CLIENT_BOX,
  COLORS,
  CONTENT_WIDTH,
  FONT,
  IMAGE_GRID,
  LETTERHEAD,
  PAGE,
  SPACING,
  TABLE_WIDTHS,
  companyWordmark,
  halfPoints,
  resolveWidths,
  twips,
} from '@/services/export/layoutSpec'
import { captionHeight, paginateProjects } from '@/services/export/documentModel'
import type {
  CellAlign,
  DocCell,
  DocumentModel,
  ExportImage,
  ProjectSlot,
  RichRun,
  Section,
} from '@/services/export/documentModel'

/** docx expresses image extents in pixels at 96dpi; the layout spec is in points. */
const pxFromPt = (points: number): number => Math.round((points * 96) / 72)

/** docx wants colours without the leading hash. */
const hex = (color: string): string => color.replace('#', '')

const ALIGN: Record<CellAlign, (typeof AlignmentType)[keyof typeof AlignmentType]> = {
  left: AlignmentType.LEFT,
  right: AlignmentType.RIGHT,
  center: AlignmentType.CENTER,
}

type ImageType = 'png' | 'jpg' | 'gif' | 'bmp'

function imageType(mimeType: string): ImageType {
  if (/png/i.test(mimeType)) return 'png'
  if (/gif/i.test(mimeType)) return 'gif'
  if (/bmp/i.test(mimeType)) return 'bmp'
  return 'jpg'
}

function imageRun(asset: BrandAsset | ExportImage, width: number, height: number): ImageRun {
  return new ImageRun({
    type: imageType(asset.mimeType),
    data: asset.base64,
    transformation: { width: pxFromPt(width), height: pxFromPt(height) },
  })
}

interface RunStyle {
  size?: number
  bold?: boolean
  italics?: boolean
  underline?: boolean
  color?: string
  font?: string
}

function run(text: string, style: RunStyle = {}): TextRun {
  return new TextRun({
    text,
    bold: style.bold,
    italics: style.italics,
    // An empty object is docx's "default single underline".
    underline: style.underline ? {} : undefined,
    size: halfPoints(style.size ?? FONT.body),
    color: hex(style.color ?? COLORS.ink),
    font: style.font ?? FONT.serif,
  })
}

interface ParagraphStyle extends RunStyle {
  align?: CellAlign | 'justify'
  spaceBefore?: number
  spaceAfter?: number
  keepNext?: boolean
  pageBreakBefore?: boolean
  line?: number
}

function paragraph(children: TextRun[], style: ParagraphStyle = {}): Paragraph {
  return new Paragraph({
    alignment:
      style.align === 'justify'
        ? AlignmentType.JUSTIFIED
        : style.align
          ? ALIGN[style.align]
          : undefined,
    keepNext: style.keepNext,
    pageBreakBefore: style.pageBreakBefore,
    spacing: {
      before: twips(style.spaceBefore ?? 0),
      after: twips(style.spaceAfter ?? SPACING.paragraph),
      line: style.line,
    },
    children,
  })
}

const text = (content: string, style: ParagraphStyle = {}): Paragraph =>
  paragraph([run(content, style)], style)

/** Section headings keep the display face, in olive green, exactly as authored. */
function heading(label: string, pageBreakBefore = false): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    pageBreakBefore,
    // Never leave a heading stranded at the foot of a page.
    keepNext: true,
    spacing: { before: twips(SPACING.sectionBefore), after: twips(SPACING.headingAfter) },
    children: [
      run(label, { bold: true, size: FONT.heading, color: COLORS.heading, font: FONT.display }),
    ],
  })
}

const NONE = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }

/** Layout tables — the letterhead contact row and the photo grid — carry no rules. */
const NO_BORDERS = {
  top: NONE,
  bottom: NONE,
  left: NONE,
  right: NONE,
  insideHorizontal: NONE,
  insideVertical: NONE,
}

const RULE = { style: BorderStyle.SINGLE, size: 6, color: hex(COLORS.tableBorder) }

/** Every cell fully ruled, as the reference prints its tables. */
const TABLE_BORDERS = {
  top: RULE,
  bottom: RULE,
  left: RULE,
  right: RULE,
  insideHorizontal: RULE,
  insideVertical: RULE,
}

const CELL_MARGINS = {
  top: twips(SPACING.tableCellPaddingY),
  bottom: twips(SPACING.tableCellPaddingY),
  left: twips(SPACING.tableCellPaddingX),
  right: twips(SPACING.tableCellPaddingX),
}

function simpleCell(
  content: string,
  width: number,
  options: { align?: CellAlign; bold?: boolean; fill?: string; size?: number; color?: string } = {}
): TableCell {
  return new TableCell({
    width: { size: twips(width), type: WidthType.DXA },
    shading: options.fill ? { fill: hex(options.fill) } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    margins: CELL_MARGINS,
    children: [
      paragraph([run(content, { bold: options.bold, size: options.size, color: options.color })], {
        align: options.align,
        spaceAfter: 0,
      }),
    ],
  })
}

/** A model cell: stacked lines of runs, honouring any vertical merge. */
function richCell(cell: DocCell, width: number, align: CellAlign, fontSize: number): TableCell {
  const merged = cell.mergedAbove
  return new TableCell({
    width: { size: twips(width), type: WidthType.DXA },
    verticalAlign: VerticalAlign.CENTER,
    margins: CELL_MARGINS,
    // vMerge is the OOXML equivalent of pdfmake's rowSpan: the origin cell declares
    // RESTART and every cell it absorbs declares CONTINUE.
    verticalMerge: merged
      ? VerticalMergeType.CONTINUE
      : cell.rowSpan && cell.rowSpan > 1
        ? VerticalMergeType.RESTART
        : undefined,
    children: merged
      ? [paragraph([], { spaceAfter: 0 })]
      : cell.lines.map((runs) =>
          paragraph(
            runs.map((item) => run(item.text, { bold: item.bold, size: fontSize })),
            { align, spaceAfter: 0 }
          )
        ),
  })
}

function dataTable(section: Extract<Section, { type: 'priceTable' | 'bomTable' }>): Table {
  const widths = resolveWidths([...TABLE_WIDTHS[section.type === 'priceTable' ? 'price' : 'bom']])

  const headerRow = new TableRow({
    // Repeats on every page, matching pdfmake's headerRows: 1.
    tableHeader: true,
    cantSplit: true,
    children: section.header.map((label, column) =>
      simpleCell(label, widths[column], {
        align: section.align[column],
        bold: true,
        fill: COLORS.tableHeaderBg,
        color: COLORS.tableHeaderText,
        size: FONT.table,
      })
    ),
  })

  const bodyRows = section.rows.map(
    (row) =>
      new TableRow({
        cantSplit: true,
        children: row.map((cell, column) =>
          richCell(cell, widths[column], section.align[column] ?? 'left', FONT.table)
        ),
      })
  )

  return new Table({
    width: { size: twips(CONTENT_WIDTH), type: WidthType.DXA },
    borders: TABLE_BORDERS,
    rows: [headerRow, ...bodyRows],
  })
}

/**
 * One project: photographs, then an italic olive caption.
 *
 * Each grid row is a single-row table with cantSplit — the DOCX equivalent of pdfmake's
 * `unbreakable`. The last row's paragraphs carry keepNext so the caption never orphans
 * away from the photographs it labels.
 */
/** The hairline gap between two photographs in a collage row. */
const gutterCell = (): TableCell =>
  new TableCell({
    width: { size: twips(IMAGE_GRID.gutter), type: WidthType.DXA },
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
    children: [new Paragraph({ spacing: { before: 0, after: 0 }, children: [] })],
  })

function projectBlock(slot: ProjectSlot): (Paragraph | Table)[] {
  const project = slot.project
  const rows = packImageGrid(slot.images, { budget: slot.budget - captionHeight(project) })
  const blocks: (Paragraph | Table)[] = []

  // OOXML has no pageBreakBefore on a table, so when a project leads with photographs
  // the break is carried by a zero-height paragraph in front of the first grid row.
  if (rows.length > 0 && slot.pageBreakBefore) {
    blocks.push(
      new Paragraph({
        pageBreakBefore: true,
        keepNext: true,
        spacing: { before: 0, after: 0, line: 1 },
        children: [],
      })
    )
  }

  rows.forEach((row, rowIndex) => {
    // Two adjacent tables would merge into one in Word, and an EXACT row height leaves
    // no room for a bottom margin, so the gutter between grid rows is its own paragraph.
    if (rowIndex > 0) {
      blocks.push(
        new Paragraph({
          keepNext: true,
          spacing: {
            before: 0,
            after: 0,
            line: twips(IMAGE_GRID.rowGap),
            lineRule: LineRuleType.EXACT,
          },
          children: [],
        })
      )
    }

    blocks.push(
      new Table({
        width: { size: twips(CONTENT_WIDTH), type: WidthType.DXA },
        borders: NO_BORDERS,
        rows: [
          new TableRow({
            cantSplit: true,
            // Every tile in a row is the same height, so the row reserves it and the
            // photograph is centred inside — matching the PDF's tile margins. ATLEAST
            // rather than EXACT: a rounded-up image must never be clipped by its row.
            height: { value: twips(row.height), rule: HeightRule.ATLEAST },
            children: row.cells.flatMap((gridCell, cellIndex) => [
              // An empty cell is the only way to put a real gutter between two tiles;
              // without it the slack would collect at the right edge instead.
              ...(cellIndex > 0 ? [gutterCell()] : []),
              new TableCell({
                width: { size: twips(gridCell.tileWidth), type: WidthType.DXA },
                verticalAlign: VerticalAlign.CENTER,
                margins: { top: 0, bottom: 0, left: 0, right: 0 },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 0, after: 0 },
                    keepNext: rowIndex === rows.length - 1,
                    children: [imageRun(gridCell.image, gridCell.width, gridCell.height)],
                  }),
                ],
              }),
            ]),
          }),
        ],
      })
    )
  })

  const caption = (content: string, last: boolean, size: number = FONT.caption): Paragraph =>
    text(content, {
      italics: true,
      color: COLORS.caption,
      size,
      spaceBefore: 0,
      spaceAfter: last ? SPACING.sectionBefore : 0,
    })

  blocks.push(
    text(`Project Name:  ${project.name}`, {
      italics: true,
      color: COLORS.caption,
      size: FONT.caption,
      spaceBefore: rows.length > 0 ? 4 : SPACING.sectionBefore,
      spaceAfter: 0,
      keepNext: Boolean(project.capacity || project.description),
      pageBreakBefore: rows.length === 0 && slot.pageBreakBefore,
    })
  )

  if (project.capacity) {
    blocks.push(caption(`Project Capacity:  ${project.capacity}`, !project.description))
  }
  // The PDF sets the description a size smaller than the other caption lines.
  if (project.description) blocks.push(caption(project.description, true, FONT.small))

  return blocks
}

/** The cover letterhead: centred logo, company name, two contact rows, green rule. */
function letterhead(
  company: Extract<Section, { type: 'letterhead' }>['company']
): (Paragraph | Table)[] {
  const logoHeight = (LETTERHEAD.logoWidth * LOGO.height) / LOGO.width
  const widths = resolveWidths([null, null])

  const detail = (content: string, width: number, align: CellAlign): TableCell =>
    new TableCell({
      width: { size: twips(width), type: WidthType.DXA },
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      children: [paragraph([run(content, { size: FONT.companyDetail })], { align, spaceAfter: 0 })],
    })

  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: twips(LETTERHEAD.spaceAfterLogo) },
      children: [imageRun(LOGO, LETTERHEAD.logoWidth, logoHeight)],
    }),
    paragraph(
      companyWordmark(company.name).map((segment) =>
        run(segment.text, { size: FONT.companyName, bold: true, color: segment.color })
      ),
      { align: 'center', spaceAfter: LETTERHEAD.spaceAfterName }
    ),
    new Table({
      width: { size: twips(CONTENT_WIDTH), type: WidthType.DXA },
      borders: {
        ...NO_BORDERS,
        // The green rule under the letterhead.
        bottom: { style: BorderStyle.SINGLE, size: 12, color: hex(COLORS.rule) },
      },
      rows: [
        new TableRow({
          cantSplit: true,
          children: [
            detail(company.email, widths[0], 'left'),
            detail(company.address, widths[1], 'right'),
          ],
        }),
        new TableRow({
          cantSplit: true,
          children: [
            detail(company.phone, widths[0], 'left'),
            detail(`GSTIN: ${company.gstin}`, widths[1], 'right'),
          ],
        }),
      ],
    }),
    text('', { spaceAfter: LETTERHEAD.spaceAfterRule }),
  ]
}

function renderSection(section: Section): (Paragraph | Table)[] {
  const breaks = Boolean(section.pageBreakBefore)

  switch (section.type) {
    case 'letterhead':
      return letterhead(section.company)

    case 'title': {
      // A fixed label column is what lines the location up under the client's name.
      const widths = resolveWidths([CLIENT_BOX.labelWidth, null, CONTENT_WIDTH / 2])

      interface BoxCell {
        runs: RichRun[]
        width: number
        align: CellAlign
        style?: RunStyle
        columnSpan?: number
        pageBreakBefore?: boolean
      }

      const boxCell = ({ runs, width, align, style, columnSpan, pageBreakBefore }: BoxCell) =>
        new TableCell({
          width: { size: twips(width), type: WidthType.DXA },
          columnSpan,
          // OOXML shading has no gradient, so the DOCX panel is flat where the PDF's
          // is a gradient. Everything else about the two panels is identical.
          shading: { fill: hex(CLIENT_BOX.flatFill) },
          margins: {
            top: twips(SPACING.tableCellPaddingY),
            bottom: twips(SPACING.tableCellPaddingY),
            left: twips(SPACING.clientBoxPadding),
            right: twips(SPACING.clientBoxPadding),
          },
          children: [
            paragraph(
              runs.map((item) => run(item.text, { ...style, bold: item.bold ?? style?.bold })),
              { align, spaceAfter: 0, pageBreakBefore }
            ),
          ],
        })

      const boxBorder = { style: BorderStyle.SINGLE, size: 8, color: hex(COLORS.clientBoxBorder) }

      return [
        new Table({
          width: { size: twips(CONTENT_WIDTH), type: WidthType.DXA },
          // Outer rule only, so the block reads as one panel.
          borders: {
            top: boxBorder,
            bottom: boxBorder,
            left: boxBorder,
            right: boxBorder,
            insideHorizontal: NONE,
            insideVertical: NONE,
          },
          rows: [
            new TableRow({
              cantSplit: true,
              children: [
                boxCell({
                  runs: [{ text: section.heading, bold: true }],
                  width: CONTENT_WIDTH,
                  align: 'center',
                  style: { size: FONT.title, underline: true },
                  columnSpan: 3,
                  pageBreakBefore: breaks,
                }),
              ],
            }),
            new TableRow({
              cantSplit: true,
              children: [
                boxCell({
                  runs: [{ text: 'CLIENT:', bold: true }],
                  width: widths[0],
                  align: 'left',
                }),
                boxCell({ runs: [{ text: section.client }], width: widths[1], align: 'left' }),
                boxCell({
                  runs: [{ text: 'DATE:  ', bold: true }, { text: section.date }],
                  width: widths[2],
                  align: 'right',
                }),
              ],
            }),
            new TableRow({
              cantSplit: true,
              children: [
                boxCell({ runs: [], width: widths[0], align: 'left' }),
                boxCell({ runs: [{ text: section.location }], width: widths[1], align: 'left' }),
                boxCell({
                  runs: [
                    { text: 'Quotation No. :  ', bold: true },
                    { text: section.quotationNumber },
                  ],
                  width: widths[2],
                  align: 'right',
                }),
              ],
            }),
          ],
        }),
        text('', { spaceAfter: SPACING.sectionBefore }),
      ]
    }

    case 'coverLetter': {
      const blocks: (Paragraph | Table)[] = [
        text(section.salutation, { pageBreakBefore: breaks }),
        ...section.paragraphs.map((item) =>
          text(item, { align: 'justify', spaceAfter: SPACING.paragraph, line: 300 })
        ),
        text(section.closing, { spaceAfter: SPACING.sectionBefore }),
        ...section.signOff.map((item) => text(item, { spaceAfter: 0 })),
      ]

      if (section.hasSignature) {
        blocks.push(
          new Paragraph({
            spacing: { before: twips(SPACING.paragraph), after: 0 },
            children: [imageRun(SIGNATURE, 110, (110 * SIGNATURE.height) / SIGNATURE.width)],
          })
        )
      }

      blocks.push(
        text(section.signatory, { bold: true, spaceAfter: 0 }),
        text(section.signatoryPhone, { bold: true })
      )
      return blocks
    }

    case 'priceTable':
    case 'bomTable':
      return [heading(section.heading, breaks), dataTable(section)]

    // Free-standing bold red paragraphs — no box, border or fill.
    case 'subsidyNote':
      return section.lines.map((item, index) =>
        text(item, {
          bold: true,
          color: COLORS.red,
          spaceBefore: index === 0 ? SPACING.sectionBefore : SPACING.paragraph,
          spaceAfter: 0,
        })
      )

    case 'bullets':
      return [
        heading(section.heading, breaks),
        ...section.items.map(
          (item) =>
            new Paragraph({
              bullet: { level: 0 },
              spacing: { before: 0, after: twips(SPACING.listItem), line: 280 },
              // Colour is per item, so the validity line is red while the rest stay black.
              children: [run(item.text, { color: item.red ? COLORS.red : COLORS.ink })],
            })
        ),
      ]

    case 'milestones': {
      const widths = resolveWidths([44, null, 100])
      return [
        heading(section.heading, breaks),
        new Table({
          width: { size: twips(CONTENT_WIDTH), type: WidthType.DXA },
          borders: TABLE_BORDERS,
          rows: section.items.map(
            (item) =>
              new TableRow({
                cantSplit: true,
                children: [
                  simpleCell(`${item.percentage}%`, widths[0], { bold: true, size: FONT.body }),
                  simpleCell(item.description, widths[1], { size: FONT.body }),
                  simpleCell(item.amountFormatted, widths[2], {
                    size: FONT.body,
                    align: 'right',
                  }),
                ],
              })
          ),
        }),
      ]
    }

    case 'definitions':
      return [
        heading(section.heading, breaks),
        ...section.items.map(
          (item) =>
            new Paragraph({
              bullet: { level: 0 },
              alignment: AlignmentType.JUSTIFIED,
              spacing: { before: 0, after: twips(SPACING.paragraph), line: 280 },
              children: [
                // Lead-in bold BLACK, not green; emphasis inside the body is inline.
                run(`${item.title}: `, { bold: true }),
                ...item.body.map((part) => run(part.text, { bold: part.bold })),
              ],
            })
        ),
      ]

    case 'projects':
      return [
        heading(section.heading, breaks),
        ...paginateProjects(section.items).flatMap(projectBlock),
      ]
  }
}

/**
 * Fonts embedded so Word renders the same faces the PDF does rather than substituting.
 *
 * Dynamic so the base64 weight is only paid when someone actually exports a Word file.
 * Optional: if the bytes cannot be decoded the document still builds and Word falls
 * back, which must never cost the operator the export.
 */
export interface EmbeddedFont {
  name: string
  data: Uint8Array
}

export async function loadEmbeddedFonts(): Promise<EmbeddedFont[]> {
  try {
    const { TINOS_REGULAR_BASE64, ROBOTO_MEDIUM_BASE64, decodeFont } =
      await import('@/services/export/fontAssets')
    // One file per font name: OOXML's font table binds a single face to a name, so
    // embedding a second weight under the same name emits an ambiguous entry. Word
    // synthesises bold and italic from these.
    return [
      { name: FONT.serif, data: decodeFont(TINOS_REGULAR_BASE64) },
      { name: FONT.display, data: decodeFont(ROBOTO_MEDIUM_BASE64) },
    ]
  } catch (error) {
    console.warn('Could not embed the document fonts; Word will substitute.', error)
    return []
  }
}

export function buildDocxDocument(model: DocumentModel, fonts: EmbeddedFont[] = []): Document {
  const section: ISectionOptions = {
    properties: {
      page: {
        size: { width: twips(PAGE.width), height: twips(PAGE.height) },
        margin: {
          top: twips(PAGE.marginTop),
          bottom: twips(PAGE.marginBottom),
          left: twips(PAGE.marginX),
          right: twips(PAGE.marginX),
        },
      },
    },
    // No running header and no page footer, matching the reference.
    children: model.sections.flatMap(renderSection),
  }

  return new Document({
    creator: COMPANY.name,
    title: 'Quotation',
    // docx types this as Buffer; it only ever writes the bytes into the zip, so a
    // Uint8Array is what actually works in both the browser and Node.
    fonts: fonts.map((font) => ({ name: font.name, data: font.data as unknown as Buffer })),
    styles: {
      default: {
        document: { run: { font: FONT.serif, size: halfPoints(FONT.body) } },
      },
    },
    sections: [section],
  })
}

/** DOCX bytes, with the fonts embedded. */
export async function renderDocxBlob(model: DocumentModel): Promise<Blob> {
  return Packer.toBlob(buildDocxDocument(model, await loadEmbeddedFonts()))
}
