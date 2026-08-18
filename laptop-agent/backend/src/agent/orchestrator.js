import { supabase } from '../supabaseClient.js';
import { agentEventBus } from '../eventBus.js';
import { EVENTS } from './eventTypes.js';
import { planTask, extractSpecs, rankAndRecommend } from './tools/llm.js';
import { webSearch } from './tools/search.js';
import { fetchPageText } from './tools/extract.js';

const PRICE_CONFLICT_THRESHOLD = 0.05; // >5% spread between sources = conflict

/**
 * Writes an event to Supabase AND pushes it to any live SSE subscribers.
 * Because the DB write happens first, a client that reconnects a moment later
 * will see this exact event when it re-fetches history — there is no
 * "fake" event that only ever existed in memory.
 */
async function emit(taskId, { type, status = 'info', message, metadata = {} }) {
  const row = {
    task_id: taskId,
    event_type: type,
    status,
    message,
    metadata,
  };

  const { data, error } = await supabase
    .from('agent_events')
    .insert(row)
    .select()
    .single();

  if (error) {
    console.error('[orchestrator] failed to persist event', error);
  }

  const event = data ?? { ...row, timestamp: new Date().toISOString() };
  agentEventBus.publish(taskId, event);
  return event;
}

async function updateTask(taskId, patch) {
  await supabase
    .from('tasks')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('task_id', taskId);
}

