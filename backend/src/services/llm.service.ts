import { PromptService } from './prompt.service'
import { ConversationContext } from '../types'

export class LLMService {
  constructor(private promptService: PromptService) {}

  /**
   * Generate AI response based on user message and context
   * This is a placeholder - replace with actual LLM integration
   */
  async generateResponse(
    userMessage: string,
    context: ConversationContext
  ): Promise<string> {
    // Build prompt with planning rules and context
    const prompt = this.promptService.buildPromptWithRules(userMessage, context)

    // TODO: Replace with actual LLM API call
    // Example: OpenAI, Anthropic, etc.
    console.log('Generated prompt:', prompt)

    // Placeholder response
    return `I understand your message: "${userMessage}". This is a placeholder response. Integrate with your LLM provider (OpenAI, Anthropic, etc.) to generate actual responses.`
  }

  /**
   * Regenerate response for a specific message
   */
  async regenerateResponse(
    messageId: string,
    context: ConversationContext
  ): Promise<string> {
    // Find the original user message that this AI response was answering
    const messageIndex = context.messages.findIndex((m) => m.id === messageId)
    if (messageIndex === -1 || messageIndex === 0) {
      throw new Error('Message not found or invalid')
    }

    // Get the user message that preceded this AI response
    const userMessage = context.messages[messageIndex - 1]
    if (userMessage.type !== 'user') {
      throw new Error('Invalid message context for regeneration')
    }

    // Generate new response
    return this.generateResponse(userMessage.content, context)
  }
}

export const llmService = new LLMService(new PromptService())
