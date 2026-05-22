import type {
  DialogueExpectation,
  DialoguePlan,
  LastSystemAction,
  SpeechRendererOutput,
} from './types';

function normalizeText(text: string, maxLength = 80): string {
  const trimmed = text.replace(/\s+/g, ' ').trim();
  return trimmed.length > maxLength
    ? `${trimmed.substring(0, maxLength - 1)}…`
    : trimmed;
}

export function deriveLastSystemAction(
  plan: DialoguePlan,
  speech: SpeechRendererOutput
): LastSystemAction {
  if (speech.rendererMode === 'silence' || speech.sendMode === 'silent') {
    return 'silence';
  }

  if (plan.responseMode === 'ask') {
    return 'ask';
  }

  if (plan.topicStep.includes('收束') || plan.topicStep.includes('结束')) {
    return 'close';
  }

  if (plan.topicStep.includes('转') || plan.topicStep.includes('换')) {
    return 'shift';
  }

  if (plan.responseMode === 'analyze' || plan.replyPlan.includes('复述')) {
    return 'reflect';
  }

  return 'follow';
}

export function deriveNextExpectation(
  plan: DialoguePlan,
  speech: SpeechRendererOutput
): DialogueExpectation | null {
  if (speech.rendererMode === 'silence' || speech.sendMode === 'silent') {
    return {
      kind: 'no_reply_ok',
      topicHint: plan.currentTopic,
      note: normalizeText(plan.topicStep || '允许自然停住。'),
    };
  }

  if (plan.responseMode === 'ask') {
    return {
      kind: 'answer_current_question',
      topicHint: plan.currentTopic,
      note: normalizeText(plan.topicStep || '回答当前问题。'),
    };
  }

  if (plan.responseMode === 'analyze') {
    return {
      kind: 'share_more_detail',
      topicHint: plan.currentTopic,
      note: normalizeText(plan.topicStep || '补充当前问题的细节。'),
    };
  }

  if (plan.topicStep.includes('转') || plan.topicStep.includes('换')) {
    return {
      kind: 'accept_topic_shift',
      topicHint: plan.currentTopic,
      note: normalizeText(plan.topicStep),
    };
  }

  return {
    kind: 'continue_current_topic',
    topicHint: plan.currentTopic,
    note: normalizeText(plan.topicStep || '继续当前话题。'),
  };
}

export function renderExpectationAsInnerMonologue(
  expectation: DialogueExpectation | null
): string {
  if (!expectation) {
    return '我还没有特别明确想听你接哪一句。';
  }

  const topicHint = expectation.topicHint ? normalizeText(expectation.topicHint, 24) : '';

  switch (expectation.kind) {
    case 'answer_current_question':
      return topicHint
        ? `我想听你直接回答刚才那个问题，最好就围绕“${topicHint}”。`
        : '我想听你直接回答刚才那个问题。';
    case 'continue_current_topic':
      return topicHint
        ? `我想让你继续说“${topicHint}”这一块。`
        : '我想让你继续沿着刚才的话题说下去。';
    case 'share_more_detail':
      return topicHint
        ? `我想听你把“${topicHint}”说得再具体一点。`
        : '我想听你再多给一点具体细节。';
    case 'accept_topic_shift':
      return topicHint
        ? `我想确认你是不是想转到“${topicHint}”去聊。`
        : '我想确认你是不是想换个方向聊。';
    case 'short_ack':
      return '我现在更想先收到一个很短的回应。';
    case 'no_reply_ok':
      return '如果你现在不想回，也没关系。';
    default:
      return expectation.note || '我想听你顺着这个意思接下去。';
  }
}
