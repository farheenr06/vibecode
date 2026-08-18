import type { TimelineStep } from '../hooks/useAgentStream';

const DOT: Record<TimelineStep['status'], string> = {
  pending: 'bg-deck-600',
  running: 'bg-signal-teal animate-pulse_dot',
  completed: 'bg-signal-violet',
  failed: 'bg-signal-rose',
};

const TEXT: Record<TimelineStep['status'], string> = {
  pending: 'text-slate-600',
  running: 'text-signal-teal',
  completed: 'text-slate-200',
  failed: 'text-signal-rose',
};

export default function Timeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <div className="rounded-xl border border-deck-border bg-deck-900/60 px-5 py-4">
      <h3 className="font-mono text-xs tracking-widest uppercase text-slate-500 mb-4">Live Agent Trace</h3>
      <ol>
        {steps.map((step, i) => (
          <li key={step.key} className="relative pl-6 pb-5 last:pb-0 animate-rise_in">
            {i < steps.length - 1 && (
              <span className="absolute left-[5px] top-3 bottom-0 w-px bg-deck-border" />
            )}
            <span className={`absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full ${DOT[step.status]}`} />
            <p className={`text-sm font-medium ${TEXT[step.status]}`}>{step.label}</p>
            {step.detail && step.status !== 'pending' && (
              <p className="text-xs text-slate-500 mt-0.5">{step.detail}</p>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
