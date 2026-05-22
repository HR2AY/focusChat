'use client';

import { ChangeEvent, KeyboardEvent, useCallback, useMemo } from 'react';
import type { VoiceState } from '@/types';

interface MessageInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onSendMessage: () => void;
  onInput?: () => void;
  onToggleRecording: () => void;
  disabled?: boolean;
  voiceState: VoiceState;
  voiceError?: string | null;
  recordingDurationMs: number;
  recordingLimitReached: boolean;
  placeholder: string;
  sendLabel: string;
  voiceLabel: string;
  stopLabel: string;
  transcribingLabel: string;
  recordingLabel: (duration: string, overLimit: boolean) => string;
}

function formatDuration(durationMs: number): string {
  const totalSeconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export default function MessageInput({
  value,
  onChangeText,
  onSendMessage,
  onInput,
  onToggleRecording,
  disabled,
  voiceState,
  voiceError,
  recordingDurationMs,
  recordingLimitReached,
  placeholder,
  sendLabel,
  voiceLabel,
  stopLabel,
  transcribingLabel,
  recordingLabel,
}: MessageInputProps) {
  const handleSend = useCallback(() => {
    if (value.trim() && !disabled) {
      onSendMessage();
    }
  }, [disabled, onSendMessage, value]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    const nextValue = e.target.value;
    onChangeText(nextValue);

    if (nextValue.length > 0) {
      onInput?.();
    }
  }, [onChangeText, onInput]);

  const recordingStatusText = useMemo(() => {
    if (voiceState === 'recording') {
      const duration = formatDuration(recordingDurationMs);
      return recordingLabel(duration, recordingLimitReached);
    }

    if (voiceState === 'transcribing') {
      return transcribingLabel;
    }

    return voiceError || null;
  }, [
    recordingDurationMs,
    recordingLabel,
    recordingLimitReached,
    transcribingLabel,
    voiceError,
    voiceState,
  ]);

  const voiceButtonLabel = voiceState === 'recording' ? stopLabel : voiceLabel;
  const voiceButtonClass =
    voiceState === 'recording'
      ? 'bg-red-500 text-white hover:bg-red-600 active:bg-red-700'
      : voiceState === 'transcribing'
        ? 'bg-gray-200 text-gray-500 cursor-wait'
        : 'bg-white text-gray-700 hover:bg-gray-50 active:bg-gray-100';

  return (
    <div className="mt-auto shrink-0 border-t border-white/45 bg-[rgba(255,255,255,0.8)] px-5 py-4 backdrop-blur-md">
      <div className="mx-auto max-w-3xl space-y-3">
        {recordingStatusText && (
          <div
            className={`rounded-2xl px-3 py-2 text-[12px] leading-5 shadow-[0_10px_24px_rgba(15,23,42,0.06)] ${
              voiceState === 'error'
                ? 'border border-red-100 bg-red-50/90 text-red-600'
                : recordingLimitReached
                  ? 'border border-amber-100 bg-amber-50/90 text-amber-700'
                  : 'border border-white/70 bg-white/70 text-slate-600'
            }`}
          >
            {recordingStatusText}
          </div>
        )}

        <div className="flex items-end gap-2">
          <textarea
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            className="flex-1 resize-none rounded-[1.4rem] border border-white/70 bg-white/82 px-4 py-3 text-[15px] text-slate-700 shadow-[0_14px_40px_rgba(15,23,42,0.08)]
              focus:border-[rgba(187,255,116,0.96)] focus:outline-none focus:ring-2 focus:ring-[rgba(187,255,116,0.34)]
              disabled:opacity-50 disabled:cursor-not-allowed
              placeholder:text-slate-400"
            style={{ maxHeight: '120px' }}
          />

          <button
            type="button"
            onClick={onToggleRecording}
            disabled={disabled || voiceState === 'transcribing'}
            className={`rounded-[1.2rem] border border-white/75 px-3 py-3 text-[14px] font-medium shadow-[0_14px_40px_rgba(15,23,42,0.08)] transition-colors ${voiceButtonClass}`}
          >
            {voiceButtonLabel}
          </button>

          <button
            type="button"
            onClick={handleSend}
            disabled={!value.trim() || disabled || voiceState === 'transcribing'}
            className="rounded-[1.2rem] bg-[rgba(187,255,116,0.96)] px-4 py-3 text-[15px] font-semibold text-slate-800 shadow-[0_16px_44px_rgba(153,230,84,0.34)]
              hover:bg-[rgba(196,255,132,0.98)] active:bg-[rgba(164,227,88,0.98)]
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors"
          >
            {sendLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
