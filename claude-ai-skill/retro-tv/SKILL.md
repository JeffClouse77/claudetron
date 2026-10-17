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
| 00 | home | Your YouTube: the person's own YouTube home page (the default) |
| 01 | claude | Claude AI: Anthropic's channel plus Claude AI and Claude Code videos |
| 02 | ai-news | AI news from across YouTube |
| 03 | atl-sports | Atlanta sports: Braves, Falcons, Hawks, United and local sports news |
| 04 | braves | Atlanta Braves |
| 05 | falcons | Atlanta Falcons |
| 06 | hawks | Atlanta Hawks |
| 07 | united | Atlanta United |

## Steps

1. Work out the channel: `/retro-tv` alone means the TV as it starts (CH 00,
   your YouTube); `/retro-tv hawks` (or a team, topic or number) means that one.
   For CH 00 follow "Your YouTube" below instead of steps 2-3.
2. Fetch `https://jeffclouse77.github.io/claudetron/lineup.json` and read the
   matching station's first few videos (title, channel, published time). If
   the fetch fails, skip the lineup and just give the link.
3. Reply with a short TV-guide style lineup and the link as **▶ Turn on the TV**:
   - the TV as it starts: `https://jeffclouse77.github.io/claudetron/`
   - one channel: `https://jeffclouse77.github.io/claudetron/?ch=<slug>`

## Your YouTube (`/retro-tv home`, "my YouTube", "my feed")

This channel is the person's own YouTube home page, so it is not in
`lineup.json` and you cannot read it. Give the link
`https://jeffclouse77.github.io/claudetron/?ch=home` and say: it plays the
videos they last sent from YouTube in that browser; to fill or refresh it,
open youtube.com signed in and click the **Send to Claudetron** bookmark (set up
once from the TV page's "Your YouTube channel" box).

Videos can't play inside a claude.ai artifact (YouTube embeds are blocked
there), so always give the link: it opens the TV in a browser tab beside Claude.
