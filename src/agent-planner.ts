/** Temporary DSH Agent driver for intelligent conversation-fusion planning. */

import { randomUUID } from 'node:crypto'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { createUserMessage, ReasoningEffortId } from '@deepseek-ai/dsh-llm'
import { joinAssistantStreamText } from '@deepseek-ai/dsh-llm/assistant-stream'
import { SessionId, type SessionEvent, type TurnEndReason } from '@deepseek-ai/dsh-session'
import { parseAgentFusionPlan, PLANNER_SYSTEM_PROMPT, renderAgentPlanningRequest } from './planning.ts'
import type { AgentFusionPlan, FusedConversationSnapshot, FusionStrategy } from './types.ts'

/** Run one isolated, tool-free DSH Agent turn and return its validated plan. */
export async function planFusionWithAgent(
  caller: Agent,
  snapshot: FusedConversationSnapshot,
  options: {
    readonly maxTokens: number
    readonly title?: string
    readonly strategy: FusionStrategy
    readonly signal?: AbortSignal
  },
): Promise<AgentFusionPlan> {
  options.signal?.throwIfAborted()
  const reasoningEffort = await plannerReasoningOff(caller, options.signal)
  const handle = await caller.ctx.agents.create({
    sessionId: SessionId(`fusion-planner-${randomUUID()}`),
    meta: {
      ...(caller.session.header.cwd === undefined ? {} : { cwd: caller.session.header.cwd }),
      parentSession: caller.session.header.id,
      origin: 'subagent',
    },
    agentOptions: { ...caller.options, maxTokens: options.maxTokens },
    ...(options.signal === undefined ? {} : { signal: options.signal }),
    setup: (agentCtx) => {
      agentCtx.systemPrompt.section({
        name: 'conversation-fusion:planner',
        order: 0,
        text: PLANNER_SYSTEM_PROMPT,
        complete: true,
      })
      agentCtx.tools.restrict({ allow: [] })
      if (reasoningEffort !== undefined) {
        agentCtx.on('agent/request', async (_payload, next) => ({
          ...await next(),
          reasoningEffort,
        }))
      }
    },
  })
  const abort = (): void => { handle.agent.cancel({ kind: 'parent' }) }
  options.signal?.addEventListener('abort', abort, { once: true })
  try {
    await handle.agent.whenIdle()
    options.signal?.throwIfAborted()
    handle.agent.followup(createUserMessage({
      source: { kind: 'plugin:conversation-fusion', form: 'recall' },
      content: [{
        type: 'text',
        text: renderAgentPlanningRequest(snapshot, {
          ...(options.title === undefined ? {} : { title: options.title }),
          strategy: options.strategy,
        }),
      }],
    }))
    await handle.agent.whenIdle()
    options.signal?.throwIfAborted()
    const events = handle.agent.session.snapshotEvents()
    const reason = finalTurnEndReason(events)
    const output = plannerAssistantText(events, options.maxTokens)
    try {
      return parseAgentFusionPlan(output, snapshot.conversation.length)
    } catch (error) {
      if (reason?.kind === 'max-tokens') throw plannerTokenBudgetError(options.maxTokens, error)
      throw error
    }
  } finally {
    options.signal?.removeEventListener('abort', abort)
    await handle.dispose()
  }
}

async function plannerReasoningOff(agent: Agent, signal?: AbortSignal): Promise<ReasoningEffortId | undefined> {
  const header = agent.session.requestHeader()
  const provider = agent.options.provider ?? header?.config.provider
  const model = agent.options.model ?? header?.config.model
  const llm = agent.ctx.get('llm')
  if (llm !== undefined && provider !== undefined && model !== undefined) {
    try {
      const info = await llm.resolveModelInfo(provider, model, signal)
      const off = info.reasoning?.efforts.find(effort => effort.id === 'off')
      if (off !== undefined) return off.id
    } catch {
      signal?.throwIfAborted()
      // Metadata is advisory; the actual planner request remains authoritative.
    }
  }
  return header?.config.reasoningEffort === undefined ? undefined : ReasoningEffortId('off')
}

/** Select planner text and expose terminal Agent failures instead of masking them as empty output. */
export function plannerAssistantText(events: readonly SessionEvent[], maxTokens: number): string {
  const reason = finalTurnEndReason(events)
  if (reason?.kind === 'error') {
    throw new Error(`conversation-fusion: planner Agent failed (${reason.error.code}): ${reason.error.message}`)
  }
  if (reason?.kind === 'aborted') {
    throw new Error(`conversation-fusion: planner Agent was aborted (${reason.reason.kind})`)
  }
  if (reason?.kind === 'blocked' || reason?.kind === 'interrupted') {
    throw new Error(`conversation-fusion: planner Agent ended with ${reason.kind}`)
  }

  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index]
    if (event?.type !== 'assistant/message' || event.data.message.content.length === 0) continue
    const text = event.data.message.content
      .flatMap(block => block.type === 'text' ? [block.text] : [])
      .join('')
      .trim()
    if (text !== '') return text
  }

  const streamed = events.flatMap(event => (
    event.type === 'assistant/attempt' || event.type === 'assistant/message'
      ? [joinAssistantStreamText(event.data.stream)]
      : []
  )).join('').trim()
  if (streamed !== '') return streamed

  if (reason?.kind === 'max-tokens') throw plannerTokenBudgetError(maxTokens)
  throw new Error('conversation-fusion: planner Agent returned no text response')
}

function finalTurnEndReason(events: readonly SessionEvent[]): TurnEndReason | undefined {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index]
    if (event?.type === 'turn/end') return event.data.reason
  }
  return undefined
}

function plannerTokenBudgetError(maxTokens: number, cause?: unknown): Error {
  return new Error(
    `conversation-fusion: planner Agent exhausted its ${maxTokens}-token output budget before producing a valid plan; increase plannerMaxTokens or reduce the fused context`,
    cause === undefined ? undefined : { cause },
  )
}
