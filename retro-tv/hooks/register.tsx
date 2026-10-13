import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, Timer } from 'claude-code'

import type { Feed, Video } from '../types'
import {
  CHANNELS,
  STATIONS,
  age,
  cellsBase64,
  findChannelId,
  mix,
  parseFeed,
  plain,
  screenCells,
  tune,
  watchUrl,
  wrap,
} from './tv'
import type { Channel, Screen } from './tv'

const PANE = 'retro-tv'
const STALE_MS = 15 * 60 * 1000
const STATIC_MS = 700

const channel = atom({ plugin: 'retro-tv', key: 'channel' } as const, 1)
const video = atom({ plugin: 'retro-tv', key: 'video' } as const, 0)
const feeds = atom({ plugin: 'retro-tv', key: 'feeds' } as const, {} as Record<string, Feed>)
const staticUntil = atom({ plugin: 'retro-tv', key: 'staticUntil' } as const, 0)
const isOn = atom({ plugin: 'retro-tv', key: 'isOn' } as const, false)

const WOOD = '#8b5a2b'
const WOOD_DARK = '#5c3a1a'
const BRASS = '#d4a64a'
const AMBER = '#ffb000'
const PHOSPHOR = '#7cff9b'
const GLASS = '#0b1a12'

// The tube's rolling bar and the static between channels need frames; this
// module's timer drives them while the set is on.
let ticker: Timer | undefined
let frame = 0

function videosOf(all: Record<string, Feed>, index: number): Video[] {
  const picked = CHANNELS[index]
  if (picked === undefined) return []
  if (picked.slug === 'mix') return mix(STATIONS.map(station => all[station.slug]?.videos ?? []))
  return all[picked.slug]?.videos ?? []
}

function statusOf(all: Record<string, Feed>, index: number): Feed['status'] {
  const picked = CHANNELS[index]
  if (picked === undefined) return 'error'
  if (picked.slug !== 'mix') return all[picked.slug]?.status ?? 'idle'
  const states = STATIONS.map(station => all[station.slug]?.status ?? 'idle')
  if (states.includes('ok')) return 'ok'
  if (states.includes('loading') || states.includes('idle')) return 'loading'
  return 'error'
}

async function setFeed($: EngineInterface, slug: string, feed: Feed) {
  await update($, feeds, all => ({ ...all, [slug]: feed }))
}

