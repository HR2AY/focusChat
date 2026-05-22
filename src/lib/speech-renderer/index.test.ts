import test from 'node:test';
import assert from 'node:assert/strict';
import { splitIntoChunks } from './chunker';
import { parseSpeechRendererOutput, FALLBACK_SPEECH_OUTPUT } from './parser';
import { buildSpeechShape } from './prompt';
import { buildIntermediateSkillOutput } from './index';
import type { SpeechRendererInput } from '../dialogue-construction/types';

function createInput(
  overrides: Partial<SpeechRendererInput> = {}
): SpeechRendererInput {
  return {
    dialoguePlan: {
      expectationMatch: 'none',
      currentTopic: '失眠',
      topicStage: '延续中',
      replyPlan: '继续跟随当前话题，输出更短。',
      topicStep: '先跟随，再轻轻收尾。',
      responseMode: 'default',
      shouldSearchMaterials: false,
      searchQuery: '',
      searchPurpose: '',
    },
    observationResult: {
      observation: {
        cognitiveActivity: 'medium',
        isInterrupting: false,
        willingToExpress: 'medium',
        aiTooVerbose: false,
        reasoning: '默认',
      },
      updatedState: {
        arousalLevel: 'medium',
        willingnessToExpress: 'medium',
        aiVerbosity: 'normal',
        turnCount: 1,
        lastUpdated: '',
      },
    },
    recentRoundSummaries: [],
    userProfile: '用户偏向夜间焦虑。',
    userCognitiveActivity: 'medium',
    soul: '轻、短、慢、自然、生活化。',
    latestUserMessage: '我有点睡不着。',
    ...overrides,
  };
}

test('splitIntoChunks prefers natural pauses and avoids empty chunks', () => {
  const chunks = splitIntoChunks('嗯，先别急。慢一点，也没关系。');
  assert.ok(chunks.length >= 2);
  assert.ok(chunks.every((chunk) => chunk.length > 0));
});

test('parseSpeechRendererOutput auto-fills chunks from text', () => {
  const parsed = parseSpeechRendererOutput(
    JSON.stringify({
      text: '嗯，先别急。慢一点。',
      chunks: [],
      sendMode: 'split_sentences',
      tone: 'soft',
      rendererMode: 'render',
    })
  );

  assert.equal(parsed.sendMode, 'split_sentences');
  assert.ok(parsed.chunks.length >= 1);
  assert.equal(parsed.tone, 'soft');
});

test('parseSpeechRendererOutput handles silent mode', () => {
  const parsed = parseSpeechRendererOutput(
    JSON.stringify({
      text: '',
      chunks: [],
      sendMode: 'silent',
      tone: 'soft',
      rendererMode: 'silence',
    })
  );

  assert.deepEqual(parsed, {
    text: '',
    chunks: [],
    sendMode: 'silent',
    tone: 'soft',
    rendererMode: 'silence',
  });
});

test('parseSpeechRendererOutput falls back on invalid JSON', () => {
  assert.deepEqual(parseSpeechRendererOutput('bad-json'), FALLBACK_SPEECH_OUTPUT);
});

test('buildIntermediateSkillOutput returns question skill for ask mode', () => {
  const input = createInput({
    dialoguePlan: {
      expectationMatch: 'not_matched',
      currentTopic: '失眠',
      topicStage: '延续中',
      replyPlan: '继续跟随。',
      topicStep: '先确认方向。',
      responseMode: 'ask',
      shouldSearchMaterials: false,
      searchQuery: '',
      searchPurpose: '',
    },
  });

  const skill = buildIntermediateSkillOutput(input);
  assert.equal(skill?.skillType, 'question');
  assert.equal(skill?.shouldRun, true);
});

test('buildIntermediateSkillOutput returns analysis skill for analyze mode', () => {
  const input = createInput({
    dialoguePlan: {
      expectationMatch: 'matched',
      currentTopic: '担心失败',
      topicStage: '延续中',
      replyPlan: '做轻分析。',
      topicStep: '先拆出最小一步。',
      responseMode: 'analyze',
      shouldSearchMaterials: false,
      searchQuery: '',
      searchPurpose: '',
    },
    latestUserMessage: '我很担心这个决定会失败。',
  });

  const skill = buildIntermediateSkillOutput(input);
  assert.equal(skill?.skillType, 'analysis');
  assert.equal(skill?.shouldRun, true);
});

test('buildSpeechShape returns silent mode for silence-like plan', () => {
  const shape = buildSpeechShape(
    createInput({
      dialoguePlan: {
        expectationMatch: 'matched',
        currentTopic: '收尾',
        topicStage: '收束中',
        replyPlan: '保持安静。',
        topicStep: '安静收束。',
        responseMode: 'default',
        shouldSearchMaterials: false,
        searchQuery: '',
        searchPurpose: '',
      },
    }),
    null
  );

  assert.equal(shape.sendMode, 'silent');
  assert.equal(shape.maxSentences, 0);
});
