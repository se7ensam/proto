import { z } from 'zod'

export const applyToPlanSchema = z.object({
  messageId: z.string().min(1, 'Message ID is required'),
  conversationId: z.string().optional(),
})

export const updatePlanSectionSchema = z.object({
  sectionId: z.string().min(1, 'Section ID is required'),
  content: z.string().optional(),
  locked: z.boolean().optional(),
})

export const lockSectionSchema = z.object({
  sectionId: z.string().min(1, 'Section ID is required'),
  locked: z.boolean(),
})

export type ApplyToPlanInput = z.infer<typeof applyToPlanSchema>
export type UpdatePlanSectionInput = z.infer<typeof updatePlanSectionSchema>
export type LockSectionInput = z.infer<typeof lockSectionSchema>
