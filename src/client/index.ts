/** Browser plugin contributing a conversation-fusion Header action and modal. */

import type { ClientContext, ISessions, SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { CommandResult } from '@deepseek-ai/dsh-commands'
import { FusionHeaderAction, type FusionHeaderInjected } from './FusionHeaderAction.tsx'
import { createdSessionId, type FusionUiResult } from './model.ts'
import { en, NS, zh, type FusionLocaleKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'conversation-fusion': FusionLocaleKey
  }
}

export const inject = ['slots', 'locale', 'sessions', 'remote', 'remote.commands']

function toUiResult(result: CommandResult): FusionUiResult {
  if (result.kind === 'error') return { kind: 'error', text: result.text }
  const text = result.text ?? 'Conversation fusion completed.'
  const sessionId = createdSessionId(text)
  return { kind: 'success', text, ...(sessionId === undefined ? {} : { sessionId }) }
}

/** Register the localized Session Header contribution. */
export function apply(ctx: ClientContext): void {
  const sessions = ctx.sessions as unknown as ISessions
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'conversation-fusion: browser dictionaries')
  ctx.slots.inject('conversation.session.header.utilities', () => ctx.slots.register({
    name: 'conversation.session.header.utilities',
    id: 'conversation-fusion',
    order: 20,
    locale: NS,
    inject: (): FusionHeaderInjected => ({
      execute: async (sessionId, command) => {
        const response = await ctx.remote.commands.execute(sessionId, command)
        if (!response.ok) throw new Error(`command.execute failed: ${response.error.code}: ${response.error.message}`)
        if (response.value === undefined) return { kind: 'error', text: 'The /fuse command was not recognized.' }
        return toUiResult(response.value.result)
      },
      openSession: (sessionId: SessionId) => { sessions.open(sessionId) },
    }),
  }, FusionHeaderAction))
}

export type { FusionHeaderActionProps, FusionHeaderInjected } from './FusionHeaderAction.tsx'
export type { FusionUiOptions, FusionUiResult } from './model.ts'
