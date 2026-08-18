import type { TaskResult } from '../types';

export default function FinalResult({ result }: { result: TaskResult | null }) {
  if (!result) {
    return (
      <div className="rounded-xl border border-deck-border bg-deck-900/60 px-5 py-4">
        <h3 className="font-mono text-xs tracking-widest uppercase text-slate-500 mb-2">Recommendation</h3>
        <p className="text-sm text-slate-600 font-mono">Analyzing candidates…</p>
      </div>
    );
  }

  const { winner, candidates, sources_analyzed } = result;
  const best = candidates.find((c) => c.product_name === winner.product_name);

  return (
    <div className="rounded-xl border border-signal-violet/40 bg-gradient-to-b from-signal-violet/10 to-deck-900/60 px-5 py-5">
      <p className="font-mono text-xs tracking-widest uppercase text-signal-violet mb-1">🏆 Best Match</p>
      <h2 className="text-2xl font-semibold text-slate-100 animate-rise_in">{winner.product_name}</h2>
      <p className="mt-1 text-sm text-slate-400 animate-rise_in">
        Score <span className="text-signal-teal font-mono">{winner.score}/100</span> · Confidence{' '}
        <span className="text-signal-teal font-mono">{winner.confidence_percent}%</span>
      </p>

      {best && (
        <div
          className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono animate-rise_in"
          style={{ animationDelay: '80ms' }}
        >
          <Spec label="Price" value={best.price_inr ? `₹${best.price_inr.toLocaleString('en-IN')}` : '—'} />
          <Spec label="Processor" value={best.processor ?? '—'} />
          <Spec label="RAM" value={best.ram ?? '—'} />
          <Spec label="Storage" value={best.storage ?? '—'} />
        </div>
      )}

      <div className="mt-4 space-y-2 text-sm animate-rise_in" style={{ animationDelay: '160ms' }}>
        <p className="text-slate-300">
          <span className="text-slate-500">Why it was selected: </span>
          {winner.why_selected}
        </p>
        <p className="text-slate-300">
          <span className="text-slate-500">Trade-offs: </span>
          {winner.trade_offs}
        </p>
      </div>

      {best && best.sources.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2 animate-rise_in" style={{ animationDelay: '240ms' }}>
          {best.sources.map((s, i) => (
            <a
              key={i}
              href={s.url}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-deck-border bg-deck-800/70 px-3 py-1 text-xs text-slate-400 hover:text-signal-teal"
            >
              {s.host}
            </a>
          ))}
        </div>
      )}

      <p className="mt-4 text-xs text-slate-600 font-mono">{sources_analyzed} sources analyzed</p>
    </div>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-deck-800/70 border border-deck-border px-3 py-2">
      <div className="text-slate-500">{label}</div>
      <div className="text-slate-200 mt-0.5">{value}</div>
    </div>
  );
}
