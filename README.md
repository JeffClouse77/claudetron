# Claudetron

An old-school CRT television for Claude. Type one command and it plays the
newest **Claude / Anthropic** and **Atlanta sports** (Braves, Falcons, Hawks,
Atlanta United) YouTube videos while you work.

| Where | Command | What it does |
| --- | --- | --- |
| Claude Code | `/tv` | Turns the set on or off in a pane beside your work |
| Claude Code | `/tv braves`, `/tv 3` | Tunes a channel (0 mix, 1 claude, 2 braves, 3 falcons, 4 hawks, 5 united) |
| Claude Code | `/tv guide` | Prints the lineup in the transcript |
| Claude Code | `/tv refresh`, `/tv off` | Re-pulls the feeds, or switches it off |
| claude.ai | `/retro-tv`, `/retro-tv hawks` | Claude finds the newest uploads and hands you a link that tunes the TV |

Inside the Claude Code pane: `n`/`p` change channel, `j`/`k` move through the
videos, `w` plays the picked video, `r` refreshes, `x` turns it off.

Terminals and claude.ai can't play video in their own windows, so **Watch**
opens the CRT player page (`docs/index.html`) in a browser tab beside Claude.

## What's in here

| Path | What it is |
| --- | --- |
| `retro-tv/` | The Claude Code mod (the `/tv` command and the TV pane) |
| `docs/index.html` | The CRT player page, served by GitHub Pages |
| `claude-ai-skill/retro-tv/` | The `/retro-tv` skill for claude.ai |
| `.claude-plugin/marketplace.json` | Lets Claude Code install the mod from this repo |
| `scripts/build.sh` | Validates and tests the mod, zips the claude.ai skill into `dist/` |
| `PLAN.md` | Design, status and next steps |

## Install

1. **Turn on the player page.** In this repo's GitHub settings, open **Pages**,
   choose **Deploy from a branch**, branch `main`, folder `/docs`. The TV then
   lives at `https://jeffclouse77.github.io/claudetron/`. (A different address
   can be set in Claude Code's `/config` under `retro-tv.tvUrl`.)
2. **Claude Code:** at the prompt of a terminal session,

   ```
   /plugin install retro-tv --marketplace jeffclouse77/claudetron
   ```

   answer `y` to add the marketplace, pick the user scope, then type `/tv`.
3. **claude.ai:** upload `dist/retro-tv-skill.zip` under
   **Settings → Capabilities → Skills**, then type `/retro-tv` in any chat.

## Build

```
./scripts/build.sh
```

Needs the `claude` CLI and `zip`.
