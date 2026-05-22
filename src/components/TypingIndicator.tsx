'use client';

export default function TypingIndicator() {
  return (
    <div className="mb-3 flex justify-start">
      <div className="rounded-2xl rounded-bl-md border border-white/65 bg-[rgba(255,255,255,0.88)] px-4 py-3 text-slate-700 shadow-[0_10px_30px_rgba(15,23,42,0.08)] backdrop-blur-sm">
        <div className="flex space-x-1.5">
          <div className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: '0ms' }} />
          <div className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: '150ms' }} />
          <div className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}
