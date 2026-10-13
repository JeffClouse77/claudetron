# Claudetron Retro TV: Project Plan

## Goal

Bring up an old-school CRT TV with one command, inside Claude Code and regular
Claude (claude.ai), and use it to play the newest YouTube videos from:

| Ch | Station | YouTube handle |
| --- | --- | --- |
| 00 | All channels, newest first | (mix of the five below) |
| 01 | Claude / Anthropic | `@anthropic-ai` |
| 02 | Atlanta Braves | `@Braves` |
| 03 | Atlanta Falcons | `@AtlantaFalcons` |
| 04 | Atlanta Hawks | `@ATLHawks` |
| 05 | Atlanta United | `@ATLUTD` |

## The constraint that shapes the design

Neither Claude Code nor claude.ai can play video in its own window. The terminal
draws text and colored cells, and claude.ai artifacts block YouTube embeds. So
the work is split in two:

- **The TV set** (channels, titles, the CRT look) lives inside Claude.
- **The picture** (actual video playback) plays on a CRT-styled web page that
  opens in a browser tab beside Claude.

## Components

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
| `/tv guide` | Print the lineup in the transcript |
| `/tv refresh` | Re-pull every channel's feed |
| `/tv off` | Turn it off |

**Pane keys:** `n`/`p` channel, `j`/`k` video, `w` watch, `r` refresh, `x` off.

**How it gets videos (no API key):**
1. Fetch `youtube.com/@handle` once, read the `UC…` channel ID, cache it.
2. Fetch `youtube.com/feeds/videos.xml?channel_id=UC…` (public uploads feed).
3. Parse the newest entries; refresh when older than 15 minutes.

**Watch:** builds a link to the player page carrying the picked video and the
rest of the channel as a queue, then opens it in the default browser.

### 2. CRT player page: `docs/index.html`

A static page served by GitHub Pages at
`https://jeffclouse77.github.io/claudetron/`.

- Reads `?v=<id>&list=<ids>&ch=<station>&t=<title>` from the link.
- Plays through a `youtube-nocookie.com` embed inside a curved, scanlined tube.
- Channel knob, ◀ ▶ buttons, power button, static bursts between videos,
  on-screen channel number, and a lineup list.
- With no link parameters it shows color bars and a box to paste any YouTube link.

### 3. claude.ai skill: `claude-ai-skill/retro-tv/SKILL.md`

`/retro-tv` (or `/retro-tv hawks`) makes Claude search the web for the newest
uploads, collect their video IDs, and reply with a TV-guide lineup plus a
**Turn on the TV** link to the player page.

### 4. Distribution: `.claude-plugin/marketplace.json`

Makes this repo a plugin marketplace so the mod installs with one command.

## Setup checklist

- [ ] Push this repo to `github.com/jeffclouse77/claudetron` (branch `main`)
- [ ] GitHub → Settings → Pages → Deploy from a branch → `main`, folder `/docs`
- [ ] Claude Code: `/plugin install retro-tv --marketplace jeffclouse77/claudetron`
- [ ] Claude Code: run `/tv` and confirm all five stations load
- [ ] claude.ai: zip `claude-ai-skill/retro-tv`, upload under Settings → Capabilities → Skills
- [ ] claude.ai: run `/retro-tv` and open the link

## Status

| Item | State |
| --- | --- |
| Mod passes `claude plugin validate` | Done |
| Mod type-checks | Done |
| Mod tests (2) pass on terminal and desktop | Done |
| Player page layout checked at desktop and phone width | Done |
| Live YouTube feeds and playback | **Not yet tested** (YouTube was unreachable from the build sandbox) |
| Channel handles confirmed | **Not yet confirmed**; a wrong one shows "NO SIGNAL" on that channel |

## Known limits

- Video plays in a browser tab, not inside the terminal or the claude.ai chat.
- Browsers may block sound on autoplay; press play once on the first video.
- `/tv guide` lists what has loaded so far; run it again if a channel is still tuning.
- The claude.ai skill depends on web search finding recent uploads.

## Next steps

1. Run the setup checklist and fix any channel handle that shows "NO SIGNAL"
   (edit `STATIONS` in `retro-tv/hooks/tv.ts`).
2. Let you add or remove channels from `/config` instead of editing code
   (for example Georgia Bulldogs, Atlanta Dream).
3. Show video thumbnails on the tube in terminals that support images (kitty, Ghostty).
4. Optional "new upload" toast when a followed channel posts.
5. Remember the last channel between sessions.
