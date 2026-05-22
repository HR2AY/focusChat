/**
 * Observation Agent — Prompt 构建
 *
 * 设计原则：极短、强结构化、禁止文艺化、禁止共情
 */

import type { ObservationInput, UserState } from './types';

// ────────────────────────────────────────────
// System Prompt（~30 tokens）
// ────────────────────────────────────────────

export const OBSERVATION_SYSTEM_PROMPT =
  '你是状态分析器。只输出JSON。禁止输出安慰、建议、聊天内容、长分析。';

// ────────────────────────────────────────────
// 格式化当前状态
// ────────────────────────────────────────────

function formatState(state: UserState): string {
  return `arousal=${state.arousalLevel} | express=${state.willingnessToExpress} | verbosity=${state.aiVerbosity} | turns=${state.turnCount}`;
}

// ────────────────────────────────────────────
// 格式化对话历史
// ────────────────────────────────────────────

function formatHistory(messages: ObservationInput['recentRounds']): string {
  if (messages.length === 0) return '(无历史)';
  return messages
    .map((m) => `${m.role === 'user' ? 'U' : 'A'}: ${m.content}`)
    .join('\n');
}

// ────────────────────────────────────────────
// 构建 User Prompt
// ────────────────────────────────────────────

export function buildObservationPrompt(input: ObservationInput): string {
  const soul = input.soul.trim() || '(空)';
  const profile = input.userProfile.substring(0, 200);
  const state = formatState(input.currentState);
  const history = formatHistory(input.recentRounds);
  const aiOutput = input.aiLastOutput.substring(0, 100) || '(无)';
  const userMsg = input.latestUserMessage;

  return `## Soul
${soul}

## 用户画像
${profile}

## 当前状态
${state}

## 最近对话（最多6轮）
${history}

## AI上一条输出
${aiOutput}

## 用户最新消息
${userMsg}

---

分析以下4项，输出JSON：

1. cognitiveActivity: 用户当前认知活跃度（high/medium/low/sleepy）
2. isInterrupting: 用户是否在打断AI输出（true/false）
3. willingToExpress: 用户是否愿意继续表达（high/medium/low/reluctant）
4. aiTooVerbose: AI当前是否说太多（true/false）
5. reasoning: 一句话判断依据（≤30字）

输出格式：
\`\`\`json
{
  "cognitiveActivity": "high",
  "isInterrupting": false,
  "willingToExpress": "medium",
  "aiTooVerbose": false,
  "reasoning": "用户主动发起新话题，表达欲强"
}
\`\`\`

只输出JSON。`;
}
