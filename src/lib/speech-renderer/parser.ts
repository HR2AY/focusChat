import { logError, logInfo } from '../logger';
import { splitIntoChunks } from './chunker';
import type { SpeechRendererOutput } from '../dialogue-construction/types';

const VALID_SEND_MODES = ['single', 'split_sentences', 'silent'] as const;
const VALID_TONES = ['light', 'steady', 'soft'] as const;
const VALID_RENDERER_MODES = ['render', 'silence'] as const;

export const FALLBACK_SPEECH_OUTPUT: SpeechRendererOutput = {
  text: '嗯。',
  chunks: ['嗯。'],
  sendMode: 'single',
  tone: 'steady',
  rendererMode: 'render',
};

function normalizeString(value: unknown, fallback = '', maxLength = 200): string {
  if (typeof value !== 'string') {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : fallback;
}

export function parseSpeechRendererOutput(raw: string): SpeechRendererOutput {
  logInfo('speech-renderer-parser', `Raw LLM output: ${raw.substring(0, 400)}`);

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    logError('speech-renderer-parser', new Error('No JSON found in response'));
    return FALLBACK_SPEECH_OUTPUT;
  }

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
  } catch (error) {
    logError('speech-renderer-parser', error as Error);
    return FALLBACK_SPEECH_OUTPUT;
  }

  const sendMode = VALID_SEND_MODES.includes(
    data.sendMode as (typeof VALID_SEND_MODES)[number]
  )
    ? (data.sendMode as SpeechRendererOutput['sendMode'])
    : FALLBACK_SPEECH_OUTPUT.sendMode;

  const tone = VALID_TONES.includes(data.tone as (typeof VALID_TONES)[number])
    ? (data.tone as SpeechRendererOutput['tone'])
    : FALLBACK_SPEECH_OUTPUT.tone;

  const rendererMode = VALID_RENDERER_MODES.includes(
    data.rendererMode as (typeof VALID_RENDERER_MODES)[number]
  )
    ? (data.rendererMode as SpeechRendererOutput['rendererMode'])
    : FALLBACK_SPEECH_OUTPUT.rendererMode;

  let text = normalizeString(data.text, rendererMode === 'silence' ? '' : FALLBACK_SPEECH_OUTPUT.text, 240);
  let chunks = Array.isArray(data.chunks)
    ? data.chunks
        .filter((value): value is string => typeof value === 'string')
        .map((chunk) => chunk.trim())
        .filter(Boolean)
        .slice(0, 6)
    : [];

  if (rendererMode === 'silence') {
    return {
      text: '',
      chunks: [],
      sendMode: 'silent',
      tone,
      rendererMode: 'silence',
    };
  }

  if (!text && chunks.length > 0) {
    text = chunks.join(sendMode === 'split_sentences' ? '\n' : '');
  }

  if (!text) {
    text = FALLBACK_SPEECH_OUTPUT.text;
  }

  if (chunks.length === 0) {
    chunks = splitIntoChunks(text);
  }

  if (sendMode === 'single') {
    chunks = [chunks.join('') || text];
  }

  if (sendMode === 'split_sentences' && chunks.length === 0) {
    chunks = splitIntoChunks(text);
  }

  return {
    text,
    chunks,
    sendMode,
    tone,
    rendererMode: 'render',
  };
}
