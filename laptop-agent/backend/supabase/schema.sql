-- Run this in the Supabase SQL editor (or `supabase db push`) before starting the backend.

create table if not exists public.tasks (
  task_id       uuid primary key default gen_random_uuid(),
  user_prompt   text not null,
  status        text not null default 'pending', -- pending | running | completed | failed
  current_step  text,
  progress      int  not null default 0,          -- 0-100
  sources_count int  not null default 0,
  candidates_count int not null default 0,
  result        jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  completed_at  timestamptz
);

create table if not exists public.agent_events (
  event_id    bigint generated always as identity primary key,
  task_id     uuid not null references public.tasks(task_id) on delete cascade,
  event_type  text not null,
  status      text not null default 'info', -- pending | running | completed | failed | info
  message     text not null,
  metadata    jsonb not null default '{}'::jsonb,
  timestamp   timestamptz not null default now()
);

create index if not exists idx_agent_events_task_id on public.agent_events(task_id, event_id);

-- Realtime is optional (we stream via SSE from the backend), but enabling it lets you
-- also watch tasks/events update live straight from the Supabase Table Editor.
alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.agent_events;
