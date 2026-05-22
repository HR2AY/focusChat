/**
 * Observation Agent — 类型定义
 *
 * 所有类型自包含，不污染全局 types/index.ts
 */

// ────────────────────────────────────────────
// 用户状态（读写 user-state.json）
// ────────────────────────────────────────────

export type ArousalLevel = 'high' | 'medium' | 'low' | 'sleepy';
export type WillingnessLevel = 'high' | 'medium' | 'low' | 'reluctant';
export type VerbosityLevel = 'verbose' | 'normal' | 'concise' | 'silent';

export interface UserState {
  arousalLevel: ArousalLevel;
  willingnessToExpress: WillingnessLevel;
  aiVerbosity: VerbosityLevel;
  turnCount: number;
  lastUpdated: string; // ISO timestamp
}

// ────────────────────────────────────────────
// Observation 输入
// ────────────────────────────────────────────

export interface ObservationInput {
  soul: string;                   // soul.md 内容
  latestUserMessage: string;      // 最新用户输入
  recentRounds: ChatMessage[];    // 最近 6 轮（最多 12 条消息）
  aiLastOutput: string;           // 用户发送时 AI 前一条输出
  currentState: UserState;        // 当前 user-state.json
  userProfile: string;            // user-profile.md 内容
}

// ────────────────────────────────────────────
// LLM 原始输出
// ────────────────────────────────────────────

export interface RawObservation {
  cognitiveActivity: ArousalLevel;
  isInterrupting: boolean;
  willingToExpress: WillingnessLevel;
  aiTooVerbose: boolean;
  reasoning: string;              // 一句话，≤30字
}

// ────────────────────────────────────────────
// 最终输出
// ────────────────────────────────────────────

export interface ObservationResult {
  observation: RawObservation;
  updatedState: UserState;
}

// ────────────────────────────────────────────
// 内部引用（避免依赖全局类型）
// ────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}
