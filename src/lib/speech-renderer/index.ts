import OpenAI from 'openai';
import { logError, logInfo } from '../logger';
import {
  buildAnalysisSkillOutput,
} from './analysisSkill';
import { splitIntoChunks } from './chunker';
import { parseSpeechRendererOutput, FALLBACK_SPEECH_OUTPUT } from './parser';
import {
  buildQuestionSkillOutput,
} from './questionSkill';
import {
  buildSpeechRendererPrompt,
  buildSpeechShape,
  SPEECH_RENDERER_SYSTEM_PROMPT,
} from './prompt';
import type {
  DialogueIntermediateSkillOutput,
  SpeechRendererInput,
  SpeechRendererOutput,
  SpeechShape,
} from '../dialogue-construction/types';

type DeepSeekChatRequest = OpenAI.Chat.Completions.ChatCompletionCreateParams & {
  thinking?: { type: 'disabled' };
};

function getOpenAIClient(): OpenAI {
  return new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: 'https://api.deepseek.com',
  });
}

export function buildIntermediateSkillOutput(
  input: SpeechRendererInput
): DialogueIntermediateSkillOutput {
  if (
    input.topicArousalContext.topicRelation === 'continue' &&
    input.topicArousalContext.currentStimulusLevel === 'high' &&
    input.dialoguePlan.responseMode === 'ask'
  ) {
    return buildAnalysisSkillOutput(input);
  }

  if (input.dialoguePlan.responseMode === 'ask') {
    return buildQuestionSkillOutput(input);
  }

  if (input.dialoguePlan.responseMode === 'analyze') {
    return buildAnalysisSkillOutput(input);
  }

  return null;
}

function stripUnsupportedEmoji(text: string): string {
  return text.replace(/\p{Extended_Pictographic}/gu, '').trim();
}

function sanitizeSpeechOutput(
  output: SpeechRendererOutput,
  shape: SpeechShape
): SpeechRendererOutput {
  if (output.rendererMode === 'silence' || shape.sendMode === 'silent') {
    return {
      text: '',
      chunks: [],
      sendMode: 'silent',
      tone: shape.tone,
      rendererMode: 'silence',
    };
  }

  let text = output.text.trim();
  let chunks = output.chunks.filter(Boolean);

  if (!shape.allowEmoji) {
    text = stripUnsupportedEmoji(text);
    chunks = chunks.map(stripUnsupportedEmoji).filter(Boolean);
  }

  if (!shape.allowQuestion) {
    text = text.replace(/[?？]+/g, '。');
    chunks = chunks.map((chunk) => chunk.replace(/[?？]+/g, '。'));
  }

  if (chunks.length === 0) {
    chunks = splitIntoChunks(text);
  }

  if (shape.maxSentences > 0) {
    chunks = chunks.slice(0, shape.maxSentences);
  }

  chunks = chunks.map((chunk) => chunk.slice(0, shape.maxCharsPerChunk + 6));

  if (shape.sendMode === 'single') {
    const single = chunks.join('') || text;
    return {
      text: single,
      chunks: [single],
      sendMode: 'single',
      tone: shape.tone,
      rendererMode: 'render',
    };
  }

  const rebuiltText = chunks.join('\n').trim() || text;

  return {
    text: rebuiltText,
    chunks,
    sendMode: 'split_sentences',
    tone: shape.tone,
    rendererMode: 'render',
  };
}

export async function renderSpeech(
  input: SpeechRendererInput,
  skillOutput: DialogueIntermediateSkillOutput
): Promise<SpeechRendererOutput> {
  const shape = buildSpeechShape(input, skillOutput);

  if (shape.sendMode === 'silent') {
    return {
      text: '',
      chunks: [],
      sendMode: 'silent',
      tone: shape.tone,
      rendererMode: 'silence',
    };
  }

  if (!process.env.DEEPSEEK_API_KEY) {
    logError('speech-renderer', new Error('DEEPSEEK_API_KEY is not configured'));
    return FALLBACK_SPEECH_OUTPUT;
  }

  try {
    const prompt = buildSpeechRendererPrompt(input, skillOutput, shape);
    const requestBody: DeepSeekChatRequest = {
      model: process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash',
      messages: [
        { role: 'system', content: SPEECH_RENDERER_SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 220,
      thinking: { type: 'disabled' },
    };

    const response = await getOpenAIClient().chat.completions.create(requestBody);
    const raw = response.choices[0]?.message?.content || '';

    if (!raw) {
      logError('speech-renderer', new Error('LLM returned empty response'));
      return FALLBACK_SPEECH_OUTPUT;
    }

    const parsed = sanitizeSpeechOutput(parseSpeechRendererOutput(raw), shape);
    logInfo(
      'speech-renderer',
      `Rendered speech: mode=${parsed.sendMode}, chunks=${parsed.chunks.length}`
    );

    return parsed;
  } catch (error) {
    logError('speech-renderer', error as Error);
    return FALLBACK_SPEECH_OUTPUT;
  }
}
