/**
 * Renders the document model to PDF with pdfmake.
 *
 * Every geometry value comes from layoutSpec.ts and every photo dimension from
 * imageGrid.ts, so this file and renderDocx.ts stay visually identical by construction.
 * Nothing here decides layout on its own.
 *
 * Calibrated against "Anil Bh Interior 10 kw.pdf".
 */

import type { Content, TDocumentDefinitions, TableCell } from 'pdfmake/interfaces'
import { LOGO, SIGNATURE, dataUri } from '@/services/export/brandAssets'
import { packImageGrid, toDataUri } from '@/services/export/imageGrid'
import {
  CLIENT_BOX,
  CONTENT_WIDTH,
  COLORS,
  FONT,
  FONT_FEATURES,
  IMAGE_GRID,
  LETTERHEAD,
  PAGE,
  SPACING,
  TABLE_WIDTHS,
  companyWordmark,
  pdfColumnWidths,
} from '@/services/export/layoutSpec'
import { captionHeight, paginateProjects } from '@/services/export/documentModel'
import type {
  DocCell,
  DocumentModel,
  ProjectSlot,
  RichRun,
  Section,
} from '@/services/export/documentModel'

/** Fully ruled cells, as the reference prints its tables. */
const TABLE_LAYOUT = {
  hLineWidth: () => 0.75,
  vLineWidth: () => 0.75,
  hLineColor: () => COLORS.tableBorder,
  vLineColor: () => COLORS.tableBorder,
  paddingLeft: () => SPACING.tableCellPaddingX,
  paddingRight: () => SPACING.tableCellPaddingX,
  paddingTop: () => SPACING.tableCellPaddingY,
  paddingBottom: () => SPACING.tableCellPaddingY,
  fillColor: (rowIndex: number): string | null => (rowIndex === 0 ? COLORS.tableHeaderBg : null),
}

const NO_BORDER_LAYOUT = {
  hLineWidth: () => 0,
  vLineWidth: () => 0,
  paddingLeft: () => 0,
  paddingRight: () => 0,
  paddingTop: () => 0,
  paddingBottom: () => 0,
}

/** Section headings keep the display face, in olive green, exactly as authored. */
function heading(text: string): Content {
  return {
    text,
    font: FONT.display,
    fontSize: FONT.heading,
    bold: true,
    color: COLORS.heading,
    margin: [0, SPACING.sectionBefore, 0, SPACING.headingAfter],
  }
}

/** Stacked lines of runs inside one table cell. */
function cellContent(cell: DocCell, fontSize: number): { stack: Content[] } {
  return {
    stack: cell.lines.map<Content>((runs) => ({
      text: runs.map((run) => ({ text: run.text, bold: run.bold })),
      fontSize,
    })),
  }
}

function dataTable(section: Extract<Section, { type: 'priceTable' | 'bomTable' }>): Content[] {
  const widths = pdfColumnWidths([...TABLE_WIDTHS[section.type === 'priceTable' ? 'price' : 'bom']])

  const headerCells: TableCell[] = section.header.map((label, column) => ({
    text: label,
    font: FONT.display,
    bold: true,
    fontSize: FONT.table,
    color: COLORS.tableHeaderText,
    alignment: section.align[column] ?? 'left',
  }))

  const bodyRows: TableCell[][] = section.rows.map((row) =>
    row.map((cell, column) => {
      // A cell absorbed by a merge above must still be present, but empty: pdfmake
      // skips it because the origin cell's rowSpan already covers this position.
      if (cell.mergedAbove) return {}
      return {
        ...cellContent(cell, FONT.table),
        alignment: section.align[column] ?? 'left',
        ...(cell.rowSpan && cell.rowSpan > 1 ? { rowSpan: cell.rowSpan } : {}),
      }
    })
  )

  return [
    heading(section.heading),
    {
      table: {
        widths,
        // Repeats on every page, so a BOM that outgrows its page stays readable.
        headerRows: 1,
        body: [headerCells, ...bodyRows],
      },
      layout: TABLE_LAYOUT,
    },
  ]
}

