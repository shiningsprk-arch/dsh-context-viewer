/** 事件类型中文标签（main/renderer 共用）。 */
export const EVENT_TYPE_LABELS: Record<string, string> = {
  'turn/start': '轮次开始',
  'turn/end': '轮次结束',
  'step/start': '步骤开始',
  'step/end': '步骤结束',
  'user/message': '用户消息',
  'assistant/chunk': '流式增量',
  'assistant/message': '助手消息',
  'tool/call': '工具调用',
  'tool/result': '工具结果',
  'todo/write': '任务列表',
  'request/header': '请求头',
  'request/context': '请求上下文',
  'session/end-seed': '种子结束',
  'tool/code-dispatch-start': '代码派发开始',
  'tool/code-dispatch': '代码派发',
  'assistant/attempt': '助手尝试',
  'agent/inbox/spliced': '收件箱注入',
  'system/message': '系统消息',
  'model/selection': '模型选择',
  'session/title': '会话标题',
  'session/title-llm-request': '标题生成请求',
  'permission/preset': '权限预设',
  'sandbox/mode': '沙箱模式',
  'approval/policy': '审批策略',
  'session/goal': '会话目标',
}

export function formatEventType(type: string): string {
  return EVENT_TYPE_LABELS[type] ?? type
}
