#!/usr/bin/env node
// Builds docs/lineup.json: the newest videos for every station in
// config/stations.json. A station with a `handle` reads that channel's
// uploads feed; one with a `query` (or whose channel can't be read) searches
// YouTube for the topic, this week's uploads first. A station that fails
// keeps the videos it had last time, so the TV never goes blank.
//
//   node scripts/update-lineup.mjs            write docs/lineup.json
//   node scripts/update-lineup.mjs --dry-run  print it instead

import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import { blend, channelTitle, findChannelId, newestFirst, parseChannelVideos, parseFeed, parseSearch } from './lineup-lib.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))
const CONFIG = `${root}config/stations.json`
const OUT = `${root}docs/lineup.json`
const HEADERS = {
  'Accept-Language': 'en-US,en;q=0.9',
  'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  Cookie: 'CONSENT=YES+1; SOCS=CAI',
}
// YouTube search filters: uploaded this week, then this month.
const THIS_WEEK = 'EgIIAw%253D%253D'
const THIS_MONTH = 'EgIIBA%253D%253D'

async function get(url) {
  const response = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(20000) })
  if (!response.ok) throw new Error(`${url} answered ${response.status}`)
  return response.text()
}

async function fromChannel(station) {
  const id = station.channelId ?? findChannelId(await get(`https://www.youtube.com/${station.handle}`))
  if (!id) throw new Error(`no channel id on youtube.com/${station.handle}`)
  // The uploads feed has exact times but YouTube often refuses it to cloud
  // servers; the channel's Videos tab is the fallback.
  try {
    const videos = parseFeed(await get(`https://www.youtube.com/feeds/videos.xml?channel_id=${id}`), station.name)
    if (videos.length > 0) return { videos, channelId: id, via: 'feed' }
  } catch (error) {
    console.log(`      ${station.slug} feed: ${error.message}`)
  }
  const page = await get(`https://www.youtube.com/channel/${id}/videos`)
  // Every video on a channel's own tab is that channel's.
  const owner = channelTitle(page) || station.name
  const videos = parseChannelVideos(page, Date.now()).map(video => ({ ...video, channel: owner }))
  if (videos.length === 0) throw new Error(`no videos on the Videos tab of ${station.handle}`)
  return { videos, channelId: id, via: 'videos tab' }
}

async function fromSearch(station, limit) {
  const now = Date.now()
  const query = encodeURIComponent(station.query)
  for (const filter of [THIS_WEEK, THIS_MONTH]) {
    const html = await get(`https://www.youtube.com/results?search_query=${query}&sp=${filter}`)
    const videos = parseSearch(html, now)
    if (videos.length > 0) return { videos: newestFirst(videos, limit) }
  }
  throw new Error(`no results for "${station.query}"`)
}

async function tuneStation(station, limit) {
  const errors = []
  const fail = (where, error) => {
    errors.push(error.message)
    console.log(`      ${station.slug} ${where}: ${error.message}`)
  }
  if (station.handle) {
    try {
      const { videos, channelId, via } = await fromChannel(station)
      return { videos: newestFirst(videos, limit), source: 'channel', channelId, via }
    } catch (error) {
      fail('channel', error)
    }
  }
  if (station.query) {
    try {
      const { videos } = await fromSearch(station, limit)
      return { videos, source: 'search', ...(errors.length ? { channelError: errors.join('; ') } : {}) }
    } catch (error) {
      fail('search', error)
    }
  }
  throw new Error(errors.join('; ') || 'station has neither handle nor query')
}

/**
 * A station with `sources` blends them all: `{ handle }` a channel's uploads,
 * `{ query }` a YouTube search, `{ from }` another station's videos.
 */
async function tuneBlend(station, limit, tuned) {
  const lists = []
  const errors = []
  for (const source of station.sources) {
    const label = source.from ? `from ${source.from}` : source.handle ?? `"${source.query}"`
    try {
      if (source.from) {
        const other = tuned.get(source.from)
        if (!other || other.videos.length === 0) throw new Error('that station has no videos')
        lists.push(other.videos)
      } else if (source.handle) {
        lists.push((await fromChannel({ ...station, handle: source.handle, channelId: undefined })).videos)
      } else if (source.query) {
        lists.push((await fromSearch({ ...station, query: source.query }, limit)).videos)
      }
    } catch (error) {
      errors.push(`${label}: ${error.message}`)
      console.log(`      ${station.slug} ${label}: ${error.message}`)
    }
  }
  if (lists.length === 0) throw new Error(errors.join('; ') || 'no sources')
  return { videos: blend(lists, limit), source: 'blend', ...(errors.length ? { sourceErrors: errors } : {}) }
}

const config = JSON.parse(await readFile(CONFIG, 'utf8'))
const limit = config.perStation ?? 15
let previous = { stations: [] }
try {
  previous = JSON.parse(await readFile(OUT, 'utf8'))
} catch {
  // first run
}

// Plain stations first, so a blend can draw on them with `from`.
const tuned = new Map()
const ordered = [
  ...config.stations.filter(station => !station.sources?.some(source => source.from)),
  ...config.stations.filter(station => station.sources?.some(source => source.from)),
]
for (const station of ordered) {
  const before = previous.stations?.find(old => old.slug === station.slug)
  try {
    const result = station.sources
      ? await tuneBlend(station, limit, tuned)
      : await tuneStation({ ...station, channelId: before?.handle === station.handle ? before?.channelId : undefined }, limit)
    tuned.set(station.slug, { slug: station.slug, name: station.name, handle: station.handle, ...result, updatedAt: new Date().toISOString() })
    console.log(`ok    ${station.slug}: ${result.videos.length} videos from ${result.source}${result.via ? ` (${result.via})` : ''}`)
  } catch (error) {
    tuned.set(station.slug, {
      slug: station.slug,
      name: station.name,
      source: before?.source ?? 'none',
      ...(before?.channelId ? { channelId: before.channelId } : {}),
      videos: before?.videos ?? [],
      updatedAt: before?.updatedAt ?? null,
      error: error.message,
    })
    console.log(`kept  ${station.slug}: ${error.message}`)
  }
}
const stations = config.stations.map(station => tuned.get(station.slug))

const lineup = { updatedAt: new Date().toISOString(), stations }
const text = `${JSON.stringify(lineup, null, 2)}\n`
if (process.argv.includes('--dry-run')) process.stdout.write(text)
else await writeFile(OUT, text)

// Fail the run only when nothing at all could be tuned.
if (stations.every(station => station.videos.length === 0)) process.exit(1)
