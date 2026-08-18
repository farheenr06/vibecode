import { useEffect, useState } from 'react';
import { useAgentStream } from './hooks/useAgentStream';
import PromptForm from './components/PromptForm';
import StatusHeader from './components/StatusHeader';
import Timeline from './components/Timeline';
import SourcesPanel from './components/SourcesPanel';
import ComparisonTable from './components/ComparisonTable';
import VerificationPanel from './components/VerificationPanel';
import FinalResult from './components/FinalResult';

export default function App() {
  const {
    task,
    connected,
    timeline,
    sources,
    candidates,
    verifications,
    startTask,
    resumeTask,
  } = useAgentStream();

  const [initialised, setInitialised] = useState(false);

  // Reconnection: if a task_id is in the URL (?task=...), resume it instead
  // of starting fresh. This is what makes a page refresh non-destructive.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('task');
    if (id) resumeTask(id).finally(() => setInitialised(true));
    else setInitialised(true);
  }, [resumeTask]);

  const handleStart = async (prompt: string) => {
    const taskId = await startTask(prompt);
    const url = new URL(window.location.href);
    url.searchParams.set('task', taskId);
    window.history.replaceState({}, '', url);
  };

  const busy = task?.status === 'running' || task?.status === 'pending';
  const showWorkspace = !!task;

  return (
    <div className="min-h-screen px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8">
          <p className="font-mono text-[11px] tracking-[0.25em] uppercase text-signal-teal/80">
            Agent Deck
          </p>
          <h1 className="mt-1 text-2xl sm:text-3xl font-semibold text-slate-100">
            Watch the agent work, live.
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Every line below is a real backend event — search calls, page fetches, and model
            calls streamed the instant they happen.
          </p>
        </header>

        <div className="mb-6">
          <PromptForm onStart={handleStart} busy={!!busy && initialised} />
        </div>

        {initialised && showWorkspace && (
          <div className="space-y-5">
            <StatusHeader
              task={task}
              sourcesCount={sources.length}
              candidatesCount={candidates.length}
              connected={connected}
            />
            <Timeline steps={timeline} />
            <SourcesPanel sources={sources} />
            <ComparisonTable candidates={candidates} />
            <VerificationPanel items={verifications} />
            <FinalResult result={task?.result ?? null} />
          </div>
        )}
      </div>
    </div>
  );
}