/**
 * One project: photographs, then an italic olive caption.
 *
 * Each grid row is marked unbreakable, so a row of photographs is never split across a
 * page. The last row and the caption travel together, so a caption is never orphaned
 * away from the photographs it labels.
 */
function projectBlock(slot: ProjectSlot): Content[] {
  const project = slot.project
  const rows = packImageGrid(slot.images, { budget: slot.budget - captionHeight(project) })

  const captionLine = (label: string, value: string): Content => ({
    text: `${label}${value}`,
    font: FONT.serif,
    fontSize: FONT.caption,
    italics: true,
    color: COLORS.caption,
  })

  const caption: Content[] = [
    Object.assign(captionLine('Project Name:  ', project.name), {
      margin: [0, rows.length > 0 ? 4 : SPACING.sectionBefore, 0, 0],
    }) as Content,
  ]

  if (project.capacity) caption.push(captionLine('Project Capacity:  ', project.capacity))

  if (project.description) {
    caption.push({
      text: project.description,
      font: FONT.serif,
      fontSize: FONT.small,
      italics: true,
      color: COLORS.caption,
      margin: [0, 2, 0, 0],
    })
  }

  const pageBreak = slot.pageBreakBefore ? { pageBreak: 'before' as const } : {}

  if (rows.length === 0) {
    return [Object.assign({ stack: caption, unbreakable: true }, pageBreak) as Content]
  }

  const gridRows: Content[] = rows.map((row) => ({
    unbreakable: true,
    margin: [0, 0, 0, IMAGE_GRID.rowGap],
    columnGap: IMAGE_GRID.gutter,
    columns: row.cells.map((cell) => ({
      width: cell.tileWidth,
      image: toDataUri(cell.image),
      fit: [cell.width, cell.height] as [number, number],
      alignment: 'center' as const,
      // pdfmake columns have no vertical alignment, so the leftover inside the tile is
      // split into margins above and below — which also makes the column reserve the
      // whole tile, exactly as the DOCX row's fixed height does.
      margin: [0, (cell.tileHeight - cell.height) / 2, 0, (cell.tileHeight - cell.height) / 2] as [
        number,
        number,
        number,
        number,
      ],
    })),
  }))

  const leading = gridRows.slice(0, -1)
  const trailing: Content = {
    stack: [gridRows[gridRows.length - 1], ...caption],
    unbreakable: true,
    margin: [0, 0, 0, SPACING.sectionBefore],
  }

  if (leading.length === 0) return [Object.assign(trailing, pageBreak) as Content]
  return [Object.assign({}, leading[0], pageBreak) as Content, ...leading.slice(1), trailing]
}

/** The cover letterhead: centred logo, company name, two contact rows, green rule. */
function letterhead(company: Extract<Section, { type: 'letterhead' }>['company']): Content[] {
  const detail = (text: string, alignment: 'left' | 'right'): TableCell => ({
    text,
    font: FONT.serif,
    fontSize: FONT.companyDetail,
    alignment,
    color: COLORS.ink,
  })

  return [
    {
      image: dataUri(LOGO),
      fit: [LETTERHEAD.logoWidth, LETTERHEAD.logoWidth],
      alignment: 'center',
      margin: [0, 0, 0, LETTERHEAD.spaceAfterLogo],
    },
    {
      text: companyWordmark(company.name).map((segment) => ({
        text: segment.text,
        color: segment.color,
      })),
      font: FONT.serif,
      fontSize: FONT.companyName,
      bold: true,
      alignment: 'center',
      margin: [0, 0, 0, LETTERHEAD.spaceAfterName],
    },
    {
      table: {
        widths: pdfColumnWidths([null, null]),
        body: [
          [detail(company.email, 'left'), detail(company.address, 'right')],
          [detail(company.phone, 'left'), detail(`GSTIN: ${company.gstin}`, 'right')],
        ],
      },
      layout: NO_BORDER_LAYOUT,
    },
    {
      canvas: [
        {
          type: 'line',
          x1: 0,
          y1: 4,
          x2: CONTENT_WIDTH,
          y2: 4,
          lineWidth: LETTERHEAD.ruleThickness,
          lineColor: COLORS.rule,
        },
      ],
      margin: [0, 0, 0, LETTERHEAD.spaceAfterRule],
    },
  ]
}

