/**
 * LLM Infrastructure Service - Adapts Google Gemini to domain interface
 */

import { GoogleGenAI } from '@google/genai'
import { ILLMService } from '../../domain/services/chat.service'
import { LLMRequest } from '../../domain/types'
import { LLMError } from '../../domain/errors'
import { buildPhaseIndexForPrompt } from '../../domain/services/plan-json'

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

    const jsonMode = this.shouldReturnPlanJson(request)
    const prompt = this.buildPrompt(request, jsonMode)

    try {
      const req: any = {
        model: this.modelName,
        contents: prompt,
      }
      if (jsonMode) {
        req.config = { responseMimeType: 'application/json' }
      }
      const response = await this.genAI.models.generateContent(req)

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

    const jsonMode = this.shouldReturnPlanJson(request)
    const prompt = this.buildPrompt(request, jsonMode)

    try {
      const req: any = {
        model: this.modelName,
        contents: prompt,
      }
      if (jsonMode) {
        req.config = { responseMimeType: 'application/json' }
      }
      const stream = await this.genAI.models.generateContentStream(req)

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

  async generateConversationTitle(seedMessage: string): Promise<string> {
    if (!this.genAI) {
      return ''
    }

    const prompt = [
      'Write a concise chat title for this message.',
      'Rules: max 7 words, max 60 characters.',
      'Return title text only.',
      `Message: ${seedMessage}`,
    ].join('\n')

    try {
      const response = await this.genAI.models.generateContent({
        model: this.modelName,
        contents: prompt,
        config: {
          maxOutputTokens: 32,
        },
      })

      return (response.text || '').trim()
    } catch (error) {
      throw new LLMError('Failed to generate conversation title from Gemini', error as Error)
    }
  }

  private buildPrompt(request: LLMRequest, jsonMode: boolean): string {
    if (jsonMode) {
      return this.buildPlanJsonPrompt(request)
    }

    return this.buildStandardPrompt(request)
  }

  private buildStandardPrompt(request: LLMRequest): string {
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

    // Add current user message
    prompt += `USER MESSAGE: ${userMessage}\n\n`
    prompt += 'Please provide a helpful response. Remember: AI messages are separate from plan updates unless explicitly applied.'

    return prompt
  }

  private buildPlanJsonPrompt(request: LLMRequest): string {
    const { userMessage, context } = request
    const phaseIndex = buildPhaseIndexForPrompt(context.planSections).slice(0, 16)
    const compactHistory = context.messages
      .slice(-4)
      .map((msg) => `[${msg.type}] ${this.truncate(msg.content, 220)}`)
      .join('\n')
    const rules = context.planningRules.slice(0, 12).map((rule, idx) => `${idx + 1}. ${rule}`).join('\n')
    const currentRev = context.planRevision ?? 0

    return [
      'You are a planning engine.',
      'Return ONLY minified JSON (one object). No markdown or prose.',
      'Schema full: {"v":1,"rev":number,"ph":[{"id":string,"n":string,"o":number,"st":"td|ip|dn|bl","sum":string,"it":[{"id":string,"c":string,"st":"td|ip|dn|bl"}]}]}',
      'Schema delta: {"v":1,"rev":number,"op":"phase_replace","pid":string,"ph":{"id":string,"n":string,"o":number,"st":"td|ip|dn|bl","sum":string,"it":[{"id":string,"c":string,"st":"td|ip|dn|bl"}]}}',
      'Rules:',
      '- Use full schema to create/rebuild whole plan.',
      '- Use delta schema to update exactly one existing phase.',
      '- rev must be an integer strictly greater than current_rev.',
      '- Keep output compact: max 12 phases, max 20 tasks per phase, short summaries/tasks.',
      `current_rev=${currentRev}`,
      `phase_index=${JSON.stringify(phaseIndex)}`,
      rules ? `planning_rules=\n${rules}` : 'planning_rules=[]',
      compactHistory ? `recent_context=\n${compactHistory}` : 'recent_context=[]',
      `user_request=${userMessage}`,
    ].join('\n')
  }

  private shouldReturnPlanJson(request: LLMRequest): boolean {
    const text = request.userMessage.toLowerCase()
    return /\b(plan|phase|roadmap|milestone|timeline|update\s+plan|revise\s+plan)\b/.test(text)
  }

  private truncate(value: string, maxChars: number): string {
    if (value.length <= maxChars) {
      return value
    }
    return `${value.slice(0, maxChars).trimEnd()}...`
  }

  private getFallbackResponse(userMessage: string): string {
    return `I understand your message: "${userMessage}". Please configure GEMINI_API_KEY environment variable to enable AI responses.`
  }
}
