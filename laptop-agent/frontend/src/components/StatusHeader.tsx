import type { Task } from '../types';

function elapsed(createdAt?: string, completedAt?: string | null) {
  if (!createdAt) return '00:00';
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  const secs = Math.max(0, Math.floor((end - new Date(createdAt).getTime()) / 1000));
  const m = String(Math.floor(secs / 60)).padStart(2, '0');
  const s = String(secs % 60).padStart(2, '0');
  return `${m}:${s}`;
}

export default function StatusHeader({
  task,
  sourcesCount,
  candidatesCount,
  connected,
}: {
  task: Task | null;
  sourcesCount: number;
  candidatesCount: number;
  connected: boolean;
}) {
  if (!task) {
    return (
      <div className="rounded-xl border border-deck-border bg-deck-900/60 px-5 py-4 text-sm text-slate-500">
        No mission running yet — enter a request below to launch the agent.
      </div>
    );
  }

  const done = task.status === 'completed';
  const failed = task.status === 'failed';

  return (
    <div className="rounded-xl border border-deck-border bg-deck-900/60 px-5 py-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <span
            className={`h-2.5 w-2.5 rounded-full ${
              failed ? 'bg-signal-rose' : done ? 'bg-signal-violet' : 'bg-signal-teal animate-pulse_dot'
            }`}
          />
          <span className="font-mono text-xs tracking-widest uppercase text-slate-400">
            {failed ? 'Mission Failed' : done ? 'Mission Complete' : 'Agent Active'}
          </span>
          {!connected && !done && (
            <span className="text-[10px] font-mono text-signal-amber ml-1">reconnecting…</span>
          )}
        </div>
        <span className="font-mono text-xs text-slate-500">
          Elapsed {elapsed(task.created_at, task.completed_at)}
        </span>
      </div>

      <p className="mt-2 text-sm text-slate-300">
        <span className="text-slate-500">Mission:</span> {task.user_prompt}
      </p>
      <p className="mt-1 text-sm text-slate-300">
        <span className="text-slate-500">Current action:</span>{' '}
        {task.current_step ? task.current_step.replace(/_/g, ' ') : '—'}
      </p>

      <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
        <Stat label="Progress" value={`${task.progress}%`} />
        <Stat label="Sources" value={sourcesCount} />
        <Stat label="Candidates" value={candidatesCount} />
        <Stat label="Status" value={task.status} />
      </div>

      <div className="mt-3 h-1.5 w-full rounded-full bg-deck-800 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            failed ? 'bg-signal-rose' : 'bg-signal-teal'
          }`}
          style={{ width: `${task.progress}%` }}
        />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-deck-800/70 border border-deck-border px-3 py-2">
      <div className="text-slate-500">{label}</div>
      <div className="text-slate-200 mt-0.5">{value}</div>
    </div>
  );
}
