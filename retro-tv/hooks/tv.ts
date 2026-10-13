import type { Video } from '../types'

export type Channel = { slug: string; name: string; handle: string }

// CH 00 mixes the newest uploads from every station below it.
export const MIX: Channel = { slug: 'mix', name: 'ALL CHANNELS', handle: '' }

export const STATIONS: Channel[] = [
  { slug: 'claude', name: 'CLAUDE / ANTHROPIC', handle: '@anthropic-ai' },
  { slug: 'braves', name: 'ATLANTA BRAVES', handle: '@Braves' },
  { slug: 'falcons', name: 'ATLANTA FALCONS', handle: '@AtlantaFalcons' },
  { slug: 'hawks', name: 'ATLANTA HAWKS', handle: '@ATLHawks' },
  { slug: 'united', name: 'ATLANTA UNITED', handle: '@ATLUTD' },
]

export const CHANNELS: Channel[] = [MIX, ...STATIONS]

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
}

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (whole, code: string) => {
    if (code[0] === '#') {
      const n = code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10)
      return Number.isFinite(n) ? String.fromCodePoint(n) : whole
    }
    return ENTITIES[code.toLowerCase()] ?? whole
  })
}

/** The UC… channel id on a youtube.com/@handle page. */
export function findChannelId(html: string): string | undefined {
  const match =
    html.match(/"externalId":"(UC[\w-]{22})"/) ??
    html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[\w-]{22})"/) ??
    html.match(/"channelId":"(UC[\w-]{22})"/)
  return match?.[1]
}

/** The entries of a channel's uploads feed, newest first. */
export function parseFeed(xml: string, channel: string): Video[] {
  return xml
    .split('<entry>')
    .slice(1)
    .map(entry => ({
      id: entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1] ?? '',
      title: decodeEntities(entry.match(/<title>([^<]*)<\/title>/)?.[1] ?? '').trim(),
      published: entry.match(/<published>([^<]+)<\/published>/)?.[1] ?? '',
      channel,
    }))
    .filter(video => video.id !== '')
}

export function mix(lists: Video[][], limit = 20): Video[] {
  return lists
    .flat()
    .sort((a, b) => Date.parse(b.published) - Date.parse(a.published))
    .slice(0, limit)
}

export function age(published: string, now: number): string {
  const minutes = Math.max(0, Math.round((now - Date.parse(published)) / 60000))
  if (!Number.isFinite(minutes)) return ''
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 48) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

/** The player page link: the picked video first, the rest of the channel queued after it. */
export function watchUrl(base: string, channel: Channel, videos: Video[], index: number): string {
  const picked = videos[index]
  const url = new URL(base)
  if (picked === undefined) return url.toString()
  const queue = [...videos.slice(index), ...videos.slice(0, index)].slice(0, 25)
  url.searchParams.set('v', picked.id)
  url.searchParams.set('list', queue.map(video => video.id).join(','))
  url.searchParams.set('ch', channel.name)
  url.searchParams.set('t', picked.title.slice(0, 120))
  return url.toString()
}

export function tune(query: string): number | undefined {
  const wanted = query.trim().toLowerCase()
  if (wanted === '') return undefined
  const asNumber = Number(wanted)
  if (Number.isInteger(asNumber) && asNumber >= 0 && asNumber < CHANNELS.length) return asNumber
  const found = CHANNELS.findIndex(
    channel => channel.slug.startsWith(wanted) || channel.name.toLowerCase().includes(wanted),
  )
  return found === -1 ? undefined : found
}

// ---- the CRT screen, drawn as raster cells -------------------------------

const DEFAULT = 0x01000000
const PHOSPHOR = 0x7cff9b
const PHOSPHOR_DIM = 0x2f8f52
const GLASS = 0x0b1a12
const GLASS_SCAN = 0x07120c

// SMPTE color bars: what an old set shows with nothing on the air.
const BARS = [0xc0c0c0, 0xc0c000, 0x00c0c0, 0x00c000, 0xc000c0, 0xc00000, 0x0000c0]

export type Screen = {
  columns: number
  rows: number
  mode: 'picture' | 'static' | 'bars'
  lines: string[]
  /** Which row the slow rolling bar of the tube sits on. */
  roll: number
  seed: number
}

function random(seed: number): () => number {
  let x = seed | 0 || 1
  return () => {
    x ^= x << 13
    x ^= x >>> 17
    x ^= x << 5
    return (x >>> 0) / 4294967296
  }
}