/** Runs the full research pipeline for a task. Fire-and-forget from the route handler. */
export async function runAgent(taskId, userPrompt) {
  try {
    await updateTask(taskId, { status: 'running', current_step: 'starting', progress: 2 });
    await emit(taskId, {
      type: EVENTS.AGENT_STARTED,
      status: 'running',
      message: 'Agent started',
      metadata: { user_prompt: userPrompt },
    });

    // ---- 1. PLAN --------------------------------------------------------
    await updateTask(taskId, { current_step: 'planning', progress: 6 });
    await emit(taskId, {
      type: EVENTS.PLANNING_STARTED,
      status: 'running',
      message: 'Understanding request and creating an execution plan...',
    });

    const plan = await planTask(userPrompt); // real Gemini call
    await emit(taskId, {
      type: EVENTS.PLAN_CREATED,
      status: 'completed',
      message: `Plan ready — ${plan.search_queries.length} search quer${plan.search_queries.length === 1 ? 'y' : 'ies'} queued`,
      metadata: { plan },
    });

    // ---- 2. SEARCH --------------------------------------------------------
    await updateTask(taskId, { current_step: 'searching', progress: 15 });
    const allResults = [];
    for (const query of plan.search_queries) {
      await emit(taskId, {
        type: EVENTS.SEARCH_STARTED,
        status: 'running',
        message: `Searching: ${query}`,
        metadata: { query },
      });

      const results = await webSearch(query, { maxResults: 6 }); // real search API call
      allResults.push(...results);

      await emit(taskId, {
        type: EVENTS.SEARCH_COMPLETED,
        status: 'completed',
        message: `Found ${results.length} relevant results for "${query}"`,
        metadata: { query, results },
      });
    }

    // de-dupe by hostname, cap how many pages we actually open
    const seen = new Set();
    const sourcesToVisit = [];
    for (const r of allResults) {
      let host;
      try {
        host = new URL(r.url).hostname.replace(/^www\./, '');
      } catch {
        continue;
      }
      if (seen.has(host)) continue;
      seen.add(host);
      sourcesToVisit.push(r);
      if (sourcesToVisit.length >= 6) break;
    }

    await updateTask(taskId, { sources_count: sourcesToVisit.length, progress: 25 });

    // ---- 3. PARALLEL RESEARCH AGENTS (open + extract each source) --------
    // These run concurrently as independent "research agents" and each one
    // emits its own page_opened / data_extracted events the instant IT finishes,
    // in whatever order real network responses actually arrive.
    const candidates = [];
    let completedSources = 0;

    await Promise.all(
      sourcesToVisit.map(async (source, idx) => {
        const agentLabel = `Research Agent ${String.fromCharCode(65 + idx)}`;

        await emit(taskId, {
          type: EVENTS.PAGE_OPENED,
          status: 'running',
          message: `${agentLabel}: opening ${new URL(source.url).hostname}`,
          metadata: { agent: agentLabel, url: source.url },
        });

        const page = await fetchPageText(source.url); // real HTTP fetch

        if (!page.ok) {
          await emit(taskId, {
            type: EVENTS.DATA_EXTRACTED,
            status: 'failed',
            message: `${agentLabel}: couldn't load ${new URL(source.url).hostname} (${page.error})`,
            metadata: { agent: agentLabel, url: source.url, error: page.error },
          });
          return;
        }

        let specs;
        try {
          specs = await extractSpecs(page.title, source.url, page.text); // real Gemini call
        } catch (err) {
          await emit(taskId, {
            type: EVENTS.DATA_EXTRACTED,
            status: 'failed',
            message: `${agentLabel}: extraction failed for ${new URL(source.url).hostname}`,
            metadata: { agent: agentLabel, url: source.url, error: err.message },
          });
          return;
        }

        completedSources += 1;
        await updateTask(taskId, {
          progress: Math.min(60, 25 + Math.round((completedSources / sourcesToVisit.length) * 35)),
        });

        await emit(taskId, {
          type: EVENTS.DATA_EXTRACTED,
          status: 'completed',
          message: `${agentLabel}: extracted specs from ${new URL(source.url).hostname}`,
          metadata: { agent: agentLabel, url: source.url, specs },
        });

        if (specs.product_name) {
          candidates.push({ url: source.url, host: new URL(source.url).hostname, ...specs });
        }
      })
    );

    // ---- 4. COMPARISON ------------------------------------------------
    await updateTask(taskId, {
      current_step: 'comparing',
      candidates_count: candidates.length,
      progress: 65,
    });
    await emit(taskId, {
      type: EVENTS.COMPARISON_STARTED,
      status: 'running',
      message: `Comparing ${candidates.length} candidates...`,
    });

    // group candidates that are plausibly the same product across sources
    const groups = groupByProduct(candidates);
    for (const group of groups) {
      await emit(taskId, {
        type: EVENTS.COMPARISON_UPDATED,
        status: 'running',
        message: `Added ${group.product_name} to comparison table`,
        metadata: { candidate: summarizeGroup(group) },
      });
    }

    // ---- 5. VERIFICATION (price cross-check per group) -----------------
    await updateTask(taskId, { current_step: 'verifying', progress: 75 });
    await emit(taskId, {
      type: EVENTS.VERIFICATION_STARTED,
      status: 'running',
      message: 'Verifying prices across sources...',
    });

    for (const group of groups) {
      const prices = group.sources.map((s) => s.price_inr).filter((p) => typeof p === 'number');
      if (prices.length < 2) continue;

      const min = Math.min(...prices);
      const max = Math.max(...prices);
      const spread = min > 0 ? (max - min) / min : 0;

      if (spread > PRICE_CONFLICT_THRESHOLD) {
        await emit(taskId, {
          type: EVENTS.CONFLICT_DETECTED,
          status: 'failed',
          message: `Price conflict for ${group.product_name}: ₹${min} vs ₹${max}`,
          metadata: { product: group.product_name, min, max },
        });

        await emit(taskId, {
          type: EVENTS.RETRY_STARTED,
          status: 'running',
          message: `Searching an additional source to resolve ${group.product_name} pricing...`,
        });

        try {
          const tiebreak = await webSearch(`${group.product_name} price India`, { maxResults: 3 });
          const extra = tiebreak.find((r) => !group.sources.some((s) => s.url === r.url));
          if (extra) {
            const page = await fetchPageText(extra.url);
            if (page.ok) {
              const specs = await extractSpecs(page.title, extra.url, page.text);
              if (typeof specs.price_inr === 'number') {
                group.sources.push({ url: extra.url, host: new URL(extra.url).hostname, price_inr: specs.price_inr });
              }
            }
          }
        } catch (err) {
          console.error('[orchestrator] tie-break search failed', err.message);
        }
      }

      const finalPrices = group.sources.map((s) => s.price_inr).filter((p) => typeof p === 'number');
      const finalSpread = finalPrices.length > 1
        ? (Math.max(...finalPrices) - Math.min(...finalPrices)) / Math.min(...finalPrices)
        : 0;
      const confidence = Math.max(50, Math.round((1 - finalSpread) * 100));

      await emit(taskId, {
        type: EVENTS.VERIFICATION_COMPLETED,
        status: finalSpread > PRICE_CONFLICT_THRESHOLD ? 'failed' : 'completed',
        message: `${group.product_name}: price ${finalSpread > PRICE_CONFLICT_THRESHOLD ? 'still unresolved' : 'verified'} (${confidence}% confidence)`,
        metadata: {
          product: group.product_name,
          prices: group.sources.map((s) => ({ host: s.host, price_inr: s.price_inr })),
          confidence,
        },
      });
    }

    // ---- 6. DECISION -----------------------------------------------------
    await updateTask(taskId, { current_step: 'deciding', progress: 90 });
    await emit(taskId, {
      type: EVENTS.DECISION_STARTED,
      status: 'running',
      message: 'Ranking candidates and generating final recommendation...',
    });

    const decision = await rankAndRecommend(
      userPrompt,
      groups.map(summarizeGroup)
    ); // real Gemini call

    await emit(taskId, {
      type: EVENTS.RECOMMENDATION_GENERATED,
      status: 'completed',
      message: `Best match: ${decision.winner.product_name} (${decision.winner.score}/100)`,
      metadata: { decision },
    });

    // ---- 7. DONE -----------------------------------------------------
    const result = {
      winner: decision.winner,
      ranked: decision.ranked,
      candidates: groups.map(summarizeGroup),
      sources_analyzed: sourcesToVisit.length,
    };

    await updateTask(taskId, {
      status: 'completed',
      current_step: 'done',
      progress: 100,
      result,
      completed_at: new Date().toISOString(),
    });

    await emit(taskId, {
      type: EVENTS.AGENT_COMPLETED,
      status: 'completed',
      message: 'Mission complete',
      metadata: { result },
    });
  } catch (err) {
    console.error('[orchestrator] agent failed', err);
    await updateTask(taskId, { status: 'failed', current_step: 'error' });
    await emit(taskId, {
      type: EVENTS.AGENT_ERROR,
      status: 'failed',
      message: `Agent error: ${err.message}`,
      metadata: { error: err.message },
    });
  }
}

/** Groups extracted candidates that look like the same product across different sites. */
function groupByProduct(candidates) {
  const groups = [];
  for (const c of candidates) {
    const key = normalize(c.product_name);
    let group = groups.find((g) => normalize(g.product_name).includes(key) || key.includes(normalize(g.product_name)));
    if (!group) {
      group = { product_name: c.product_name, sources: [] };
      groups.push(group);
    }
    group.sources.push(c);
  }
  return groups;
}

function normalize(s = '') {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').slice(0, 3).join(' ');
}

function summarizeGroup(group) {
  const best = group.sources.find((s) => s.price_inr) || group.sources[0] || {};
  const prices = group.sources.map((s) => s.price_inr).filter((p) => typeof p === 'number');
  return {
    product_name: group.product_name,
    price_inr: prices.length ? Math.min(...prices) : null,
    processor: best.processor ?? null,
    ram: best.ram ?? null,
    storage: best.storage ?? null,
    display: best.display ?? null,
    battery: best.battery ?? null,
    weight: best.weight ?? null,
    sources: group.sources.map((s) => ({ host: s.host, url: s.url, price_inr: s.price_inr ?? null })),
  };
}
