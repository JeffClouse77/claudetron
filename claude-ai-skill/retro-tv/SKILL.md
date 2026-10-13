---
name: retro-tv
description: Turns on the Claudetron retro TV. Use when the person types /retro-tv, says "turn on the TV", "what's on TV", or asks for the latest Claude/Anthropic, Braves, Falcons, Hawks or Atlanta United videos to watch.
---

# Claudetron Retro TV

The TV is a web page that plays YouTube videos on an old-school CRT screen:
`https://jeffclouse77.github.io/claudetron/`. Your job is to find the newest
videos and hand the person a link that tunes the TV to them.

## Channels

| Slug | Station | YouTube channel |
| --- | --- | --- |
| claude | CLAUDE / ANTHROPIC | youtube.com/@anthropic-ai |
| braves | ATLANTA BRAVES | youtube.com/@Braves |
| falcons | ATLANTA FALCONS | youtube.com/@AtlantaFalcons |
| hawks | ATLANTA HAWKS | youtube.com/@ATLHawks |
| united | ATLANTA UNITED | youtube.com/@ATLUTD |

`/retro-tv` with no channel means all of them, newest first. `/retro-tv braves`
(or any slug) means that one station.

## Steps

1. Search the web for each requested channel's most recent uploads (this week
   first). Keep only videos posted by the official channel above.
2. Take each video's 11-character ID from its URL (`watch?v=ID`, `youtu.be/ID`,
   `shorts/ID`). Never invent an ID: drop a video whose ID you did not see.
3. Order them newest first, at most 15.
4. Build the link:
   `https://jeffclouse77.github.io/claudetron/?v=<first id>&list=<id>,<id>,...&ch=<STATION>&t=<first title>`
   (URL-encode `ch` and `t`; use `ALL CHANNELS` for the mixed lineup).
5. Reply with a short TV-guide style lineup (channel number, station, title,
   how long ago) and the link as **▶ Turn on the TV**.

Videos cannot play inside a claude.ai artifact (it blocks YouTube embeds), so
always give the link: it opens the TV in a browser tab beside Claude.
