import type {
  DialoguePlan,
  DialogueExpectation,
  LastSystemAction,
  DialogueRoundSummary,
  OutputLanguage,
  SpeechRendererOutput,
  TopicArousalContext,
} from '@/lib/dialogue-construction/types';

// 唤醒状态枚举（Phase 3 用）
export enum ArousalState {
  HIGH_AROUSAL = 'HIGH_AROUSAL',
  MID_AROUSAL = 'MID_AROUSAL',
  LOW_AROUSAL = 'LOW_AROUSAL',
  PRE_SLEEP = 'PRE_SLEEP',
}

// 话题类型
export enum TopicType {
  DAILY_LIFE = 'DAILY_LIFE',           // 生活化话题
  LIGHT_PHILOSOPHY = 'LIGHT_PHILOSOPHY', // 轻微哲思
  PRACTICAL_RELIEF = 'PRACTICAL_RELIEF', // 实用缓解
  LOW_ABSTRACT = 'LOW_ABSTRACT',        // 低抽象、低刺激
}

// 消息角色
export type MessageRole = 'user' | 'assistant' | 'system';

// 聊天消息
export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  emoji?: string;
}

// 话题定义
export interface Topic {
  id: string;
  name: string;            // 话题名称（概览，十个字以内）
  keyword: string;         // 关键词（用于检索）
  tags: string[];          // 标签（意图）
  fullContent?: string;    // 完整内容（概览+意图+原文）
}

// 话题加载结果
export interface TopicLoadResult {
  content: string;
  topicName: string;
  source: 'pool' | 'llm';
}

// SSE 事件类型
export type SSEEventType = 'message' | 'planner' | 'status' | 'done' | 'error';

// SSE 状态
export type SSEStatus = 'thinking' | 'loading' | 'emitting' | 'paused';

// SSE 事件
export interface SSEEvent {
  type: SSEEventType;
  content?: string;
  emoji?: string;
  messageId?: string;
  status?: SSEStatus;
  message?: string;
  plan?: DialoguePlan;
  speech?: SpeechRendererOutput;
  innerMonologue?: string;
  topicArousalContext?: TopicArousalContext;
}

// 流式消息块（旧版兼容）
export interface StreamChunk {
  type: 'content' | 'done' | 'error';
  content?: string;
  error?: string;
}

// 复杂度参数（Phase 3 用）
export interface ComplexityParams {
  maxSentenceLength: number;
  abstractionLevel: number;
  reasoningChainLength: number;
  emojiFrequency: number;
}

// 记忆摘要对象（Phase 3 用）
export interface MemorySummary {
  currentArousal: ArousalState;
  recentEffectiveTopics: TopicType[];
  recentIneffectiveTopics: TopicType[];
  userMainEmotion: string;
  turnCount: number;
}

// API 请求体
export interface ChatV2Request {
  messages: ChatMessage[];
  action?: 'send' | 'pause' | 'resume';
  language?: OutputLanguage;
}

// API 请求体（旧版）
export interface ChatRequest {
  messages: ChatMessage[];
}

// API 响应体（非流式）
export interface ChatResponse {
  content: string;
  error?: string;
}

export type VoiceState = 'idle' | 'recording' | 'transcribing' | 'error';

export type {
  DialogueExpectation,
  DialoguePlan,
  DialogueRoundSummary,
  LastSystemAction,
  OutputLanguage,
  SpeechRendererOutput,
  TopicArousalContext,
};
