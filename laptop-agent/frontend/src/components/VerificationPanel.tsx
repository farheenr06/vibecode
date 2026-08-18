import type { VerificationEntry } from '../types';

export default function VerificationPanel({ items }: { items: VerificationEntry[] }) {
  return (
    <div className="rounded-xl border border-deck-border bg-deck-900/60 px-5 py-4">
      <h3 className="font-mono text-xs tracking-widest uppercase text-slate-500 mb-4">Live Verification</h3>
      {items.length === 0 ? (
        <p className="text-sm text-slate-600">No verification activity yet.</p>
      ) : (
        <div className="space-y-4">
          {items.map((v, i) => (
            <div key={`${v.product}-${i}`} className="animate-rise_in border-t border-deck-border pt-3 first:border-0 first:pt-0">
              <p className="text-sm font-medium text-slate-200">{v.product}</p>

              {v.conflict && (
                <p className="mt-1 text-xs text-signal-rose font-mono">
                  ⚠ conflict — ₹{v.conflict.min.toLocaleString('en-IN')} vs ₹{v.conflict.max.toLocaleString('en-IN')}
                </p>
              )}

              {v.prices.length > 0 && (
                <ul className="mt-1.5 space-y-1 font-mono text-xs text-slate-400">
                  {v.prices.map((p, idx) => (
                    <li key={idx} className="flex items-center gap-1.5">
                      <span className="text-signal-teal">✓</span> {p.host}:{' '}
                      {p.price_inr ? `₹${p.price_inr.toLocaleString('en-IN')}` : 'n/a'}
                    </li>
                  ))}
                </ul>
              )}

              {typeof v.confidence === 'number' && v.confidence > 0 && (
                <p className="mt-1.5 text-xs font-mono">
                  <span className={v.status === 'completed' ? 'text-signal-teal' : 'text-signal-amber'}>
                    {v.status === 'completed' ? 'VERIFIED' : 'UNRESOLVED'}
                  </span>{' '}
                  <span className="text-slate-500">· confidence {v.confidence}%</span>
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