function renderSection(section: Section): Content[] {
  switch (section.type) {
    case 'letterhead':
      return letterhead(section.company)

    case 'title': {
      const boxText = (runs: RichRun[], alignment: 'left' | 'right'): TableCell => ({
        text: runs.map((run) => ({ text: run.text, bold: run.bold })),
        font: FONT.serif,
        fontSize: FONT.body,
        alignment,
      })

      return [
        // Painted first and then covered by the panel: pdfmake has no table background,
        // so the gradient is a canvas the table is pulled back over by a negative margin.
        {
          canvas: [
            {
              type: 'rect',
              x: 0,
              y: 0,
              w: CONTENT_WIDTH,
              h: CLIENT_BOX.height,
              linearGradient: [...CLIENT_BOX.gradient],
            },
          ],
        },
        {
          table: {
            // A fixed label column is what lines the location up under the client's name.
            widths: pdfColumnWidths(
              [CLIENT_BOX.labelWidth, null, CONTENT_WIDTH / 2],
              CONTENT_WIDTH,
              SPACING.clientBoxPadding
            ),
            body: [
              [
                {
                  text: section.heading,
                  font: FONT.serif,
                  fontSize: FONT.title,
                  bold: true,
                  alignment: 'center',
                  color: COLORS.ink,
                  decoration: 'underline',
                  colSpan: 3,
                },
                {},
                {},
              ],
              [
                boxText([{ text: 'CLIENT:', bold: true }], 'left'),
                boxText([{ text: section.client }], 'left'),
                boxText([{ text: 'DATE:  ', bold: true }, { text: section.date }], 'right'),
              ],
              [
                {},
                boxText([{ text: section.location }], 'left'),
                boxText(
                  [{ text: 'Quotation No. :  ', bold: true }, { text: section.quotationNumber }],
                  'right'
                ),
              ],
            ],
          },
          layout: {
            // Rule only around the outside, so the block reads as one panel. The counts
            // are literal because the block is always three rows by three columns.
            hLineWidth: (index: number) => (index === 0 || index === 3 ? 1 : 0),
            vLineWidth: (index: number) => (index === 0 || index === 3 ? 1 : 0),
            hLineColor: () => COLORS.clientBoxBorder,
            vLineColor: () => COLORS.clientBoxBorder,
            paddingLeft: () => SPACING.clientBoxPadding,
            paddingRight: () => SPACING.clientBoxPadding,
            paddingTop: () => SPACING.tableCellPaddingY,
            paddingBottom: () => SPACING.tableCellPaddingY,
            // Transparent: the gradient below shows through.
            fillColor: () => null,
          },
          margin: [0, -CLIENT_BOX.height, 0, SPACING.sectionBefore],
        },
      ]
    }

    case 'coverLetter': {
      const content: Content[] = [
        {
          text: section.salutation,
          font: FONT.serif,
          fontSize: FONT.body,
          margin: [0, 0, 0, SPACING.paragraph],
        },
        ...section.paragraphs.map<Content>((paragraph) => ({
          text: paragraph,
          font: FONT.serif,
          fontSize: FONT.body,
          alignment: 'justify',
          lineHeight: 1.3,
          margin: [0, 0, 0, SPACING.paragraph],
        })),
        {
          text: section.closing,
          font: FONT.serif,
          fontSize: FONT.body,
          margin: [0, 0, 0, SPACING.sectionBefore],
        },
        ...section.signOff.map<Content>((text) => ({
          text,
          font: FONT.serif,
          fontSize: FONT.body,
          margin: [0, 0, 0, 1],
        })),
      ]

      if (section.hasSignature) {
        content.push({
          image: dataUri(SIGNATURE),
          fit: [110, 86],
          margin: [0, SPACING.paragraph, 0, 0],
        })
      }

      content.push(
        { text: section.signatory, font: FONT.serif, fontSize: FONT.body, bold: true },
        { text: section.signatoryPhone, font: FONT.serif, fontSize: FONT.body, bold: true }
      )
      return content
    }

    case 'priceTable':
    case 'bomTable':
      return dataTable(section)

    // Free-standing bold red paragraphs — no box, border or fill.
    case 'subsidyNote':
      return section.lines.map<Content>((text, index) => ({
        text,
        font: FONT.serif,
        fontSize: FONT.body,
        bold: true,
        color: COLORS.red,
        margin: [0, index === 0 ? SPACING.sectionBefore : SPACING.paragraph, 0, 0],
      }))

    case 'bullets':
      return [
        heading(section.heading),
        {
          // Colour is per item, so the validity line is red while the rest stay black.
          ul: section.items.map((item) => ({
            text: item.text,
            font: FONT.serif,
            fontSize: FONT.body,
            color: item.red ? COLORS.red : COLORS.ink,
          })),
          lineHeight: 1.25,
        },
      ]

    case 'milestones':
      return [
        heading(section.heading),
        {
          table: {
            widths: pdfColumnWidths([44, null, 100]),
            body: section.items.map((item) => [
              { text: `${item.percentage}%`, font: FONT.serif, fontSize: FONT.body, bold: true },
              { text: item.description, font: FONT.serif, fontSize: FONT.body },
              {
                text: item.amountFormatted,
                font: FONT.serif,
                fontSize: FONT.body,
                alignment: 'right',
              },
            ]),
          },
          layout: TABLE_LAYOUT,
        },
      ]

    case 'definitions':
      return [
        heading(section.heading),
        {
          ul: section.items.map((item) => ({
            // Lead-in bold BLACK, not green; emphasis inside the body is inline.
            text: [
              { text: `${item.title}: `, bold: true },
              ...item.body.map((run) => ({ text: run.text, bold: run.bold })),
            ],
            font: FONT.serif,
            fontSize: FONT.body,
            alignment: 'justify',
          })),
          lineHeight: 1.25,
        },
      ]

    case 'projects':
      return [heading(section.heading), ...paginateProjects(section.items).flatMap(projectBlock)]
  }
}

