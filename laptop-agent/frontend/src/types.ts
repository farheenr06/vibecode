export type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'info';

export interface AgentEvent {
  event_id: number;
  task_id: string;
  event_type: string;
  status: StepStatus;
  message: string;
  metadata: Record<string, any>;
  timestamp: string;
}

export interface TaskResult {
  winner: {
    product_name: string;
    score: number;
    why_selected: string;
    trade_offs: string;
    confidence_percent: number;
  };
  ranked: { product_name: string; score: number; reason: string }[];
  candidates: Candidate[];
  sources_analyzed: number;
}

export interface Candidate {
  product_name: string;
  price_inr: number | null;
  processor: string | null;
  ram: string | null;
  storage: string | null;
  display: string | null;
  battery: string | null;
  weight: string | null;
  sources: { host: string; url: string; price_inr: number | null }[];
}

export interface Task {
  task_id: string;
  user_prompt: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  current_step: string | null;
  progress: number;
  sources_count: number;
  candidates_count: number;
  result: TaskResult | null;
  created_at: string;
  completed_at: string | null;
}

export interface Source {
  host: string;
  url: string;
}

export interface VerificationEntry {
  product: string;
  prices: { host: string; price_inr: number | null }[];
  confidence: number;
  status: StepStatus;
  conflict?: { min: number; max: number };
}
