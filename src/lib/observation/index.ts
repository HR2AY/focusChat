/**
 * Observation Agent — 入口
 *
 * 编排流程：读取状态 → 构建 prompt → 调用 LLM → 解析 → 评分 → 持久化
 *
 * 用法：
 *   import { observe, prepareInput } from '@/lib/observation';
 *   const input = prepareInput(messages, 'soul content', 'user profile');
 *   const result = await observe(input);
 */

import OpenAI from 'openai';
import type { ObservationInput, ObservationResult, ChatMessage } from './types';
import { buildObservationPrompt, OBSERVATION_SYSTEM_PROMPT } from './prompt';
import { parseObservation } from './parser';
import { deriveState } from './scorer';
import { readUserState, writeUserState } from './updateState';
import { logInfo, logError } from '@/lib/logger';

type DeepSeekChatRequest = OpenAI.Chat.Completions.ChatCompletionCreateParams & {
  thinking?: { type: 'disabled' };
};

// ────────────────────────────────────────────
// OpenAI 客户端（沿用 v2/route.ts 模式）
// ────────────────────────────────────────────

function getOpenAIClient(): OpenAI {
  return new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: 'https://api.deepseek.com',
  });
}

// ────────────────────────────────────────────
// 辅助：从消息历史中提取输入
// ────────────────────────────────────────────

/**
 * 从完整消息历史中构建 ObservationInput。
 *
 * @param messages   完整消息列表（最后一条必须是 user）
 * @param soul       soul.md 内容
 * @param userProfile user-profile.md 内容
 */
export function prepareInput(
  messages: ChatMessage[],
  soul: string,
  userProfile: string
): ObservationInput {
  // 最新用户消息
  const latestUserMessage = messages[messages.length - 1];

  // AI 上一条输出：在 latestUserMessage 之前最近的 assistant 消息
  let aiLastOutput = '';
  for (let i = messages.length - 2; i >= 0; i--) {
    if (messages[i].role === 'assistant') {
      aiLastOutput = messages[i].content;
      break;
    }
  }

  // 最近 6 轮（最多 12 条消息），不包括最新的用户消息
  const historyMessages = messages.slice(0, -1);
  const recentRounds = historyMessages.slice(-12);

  // 读取当前状态
  const currentState = readUserState();

  return {
    soul,
    latestUserMessage: latestUserMessage.content,
    recentRounds,
    aiLastOutput,
    currentState,
    userProfile,
  };
}

// ────────────────────────────────────────────
// 主函数
// ────────────────────────────────────────────

export async function observe(input: ObservationInput): Promise<ObservationResult> {
  logInfo('observation', `Observing: "${input.latestUserMessage.substring(0, 50)}..."`);

  if (!process.env.DEEPSEEK_API_KEY) {
    logError('observation', new Error('DEEPSEEK_API_KEY is not configured'));
    return {
      observation: {
        cognitiveActivity: 'medium',
        isInterrupting: false,
        willingToExpress: 'medium',
        aiTooVerbose: false,
        reasoning: '缺少 API Key',
      },
      updatedState: input.currentState,
    };
  }

  try {
    // 1. 构建 prompt
    const userPrompt = buildObservationPrompt(input);

    // 2. 调用 LLM（低温度、短输出）
    const requestBody: DeepSeekChatRequest = {
      model: process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash',
      messages: [
        { role: 'system', content: OBSERVATION_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2,
      max_tokens: 200,
      thinking: { type: 'disabled' },
    };

    const response = await getOpenAIClient().chat.completions.create(requestBody);

    const raw = response.choices[0]?.message?.content || '';
    if (!raw) {
      logError('observation', new Error('LLM returned empty response'));
      // 返回默认 observation + 不变的状态
      return {
        observation: {
          cognitiveActivity: 'medium',
          isInterrupting: false,
          willingToExpress: 'medium',
          aiTooVerbose: false,
          reasoning: 'LLM返回空',
        },
        updatedState: input.currentState,
      };
    }

    // 3. 解析
    const parsed = parseObservation(raw);

    // 4. 评分 → 状态更新
    const updatedState = deriveState(parsed, input.currentState);

    // 5. 持久化
    writeUserState(updatedState);

    // 6. 返回
    logInfo('observation', `Result: activity=${parsed.cognitiveActivity}, interrupt=${parsed.isInterrupting}, express=${parsed.willingToExpress}, verbose=${parsed.aiTooVerbose}`);

    return {
      observation: parsed,
      updatedState,
    };
  } catch (error) {
    logError('observation', error as Error);

    // 出错时不阻塞主流程，返回默认值
    return {
      observation: {
        cognitiveActivity: 'medium',
        isInterrupting: false,
        willingToExpress: 'medium',
        aiTooVerbose: false,
        reasoning: '调用失败',
      },
      updatedState: input.currentState,
    };
  }
}
