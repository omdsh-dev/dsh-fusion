# dsh-fusion

[English](README.md) | **中文**

面向 DeepSeek Harness 的多会话融合 bundle。它把两个或更多现有会话在调用时的当前模型表层，组合成一个拥有独立 id、标题、agent 和持久化日志的新会话；保留消息会成为目标会话自身的原生日志事件，新会话可继续对话，不会修改任何源会话。

## 能力

- 融合 2 到 32 个会话，部署默认上限为 8。
- `chronological` 按时间穿插各来源，同时保持每个来源的表层顺序。`by-source` 按调用者给出的来源顺序分组，组内沿用表层顺序。
- 默认按稳定 message id 去除 fork 会话共享的历史前缀，不会把偶然相同的自然语言误判为重复。
- 与 Shuttle 同装时保留完整回合、推理和成对的工具记录。独立安装时融合用户和助手的文本。
- 继承调用者的 cwd、provider/model 选项和创建时记录的 agent preset。
- Host 提供 Workspace 注册表时，把新会话自动加入调用者/同 cwd 源会话所在分组。
- 标题优先采用显式输入，其次采用 Agent 规划标题，最后根据源会话当前标题自动生成。
- 生成确定性的 `session/title`、可忽略的融合清单、不可信历史边界，以及带合法目标 turn/step 结构的原生 `user/message` / `assistant/message`，随后执行 `session/flush` 持久化检查点。
- 默认只允许融合与调用者 cwd 相同的会话；跨工作区必须由部署显式启用。
- 规划输入使用标签安全 JSON；目标会话以系统级规则和表层边界把后续历史标记为不可信背景，避免旧会话内容获得当前授权。
- 可选启动一个临时、无工具的 DSH Agent，先判断话题是否值得融合，再以结构化方案剪枝、按话题分组和重排；方案引用会由服务端逐项校验。

## 安装

本包是自带 `cordis.patch.yml` 的 DSH bundle：

```sh
dsh plugin --profile web add /path/to/dsh-fusion
```

重启 DSH 进程后，profile 会加载 `@deepseek-ai/dsh-fusion`，界面斜杠菜单中出现 `/fuse`，模型工具目录中出现 `conversation_fuse`。所选 profile 必须提供 `agents`、`commands`、`sessions`、`sessionQuery`、`systemPrompt` 和 `tools` 服务。

## 界面操作

在任一 DSH 对话的标题栏点击 **融合对话**。弹窗会自动包含当前对话，并列出同工作区内其他非空对话，可执行以下操作：

- 按标题或 session id 搜索并多选来源。
- 设置可选的新对话标题；留空时根据源对话标题自动生成。
- 选择按时间顺序或按来源分组。
- 决定是否去除 fork 产生的共享历史。
- 可启用 **使用 Agent 智能规划**，让临时 DSH Agent 判断融合价值并自动剪枝、分组和排布；Agent 不建议融合时不会创建新会话。
- 创建后新对话会进入当前来源所在分组，可直接打开；若列表仍在同步，按钮会在新对话出现后自动可用。

弹窗通过 DSH 的命令通道执行并保留命令记录。手动模式不会发起额外模型调用；启用智能规划后，只有已经过工作区授权、文本投影和字节限制的候选快照会发送给临时规划 Agent。也可以在输入框中手动使用：

```text
/fuse <另一个会话ID> [更多会话ID...]
```

例如，当前会话为 `session-research`，希望再融合实现与评审会话：

```text
/fuse session-implementation session-review
```

`/fuse` 会自动把当前会话作为第一个来源，因此只需填写其他会话 id；也可用逗号分隔。默认按时间顺序融合并去除 fork 产生的共享历史。无参数时会显示用法；无效、跨工作区或不存在的会话会直接显示错误。

## 工具

### `conversation_fuse`

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `sourceSessionIds` | `string[]` | 是 | 至少两个唯一源会话 id；重复 id 保留第一次。 |
| `targetSessionId` | `string` | 否 | 新会话 id；省略时生成 `fusion-<uuid>`。 |
| `title` | `string` | 否 | 新会话标题；省略时优先采用 Agent 建议，否则根据源会话标题生成。 |
| `strategy` | `chronological \| by-source` | 否 | 默认 `chronological`。 |
| `deduplicate` | `boolean` | 否 | 是否按稳定的回合或消息身份去重，默认 `true`。 |
| `agentPlanning` | `boolean` | 否 | 是否使用临时 DSH Agent 判断、剪枝、分组和排布，默认 `false`。 |

示例：

