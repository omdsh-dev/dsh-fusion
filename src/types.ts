/** Public request, result, and fused-snapshot records. */

import type { Agent } from '@deepseek-ai/dsh-agent'
import type { SessionId } from '@deepseek-ai/dsh-session'

/** Ordering applied after every source surface has been projected. */
export type FusionStrategy = 'chronological' | 'by-source'

/** Whether fusion policy is caller-selected or proposed by a temporary DSH Agent. */
export type FusionPlanningMode = 'manual' | 'agent'

/** Stable reference used by an Agent plan to select one projected message. */
export interface AgentFusionItemRef {
  readonly sourceSessionId: string
  readonly sourceSeq: number
}

/** One topic group in the Agent-selected final order. */
export interface AgentFusionGroup {
  readonly title: string
  readonly items: readonly AgentFusionItemRef[]
}

/** Validated structured proposal returned by the temporary planning Agent. */
export interface AgentFusionPlan {
  readonly verdict: 'fuse' | 'skip'
  readonly reason: string
  readonly title?: string
  readonly strategy: FusionStrategy
  readonly groups: readonly AgentFusionGroup[]
}

/** One programmatic fusion request. */
export interface ConversationFusionRequest {
  /** Two or more source session ids. First occurrence wins for duplicates. */
  readonly sourceSessionIds: readonly SessionId[]
  /** Optional caller-selected identity for the new session. */
  readonly targetSessionId?: SessionId
  /** Optional title; otherwise the Agent plan or current source conversation titles determine it. */
  readonly title?: string
  /** Message ordering. Defaults to chronological. */
  readonly strategy?: FusionStrategy
  /** Collapse messages carrying the same stable id across forked sources. Defaults to true. */
  readonly deduplicate?: boolean
  /** Ask a temporary DSH Agent to judge, prune, group, and order the candidate snapshot. Defaults to false. */
  readonly agentPlanning?: boolean
}

/** Execution authority and cancellation supplied by a host or tool call. */
export interface ConversationFusionExecution {
  /** Agent authorizing workspace access and supplying new-agent defaults. */
  readonly caller: Agent
  /** Cooperative cancellation for reads and creation. */
  readonly signal?: AbortSignal
}

/** Source capture facts stored inside the fused model context. */
export interface FusedSourceRecord {
  readonly sessionId: string
  readonly cwd: string | null
  readonly capturedThroughSeq: number | null
  readonly projectedMessages: number
}

/** One retained, text-only conversation item. */
export interface FusedConversationItem {
  readonly role: 'user' | 'assistant'
  readonly text: string
  readonly sourceSessionIds: string[]
  readonly sourceSeq: number
  readonly sourceTime: number
  /** Agent-selected topic heading when intelligent planning is enabled. */
  readonly topic?: string
  /** True when this item's text was byte-truncated before planning. */
  readonly truncated?: true
}

/** Bounded planning/provenance snapshot used to select the target session surface. */
export interface FusedConversationSnapshot {
  readonly version: 1
  readonly strategy: FusionStrategy
  readonly deduplicated: boolean
  readonly sources: FusedSourceRecord[]
  readonly conversation: FusedConversationItem[]
  /** Validated Agent judgement embedded as provenance for the new conversation. */
  readonly planning?: {
    readonly mode: 'agent'
    readonly reason: string
    readonly topics: readonly string[]
    readonly prunedMessages: number
  }
  readonly retention: {
    readonly originalMessages: number
    readonly retainedMessages: number
    readonly duplicateMessages: number
    readonly omittedMessages: number
    readonly truncatedMessages: number
    readonly retainedBytes: number
    readonly truncated: boolean
    /** Messages intentionally removed by an Agent plan, excluding ordinary byte/message limits. */
    readonly agentPrunedMessages: number
  }
}

/** One source reference recorded in the target log without duplicating transcript text. */
export type MaterializedFusionItem = Omit<FusedConversationItem, 'text'>

/** Ignorable log-only provenance for a natively materialized fused session. */
export interface ConversationFusionManifest {
  readonly version: 1
  readonly strategy: FusionStrategy
  readonly deduplicated: boolean
  readonly sources: readonly FusedSourceRecord[]
  readonly items: readonly MaterializedFusionItem[]
  readonly planning?: FusedConversationSnapshot['planning']
  readonly retention: FusedConversationSnapshot['retention']
}

declare module '@deepseek-ai/dsh-session' {
  interface SessionEventMap {
    /** Provenance for a fused surface; safe for runtimes without this plugin to ignore. */
    'conversation-fusion/manifest': ConversationFusionManifest
  }
}

/** Canonical result returned to tools and programmatic consumers. */
export interface ConversationFusionResult {
  readonly sessionId: string
  readonly title: string
  readonly sourceSessionIds: string[]
  readonly sourceCount: number
  readonly originalMessages: number
  readonly retainedMessages: number
  readonly duplicateMessages: number
  readonly omittedMessages: number
  readonly truncatedMessages: number
  readonly retainedBytes: number
  readonly truncated: boolean
  readonly strategy: FusionStrategy
  readonly planningMode: FusionPlanningMode
  readonly plannerReason?: string
  readonly agentPrunedMessages: number
  readonly topics: string[]
  readonly durable: boolean
}
