import type { RawObservation } from './observation/types';
import type {
  DialogueRoundSummary,
  TopicArousalContext,
  TopicGuidanceAction,
  TopicRelation,
  TopicStimulusLevel,
} from './dialogue-construction/types';

interface TopicArousalState {
  topicLabel: string;
  topicCategory: string;
  stimulusLevel: TopicStimulusLevel;
}

interface TopicArousalLoaderInput {
  latestUserMessage: string;
  observation: RawObservation;
  recentRoundSummaries: DialogueRoundSummary[];
  previousTopicState: TopicArousalState | null;
}

const HIGH_STIMULUS_PATTERNS: Array<{ category: string; label: string; keywords: string[] }> = [
  {
    category: 'identity_career_conflict',
    label: '职业/身份冲突',
    keywords: ['专业', '转行', '职业', '金融', '创业', 'pm', '产品', 'ai', '黑客松', '方向', '路径'],
  },
  {
    category: 'existential_reflection',
    label: '意义与现实撕裂',
    keywords: ['意义', '现实', '撕裂', '矛盾', '冲突', '为什么', '价值', '自我', '未来'],
  },
  {
    category: 'creative_ideation',
    label: '想法与方案推演',
    keywords: ['想法', '灵感', '方案', '策略', '验证', '模型', '产品化', '路线'],
  },
];

const MEDIUM_STIMULUS_PATTERNS: Array<{ category: string; label: string; keywords: string[] }> = [
  {
    category: 'project_progress',
    label: '项目进展',
    keywords: ['项目', '进度', '任务', '开会', 'demo', '反馈', '复盘', '计划'],
  },
  {
    category: 'social_event',
    label: '最近经历',
    keywords: ['今天', '刚刚', '朋友', '同学', '老师', '活动', '比赛', '工作'],
  },
];

const LOW_STIMULUS_PATTERNS: Array<{ category: string; label: string; keywords: string[] }> = [
  {
    category: 'body_rest',
    label: '身体与休息',
    keywords: ['睡', '困', '累', '头疼', '呼吸', '喝水', '洗澡', '躺', '床'],
  },
  {
    category: 'sensory_grounding',
    label: '感官与环境',
    keywords: ['天气', '风', '雨', '灯', '窗', '声音', '音乐', '毯子', '房间'],
  },
];

const HIGH_STIMULUS_MARKERS = [
  '但是',
  '但',
  '然而',
  '却',
  '不过',
  '南辕北辙',
  '怎么办',
  '该不该',
  '值不值',
  '一边',
  '另一边',
];

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function matchPattern(
  text: string,
  patterns: Array<{ category: string; label: string; keywords: string[] }>
): { category: string; label: string; matches: number } | null {
  let bestMatch: { category: string; label: string; matches: number } | null = null;

  for (const pattern of patterns) {
    const matches = pattern.keywords.filter((keyword) => text.includes(keyword)).length;
    if (!matches) {
      continue;
    }

    if (!bestMatch || matches > bestMatch.matches) {
      bestMatch = {
        category: pattern.category,
        label: pattern.label,
        matches,
      };
    }
  }

  return bestMatch;
}

