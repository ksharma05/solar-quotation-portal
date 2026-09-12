/**
 * Packs a project's photographs into the reference document's collage.
 *
 * Rows are uniform: every tile in a row is the same width, and every photograph in it is
 * centred inside its tile, so the collage reads as a grid rather than a ragged pile.
 * Photographs are never cropped or distorted — a tile whose photograph is a different
 * shape keeps blank space around it.
 *
 * Height comes from the BUDGET the paginator gives a project. A row is as tall as the
 * tallest photograph it can show at its tile width; if the rows together outgrow the
 * budget, every row is scaled down by the same factor. The collage therefore never
 * overflows its slot, which is what makes the page count exact.
 *
 * The unit of layout is a grid ROW, which is what each renderer marks unbreakable.
 */

import { CONTENT_WIDTH, IMAGE_GRID } from '@/services/export/layoutSpec'
import type { ExportImage } from '@/services/export/documentModel'

export interface GridCell {
  image: ExportImage
  /** Scaled display size, in points. Aspect ratio is always preserved. */
  width: number
  height: number
  /** The uniform tile this photograph is centred inside. */
  tileWidth: number
  tileHeight: number
}

export interface GridRow {
  cells: GridCell[]
  /** The tile height every cell in the row reserves. */
  height: number
}

/**
 * An image with no usable dimensions cannot be scaled, so it is dropped rather than guessed at.
 *
 * Exported because documentModel decides whether a project prints at all on exactly this
 * test — a second, drifting copy would let a project through with photographs the grid
 * then silently discards, which is the empty half page this predicate exists to prevent.
 */
export function isUsable(image: ExportImage): boolean {
  return (
    Boolean(image?.base64) &&
    Number.isFinite(image.width) &&
    Number.isFinite(image.height) &&
    image.width > 0 &&
    image.height > 0
  )
}

/**
 * Column counts per row, by photograph count.
 *
 * A lone photograph or an odd leader takes the full width; the rest pair up. Counts above
 * PROJECT_PAGE.maxPhotos never reach here — the paginator caps them first.
 */
function tileRows(count: number): number[] {
  if (count <= 1) return [1]
  if (count === 2) return [2]

  const rows: number[] = []
  let remaining = count

  // An odd count leads with one wide photograph so no row is left half empty.
  if (remaining % 2 === 1) {
    rows.push(1)
    remaining -= 1
  }

  for (; remaining > 0; remaining -= IMAGE_GRID.columns) rows.push(IMAGE_GRID.columns)
  return rows
}

const round = (value: number): number => Math.round(value * 100) / 100

/**
 * Scales to *contain* the tile: the photograph fits inside both dimensions and is never
 * distorted.
 *
 * This does NOT clamp to the natural size — the reference prints photographs edge to
 * edge, and a 900px-wide photo upscaled to 483pt is still ~134dpi, which prints cleanly.
 */
function fit(image: ExportImage, tileWidth: number, tileHeight: number): GridCell {
  const scale = Math.min(tileWidth / image.width, tileHeight / image.height)
  return {
    image,
    width: round(image.width * scale),
    height: round(image.height * scale),
    tileWidth: round(tileWidth),
    tileHeight: round(tileHeight),
  }
}

export function packImageGrid(
  images: ExportImage[],
  {
    budget,
    width = CONTENT_WIDTH,
    gutter = IMAGE_GRID.gutter,
    rowGap = IMAGE_GRID.rowGap,
  }: { budget: number; width?: number; gutter?: number; rowGap?: number }
): GridRow[] {
  const usable = (images ?? []).filter(isUsable)
  if (usable.length === 0 || budget <= 0) return []

  const layout = tileRows(usable.length)
  const gaps = rowGap * (layout.length - 1)

  // Each row is grouped with the tile width its column count gives it, and is as tall as
  // the tallest photograph in it once scaled to that width.
  const grouped = layout.map((columns, row) => {
    const tileWidth = (width - gutter * (columns - 1)) / columns
    const cells = usable.slice(
      layout.slice(0, row).reduce((sum, count) => sum + count, 0),
      layout.slice(0, row + 1).reduce((sum, count) => sum + count, 0)
    )
    const height = Math.max(...cells.map((image) => (image.height * tileWidth) / image.width))
    return { cells, tileWidth, height }
  })

  const natural = grouped.reduce((sum, row) => sum + row.height, 0) + gaps
  // Only ever scales DOWN: a collage shorter than its slot is left alone rather than
  // stretched into bands of blank space around photographs that cannot grow sideways.
  const scale = natural > budget ? Math.max(0, budget - gaps) / (natural - gaps) : 1

  return grouped
    .filter((row) => row.cells.length > 0)
    .map((row) => {
      const tileHeight = row.height * scale
      return {
        cells: row.cells.map((image) => fit(image, row.tileWidth, tileHeight)),
        height: round(tileHeight),
      }
    })
}

/** `data:` URI for an image, the form both pdfmake and the DOCX writer accept. */
export function toDataUri(image: ExportImage): string {
  return `data:${image.mimeType || 'image/jpeg'};base64,${image.base64}`
}
