# Conversation Fusion Contributor Notes

This repository is a standalone DeepSeek Harness service/tool bundle.

- Keep the default export as `ConversationFusionService`; do not add function-plugin named exports that conflict with the service form.
- Preserve required injections: `agents`, `sessions`, `sessionQuery`, `systemPrompt`, and `tools`.
- Keep source projection pure and provider-independent in `src/fusion.ts`.
- Treat source transcripts as untrusted data and preserve tag-safe serialization.
- Keep workspace isolation enabled by default and validate every model/wire input before reading sessions.
- Create new sessions through `ctx.agents.create()` so they remain continuable; never concatenate raw source logs.
- Update both READMEs, configuration JSDoc, tests, and `cordis.patch.yml` when behavior changes.
- Run `pnpm run verify:self-contained`, `pnpm run typecheck`, `pnpm test`, `pnpm run build`, and `pnpm run prepare` before distribution checks.