function inferTopicDescriptor(message: string): {
  label: string;
  category: string;
  stimulusLevel: TopicStimulusLevel;
} {
  const normalized = normalizeText(message);
  const highMatch = matchPattern(normalized, HIGH_STIMULUS_PATTERNS);
  const mediumMatch = matchPattern(normalized, MEDIUM_STIMULUS_PATTERNS);
  const lowMatch = matchPattern(normalized, LOW_STIMULUS_PATTERNS);

  let score = 1;

  if (highMatch) {
    score += 2 + Math.min(highMatch.matches, 2);
  }

  if (mediumMatch) {
    score += 1;
  }

  if (lowMatch) {
    score -= 1;
  }

  if (normalized.length >= 24) {
    score += 1;
  }

  if (HIGH_STIMULUS_MARKERS.some((marker) => normalized.includes(marker))) {
    score += 2;
  }

  const hasQuestion = /[?？]/.test(normalized);
  if (hasQuestion) {
    score += 1;
  }

  let stimulusLevel: TopicStimulusLevel = 'medium';
  if (score >= 5) {
    stimulusLevel = 'high';
  } else if (score <= 1) {
    stimulusLevel = 'low';
  }

  if (lowMatch && !highMatch && score <= 2) {
    stimulusLevel = 'low';
  }

  const primaryMatch = highMatch ?? mediumMatch ?? lowMatch;

  if (primaryMatch) {
    return {
      label: primaryMatch.label,
      category: primaryMatch.category,
      stimulusLevel,
    };
  }

  return {
    label: normalized.slice(0, 16) || '当前话题',
    category: 'uncategorized',
    stimulusLevel,
  };
}

function inferTopicRelation(
  current: { category: string; label: string },
  previous: TopicArousalState | null,
  recentRoundSummaries: DialogueRoundSummary[]
): TopicRelation {
  if (!previous) {
    return 'continue';
  }

  if (
    current.category === previous.topicCategory ||
    current.label === previous.topicLabel
  ) {
    return 'continue';
  }

  const lastRound = recentRoundSummaries[recentRoundSummaries.length - 1];
  if (
    lastRound &&
    (lastRound.userSummary.includes(current.label) ||
      lastRound.roundSummary.includes(current.label))
  ) {
    return 'continue';
  }

  return 'user_shift';
}

function lowerStimulusLevel(level: TopicStimulusLevel): TopicStimulusLevel {
  if (level === 'high') {
    return 'medium';
  }

  return 'low';
}

function inferRecommendedAction(
  stimulusLevel: TopicStimulusLevel,
  observation: RawObservation
): TopicGuidanceAction {
  if (stimulusLevel === 'high') {
    return observation.willingToExpress === 'low' ? 'soft_descend' : 'hold';
  }

  if (stimulusLevel === 'medium') {
    return observation.willingToExpress === 'reluctant' ? 'settle' : 'soft_descend';
  }

  return 'settle';
}

function buildRationale(
  descriptor: { label: string; stimulusLevel: TopicStimulusLevel },
  relation: TopicRelation,
  observation: RawObservation
): string {
  const relationText =
    relation === 'continue' ? '用户仍在延续当前主线' : '用户主动切到了新的主线';

  return `${relationText}；当前话题“${descriptor.label}”的认知刺激为 ${descriptor.stimulusLevel}，表达意愿 ${observation.willingToExpress}。`;
}

export function loadTopicArousalContext(
  input: TopicArousalLoaderInput
): TopicArousalContext {
  const descriptor = inferTopicDescriptor(input.latestUserMessage);
  const relation = inferTopicRelation(
    descriptor,
    input.previousTopicState,
    input.recentRoundSummaries
  );
  const recommendedAction = inferRecommendedAction(
    descriptor.stimulusLevel,
    input.observation
  );
  const previousStimulusLevel = input.previousTopicState?.stimulusLevel ?? null;
  const allowedShiftStimulusLevel = lowerStimulusLevel(descriptor.stimulusLevel);
  const transitionRule =
    descriptor.stimulusLevel === 'low'
      ? '如果系统要转移或新建话题，只能继续保持低刺激，不要重新抬高认知负荷。'
      : `如果系统要转移或新建话题，下一个话题刺激级别必须低于当前的 ${descriptor.stimulusLevel}，最多到 ${allowedShiftStimulusLevel}。`;

  return {
    currentTopicLabel: descriptor.label,
    currentTopicCategory: descriptor.category,
    currentStimulusLevel: descriptor.stimulusLevel,
    previousStimulusLevel,
    topicRelation: relation,
    recommendedAction,
    allowedShiftStimulusLevel,
    transitionRule,
    rationale: buildRationale(descriptor, relation, input.observation),
  };
}

export type { TopicArousalLoaderInput, TopicArousalState };