async function loadStation($: EngineInterface, station: Channel, force: boolean) {
  const current = (await read($, feeds))[station.slug]
  if (!force && current?.status === 'loading') return
  if (!force && current?.status === 'ok' && Date.now() - current.fetchedAt < STALE_MS) return
  await setFeed($, station.slug, {
    status: 'loading',
    videos: current?.videos ?? [],
    fetchedAt: current?.fetchedAt ?? 0,
  })
  try {
    const cacheKey = `channel-id:${station.handle}`
    let id = (await $.store.get(cacheKey)) as string | undefined
    if (typeof id !== 'string') {
      const page = await $.http.fetch(`https://www.youtube.com/${station.handle}`, {
        headers: { 'Accept-Language': 'en-US,en', Cookie: 'CONSENT=YES+1' },
      })
      id = findChannelId(page.text)
      if (id === undefined) throw new Error(`no channel id on youtube.com/${station.handle}`)
      await $.store.set(cacheKey, id)
    }
    const rss = await $.http.fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${id}`)
    if (!rss.ok) throw new Error(`feed answered ${rss.status}`)
    const videos = parseFeed(rss.text, station.name)
    await setFeed($, station.slug, { status: 'ok', videos, fetchedAt: Date.now() })
  } catch (error) {
    await setFeed($, station.slug, {
      status: 'error',
      videos: current?.videos ?? [],
      fetchedAt: current?.fetchedAt ?? 0,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

function loadAll($: EngineInterface, force = false) {
  return Promise.all(STATIONS.map(station => loadStation($, station, force)))
}

function startTicker($: EngineInterface) {
  ticker?.cancel()
  ticker = $.clock.every(150, () => {
    frame++
    $.ui.invalidate('ui.render')
  })
}

function stopTicker() {
  ticker?.cancel()
  ticker = undefined
}

async function switchTo($: EngineInterface, index: number) {
  const wrapped = (index + CHANNELS.length) % CHANNELS.length
  await update($, channel, () => wrapped)
  await update($, video, () => 0)
  await update($, staticUntil, () => Date.now() + STATIC_MS)
}

async function step($: EngineInterface, by: number) {
  const list = videosOf(await read($, feeds), await read($, channel))
  if (list.length === 0) return
  await update($, video, n => (n + by + list.length) % list.length)
}

async function turnOn($: EngineInterface) {
  await update($, isOn, () => true)
  await update($, staticUntil, () => Date.now() + STATIC_MS)
  const opened = await $.ui.open({ id: PANE, title: 'Retro TV', rows: 30, columns: 64 })
  startTicker($)
  void loadAll($)
  return opened
}

async function turnOff($: EngineInterface) {
  stopTicker()
  await update($, isOn, () => false)
  await $.ui.close({ id: PANE })
}

async function openInBrowser($: EngineInterface, url: string): Promise<boolean> {
  const tries: string[][] = []
  try {
    const { stdout } = await $.process.run(['uname'], { timeoutMs: 3000 })
    tries.push(stdout.trim() === 'Darwin' ? ['open', url] : ['xdg-open', url])
  } catch {
    tries.push(['rundll32', 'url.dll,FileProtocolHandler', url])
  }
  for (const argv of tries) {
    try {
      const { exitCode } = await $.process.run(argv, { timeoutMs: 10000 })
      if (exitCode === 0) return true
    } catch {
      // try the next opener
    }
  }
  return false
}

function guideText(all: Record<string, Feed>): string {
  return CHANNELS.map((picked, index) => {
    const list = videosOf(all, index)
    const newest = list[0]
    const label = `CH ${String(index).padStart(2, '0')}  ${picked.name}`
    return newest === undefined ? `${label}: (no signal yet)` : `${label}: ${newest.title}`
  }).join('\n')
}

export const register: Register = (on, options) => {
  const tvUrl = typeof options.tvUrl === 'string' && options.tvUrl !== '' ? options.tvUrl : 'https://jeffclouse77.github.io/claudetron/'

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'tv',
      description: 'Turn the retro TV on or off, or tune it: /tv braves, /tv 3, /tv guide, /tv off',
      argumentHint: '[channel | guide | off]',
      immediate: true,
    })
    // A hot reload drops the module's timer: start it again if the set was on.
    if (await read($, isOn)) startTicker($)

    return next(e)
  })

  on('command.run', { command: 'tv' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    const wasOn = await read($, isOn)

    if (arg === 'off' || (arg === "" && wasOn)) {
      await turnOff($)
      return { text: 'TV off. *click* ...the picture shrinks to a dot.' }
    }
    if (arg === 'guide') {
      await loadAll($)
      return { text: `TV GUIDE\n${guideText(await read($, feeds))}` }
    }
    if (arg === 'refresh') {
      void loadAll($, true)
      if (!wasOn) await turnOn($)
      return { text: 'Retuning every channel for the newest uploads.' }
    }
    if (arg !== '') {
      const index = tune(arg)
      if (index === undefined) {
        return { text: `No channel "${arg}". Try: ${CHANNELS.map(c => c.slug).join(', ')}, or 0-${CHANNELS.length - 1}.` }
      }
      await switchTo($, index)
    }
    const opened = await turnOn($)
    const name = CHANNELS[await read($, channel)]?.name ?? ''
    if (!opened.isPlaced) {
      $.ui.toast('Retro TV is on, but this window has no room for it. Widen the terminal.')
    }
    return { text: `TV on: CH ${String(await read($, channel)).padStart(2, '0')} ${name}.` }
  })

  on('ui.close', async ($, e, next) => {
    if (e.id === PANE) {
      stopTicker()
      await update($, isOn, () => false)
    }
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const all = await read($, feeds)
    const index = await read($, channel)
    const pick = await read($, video)
    const until = await read($, staticUntil)
    const picked = CHANNELS[index] ?? CHANNELS[0]!
    const list = videosOf(all, index)
    const status = statusOf(all, index)
    const current = list[Math.min(pick, Math.max(0, list.length - 1))]
    const now = Date.now()
    const number = String(index).padStart(2, '0')

    const body = e.props.bodyColumns
    const screenColumns = Math.max(20, Math.min(56, body - 16))
    const screenRows = Math.max(7, Math.min(15, Math.round(screenColumns * 0.36)))
    const textWidth = screenColumns - 6

    let mode: Screen['mode'] = 'picture'
    let lines: string[]
    if (now < until) {
      mode = 'static'
      lines = [` CH ${number} `]
    } else if (current === undefined) {
      mode = 'bars'
      lines =
        status === 'error'
          ? [' NO SIGNAL ', '', ` ${all[picked.slug]?.error ?? 'feed unreachable'} `.slice(0, textWidth)]
          : [' PLEASE STAND BY ', '', ` tuning CH ${number} `]
    } else {
      const title = wrap(plain(current.title), textWidth, Math.max(1, screenRows - 6))
      lines = [
        `CH ${number}  ${picked.name}`,
        '',
        ...title,
        '',
        `${picked.slug === 'mix' ? `${current.channel} · ` : ''}${age(current.published, now)} · ${pick + 1}/${list.length}`,
        '',
        '▶ press W to watch',
      ]
    }

    const watch = current === undefined ? undefined : watchUrl(tvUrl, picked, list, Math.min(pick, list.length - 1))
    const antennaPad = ' '.repeat(Math.max(0, Math.floor(screenColumns / 2) - 2))

    const { Box, Text, Button, Link } = $.ui.resolve(e)
    const pressWatch = async () => {
      if (watch === undefined) return
      const opened = await openInBrowser($, watch)
      $.ui.toast(opened ? `Now playing: ${current?.title ?? ''}` : `Open this to watch: ${watch}`)
    }

    let screen = null
    if (e.surface === 'terminal') {
      const { Raster } = $.ui.resolve(e)
      const cells = screenCells({
        columns: screenColumns,
        rows: screenRows,
        mode,
        lines,
        roll: frame % (screenRows + 6),
        seed: frame * 7919 + 1,
      })
      screen = <Raster key="tube" columns={screenColumns} rows={screenRows} cells={cellsBase64(cells)} />
    }

    const guide = list.slice(0, 6).map((item, k) => (
      <Button key={`vid-${item.id}`} plain onPress={() => update($, video, () => k)}>
        <Text color={k === pick ? AMBER : undefined}>{k === pick ? '▶ ' : '  '}</Text>
        {plain(item.title).slice(0, Math.max(10, body - 14))} <Text dimColor>{age(item.published, now)}</Text>
      </Button>
    ))

    return (
      <Box flexDirection="column">
        <Text color="#9a9a9a">{`${antennaPad}\\   /`}</Text>
        <Text color="#9a9a9a">{`${antennaPad} \\ /`}</Text>
        <Box borderStyle="round" borderColor={WOOD} flexDirection="row" paddingX={1} gap={1} alignSelf="flex-start">
          <Box flexDirection="column">
            <Box borderStyle="double" borderColor="#444444">
              {screen ?? (
                <Box flexDirection="column" backgroundColor={GLASS} width={screenColumns} paddingX={1} paddingY={1}>
                  {lines.map(line => (
                    <Text color={mode === 'picture' ? PHOSPHOR : '#ffffff'}>{line === '' ? ' ' : line}</Text>
                  ))}
                </Box>
              )}
            </Box>
            <Text color={BRASS} bold>
              {' CLAUDETRON '}
              <Text color={WOOD}>{'· solid state · 19" ·'}</Text>
            </Text>
          </Box>
          <Box flexDirection="column" borderStyle="single" borderColor={WOOD_DARK} paddingX={1} alignItems="center">
            <Text dimColor>CH</Text>
            <Text color={AMBER} bold>
              {number}
            </Text>
            <Text color={BRASS}>◉</Text>
            <Text dimColor>VOL</Text>
            <Text color={BRASS}>◎</Text>
            <Text color={WOOD}>≡≡≡</Text>
            <Text color={WOOD}>≡≡≡</Text>
          </Box>
        </Box>
        <Text color={WOOD_DARK}>{`  ╨${' '.repeat(Math.max(1, screenColumns + 6))}╨`}</Text>
        <Box flexDirection="row" flexWrap="wrap" gap={1}>
          <Button key="prev-ch" hotkey="p" onPress={() => switchTo($, index - 1)}>◀ CH</Button>
          <Button key="next-ch" hotkey="n" onPress={() => switchTo($, index + 1)}>CH ▶</Button>
          <Button key="prev-vid" hotkey="k" onPress={() => step($, -1)}>▲</Button>
          <Button key="next-vid" hotkey="j" onPress={() => step($, 1)}>▼</Button>
          <Button key="watch" hotkey="w" variant="primary" onPress={pressWatch}>▶ WATCH</Button>
          <Button key="refresh" hotkey="r" onPress={() => loadAll($, true)}>⟳</Button>
          <Button key="off" hotkey="x" onPress={() => turnOff($)}>⏻ OFF</Button>
        </Box>
        {watch !== undefined && <Link href={watch} label="open the CRT player in your browser" />}
        <Text dimColor>{`CH ${number} ${picked.name} · newest uploads`}</Text>
        <Box flexDirection="column">{guide}</Box>
      </Box>
    )
  })
}
