import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { ChatMessage, StreamChunk } from '@/types';
import { SIMPLE_SYSTEM_PROMPT } from '@/lib/prompts';

// 初始化 DeepSeek 客户端（兼容 OpenAI 格式）
const openai = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com',
});

export async function POST(request: NextRequest) {
  try {
    // 解析请求体
    const body = await request.json();
    const { messages }: { messages: ChatMessage[] } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: '消息列表不能为空' },
        { status: 400 }
      );
    }

    // 检查 API Key
    if (!process.env.DEEPSEEK_API_KEY) {
      return NextResponse.json(
        { error: '未配置 DeepSeek API Key' },
        { status: 500 }
      );
    }

    // 构建消息格式
    const openaiMessages = [
      { role: 'system' as const, content: SIMPLE_SYSTEM_PROMPT },
      ...messages.map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
    ];

    // 调用 DeepSeek API（流式）
    // 注意：deepseek-v4-flash 需要禁用思考模式才能正常返回内容
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stream = await (openai.chat.completions as any).create({
      model: process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash',
      messages: openaiMessages,
      stream: true,
      temperature: 0.8,
      max_tokens: 200,
      thinking: { type: 'disabled' },
    });

    // 创建 ReadableStream 用于 SSE
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content;

            if (content) {
              const streamChunk: StreamChunk = {
                type: 'content',
                content,
              };
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(streamChunk)}\n\n`)
              );
            }
          }

          // 发送完成信号
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          console.error('Stream error:', error);
          const errorChunk: StreamChunk = {
            type: 'error',
            error: `流式传输出现错误: ${error instanceof Error ? error.message : String(error)}`,
          };
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(errorChunk)}\n\n`)
          );
          controller.close();
        }
      },
    });

    // 返回 SSE 响应
    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { 
        error: '服务器内部错误',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
