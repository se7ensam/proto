/**
 * Plan Domain Service - Business logic for plan management
 * Framework-agnostic, testable, deterministic
 */

import { IPlanSectionRepository, IMessageRepository, IConversationRepository } from '../repositories'
import {
  PlanSection,
  Message,
  PlanDoc,
  PlanDeltaPhaseReplace,
  PlanCalendarEventStatus,
} from '../types'
import { NotFoundError, ValidationError } from '../errors'
import { isPlanDoc, parsePlanPayload, parsePlanPayloadFromUnknown, renderPlanPhaseContent } from './plan-json'

type PlanApplyMode = 'text' | 'plan_doc' | 'phase_replace'

interface ApplyMessageToPlanResult {
  planSection: PlanSection
  planSections: PlanSection[]
  planUpdateMessage: Message
  appliedMode: PlanApplyMode
  planRevision: number
}

export class PlanService {
  constructor(
    private planSectionRepo: IPlanSectionRepository,
    private messageRepo: IMessageRepository,
    private conversationRepo: IConversationRepository
  ) {}

  /**
   * Apply an AI message to the plan
   */
  async applyMessageToPlan(
    userId: string,
    conversationId: string,
    messageId: string
  ): Promise<ApplyMessageToPlanResult> {
    void conversationId

    // Find the message
    const message = await this.messageRepo.findById(messageId)
    if (!message) {
      throw new NotFoundError('Message', messageId)
    }

    if (message.type !== 'ai') {
      throw new ValidationError('Only AI messages can be applied to plan')
    }

    // Verify message belongs to the user
    if (message.userId !== userId) {
      throw new ValidationError('Message does not belong to this user')
    }

    // Ensure user has access to the message's conversation and load metadata
    const conversation = await this.conversationRepo.getOrCreate(userId, message.conversationId)
    const payload =
      this.getStoredPlanPayloadFromMetadata(message.metadata) ??
      parsePlanPayload(message.content)

    if (!payload) {
      const planSection = await this.planSectionRepo.create({
        conversationId: message.conversationId,
        userId,
        content: message.content,
        locked: false,
        sourceMessageId: messageId,
      })

      const planUpdateMessage = await this.messageRepo.create({
        conversationId: message.conversationId,
        userId,
        type: 'plan_update',
        content: `Applied message ${messageId} to plan`,
      })

      return {
        planSection,
        planSections: [planSection],
        planUpdateMessage,
        appliedMode: 'text',
        planRevision: this.getPlanRevision(conversation.metadata),
      }
    }

    const currentRevision = this.getPlanRevision(conversation.metadata)
    const effectiveRevision = Math.max(payload.rev, currentRevision + 1)

    const existingSections = await this.planSectionRepo.findByConversationId(conversation.id)
    const appliedSections = isPlanDoc(payload)
      ? await this.applyPlanDoc(userId, messageId, message.conversationId, payload, existingSections)
      : await this.applyPhaseReplace(
          userId,
          messageId,
          message.conversationId,
          payload,
          existingSections
        )

    if (appliedSections.length === 0) {
      throw new ValidationError('No plan phases were applied. Matching phases may be locked.')
    }

    const nextMetadata = {
      ...(this.isRecord(conversation.metadata) ? conversation.metadata : {}),
      planRev: effectiveRevision,
      planVersion: payload.v,
    }
    await this.conversationRepo.update(conversation.id, { metadata: nextMetadata })

    const phaseIds = appliedSections
      .map((section) => section.phaseId)
      .filter((phaseId): phaseId is string => Boolean(phaseId))

    const appliedMode: PlanApplyMode = isPlanDoc(payload) ? 'plan_doc' : 'phase_replace'
    const phaseReplacePayload = isPlanDoc(payload) ? null : payload

    const planUpdateMessage = await this.messageRepo.create({
      conversationId: message.conversationId,
      userId,
      type: 'plan_update',
      content:
        appliedMode === 'phase_replace'
          ? `Applied phase update ${phaseReplacePayload!.pid} (rev ${effectiveRevision})`
          : `Applied structured plan with ${appliedSections.length} phase(s) (rev ${effectiveRevision})`,
      metadata: {
        mode: appliedMode,
        rev: effectiveRevision,
        phaseIds,
      },
    })

    return {
      planSection: appliedSections[0],
      planSections: appliedSections,
      planUpdateMessage,
      appliedMode,
      planRevision: effectiveRevision,
    }
  }

  /**
   * Get all plan sections for a conversation
   */
  async getPlanSections(userId: string, conversationId: string): Promise<PlanSection[]> {
    // Get or create conversation (handles non-UUID IDs)
    const conversation = await this.conversationRepo.getOrCreate(userId, conversationId)

    return this.planSectionRepo.findByConversationId(conversation.id)
  }

