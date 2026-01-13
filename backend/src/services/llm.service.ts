import { GoogleGenAI } from '@google/genai'
import { PromptService } from './prompt.service'
import { ConversationContext } from '../types'

export class LLMService {
  private genAI: GoogleGenAI | null = null
  private modelName: string = 'gemini-2.5-flash'

  constructor(private promptService: PromptService) {
    // Initialize Gemini API
    // The client gets the API key from the environment variable `GEMINI_API_KEY`
    const apiKey = process.env.GEMINI_API_KEY
    if (apiKey) {
      this.genAI = new GoogleGenAI({})
      // Use gemini-2.5-flash model (latest version)
      // Alternative: 'gemini-1.5-pro' for more capable model
      // Or 'gemini-1.5-flash' for faster responses
    } else {
      console.warn('GEMINI_API_KEY not found in environment variables. LLM responses will be placeholders.')
    }
  }

  /**
   * Generate AI response based on user message and context
   */
  async generateResponse(
    userMessage: string,
    context: ConversationContext
  ): Promise<string> {
    // Build prompt with planning rules and context
    const prompt = this.promptService.buildPromptWithRules(userMessage, context)

    // Log the query
    console.log('='.repeat(80))
    console.log('[LLM Service] Generating response')
    console.log('[LLM Service] Model:', this.modelName)
    console.log('[LLM Service] User Message:', userMessage)
    console.log('[LLM Service] Prompt Length:', prompt.length, 'characters')
    console.log('[LLM Service] Full Prompt:', '\n' + prompt)
    console.log('-'.repeat(80))

    // If Gemini is not configured, return placeholder
    if (!this.genAI) {
      console.warn('[LLM Service] Gemini API not configured. Returning placeholder response.')
      return `I understand your message: "${userMessage}". Please configure GEMINI_API_KEY environment variable to enable AI responses.`
    }

    const startTime = Date.now()
    try {
      // Call Gemini API using the new @google/genai package
      console.log('[LLM Service] Calling Gemini API...')
      const response = await this.genAI.models.generateContent({
        model: this.modelName,
        contents: prompt,
      })

      const duration = Date.now() - startTime
      const responseText = response.text || 'No response generated'
      
      // Log the response
      console.log('[LLM Service] API call successful')
      console.log('[LLM Service] Response Time:', duration, 'ms')
      console.log('[LLM Service] Response Length:', responseText.length, 'characters')
      console.log('[LLM Service] Response:', responseText)
      console.log('='.repeat(80))

      return responseText
    } catch (error) {
      const duration = Date.now() - startTime
      console.error('[LLM Service] Error calling Gemini API')
      console.error('[LLM Service] Error Time:', duration, 'ms')
      console.error('[LLM Service] Error Details:', error)
      console.log('='.repeat(80))
      throw new Error(
        error instanceof Error
          ? `Failed to generate response: ${error.message}`
          : 'Failed to generate response from Gemini API'
      )
    }
  }

  /**
   * Generate streaming AI response based on user message and context
   */
  async *generateResponseStream(
    userMessage: string,
    context: ConversationContext
  ): AsyncGenerator<string, void, unknown> {
    // Build prompt with planning rules and context
    const prompt = this.promptService.buildPromptWithRules(userMessage, context)

    // Log the query
    console.log('[LLM Service] Generating streaming response - Model:', this.modelName, '- Prompt length:', prompt.length)

    // If Gemini is not configured, return placeholder
    if (!this.genAI) {
      console.warn('[LLM Service] Gemini API not configured. Returning placeholder response.')
      yield `I understand your message: "${userMessage}". Please configure GEMINI_API_KEY environment variable to enable AI responses.`
      return
    }

    const startTime = Date.now()
    try {
      // Call Gemini API with streaming
      console.log('[LLM Service] Calling Gemini API (streaming)...')
      const stream = await this.genAI.models.generateContentStream({
        model: this.modelName,
        contents: prompt,
      })

      let fullResponse = ''
      let chunkCount = 0
      for await (const chunk of stream) {
        chunkCount++
        const text = chunk.text || ''
        if (text) {
          fullResponse += text
          // Yield immediately for faster initial response
          yield text
        }
      }
      console.log(`[LLM Service] Total chunks received: ${chunkCount}, total text length: ${fullResponse.length}`)

      const duration = Date.now() - startTime
      console.log(`[LLM Service] Streaming complete - ${duration}ms - ${fullResponse.length} chars - ${chunkCount} chunks`)
    } catch (error) {
      const duration = Date.now() - startTime
      console.error(`[LLM Service] Streaming error after ${duration}ms:`, error)
      throw new Error(
        error instanceof Error
          ? `Failed to generate response: ${error.message}`
          : 'Failed to generate response from Gemini API'
      )
    }
  }

  /**
   * Regenerate response for a specific message
   */
  async regenerateResponse(
    messageId: string,
    context: ConversationContext
  ): Promise<string> {
    console.log('[LLM Service] Regenerating response for message:', messageId)
    
    // Find the original user message that this AI response was answering
    const messageIndex = context.messages.findIndex((m) => m.id === messageId)
    if (messageIndex === -1 || messageIndex === 0) {
      console.error('[LLM Service] Message not found or invalid:', messageId)
      throw new Error('Message not found or invalid')
    }

    // Get the user message that preceded this AI response
    const userMessage = context.messages[messageIndex - 1]
    if (userMessage.type !== 'user') {
      console.error('[LLM Service] Invalid message context for regeneration')
      throw new Error('Invalid message context for regeneration')
    }

    console.log('[LLM Service] Original user message:', userMessage.content)
    
    // Generate new response
    return this.generateResponse(userMessage.content, context)
  }
}

export const llmService = new LLMService(new PromptService())
