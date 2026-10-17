# Claudetron Retro TV: Project Plan

## Goal

Bring up an old-school CRT TV with one command, inside Claude Code and regular
Claude (claude.ai), and use it to play the newest YouTube videos from:

| Ch | Station | How videos are found |
| --- | --- | --- |
| 00 | Your YouTube (default) | Your signed-in YouTube home page, sent by a bookmarklet |
| 01 | Claude AI | Blend: `@anthropic-ai` uploads + searches "Claude AI", "Claude Code" |
| 02 | AI news | Blend: three AI-news searches |
| 03 | Atlanta sports | Blend: channels 04-07 + search "Atlanta sports news" |
| 04 | Atlanta Braves | `@Braves` uploads |
| 05 | Atlanta Falcons | `@AtlantaFalcons` uploads |
| 06 | Atlanta Hawks | `@ATLHawks` uploads |
| 07 | Atlanta United | `@AtlantaUnited` uploads |

The channels fill themselves: nobody loads a list of videos by hand.

## The constraint that shapes the design

Neither Claude Code nor claude.ai can play video in its own window. The terminal
draws text and colored cells, and claude.ai artifacts block YouTube embeds. So
the work is split in two:

- **The TV set** (channels, titles, the CRT look) lives inside Claude.
- **The picture** (actual video playback) plays on a CRT-styled web page that
  opens in a browser tab beside Claude.

## Components

### 0. Automatic lineup: `config/`, `scripts/`, `.github/workflows/lineup.yml`

- `config/stations.json` names each station: a YouTube `handle` (read its
  uploads feed), a search `query` (newest uploads on that topic), or both
  (search is the fallback when the channel can't be read).
- `scripts/update-lineup.mjs` finds up to 15 newest videos per station and
  writes `docs/lineup.json`. A station that fails keeps last run's videos.
- The GitHub workflow runs it every hour, on any change to the config, and on
  demand from the Actions tab, then commits the new lineup.
- The player page, the Claude Code mod and the claude.ai skill all read that
  one `lineup.json`. The mod falls back to reading the channel feeds itself
  when the page can't be reached.

### 0b. Your YouTube channel: bookmarklet on the player page

YouTube's home feed exists only for a signed-in browser and has no API, so
the job cannot read it. The player page offers a bookmarklet: run on
youtube.com, it reads the video cards (both of YouTube's card layouts; ads
and Shorts skipped, at most 40) and opens the TV with `?home=1&list=…&meta=…`.
The page saves that to localStorage as CH 00 YOUR YOUTUBE, where the TV starts, drops the long
address, and reopens it later with `?ch=home`. No login or cookie is touched.

### 1. Claude Code mod: `retro-tv/`

| File | Job |
| --- | --- |
| `.claude-plugin/plugin.json` | Manifest; `tvUrl` setting for the player page |
| `hooks/hooks.json` | Points at the hooks module |
| `hooks/register.tsx` | `/tv` command, the TV pane, buttons, feed loading |
| `hooks/tv.ts` | Pure helpers: channel list, feed parsing, CRT screen drawing |
| `types/index.d.ts` | Shape of the TV's saved state |
| `tests/tv.test.ts` | Tests for parsing, tuning and the pane on terminal and desktop |

**Commands**

| Command | Effect |
| --- | --- |
| `/tv` | Turn the set on or off |
| `/tv braves`, `/tv 3` | Tune a channel by name or number |
| `/tv home` | Open the TV in the browser on YOUR YOUTUBE |
| `/tv guide` | Print the lineup in the transcript |
| `/tv refresh` | Re-pull every channel's feed |
| `/tv off` | Turn it off |

**Pane keys:** `n`/`p` channel, `j`/`k` video, `w` watch, `r` refresh, `x` off.

**How it gets videos (no API key):**
1. Read `lineup.json` from the player page; refresh when older than 15 minutes.
2. If that fails, read each channel's public uploads feed straight from YouTube
   (topic-only stations then wait for the lineup).

**Watch:** builds a link to the player page carrying the picked video and the
rest of the channel as a queue, then opens it in the default browser.

### 2. CRT player page: `docs/index.html`

A static page served by GitHub Pages at
`https://jeffclouse77.github.io/claudetron/`.

- Loads `lineup.json` on its own and opens on CH 00; `?ch=braves` opens a channel.
- Still takes `?v=<id>&list=<ids>&ch=<station>&t=<title>` links from the mod.
- Plays through a `youtube-nocookie.com` embed inside a curved, scanlined tube.
- Channel knob and CH ▲▼ buttons change station, ◀ ▶ change video; power
  button, static bursts, on-screen channel number, TV guide with every station.
- With no link parameters it shows color bars and a box to paste any YouTube link.

### 3. claude.ai skill: `claude-ai-skill/retro-tv/SKILL.md`

`/retro-tv` (or `/retro-tv hawks`) makes Claude read `lineup.json`, reply with
a TV-guide lineup, and give a **Turn on the TV** link (`?ch=<slug>`).

### 4. Distribution: `.claude-plugin/marketplace.json`

Makes this repo a plugin marketplace so the mod installs with one command.

## Setup checklist

- [ ] Push this repo to `github.com/jeffclouse77/claudetron` (branch `main`)
- [ ] GitHub → Settings → Pages → Deploy from a branch → `main`, folder `/docs`
- [ ] GitHub → Actions → Update TV lineup → Run workflow (fills the first lineup)
- [ ] Claude Code: `/plugin install retro-tv --marketplace jeffclouse77/claudetron`
- [ ] Claude Code: run `/tv` and confirm all five stations load
- [ ] claude.ai: zip `claude-ai-skill/retro-tv`, upload under Settings → Capabilities → Skills
- [ ] claude.ai: run `/retro-tv` and open the link

## Status

| Item | State |
| --- | --- |
| Mod passes `claude plugin validate` | Done |
| Mod type-checks | Done |
| Mod tests (4) pass on terminal and desktop, lineup and fallback paths | Done |
| Lineup parser tests (4) pass | Done |
| Player page loads a sample lineup, tunes `?ch=`, shows NO SIGNAL for an empty station | Done |
| Bookmarklet on a mock YouTube page: both card layouts read, ad and Short skipped, CH 00 saved and reopened with `?ch=home` | Done |
| Bookmarklet on the real youtube.com | **Not yet tested** (YouTube unreachable from the build sandbox) |
| Player page layout checked at desktop and phone width | Done |
| Live YouTube feeds, search and playback | **Not yet tested** (YouTube was unreachable from the build sandbox); the first Actions run is the live test |
| Channel handles confirmed | **Not yet confirmed**; a wrong one shows "NO SIGNAL" on that channel |

## Known limits

- Video plays in a browser tab, not inside the terminal or the claude.ai chat.
- Browsers may block sound on autoplay; press play once on the first video.
- `/tv guide` lists what has loaded so far; run it again if a channel is still tuning.
- Topic search reads YouTube's results page, which YouTube can change; if a
  topic station goes quiet, the job keeps its last videos and the scraper in
  `scripts/lineup-lib.mjs` needs a look.
- GitHub pauses scheduled workflows after 60 days with no repo activity; the
  lineup commits count as activity, so this only matters if every run fails.

## Next steps

1. Run the setup checklist; check the first Actions run's log for any station
   marked `kept` and fix its handle or query in `config/stations.json`.
2. Show video thumbnails on the tube in terminals that support images (kitty, Ghostty).
3. Optional "new upload" toast in Claude Code when a followed channel posts.
4. Remember the last channel between sessions.
