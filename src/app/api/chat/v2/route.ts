import { NextRequest } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import { ChatMessage, OutputLanguage, SSEEvent } from '@/types';
import { logError, logInfo } from '@/lib/logger';
import { observe, prepareInput } from '@/lib/observation';
import { getDialogueContext } from '@/lib/dialogue-construction/context';
import {
  buildRecentRoundSummaries,
  deriveLastSystemAction,
  deriveNextExpectation,
  renderExpectationAsInnerMonologue,
  planDialogue,
  setDialogueContext,
} from '@/lib/dialogue-construction';
import {
  buildIntermediateSkillOutput,
  renderSpeech,
} from '@/lib/speech-renderer';
import { loadTopicArousalContext } from '@/lib/topic-arousal-loader';

/**
 * POST /api/chat/v2
 *
 * 请求体：
 * {
 *   messages: ChatMessage[];
 *   action?: 'send' | 'pause' | 'resume';
 * }
 *
 * 响应：SSE 流
 */

const activeControllers = new Map<string, AbortController>();
const DATA_DIR = path.join(process.cwd(), 'src', 'data');

function readFile(name: string, fallback: string): string {
  try {
    return fs.readFileSync(path.join(DATA_DIR, name), 'utf-8');
  } catch {
    return fallback;
  }
}

function jsonResponse(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      messages,
      action = 'send',
      language = 'zh',
    }: { messages: ChatMessage[]; action?: string; language?: OutputLanguage } = body;

    if (action === 'pause') {
      const controller = activeControllers.get('current');
      if (controller) {
        controller.abort();
        activeControllers.delete('current');
      }

      return jsonResponse(200, { type: 'status', status: 'paused' });
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return jsonResponse(400, { type: 'error', message: '消息列表不能为空' });
    }

    if (!process.env.DEEPSEEK_API_KEY) {
      return jsonResponse(500, { type: 'error', message: '未配置 DeepSeek API Key' });
    }

    const latestMessage = messages[messages.length - 1];
    if (latestMessage.role !== 'user') {
      return jsonResponse(400, { type: 'error', message: '最后一条消息必须是用户消息' });
    }

    const soul = readFile('soul.md', '暂无 soul');
    const userProfile = readFile('user-profile.md', '暂无用户画像');

    const encoder = new TextEncoder();
    const abortController = new AbortController();
    activeControllers.set('current', abortController);

    const readable = new ReadableStream({
      async start(controller) {
        try {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'status',
                status: 'thinking',
              } as SSEEvent)}\n\n`
            )
          );

          if (abortController.signal.aborted) {
            controller.close();
            return;
          }

          const observationInput = prepareInput(messages, soul, userProfile);
          const observationResult = await observe(observationInput);

          if (abortController.signal.aborted) {
            controller.close();
            return;
          }

          const recentRoundSummaries = buildRecentRoundSummaries(messages);
          const {
            expectation,
            lastSystemAction,
            topicContext,
          } = getDialogueContext();
          const topicArousalContext = loadTopicArousalContext({
            latestUserMessage: latestMessage.content,
            observation: observationResult.observation,
            recentRoundSummaries,
            previousTopicState: topicContext,
          });

          const plan = await planDialogue({
            latestUserMessage: latestMessage.content,
            observationResult,
            recentRoundSummaries,
            soul,
            userProfile,
            outputLanguage: language,
            expectation,
            lastSystemAction,
            uiState: null,
            topicArousalContext,
          });

          logInfo('api/v2', 'Planner produced plan', plan);

          const speechInput = {
            dialoguePlan: plan,
            observationResult,
            recentRoundSummaries,
            userProfile,
            userCognitiveActivity: observationResult.observation.cognitiveActivity,
            soul,
            latestUserMessage: latestMessage.content,
            outputLanguage: language,
            topicArousalContext,
          };
          const skillOutput = buildIntermediateSkillOutput(speechInput);
          const speech = await renderSpeech(speechInput, skillOutput);
          const nextExpectation = deriveNextExpectation(plan, speech);
          const innerMonologue = renderExpectationAsInnerMonologue(nextExpectation);

          setDialogueContext({
            expectation: nextExpectation,
            lastSystemAction: deriveLastSystemAction(plan, speech),
            topicContext: {
              topicLabel: topicArousalContext.currentTopicLabel,
              topicCategory: topicArousalContext.currentTopicCategory,
              stimulusLevel: topicArousalContext.currentStimulusLevel,
            },
          });

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'planner',
                plan,
                speech,
                innerMonologue,
                topicArousalContext,
              } as SSEEvent)}\n\n`
            )
          );

          if (speech.rendererMode === 'render') {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: 'status',
                  status: 'emitting',
                } as SSEEvent)}\n\n`
              )
            );

            for (const chunk of speech.chunks) {
              if (abortController.signal.aborted) {
                break;
              }

              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: 'message',
                    content: chunk,
                    messageId: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
                  } as SSEEvent)}\n\n`
                )
              );
            }
          }

          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'done' } as SSEEvent)}\n\n`)
          );
          controller.close();
        } catch (error) {
          logError('api/v2', error as Error);

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'error',
                message: error instanceof Error ? error.message : '服务器内部错误',
              } as SSEEvent)}\n\n`
            )
          );
          controller.close();
        } finally {
          activeControllers.delete('current');
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    logError('api/v2', error as Error);
    return jsonResponse(500, { type: 'error', message: '服务器内部错误' });
  }
}
