/** Locale dictionaries for the conversation-fusion browser UI. */

export const NS = 'conversation-fusion'

/** Simplified-Chinese strings. */
export const zh = {
  'action.label': '融合对话',
  'dialog.title': '融合对话',
  'dialog.description': '选择要与当前对话合并的其他对话。源对话不会被修改。',
  'dialog.current': '当前对话',
  'dialog.search': '搜索对话标题或 ID',
  'dialog.noResults': '当前工作区没有可融合的其他对话。',
  'dialog.titleLabel': '新对话标题（留空自动生成）',
  'dialog.titlePlaceholder': '留空则根据源对话标题自动生成',
  'dialog.strategyLabel': '排列方式',
  'dialog.chronological': '按时间顺序',
  'dialog.bySource': '按来源分组',
  'dialog.deduplicate': '去除分支对话中重复的共享历史',
  'dialog.agentPlanning': '使用 Agent 智能规划',
  'dialog.agentPlanningHelp': '由临时 DSH Agent 判断是否值得融合，并自动剪枝、按话题分组和调整顺序。',
  'dialog.cancel': '取消',
  'dialog.submit': '创建融合对话',
  'dialog.submitting': '正在融合…',
  'dialog.agentSubmitting': 'Agent 正在评估并融合…',
  'dialog.selected': '已选择 {count} 个其他对话',
  'dialog.successTitle': '融合对话已创建',
  'dialog.successDescription': '新对话已自动加入原分组并保存，可以立即打开。',
  'dialog.open': '打开新对话',
  'dialog.close': '关闭',
  'dialog.notReady': '新对话正在同步到列表…',
  'dialog.commandMissing': '当前会话没有可用的 /fuse 操作。',
} as const

/** English strings. */
export const en: Record<keyof typeof zh, string> = {
  'action.label': 'Fuse conversations',
  'dialog.title': 'Fuse conversations',
  'dialog.description': 'Choose other conversations to combine with this one. Source conversations are not changed.',
  'dialog.current': 'Current conversation',
  'dialog.search': 'Search conversation title or ID',
  'dialog.noResults': 'There are no other conversations in this workspace to fuse.',
  'dialog.titleLabel': 'New conversation title (auto-generated if blank)',
  'dialog.titlePlaceholder': 'Leave blank to use the source conversation titles',
  'dialog.strategyLabel': 'Ordering',
  'dialog.chronological': 'Chronological',
  'dialog.bySource': 'Group by source',
  'dialog.deduplicate': 'Remove shared history duplicated across forks',
  'dialog.agentPlanning': 'Use intelligent Agent planning',
  'dialog.agentPlanningHelp': 'A temporary DSH Agent judges fusion value, prunes noise, groups topics, and adjusts the order.',
  'dialog.cancel': 'Cancel',
  'dialog.submit': 'Create fused conversation',
  'dialog.submitting': 'Fusing…',
  'dialog.agentSubmitting': 'Agent is evaluating and fusing…',
  'dialog.selected': '{count} other conversations selected',
  'dialog.successTitle': 'Fused conversation created',
  'dialog.successDescription': 'The new conversation is saved in the source group and ready to open.',
  'dialog.open': 'Open new conversation',
  'dialog.close': 'Close',
  'dialog.notReady': 'The new conversation is syncing to the list…',
  'dialog.commandMissing': 'The /fuse operation is unavailable for this session.',
}

/** Keys consumed by the browser contribution. */
export type FusionLocaleKey = keyof typeof zh
