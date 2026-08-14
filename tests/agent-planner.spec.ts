import { Session, SessionId } from '@deepseek-ai/dsh-session'
import { describe, expect, it } from 'vitest'
import { plannerAssistantText } from '../src/agent-planner.ts'

describe('plannerAssistantText', () => {
  it('falls back to accumulated text chunks when no assembled message exists', () => {
    const session = Session.create(SessionId('planner-stream'))
    session.append('assistant/chunk', {
      turn: 1,
      step: 1,
      chunk: { type: 'text-delta', index: 0, text: '{"verdict":' },
    })
    session.append('assistant/chunk', {
      turn: 1,
      step: 1,
      chunk: { type: 'text-delta', index: 0, text: '"skip"}' },
    })
    session.append('turn/end', { turn: 1, reason: { kind: 'completed' } })

    expect(plannerAssistantText(session.events, 4096)).toBe('{"verdict":"skip"}')
  })

  it('reports the configured output budget when the planner reaches max tokens', () => {
    const session = Session.create(SessionId('planner-budget'))
    session.append('turn/end', { turn: 1, reason: { kind: 'max-tokens' } })

    expect(() => plannerAssistantText(session.events, 4096)).toThrow(/exhausted its 4096-token output budget/)
  })

  it('preserves the model failure code and message', () => {
    const session = Session.create(SessionId('planner-error'))
    session.append('turn/end', {
      turn: 1,
      reason: { kind: 'error', error: { code: 'RATE_LIMIT', message: 'provider busy' } },
    })

    expect(() => plannerAssistantText(session.events, 4096)).toThrow(/failed \(RATE_LIMIT\): provider busy/)
  })
})
