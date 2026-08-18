import type { Source } from '../types';

export default function SourcesPanel({ sources }: { sources: Source[] }) {
  return (
    <div className="rounded-xl border border-deck-border bg-deck-900/60 px-5 py-4">
      <h3 className="font-mono text-xs tracking-widest uppercase text-slate-500 mb-4">Sources Found</h3>
      {sources.length === 0 ? (
        <p className="text-sm text-slate-600">Waiting for search results…</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {sources.map((s) => (
            <li
              key={s.host}
              className="animate-rise_in flex items-center gap-1.5 rounded-full border border-deck-border
                         bg-deck-800/70 px-3 py-1.5 text-xs text-slate-300"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-signal-teal" />
              <a href={s.url} target="_blank" rel="noreferrer" className="hover:text-signal-teal">
                {s.host}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
