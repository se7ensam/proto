import { describe, expect, it } from 'vitest'
import { parsePlanPayload, renderPlanPhaseContent } from '../src/domain/services/plan-json'

describe('plan-json helpers', () => {
  it('parses a full compact plan payload', () => {
    const payload = parsePlanPayload(
      JSON.stringify({
        v: 1,
        rev: 3,
        ph: [
          {
            id: 'p1',
            n: 'Research',
            o: 1,
            st: 'ip',
            sum: 'Audit architecture',
            it: [{ id: 't1', c: 'Map APIs', st: 'td' }],
          },
        ],
      })
    )

    expect(payload).not.toBeNull()
    expect(payload && 'ph' in payload).toBe(true)
  })

  it('parses a phase_replace payload', () => {
    const payload = parsePlanPayload(
      JSON.stringify({
        v: 1,
        rev: 4,
        op: 'phase_replace',
        pid: 'p1',
        ph: {
          id: 'p1',
          n: 'Research',
          o: 1,
          st: 'dn',
          sum: 'Audit done',
          it: [{ id: 't1', c: 'Map APIs', st: 'dn' }],
        },
      })
    )

    expect(payload).not.toBeNull()
    expect(payload && 'op' in payload ? payload.op : undefined).toBe('phase_replace')
  })

  it('rejects phase_replace when pid and ph.id mismatch', () => {
    const payload = parsePlanPayload(
      JSON.stringify({
        v: 1,
        rev: 4,
        op: 'phase_replace',
        pid: 'p1',
        ph: {
          id: 'p2',
          n: 'Research',
          o: 1,
          st: 'dn',
          sum: 'Audit done',
          it: [{ id: 't1', c: 'Map APIs', st: 'dn' }],
        },
      })
    )

    expect(payload).toBeNull()
  })

  it('renders human-friendly text fallback from a phase', () => {
    const content = renderPlanPhaseContent({
      id: 'p1',
      n: 'Research',
      o: 1,
      st: 'ip',
      sum: 'Audit architecture',
      it: [{ id: 't1', c: 'Map APIs', st: 'td' }],
    })

    expect(content).toContain('Research [in_progress]')
    expect(content).toContain('- [todo] Map APIs')
  })
})
