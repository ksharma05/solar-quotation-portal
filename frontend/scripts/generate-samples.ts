/**
 * Generates a sample PDF and DOCX from the real renderers, with no Google credentials
 * and no browser.
 *
 * This is the fastest way to review a layout change: it drives exactly the code the app
 * ships, using the Anil 10.28 kW fixture from documentModel.test.ts and photographs from
 * assets/projects/.
 *
 * Run: npx vite-node scripts/generate-samples.ts [outputDir]
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { Packer } from 'docx'
import { defaultBomRows } from '@/constants/bomDefaults'
import { defaultMilestones } from '@/constants/milestones'
import { computeQuotation } from '@/services/pricing/quotationEngine'
import { systemBomRows } from '@/services/quotation/documentBom'
import {
  buildDocumentModel,
  quotationFileName,
  type ExportImage,
  type ResolvedProject,
} from '@/services/export/documentModel'
import { buildDocxDocument, loadEmbeddedFonts } from '@/services/export/renderDocx'
import { buildPdfDefinition } from '@/services/export/renderPdf'

const repoRoot = fileURLToPath(new URL('../../', import.meta.url))
const outputDir = process.argv[2] ?? fileURLToPath(new URL('../../samples/', import.meta.url))

/**
 * Natural pixel dimensions, straight out of the file header.
 *
 * In the browser this comes from createImageBitmap; here the headers are parsed
 * directly, so the sample and the app scale photographs identically.
 */
function imageSize(buffer: Buffer): { width: number; height: number } | null {
  // PNG: IHDR width/height are big-endian uint32 at bytes 16 and 20.
  if (buffer.readUInt32BE(0) === 0x89504e47) {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) }
  }

  // JPEG: walk the segment chain to the SOFn frame header, which carries the size.
  if (buffer.readUInt16BE(0) === 0xffd8) {
    let offset = 2
    while (offset < buffer.length - 9) {
      if (buffer[offset] !== 0xff) {
        offset++
        continue
      }
      const marker = buffer[offset + 1]
      const length = buffer.readUInt16BE(offset + 2)
      // SOF0-SOF15, excluding the non-frame markers DHT (c4), JPGA (c8) and DAC (cc).
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) }
      }
      offset += 2 + length
    }
  }

  return null
}

/** Loads one photograph. A file that is missing or undecodable is skipped, never fatal. */
function loadImage(relativePath: string): ExportImage | null {
  try {
    const buffer = readFileSync(repoRoot + relativePath)
    const size = imageSize(buffer)
    if (!size) {
      console.warn(`  skipped ${relativePath}: unrecognised image format`)
      return null
    }
    return {
      id: relativePath,
      base64: buffer.toString('base64'),
      mimeType: relativePath.endsWith('.png') ? 'image/png' : 'image/jpeg',
      ...size,
    }
  } catch (error) {
    console.warn(`  skipped ${relativePath}: ${(error as Error).message}`)
    return null
  }
}

function project(
  id: string,
  name: string,
  capacity: string,
  description: string,
  files: string[]
): ResolvedProject {
  return {
    id,
    name,
    capacity,
    description,
    images: files
      .map((file) => loadImage(`assets/projects/${file}`))
      .filter((image): image is ExportImage => image !== null),
  }
}

const quotation = {
  leadName: 'Anil Bhaiya Ji',
  projectName: 'Ajmer, Rajasthan',
  quotationNumber: 'SGT/2026/04/B21',
  quotationDate: '2026-04-14',
  validityDays: 10,
  inverterKw: 10,
  milestones: defaultMilestones(10.28),
  bom: [
    // The real Anil job mixes two panel types to reach 10,280 Wp — 7 x 590 + 10 x 615.
    // A single type cannot express that capacity, and the BOM must agree with the
    // priced row.
    ...systemBomRows(
      [
        { panelId: 'waaree-dcr-590', count: 7 },
        { panelId: 'waaree-ndcr-615', count: 10 },
      ],
      'sungrow-10'
    ),
    ...defaultBomRows(10.28),
  ],
}

