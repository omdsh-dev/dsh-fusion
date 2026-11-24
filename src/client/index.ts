/** Browser plugin contributing a conversation-fusion Header action and modal. */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import type { CommandResult } from '@deepseek-ai/dsh-commands'
import { FusionHeaderAction, type FusionHeaderInjected } from './FusionHeaderAction.tsx'
import { createdSessionId, type FusionUiResult } from './model.ts'
import { en, NS, zh, type FusionLocaleKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'conversation-fusion': FusionLocaleKey
  }
}

export const inject = ['slots', 'locale', 'uiWorkspace', 'remote', 'remote.commands']

function toUiResult(result: CommandResult): FusionUiResult {
  if (result.kind === 'error') return { kind: 'error', text: result.text }
  const text = result.text ?? 'Conversation fusion completed.'
  const sessionId = createdSessionId(text)
  return { kind: 'success', text, ...(sessionId === undefined ? {} : { sessionId }) }
}

/** Register the localized Session Header contribution. */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'conversation-fusion: browser dictionaries')
  ctx.slots.inject('conversation.session.header.utilities', () => ctx.slots.register({
    name: 'conversation.session.header.utilities',
    id: 'conversation-fusion',
    order: 20,
    locale: NS,
    inject: (): FusionHeaderInjected => ({
      execute: async (sessionId, command) => {
        const response = await ctx.remote.commands.execute(sessionId, command, [])
        if (!response.ok) throw new Error(`command.execute failed: ${response.error.code}: ${response.error.message}`)
        if (response.value === undefined) return { kind: 'error', text: 'The /fuse command was not recognized.' }
        return toUiResult(response.value.result)
      },
      openSession: (sessionId: SessionId) => { ctx.uiWorkspace.openSession(sessionId) },
    }),
  }, FusionHeaderAction))
}

export type { FusionHeaderActionProps, FusionHeaderInjected } from './FusionHeaderAction.tsx'
export type { FusionUiOptions, FusionUiResult } from './model.ts'