  /**
   * Update a plan section
   */
  async updatePlanSection(
    userId: string,
    conversationId: string,
    sectionId: string,
    updates: {
      content?: string
      locked?: boolean
      calendarEventStatus?: PlanCalendarEventStatus | null
    }
  ): Promise<PlanSection> {
    const conversation = await this.conversationRepo.getOrCreate(userId, conversationId)

    // Verify section exists and belongs to user
    const section = await this.planSectionRepo.findById(sectionId)
    if (!section) {
      throw new NotFoundError('Plan section', sectionId)
    }

    const calendarStatusOnly =
      updates.calendarEventStatus !== undefined &&
      updates.content === undefined &&
      updates.locked === undefined

    // Host-only for content/lock; calendar sync status may be updated by any participant
    // (getOrCreate already ensures this user may access this conversation).
    if (!calendarStatusOnly && section.userId !== userId) {
      throw new ValidationError('Plan section does not belong to user')
    }

    if (section.conversationId !== conversation.id) {
      throw new ValidationError('Plan section does not belong to this conversation')
    }

    // Update section
    const updated = await this.planSectionRepo.update(sectionId, updates)
    if (!updated) {
      throw new NotFoundError('Plan section', sectionId)
    }

    return updated
  }

  /**
   * Lock or unlock a plan section
   */
  async toggleSectionLock(
    userId: string,
    conversationId: string,
    sectionId: string,
    locked: boolean
  ): Promise<PlanSection> {
    return this.updatePlanSection(userId, conversationId, sectionId, { locked })
  }

  /**
   * Delete a plan section
   */
  async deletePlanSection(userId: string, conversationId: string, sectionId: string): Promise<void> {
    void conversationId

    // Verify section exists and belongs to user
    const section = await this.planSectionRepo.findById(sectionId)
    if (!section) {
      throw new NotFoundError('Plan section', sectionId)
    }

    if (section.userId !== userId) {
      throw new ValidationError('Plan section does not belong to user')
    }

    await this.planSectionRepo.delete(sectionId)
  }

  /**
   * Export plan sections as an iCalendar (.ics) document.
   * Each phase/section is scheduled as an all-day event in sequence.
   */
  async exportCalendarIcs(userId: string, conversationId: string): Promise<string> {
    const conversation = await this.conversationRepo.getOrCreate(userId, conversationId)
    const sections = await this.planSectionRepo.findByConversationId(conversation.id)

    const orderedSections = [...sections].sort((a, b) => {
      if (typeof a.phaseOrder === 'number' && typeof b.phaseOrder === 'number') {
        return a.phaseOrder - b.phaseOrder
      }
      return a.timestamp.getTime() - b.timestamp.getTime()
    })

    const lines: string[] = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Proto//Plan Calendar//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      `X-WR-CALNAME:${this.escapeIcsText(`Plan ${conversation.id.slice(0, 8)}`)}`,
    ]

    const todayUtc = new Date()
    const dateSeed = new Date(Date.UTC(todayUtc.getUTCFullYear(), todayUtc.getUTCMonth(), todayUtc.getUTCDate()))
    const dtStamp = this.formatUtcDateTime(new Date())

    orderedSections.forEach((section, index) => {
      const start = new Date(dateSeed)
      start.setUTCDate(dateSeed.getUTCDate() + index)
      const end = new Date(start)
      end.setUTCDate(start.getUTCDate() + 1)

      const title = section.structuredData?.n || this.getSectionTitle(section.content)
      const description = this.getSectionDescription(section)

      lines.push('BEGIN:VEVENT')
      lines.push(`UID:${this.escapeIcsText(`${conversation.id}-${section.id}@proto`)}`)
      lines.push(`DTSTAMP:${dtStamp}`)
      lines.push(`DTSTART;VALUE=DATE:${this.formatDateOnly(start)}`)
      lines.push(`DTEND;VALUE=DATE:${this.formatDateOnly(end)}`)
      lines.push(`SUMMARY:${this.escapeIcsText(title)}`)
      lines.push(`DESCRIPTION:${this.escapeIcsText(description)}`)
      lines.push('END:VEVENT')
    })

