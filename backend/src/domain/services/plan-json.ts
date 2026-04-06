import { z } from 'zod'
import { PlanDeltaPhaseReplace, PlanDoc, PlanPayload, PlanPhase, PlanSection, PlanStatus } from '../types'

const MAX_PHASES = 12
const MAX_TASKS_PER_PHASE = 20
const MAX_SUMMARY_CHARS = 400
const MAX_TASK_CHARS = 200

const planStatusSchema = z.enum(['td', 'ip', 'dn', 'bl'])

const planTaskSchema = z
  .object({
    id: z.string().min(1),
    c: z.string().min(1).max(MAX_TASK_CHARS),
    st: planStatusSchema,
  })
  .strict()

const planPhaseSchema = z
  .object({
    id: z.string().min(1),
    n: z.string().min(1).max(120),
    o: z.number().int().nonnegative(),
    st: planStatusSchema,
    sum: z.string().min(1).max(MAX_SUMMARY_CHARS),
    it: z.array(planTaskSchema).max(MAX_TASKS_PER_PHASE),
  })
  .strict()

const planDocSchema = z
  .object({
    v: z.literal(1),
    rev: z.number().int().positive(),
    ph: z.array(planPhaseSchema).min(1).max(MAX_PHASES),
  })
  .strict()

const planDeltaPhaseReplaceSchema = z
  .object({
    v: z.literal(1),
    rev: z.number().int().positive(),
    op: z.literal('phase_replace'),
    pid: z.string().min(1),
    ph: planPhaseSchema,
  })
  .strict()

const planPayloadSchema = z.union([planDocSchema, planDeltaPhaseReplaceSchema])

const STATUS_LABELS: Record<PlanStatus, string> = {
  td: 'todo',
  ip: 'in_progress',
  dn: 'done',
  bl: 'blocked',
}

function extractJsonCandidate(content: string): string | null {
  const trimmed = content.trim()

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return trimmed
  }

  const match = trimmed.match(/```json\s*([\s\S]*?)\s*```/i) || trimmed.match(/```\s*([\s\S]*?)\s*```/)
  return match?.[1]?.trim() || null
}

export function parsePlanPayload(content: string): PlanPayload | null {
  const jsonCandidate = extractJsonCandidate(content)
  if (!jsonCandidate) {
    return null
  }

  try {
    const parsed = JSON.parse(jsonCandidate)
    const validated = planPayloadSchema.safeParse(parsed)
    if (!validated.success) {
      return null
    }

    if ('op' in validated.data) {
      if (validated.data.ph.id !== validated.data.pid) {
        return null
      }
      return validated.data as PlanDeltaPhaseReplace
    }

    return validated.data as PlanDoc
  } catch {
    return null
  }
}

export function parsePlanPayloadFromUnknown(input: unknown): PlanPayload | null {
  const validated = planPayloadSchema.safeParse(input)
  if (!validated.success) {
    return null
  }

  if ('op' in validated.data && validated.data.ph.id !== validated.data.pid) {
    return null
  }

  return validated.data as PlanPayload
}

export function isPlanDoc(payload: PlanPayload): payload is PlanDoc {
  return !('op' in payload)
}

export function getPlanStatusLabel(status: PlanStatus): string {
  return STATUS_LABELS[status]
}

export function renderPlanPhaseContent(phase: PlanPhase): string {
  const header = `${phase.n} [${getPlanStatusLabel(phase.st)}]`
  const tasks = phase.it.map((task) => `- [${getPlanStatusLabel(task.st)}] ${task.c}`).join('\n')
  return `${header}\n${phase.sum}${tasks ? `\n${tasks}` : ''}`
}

export function renderPlanPayloadForUser(payload: PlanPayload): string {
  if (isPlanDoc(payload)) {
    const orderedPhases = [...payload.ph].sort((a, b) => a.o - b.o)
    return orderedPhases
      .map((phase) => {
        const tasks = phase.it
          .map((task) => `- ${task.c} (${getPlanStatusLabel(task.st)})`)
          .join('\n')
        return `${phase.n} (${getPlanStatusLabel(phase.st)})\n${phase.sum}${tasks ? `\n${tasks}` : ''}`
      })
      .join('\n\n')
  }

  const phase = payload.ph
  const tasks = phase.it.map((task) => `- ${task.c} (${getPlanStatusLabel(task.st)})`).join('\n')
  return `Updated phase: ${phase.n} (${getPlanStatusLabel(phase.st)})\n${phase.sum}${tasks ? `\n${tasks}` : ''}`
}

export function buildPhaseIndexForPrompt(planSections: PlanSection[]): Array<{ id: string; n: string; st: PlanStatus }> {
  return planSections
    .filter((section) => section.structuredData)
    .sort((a, b) => (a.phaseOrder ?? 0) - (b.phaseOrder ?? 0))
    .map((section) => ({
      id: section.structuredData!.id,
      n: section.structuredData!.n,
      st: section.structuredData!.st,
    }))
}
