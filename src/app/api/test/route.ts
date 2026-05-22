import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function GET() {
  try {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    const model = process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash';

    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: 'DEEPSEEK_API_KEY is not set',
      });
    }

    // 初始化客户端
    const openai = new OpenAI({
      apiKey: apiKey,
      baseURL: 'https://api.deepseek.com',
    });

    // 发送测试请求（禁用思考模式）
    const response = await openai.chat.completions.create({
      model: model,
      messages: [
        { role: 'user', content: '你好，请用一句话回复。' }
      ],
      max_tokens: 50,
      // @ts-expect-error DeepSeek 特有参数
      thinking: { type: 'disabled' },
    });

    return NextResponse.json({
      success: true,
      response: response.choices[0]?.message?.content,
      usage: response.usage,
      model: response.model,
    });

  } catch (error) {
    console.error('Test API error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
