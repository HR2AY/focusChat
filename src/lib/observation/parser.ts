/**
 * Observation Agent — Parser
 *
 * 从 LLM 输出中提取 JSON，校验字段，提供默认值。
 * 解析失败不抛异常，返回全默认值（observation 不应阻塞主流程）。
 */

import type { RawObservation, ArousalLevel, WillingnessLevel } from './types';
import { logInfo, logError } from '@/lib/logger';

// ────────────────────────────────────────────
// 合法值集合
// ────────────────────────────────────────────

const VALID_AROUSAL: ArousalLevel[] = ['high', 'medium', 'low', 'sleepy'];
const VALID_WILLINGNESS: WillingnessLevel[] = ['high', 'medium', 'low', 'reluctant'];

// ────────────────────────────────────────────
// 默认值（全安全）
// ────────────────────────────────────────────

const DEFAULT_OBSERVATION: RawObservation = {
  cognitiveActivity: 'medium',
  isInterrupting: false,
  willingToExpress: 'medium',
  aiTooVerbose: false,
  reasoning: '解析失败，使用默认值',
};

// ────────────────────────────────────────────
// 字段校验辅助
// ────────────────────────────────────────────

function isValidArousal(v: unknown): v is ArousalLevel {
  return typeof v === 'string' && VALID_AROUSAL.includes(v as ArousalLevel);
}

function isValidWillingness(v: unknown): v is WillingnessLevel {
  return typeof v === 'string' && VALID_WILLINGNESS.includes(v as WillingnessLevel);
}

function isValidBoolean(v: unknown): v is boolean {
  return typeof v === 'boolean';
}

function isValidString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
}

// ────────────────────────────────────────────
// 主函数
// ────────────────────────────────────────────

export function parseObservation(raw: string): RawObservation {
  logInfo('observation-parser', `Raw LLM output: ${raw.substring(0, 300)}`);

  // 1. 提取 JSON
  const jsonMatch = raw.match(/\{[\s\S]*?\}/);
  if (!jsonMatch) {
    logError('observation-parser', new Error('No JSON found in response'));
    return DEFAULT_OBSERVATION;
  }

  // 2. 解析
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(jsonMatch[0]);
  } catch (e) {
    logError('observation-parser', e as Error);
    return DEFAULT_OBSERVATION;
  }

  // 3. 逐字段校验 + 取默认值
  const result: RawObservation = {
    cognitiveActivity: isValidArousal(data.cognitiveActivity)
      ? data.cognitiveActivity
      : DEFAULT_OBSERVATION.cognitiveActivity,

    isInterrupting: isValidBoolean(data.isInterrupting)
      ? data.isInterrupting
      : DEFAULT_OBSERVATION.isInterrupting,

    willingToExpress: isValidWillingness(data.willingToExpress)
      ? data.willingToExpress
      : DEFAULT_OBSERVATION.willingToExpress,

    aiTooVerbose: isValidBoolean(data.aiTooVerbose)
      ? data.aiTooVerbose
      : DEFAULT_OBSERVATION.aiTooVerbose,

    reasoning: isValidString(data.reasoning)
      ? String(data.reasoning).substring(0, 30)
      : DEFAULT_OBSERVATION.reasoning,
  };

  logInfo('observation-parser', `Parsed: activity=${result.cognitiveActivity}, interrupt=${result.isInterrupting}, express=${result.willingToExpress}, verbose=${result.aiTooVerbose}`);

  return result;
}
