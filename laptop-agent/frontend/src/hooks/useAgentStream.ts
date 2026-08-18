import { useCallback, useEffect, useRef, useState } from 'react';
import type { AgentEvent, Candidate, Source, Task, VerificationEntry } from '../types';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8787';

export interface TimelineStep {
  key: string;
  label: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  detail?: string;
}

const TIMELINE_TEMPLATE: { key: string; label: string; matches: string[] }[] = [
  { key: 'understand', label: 'Understanding request', matches: ['agent_started'] },
  { key: 'plan', label: 'Creating plan', matches: ['planning_started', 'plan_created'] },
  { key: 'search', label: 'Searching web', matches: ['search_started', 'search_completed'] },
  { key: 'open', label: 'Opening sources', matches: ['page_opened'] },
  { key: 'extract', label: 'Extracting information', matches: ['data_extracted'] },
  { key: 'compare', label: 'Comparing candidates', matches: ['comparison_started', 'comparison_updated'] },
  { key: 'verify', label: 'Verifying information', matches: ['verification_started', 'conflict_detected', 'retry_started', 'verification_completed'] },
  { key: 'decide', label: 'Making decision', matches: ['decision_started', 'recommendation_generated'] },
  { key: 'done', label: 'Final result', matches: ['agent_completed'] },
];

function lastSeenEventId(events: AgentEvent[]) {
  return events.length ? events[events.length - 1].event_id : 0;
}

export function useAgentStream() {
  const [task, setTask] = useState<Task | null>(null);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const esRef = useRef<EventSource | null>(null);
  const eventsRef = useRef<AgentEvent[]>([]);
  eventsRef.current = events;

  const connect = useCallback((taskId: string, sinceEventId = 0) => {
    esRef.current?.close();
    const es = new EventSource(
      `${API_BASE}/api/tasks/${taskId}/stream?since_event_id=${sinceEventId}`
    );
    esRef.current = es;

    es.onopen = () => setConnected(true);

    es.addEventListener('agent_event', (e) => {
      const parsed: AgentEvent = JSON.parse((e as MessageEvent).data);
      setEvents((prev) => {
        if (prev.some((p) => p.event_id === parsed.event_id)) return prev;
        return [...prev, parsed];
      });
    });

    es.onerror = () => {
      setConnected(false);
      es.close();
      // Reconnect with backoff, resuming exactly where we left off — the
      // backend replays anything persisted after since_event_id, then
      // resubscribes live. The task itself never restarts.
      setTimeout(() => {
        connect(taskId, lastSeenEventId(eventsRef.current));
      }, 1500);
    };
  }, []);

  const refreshTask = useCallback(async (taskId: string) => {
    const res = await fetch(`${API_BASE}/api/tasks/${taskId}`);
    if (res.ok) {
      const { task } = await res.json();
      setTask(task);
    }
  }, []);

  const startTask = useCallback(
    async (prompt: string) => {
      setEvents([]);
      setTask(null);
      const res = await fetch(`${API_BASE}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const { task } = await res.json();
      setTask(task);
      connect(task.task_id, 0);
      return task.task_id as string;
    },
    [connect]
  );

  const resumeTask = useCallback(
    async (taskId: string) => {
      await refreshTask(taskId);
      const res = await fetch(`${API_BASE}/api/tasks/${taskId}/events`);
      const { events: history } = await res.json();
      setEvents(history || []);
      connect(taskId, lastSeenEventId(history || []));
    },
    [connect, refreshTask]
  );

  // Poll the task row lightly so status/progress/counters stay in sync even
  // if an event write races the SSE push (belt-and-suspenders, not the
  // primary mechanism — events are).
  useEffect(() => {
    if (!task || task.status === 'completed' || task.status === 'failed') return;
    const id = setInterval(() => refreshTask(task.task_id), 4000);
    return () => clearInterval(id);
  }, [task?.task_id, task?.status, refreshTask]);

  useEffect(() => () => esRef.current?.close(), []);

  // ---- derive everything the UI needs from the raw event log ----------
  const timeline: TimelineStep[] = TIMELINE_TEMPLATE.map((t) => {
    const relevant = events.filter((e) => t.matches.includes(e.event_type));
    if (relevant.length === 0) return { key: t.key, label: t.label, status: 'pending' };
    const latest = relevant[relevant.length - 1];
    const status: TimelineStep['status'] =
      latest.status === 'failed' && t.key !== 'verify'
        ? 'failed'
        : latest.status === 'completed' || latest.status === 'info'
        ? 'completed'
        : 'running';
    return { key: t.key, label: t.label, status, detail: latest.message };
  });

  const sources: Source[] = [];
  for (const e of events) {
    if (e.event_type === 'search_completed') {
      for (const r of e.metadata?.results || []) {
        try {
          const host = new URL(r.url).hostname.replace(/^www\./, '');
          if (!sources.some((s) => s.host === host)) sources.push({ host, url: r.url });
        } catch {
          /* ignore malformed urls */
        }
      }
    }
  }

  const candidates: Candidate[] = [];
  for (const e of events) {
    if (e.event_type === 'comparison_updated' && e.metadata?.candidate) {
      const c: Candidate = e.metadata.candidate;
      const idx = candidates.findIndex((x) => x.product_name === c.product_name);
      if (idx >= 0) candidates[idx] = c;
      else candidates.push(c);
    }
  }

  const verifications: VerificationEntry[] = [];
  for (const e of events) {
    if (e.event_type === 'conflict_detected') {
      verifications.push({
        product: e.metadata.product,
        prices: [],
        confidence: 0,
        status: 'failed',
        conflict: { min: e.metadata.min, max: e.metadata.max },
      });
    }
    if (e.event_type === 'verification_completed') {
      const idx = verifications.findIndex((v) => v.product === e.metadata.product);
      const entry: VerificationEntry = {
        product: e.metadata.product,
        prices: e.metadata.prices || [],
        confidence: e.metadata.confidence,
        status: e.status,
      };
      if (idx >= 0) verifications[idx] = entry;
      else verifications.push(entry);
    }
  }

  const latestMessage = events.length ? events[events.length - 1].message : null;

  return {
    task,
    events,
    connected,
    timeline,
    sources,
    candidates,
    verifications,
    latestMessage,
    startTask,
    resumeTask,
  };
}
