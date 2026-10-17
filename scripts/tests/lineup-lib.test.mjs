import assert from 'node:assert/strict'
import { test } from 'node:test'

import { blend, channelTitle, findChannelId, fromRelative, newestFirst, parseFeed, parseSearch } from '../lineup-lib.mjs'

const NOW = Date.parse('2026-10-13T12:00:00Z')

test('reads the channel id off a channel page', () => {
  assert.equal(findChannelId('..."externalId":"UCabcdefghijklmnopqrstuv",...'), 'UCabcdefghijklmnopqrstuv')
  assert.equal(findChannelId('<html>nothing</html>'), undefined)
  assert.equal(channelTitle('<meta property="og:title" content="Atlanta Braves &amp; Co">'), 'Atlanta Braves & Co')
})

test('reads an uploads feed', () => {
  const xml = `<feed><entry><yt:videoId>abc123DEF45</yt:videoId><title>Braves walk it off &amp; clinch</title>
    <author><name>Atlanta Braves</name></author><published>2026-10-12T22:00:00+00:00</published></entry></feed>`
  assert.deepEqual(parseFeed(xml, 'BRAVES'), [
    { id: 'abc123DEF45', title: 'Braves walk it off & clinch', published: '2026-10-12T22:00:00+00:00', channel: 'Atlanta Braves' },
  ])
})

test('reads search results out of ytInitialData', () => {
  const data = {
    contents: {
      sectionList: [
        { videoRenderer: { videoId: 'zzz999YYY88', title: { runs: [{ text: 'Claude does ' }, { text: 'a thing' }] }, publishedTimeText: { simpleText: '3 hours ago' }, ownerText: { runs: [{ text: 'Anthropic' }] } } },
        { videoRenderer: { videoId: 'live0000000', title: { runs: [{ text: 'Live now' }] } } },
        { videoRenderer: { videoId: 'zzz999YYY88', title: { runs: [{ text: 'duplicate' }] }, publishedTimeText: { simpleText: '1 day ago' } } },
      ],
    },
  }
  const html = `<script>var ytInitialData = ${JSON.stringify(data)};</script>`
  assert.deepEqual(parseSearch(html, NOW), [
    { id: 'zzz999YYY88', title: 'Claude does a thing', published: '2026-10-13T09:00:00.000Z', channel: 'Anthropic', ageText: '3 hours ago' },
  ])
})

test('reads the newer lockup layout YouTube uses on channel pages', () => {
  const lockup = {
    lockupViewModel: {
      contentType: 'LOCKUP_CONTENT_TYPE_VIDEO',
      contentId: 'lockup12345',
      metadata: {
        lockupMetadataViewModel: {
          title: { content: 'Falcons win in overtime' },
          metadata: { contentMetadataViewModel: { metadataRows: [{ metadataParts: [{ text: { content: '120K' } }, { text: { content: '2d ago' } }] }] } },
        },
      },
    },
  }
  const html = `var ytInitialData = ${JSON.stringify({ items: [lockup] })};`
  const [video] = parseSearch(html, NOW)
  assert.equal(video.id, 'lockup12345')
  assert.equal(video.title, 'Falcons win in overtime')
  assert.equal(video.published, '2026-10-11T12:00:00.000Z')
  assert.equal(video.channel, '')
})

test('turns relative times into dates and sorts newest first', () => {
  assert.equal(fromRelative('Streamed 2 days ago', NOW), '2026-10-11T12:00:00.000Z')
  assert.equal(fromRelative('5d ago', NOW), '2026-10-08T12:00:00.000Z')
  assert.equal(fromRelative('3h ago', NOW), '2026-10-13T09:00:00.000Z')
  assert.equal(fromRelative('2mo ago', NOW), '2026-08-14T12:00:00.000Z')
  assert.equal(fromRelative('45m ago', NOW), '2026-10-13T11:15:00.000Z')
  const sorted = newestFirst(
    [
      { id: 'a', published: '2026-10-01T00:00:00Z' },
      { id: 'b', published: '2026-10-05T00:00:00Z' },
      { id: 'a', published: '2026-10-01T00:00:00Z' },
    ],
    5,
  )
  assert.deepEqual(sorted.map(v => v.id), ['b', 'a'])
})

test('blends sources so no single one fills the channel', () => {
  const at = day => `2026-10-${String(day).padStart(2, '0')}T00:00:00Z`
  const busy = Array.from({ length: 10 }, (_, i) => ({ id: `busy${i}`, published: at(20 - i) }))
  const quiet = [{ id: 'quiet0', published: at(1) }, { id: 'quiet1', published: at(2) }]
  const mixed = blend([busy, quiet], 6)
  assert.equal(mixed.length, 6)
  assert.ok(mixed.some(v => v.id.startsWith('quiet')), 'the quiet source still gets a turn')
  assert.equal(mixed[0].id, 'busy0')
})
