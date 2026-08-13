export { EVENT_TYPE_LABELS, formatEventType } from '../../shared/labels'

export const TOOL_COLORS: Record<string, string> = {
  pwsh: '#4ec9b0',
  bash: '#4ec9b0',
  cmd: '#4ec9b0',
  run_code: '#c586c0',
  write: '#569cd6',
  edit: '#569cd6',
  read: '#6aa94f',
  glob: '#6aa94f',
  grep: '#6aa94f',
  web_search: '#dcdcaa',
  subagent: '#ce9178',
  subagent_fork: '#ce9178',
  todo_write: '#d7ba7d',
  workflow: '#9cdcfe',
  ralph: '#f48771',
  skill: '#b5cea8',
  ask_user_question: '#ffd700',
  create_goal: '#ffa07a',
  update_goal: '#ffa07a',
  get_goal: '#ffa07a',
  job_kill: '#f48771',
  job_output: '#f48771',
  job_list: '#f48771',
  interrupt_agent: '#f48771',
  list_agents: '#f48771',
  send_message: '#f48771',
  pwsh_foreground: '#4ec9b0',
}

export function toolColor(name: string): string {
  return TOOL_COLORS[name] ?? '#9cdcfe'
}
