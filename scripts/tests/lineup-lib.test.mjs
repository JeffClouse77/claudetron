import assert from 'node:assert/strict'
import { test } from 'node:test'

import { findChannelId, fromRelative, newestFirst, parseFeed, parseSearch } from '../lineup-lib.mjs'

const NOW = Date.parse('2026-10-13T12:00:00Z')

test('reads the channel id off a channel page', () => {
  assert.equal(findChannelId('..."externalId":"UCabcdefghijklmnopqrstuv",...'), 'UCabcdefghijklmnopqrstuv')
  assert.equal(findChannelId('<html>nothing</html>'), undefined)
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
    { id: 'zzz999YYY88', title: 'Claude does a thing', published: '2026-10-13T09:00:00.000Z', channel: 'Anthropic' },
  ])
})

test('turns relative times into dates and sorts newest first', () => {
  assert.equal(fromRelative('Streamed 2 days ago', NOW), '2026-10-11T12:00:00.000Z')
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
