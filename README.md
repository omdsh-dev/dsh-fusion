# dsh-fusion

**English** | [中文](README.zh.md)

A DeepSeek Harness bundle that fuses the current model surfaces of two or more sessions into one independently identified, titled, durable, and continuable conversation whose retained messages are native target-session log events. Source sessions are never modified.

## Capabilities

- Fuses 2–32 conversations; the deployment default limit is 8.
- Orders projected messages chronologically or groups them by caller-selected source order.
- Deduplicates shared fork prefixes by stable message id without collapsing coincidentally identical prose.
- Projects text from user and assistant messages while excluding reasoning, tool calls, and tool results.
- Inherits the caller's cwd, provider/model options, and creation-time agent preset.
- Attaches the target to the caller/source Workspace group when the optional Host Workspace registry is available.
- Uses an explicit title, then an Agent-planned title, then a readable title derived from the source conversation titles.
- Seeds a deterministic `session/title`, an ignorable provenance manifest, one untrusted-history boundary, and native `user/message` / `assistant/message` events with valid target-owned turn/step brackets, then requests a persistence flush.
- Restricts sources to the caller's cwd by default; a deployment must explicitly enable cross-workspace fusion.
- Optionally runs a temporary, tool-free DSH Agent to judge fusion value and return a strictly validated pruning, topic-grouping, and ordering plan.

## Installation

This repository is a DSH bundle with `cordis.patch.yml`:

```sh
dsh plugin --profile web add /path/to/dsh-fusion
```

Restart DSH after installation. The profile loads `@deepseek-ai/dsh-fusion`; the `/fuse` entry appears in the slash menu and `conversation_fuse` appears in the model tool catalog. The selected profile must provide `agents`, `commands`, `sessions`, `sessionQuery`, `systemPrompt`, and `tools`. Compositions that provide an `invariants` service may mount the optional `@deepseek-ai/dsh-fusion/invariant` entry separately; the default bundle does not enable it.

## UI command

Click **Fuse conversations** in any DSH conversation Header. The dialog includes the current conversation automatically and lists other nonblank conversations in the same workspace. It supports source search and multi-selection, an optional title (leave it blank to generate one from the source titles), chronological or source-grouped ordering, fork-history deduplication, and optional intelligent Agent planning. The planning Agent can decline an incoherent fusion or prune, group, and reorder useful material. After creation, the new conversation joins the same Workspace group and the dialog can open it as soon as it appears in the session list.

The dialog executes through DSH's command plane. Manual mode makes no extra model request; intelligent planning sends only the authorized, projected, byte-bounded candidate snapshot to a temporary DSH Agent. The text command remains available:

```text
/fuse <other-session-id> [more-session-ids...]
```

For example, from `session-research`:

```text
/fuse session-implementation session-review
```

The current conversation is included automatically, so the command accepts only the other source ids. Spaces and commas are accepted as separators. It runs without a model call, creates the fused conversation with chronological ordering and fork-prefix deduplication, then reports the new session id for opening from the conversation list. Invalid, missing, or cross-workspace sources are reported directly in the UI.

## Tool

`conversation_fuse` accepts:

| Parameter | Type | Required | Meaning |
|---|---|---|---|
| `sourceSessionIds` | `string[]` | yes | At least two unique source ids. |
| `targetSessionId` | `string` | no | New id; defaults to `fusion-<uuid>`. |
| `title` | `string` | no | New conversation title; defaults to the Agent suggestion or source conversation titles. |
| `strategy` | `chronological \| by-source` | no | Defaults to `chronological`. |
| `deduplicate` | `boolean` | no | Collapse shared stable message ids; defaults to `true`. |
| `agentPlanning` | `boolean` | no | Run the temporary DSH Agent judgement/pruning/grouping stage; defaults to `false`. |

The canonical result includes the new id, source and retention counts, Agent-pruned count, topic headings, planning reason, retained bytes, strategy, and whether a persistence listener participated.

## Service API

Other Host plugins can call `ctx.conversationFusion.fuse(request, { caller, signal })`. The caller supplies workspace authority and new-agent defaults. Including the current conversation still requires its id in `sourceSessionIds`.

## Fusion semantics

Each source is read atomically through `sessionQuery.readSession()` and its current surface is folded from the validated raw log, so shadowed pre-compaction nodes do not reappear. The plugin also folds the latest logged source titles for automatic naming. It projects text, deduplicates shared ids, applies the selected order, and retains newer entries within the configured message and UTF-8 byte budgets. With Agent planning enabled, it creates an `origin: subagent` temporary DSH Agent using the caller's provider/model, a complete planning-only system prompt, and an empty tool allowlist. The service strictly validates its verdict, prose bounds, strategy, groups, and every `(sourceSessionId, sourceSeq)` reference before pure code applies the plan. A `skip` verdict creates no target conversation. A valid `fuse` verdict materializes every retained item as an individual target-owned surface/log message inside a closed synthetic turn. Raw source logs are never concatenated because their seq, execution, tool, and replacement references belong to different sessions. After publication, the target is attached to the Workspace that directly contains the caller, or to a same-cwd source Workspace when the caller is not listed. Fusion is a point-in-time snapshot, not a live link.

