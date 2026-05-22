import type {
  AnalysisDirection,
  AnalysisSkillOutput,
  SpeechRendererInput,
} from '../dialogue-construction/types';

function inferAnalysisDirection(
  input: SpeechRendererInput
): AnalysisDirection {
  const content = input.latestUserMessage;
  const fearKeywords = ['怕', '担心', '最坏', '风险', '后果', '失控', '失败'];
  const excitementKeywords = ['想做', '好激动', '冲动', '灵感', '上头', '计划'];

  if (fearKeywords.some((keyword) => content.includes(keyword))) {
    return 'fear_analysis';
  }

  if (excitementKeywords.some((keyword) => content.includes(keyword))) {
    return 'excitement_analysis';
  }

  return input.observationResult.observation.cognitiveActivity === 'high'
    ? 'fear_analysis'
    : 'excitement_analysis';
}

export function buildAnalysisSkillOutput(
  input: SpeechRendererInput
): AnalysisSkillOutput {
  const targetDirection = inferAnalysisDirection(input);

  return {
    shouldRun: true,
    skillType: 'analysis',
    targetDirection,
    analysisIntent:
      targetDirection === 'fear_analysis'
        ? '把担心从灾难化想象拉回现实里可验证的一步。'
        : '把兴奋想法压缩成可保存、可验证的最小动作。',
    outputConstraints: {
      maxPoints: 2,
      avoidOverExplanation: true,
      avoidAbstractTalk: true,
      avoidAbsoluteConclusion: true,
    },
  };
}
