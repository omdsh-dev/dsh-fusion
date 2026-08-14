#!/usr/bin/env node
/** Link a local DeepSeek Harness checkout for standalone development. */

import { mkdirSync, rmSync, symlinkSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const harness = process.env.DSH_REPO_ROOT === undefined
  ? resolve(root, '../deepseek-harness')
  : resolve(process.env.DSH_REPO_ROOT)
const links = {
  '@deepseek-ai/cordis': 'vendor/cordis',
  '@deepseek-ai/schemastery': 'vendor/schemastery',
  '@deepseek-ai/dsh-api-remotes': 'packages/api/remotes',
  '@deepseek-ai/dsh-agent': 'packages/core/agent',
  '@deepseek-ai/dsh-app-boot': 'packages/boot/app-boot',
  '@deepseek-ai/dsh-client-locale': 'packages/client/locale',
  '@deepseek-ai/dsh-client-runtime': 'packages/client/runtime',
  '@deepseek-ai/dsh-client-ui-conversation': 'packages/client/ui-conversation',
  '@deepseek-ai/dsh-client-ui-primitives': 'packages/client/ui-primitives',
  '@deepseek-ai/dsh-client-ui-slots': 'packages/client/ui-slots',
  '@deepseek-ai/dsh-commands': 'packages/interaction/commands',
  '@deepseek-ai/dsh-llm': 'packages/llm/llm',
  '@deepseek-ai/dsh-session': 'packages/core/session',
  '@deepseek-ai/dsh-session-query': 'packages/session-query/session-query',
  '@deepseek-ai/dsh-session-title': 'packages/session/session-title',
  '@deepseek-ai/dsh-system-prompt': 'packages/core/system-prompt',
  '@deepseek-ai/dsh-tools': 'packages/core/tools',
  '@deepseek-ai/dsh-fusion': '.',
}

const target = join(root, 'node_modules')
mkdirSync(target, { recursive: true })
for (const [name, relative] of Object.entries(links)) {
  const linkPath = join(target, name)
  rmSync(linkPath, { recursive: true, force: true })
  mkdirSync(dirname(linkPath), { recursive: true })
  symlinkSync(relative === '.' ? root : join(harness, relative), linkPath, 'dir')
  console.log(`linked ${name} -> ${relative === '.' ? root : join(harness, relative)}`)
}
