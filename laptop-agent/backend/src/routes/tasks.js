import { Router } from 'express';
import { supabase } from '../supabaseClient.js';
import { agentEventBus } from '../eventBus.js';
import { runAgent } from '../agent/orchestrator.js';

export const tasksRouter = Router();

/** POST /api/tasks — create a task row and kick off the agent (fire-and-forget). */
tasksRouter.post('/', async (req, res) => {
  const { prompt } = req.body || {};
  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({ error: 'prompt is required' });
  }

  const { data: task, error } = await supabase
    .from('tasks')
    .insert({ user_prompt: prompt.trim(), status: 'pending' })
    .select()
    .single();

  if (error) {
    console.error('[tasks] failed to create task', error);
    return res.status(500).json({ error: 'failed to create task' });
  }

  // Don't await — the HTTP response returns immediately with the task_id,
  // and progress streams over SSE as the orchestrator actually does the work.
  runAgent(task.task_id, task.user_prompt);

  res.status(201).json({ task });
});

/** GET /api/tasks/:id — current task row, for reconnection / initial page load. */
tasksRouter.get('/:id', async (req, res) => {
  const { data: task, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('task_id', req.params.id)
    .single();

  if (error || !task) return res.status(404).json({ error: 'task not found' });
  res.json({ task });
});

/** GET /api/tasks/:id/events — full event history, optionally after a given event_id. */
tasksRouter.get('/:id/events', async (req, res) => {
  const since = Number(req.query.since_event_id) || 0;

  let query = supabase
    .from('agent_events')
    .select('*')
    .eq('task_id', req.params.id)
    .order('event_id', { ascending: true });

  if (since > 0) query = query.gt('event_id', since);

  const { data: events, error } = await query;
  if (error) return res.status(500).json({ error: 'failed to load events' });
  res.json({ events });
});

/**
 * GET /api/tasks/:id/stream — Server-Sent Events.
 *
 * Reconnection: the client passes ?since_event_id=<last seen id>. We first
 * replay anything already persisted in Supabase after that id (so nothing is
 * lost if the browser was offline), THEN subscribe to the live in-memory bus
 * for everything that happens from this moment on. The task is never
 * restarted — the orchestrator keeps running server-side regardless of
 * whether anyone is watching.
 */
tasksRouter.get('/:id/stream', async (req, res) => {
  const taskId = req.params.id;
  const sinceEventId = Number(req.query.since_event_id) || 0;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders?.();

  const send = (event) => {
    res.write(`id: ${event.event_id ?? ''}\n`);
    res.write(`event: agent_event\n`);
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  // 1. Replay missed history from Supabase (covers reconnects & late subscribers).
  const { data: missed } = await supabase
    .from('agent_events')
    .select('*')
    .eq('task_id', taskId)
    .gt('event_id', sinceEventId)
    .order('event_id', { ascending: true });

  for (const event of missed || []) send(event);

  // 2. Live subscribe for anything emitted from here on.
  const unsubscribe = agentEventBus.subscribe(taskId, send);

  // Heartbeat keeps proxies/load balancers from timing out an idle connection.
  const heartbeat = setInterval(() => res.write(': ping\n\n'), 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
    agentEventBus.cleanup(taskId);
  });
});
