/**
 * LLM Infrastructure Service - Adapts Google Gemini to domain interface
 */

import { GoogleGenAI } from '@google/genai'
import { ILLMService } from '../../domain/services/chat.service'
import { LLMRequest } from '../../domain/types'
import { LLMError } from '../../domain/errors'

export class GeminiLLMService implements ILLMService {
  private genAI: GoogleGenAI | null = null
  private modelName: string = 'gemini-2.5-flash'

  constructor(apiKey?: string) {
    if (apiKey) {
      this.genAI = new GoogleGenAI({ apiKey })
    }
  }

  async generateResponse(request: LLMRequest): Promise<string> {
    if (!this.genAI) {
      return this.getFallbackResponse(request.userMessage)
    }

    const prompt = this.buildPrompt(request)

    try {
      const response = await this.genAI.models.generateContent({
        model: this.modelName,
        contents: prompt,
      })

      return response.text || 'No response generated'
    } catch (error) {
      throw new LLMError('Failed to generate response from Gemini', error as Error)
    }
  }

  async *generateResponseStream(request: LLMRequest): AsyncGenerator<string, void, unknown> {
    if (!this.genAI) {
      yield this.getFallbackResponse(request.userMessage)
      return
    }

    const prompt = this.buildPrompt(request)

    try {
      const stream = await this.genAI.models.generateContentStream({
        model: this.modelName,
        contents: prompt,
      })

      for await (const chunk of stream) {
        const text = chunk.text || ''
        if (text) {
          yield text
        }
      }
    } catch (error) {
      throw new LLMError('Failed to stream response from Gemini', error as Error)
    }
  }

  private buildPrompt(request: LLMRequest): string {
    const { userMessage, context } = request
    let prompt = ''

    // Add planning rules
    if (context.planningRules && context.planningRules.length > 0) {
      prompt += 'PLANNING RULES:\n'
      context.planningRules.forEach((rule, index) => {
        prompt += `${index + 1}. ${rule}\n`
      })
      prompt += '\n'
    }

    // Add conversation context (last 10 messages)
    if (context.messages.length > 0) {
      prompt += 'CONVERSATION CONTEXT:\n'
      context.messages.forEach((msg) => {
        prompt += `[${msg.type}]: ${msg.content}\n`
      })
      prompt += '\n'
    }

    // Add current plan state
    if (context.planSections && context.planSections.length > 0) {
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

  private getFallbackResponse(userMessage: string): string {
    return `I understand your message: "${userMessage}". Please configure GEMINI_API_KEY environment variable to enable AI responses.`
  }
}
