export type Video = {
  id: string
  title: string
  published: string
  channel: string
}

export type Station = {
  slug: string
  name: string
  /** The official channel, read through its uploads feed. */
  handle?: string
  /** A YouTube search topic, for stations without a channel. */
  query?: string
}

export type Feed = {
  status: 'idle' | 'loading' | 'ok' | 'error'
  videos: Video[]
  fetchedAt: number
  error?: string
}

declare module 'claude-code' {
  interface PluginState {
    'retro-tv': {
      channel: number
      video: number
      feeds: Record<string, Feed>
      stations: Station[]
      lineupAt: number
      staticUntil: number
      isOn: boolean
    }
  }
}
