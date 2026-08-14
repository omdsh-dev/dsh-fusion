/** Pure browser projections and command encoding for the fusion dialog. */

import type {
  SessionId, SessionListState, SessionSummary,
} from '@deepseek-ai/dsh-client-runtime/client'

/** Options submitted by the browser fusion dialog. */
export interface FusionUiOptions {
  readonly sourceSessionIds: readonly SessionId[]
  readonly title?: string
  readonly strategy: 'chronological' | 'by-source'
  readonly deduplicate: boolean
  readonly agentPlanning: boolean
}

/** Result rendered by the browser after the command settles. */
export interface FusionUiResult {
  readonly kind: 'success' | 'error'
  readonly text: string
  readonly sessionId?: SessionId
}

/** Return eligible same-workspace, nonblank source conversations matching a query. */
export function eligibleFusionSources(
  state: SessionListState,
  currentId: SessionId,
  query: string,
): SessionSummary[] {
  const current = state.byId[currentId]
  const needle = query.trim().toLocaleLowerCase()
  const rows: SessionSummary[] = []
  for (const id of state.ids) {
    if (id === currentId) continue
    const summary = state.byId[id]
    if (summary === undefined || summary.blank || summary.cwd !== current?.cwd) continue
    if (needle !== ''
      && !summary.displayTitle.toLocaleLowerCase().includes(needle)
      && !String(summary.id).toLocaleLowerCase().includes(needle)) continue
    rows.push(summary)
  }
  return rows
}

/** Encode a typed UI request through the durable `/fuse` command plane. */
export function buildFuseCommand(options: FusionUiOptions): string {
  const title = options.title?.trim()
  return `/fuse ${JSON.stringify({
    sourceSessionIds: options.sourceSessionIds,
    ...(title === undefined || title === '' ? {} : { title }),
    strategy: options.strategy,
    deduplicate: options.deduplicate,
    agentPlanning: options.agentPlanning,
  })}`
}

/** Read the stable created-session prefix from a successful host result. */
export function createdSessionId(text: string): SessionId | undefined {
  const match = /^Created fused conversation ([A-Za-z0-9][A-Za-z0-9._-]{0,127}) \(/u.exec(text)
  return match?.[1] as SessionId | undefined
}
