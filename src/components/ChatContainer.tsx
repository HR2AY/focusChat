'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  ChatMessage,
  OutputLanguage,
  SSEEvent,
  SSEStatus,
  VoiceState,
} from '@/types';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';
import TypingIndicator from './TypingIndicator';

const RECORDING_WARNING_MS = 30_000;
const AMBIENCE_LOOP_START_SECONDS = 40;
const AMBIENCE_LOOP_END_BUFFER_SECONDS = 0.35;
const LANGUAGE_COPY: Record<
  OutputLanguage,
  {
    chooseLanguage: string;
    brandSub: string;
    placeholder: string;
    send: string;
    voice: string;
    stop: string;
    thinking: string;
    loading: string;
    emitting: string;
    paused: string;
    transcribing: string;
    recording: (duration: string, overLimit: boolean) => string;
    genericError: string;
    noAudio: string;
    unclearVoice: string;
    noSpeechCaptured: string;
    unsupportedRecording: string;
    unsupportedAudio: string;
    micPermissionDenied: string;
    recordingStartFailed: string;
  }
> = {
  zh: {
    chooseLanguage: '选择语言',
    brandSub: '窗口模式',
    placeholder: '输入消息...',
    send: '发送',
    voice: '语音',
    stop: '停止',
    thinking: '正在思考...',
    loading: '正在加载话题...',
    emitting: '对方正在输入...',
    paused: '已暂停',
    transcribing: '正在转写语音...',
    recording: (duration, overLimit) =>
      overLimit ? `录音中 ${duration}，已超过 30 秒，建议尽快结束` : `录音中 ${duration}`,
    genericError: '抱歉，出现了错误。请稍后再试。',
    noAudio: '没有录到有效声音，请再试一次。',
    unclearVoice: '没有识别到清晰的人声，请暂停背景声后再试一次。',
    noSpeechCaptured: '语音转文字失败',
    unsupportedRecording: '当前浏览器暂不支持录音，请改用手动输入。',
    unsupportedAudio: '当前浏览器音频能力不足，请改用手动输入。',
    micPermissionDenied: '没有拿到麦克风权限，请允许浏览器访问麦克风。',
    recordingStartFailed: '录音启动失败，请检查麦克风后再试。',
  },
  en: {
    chooseLanguage: 'Choose language',
    brandSub: 'Window Mode',
    placeholder: 'Type a message...',
    send: 'Send',
    voice: 'Voice',
    stop: 'Stop',
    thinking: 'Thinking...',
    loading: 'Loading topics...',
    emitting: 'Typing...',
    paused: 'Paused',
    transcribing: 'Transcribing voice...',
    recording: (duration, overLimit) =>
      overLimit ? `Recording ${duration}. Over 30 seconds, please wrap up soon.` : `Recording ${duration}`,
    genericError: 'Sorry, something went wrong. Please try again later.',
    noAudio: 'No valid audio was captured. Please try again.',
    unclearVoice: 'No clear speech was detected. Please pause the background audio and try again.',
    noSpeechCaptured: 'Voice transcription failed',
    unsupportedRecording: 'This browser does not support recording. Please type instead.',
    unsupportedAudio: 'This browser audio capability is limited. Please type instead.',
    micPermissionDenied: 'Microphone permission was not granted. Please allow access and try again.',
    recordingStartFailed: 'Unable to start recording. Please check your microphone and try again.',
  },
};
const CLOCK_FORMATTER = new Intl.DateTimeFormat('zh-CN', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

type AudioContextCtor = typeof AudioContext;

function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const bytesPerSample = 2;
  const blockAlign = bytesPerSample;
  const buffer = new ArrayBuffer(44 + samples.length * bytesPerSample);
  const view = new DataView(buffer);

  const writeString = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * bytesPerSample, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, samples.length * bytesPerSample, true);

  let offset = 44;
  for (let index = 0; index < samples.length; index += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[index] ?? 0));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    offset += bytesPerSample;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