export function buildPdfDefinition(model: DocumentModel): TDocumentDefinitions {
  const letterheadSection = model.sections.find((section) => section.type === 'letterhead')
  const company = letterheadSection?.type === 'letterhead' ? letterheadSection.company : null

  const content: Content[] = model.sections.flatMap((section) => {
    const rendered = renderSection(section)
    if (rendered.length > 0 && section.pageBreakBefore) {
      rendered[0] = Object.assign({}, rendered[0], { pageBreak: 'before' }) as Content
    }
    return rendered
  })

  return {
    pageSize: 'A4',
    pageMargins: [PAGE.marginX, PAGE.marginTop, PAGE.marginX, PAGE.marginBottom],
    defaultStyle: {
      font: FONT.serif,
      fontSize: FONT.body,
      color: COLORS.ink,
      // See FONT_FEATURES in layoutSpec: keeps the PDF's text layer searchable.
      // pdfmake types this as a tag array, but passes it straight to fontkit, which
      // also accepts the object form — the only form that can DISABLE a feature.
      fontFeatures: FONT_FEATURES as unknown as TDocumentDefinitions['defaultStyle'] extends {
        fontFeatures?: infer F
      }
        ? F
        : never,
    },
    info: { title: 'Quotation', author: company?.name ?? '' },
    // The reference has no running header and no page footer, so neither does this.
    content,
  }
}
