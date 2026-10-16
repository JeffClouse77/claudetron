import { expect, mock, test } from 'claude-code/testing'

import { STATIONS, cellsBase64, channelsOf, findChannelId, parseFeed, parseLineup, tune, watchUrl, wrap } from '../hooks/tv'

const FEED = `<?xml version="1.0"?><feed>
<entry><yt:videoId>abc123DEF45</yt:videoId><title>Braves walk it off &amp; clinch</title><published>2026-10-12T22:00:00+00:00</published></entry>
<entry><yt:videoId>zzz999YYY88</yt:videoId><title>Postgame: Snitker</title><published>2026-10-11T22:00:00+00:00</published></entry>
</feed>`

const PANE = {
  plugin: 'retro-tv',
  component: 'Pane',
  requestId: 'retro-tv',
  props: {
    title: 'Retro TV',
    isFocused: false,
    bodyColumns: 70,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
} as const

const RUN = {
  command: 'tv',
  origin: { kind: 'composer' },
  presentation: { isFullscreen: true, columns: 160 },
} as const

test('reads a channel page and its uploads feed', async () => {
  expect(findChannelId('{"externalId":"UCabcdefghijklmnopqrstuv"}')).toBe('UCabcdefghijklmnopqrstuv')
  const videos = parseFeed(FEED, 'ATLANTA BRAVES')
  expect(videos.length).toBe(2)
  expect(videos[0]?.title).toBe('Braves walk it off & clinch')
  const channels = channelsOf(STATIONS)
  expect(tune('braves', channels)).toBe(3)
  expect(tune('claude', channels)).toBe(1)
  expect(tune('0', channels)).toBe(0)
  expect(tune('cubs', channels)).toBe(undefined)
  const url = new URL(watchUrl('https://example.github.io/tv/', { slug: 'braves', name: 'ATLANTA BRAVES', handle: '@Braves' }, videos, 1))
  expect(url.searchParams.get('v')).toBe('zzz999YYY88')
  expect(url.searchParams.get('list')).toBe('zzz999YYY88,abc123DEF45')
  expect(wrap('one two three four', 9, 2)).toEqual(['one two', 'three…'])
  expect(cellsBase64(Uint32Array.of(0x2588, 0xff8800, 0x01000000))).toBe('iCUAAACI/wAAAAAB')
})

const LINEUP = JSON.stringify({
  updatedAt: '2026-10-13T21:00:00Z',
  stations: [
    { slug: 'claude', name: 'CLAUDE / ANTHROPIC', videos: [{ id: 'aaaaaaaaaaa', title: 'Introducing Claude', published: '2026-10-13T15:00:00Z', channel: 'Anthropic' }] },
    { slug: 'hawks', name: 'ATLANTA HAWKS', videos: [{ id: 'hhhhhhhhhhh', title: 'Hawks open the season', published: '2026-10-13T02:00:00Z', channel: 'Atlanta Hawks' }] },
    { slug: 'atl-sports', name: 'ATL SPORTS NEWS', videos: [], error: 'no results' },
  ],
})

test('reads the lineup the player page publishes', () => {
  const lineup = parseLineup(LINEUP)
  expect(lineup?.stations.map(s => s.station.slug)).toEqual(['claude', 'hawks', 'atl-sports'])
  expect(lineup?.stations[1]?.videos[0]?.title).toBe('Hawks open the season')
  expect(parseLineup('{"stations": []}')).toBe(undefined)
  expect(parseLineup('not json')).toBe(undefined)
})

test('/tv tunes from the online lineup without touching YouTube', async ($, on) => {
  mock.store(on)
  mock.clock(on)
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.close', () => ({ value: undefined }))
  const asked: string[] = []
  on('http.fetch', ($, e) => {
    asked.push(e.url)
    if (e.url.endsWith('/lineup.json')) return { value: { status: 200, ok: true, headers: {}, text: LINEUP } }
    return { value: { status: 404, ok: false, headers: {}, text: '' } }
  })

  const answer = await $.command.run({ ...RUN, args: 'hawks' })
  expect(answer.text).toContain('CH 02 ATLANTA HAWKS')
  expect(asked).toEqual(['https://jeffclouse77.github.io/claudetron/lineup.json'])

  const guide = await $.command.run({ ...RUN, args: 'guide' })
  expect(guide.text).toContain('Hawks open the season')
  expect(guide.text).toContain('ATL SPORTS NEWS: (no signal yet)')

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ type: 'Button', text: /Hawks open the season/ })).toBeDefined()
    await ui.unmount()
  }
})

test('/tv braves falls back to YouTube feeds when the lineup is offline and the pane shows the newest upload on every surface', async ($, on) => {
  mock.store(on)
  mock.clock(on)
  const opened: string[] = []
  on('ui.open', ($, e) => {
    opened.push(e.id)
    return { value: { isPlaced: true } }
  })
  on('ui.close', () => ({ value: undefined }))
  on('http.fetch', ($, e) => {
    if (e.url.endsWith('/lineup.json')) return { value: { status: 404, ok: false, headers: {}, text: '' } }
    if (e.url.includes('/@')) return { value: { status: 200, ok: true, headers: {}, text: '"externalId":"UCabcdefghijklmnopqrstuv"' } }
    return { value: { status: 200, ok: true, headers: {}, text: FEED } }
  })
  const launched: string[][] = []
  on('process.run', ($, e) => {
    launched.push([...e.argv])
    const stdout = e.argv[0] === 'uname' ? 'Darwin\n' : ''
    return { value: { exitCode: 0, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })

  const answer = await $.command.run({ ...RUN, args: 'braves' })
  expect(answer.text).toContain('ATLANTA BRAVES')
  expect(opened).toEqual(['retro-tv'])

  const guide = await $.command.run({ ...RUN, args: 'guide' })
  expect(guide.text).toContain('Braves walk it off')

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ key: 'watch' })).toBeDefined()
    expect(await ui.find({ type: 'Button', text: /walk it off/ })).toBeDefined()
    await ui.press({ key: 'next-vid' })
    await ui.unmount()
  }

  const home = await $.command.run({ ...RUN, args: 'home' })
  expect(home.text).toContain('YOUR YOUTUBE')
  expect(launched[launched.length - 1]).toEqual(['open', 'https://jeffclouse77.github.io/claudetron/?ch=home'])

  const off = await $.command.run({ ...RUN, args: 'off' })
  expect(off.text).toContain('TV off')
})
