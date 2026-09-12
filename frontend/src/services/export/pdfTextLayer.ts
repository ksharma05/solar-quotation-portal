/**
 * Decodes a generated PDF's text layer.
 *
 * Exists for one reason: to prove the document stays selectable and searchable. The
 * glyphs on the page can look perfect while the text layer is wrong, and only a decode
 * through each font's own ToUnicode CMap can tell the two apart.
 *
 * The document uses two fonts with Identity-H encoding, so a glyph id means nothing on
 * its own — id 68 is a different character in Tinos than in Roboto. The decoder
 * therefore tracks the active font via the Tf operator and switches CMap with it.
 * Merging the CMaps instead produces plausible-looking nonsense.
 *
 * Test-support code, not shipped to the browser — see pdfTextLayer.test.ts.
 */

import { inflateSync } from 'node:zlib'

interface PdfObject {
  id: number
  body: string
  stream: string | null
}

/** Every `N 0 obj … endobj`, with its stream inflated where Flate-compressed. */
function parseObjects(raw: string): Map<number, PdfObject> {
  const objects = new Map<number, PdfObject>()
  const pattern = /(\d+)\s+0\s+obj([\s\S]*?)endobj/g
  let match: RegExpExecArray | null

  while ((match = pattern.exec(raw)) !== null) {
    const id = Number(match[1])
    const body = match[2]
    let stream: string | null = null

    const start = body.search(/stream\r?\n/)
    if (start >= 0) {
      const from = start + body.slice(start).match(/stream\r?\n/)![0].length
      const to = body.indexOf('endstream', from)
      if (to > 0) {
        const bytes = Buffer.from(body.slice(from, to), 'latin1')
        try {
          stream = inflateSync(bytes).toString('latin1')
        } catch {
          stream = bytes.toString('latin1')
        }
      }
    }
    objects.set(id, { id, body, stream })
  }
  return objects
}

interface CMap {
  map: Map<number, string>
  /**
   * ToUnicode destinations containing whitespace.
   *
   * pdfkit joins a multi-codepoint glyph's characters with a SPACE — emitting
   * <0066 0069> for the "fi" ligature, where a bfrange destination must be one
   * contiguous hex string. Readers take only the first value, so every such entry is a
   * word that copies and searches wrongly.
   */
  malformed: number
}

function parseCMap(stream: string): CMap {
  const map = new Map<number, string>()
  let malformed = 0

  // bfrange: <first> <last> [<dst> <dst> …]
  const rangeList = /<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*\[([^\]]*)\]/g
  let range: RegExpExecArray | null
  while ((range = rangeList.exec(stream)) !== null) {
    const first = parseInt(range[1], 16)
    const destinations = range[3].match(/<[^>]*>/g) ?? []

    destinations.forEach((destination, offset) => {
      const hex = destination.slice(1, -1)
      if (/\s/.test(hex.trim())) malformed++

      const clean = hex.replace(/\s+/g, '')
      let decoded = ''
      for (let at = 0; at + 4 <= clean.length; at += 4) {
        decoded += String.fromCharCode(parseInt(clean.slice(at, at + 4), 16))
      }
      map.set(first + offset, decoded)
    })
  }
  return { map, malformed }
}

export interface TextLayer {
  text: string
  malformedEntries: number
  /** Font resource names that were resolved, e.g. ["F1", "F2"]. */
  fonts: string[]
}

export function extractTextLayer(pdf: Buffer): TextLayer {
  const raw = pdf.toString('latin1')
  const objects = parseObjects(raw)

  // --- font object -> its ToUnicode CMap ---
  const cmapByFontObject = new Map<number, CMap>()
  for (const object of objects.values()) {
    const toUnicode = /\/ToUnicode\s+(\d+)\s+0\s+R/.exec(object.body)
    if (!toUnicode) continue
    const cmapObject = objects.get(Number(toUnicode[1]))
    if (cmapObject?.stream) cmapByFontObject.set(object.id, parseCMap(cmapObject.stream))
  }

  // --- resource name (/F1) -> CMap, read from every /Font dictionary ---
  const cmapByName = new Map<string, CMap>()
  for (const object of objects.values()) {
    const fontDict = /\/Font\s*<<([^>]*)>>/.exec(object.body)
    if (!fontDict) continue

    const entries = /\/(\w+)\s+(\d+)\s+0\s+R/g
    let entry: RegExpExecArray | null
    while ((entry = entries.exec(fontDict[1])) !== null) {
      const cmap = cmapByFontObject.get(Number(entry[2]))
      if (cmap) cmapByName.set(entry[1], cmap)
    }
  }

  let malformedEntries = 0
  for (const cmap of cmapByFontObject.values()) malformedEntries += cmap.malformed

  // --- walk the content streams, following the active font ---
  const pieces: string[] = []
  const token = /\/(\w+)\s+[\d.]+\s+Tf|<([0-9A-Fa-f]+)>\s*Tj|\[([^\]]*)\]\s*TJ/g

  for (const object of objects.values()) {
    if (!object.stream || !/\bTf\b/.test(object.stream)) continue
    let active: CMap | undefined
    let found: RegExpExecArray | null
    token.lastIndex = 0

    while ((found = token.exec(object.stream)) !== null) {
      if (found[1] !== undefined) {
        active = cmapByName.get(found[1])
        continue
      }
      if (!active) continue

      const hexes = found[2]
        ? [found[2]]
        : (found[3].match(/<[0-9A-Fa-f]+>/g) ?? []).map((item) => item.slice(1, -1))

      let piece = ''
      for (const hex of hexes) {
        for (let at = 0; at + 4 <= hex.length; at += 4) {
          piece += active.map.get(parseInt(hex.slice(at, at + 4), 16)) ?? ''
        }
      }
      pieces.push(piece)
    }
  }

  return { text: pieces.join(' '), malformedEntries, fonts: [...cmapByName.keys()] }
}