```json
{
  "sourceSessionIds": ["session-research", "session-implementation", "session-review"],
  "targetSessionId": "session-fused-delivery",
  "title": "统一交付上下文",
  "strategy": "chronological",
  "deduplicate": true,
  "agentPlanning": true
}
```

成功结果包含新 `sessionId`、来源数量、保留和去重统计，以及 `durable`。使用完整回合模式时，`retainedTurns` 是保留的回合数。`durable: false` 表示当前组合没有持久化监听器；会话仍在当前进程中可用。

## 服务 API

插件提供 `ctx.conversationFusion`。Host 或其他插件可以调用：

```ts
await ctx.conversationFusion.fuse({
  sourceSessionIds,
  title: '统一上下文',
  strategy: 'chronological',
  agentPlanning: true,
}, {
  caller: agent,
  signal,
})
```

`caller` 是权限和默认值来源，不是隐式源会话。需要把当前会话也纳入融合时，必须显式把它的 id 放进 `sourceSessionIds`。

## 融合语义

1. 对每个唯一源 id 调用 `sessionQuery.readSession()`，从经过验证的完整日志原子折叠当前表层，因此压缩后被替换的旧节点不会重新进入新会话。
2. 与 Shuttle 同装时提取完整 AHP 回合。独立安装时从 `user/message` 和 `assistant/message` 提取文本。两条路径都保留源会话 ID、序号和时间。
3. 默认按历史身份去重，同时在 `sourceSessionIds` 中保留全部来源。
4. 按策略排序，再应用条目数量和 UTF-8 字节上限。时间戳倒退时仍沿用源会话的表层顺序。达到上限时优先保留合并顺序靠后的上下文。
5. 若启用智能规划，创建一个 `origin: subagent` 的临时 DSH Agent。它使用调用者的 provider/model、完整专用系统提示词和空工具白名单，只能返回 JSON 方案。插件验证 verdict、理由、策略、分组以及每个 `(sourceSessionId, sourceSeq)` 引用；`skip` 会停止创建，`fuse` 才应用剪枝和话题顺序。规划 Agent 随后被释放。
6. 折叠源日志中最新的 `session/title` 自动生成可读标题；再将所选历史写成目标会话自己的原生事件，并用闭合的 turn/step 包围；同时写入不含正文副本的可忽略融合清单，保存来源引用、规划和保留统计。不会直接拼接源日志，因为各源的 seq、执行边界、工具引用和表层替换引用都属于不同 Session。
7. 新会话发布后，若 Host 提供 Workspace 注册表，则优先继承调用者所在分组；调用者未直接列入分组时，继承同 cwd 源会话所在分组。融合内容仍是快照；源会话之后的新消息不会自动同步。

Shuttle 与 Fusion 安装在同一个 DSH 配置时，Fusion 对完整 AHP 回合排序和去重，保留文本、推理以及成对的工具调用和结果。Shuttle 将所选回合写成新的原生事件并重映射引用。来源索引保留原消息身份和时间。单独安装 Fusion 时可合并 DSH 原生文本历史。合并外部历史时，先通过 Shuttle 导入到当前 DSH 工作区，再在 Fusion 中选择生成的会话。Codex、Claude Code、Pi、Reasonix 和 OpenCode 的原生历史也可以走这条路径。

### 融合来自不同客户端的会话

