import { expect, mock, test } from 'claude-code/testing'

import { cellsBase64, findChannelId, parseFeed, tune, watchUrl, wrap } from '../hooks/tv'

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
  expect(tune('braves')).toBe(2)
  expect(tune('0')).toBe(0)
  expect(tune('cubs')).toBe(undefined)
  const url = new URL(watchUrl('https://example.github.io/tv/', { slug: 'braves', name: 'ATLANTA BRAVES', handle: '@Braves' }, videos, 1))
  expect(url.searchParams.get('v')).toBe('zzz999YYY88')
  expect(url.searchParams.get('list')).toBe('zzz999YYY88,abc123DEF45')
  expect(wrap('one two three four', 9, 2)).toEqual(['one two', 'three…'])
  expect(cellsBase64(Uint32Array.of(0x2588, 0xff8800, 0x01000000))).toBe('iCUAAACI/wAAAAAB')
})

test('/tv braves tunes the set and the pane shows the newest upload on every surface', async ($, on) => {
  mock.store(on)
  mock.clock(on)
  const opened: string[] = []
  on('ui.open', ($, e) => {
    opened.push(e.id)
    return { value: { isPlaced: true } }
  })
  on('ui.close', () => ({ value: undefined }))
  on('http.fetch', ($, e) => {
    if (e.url.includes('/@')) return { value: { status: 200, ok: true, headers: {}, text: '"externalId":"UCabcdefghijklmnopqrstuv"' } }
    return { value: { status: 200, ok: true, headers: {}, text: FEED } }
  })

  const answer = await $.command.run({ ...RUN, args: 'braves' })
  expect(answer.text).toContain('ATLANTA BRAVES')
  expect(opened).toEqual(['retro-tv'])

  // The guide waits for every feed to land.
  const guide = await $.command.run({ ...RUN, args: 'guide' })
  expect(guide.text).toContain('Braves walk it off')

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ key: 'watch' })).toBeDefined()
    expect(await ui.find({ type: 'Button', text: /walk it off/ })).toBeDefined()
    await ui.press({ key: 'next-vid' })
    await ui.unmount()
  }

  const off = await $.command.run({ ...RUN, args: 'off' })
  expect(off.text).toContain('TV off')
})
