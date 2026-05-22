import type {
  DialogueIntermediateSkillOutput,
  SpeechRendererInput,
  SpeechShape,
} from '../dialogue-construction/types';

export const SPEECH_RENDERER_SYSTEM_PROMPT =
  '你是 speech renderer。只输出JSON。你只负责表达，不改策略，不扩写，不说教，不分析状态。';

function formatRecentSummary(input: SpeechRendererInput): string {
  if (input.recentRoundSummaries.length === 0) {
    return '(无最近摘要)';
  }

  return input.recentRoundSummaries
    .map((round, index) => `${index + 1}. ${round.roundSummary}`)
    .join('\n');
}

export function buildSpeechShape(
  input: SpeechRendererInput,
  skillOutput: DialogueIntermediateSkillOutput
): SpeechShape {
  const observation = input.observationResult.observation;
  const wantsShort =
    observation.aiTooVerbose ||
    observation.willingToExpress === 'low' ||
    observation.willingToExpress === 'reluctant' ||
    observation.cognitiveActivity === 'low' ||
    observation.cognitiveActivity === 'sleepy' ||
    input.dialoguePlan.replyPlan.includes('更短') ||
    input.dialoguePlan.replyPlan.includes('缩短');
  const isContinuingHighStimulusTopic =
    input.topicArousalContext.currentStimulusLevel === 'high' &&
    input.topicArousalContext.topicRelation === 'continue';
  const isContinuingMediumStimulusTopic =
    input.topicArousalContext.currentStimulusLevel === 'medium' &&
    input.topicArousalContext.topicRelation === 'continue';

  const rendererMode =
    input.dialoguePlan.topicStep.includes('安静收束') ||
    input.dialoguePlan.replyPlan.includes('silence') ||
    input.dialoguePlan.replyPlan.includes('保持安静');

  if (rendererMode) {
    return {
      maxSentences: 0,
      shouldSplit: false,
      allowEmoji: false,
      allowQuestion: false,
      allowClosing: false,
      maxCharsPerChunk: 0,
      sendMode: 'silent',
      tone: 'soft',
    };
  }

  return {
    maxSentences:
      skillOutput?.skillType === 'analysis'
        ? isContinuingHighStimulusTopic
          ? 3
          : 2
        : wantsShort
          ? 2
          : isContinuingMediumStimulusTopic
            ? 3
            : 2,
    shouldSplit: true,
    allowEmoji:
      observation.cognitiveActivity !== 'high' &&
      observation.willingToExpress !== 'reluctant',
    allowQuestion:
      input.dialoguePlan.responseMode === 'ask' && skillOutput?.skillType === 'question',
    allowClosing: true,
    maxCharsPerChunk:
      wantsShort && !isContinuingHighStimulusTopic
        ? 12
        : isContinuingHighStimulusTopic
          ? 34
          : isContinuingMediumStimulusTopic
            ? 26
            : 18,
    sendMode: 'split_sentences',
    tone:
      observation.cognitiveActivity === 'sleepy' || observation.willingToExpress === 'low'
        ? 'soft'
        : observation.cognitiveActivity === 'high'
          ? 'steady'
          : 'light',
  };
}

export function buildSpeechRendererPrompt(
  input: SpeechRendererInput,
  skillOutput: DialogueIntermediateSkillOutput,
  shape: SpeechShape
): string {
  const recentSummary = formatRecentSummary(input);
  const observation = input.observationResult.observation;
  const skillText = skillOutput
    ? JSON.stringify(skillOutput, null, 2)
    : '(无中间 skill 输出)';
  const topicArousalContext = input.topicArousalContext;
  const outputLanguage = input.outputLanguage === 'en' ? 'English' : '中文';

  return `dialoguePlan:
${JSON.stringify(input.dialoguePlan)}

observation:
${JSON.stringify(observation)}

topicArousalContext:
${JSON.stringify(topicArousalContext)}

recentSummary:
${recentSummary}

latestUserMessage:
${input.latestUserMessage}

userProfile:
${input.userProfile}

userCognitiveActivity:
${input.userCognitiveActivity}

outputLanguage:
${outputLanguage}

soul:
${input.soul.substring(0, 900)}

skillOutput:
${skillText}

shape:
${JSON.stringify(shape)}

只做表达，不改策略。
最终 text 和 chunks 必须全部使用 ${outputLanguage} 输出。
如果 currentStimulusLevel 是 high 或 medium，且 topicRelation=continue，可以保留必要的抽象理解，不要故意把复杂话题降格成幼稚追问。
只有当策略明确要求 shift/new topic 时，才需要沿 allowedShiftStimulusLevel 往下走。
如果 sendMode=silent，就输出空 text 和空 chunks。
输出:
{
  "text": "",
  "chunks": [],
  "sendMode": "single|split_sentences|silent",
  "tone": "light|steady|soft",
  "rendererMode": "render|silence"
}`;
}