    lines.push('END:VCALENDAR')
    return `${lines.join('\r\n')}\r\n`
  }

  private async applyPlanDoc(
    userId: string,
    messageId: string,
    conversationId: string,
    planDoc: PlanDoc,
    existingSections: PlanSection[]
  ): Promise<PlanSection[]> {
    const seenIds = new Set<string>()
    for (const phase of planDoc.ph) {
      if (seenIds.has(phase.id)) {
        throw new ValidationError(`Duplicate phase id '${phase.id}' in plan payload`)
      }
      seenIds.add(phase.id)
    }

    const sectionsByPhaseId = new Map<string, PlanSection>()
    existingSections.forEach((section) => {
      const id = section.phaseId || section.structuredData?.id
      if (id) {
        sectionsByPhaseId.set(id, section)
      }
    })

    const applied: PlanSection[] = []
    const orderedPhases = [...planDoc.ph].sort((a, b) => a.o - b.o)

    for (const phase of orderedPhases) {
      const existing = sectionsByPhaseId.get(phase.id)
      const content = renderPlanPhaseContent(phase)

      if (existing) {
        if (existing.locked) {
          continue
        }

        const updated = await this.planSectionRepo.update(existing.id, {
          content,
          phaseId: phase.id,
          phaseOrder: phase.o,
          structuredData: phase,
          sourceMessageId: messageId,
        })

        if (updated) {
          applied.push(updated)
        }
        continue
      }

      const created = await this.planSectionRepo.create({
        conversationId,
        userId,
        content,
        locked: false,
        sourceMessageId: messageId,
        phaseId: phase.id,
        phaseOrder: phase.o,
        structuredData: phase,
      })
      applied.push(created)
    }

    return applied
  }

  private async applyPhaseReplace(
    userId: string,
    messageId: string,
    conversationId: string,
    delta: PlanDeltaPhaseReplace,
    existingSections: PlanSection[]
  ): Promise<PlanSection[]> {
    const target = existingSections.find(
      (section) => (section.phaseId || section.structuredData?.id) === delta.pid
    )

    if (!target) {
      const created = await this.planSectionRepo.create({
        conversationId,
        userId,
        content: renderPlanPhaseContent(delta.ph),
        locked: false,
        sourceMessageId: messageId,
        phaseId: delta.ph.id,
        phaseOrder: delta.ph.o,
        structuredData: delta.ph,
      })
      return [created]
    }

    if (target.locked) {
      throw new ValidationError(`Phase '${delta.pid}' is locked and cannot be updated`)
    }

    const updated = await this.planSectionRepo.update(target.id, {
      content: renderPlanPhaseContent(delta.ph),
      phaseId: delta.ph.id,
      phaseOrder: delta.ph.o,
      structuredData: delta.ph,
      sourceMessageId: messageId,
    })

    if (!updated) {
      throw new NotFoundError('Plan section', target.id)
    }

    return [updated]
  }

  private getPlanRevision(metadata: unknown): number {
    if (!this.isRecord(metadata)) {
      return 0
    }

    const revision = metadata.planRev
    return typeof revision === 'number' && Number.isInteger(revision) && revision >= 0 ? revision : 0
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
  }

  private getStoredPlanPayloadFromMetadata(metadata: unknown) {
    if (!this.isRecord(metadata)) {
      return null
    }

    return parsePlanPayloadFromUnknown(metadata.planPayload)
  }

  private getSectionTitle(content: string): string {
    const firstLine = content.split('\n').map((line) => line.trim()).find(Boolean)
    return firstLine || 'Plan item'
  }

  private getSectionDescription(section: PlanSection): string {
    if (section.structuredData) {
      const tasks = section.structuredData.it.map((task) => `- ${task.c}`).join('\n')
      return tasks
        ? `${section.structuredData.sum}\n${tasks}`
        : section.structuredData.sum
    }
    return section.content
  }

  private escapeIcsText(value: string): string {
    return value
      .replace(/\\/g, '\\\\')
      .replace(/\r?\n/g, '\\n')
      .replace(/,/g, '\\,')
      .replace(/;/g, '\\;')
  }

  private formatDateOnly(value: Date): string {
    const yyyy = value.getUTCFullYear().toString().padStart(4, '0')
    const mm = (value.getUTCMonth() + 1).toString().padStart(2, '0')
    const dd = value.getUTCDate().toString().padStart(2, '0')
    return `${yyyy}${mm}${dd}`
  }

  private formatUtcDateTime(value: Date): string {
    const yyyy = value.getUTCFullYear().toString().padStart(4, '0')
    const mm = (value.getUTCMonth() + 1).toString().padStart(2, '0')
    const dd = value.getUTCDate().toString().padStart(2, '0')
    const hh = value.getUTCHours().toString().padStart(2, '0')
    const min = value.getUTCMinutes().toString().padStart(2, '0')
    const sec = value.getUTCSeconds().toString().padStart(2, '0')
    return `${yyyy}${mm}${dd}T${hh}${min}${sec}Z`
  }
}
