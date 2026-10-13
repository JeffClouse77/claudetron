// Parsing helpers for update-lineup.mjs: no dependencies, no network.

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }

export function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (whole, code) => {
    if (code[0] === '#') {
      const n = code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10)
      return Number.isFinite(n) ? String.fromCodePoint(n) : whole
    }
    return ENTITIES[code.toLowerCase()] ?? whole
  })
}

/** The UC… channel id on a youtube.com/@handle page. */
export function findChannelId(html) {
  const match =
    html.match(/"externalId":"(UC[\w-]{22})"/) ??
    html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[\w-]{22})"/) ??
    html.match(/"channelId":"(UC[\w-]{22})"/)
  return match?.[1]
}

/** A channel's uploads feed (youtube.com/feeds/videos.xml), newest first. */
export function parseFeed(xml, channel) {
  return xml
    .split('<entry>')
    .slice(1)
    .map(entry => ({
      id: entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1] ?? '',
      title: decodeEntities(entry.match(/<title>([^<]*)<\/title>/)?.[1] ?? '').trim(),
      published: entry.match(/<published>([^<]+)<\/published>/)?.[1] ?? '',
      channel: decodeEntities(entry.match(/<name>([^<]*)<\/name>/)?.[1] ?? channel).trim(),
    }))
    .filter(video => /^[\w-]{11}$/.test(video.id))
}

const UNITS = { second: 1, minute: 60, hour: 3600, day: 86400, week: 604800, month: 2592000, year: 31536000 }

/** "3 hours ago" (or "Streamed 2 days ago") as an ISO time, counted back from `now`. */
export function fromRelative(text, now) {
  const match = String(text ?? '').match(/(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago/i)
  if (!match) return new Date(now).toISOString()
  const seconds = Number(match[1]) * UNITS[match[2].toLowerCase()]
  return new Date(now - seconds * 1000).toISOString()
}

/** The ytInitialData object a youtube.com/results page carries. */
export function initialData(html) {
  const start = html.search(/(?:var\s+ytInitialData|window\["ytInitialData"\])\s*=\s*\{/)
  if (start === -1) return undefined
  const open = html.indexOf('{', start)
  // Walk to the matching brace, skipping strings.
  let depth = 0
  let inString = false
  for (let i = open; i < html.length; i++) {
    const ch = html[i]
    if (inString) {
      if (ch === '\\') i++
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') inString = true
    else if (ch === '{') depth++
    else if (ch === '}' && --depth === 0) {
      try {
        return JSON.parse(html.slice(open, i + 1))
      } catch {
        return undefined
      }
    }
  }
  return undefined
}

function textOf(node) {
  if (!node) return ''
  if (typeof node.simpleText === 'string') return node.simpleText
  if (Array.isArray(node.runs)) return node.runs.map(run => run.text ?? '').join('')
  return ''
}

/** Every videoRenderer in a search results page, in page order. */
export function parseSearch(html, now) {
  const data = initialData(html)
  if (data === undefined) return []
  const found = []
  const seen = new Set()
  const visit = node => {
    if (Array.isArray(node)) return node.forEach(visit)
    if (node === null || typeof node !== 'object') return
    const video = node.videoRenderer
    if (video && /^[\w-]{11}$/.test(video.videoId ?? '') && !seen.has(video.videoId)) {
      seen.add(video.videoId)
      // Skip live streams still on the air: they have no publish time yet.
      if (video.publishedTimeText) {
        found.push({
          id: video.videoId,
          title: textOf(video.title).trim(),
          published: fromRelative(textOf(video.publishedTimeText), now),
          channel: textOf(video.ownerText ?? video.longBylineText).trim(),
          ageText: textOf(video.publishedTimeText) || JSON.stringify(video.publishedTimeText).slice(0, 120),
        })
      }
    }
    Object.values(node).forEach(visit)
  }
  visit(data)
  return found
}

export function newestFirst(videos, limit) {
  const seen = new Set()
  return videos
    .filter(video => (seen.has(video.id) ? false : (seen.add(video.id), true)))
    .sort((a, b) => Date.parse(b.published) - Date.parse(a.published))
    .slice(0, limit)
}
