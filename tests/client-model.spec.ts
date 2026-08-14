import type { SessionId, SessionListState, SessionSummary } from '@deepseek-ai/dsh-client-runtime/client'
import { describe, expect, it } from 'vitest'
import {
  buildFuseCommand, createdSessionId, eligibleFusionSources,
} from '../src/client/model.ts'

function id(value: string): SessionId {
  return value as SessionId
}

function summary(value: string, overrides: Partial<SessionSummary> = {}): SessionSummary {
  return {
    id: id(value),
    displayTitle: `Title ${value}`,
    cwd: '/workspace',
    running: false,
    blank: false,
    updatedAt: 1,
    ...overrides,
  }
}

function state(rows: readonly SessionSummary[]): SessionListState {
  return {
    ids: rows.map(row => row.id),
    byId: Object.fromEntries(rows.map(row => [row.id, row])) as SessionListState['byId'],
    current: rows[0]?.id,
    phase: 'ready',
    subagentsByParent: {},
    jobsBySession: {},
    currentAddress: undefined,
  }
}

describe('conversation fusion browser model', () => {
  it('filters out the current, blank, and foreign-workspace sessions', () => {
    const rows = [
      summary('current'),
      summary('eligible'),
      summary('blank', { blank: true }),
      summary('foreign', { cwd: '/other' }),
    ]
    expect(eligibleFusionSources(state(rows), id('current'), '')).toEqual([rows[1]])
    expect(eligibleFusionSources(state(rows), id('current'), 'ELIG')).toEqual([rows[1]])
    expect(eligibleFusionSources(state(rows), id('current'), 'missing')).toEqual([])
  })

  it('encodes structured options and reads the created id', () => {
    const command = buildFuseCommand({
      sourceSessionIds: [id('one'), id('two')],
      title: '  Delivery context  ',
      strategy: 'by-source',
      deduplicate: false,
      agentPlanning: true,
    })
    expect(command).toBe('/fuse {"sourceSessionIds":["one","two"],"title":"Delivery context","strategy":"by-source","deduplicate":false,"agentPlanning":true}')
    expect(createdSessionId('Created fused conversation fusion-123 ("Delivery") from 3 conversations.')).toBe('fusion-123')
    expect(createdSessionId('Conversation fusion completed.')).toBeUndefined()
  })
})
