import { useState, type CSSProperties, type ReactNode } from 'react'
import type { SessionListState } from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import {
  Button, IconLinkOutlineRegular, IconSearchOutlineRegular, Input, Modal,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import {
  buildFuseCommand, eligibleFusionSources, type FusionUiOptions, type FusionUiResult,
} from './model.ts'
import { NS } from './locales.ts'

/** Browser actions injected into the Session Header contribution. */
export interface FusionHeaderInjected {
  execute: (sessionId: SessionId, command: string) => Promise<FusionUiResult>
  openSession: (sessionId: SessionId) => void
}

export type FusionHeaderActionProps =
  PropsRuntime<'conversation.session.header.utilities'>
  & PropsLocale<typeof NS>
  & InjectFace<FusionHeaderInjected>

const style = {
  body: { display: 'grid', gap: 16, minWidth: 0 } satisfies CSSProperties,
  current: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    padding: '10px 12px', borderRadius: 10, background: 'var(--dsw-alias-interactive-bg-hover)',
  } satisfies CSSProperties,
  currentLabel: { color: 'var(--dsw-alias-label-secondary)', fontSize: 12 } satisfies CSSProperties,
  currentTitle: { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } satisfies CSSProperties,
  controls: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 } satisfies CSSProperties,
  field: { display: 'grid', gap: 7, minWidth: 0 } satisfies CSSProperties,
  fieldLabel: { color: 'var(--dsw-alias-label-secondary)', fontSize: 12, fontWeight: 500 } satisfies CSSProperties,
  select: {
    width: '100%', height: 36, padding: '0 10px', border: '1px solid var(--dsw-alias-border-l2)',
    borderRadius: 8, color: 'var(--dsw-alias-label-primary)', background: 'var(--dsw-alias-bg-container)',
    font: 'inherit',
  } satisfies CSSProperties,
  list: {
    display: 'grid', gap: 6, maxHeight: 'clamp(132px, 20vh, 260px)', overflowY: 'auto', padding: 2,
  } satisfies CSSProperties,
  row: {
    display: 'grid', gridTemplateColumns: '18px minmax(0, 1fr)', alignItems: 'center', gap: 10,
    padding: '10px 11px', border: '1px solid var(--dsw-alias-border-l2)', borderRadius: 10,
    cursor: 'pointer',
  } satisfies CSSProperties,
  rowText: { display: 'grid', gap: 2, minWidth: 0 } satisfies CSSProperties,
  rowTitle: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } satisfies CSSProperties,
  rowId: { color: 'var(--dsw-alias-label-secondary)', fontFamily: 'monospace', fontSize: 11 } satisfies CSSProperties,
  empty: {
    padding: '28px 16px', color: 'var(--dsw-alias-label-secondary)', textAlign: 'center',
    border: '1px dashed var(--dsw-alias-border-l2)', borderRadius: 10,
  } satisfies CSSProperties,
  checkboxLine: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 } satisfies CSSProperties,
  planner: {
    display: 'grid', gap: 5, padding: '10px 12px', borderRadius: 10,
    background: 'var(--dsw-alias-interactive-bg-hover)',
  } satisfies CSSProperties,
  plannerHelp: { marginLeft: 26, color: 'var(--dsw-alias-label-secondary)', fontSize: 12 } satisfies CSSProperties,
  status: { minHeight: 18, color: 'var(--dsw-alias-label-secondary)', fontSize: 12 } satisfies CSSProperties,
  error: { color: 'var(--dsw-alias-label-error)', fontSize: 13 } satisfies CSSProperties,
  success: { display: 'grid', gap: 10, padding: '8px 0' } satisfies CSSProperties,
  successId: {
    padding: '10px 12px', borderRadius: 8, background: 'var(--dsw-alias-interactive-bg-hover)',
    fontFamily: 'monospace', overflowWrap: 'anywhere',
  } satisfies CSSProperties,
} as const

