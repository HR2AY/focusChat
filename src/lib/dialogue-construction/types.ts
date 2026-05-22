import type { ObservationResult } from '../observation/types';

export type ExpectationMatch =
  | 'matched'
  | 'partially_matched'
  | 'not_matched'
  | 'none';

export type ResponseMode = 'default' | 'ask' | 'analyze';
export type TopicStimulusLevel = 'high' | 'medium' | 'low';
export type TopicRelation = 'continue' | 'user_shift';
export type TopicGuidanceAction = 'hold' | 'soft_descend' | 'settle';
export type OutputLanguage = 'zh' | 'en';

export type DialogueExpectationKind =
  | 'answer_current_question'
  | 'continue_current_topic'
  | 'share_more_detail'
  | 'accept_topic_shift'
  | 'short_ack'
  | 'no_reply_ok';

export type LastSystemAction =
  | 'follow'
  | 'ask'
  | 'reflect'
  | 'shift'
  | 'close'
  | 'silence';

export type DialogueUIStatus = 'thinking' | 'loading' | 'emitting' | 'paused';
export type SpeechSendMode = 'single' | 'split_sentences' | 'silent';
export type SpeechTone = 'light' | 'steady' | 'soft';
export type SpeechRendererMode = 'render' | 'silence';
export type SkillType = 'question' | 'analysis';
export type QuestionTargetDirection =
  | 'clarify_user_state'
  | 'reconnect_context'
  | 'check_conflict';
export type AnalysisDirection = 'fear_analysis' | 'excitement_analysis';

export interface DialogueExpectation {
  kind: DialogueExpectationKind;
  topicHint: string;
  note: string;
}

export interface DialogueRoundSummary {
  userSummary: string;
  assistantSummary: string;
  roundSummary: string;
  assistantAction: LastSystemAction | null;
}

export interface DialogueUIState {
  status: DialogueUIStatus | null;
}

export interface TopicArousalContext {
  currentTopicLabel: string;
  currentTopicCategory: string;
  currentStimulusLevel: TopicStimulusLevel;
  previousStimulusLevel: TopicStimulusLevel | null;
  topicRelation: TopicRelation;
  recommendedAction: TopicGuidanceAction;
  allowedShiftStimulusLevel: TopicStimulusLevel;
  transitionRule: string;
  rationale: string;
}

export interface DialogueConstructionInput {
  latestUserMessage: string;
  observationResult: ObservationResult;
  recentRoundSummaries: DialogueRoundSummary[];
  soul: string;
  userProfile: string;
  outputLanguage: OutputLanguage;
  expectation: DialogueExpectation | null;
  lastSystemAction: LastSystemAction | null;
  uiState: DialogueUIState | null;
  topicArousalContext: TopicArousalContext;
}

export interface DialoguePlan {
  expectationMatch: ExpectationMatch;
  currentTopic: string;
  topicStage: string;
  replyPlan: string;
  topicStep: string;
  responseMode: ResponseMode;
  shouldSearchMaterials: boolean;
  searchQuery: string;
  searchPurpose: string;
}

export interface DialoguePlannerMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export interface SpeechRendererInput {
  dialoguePlan: DialoguePlan;
  observationResult: ObservationResult;
  recentRoundSummaries: DialogueRoundSummary[];
  userProfile: string;
  userCognitiveActivity: string;
  soul: string;
  latestUserMessage: string;
  outputLanguage: OutputLanguage;
  topicArousalContext: TopicArousalContext;
}

export interface QuestionSkillOutputConstraints {
  maxQuestions: 1;
  avoidMultiQuestion: true;
  avoidOverExplanation: true;
  avoidAbstractTalk: true;
}

export interface QuestionSkillOutput {
  shouldRun: true;
  skillType: 'question';
  targetDirection: QuestionTargetDirection;
  questionIntent: string;
  outputConstraints: QuestionSkillOutputConstraints;
}

export interface AnalysisSkillOutputConstraints {
  maxPoints: 2;
  avoidOverExplanation: true;
  avoidAbstractTalk: true;
  avoidAbsoluteConclusion: true;
}

export interface AnalysisSkillOutput {
  shouldRun: true;
  skillType: 'analysis';
  targetDirection: AnalysisDirection;
  analysisIntent: string;
  outputConstraints: AnalysisSkillOutputConstraints;
}

export type DialogueIntermediateSkillOutput =
  | QuestionSkillOutput
  | AnalysisSkillOutput
  | null;

export interface SpeechShape {
  maxSentences: number;
  shouldSplit: boolean;
  allowEmoji: boolean;
  allowQuestion: boolean;
  allowClosing: boolean;
  maxCharsPerChunk: number;
  sendMode: SpeechSendMode;
  tone: SpeechTone;
}

export interface SpeechRendererOutput {
  text: string;
  chunks: string[];
  sendMode: SpeechSendMode;
  tone: SpeechTone;
  rendererMode: SpeechRendererMode;
}
