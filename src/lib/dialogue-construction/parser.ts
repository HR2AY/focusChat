import { logError, logInfo } from '../logger';
import type {
  DialoguePlan,
  ExpectationMatch,
  ResponseMode,
} from './types';

const VALID_EXPECTATION_MATCHES: ExpectationMatch[] = [
  'matched',
  'partially_matched',
  'not_matched',
  'none',
];

const VALID_RESPONSE_MODES: ResponseMode[] = [
  'default',
  'ask',
  'analyze',
];

export const FALLBACK_DIALOGUE_PLAN: DialoguePlan = {
  expectationMatch: 'none',
  currentTopic: '当前话题未明确',
  topicStage: '延续中',
  replyPlan: '保持低刺激跟随，控制输出更短，不主动扩展新信息。',
  topicStep: '先延续当前话题，必要时轻微复述，不新开大话题。',
  responseMode: 'default',
  shouldSearchMaterials: false,
  searchQuery: '',
  searchPurpose: '',
};

function isValidExpectationMatch(v: unknown): v is ExpectationMatch {
  return (
    typeof v === 'string' &&
    VALID_EXPECTATION_MATCHES.includes(v as ExpectationMatch)
  );
}

function isValidResponseMode(v: unknown): v is ResponseMode {
  return typeof v === 'string' && VALID_RESPONSE_MODES.includes(v as ResponseMode);
}

function isValidBoolean(v: unknown): v is boolean {
  return typeof v === 'boolean';
}

function normalizeString(value: unknown, fallback: string, maxLength = 200): string {
  if (typeof value !== 'string') {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : fallback;
}

export function parseDialoguePlan(raw: string): DialoguePlan {
  logInfo('dialogue-construction-parser', `Raw LLM output: ${raw.substring(0, 400)}`);

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    logError('dialogue-construction-parser', new Error('No JSON found in response'));
    return FALLBACK_DIALOGUE_PLAN;
  }

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
  } catch (error) {
    logError('dialogue-construction-parser', error as Error);
    return FALLBACK_DIALOGUE_PLAN;
  }

  const shouldSearchMaterials = isValidBoolean(data.shouldSearchMaterials)
    ? data.shouldSearchMaterials
    : FALLBACK_DIALOGUE_PLAN.shouldSearchMaterials;

  const parsed: DialoguePlan = {
    expectationMatch: isValidExpectationMatch(data.expectationMatch)
      ? data.expectationMatch
      : FALLBACK_DIALOGUE_PLAN.expectationMatch,
    currentTopic: normalizeString(
      data.currentTopic,
      FALLBACK_DIALOGUE_PLAN.currentTopic,
      80
    ),
    topicStage: normalizeString(data.topicStage, FALLBACK_DIALOGUE_PLAN.topicStage, 40),
    replyPlan: normalizeString(data.replyPlan, FALLBACK_DIALOGUE_PLAN.replyPlan, 240),
    topicStep: normalizeString(data.topicStep, FALLBACK_DIALOGUE_PLAN.topicStep, 240),
    responseMode: isValidResponseMode(data.responseMode)
      ? data.responseMode
      : FALLBACK_DIALOGUE_PLAN.responseMode,
    shouldSearchMaterials,
    searchQuery: shouldSearchMaterials
      ? normalizeString(data.searchQuery, '', 120)
      : '',
    searchPurpose: shouldSearchMaterials
      ? normalizeString(data.searchPurpose, '', 120)
      : '',
  };

  if (parsed.shouldSearchMaterials && (!parsed.searchQuery || !parsed.searchPurpose)) {
    parsed.shouldSearchMaterials = false;
    parsed.searchQuery = '';
    parsed.searchPurpose = '';
  }

  logInfo(
    'dialogue-construction-parser',
    `Parsed: expectation=${parsed.expectationMatch}, mode=${parsed.responseMode}, search=${parsed.shouldSearchMaterials}`
  );

  return parsed;
}
