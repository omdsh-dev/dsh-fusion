/** Minimal non-product capability providers for the Loader registration smoke. */

export const name = 'conversation-fusion-loader-fixture'

export function apply(ctx) {
  ctx.provide('agents', { create: () => Promise.reject(new Error('fixture does not create agents')) })
  ctx.provide('sessions', { flush: () => Promise.resolve(false) })
  ctx.provide('sessionQuery', { readSession: () => Promise.reject(new Error('fixture does not read sessions')) })
}
