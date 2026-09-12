/**
 * Browser-side image handling for reference projects.
 *
 * Downscaling before upload is not a nicety — it is what keeps three separate things
 * inside Apps Script's limits: the upload request, the getProjectImages response, and
 * the base64 PDF posted back for emailing. A 12-megapixel phone photo is ~5MB; the same
 * photograph at 1600px is ~400KB and still prints at over 200dpi in the document, which
 * is far more than the page needs.
 */

/** Longest edge, in pixels, of a stored photograph. */
export const MAX_IMAGE_EDGE = 1600

/** JPEG quality used when re-encoding. */
export const IMAGE_QUALITY = 0.82

export interface PreparedImage {
  /** Raw base64, no data: prefix. */
  base64: string
  mimeType: string
  name: string
  width: number
  height: number
  bytes: number
}

/** Strips the `data:...;base64,` prefix a canvas export produces. */
function stripDataUri(dataUri: string): string {
  const comma = dataUri.indexOf(',')
  return comma >= 0 ? dataUri.slice(comma + 1) : dataUri
}

/** Approximate decoded size of a base64 string, without decoding it. */
function base64Bytes(base64: string): number {
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0
  return Math.floor((base64.length * 3) / 4) - padding
}

/**
 * Decodes, downscales and re-encodes one file chosen by the operator.
 *
 * Rejects anything that is not a decodable image, so a stray PDF or a corrupt file
 * fails here with a clear message rather than server-side or, worse, silently at
 * export time.
 */
export async function prepareImageForUpload(file: File): Promise<PreparedImage> {
  if (!file.type.startsWith('image/')) {
    throw new Error(`${file.name} is not an image`)
  }

  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error(`${file.name} could not be read as an image`)
  })

  try {
    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height

    const context = canvas.getContext('2d')
    if (!context) throw new Error('This browser could not prepare the image for upload')
    context.drawImage(bitmap, 0, 0, width, height)

    // Re-encoded as JPEG regardless of the source format: PNG photographs are several
    // times larger for no visible gain at this size. Transparency is irrelevant here.
    const base64 = stripDataUri(canvas.toDataURL('image/jpeg', IMAGE_QUALITY))

    return {
      base64,
      mimeType: 'image/jpeg',
      name: file.name.replace(/\.[^.]+$/, '') + '.jpg',
      width,
      height,
      bytes: base64Bytes(base64),
    }
  } finally {
    bitmap.close()
  }
}

/**
 * Natural dimensions of a stored photograph, needed so the exporters can preserve
 * aspect ratio exactly rather than guessing.
 *
 * Returns null for anything that will not decode, which is the signal to skip the
 * photograph rather than fail the export.
 */
export async function measureImage(
  base64: string,
  mimeType: string
): Promise<{ width: number; height: number } | null> {
  try {
    const response = await fetch(`data:${mimeType};base64,${base64}`)
    const bitmap = await createImageBitmap(await response.blob())
    const size = { width: bitmap.width, height: bitmap.height }
    bitmap.close()
    return size
  } catch {
    return null
  }
}
