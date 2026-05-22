/**
 * Observation Agent — Scorer
 *
 * 将 RawObservation 映射为 UserState 更新。
 * 规则简单、确定性，不调用 LLM。
 */

import type { RawObservation, UserState, VerbosityLevel } from './types';

// ────────────────────────────────────────────
// Verbosity 升降级
// ────────────────────────────────────────────

const VERBOSITY_ORDER: VerbosityLevel[] = ['verbose', 'normal', 'concise', 'silent'];

function verbosityDown(current: VerbosityLevel): VerbosityLevel {
  const idx = VERBOSITY_ORDER.indexOf(current);
  return idx < VERBOSITY_ORDER.length - 1
    ? VERBOSITY_ORDER[idx + 1]
    : VERBOSITY_ORDER[VERBOSITY_ORDER.length - 1];
}

function verbosityUp(current: VerbosityLevel): VerbosityLevel {
  const idx = VERBOSITY_ORDER.indexOf(current);
  return idx > 0 ? VERBOSITY_ORDER[idx - 1] : VERBOSITY_ORDER[0];
}

// ────────────────────────────────────────────
// 主函数
// ────────────────────────────────────────────

export function deriveState(
  observation: RawObservation,
  currentState: UserState
): UserState {
  // 1. arousalLevel ← cognitiveActivity（直接映射）
  const arousalLevel = observation.cognitiveActivity;

  // 2. willingnessToExpress ← willingToExpress（直接映射）
  const willingnessToExpress = observation.willingToExpress;

  // 3. aiVerbosity ← aiTooVerbose（升降级）
  let aiVerbosity = currentState.aiVerbosity;
  if (observation.aiTooVerbose) {
    aiVerbosity = verbosityDown(aiVerbosity);
  } else {
    aiVerbosity = verbosityUp(aiVerbosity);
  }

  // 4. isInterrupting → 不直接修改 state，留给调用方决策
  //    （未来可用于打断逻辑）

  return {
    arousalLevel,
    willingnessToExpress,
    aiVerbosity,
    turnCount: currentState.turnCount + 1,
    lastUpdated: new Date().toISOString(),
  };
}
