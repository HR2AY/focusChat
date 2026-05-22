import type {
  QuestionSkillOutput,
  QuestionTargetDirection,
  SpeechRendererInput,
} from '../dialogue-construction/types';

function inferTargetDirection(
  input: SpeechRendererInput
): QuestionTargetDirection {
  if (input.dialoguePlan.expectationMatch === 'not_matched') {
    return 'check_conflict';
  }

  if (input.observationResult.observation.willingToExpress === 'low') {
    return 'clarify_user_state';
  }

  return 'reconnect_context';
}

export function buildQuestionSkillOutput(
  input: SpeechRendererInput
): QuestionSkillOutput {
  const targetDirection = inferTargetDirection(input);

  return {
    shouldRun: true,
    skillType: 'question',
    targetDirection,
    questionIntent:
      targetDirection === 'clarify_user_state'
        ? '轻量确认用户现在更想继续、暂停，还是只想被听见。'
        : targetDirection === 'check_conflict'
          ? '低负担确认用户是否想换方向，或是觉得系统理解偏了。'
          : '用一个轻问题把对话接回当前上下文。',
    outputConstraints: {
      maxQuestions: 1,
      avoidMultiQuestion: true,
      avoidOverExplanation: true,
      avoidAbstractTalk:
        input.topicArousalContext.currentStimulusLevel === 'high' &&
        input.topicArousalContext.topicRelation === 'continue'
          ? false
          : true,
    },
  };
}