## Configuration

| Field | Default | Meaning |
|---|---:|---|
| `maxSources` | `8` | Unique sources per call; hard limit 32. |
| `maxMessages` | `500` | Projected messages retained and natively materialized before byte fitting. |
| `maxFusedBytes` | `131072` | Bounded planning/provenance JSON UTF-8 byte limit. |
| `maxMessageBytes` | `16384` | Per-message UTF-8 byte limit. |
| `maxTitleBytes` | `160` | Title UTF-8 byte limit. |
| `allowCrossWorkspace` | `false` | Permit source cwd values different from the caller. |
| `enableAgentPlanning` | `true` | Permit requests to run a temporary planning Agent. |
| `plannerMaxTokens` | `8192` | Planning Agent output token cap, from 256 through 8192. Reasoning is disabled for planner requests when the selected model exposes an effort control. |

## Development

```sh
pnpm install
node scripts/link-harness.mjs
pnpm run verify:self-contained
pnpm run typecheck
pnpm test
pnpm run build
pnpm run prepare
pnpm pack --dry-run --json
```

The development links and compatibility range target the public `deepseek-ai/deepseek-harness` `0.1.0-rc.5` API. By default, the link script uses a sibling checkout named `deepseek-harness`; set `DSH_REPO_ROOT` when the checkout lives elsewhere. Build the Harness libraries first when that checkout has no `lib/` artifacts:

```sh
cd /path/to/deepseek-harness
pnpm install
pnpm run build:lib
```

## Model Experience

### System prompt and tool schema

#### What the model sees

A stable instruction explains when to call `conversation_fuse`, and the tool schema requires explicit source ids.

#### Token effect

A small fixed prompt and schema cost applies while the plugin is loaded. No fused body is added until the tool creates a conversation.

#### KV Cache effect

The prefix stays stable while the plugin and schema are unchanged. Loading, unloading, or changing the schema can invalidate reuse from this section.

### Native fused surface and log

#### What the model sees

The new conversation contains a short recall boundary followed by one native user/assistant surface event per retained source message. Its raw log also contains valid target-owned turn/step brackets and an ignorable provenance manifest with source references, planning facts, and retention statistics; transcript text is not duplicated into that manifest.

#### Token effect

The new session resends the bounded native message history on later requests until another plugin replaces or compacts it.

#### KV Cache effect

The materialized events form a stable prefix within the new session. A separate fusion creates a separate prefix and never rewrites an existing source session.

### Tool result

#### What the model sees

Structured creation and retention facts plus a short rendered summary naming the new session and title.

#### Token effect

Only the completed call adds these bounded result tokens; the complete fused body is not repeated in the result.

#### KV Cache effect

The result is appended after the current reusable prefix.

### Intelligent Agent planning

#### What the model sees

Only with `agentPlanning: true`, a temporary DSH Agent sees a complete planning-only system prompt and the already projected, deduplicated, bounded candidate JSON marked as untrusted. It must return a structured verdict, reason, suggested title, strategy, and topic groups containing exact message references.

#### Token effect

Intelligent planning adds one independent model request. Its input is bounded by `maxMessages`, `maxMessageBytes`, and `maxFusedBytes`; output is bounded by `plannerMaxTokens`. Manual fusion adds no planner request.

#### KV Cache effect

The temporary Agent does not reuse the initiating conversation prefix. Its stable system prompt may be cacheable where the provider supports it, while the candidate JSON changes per request. Only validated planning provenance and retained content are materialized into the new conversation.

## Known Limitations and Deferred Work

- **Snapshot only** — later source updates do not propagate.
- **Text projection** — images, reasoning, tool calls, and tool results are omitted pending portable attachment and tool-correlation projections.
- **One working directory** — the new session inherits the caller cwd and its matching Workspace membership; cross-workspace fusion does not merge filesystem authority or attach the target to foreign Workspace groups.
- **Optional Workspace service** — minimal standalone compositions without `workspaceRegistry` still create a valid session, but no group exists to inherit there.
- **Creation-header preset** — a blank session switched to another preset later is fused using its creation-time header preset.
- **Post-publication flush failure** — a failed durability checkpoint reports an error but deliberately leaves the already-published live session intact.
- **Planner model dependency** — intelligent planning inherits the caller's provider/model. Provider failure, truncated output, invalid JSON, or an invalid message reference aborts fusion before the target session is created; manual mode remains deterministic and model-free.
