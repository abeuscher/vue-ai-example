import { estimateTokenCount, postData } from '../utils'

import type { AppState } from '../types'
import { useContextRefinement } from './useContextRefinement'

const sendQuery = async (
  appState: AppState,
  writeMessage: (message: string, type: string) => void,
  uri: string
) => {
  // Skip if no query
  if (!appState.currentQuery || appState.currentQuery.trim() === '') {
    return
  }

  appState.isLoading = true

  try {
    // Find the system message (typically the first one)
    const systemMessageIndex = appState.chatHistory.findIndex((msg) => msg.role === 'system')

    if (systemMessageIndex !== -1) {
      // Get the DeepSeek context refinement functionality
      const { refineContext } = useContextRefinement()

      // Extract the current system message content (the timeline)
      const systemMessage = appState.chatHistory[systemMessageIndex]

      // Determine the timeline content to refine
      let timelineContent = ''

      // Try to extract the actual timeline content by removing any prefixes
      const contentLines = systemMessage.content.split('\n\n')
      if (contentLines.length > 1) {
        // The timeline content is typically after the first \n\n
        timelineContent = contentLines.slice(1).join('\n\n')
      } else {
        timelineContent = systemMessage.content
      }

      // Use the actual timeline from appState if available
      if (appState.timeline) {
        timelineContent = appState.timeline
      }

      // Set a reasonable token limit (adjust based on your LLM's context window)
      const MAX_CONTEXT_LENGTH = 2000

      try {
        writeMessage('Optimizing context with DeepSeek...', 'info')

        // Refine the context based on the current query
        const refinedContext = await refineContext(
          timelineContent,
          appState.currentQuery,
          MAX_CONTEXT_LENGTH,
          true // Use local endpoint for testing (change to false for production)
        )

        // Add this line to see the refined context
        console.log('Refined context from DeepSeek:', refinedContext)

        // Extract any prefix from the original system message (like "Timeline context:")
        let prefix = ''
        if (contentLines.length > 1) {
          prefix = contentLines[0] + '\n\n'
        }

        // Update the system message with refined context
        appState.chatHistory[systemMessageIndex].content = `${prefix}${refinedContext}`

        writeMessage('Context optimized for your query', 'success')
      } catch (error) {
        console.error('DeepSeek refinement error:', error)
        writeMessage('Context optimization failed, using original context', 'warning')
        // Continue with original context if refinement fails
      }
    }

    // Calculate tokens after context refinement
    const chatHistoryTokens = appState.chatHistory.reduce((total, msg) => {
      return total + estimateTokenCount(msg.content)
    }, 0)
    const newQueryTokens = estimateTokenCount(appState.currentQuery || '')
    const totalTokens = chatHistoryTokens + newQueryTokens

    console.log('Token breakdown:', {
      chatHistory: chatHistoryTokens,
      newQuery: newQueryTokens,
      total: totalTokens
    })

    // Only push active question if there is a current query
    if (appState.currentQuery) {
      appState.activeQuestion = {
        role: 'user',
        content: appState.currentQuery
      }
    }

    // Send the query with refined context to the LLM
    const data = await postData(uri, {
      chatHistory: appState.chatHistory,
      newValue: appState.currentQuery
    })

    if (!data || data.message) {
      writeMessage(data ? data.message : 'Failed to get response from AI', 'error')
      appState.activeQuestion = {
        role: 'user',
        content: ''
      }
      return
    }

    appState.chatHistory = data
    appState.activeQuestion = {
      role: 'user',
      content: ''
    }

    appState.currentQuery = ''
    setTimeout(() => {
      window.scrollTo(0, document.body.scrollHeight)
    }, 100)
  } catch (error) {
    console.error('Error during query processing:', error)
    writeMessage(`Error: ${error.message || 'Unknown error'}`, 'error')
  } finally {
    appState.isLoading = false
  }
}

export { sendQuery }
