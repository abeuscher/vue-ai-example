import OpenAI from 'openai'

export type ChatHistoryItem = OpenAI.Chat.ChatCompletionMessageParam
export type ChatHistory = ChatHistoryItem[]

export const MAX_SIZE = 1024 * 1024 * 4
export const TOKEN_LIMIT = 100000
export const PAUSE_THRESHOLD = 1500

export interface ValidationResult {
  isValid: boolean
  error?: string
  processedContent?: string | TimelineChunk[]
}

export interface TimelineChunk {
  epoch: number
  dateRange: {
    start: string
    end: string
  }
  content: string
  tokenCount: number
}

type AccessObject = {
  type: string
  actions: string[]
  locations: string[]
  purpose: string
}

declare global {
  interface Window {
    webkitSpeechRecognition: any
    SpeechRecognition: any
  }
}

export interface AppState {
  chatHistory: ChatHistory
  editBox: number[]
  userName: string
  message: string
  messageType: string
  isLoading: boolean
  isMessage: boolean
  isModal: boolean
  jwt: string
  isAuthorized: boolean
  isSaving: boolean
  popupContent: string
  popupContentFunction: Function
  activeQuestion: OpenAI.Chat.ChatCompletionMessageParam
  uri: string
  writeuri: string
  localStorageKey: string
  access: AccessObject[]
  currentQuery: string
  currentFile: File | null
  selectedAI: string
  timeline: string
  timelineChunks: TimelineChunk[]
  selectedEpoch: number
  hasChunkedTimeline: boolean
}
export interface LogEntry {
  timestamp: number
  type: 'message' | 'context_switch' | 'system_event'
  content: ChatHistoryItem | string | TimelineChunk
  metadata: {
    activeChunkIndex?: number
    dateRange?: {
      start: string
      end: string
    }
    event?: string
  }
}
export interface TranscriptSection {
  type: 'conversation' | 'context' | 'timeline' | 'audit' | 'session' | 'signature'
  content: string
}
