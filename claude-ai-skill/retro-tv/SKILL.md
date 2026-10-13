---
name: retro-tv
description: Turns on the Claudetron retro TV. Use when the person types /retro-tv, says "turn on the TV", "what's on TV", or asks for the latest Claude/Anthropic, Braves, Falcons, Hawks, Atlanta United or Atlanta sports videos to watch.
---

# Claudetron Retro TV

The TV is a web page that plays YouTube videos on an old-school CRT screen:
`https://jeffclouse77.github.io/claudetron/`. It finds its own videos: a job
searches every channel's topic each hour and saves the results to
`https://jeffclouse77.github.io/claudetron/lineup.json`. You never need to
search for videos yourself.

## Channels

| Ch | Slug | Station |
| --- | --- | --- |
| 00 | (none) | All channels, newest first |
| 01 | claude | Claude / Anthropic |
| 02 | claude-news | Claude AI news |
| 03 | braves | Atlanta Braves |
| 04 | falcons | Atlanta Falcons |
| 05 | hawks | Atlanta Hawks |
| 06 | united | Atlanta United |
| 07 | atl-sports | Atlanta sports news |

## Steps

1. Work out the channel: `/retro-tv` alone means all channels; `/retro-tv hawks`
   (or a team, topic or number) means that one.
2. Fetch `https://jeffclouse77.github.io/claudetron/lineup.json` and read the
   matching station's first few videos (title, channel, published time). If
   the fetch fails, skip the lineup and just give the link.
3. Reply with a short TV-guide style lineup and the link as **▶ Turn on the TV**:
   - all channels: `https://jeffclouse77.github.io/claudetron/`
   - one channel: `https://jeffclouse77.github.io/claudetron/?ch=<slug>`

Videos can't play inside a claude.ai artifact (YouTube embeds are blocked
there), so always give the link: it opens the TV in a browser tab beside Claude.
