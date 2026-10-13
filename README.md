# Claudetron

An old-school CRT television for Claude. Type one command and it plays the
newest **Claude / Anthropic** and **Atlanta sports** (Braves, Falcons, Hawks,
Atlanta United) YouTube videos while you work.

| Where | Command | What it does |
| --- | --- | --- |
| Claude Code | `/tv` | Turns the set on or off in a pane beside your work |
| Claude Code | `/tv braves`, `/tv 3` | Tunes a channel by name or number |
| Claude Code | `/tv guide` | Prints the lineup in the transcript |
| Claude Code | `/tv refresh`, `/tv off` | Re-pulls the feeds, or switches it off |
| claude.ai | `/retro-tv`, `/retro-tv hawks` | Claude shows what's on and hands you a link that turns on the TV |
| Any browser | `jeffclouse77.github.io/claudetron` | The TV itself, already tuned |

## Channels find their own videos

You never load a list. Every hour a GitHub job (`.github/workflows/lineup.yml`)
reads `config/stations.json`, finds the newest videos for each channel, and
saves them to `docs/lineup.json` on the TV page. The page, `/tv` in Claude
Code and `/retro-tv` in claude.ai all read that one file.

| Ch | Channel | How it finds videos |
| --- | --- | --- |
| 00 | All channels | The newest from every channel below |
| 01 | Claude / Anthropic | Anthropic's YouTube uploads |
| 02 | Claude AI news | YouTube search: "Claude AI", this week |
| 03 | Atlanta Braves | Braves channel uploads |
| 04 | Atlanta Falcons | Falcons channel uploads |
| 05 | Atlanta Hawks | Hawks channel uploads |
| 06 | Atlanta United | Atlanta United channel uploads |
| 07 | Atlanta sports news | YouTube search: "Atlanta sports news", this week |

A channel with a `handle` reads that YouTube channel's uploads; one with a
`query` searches YouTube for the topic. If a channel can't be read, it falls
back to its search topic, and if that fails too it keeps last hour's videos.

**To add or change a topic,** edit `config/stations.json`, for example:

```json
{ "slug": "dawgs", "name": "GEORGIA BULLDOGS", "handle": "@GeorgiaBulldogs", "query": "Georgia Bulldogs football highlights" }
```

Commit it and the job runs right away. Run it by hand any time from the
repo's **Actions** tab → **Update TV lineup** → **Run workflow**.

Inside the Claude Code pane: `n`/`p` change channel, `j`/`k` move through the
videos, `w` plays the picked video, `r` refreshes, `x` turns it off.

Terminals and claude.ai can't play video in their own windows, so **Watch**
opens the CRT player page (`docs/index.html`) in a browser tab beside Claude.

## What's in here

| Path | What it is |
| --- | --- |
| `retro-tv/` | The Claude Code mod (the `/tv` command and the TV pane) |
| `docs/index.html` | The CRT player page, served by GitHub Pages |
| `docs/lineup.json` | Each channel's newest videos (written by the hourly job) |
| `config/stations.json` | The channels and topics the TV follows |
| `scripts/update-lineup.mjs` | Finds the videos (run by the job; `--dry-run` to preview) |
| `.github/workflows/lineup.yml` | Runs the finder every hour and on config changes |
| `claude-ai-skill/retro-tv/` | The `/retro-tv` skill for claude.ai |
| `.claude-plugin/marketplace.json` | Lets Claude Code install the mod from this repo |
| `scripts/build.sh` | Validates and tests the mod, zips the claude.ai skill into `dist/` |
| `PLAN.md` | Design, status and next steps |

## Install

1. **Turn on the player page.** In this repo's GitHub settings, open **Pages**,
   choose **Deploy from a branch**, branch `main`, folder `/docs`. The TV then
   lives at `https://jeffclouse77.github.io/claudetron/`. (A different address
   can be set in Claude Code's `/config` under `retro-tv.tvUrl`.)
2. **Fill the first lineup.** Open the **Actions** tab, enable workflows if
   asked, then **Update TV lineup** → **Run workflow**. After that it runs
   every hour on its own.
3. **Claude Code:** at the prompt of a terminal session,

   ```
   /plugin install retro-tv --marketplace jeffclouse77/claudetron
   ```

   answer `y` to add the marketplace, pick the user scope, then type `/tv`.
4. **claude.ai:** upload `dist/retro-tv-skill.zip` under
   **Settings → Capabilities → Skills**, then type `/retro-tv` in any chat.

## Build

```
./scripts/build.sh
```

Needs the `claude` CLI, Node 22 and `zip`.