function mergeTranscriptionText(currentText: string, transcription: string): string {
  const trimmedCurrent = currentText.trimEnd();
  const trimmedTranscription = transcription.trim();

  if (!trimmedTranscription) {
    return currentText;
  }

  if (!trimmedCurrent) {
    return trimmedTranscription;
  }

  return `${trimmedCurrent}\n${trimmedTranscription}`;
}

function isMeaningfulTranscription(transcription: string): boolean {
  const normalized = transcription.trim();
  return Boolean(normalized && normalized !== '#' && normalized !== '＃');
}

export default function ChatContainer() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<SSEStatus | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<OutputLanguage | null>(null);
  const [isAmbientMuted, setIsAmbientMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(() =>
    CLOCK_FORMATTER.format(new Date())
  );
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [recordingDurationMs, setRecordingDurationMs] = useState(0);
  const [recordingLimitReached, setRecordingLimitReached] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const ambienceAudioRef = useRef<HTMLAudioElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const pauseNotifiedRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const monitorGainRef = useRef<GainNode | null>(null);
  const audioChunksRef = useRef<Float32Array[]>([]);
  const sampleRateRef = useRef(44_100);
  const recordingStartedAtRef = useRef<number | null>(null);
  const recordingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const voiceStateRef = useRef<VoiceState>('idle');
  const resumeAmbienceAfterRecordingRef = useRef(false);
  const uiLanguage = selectedLanguage || 'zh';
  const copy = LANGUAGE_COPY[uiLanguage];

  useEffect(() => {
    voiceStateRef.current = voiceState;
  }, [voiceState]);

  useEffect(() => {
    document.documentElement.lang = uiLanguage === 'en' ? 'en' : 'zh-CN';
  }, [uiLanguage]);

  const resetVoiceUi = useCallback((nextState: VoiceState = 'idle') => {
    setVoiceState(nextState);
    setRecordingDurationMs(0);
    setRecordingLimitReached(false);
  }, []);

  const clearRecordingInterval = useCallback(() => {
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
  }, []);

  const stopRecordingStream = useCallback(() => {
    processorRef.current?.disconnect();
    sourceRef.current?.disconnect();
    monitorGainRef.current?.disconnect();
    processorRef.current = null;
    sourceRef.current = null;
    monitorGainRef.current = null;

    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }

    audioContextRef.current?.close().catch(() => undefined);
    audioContextRef.current = null;
  }, []);

  const finalizeRecording = useCallback((): Blob | null => {
    const chunks = audioChunksRef.current;
    audioChunksRef.current = [];

    if (chunks.length === 0) {
      return null;
    }

    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const merged = new Float32Array(totalLength);
    let offset = 0;

    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }

    return encodeWav(merged, sampleRateRef.current);
  }, []);

  const uploadRecording = useCallback(async (blob: Blob) => {
    const formData = new FormData();
    formData.append('file', blob, `recording-${Date.now()}.wav`);

    const response = await fetch('/api/transcriptions', {
      method: 'POST',
      body: formData,
    });

    const payload = (await response.json()) as { text?: string; error?: string };
    if (!response.ok || !payload.text || !isMeaningfulTranscription(payload.text)) {
      throw new Error(payload.error || copy.noSpeechCaptured);
    }

    return payload.text;
  }, [copy.noSpeechCaptured]);

  const pauseAmbienceForRecording = useCallback(() => {
    const ambienceAudio = ambienceAudioRef.current;
    if (!ambienceAudio) {
      resumeAmbienceAfterRecordingRef.current = false;
      return;
    }

    resumeAmbienceAfterRecordingRef.current = !isAmbientMuted && !ambienceAudio.paused;
    ambienceAudio.pause();
  }, [isAmbientMuted]);

  const resumeAmbienceAfterRecording = useCallback(() => {
    const ambienceAudio = ambienceAudioRef.current;
    if (!ambienceAudio || !resumeAmbienceAfterRecordingRef.current) {
      return;
    }

    resumeAmbienceAfterRecordingRef.current = false;
    void ambienceAudio.play().catch(() => undefined);
  }, []);

  const stopRecording = useCallback(async () => {
    clearRecordingInterval();
    stopRecordingStream();

    const wavBlob = finalizeRecording();
    if (!wavBlob) {
      resetVoiceUi('error');
      setVoiceError(copy.noAudio);
      return;
    }

    setVoiceState('transcribing');
    setVoiceError(null);
    resumeAmbienceAfterRecording();

    try {
      const transcription = await uploadRecording(wavBlob);
      setInputValue((prev) => mergeTranscriptionText(prev, transcription));
      resetVoiceUi('idle');
      pauseNotifiedRef.current = false;
    } catch (error) {
      resetVoiceUi('error');
      setVoiceError(
        error instanceof Error
          ? error.message === copy.noSpeechCaptured
            ? copy.unclearVoice
            : error.message
          : copy.noSpeechCaptured
      );
    }
  }, [
    clearRecordingInterval,
    copy.noAudio,
    copy.noSpeechCaptured,
    copy.unclearVoice,
    finalizeRecording,
    resumeAmbienceAfterRecording,
    resetVoiceUi,
    stopRecordingStream,
    uploadRecording,
  ]);

  const startRecording = useCallback(async () => {
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      resetVoiceUi('error');
      setVoiceError(copy.unsupportedRecording);
      return;
    }

    const AudioCtor = window.AudioContext || (window as typeof window & {
      webkitAudioContext?: AudioContextCtor;
    }).webkitAudioContext;
    if (!AudioCtor) {
      resetVoiceUi('error');
      setVoiceError(copy.unsupportedAudio);
      return;
    }

    try {
      pauseAmbienceForRecording();

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      const audioContext = new AudioCtor();
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      const monitorGain = audioContext.createGain();
      monitorGain.gain.value = 0;

      audioChunksRef.current = [];
      sampleRateRef.current = audioContext.sampleRate;
      recordingStartedAtRef.current = Date.now();

      processor.onaudioprocess = (event) => {
        const inputData = event.inputBuffer.getChannelData(0);
        audioChunksRef.current.push(new Float32Array(inputData));
      };

      source.connect(processor);
      processor.connect(monitorGain);
      monitorGain.connect(audioContext.destination);

      streamRef.current = stream;
      audioContextRef.current = audioContext;
      sourceRef.current = source;
      processorRef.current = processor;
      monitorGainRef.current = monitorGain;

      resetVoiceUi('recording');
      setVoiceError(null);

      recordingIntervalRef.current = setInterval(() => {
        const startedAt = recordingStartedAtRef.current;
        if (!startedAt) {
          return;
        }

        const duration = Date.now() - startedAt;
        setRecordingDurationMs(duration);
        setRecordingLimitReached(duration >= RECORDING_WARNING_MS);
      }, 250);
    } catch (error) {
      resumeAmbienceAfterRecording();
      resetVoiceUi('error');
      setVoiceError(
        error instanceof Error && error.name === 'NotAllowedError'
          ? copy.micPermissionDenied
          : copy.recordingStartFailed
      );
    }
  }, [
    copy.micPermissionDenied,
    copy.recordingStartFailed,
    copy.unsupportedAudio,
    copy.unsupportedRecording,
    pauseAmbienceForRecording,
    resetVoiceUi,
    resumeAmbienceAfterRecording,
  ]);

  const handleToggleRecording = useCallback(async () => {
    if (voiceState === 'transcribing') {
      return;
    }

    if (voiceState === 'recording') {
      await stopRecording();
      return;
    }

    await startRecording();
  }, [startRecording, stopRecording, voiceState]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrentTime(CLOCK_FORMATTER.format(new Date()));
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const audio = ambienceAudioRef.current;

    if (!audio) {
      return;
    }

    audio.volume = 0.34;
    audio.muted = isAmbientMuted;

    const tryPlay = () => {
      if (voiceStateRef.current === 'recording' || isAmbientMuted) {
        return;
      }
      void audio.play().catch(() => undefined);
    };

    let isLoopSeeking = false;
    const handleTimeUpdate = () => {
      if (isLoopSeeking || !Number.isFinite(audio.duration)) {
        return;
      }

      if (
        audio.duration > AMBIENCE_LOOP_START_SECONDS &&
        audio.currentTime >= audio.duration - AMBIENCE_LOOP_END_BUFFER_SECONDS
      ) {
        isLoopSeeking = true;
        audio.currentTime = AMBIENCE_LOOP_START_SECONDS;
        void audio.play()
          .catch(() => undefined)
          .finally(() => {
            isLoopSeeking = false;
          });
      }
    };

    tryPlay();

    const resumeAudio = () => {
      if (!isAmbientMuted && voiceStateRef.current !== 'recording' && audio.paused) {
        tryPlay();
      }
    };

    window.addEventListener('pointerdown', resumeAudio, { passive: true });
    window.addEventListener('mousemove', resumeAudio, { passive: true });
    window.addEventListener('keydown', resumeAudio);
    window.addEventListener('touchstart', resumeAudio, { passive: true });
    audio.addEventListener('timeupdate', handleTimeUpdate);

    return () => {
      window.removeEventListener('pointerdown', resumeAudio);
      window.removeEventListener('mousemove', resumeAudio);
      window.removeEventListener('keydown', resumeAudio);
      window.removeEventListener('touchstart', resumeAudio);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [isAmbientMuted]);

  const handleToggleAmbientMute = useCallback(() => {
    const ambienceAudio = ambienceAudioRef.current;

    setIsAmbientMuted((prev) => {
      const next = !prev;

      if (ambienceAudio) {
        ambienceAudio.muted = next;

        if (next) {
          ambienceAudio.pause();
        } else if (selectedLanguage && voiceStateRef.current !== 'recording') {
          void ambienceAudio.play().catch(() => undefined);
        }
      }

      return next;
    });
  }, [selectedLanguage]);

  const handleChooseLanguage = useCallback((language: OutputLanguage) => {
    setSelectedLanguage(language);
  }, []);

  const generateId = () => `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const handlePause = useCallback(async () => {
    if (pauseNotifiedRef.current) {
      return;
    }

    pauseNotifiedRef.current = true;

    try {
      await fetch('/api/chat/v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [],
          action: 'pause',
          language: selectedLanguage || 'zh',
        }),
      });
    } catch (error) {
      console.error('Failed to send pause signal:', error);
    }
  }, [selectedLanguage]);

  const handleChangeInput = useCallback((text: string) => {
    setInputValue(text);
  }, []);

  const handleSendMessage = useCallback(async () => {
    const trimmed = inputValue.trim();
    if (!trimmed) {
      return;
    }

    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: trimmed,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    pauseNotifiedRef.current = false;
    setIsLoading(true);
    setStatus('thinking');

    try {
      abortControllerRef.current = new AbortController();

      const messageHistory = [...messages, userMessage].map((msg) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp,
      }));

      const response = await fetch('/api/chat/v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messageHistory,
          action: 'send',
          language: selectedLanguage || 'zh',
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No reader available');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) {
            continue;
          }

          const data = line.slice(6);
          if (data === '[DONE]') {
            break;
          }

          try {
            const event: SSEEvent = JSON.parse(data);

            switch (event.type) {
              case 'status':
                if (event.status) {
                  setStatus(event.status);
                }
                break;

              case 'message':
                if (event.content) {
                  const newMessage: ChatMessage = {
                    id: event.messageId || generateId(),
                    role: 'assistant',
                    content: event.content,
                    emoji: event.emoji,
                    timestamp: Date.now(),
                  };
                  setMessages((prev) => [...prev, newMessage]);
                }
                break;

              case 'planner':
                break;

              case 'done':
                break;

              case 'error':
                throw new Error(event.message || 'Stream error');
            }
          } catch (e) {
            if (e instanceof Error && e.message !== 'Stream error') {
              console.warn('Failed to parse event:', data);
            } else if (e instanceof Error) {
              throw e;
            }
          }
        }
      }
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Request aborted');
      } else {
        console.error('Error:', error);
        const errorMessage: ChatMessage = {
          id: generateId(),
          role: 'assistant',
          content: copy.genericError,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      }
    } finally {
      setIsLoading(false);
      setStatus(null);
      abortControllerRef.current = null;
    }
  }, [copy.genericError, inputValue, messages, selectedLanguage]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      clearRecordingInterval();
      stopRecordingStream();
    };
  }, [clearRecordingInterval, stopRecordingStream]);

  const getStatusText = () => {
    switch (status) {
      case 'thinking':
        return copy.thinking;
      case 'loading':
        return copy.loading;
      case 'emitting':
        return copy.emitting;
      case 'paused':
        return copy.paused;
      default:
        return null;
    }
  };

  const statusText = getStatusText();

  return (
    <main className="scene-shell">
      <div className="scene-video-layer" aria-hidden="true">
        <video
          className="scene-video"
          autoPlay
          muted
          loop
          playsInline
          poster="/scene-reference.png"
        >
          <source src="/scene-background.mp4" type="video/mp4" />
        </video>
        <audio ref={ambienceAudioRef} autoPlay playsInline preload="auto">
          <source src="/scene-ambience.mp3" type="audio/mpeg" />
        </audio>
        <div className="scene-overlay" />
      </div>

      <div className="scene-brand">
        <span className="scene-brand-mark">Focus Chat</span>
        <span className="scene-brand-sub">{copy.brandSub}</span>
      </div>

      {!selectedLanguage && (
        <div className="intro-screen">
          <div className="intro-panel">
            <div className="intro-loader" aria-hidden="true" />
            <p className="intro-eyebrow">{copy.chooseLanguage}</p>
            <h2 className="intro-title">Night Window</h2>
            <div className="intro-language-row">
              <button
                type="button"
                className="intro-language-button"
                onClick={() => handleChooseLanguage('en')}
              >
                EN
              </button>
              <button
                type="button"
                className="intro-language-button"
                onClick={() => handleChooseLanguage('zh')}
              >
                中
              </button>
            </div>
            <button
              type="button"
              className="intro-audio-toggle"
              onClick={handleToggleAmbientMute}
              aria-label={isAmbientMuted ? 'Unmute ambience' : 'Mute ambience'}
            >
              {isAmbientMuted ? '🔇' : '🎧'}
            </button>
          </div>
        </div>
      )}

      <section className="chat-stage">
        <div className="chat-stage-glow" aria-hidden="true" />
        <div className="chat-stage-panel">
          <div className="sticky top-0 z-10 border-b border-white/45 bg-white/82 px-5 py-4 backdrop-blur-md">
            <div className="mx-auto max-w-3xl">
              <h1 className="text-center text-[15px] font-semibold tracking-[0.24em] text-slate-600 uppercase">
                {currentTime}
              </h1>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 md:px-7">
            <div className="mx-auto flex max-w-3xl flex-col gap-2">
              {messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}
              {isLoading && status === 'thinking' && (
                <TypingIndicator />
              )}
              {statusText && (
                <div className="py-2 text-center text-sm text-slate-500">
                  {statusText}
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          <MessageInput
            value={inputValue}
            onChangeText={handleChangeInput}
            onSendMessage={handleSendMessage}
            onInput={handlePause}
            onToggleRecording={handleToggleRecording}
            disabled={false}
            placeholder={copy.placeholder}
            sendLabel={copy.send}
            voiceLabel={copy.voice}
            stopLabel={copy.stop}
            transcribingLabel={copy.transcribing}
            recordingLabel={copy.recording}
            voiceState={voiceState}
            voiceError={voiceError}
            recordingDurationMs={recordingDurationMs}
            recordingLimitReached={recordingLimitReached}
          />
        </div>
      </section>
    </main>
  );
}
