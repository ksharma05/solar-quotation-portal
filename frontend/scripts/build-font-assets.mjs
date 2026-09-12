/**
 * Regenerates src/services/export/fontAssets.ts from the Roboto files pdfmake ships.
 *
 * The DOCX embeds the same typeface the PDF does, so the two documents are not merely
 * laid out alike but set in the same font — without depending on what is installed on
 * the reader's machine. Roboto is Apache-2.0, so redistributing it this way is fine.
 *
 * Run: node scripts/build-font-assets.mjs
 */
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const robotoDir = fileURLToPath(new URL('../node_modules/pdfmake/build/fonts/Roboto/', import.meta.url))
const tinosDir = fileURLToPath(new URL('../node_modules/@expo-google-fonts/tinos/', import.meta.url))
const out = fileURLToPath(new URL('../src/services/export/fontAssets.ts', import.meta.url))

const read = (path) => readFileSync(path).toString('base64')
const tinos = read(tinosDir + '400Regular/Tinos_400Regular.ttf')
const roboto = read(robotoDir + 'Roboto-Medium.ttf')

writeFileSync(
  out,
  `/**
 * GENERATED FILE — do not edit by hand.
 * Regenerate with: node scripts/build-font-assets.mjs
 *
 * Embedded into the DOCX so Word renders the same faces the PDF embeds:
 *  - Tinos (Apache-2.0) for body text. Metric-compatible with Times New Roman, so a
 *    fallback to Times lays out identically.
 *  - Roboto Medium (Apache-2.0) for section headings.
 *
 * Imported dynamically by renderDocx.ts, so the weight is only paid on export.
 */

/** Raw base64 TrueType, no data: prefix. */
export const TINOS_REGULAR_BASE64 =
  '${tinos}'

export const ROBOTO_MEDIUM_BASE64 =
  '${roboto}'

/** base64 -> bytes, working in both the browser and Node. */
export function decodeFont(base64: string): Uint8Array {
  if (typeof atob === 'function') {
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index)
    return bytes
  }
  return new Uint8Array(Buffer.from(base64, 'base64'))
}
`,
  'utf8'
)

// The PDF renderer needs all four Tinos faces so bold and italic are real rather than
// synthesised. They are copied to public/ and fetched at export time: a static .ttf is
// browser-cached and ~33% smaller than the same bytes inlined as base64 in a JS chunk.
const publicFonts = fileURLToPath(new URL('../public/fonts/', import.meta.url))
mkdirSync(publicFonts, { recursive: true })

const FACES = [
  ['400Regular/Tinos_400Regular.ttf', 'Tinos-Regular.ttf'],
  ['700Bold/Tinos_700Bold.ttf', 'Tinos-Bold.ttf'],
  ['400Regular_Italic/Tinos_400Regular_Italic.ttf', 'Tinos-Italic.ttf'],
  ['700Bold_Italic/Tinos_700Bold_Italic.ttf', 'Tinos-BoldItalic.ttf'],
]

for (const [source, target] of FACES) {
  copyFileSync(tinosDir + source, publicFonts + target)
}

console.log(`copied ${FACES.length} Tinos faces to public/fonts/`)

console.log(
  `fontAssets.ts written — Tinos ${(tinos.length / 1024).toFixed(0)}KB, Roboto Medium ${(roboto.length / 1024).toFixed(0)}KB (base64)`
)
