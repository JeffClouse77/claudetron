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
const SHORT = { s: 'second', sec: 'second', m: 'minute', min: 'minute', h: 'hour', hr: 'hour', d: 'day', w: 'week', wk: 'week', mo: 'month', y: 'year', yr: 'year' }

/**
 * "3 hours ago", "5d ago", "2mo ago" or "Streamed 2 days ago" as an ISO time,
 * counted back from `now`; `now` itself when there is no age to read.
 */
export function fromRelative(text, now) {
  const match = String(text ?? '').match(/(\d+)\s*(seconds?|minutes?|hours?|days?|weeks?|months?|years?|mo|min|sec|hr|yr|wk|[smhdwy])\s+ago/i)
  if (!match) return new Date(now).toISOString()
  const word = match[2].toLowerCase()
  const unit = SHORT[word] ?? word.replace(/s$/, '')
  const seconds = Number(match[1]) * (UNITS[unit] ?? 0)
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
    const lockup = node.lockupViewModel
    if (lockup && lockup.contentType === 'LOCKUP_CONTENT_TYPE_VIDEO' && /^[\w-]{11}$/.test(lockup.contentId ?? '') && !seen.has(lockup.contentId)) {
      const meta = lockup.metadata?.lockupMetadataViewModel
      const texts = []
      const collect = value => {
        if (Array.isArray(value)) return value.forEach(collect)
        if (value === null || typeof value !== 'object') return
        if (typeof value.content === 'string') texts.push(value.content)
        Object.values(value).forEach(collect)
      }
      collect(meta?.metadata)
      const ageText = texts.find(text => /\bago\b/i.test(text))
      if (ageText) {
        seen.add(lockup.contentId)
        found.push({
          id: lockup.contentId,
          title: String(meta?.title?.content ?? '').trim(),
          published: fromRelative(ageText, now),
          channel: texts.find(text => !/\bago\b|views?\b|watching|^[\d.,\s]+[KMB]?$/i.test(text.trim()))?.trim() ?? '',
          ageText,
        })
      }
    }
    Object.values(node).forEach(visit)
  }
  visit(data)
  return found
}

/** A channel page's own name, from its og:title. */
export function channelTitle(html) {
  const match = html.match(/<meta property="og:title" content="([^"]*)"/)
  return match ? decodeEntities(match[1]).trim() : ''
}

/** The videos on a channel's Videos tab, newest first as the tab lists them. */
export const parseChannelVideos = parseSearch

export function newestFirst(videos, limit) {
  const seen = new Set()
  return videos
    .filter(video => (seen.has(video.id) ? false : (seen.add(video.id), true)))
    .sort((a, b) => Date.parse(b.published) - Date.parse(a.published))
    .slice(0, limit)
}

/**
 * Several sources' videos as one channel: each source gives at most its
 * fair share (so one busy channel can't fill it), then newest first.
 */
export function blend(lists, limit) {
  const share = Math.ceil(limit / Math.max(1, lists.length)) + 1
  return newestFirst(lists.flatMap(list => newestFirst(list, share)), limit)
}
