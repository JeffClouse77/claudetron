export type Video = {
  id: string
  title: string
  published: string
  channel: string
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
      staticUntil: number
      isOn: boolean
    }
  }
}