1. 在同一个 DSH profile 启用 Shuttle 和 Fusion。
2. 用 Shuttle 将每个原生会话或 AHP 会话导入同一 DSH 工作区。用 AHP 导入时，`/shuttle` 默认选择当前工作区，CLI 可用 `--cwd` 指定工作区。[Shuttle 中文文档](https://github.com/omdsh-dev/dsh-shuttle/blob/main/README.zh.md)
3. 打开一个已导入的会话，在标题栏点击 **融合对话** 并选择其他来源。也可以运行 `/fuse shuttle-pi-example`，将示例 ID 替换为另一个导入结果的会话 ID。当前会话会自动纳入。
4. 新会话采用所选的合并顺序。完整回合模式会将工具调用和结果成对写入，并重映射引用。共享回合去重后，清单会记录其全部来源。

## 配置

| 字段 | 默认值 | 说明 |
|---|---:|---|
| `maxSources` | `8` | 单次最多唯一源会话数；硬上限 32。 |
| `maxMessages` | `500` | 限制保留的完整回合数（与 Shuttle 同装），或投影消息数（独立安装）。 |
| `maxFusedBytes` | `131072` | 规划快照和所选完整回合内容分别适用的 UTF-8 字节上限。 |
| `maxMessageBytes` | `16384` | 单条回合预览或独立模式消息的 UTF-8 字节上限。 |
| `maxTitleBytes` | `160` | 标题 UTF-8 字节上限。 |
| `allowCrossWorkspace` | `false` | 是否允许源 cwd 与调用者不同。 |
| `enableAgentPlanning` | `true` | 是否允许请求启动临时规划 Agent。 |
| `plannerMaxTokens` | `8192` | 临时规划 Agent 的最大输出 token，范围 256–8192；所选模型公开推理强度控制时，规划请求会关闭推理。 |

## 开发

本仓库可独立构建，开发与 Loader 测试使用已发布的 DSH `0.2.3-alpha.2` 包。

```sh
pnpm install
pnpm run verify:self-contained
pnpm run typecheck
pnpm test
pnpm run build
pnpm run prepare
pnpm pack --dry-run --json
```

## Model Experience

### 系统提示词

#### 模型看到什么

插件加载期间，模型看到一条稳定指导：只有用户要把两个或更多现有会话合为一个新会话时才使用 `conversation_fuse`，并要求显式提供全部源 session id。

#### Token 影响

每次请求增加一小段固定提示词和工具 schema；未调用工具时没有融合结果 token。

#### KV Cache 影响

插件配置和工具定义不变时前缀稳定；插件加载、卸载或 schema 变更可能使前缀从该处失效。

### 原生融合表层与日志

#### 模型看到什么

新会话先包含一条简短的不可信历史边界，随后每条保留消息都是独立的原生 user/assistant 表层事件。底层日志同时具有目标会话自己的合法 turn/step 结构，以及记录来源引用、规划和保留统计的可忽略融合清单；正文不会在清单中重复保存。

#### Token 影响

融合历史只在新会话中产生。保留的完整回合受 `maxMessages` 和 `maxFusedBytes` 约束。后续请求会重发这些原生历史消息，直到其他插件替换或压缩它们。

#### KV Cache 影响

这些物化事件在新会话中形成稳定历史前缀，后续追加消息可复用；重新执行融合会创建另一个独立前缀，不修改已有源会话。

### 工具结果

#### 模型看到什么

工具成功后返回结构化创建与保留统计，并渲染一行包含新 session id、标题和保留比例的摘要。

#### Token 影响

仅成功或失败的工具调用增加结果 token；结果大小固定且不含完整融合正文。

#### KV Cache 影响

工具结果追加在当前会话末尾，不改变此前可复用的请求前缀。

### Agent 智能规划

#### 模型看到什么

仅在 `agentPlanning: true` 时，插件创建一个临时 DSH Agent。该 Agent 看到完整专用系统提示词，以及已经投影、去重、限长并标记为不可信数据的候选融合 JSON；它必须输出 verdict、理由、建议标题、策略和带消息引用的话题分组。源文本中的指令不会成为规划 Agent 的授权。

#### Token 影响

每次智能规划会产生一次独立模型请求，输入最大受 `maxMessages`、`maxMessageBytes` 和 `maxFusedBytes` 限制，输出受 `plannerMaxTokens` 限制。手动融合没有这次额外请求。

#### KV Cache 影响

规划请求属于临时 Agent，不复用发起会话的对话前缀；稳定的规划系统提示词可能在 provider 支持时复用，但候选 JSON 随来源变化。规划完成后，只有验证过的理由、话题、剪枝结果和保留内容会物化到新会话。

## Known Limitations and Deferred Work

- **快照而非持续同步** — 新会话只捕获工具调用时已提交的表层；源会话之后的更新不会传播。
- 单独安装时融合文本。与 Shuttle 同装时保留推理和成对的工具调用及结果。
- **单一工作目录** — 新会话继承调用者 cwd 及其对应的 Workspace 分组；即便显式允许跨工作区，也不会合并文件系统权限或加入外部 Workspace 分组。
- **Workspace 服务可选** — 极简独立组合若没有 `workspaceRegistry`，仍能创建合法新会话，但该组合中没有可继承的分组。
- **Agent preset 继承基于创建 header** — 若运行中的空白会话后来切换 preset，当前 out-of-tree 插件不会读取宿主私有的选择事件类型；融合会话使用 header 中的创建 preset。
- **创建后的持久化失败不是事务回滚** — agent/session 已发布后，`session/flush` 失败会让工具报错并保留该 live 会话，以免无提示删除已创建的数据。
- **Agent 规划依赖可用模型** — 智能规划继承调用者的 provider/model；模型不可用、输出被截断或 JSON/消息引用校验失败时，融合会报错且不会创建目标会话。可关闭智能规划回到确定性的手动流程。
