/** Serializable configuration for conversation fusion. */

import z from '@deepseek-ai/schemastery'

/** Maximum number of sources accepted by the public schema. */
export const HARD_MAX_SOURCES = 32
/** Maximum complete fusion payload accepted by the public schema. */
export const HARD_MAX_FUSED_BYTES = 4 * 1024 * 1024

/** Deployment-owned limits and workspace policy. */
export interface Config {
  /** Maximum unique source conversations in one fusion. Defaults to 8. */
  maxSources?: number
  /** Maximum projected messages materialized into the target surface/log. Defaults to 500. */
  maxMessages?: number
  /** Maximum UTF-8 bytes in the bounded planning/provenance snapshot. Defaults to 131072. */
  maxFusedBytes?: number
  /** Maximum UTF-8 bytes retained from one projected message. Defaults to 16384. */
  maxMessageBytes?: number
  /** Maximum UTF-8 bytes in the explicit, Agent-planned, or source-title-derived conversation title. Defaults to 160. */
  maxTitleBytes?: number
  /** Permit sources whose recorded cwd differs from the caller. Defaults to false. */
  allowCrossWorkspace?: boolean
  /** Permit requests to run the temporary DSH Agent planning stage. Defaults to true. */
  enableAgentPlanning?: boolean
  /** Maximum output tokens for the temporary planning Agent. Defaults to 8192. */
  plannerMaxTokens?: number
}

/** Configuration after defaults and cross-field checks. */
export interface ResolvedConfig {
  readonly maxSources: number
  readonly maxMessages: number
  readonly maxFusedBytes: number
  readonly maxMessageBytes: number
  readonly maxTitleBytes: number
  readonly allowCrossWorkspace: boolean
  readonly enableAgentPlanning: boolean
  readonly plannerMaxTokens: number
}

/** Loader-visible schema with deployment defaults. */
export const Config: z<Config> = z.object({
  maxSources: z.number().step(1).min(2).max(HARD_MAX_SOURCES).default(8),
  maxMessages: z.number().step(1).min(2).default(500),
  maxFusedBytes: z.number().step(1).min(1024).max(HARD_MAX_FUSED_BYTES).default(128 * 1024),
  maxMessageBytes: z.number().step(1).min(256).max(HARD_MAX_FUSED_BYTES).default(16 * 1024),
  maxTitleBytes: z.number().step(1).min(16).max(1024).default(160),
  allowCrossWorkspace: z.boolean().default(false),
  enableAgentPlanning: z.boolean().default(true),
  plannerMaxTokens: z.number().step(1).min(256).max(8192).default(8192),
})

/**
 * Resolve defaults for direct callers and enforce cross-field constraints.
 * @param config - Partial serialized configuration.
 * @returns Fully materialized configuration.
 */
export function resolveConfig(config: Config = {}): ResolvedConfig {
  const resolved: ResolvedConfig = {
    maxSources: config.maxSources ?? 8,
    maxMessages: config.maxMessages ?? 500,
    maxFusedBytes: config.maxFusedBytes ?? 128 * 1024,
    maxMessageBytes: config.maxMessageBytes ?? 16 * 1024,
    maxTitleBytes: config.maxTitleBytes ?? 160,
    allowCrossWorkspace: config.allowCrossWorkspace ?? false,
    enableAgentPlanning: config.enableAgentPlanning ?? true,
    plannerMaxTokens: config.plannerMaxTokens ?? 8192,
  }
  assertInteger('maxSources', resolved.maxSources, 2, HARD_MAX_SOURCES)
  assertInteger('maxMessages', resolved.maxMessages, 2, Number.MAX_SAFE_INTEGER)
  assertInteger('maxFusedBytes', resolved.maxFusedBytes, 1024, HARD_MAX_FUSED_BYTES)
  assertInteger('maxMessageBytes', resolved.maxMessageBytes, 256, HARD_MAX_FUSED_BYTES)
  assertInteger('maxTitleBytes', resolved.maxTitleBytes, 16, 1024)
  if (resolved.maxMessageBytes > resolved.maxFusedBytes) {
    throw new TypeError('conversation-fusion: maxMessageBytes must not exceed maxFusedBytes')
  }
  if (typeof resolved.allowCrossWorkspace !== 'boolean') {
    throw new TypeError('conversation-fusion: allowCrossWorkspace must be a boolean')
  }
  if (typeof resolved.enableAgentPlanning !== 'boolean') {
    throw new TypeError('conversation-fusion: enableAgentPlanning must be a boolean')
  }
  assertInteger('plannerMaxTokens', resolved.plannerMaxTokens, 256, 8192)
  return resolved
}

function assertInteger(name: string, value: number, min: number, max: number): void {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new TypeError(`conversation-fusion: ${name} must be a safe integer from ${min} through ${max}`)
  }
}
