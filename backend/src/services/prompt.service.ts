import { ConversationContext } from '../types'

export class PromptService {
  /**
   * Builds a prompt with planning rules injected
   */
  buildPromptWithRules(
    userMessage: string,
    context: ConversationContext
  ): string {
    const rules = context.planningRules || []
    const recentMessages = context.messages.slice(-10) // Last 10 messages for context

    let prompt = ''

    // Inject planning rules if they exist
    if (rules.length > 0) {
      prompt += 'PLANNING RULES:\n'
      rules.forEach((rule, index) => {
        prompt += `${index + 1}. ${rule}\n`
      })
      prompt += '\n'
    }

    // Add conversation context
    if (recentMessages.length > 0) {
      prompt += 'CONVERSATION CONTEXT:\n'
      recentMessages.forEach((msg) => {
        prompt += `[${msg.type}]: ${msg.content}\n`
      })
      prompt += '\n'
    }

    // Add current plan state
    if (context.planSections.length > 0) {
      prompt += 'CURRENT PLAN STATE:\n'
      context.planSections.forEach((section, index) => {
        prompt += `Section ${index + 1}${section.locked ? ' [LOCKED]' : ''}: ${section.content}\n`
      })
      prompt += '\n'
    }

    // Add current user message
    prompt += `USER MESSAGE: ${userMessage}\n\n`
    prompt += 'Please provide a helpful response. Remember: AI messages are separate from plan updates unless explicitly applied.'

    return prompt
  }

  /**
   * Extracts structured output from AI response
   * This is a placeholder - in production, you'd use structured output from your LLM
   */
  extractStructuredOutput(aiResponse: string): {
    content: string
    suggestedPlanUpdate?: string
  } {
    // Simple extraction - in production, use LLM structured output
    const planUpdateMatch = aiResponse.match(/\[PLAN_UPDATE\](.*?)\[\/PLAN_UPDATE\]/s)

    return {
      content: aiResponse,
      suggestedPlanUpdate: planUpdateMatch ? planUpdateMatch[1].trim() : undefined,
    }
  }
}

export const promptService = new PromptService()