const totals = {
  ...computeQuotation({
    capacityWp: 10_280,
    ratePerWatt: 373_116 / 10_280,
    subsidyAmount: 78_000,
  }),
  ratePerWatt: 373_116 / 10_280,
}

// Deliberately exercises all three edge cases in one document: photographs present,
// a project with none, and a file that does not exist.
const projects: ResolvedProject[] = [
  project(
    'mayo',
    'EPC — Mayo College Girls School, Ajmer',
    '300 KW',
    'Rooftop grid-tied installation across three academic blocks, commissioned without disrupting term time.',
    ['image6.jpeg', 'image7.jpeg', 'image8.jpeg']
  ),
  project(
    'saras',
    'EPC — SARAS Cattle Feed Dairy, Ajmer',
    '600 KW',
    'Industrial rooftop plant offsetting the dairy’s daytime process load.',
    ['image9.jpeg', 'image10.jpeg', 'image11.jpeg', 'image12.jpeg']
  ),
  project(
    'missing-file',
    'INC — Vidhan Sabha, Jaipur',
    '600 KW',
    'Consultancy and commissioning support. This entry references one missing file on purpose — the export must skip it.',
    ['image16.png', 'does-not-exist.jpeg']
  ),
  project(
    'no-photos',
    'EPC — Mahaveer Group, Palra Industrial Area, Ajmer',
    '490 KW',
    'This project has no photographs on file. It must be OMITTED from the document — a caption alone would hold down half a page of white space.',
    []
  ),
]

async function main(): Promise<void> {
  mkdirSync(outputDir, { recursive: true })
  console.log('Loading photographs…')
  const model = buildDocumentModel(quotation, totals, projects)

  // --- DOCX ---
  const docxName = quotationFileName(quotation, 'docx')
  const docxBuffer = await Packer.toBuffer(buildDocxDocument(model, await loadEmbeddedFonts()))
  writeFileSync(outputDir + docxName, docxBuffer)
  console.log(`DOCX  ${docxName}  ${(docxBuffer.length / 1024).toFixed(0)} KB`)

  // --- PDF ---
  // pdfmake reads fonts and embedded data URIs from disk here rather than from a
  // browser VFS; both policies are scoped to this script only.
  const pdfmake = (await import('pdfmake')).default as unknown as {
    addFonts: (fonts: Record<string, Record<string, string>>) => void
    setLocalAccessPolicy: (callback: (path: string) => boolean) => void
    setUrlAccessPolicy: (callback: (url: string) => boolean) => void
    createPdf: (definition: unknown) => { getBuffer: () => Promise<Buffer> }
  }

  const robotoDir = repoRoot + 'frontend/node_modules/pdfmake/build/fonts/Roboto/'
  const tinosDir = repoRoot + 'frontend/node_modules/@expo-google-fonts/tinos/'
  pdfmake.addFonts({
    // Body text. Tinos is metric-compatible with Times New Roman.
    Tinos: {
      normal: tinosDir + '400Regular/Tinos_400Regular.ttf',
      bold: tinosDir + '700Bold/Tinos_700Bold.ttf',
      italics: tinosDir + '400Regular_Italic/Tinos_400Regular_Italic.ttf',
      bolditalics: tinosDir + '700Bold_Italic/Tinos_700Bold_Italic.ttf',
    },
    // Section headings.
    Roboto: {
      normal: robotoDir + 'Roboto-Regular.ttf',
      bold: robotoDir + 'Roboto-Medium.ttf',
      italics: robotoDir + 'Roboto-Italic.ttf',
      bolditalics: robotoDir + 'Roboto-MediumItalic.ttf',
    },
  })
  pdfmake.setLocalAccessPolicy((path) => path.startsWith(robotoDir) || path.startsWith(tinosDir))
  pdfmake.setUrlAccessPolicy(() => false)

  const pdfName = quotationFileName(quotation, 'pdf')
  const pdfBuffer = await pdfmake.createPdf(buildPdfDefinition(model)).getBuffer()
  writeFileSync(outputDir + pdfName, pdfBuffer)
  console.log(`PDF   ${pdfName}  ${(pdfBuffer.length / 1024).toFixed(0)} KB`)

  console.log(`\nWritten to ${outputDir}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
