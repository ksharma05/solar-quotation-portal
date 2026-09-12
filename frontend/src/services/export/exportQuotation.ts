/**
 * Browser entry point for both exporters.
 *
 * pdfmake and the Tinos faces are loaded on demand, so the renderer's weight is only
 * paid when someone actually exports rather than on every page load. Everything below
 * drives the same buildPdfDefinition / buildDocxDocument the Node sample script uses,
 * so what the browser produces and what `npx vite-node scripts/generate-samples.ts`
 * produces are the same document.
 */

import {
  buildDocumentModel,
  hasPrintablePhotos,
  quotationFileName,
} from '@/services/export/documentModel'
import type { DocumentModel, ResolvedProject } from '@/services/export/documentModel'
import { buildPdfDefinition } from '@/services/export/renderPdf'
import { renderDocxBlob } from '@/services/export/renderDocx'
import { FONT } from '@/services/export/layoutSpec'

export { buildDocumentModel, hasPrintablePhotos, quotationFileName, renderDocxBlob }
export type { ResolvedProject }

interface VirtualFileSystem {
  writeFileSync: (name: string, content: string, encoding: string) => void
}

interface PdfMake {
  addFonts: (fonts: Record<string, Record<string, string>>) => void
  createPdf: (definition: unknown) => { getBlob: () => Promise<Blob> }
  virtualfs: VirtualFileSystem
}

/** The four Tinos faces, served from public/fonts by build-font-assets.mjs. */
const TINOS_FACES = {
  normal: 'Tinos-Regular.ttf',
  bold: 'Tinos-Bold.ttf',
  italics: 'Tinos-Italic.ttf',
  bolditalics: 'Tinos-BoldItalic.ttf',
} as const

let pdfMakePromise: Promise<PdfMake> | null = null

/** Raw base64 of a static font file. */
async function fetchFontBase64(file: string): Promise<string> {
  const response = await fetch(`${import.meta.env.BASE_URL}fonts/${file}`)
  if (!response.ok) throw new Error(`Could not load ${file} (${response.status})`)

  const bytes = new Uint8Array(await response.arrayBuffer())
  let binary = ''
  const chunk = 0x8000
  for (let at = 0; at < bytes.length; at += chunk) {
    binary += String.fromCharCode(...bytes.subarray(at, at + chunk))
  }
  return btoa(binary)
}

/**
 * pdfmake with both families registered.
 *
 * Memoised, because re-fetching and re-registering four typefaces on every export is
 * pure waste — the fonts never change within a session.
 */
async function getPdfMake(): Promise<PdfMake> {
  if (pdfMakePromise) return pdfMakePromise

  pdfMakePromise = (async () => {
    const [pdfMakeModule, robotoModule] = await Promise.all([
      import('pdfmake/build/pdfmake'),
      import('pdfmake/build/vfs_fonts'),
    ])

    const instance = ((pdfMakeModule as { default?: unknown }).default ??
      pdfMakeModule) as unknown as PdfMake

    // Roboto ships inside pdfmake; its vfs module exports the map either directly or
    // under `.vfs`, depending on the build.
    const roboto = ((robotoModule as { vfs?: Record<string, string> }).vfs ??
      robotoModule) as Record<string, string>

    for (const [name, base64] of Object.entries(roboto)) {
      if (typeof base64 === 'string') instance.virtualfs.writeFileSync(name, base64, 'base64')
    }

    const tinos = await Promise.all(
      Object.values(TINOS_FACES).map(async (file) => [file, await fetchFontBase64(file)] as const)
    )
    for (const [file, base64] of tinos) {
      instance.virtualfs.writeFileSync(file, base64, 'base64')
    }

    instance.addFonts({
      [FONT.serif]: { ...TINOS_FACES },
      [FONT.display]: {
        normal: 'Roboto-Regular.ttf',
        bold: 'Roboto-Medium.ttf',
        italics: 'Roboto-Italic.ttf',
        bolditalics: 'Roboto-MediumItalic.ttf',
      },
    })

    return instance
  })()

  // A failed load must not poison every later attempt with the same rejected promise.
  pdfMakePromise.catch(() => {
    pdfMakePromise = null
  })

  return pdfMakePromise
}

export async function renderPdfBlob(model: DocumentModel): Promise<Blob> {
  const pdfMake = await getPdfMake()
  return pdfMake.createPdf(buildPdfDefinition(model)).getBlob()
}

/** Blob → raw base64, for the actions that post a rendered PDF back to the server. */
export async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  const chunk = 0x8000
  // Chunked: String.fromCharCode(...bytes) overflows the call stack on a multi-MB PDF.
  for (let at = 0; at < bytes.length; at += chunk) {
    binary += String.fromCharCode(...bytes.subarray(at, at + chunk))
  }
  return btoa(binary)
}

/** Hands the finished file to the browser as a download. */
export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  // Revoked on the next tick: revoking synchronously cancels the download in Safari.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