/** One u32 triplet per cell, [codePoint, foreground, background], as Raster takes them. */
export function screenCells(screen: Screen): Uint32Array {
  const { columns, rows } = screen
  const cells = new Uint32Array(columns * rows * 3)
  const next = random(screen.seed)
  const put = (x: number, y: number, ch: string, fg: number, bg: number) => {
    const i = (y * columns + x) * 3
    cells[i] = ch.codePointAt(0) ?? 0x20
    cells[i + 1] = fg
    cells[i + 2] = bg
  }
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < columns; x++) {
      // Rounded tube corners.
      const cornerX = Math.min(x, columns - 1 - x)
      const cornerY = Math.min(y, rows - 1 - y)
      if (cornerX + cornerY * 2 < 2) {
        put(x, y, ' ', DEFAULT, DEFAULT)
        continue
      }
      if (screen.mode === 'static') {
        const v = next()
        const grey = Math.floor(next() * 200) + 30
        const ch = v < 0.25 ? '░' : v < 0.5 ? '▒' : v < 0.7 ? '▓' : v < 0.85 ? '▄' : ' '
        put(x, y, ch, grey * 0x010101, Math.floor(grey / 4) * 0x010101)
        continue
      }
      if (screen.mode === 'bars') {
        const color = BARS[Math.floor((x / columns) * BARS.length)] ?? 0
        const bottom = y >= Math.floor(rows * 0.75)
        put(x, y, ' ', DEFAULT, bottom ? (x % 6 < 3 ? 0x101010 : 0xe0e0e0) : color)
        continue
      }
      const scan = y % 2 === 1 ? GLASS_SCAN : GLASS
      put(x, y, ' ', PHOSPHOR, y === screen.roll ? 0x16301f : scan)
    }
  }
  // Text sits on top of whatever the tube shows, centered row by row.
  const top = Math.max(0, Math.floor((rows - screen.lines.length) / 2))
  screen.lines.forEach((line, row) => {
    const y = top + row
    if (y >= rows) return
    const glyphs = [...line].slice(0, columns - 4)
    const left = Math.max(2, Math.floor((columns - glyphs.length) / 2))
    glyphs.forEach((ch, k) => {
      const x = left + k
      const i = (y * columns + x) * 3
      const bg = cells[i + 2] ?? GLASS
      const printable = ch.length === 1 && ch >= ' ' ? ch : '?'
      const fg = screen.mode === 'picture' ? (row === 0 ? PHOSPHOR_DIM : PHOSPHOR) : 0xffffff
      put(x, y, printable, fg, screen.mode === 'bars' ? 0x000000 : bg)
    })
  })
  return cells
}

/** Wraps text into lines no wider than `width`, at most `max` of them. */
export function wrap(text: string, width: number, max: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const candidate = line === '' ? word : `${line} ${word}`
    if ([...candidate].length <= width) {
      line = candidate
      continue
    }
    if (line !== '') lines.push(line)
    line = [...word].slice(0, width).join('')
    if (lines.length === max) break
  }
  if (line !== '' && lines.length < max) lines.push(line)
  if (lines.length === max && words.join(' ').length > lines.join(' ').length) {
    const last = lines[max - 1] ?? ''
    lines[max - 1] = [...last].slice(0, Math.max(0, width - 1)).join('') + '…'
  }
  return lines
}

/** Keeps a title to characters a raster cell can hold (one-width BMP glyphs). */
export function plain(text: string): string {
  return [...text]
    .map(ch => {
      const code = ch.codePointAt(0) ?? 0
      if (code < 0x20) return ' '
      if (code > 0xffff) return ''
      // Wide CJK and emoji-presentation ranges take two cells: leave them out.
      if (code >= 0x1100 && (code <= 0x115f || (code >= 0x2e80 && code <= 0xa4cf) || (code >= 0xac00 && code <= 0xd7a3) || (code >= 0xf900 && code <= 0xfaff) || (code >= 0xfe30 && code <= 0xfe4f) || (code >= 0xff00 && code <= 0xff60) || (code >= 0xffe0 && code <= 0xffe6))) return ''
      if (code >= 0x2600 && code <= 0x27bf) return ''
      if (code >= 0xd800 && code <= 0xdfff) return ''
      return ch
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

/** Standard padded base64 of the cells' little-endian bytes. */
export function cellsBase64(cells: Uint32Array): string {
  const bytes = new Uint8Array(cells.length * 4)
  const view = new DataView(bytes.buffer)
  cells.forEach((word, i) => view.setUint32(i * 4, word, true))
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] ?? 0
    const b = bytes[i + 1] ?? 0
    const c = bytes[i + 2] ?? 0
    out += B64[a >> 2]! + B64[((a & 3) << 4) | (b >> 4)]!
    out += i + 1 < bytes.length ? B64[((b & 15) << 2) | (c >> 6)]! : '='
    out += i + 2 < bytes.length ? B64[c & 63]! : '='
  }
  return out
}
