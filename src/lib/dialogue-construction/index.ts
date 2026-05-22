import OpenAI from 'openai';
import { logError, logInfo } from '../logger';
import { buildDialogueConstructionPrompt, DIALOGUE_CONSTRUCTION_SYSTEM_PROMPT } from './prompt';
import { FALLBACK_DIALOGUE_PLAN, parseDialoguePlan } from './parser';
import type {
  DialogueConstructionInput,
  DialoguePlan,
  DialoguePlannerMessage,
  DialogueRoundSummary,
} from './types';

type DeepSeekChatRequest = OpenAI.Chat.Completions.ChatCompletionCreateParams & {
  thinking?: { type: 'disabled' };
};

function getOpenAIClient(): OpenAI {
  return new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: 'https://api.deepseek.com',
  });
}

function clampSummaryText(content: string, maxLength = 120): string {
  const normalized = content.replace(/\s+/g, ' ').trim();
  return normalized.length > maxLength
    ? `${normalized.substring(0, maxLength - 1)}…`
    : normalized;
}

function collapseMessages(
  messages: DialoguePlannerMessage[]
): Array<{ role: 'user' | 'assistant'; content: string }> {
  const collapsed: Array<{ role: 'user' | 'assistant'; content: string }> = [];

  for (const message of messages) {
    if (message.role === 'system') {
      continue;
    }

    const content = message.content.trim();
    if (!content) {
      continue;
    }

    const role = message.role as 'user' | 'assistant';
    const previous = collapsed[collapsed.length - 1];

    if (previous && previous.role === role) {
      previous.content = `${previous.content}\n${content}`;
      continue;
    }

    collapsed.push({ role, content });
  }

  return collapsed;
}

export function buildRecentRoundSummaries(
  messages: DialoguePlannerMessage[]
): DialogueRoundSummary[] {
  if (messages.length === 0) {
    return [];
  }

  const sanitizedMessages =
    messages[messages.length - 1]?.role === 'user'
      ? messages.slice(0, -1)
      : [...messages];

  const collapsed = collapseMessages(sanitizedMessages);
  const rounds: DialogueRoundSummary[] = [];

  for (let index = 0; index < collapsed.length; index += 1) {
    const current = collapsed[index];

    if (current.role !== 'user') {
      continue;
    }

    const next = collapsed[index + 1];
    const hasAssistant = next?.role === 'assistant';
    const userSummary = clampSummaryText(current.content);
    const assistantSummary = hasAssistant ? clampSummaryText(next.content) : '';

    rounds.push({
      userSummary,
      assistantSummary,
      roundSummary: hasAssistant
        ? `用户：${userSummary}；系统：${assistantSummary}`
        : `用户：${userSummary}`,
      assistantAction: null,
    });

    if (hasAssistant) {
      index += 1;
    }
  }

  return rounds.slice(-6);
}

export async function planDialogue(
  input: DialogueConstructionInput
): Promise<DialoguePlan> {
  logInfo(
    'dialogue-construction',
    `Planning for "${input.latestUserMessage.substring(0, 50)}..."`
  );

  if (!process.env.DEEPSEEK_API_KEY) {
    logError(
      'dialogue-construction',
      new Error('DEEPSEEK_API_KEY is not configured')
    );
    return FALLBACK_DIALOGUE_PLAN;
  }

  try {
    const prompt = buildDialogueConstructionPrompt(input);

    const requestBody: DeepSeekChatRequest = {
      model: process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash',
      messages: [
        { role: 'system', content: DIALOGUE_CONSTRUCTION_SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 400,
      thinking: { type: 'disabled' },
    };

    const response = await getOpenAIClient().chat.completions.create(requestBody);

    const raw = response.choices[0]?.message?.content || '';
    if (!raw) {
      logError('dialogue-construction', new Error('LLM returned empty response'));
      return FALLBACK_DIALOGUE_PLAN;
    }

    return parseDialoguePlan(raw);
  } catch (error) {
    logError('dialogue-construction', error as Error);
    return FALLBACK_DIALOGUE_PLAN;
  }
}
