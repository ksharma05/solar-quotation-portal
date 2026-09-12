import { fileURLToPath } from 'node:url'
import { describe, expect, it, beforeAll } from 'vitest'
import { buildDocumentModel } from '@/services/export/documentModel'
import { buildPdfDefinition } from '@/services/export/renderPdf'
import { extractTextLayer } from '@/services/export/pdfTextLayer'
import { defaultBomRows } from '@/constants/bomDefaults'
import { defaultMilestones } from '@/constants/milestones'
import { computeQuotation } from '@/services/pricing/quotationEngine'

/**
 * Guards the PDF's text layer.
 *
 * The reference words "final", "find" and "file" all contain "fi", which a font's
 * ligature substitution replaces with a single glyph. pdfkit's toUnicodeCmap then writes
 * that glyph's destination as <0066 0069> — with a space, where a bfrange destination
 * must be one contiguous hex string. Readers take only the first value, so the document
 * renders correctly but copies and searches as "fnal", "fnd" and "fle".
 *
 * layoutSpec.FONT_FEATURES disables ligature substitution to sidestep it. This test
 * fails if that ever regresses.
 */

const nodeOnly = typeof process !== 'undefined' && Boolean(process.versions?.node)

async function renderSamplePdf(): Promise<Buffer> {
  const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url))
  const robotoDir = `${repoRoot}frontend/node_modules/pdfmake/build/fonts/Roboto/`
  const tinosDir = `${repoRoot}frontend/node_modules/@expo-google-fonts/tinos/`

  const pdfmake = (await import('pdfmake')).default as unknown as {
    addFonts: (fonts: Record<string, Record<string, string>>) => void
    setLocalAccessPolicy: (callback: (path: string) => boolean) => void
    setUrlAccessPolicy: (callback: (url: string) => boolean) => void
    createPdf: (definition: unknown) => { getBuffer: () => Promise<Buffer> }
  }

  pdfmake.addFonts({
    Tinos: {
      normal: `${tinosDir}400Regular/Tinos_400Regular.ttf`,
      bold: `${tinosDir}700Bold/Tinos_700Bold.ttf`,
      italics: `${tinosDir}400Regular_Italic/Tinos_400Regular_Italic.ttf`,
      bolditalics: `${tinosDir}700Bold_Italic/Tinos_700Bold_Italic.ttf`,
    },
    Roboto: {
      normal: `${robotoDir}Roboto-Regular.ttf`,
      bold: `${robotoDir}Roboto-Medium.ttf`,
      italics: `${robotoDir}Roboto-Italic.ttf`,
      bolditalics: `${robotoDir}Roboto-MediumItalic.ttf`,
    },
  })
  pdfmake.setLocalAccessPolicy(
    (path) => path.startsWith(robotoDir) || path.startsWith(tinosDir)
  )
  pdfmake.setUrlAccessPolicy(() => false)

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
    ...computeQuotation({
      capacityWp: 10_280,
      ratePerWatt: 373_116 / 10_280,
      subsidyAmount: 78_000,
    }),
    ratePerWatt: 373_116 / 10_280,
  }

  const model = buildDocumentModel(quotation, totals, [])
  return pdfmake.createPdf(buildPdfDefinition(model)).getBuffer()
}

describe.runIf(nodeOnly)('PDF text layer', () => {
  let layer: ReturnType<typeof extractTextLayer>

  beforeAll(async () => {
    layer = extractTextLayer(await renderSamplePdf())
  }, 60_000)

  it('emits no ToUnicode destination containing whitespace', () => {
    expect(layer.malformedEntries).toBe(0)
  })

  it('copies and searches "final" correctly, not "fnal"', () => {
    // "…on successful final commissioning of Project." — a milestone description.
    expect(layer.text).toMatch(/final/i)
    expect(layer.text).not.toMatch(/\bfnal\b/i)
  })

  it('does not corrupt any other fi word', () => {
    for (const broken of [/\bfnd\b/i, /\bfle\b/i, /\bbenet\b/i]) {
      expect(layer.text).not.toMatch(broken)
    }
  })

  it('carries the rupee sign through to the text layer', () => {
    expect(layer.text).toContain('₹')
  })
})
