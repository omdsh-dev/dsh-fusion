import { describe, expect, it } from 'vitest'
import { resolveConfig } from '../src/config.ts'

describe('resolveConfig', () => {
  it('materializes standalone defaults', () => {
    expect(resolveConfig()).toEqual({
      maxSources: 8,
      maxMessages: 500,
      maxFusedBytes: 131072,
      maxMessageBytes: 16384,
      maxTitleBytes: 160,
      allowCrossWorkspace: false,
      enableAgentPlanning: true,
      plannerMaxTokens: 8192,
    })
  })

  it('accepts deployment overrides', () => {
    expect(resolveConfig({
      maxSources: 4,
      maxMessages: 20,
      maxFusedBytes: 4096,
      maxMessageBytes: 512,
      maxTitleBytes: 80,
      allowCrossWorkspace: true,
      enableAgentPlanning: false,
      plannerMaxTokens: 1024,
    })).toMatchObject({
      maxSources: 4,
      maxMessages: 20,
      allowCrossWorkspace: true,
      enableAgentPlanning: false,
      plannerMaxTokens: 1024,
    })
  })

  it('rejects invalid and conflicting limits', () => {
    expect(() => resolveConfig({ maxSources: 1 })).toThrow(/maxSources/)
    expect(() => resolveConfig({ maxFusedBytes: 1024, maxMessageBytes: 2048 })).toThrow(/must not exceed/)
    expect(() => resolveConfig({ allowCrossWorkspace: 'yes' as never })).toThrow(/boolean/)
    expect(() => resolveConfig({ enableAgentPlanning: 'yes' as never })).toThrow(/boolean/)
    expect(() => resolveConfig({ plannerMaxTokens: 32 })).toThrow(/plannerMaxTokens/)
  })
})
