import { z } from 'zod'

export const sendMessageSchema = z.object({
  content: z.string().min(1, 'Message content cannot be empty'),
  conversationId: z.string().optional(),
})

export const regenerateMessageSchema = z.object({
  messageId: z.string().min(1, 'Message ID is required'),
  conversationId: z.string().optional(),
})

export type SendMessageInput = z.infer<typeof sendMessageSchema>
export type RegenerateMessageInput = z.infer<typeof regenerateMessageSchema>
