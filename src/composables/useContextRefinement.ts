import type { AppState } from '../types'
import { ref } from 'vue'

// Local dev vs production endpoint configuration
const ENDPOINTS = {
  local: 'http://localhost:8000',
  production: 'https://deepseek.trustee.health'
}

export function useContextRefinement() {
  // Track refinement status
  const isRefining = ref(false)
  const refinementError = ref<string | null>(null)
  const lastRefinementTime = ref<Date | null>(null)

  /**
   * Refines the patient timeline context based on the user query
   * using the DeepSeek reasoning engine
   *
   * @param timeline The full patient timeline text (markdown format)
   * @param query The user's query to focus the context around
   * @param maxContextLength Maximum desired length of the returned context
   * @param useLocalEndpoint Whether to use the local or production endpoint
   * @returns The refined, more relevant context
   */
  const refineContext = async (
    timeline: string,
    query: string,
    maxContextLength: number = 2000,
    useLocalEndpoint: boolean = false
  ): Promise<string> => {
    isRefining.value = true
    refinementError.value = null

    try {
      const baseUrl = useLocalEndpoint ? ENDPOINTS.local : ENDPOINTS.production
      const endpoint = `${baseUrl}/process-context`

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          patient_data: { timeline },
          query,
          max_context_length: maxContextLength
        })
      })

      if (!response.ok) {
        throw new Error(`DeepSeek API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      lastRefinementTime.value = new Date()

      return data.relevant_context
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error during context refinement'
      refinementError.value = errorMessage
      console.error('Context refinement error:', error)

      // Return the original timeline if refinement fails
      return `Error refining context: ${errorMessage}\n\nOriginal timeline:\n${timeline}`
    } finally {
      isRefining.value = false
    }
  }

  /**
   * Updates the system message in the chat history with refined context
   *
   * @param appState The application state containing the chat history
   * @param refinedContext The refined context to use in the system message
   * @param timeRange Optional time range information to include in the system message
   */
  const updateSystemMessageWithRefinedContext = (
    appState: AppState,
    refinedContext: string,
    timeRange?: { start: string; end: string }
  ) => {
    if (appState.chatHistory.length > 0 && appState.chatHistory[0].role === 'system') {
      // Replace existing system message
      const timeRangeText = timeRange ? ` (${timeRange.start} to ${timeRange.end})` : ''
      appState.chatHistory[0].content = `Timeline context${timeRangeText}:\n\n${refinedContext}`
    } else {
      // Insert new system message at the beginning
      const timeRangeText = timeRange ? ` (${timeRange.start} to ${timeRange.end})` : ''
      appState.chatHistory.unshift({
        role: 'system',
        content: `Timeline context${timeRangeText}:\n\n${refinedContext}`
      })
    }
  }

  /**
   * Process a timeline chunk and user query to prepare
   * the most relevant context for the LLM
   *
   * @param appState The application state
   * @param query The user's current query
   * @param useLocalEndpoint Whether to use the local or production endpoint
   * @param maxContextLength Maximum desired length of the returned context
   */
  const prepareRelevantContext = async (
    appState: AppState,
    query: string,
    useLocalEndpoint: boolean = false,
    maxContextLength: number = 2000
  ) => {
    isRefining.value = true

    try {
      // Determine what timeline content to use
      let timelineContent: string
      let timeRange: { start: string; end: string } | undefined

      if (appState.hasChunkedTimeline && appState.timelineChunks.length > 0) {
        // Use the current active chunk
        const currentChunk = appState.timelineChunks[0] // or whatever the active chunk is
        timelineContent = currentChunk.content
        timeRange = currentChunk.dateRange
      } else {
        // Use the full timeline
        timelineContent = appState.timeline
      }

      // Call the refinement API
      const refinedContext = await refineContext(
        timelineContent,
        query,
        maxContextLength,
        useLocalEndpoint
      )

      // Add this line to see the refined context
      console.log('Refined context from DeepSeek uc:', refinedContext)

      // Update the system message with the refined context
      updateSystemMessageWithRefinedContext(appState, refinedContext, timeRange)

      return refinedContext
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown context refinement error'
      refinementError.value = errorMessage
      console.error('Failed to prepare relevant context:', error)
      return null
    } finally {
      isRefining.value = false
    }
  }

  return {
    isRefining,
    refinementError,
    lastRefinementTime,
    refineContext,
    updateSystemMessageWithRefinedContext,
    prepareRelevantContext
  }
}
