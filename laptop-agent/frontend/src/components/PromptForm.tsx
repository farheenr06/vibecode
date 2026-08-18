import { useState } from 'react';

export default function PromptForm({
  onStart,
  busy,
}: {
  onStart: (prompt: string) => void;
  busy: boolean;
}) {
  const [value, setValue] = useState('Find me the best laptop for coding under ₹70,000');

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim() && !busy) onStart(value.trim());
      }}
      className="flex flex-col sm:flex-row gap-3"
    >
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="What should the agent research?"
        className="flex-1 bg-deck-800 border border-deck-border rounded-lg px-4 py-3 text-sm
                   text-slate-100 placeholder:text-slate-500 outline-none focus:border-signal-teal/60
                   focus:ring-1 focus:ring-signal-teal/40 transition"
      />
      <button
        type="submit"
        disabled={busy}
        className="shrink-0 rounded-lg px-5 py-3 text-sm font-medium bg-signal-teal text-deck-950
                   hover:brightness-110 active:brightness-95 disabled:opacity-40 disabled:cursor-not-allowed
                   transition"
      >
        {busy ? 'Agent running…' : 'Start Agent'}
      </button>
    </form>
  );
}
