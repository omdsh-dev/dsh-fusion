#!/usr/bin/env node
/** Boot built package artifacts through the DSH app Loader and report surfaces. */

import { boot, resolveConfigPath } from '@deepseek-ai/dsh-app-boot'

const configPath = process.argv[2]
if (configPath === undefined) throw new Error('conversation-fusion loader driver requires a config path')

const ctx = await boot('dsh-fusion-loader-smoke', resolveConfigPath(configPath, undefined))
try {
  const schema = ctx.tools.schemas().find(tool => tool.name === 'conversation_fuse')
  if (schema === undefined) throw new Error('conversation_fuse was not registered')
  const section = (await ctx.systemPrompt.assemble()).sections
    .find(candidate => candidate.name === 'tool:conversation-fusion')
  const properties = schema.parameters.properties
  const command = ctx.commands.list({}).find(candidate => candidate.name === 'fuse')
  process.stdout.write(JSON.stringify({
    schemaRegistered: true,
    commandRegistered: command !== undefined,
    commandInputHint: command?.input?.hint,
    sourceIdsRequired: schema.parameters.required?.includes('sourceSessionIds') === true,
    strategyEnum: properties.strategy?.enum,
    agentPlanningType: properties.agentPlanning?.type,
    promptText: section?.text,
  }))
} finally {
  await ctx.fiber.dispose()
}
