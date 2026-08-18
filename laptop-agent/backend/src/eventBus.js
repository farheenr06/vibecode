import { EventEmitter } from 'node:events';

/**
 * One EventEmitter per task_id. SSE handlers subscribe to 'event' and get every
 * agent_events row the instant it's created — no polling. This is purely an
 * in-memory fan-out for connections that are open *right now*; the source of
 * truth is always the Supabase `agent_events` table, which is how a
 * reconnecting client recovers anything it missed.
 */
class AgentEventBus {
  constructor() {
    this.emitters = new Map();
  }

  _get(taskId) {
    if (!this.emitters.has(taskId)) {
      const emitter = new EventEmitter();
      emitter.setMaxListeners(50);
      this.emitters.set(taskId, emitter);
    }
    return this.emitters.get(taskId);
  }

  publish(taskId, event) {
    this._get(taskId).emit('event', event);
  }

  subscribe(taskId, handler) {
    const emitter = this._get(taskId);
    emitter.on('event', handler);
    return () => emitter.off('event', handler);
  }

  // Free the emitter once a task is done and no one is listening, so we don't
  // leak memory across a long-running server process.
  cleanup(taskId) {
    const emitter = this.emitters.get(taskId);
    if (emitter && emitter.listenerCount('event') === 0) {
      this.emitters.delete(taskId);
    }
  }
}

export const agentEventBus = new AgentEventBus();
