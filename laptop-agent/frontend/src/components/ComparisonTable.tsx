import type { Candidate } from '../types';

export default function ComparisonTable({ candidates }: { candidates: Candidate[] }) {
  return (
    <div className="rounded-xl border border-deck-border bg-deck-900/60 px-5 py-4 overflow-x-auto">
      <h3 className="font-mono text-xs tracking-widest uppercase text-slate-500 mb-4">Live Comparison</h3>
      <table className="w-full text-left text-sm min-w-[560px]">
        <thead>
          <tr className="text-slate-500 text-xs font-mono uppercase">
            <th className="pb-2 pr-4">Laptop</th>
            <th className="pb-2 pr-4">Price</th>
            <th className="pb-2 pr-4">Processor</th>
            <th className="pb-2 pr-4">RAM</th>
            <th className="pb-2 pr-4">Storage</th>
          </tr>
        </thead>
        <tbody>
          {candidates.length === 0 ? (
            <tr>
              <td colSpan={5} className="py-4 text-slate-600">
                — comparing as candidates arrive —
              </td>
            </tr>
          ) : (
            candidates.map((c) => (
              <tr key={c.product_name} className="border-t border-deck-border animate-rise_in">
                <td className="py-2.5 pr-4 text-slate-200 font-medium">{c.product_name}</td>
                <td className="py-2.5 pr-4 text-signal-teal">
                  {c.price_inr ? `₹${c.price_inr.toLocaleString('en-IN')}` : '—'}
                </td>
                <td className="py-2.5 pr-4 text-slate-400">{c.processor ?? '—'}</td>
                <td className="py-2.5 pr-4 text-slate-400">{c.ram ?? '—'}</td>
                <td className="py-2.5 pr-4 text-slate-400">{c.storage ?? '—'}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
