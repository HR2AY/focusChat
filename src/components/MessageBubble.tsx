'use client';

import { ChatMessage } from '@/types';

interface MessageBubbleProps {
  message: ChatMessage;
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`mb-3 flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[78%] rounded-[1.35rem] px-4 py-2.5 shadow-[0_10px_30px_rgba(15,23,42,0.08)] backdrop-blur-sm ${
          isUser
            ? 'rounded-br-md bg-[rgba(187,255,116,0.92)] text-slate-900'
            : 'rounded-bl-md border border-white/65 bg-[rgba(255,255,255,0.88)] text-slate-700'
        }`}
      >
        <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">
          {message.content}
        </p>
      </div>
    </div>
  );
}
