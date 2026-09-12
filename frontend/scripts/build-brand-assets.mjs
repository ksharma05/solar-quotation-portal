/**
 * Regenerates src/services/export/brandAssets.ts from the PNGs in ../assets.
 *
 * The logo and signature are inlined as base64 rather than fetched, because the two
 * exporters must produce identical bytes in the browser AND in Node (the sample and
 * snapshot scripts run headless, where no fetch of a Vite asset URL is possible).
 *
 * Run: node scripts/build-brand-assets.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../', import.meta.url))
const out = fileURLToPath(new URL('../src/services/export/brandAssets.ts', import.meta.url))

/** PNG IHDR carries width and height as big-endian uint32 at byte 16 and 20. */
function pngSize(buffer) {
  if (buffer.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG')
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) }
}

function asset(relativePath) {
  const buffer = readFileSync(root + relativePath)
  return { ...pngSize(buffer), base64: buffer.toString('base64') }
}

const logo = asset('assets/Logo.png')
const signature = asset('assets/signature.png')

const literal = (name, value) =>
  `export const ${name}: BrandAsset = {
  width: ${value.width},
  height: ${value.height},
  mimeType: 'image/png',
  base64:
    '${value.base64}',
}`

writeFileSync(
  out,
  `/**
 * GENERATED FILE — do not edit by hand.
 * Regenerate with: node scripts/build-brand-assets.mjs
 *
 * Source: assets/Logo.png and assets/signature.png at the repository root.
 */

export interface BrandAsset {
  width: number
  height: number
  mimeType: string
  /** Raw base64, no data: prefix. */
  base64: string
}

export const dataUri = (asset: BrandAsset): string =>
  \`data:\${asset.mimeType};base64,\${asset.base64}\`

${literal('LOGO', logo)}

${literal('SIGNATURE', signature)}
`,
  'utf8'
)

console.log(
  `brandAssets.ts written — logo ${logo.width}x${logo.height}, signature ${signature.width}x${signature.height}`
)
