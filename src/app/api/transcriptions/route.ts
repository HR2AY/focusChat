import { NextRequest } from 'next/server';

const BIGMODEL_TRANSCRIPT_URL =
  'https://open.bigmodel.cn/api/paas/v4/audio/transcriptions';
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;
const BIGMODEL_ASR_MODEL = 'glm-asr-2512';

function jsonResponse(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function isAllowedAudioFile(file: File): boolean {
  const lowerName = file.name.toLowerCase();
  return (
    file.type === 'audio/wav' ||
    file.type === 'audio/x-wav' ||
    lowerName.endsWith('.wav')
  );
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.BIGMODEL_API_KEY;
    if (!apiKey) {
      return jsonResponse(500, { error: '未配置 BIGMODEL_API_KEY' });
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return jsonResponse(400, { error: '缺少音频文件' });
    }

    if (!isAllowedAudioFile(file)) {
      return jsonResponse(400, { error: '仅支持 WAV 音频文件' });
    }

    if (file.size <= 0) {
      return jsonResponse(400, { error: '音频文件不能为空' });
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return jsonResponse(400, { error: '音频文件不能超过 25MB' });
    }

    const upstreamFormData = new FormData();
    upstreamFormData.append('file', file, file.name || 'recording.wav');
    upstreamFormData.append('model', BIGMODEL_ASR_MODEL);
    upstreamFormData.append('stream', 'false');

    const upstreamResponse = await fetch(BIGMODEL_TRANSCRIPT_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: upstreamFormData,
    });

    const responseText = await upstreamResponse.text();
    let parsed: Record<string, unknown> | null = null;

    try {
      parsed = JSON.parse(responseText) as Record<string, unknown>;
    } catch {
      parsed = null;
    }

    if (!upstreamResponse.ok) {
      return jsonResponse(upstreamResponse.status, {
        error:
          (parsed && typeof parsed.message === 'string' && parsed.message) ||
          (parsed &&
            typeof parsed.error === 'object' &&
            parsed.error &&
            'message' in parsed.error &&
            typeof parsed.error.message === 'string' &&
            parsed.error.message) ||
          responseText ||
          '语音转文字失败',
      });
    }

    const text = parsed && typeof parsed.text === 'string' ? parsed.text.trim() : '';
    if (!text) {
      return jsonResponse(502, { error: '转写结果为空' });
    }

    return jsonResponse(200, { text });
  } catch (error) {
    return jsonResponse(500, {
      error: error instanceof Error ? error.message : '服务器内部错误',
    });
  }
}
