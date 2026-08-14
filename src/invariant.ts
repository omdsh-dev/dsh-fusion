/** Invariant companion for the conversation-fusion bundle. */

import type { Context } from '@deepseek-ai/cordis'

const PACKAGE_NAME = '@deepseek-ai/dsh-fusion'

type InvariantFailure = (message: string) => never
type InvariantInstaller = (ctx: Context, fail: InvariantFailure) => void | Promise<void>

interface InvariantRegistry {
  register(packageName: string, installer: InvariantInstaller): () => void
}

/** Cordis companion plugin name. */
export const name = 'conversation-fusion-invariant'
/** Host registry required for package ownership. */
export const inject = ['invariants']

/**
 * No additional runtime invariant: fused provenance is stored inside the known
 * user/message event and session creation validates the complete seed.
 */
const install: InvariantInstaller = () => {}

/** Register the package-attributed invariant installer. */
export const apply = (ctx: Context): Promise<() => void> => {
  const registry = ctx.get('invariants') as InvariantRegistry | undefined
  if (registry === undefined) throw new Error(`invariant companion requires "invariants" for ${PACKAGE_NAME}`)
  return Promise.resolve(registry.register(PACKAGE_NAME, install))
}
