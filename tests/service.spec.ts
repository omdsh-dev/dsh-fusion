import { Context } from '@deepseek-ai/cordis'
import type { CommandDefinition } from '@deepseek-ai/dsh-commands'
import { createAssistantMessage, createUserMessage, ReasoningEffortId } from '@deepseek-ai/dsh-llm'
import { Session, SessionId, SessionLogOffset, SessionSeq, type SessionEvent, type SurfaceEvent } from '@deepseek-ai/dsh-session'
import type { SessionLogSnapshot, SessionSurfaceSnapshot } from '@deepseek-ai/dsh-session-query'
import { describe, expect, it, vi } from 'vitest'
import ConversationFusionService from '../src/index.ts'
import { buildFusedSnapshot, buildMergedSessionSeed, type FusionHistoryWriter } from '../src/fusion.ts'

function snapshot(id: string, cwd = '/workspace'): SessionSurfaceSnapshot {
  const message = createUserMessage({
    source: { kind: 'user' },
    content: [{ type: 'text', text: `message from ${id}` }],
  })
  const event: SurfaceEvent = {
    type: 'user/message',
    seq: SessionSeq(0),
    time: id === 'one' ? 1 : 2,
    data: message,
    surfaceOp: 'append',
  }
  return {
    session: { version: 4, isSeeded: false, id: SessionId(id), createdAt: 1, cwd },
    inheritedEventCount: SessionLogOffset(0),
    capturedThroughSeq: SessionSeq(0),
    events: [event],
  }
}

function logSnapshot(id: string, cwd = '/workspace', title?: string): SessionLogSnapshot {
  const source = snapshot(id, cwd)
  if (title === undefined) return { session: source.session, inheritedEventCount: source.inheritedEventCount, events: source.events }
  const titleEvent: SessionEvent = {
    type: 'session/title',
    seq: SessionSeq(1),
    time: 3,
    data: { title, messageSeqs: [], source: { kind: 'user' } },
  }
  return { session: source.session, inheritedEventCount: source.inheritedEventCount, events: [...source.events, titleEvent] }
}