/** Session Header button and multi-conversation fusion dialog. */
export function FusionHeaderAction({
  sessionId, useSessions, execute, openSession, t,
}: FusionHeaderActionProps): ReactNode {
  const sessions: SessionListState = useSessions((snapshot: SessionListState) => snapshot)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<ReadonlySet<SessionId>>(() => new Set())
  const [title, setTitle] = useState('')
  const [strategy, setStrategy] = useState<FusionUiOptions['strategy']>('chronological')
  const [deduplicate, setDeduplicate] = useState(true)
  const [agentPlanning, setAgentPlanning] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<FusionUiResult | null>(null)

  const current = sessions.byId[sessionId]
  const candidates = eligibleFusionSources(sessions, sessionId, query)
  const createdReady = created?.sessionId !== undefined && sessions.byId[created.sessionId] !== undefined

  const reset = (): void => {
    setQuery('')
    setSelected(new Set())
    setTitle('')
    setStrategy('chronological')
    setDeduplicate(true)
    setAgentPlanning(false)
    setError(null)
    setCreated(null)
  }
  const dismiss = (): void => {
    if (busy) return
    setOpen(false)
    reset()
  }
  const toggle = (id: SessionId): void => {
    setSelected((previous) => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const submit = async (): Promise<void> => {
    if (selected.size === 0 || busy) return
    setBusy(true)
    setError(null)
    const options: FusionUiOptions = {
      sourceSessionIds: [...selected], title, strategy, deduplicate, agentPlanning,
    }
    try {
      const result = await execute(sessionId, buildFuseCommand(options))
      if (result.kind === 'error') setError(result.text)
      else setCreated(result)
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setBusy(false)
    }
  }

  const footer = created === null
    ? (
      <>
        <Button variant="outline" onClick={dismiss} disabled={busy}>{t('dialog.cancel')}</Button>
        <Button variant="primary" onClick={() => { void submit() }} disabled={selected.size === 0 || busy}>
          {busy ? t(agentPlanning ? 'dialog.agentSubmitting' : 'dialog.submitting') : t('dialog.submit')}
        </Button>
      </>
      )
    : (
      <>
        <Button variant="outline" onClick={dismiss}>{t('dialog.close')}</Button>
        {created.sessionId !== undefined && (
          <Button
            variant="primary"
            disabled={!createdReady}
            title={createdReady ? undefined : t('dialog.notReady')}
            onClick={() => {
              if (created.sessionId === undefined || !createdReady) return
              openSession(created.sessionId)
              dismiss()
            }}
          >
            {t('dialog.open')}
          </Button>
        )}
      </>
      )

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        icon={<IconLinkOutlineRegular size={14} />}
        onClick={() => { reset(); setOpen(true) }}
      >
        {t('action.label')}
      </Button>
      <Modal
        open={open}
        onClose={dismiss}
        title={created === null ? t('dialog.title') : t('dialog.successTitle')}
        description={created === null ? t('dialog.description') : t('dialog.successDescription')}
        closeLabel={t('dialog.close')}
        footer={footer}
      >
        {created === null
          ? (
            <div style={style.body}>
              <div style={style.current}>
                <span style={style.currentLabel}>{t('dialog.current')}</span>
                <strong style={style.currentTitle}>{current?.displayTitle ?? sessionId}</strong>
              </div>
              <Input
                icon={<IconSearchOutlineRegular size={14} />}
                value={query}
                aria-label={t('dialog.search')}
                placeholder={t('dialog.search')}
                onChange={event => { setQuery(event.currentTarget.value) }}
              />
              <div style={style.list} aria-label={t('dialog.title')}>
                {candidates.length === 0
                  ? <div style={style.empty}>{t('dialog.noResults')}</div>
                  : candidates.map(summary => (
                    <label key={summary.id} style={style.row}>
                      <input
                        type="checkbox"
                        checked={selected.has(summary.id)}
                        onChange={() => { toggle(summary.id) }}
                      />
                      <span style={style.rowText}>
                        <span style={style.rowTitle}>{summary.displayTitle}</span>
                        <span style={style.rowId}>{summary.id}</span>
                      </span>
                    </label>
                  ))}
              </div>
              <div style={style.controls}>
                <label style={style.field}>
                  <span style={style.fieldLabel}>{t('dialog.titleLabel')}</span>
                  <Input
                    value={title}
                    placeholder={t('dialog.titlePlaceholder')}
                    onChange={event => { setTitle(event.currentTarget.value) }}
                  />
                </label>
                <label style={style.field}>
                  <span style={style.fieldLabel}>{t('dialog.strategyLabel')}</span>
                  <select
                    style={style.select}
                    value={strategy}
                    onChange={event => { setStrategy(event.currentTarget.value as FusionUiOptions['strategy']) }}
                  >
                    <option value="chronological">{t('dialog.chronological')}</option>
                    <option value="by-source">{t('dialog.bySource')}</option>
                  </select>
                </label>
              </div>
              <label style={style.checkboxLine}>
                <input
                  type="checkbox"
                  checked={deduplicate}
                  onChange={event => { setDeduplicate(event.currentTarget.checked) }}
                />
                <span>{t('dialog.deduplicate')}</span>
              </label>
              <div style={style.planner}>
                <label style={style.checkboxLine}>
                  <input
                    type="checkbox"
                    checked={agentPlanning}
                    onChange={event => { setAgentPlanning(event.currentTarget.checked) }}
                  />
                  <strong>{t('dialog.agentPlanning')}</strong>
                </label>
                <span style={style.plannerHelp}>{t('dialog.agentPlanningHelp')}</span>
              </div>
              <div style={style.status} aria-live="polite">
                {t('dialog.selected', { count: selected.size })}
              </div>
              {error !== null && <div role="alert" style={style.error}>{error}</div>}
            </div>
            )
          : (
            <div style={style.success}>
              {created.sessionId !== undefined && <code style={style.successId}>{created.sessionId}</code>}
              {created.sessionId !== undefined && agentPlanning && <p>{created.text}</p>}
              {created.sessionId === undefined && <p>{created.text}</p>}
              {!createdReady && created.sessionId !== undefined && <p style={style.status}>{t('dialog.notReady')}</p>}
            </div>
            )}
      </Modal>
    </>
  )
}