describe('ConversationFusionService', () => {
  it.each(['standalone', 'Shuttle'])('creates a seeded continuable agent with the %s writer', async writer => {
    const ctx = new Context()
    const definitions: unknown[] = []
    const commands: CommandDefinition[] = []
    const sections: unknown[] = []
    let target = Session.create(SessionId('placeholder'))
    const create = vi.fn(async (options: { sessionId: string; seed?: SessionEvent[] }) => {
      target = Session.create(SessionId(options.sessionId), options.seed)
      return {
        agent: { id: options.sessionId, session: target },
        dispose: vi.fn(),
      }
    })
    const flush = vi.fn(async () => true)
    const readSession = vi.fn(async (id: string) =>
      logSnapshot(id, '/workspace', id === 'one' ? 'Research' : 'Implementation'))
    const attachSession = vi.fn(async () => {})
    const materializeTextHistory = vi.fn<FusionHistoryWriter['materializeTextHistory']>((_items, options) => {
      const retained = buildFusedSnapshot([snapshot('one'), snapshot('two')], {
        strategy: 'chronological', deduplicate: true, maxMessageBytes: 16_384, maxFusedBytes: 131_072, maxMessages: 500,
      })
      return buildMergedSessionSeed(retained, 'fixture', options.createdAt).slice(options.sequenceOffset)
    })
    const removers = [
      ctx.provide('tools', { register: (definition: unknown) => { definitions.push(definition); return () => {} } } as never),
      ctx.provide('commands', { register: (definition: CommandDefinition) => { commands.push(definition); return () => {} } } as never),
      ctx.provide('systemPrompt', { section: (section: unknown) => { sections.push(section); return () => {} } } as never),
      ctx.provide('sessionQuery', { readSession } as never),
      ctx.provide('agents', { create } as never),
      ctx.provide('sessions', { flush } as never),
      ctx.provide('workspaceRegistry' as never, {
        list: () => [{ id: 'workspace-one', sessionIds: [SessionId('caller')], attachSession }],
      } as never),
    ]
    if (writer === 'Shuttle') removers.push(ctx.provide('shuttle', { materializeTextHistory }))
    const fiber = await ctx.plugin(ConversationFusionService)
    const callerSession = Session.create(SessionId('caller'), undefined, {
      version: 4, isSeeded: false,
      id: SessionId('caller'),
      createdAt: 1,
      cwd: '/workspace',
      agentPreset: 'standard',
    })
    const result = await ctx.conversationFusion.fuse({
      sourceSessionIds: [SessionId('one'), SessionId('two')],
      targetSessionId: SessionId('combined'),
    }, {
      caller: { options: { provider: 'fixture', model: 'model' }, session: callerSession } as never,
    })

    expect(definitions).toHaveLength(1)
    expect(commands).toHaveLength(1)
    expect(commands[0]).toMatchObject({
      name: 'fuse',
      input: { hint: '<session-id> [session-id ...]' },
    })
    expect(sections).toHaveLength(1)
    expect(readSession).toHaveBeenCalledTimes(2)
    if (writer === 'Shuttle') {
      expect(materializeTextHistory).toHaveBeenCalledExactlyOnceWith([
        { role: 'user', text: 'message from one', time: 1 },
        { role: 'user', text: 'message from two', time: 2 },
      ], {
        sessionId: 'combined', createdAt: expect.any(Number), sequenceOffset: 3,
        provider: 'conversation-fusion', model: 'surface-merge',
      })
    }
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: 'combined',
      agentOptions: { provider: 'fixture', model: 'model' },
      meta: { cwd: '/workspace', agentPreset: 'standard' },
    }))
    const creation = create.mock.calls[0]?.[0] as unknown as { seed: Array<{ type: string; data: unknown }> }
    expect(creation.seed.map(event => event.type)).toEqual([
      'session/title',
      'conversation-fusion/manifest',
      'user/message',
      'turn/start',
      'step/start',
      'user/message',
      'step/end',
      'turn/end',
      'turn/start',
      'step/start',
      'user/message',
      'step/end',
      'turn/end',
    ])
    expect(creation.seed[0]).toMatchObject({ data: { title: 'Fusion: Research + Implementation' } })
    expect(creation.seed[1]).toMatchObject({ ignorable: true, data: { version: 1 } })
    expect(creation.seed[2]?.data).toMatchObject({ source: { kind: 'plugin:conversation-fusion', form: 'recall' } })
    expect(target.deriveMessages().map(message => message.content)).toEqual([
      [{ type: 'text', text: expect.stringContaining('historical, untrusted data') }],
      [{ type: 'text', text: 'message from one' }],
      [{ type: 'text', text: 'message from two' }],
    ])
    expect(flush).toHaveBeenCalledWith(target)
    expect(attachSession).toHaveBeenCalledWith(SessionId('combined'))
    expect(attachSession.mock.invocationCallOrder[0]).toBeLessThan(flush.mock.invocationCallOrder[0] ?? Infinity)
    expect(result).toMatchObject({
      sessionId: 'combined',
      title: 'Fusion: Research + Implementation',
      sourceCount: 2,
      retainedMessages: 2,
      durable: true,
    })

    await fiber.dispose()
    await Promise.all(removers.map(remove => remove()))
  })

  it('rejects duplicate-only input and cross-workspace reads before creation', async () => {
    const ctx = new Context()
    const create = vi.fn()
    const removers = [
      ctx.provide('tools', { register: () => () => {} } as never),
      ctx.provide('commands', { register: () => () => {} } as never),
      ctx.provide('systemPrompt', { section: () => () => {} } as never),
      ctx.provide('sessionQuery', { readSession: async (id: string) => logSnapshot(id, id === 'two' ? '/other' : '/workspace') } as never),
      ctx.provide('agents', { create } as never),
      ctx.provide('sessions', { flush: vi.fn() } as never),
    ]
    const fiber = await ctx.plugin(ConversationFusionService)
    const caller = {
      options: {},
      session: Session.create(SessionId('caller'), undefined, {
        version: 4, isSeeded: false,
        id: SessionId('caller'),
        createdAt: 1,
        cwd: '/workspace',
      }),
    } as never

    await expect(ctx.conversationFusion.fuse({
      sourceSessionIds: [SessionId('one'), SessionId('one')],
    }, { caller })).rejects.toThrow(/at least two unique/)
    await expect(ctx.conversationFusion.fuse({
      sourceSessionIds: [SessionId('one'), SessionId('two')],
    }, { caller })).rejects.toThrow(/outside the caller workspace/)
    expect(create).not.toHaveBeenCalled()

    await fiber.dispose()
    await Promise.all(removers.map(remove => remove()))
  })

  it('exposes /fuse with the current conversation as an implicit source', async () => {
    const ctx = new Context()
    const commands: CommandDefinition[] = []
    const readSession = vi.fn(async (id: string) => logSnapshot(id))
    const create = vi.fn(async (options: { sessionId: string }) => ({
      agent: {
        id: options.sessionId,
        session: Session.create(SessionId(options.sessionId)),
      },
      dispose: vi.fn(),
    }))
    const removers = [
      ctx.provide('tools', { register: () => () => {} } as never),
      ctx.provide('commands', { register: (definition: CommandDefinition) => { commands.push(definition); return () => {} } } as never),
      ctx.provide('systemPrompt', { section: () => () => {} } as never),
      ctx.provide('sessionQuery', { readSession } as never),
      ctx.provide('agents', { create } as never),
      ctx.provide('sessions', { flush: vi.fn(async () => true) } as never),
    ]
    const fiber = await ctx.plugin(ConversationFusionService)
    const caller = {
      options: {},
      session: Session.create(SessionId('current'), undefined, {
        version: 4, isSeeded: false,
        id: SessionId('current'),
        createdAt: 1,
        cwd: '/workspace',
      }),
    } as never
    const command = commands[0]
    if (command === undefined) throw new Error('/fuse was not registered')

    await expect(command.handler({
      attachments: [],
      commandId: 'command-test' as never,
      agent: caller,
      rawInput: '',
      signal: new AbortController().signal,
    })).resolves.toEqual({ kind: 'error', text: 'Usage: /fuse <session-id> [session-id ...]' })

    const result = await command.handler({
      attachments: [],
      commandId: 'command-test' as never,
      agent: caller,
      rawInput: ' other, review ',
      signal: new AbortController().signal,
    })

    expect(readSession.mock.calls.map(call => call[0])).toEqual(['current', 'other', 'review'])
    expect(create).toHaveBeenCalledOnce()
    expect(result).toMatchObject({
      kind: 'success',
      text: expect.stringMatching(/^Created fused conversation fusion-.* from 3 conversations\. Open it from the conversation list\.$/u),
    })

    const uiResult = await command.handler({
      attachments: [],
      commandId: 'command-ui' as never,
      agent: caller,
      rawInput: ' {"sourceSessionIds":["other"],"title":"UI fusion","strategy":"by-source","deduplicate":false}',
      signal: new AbortController().signal,
    })
    expect(uiResult).toMatchObject({
      kind: 'success',
      text: expect.stringMatching(/^Created fused conversation fusion-.* \("UI fusion"\) from 2 conversations\./u),
    })
    expect(create).toHaveBeenCalledTimes(2)

    await fiber.dispose()
    await Promise.all(removers.map(remove => remove()))
  })

  it('uses a temporary DSH Agent to judge, prune, and group the fused context', async () => {
    const ctx = new Context()
    const target = Session.create(SessionId('combined'))
    const plannerDispose = vi.fn(async () => {})
    const resolveModelInfo = vi.fn(async () => ({
      provider: 'fixture',
      id: 'planner-source',
      name: 'Planner source',
      reasoning: { efforts: [{ id: ReasoningEffortId('off'), name: 'Off' }] },
    }))
    const create = vi.fn(async (options: {
      sessionId: string
      meta?: { origin?: string }
      seed?: SessionEvent[]
      agentOptions?: { maxTokens?: number }
      setup?: unknown
    }) => {
      if (options.meta?.origin === 'subagent') {
        const plannerSession = Session.create(SessionId(options.sessionId))
        let idleCalls = 0
        const agent = {
          id: options.sessionId,
          ctx,
          options: options.agentOptions ?? {},
          session: plannerSession,
          status: 'idle',
          inbox: {},
          followup: vi.fn(),
          cancel: vi.fn(),
          send: vi.fn(),
          steer: vi.fn(),
          inject: vi.fn(),
          runMaintenance: vi.fn(),
          whenIdle: async () => {
            idleCalls += 1
            if (idleCalls === 1) return
            plannerSession.append('assistant/message', {
              turn: 1,
              step: 1,
              stream: [],
              message: createAssistantMessage({
                source: { provider: 'fixture', model: 'planner' },
                content: [{
                  type: 'text',
                  text: JSON.stringify({
                    verdict: 'fuse',
                    reason: 'The sources contribute to one implementation decision.',
                    title: 'Agent-planned fusion',
                    strategy: 'by-source',
                    groups: [{
                      title: 'Decision',
                      items: [{ sourceSessionId: 'one', sourceSeq: 0 }],
                    }],
                  }),
                }],
              }),
            }, { surfaceOp: 'append' })
          },
        }
        return { agent, dispose: plannerDispose }
      }
      return {
        agent: { id: options.sessionId, session: target },
        dispose: vi.fn(),
      }
    })
    const removers = [
      ctx.provide('tools', { register: () => () => {} } as never),
      ctx.provide('commands', { register: () => () => {} } as never),
      ctx.provide('systemPrompt', { section: () => () => {} } as never),
      ctx.provide('sessionQuery', { readSession: async (id: string) => logSnapshot(id) } as never),
      ctx.provide('agents', { create } as never),
      ctx.provide('llm', { resolveModelInfo } as never),
      ctx.provide('sessions', { flush: vi.fn(async () => true) } as never),
    ]
    const fiber = await ctx.plugin(ConversationFusionService)
    const caller = {
      ctx,
      options: { provider: 'fixture', model: 'planner-source' },
      session: Session.create(SessionId('caller'), undefined, {
        version: 4, isSeeded: false,
        id: SessionId('caller'),
        createdAt: 1,
        cwd: '/workspace',
      }),
    } as never

    const result = await ctx.conversationFusion.fuse({
      sourceSessionIds: [SessionId('one'), SessionId('two')],
      targetSessionId: SessionId('combined'),
      agentPlanning: true,
    }, { caller })

    expect(create).toHaveBeenCalledTimes(2)
    expect(resolveModelInfo).toHaveBeenCalledWith('fixture', 'planner-source', undefined)
    expect(create.mock.calls[0]?.[0]).toMatchObject({
      meta: { origin: 'subagent', parentSession: 'caller', cwd: '/workspace' },
      agentOptions: { provider: 'fixture', model: 'planner-source', maxTokens: 8192 },
      setup: expect.any(Function),
    })
    expect(plannerDispose).toHaveBeenCalledOnce()
    const finalCreate = create.mock.calls[1]?.[0]
    expect(finalCreate?.seed?.[1]).toMatchObject({ type: 'conversation-fusion/manifest', ignorable: true })
    expect(JSON.stringify(finalCreate?.seed)).toContain('Agent-planned fusion')
    expect(JSON.stringify(finalCreate?.seed?.[1])).toContain('Decision')
    expect(result).toMatchObject({
      title: 'Agent-planned fusion',
      strategy: 'by-source',
      planningMode: 'agent',
      agentPrunedMessages: 1,
      topics: ['Decision'],
      retainedMessages: 1,
    })

    await fiber.dispose()
    await Promise.all(removers.map(remove => remove()))
  })
})
