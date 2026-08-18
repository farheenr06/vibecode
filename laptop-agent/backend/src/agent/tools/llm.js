import { GoogleGenAI } from '@google/genai';
import 'dotenv/config';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

function stripFences(text) {
  return text.replace(/```json|```/g, '').trim();
}

async function askJSON(prompt) {
  const result = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
    config: { responseMimeType: 'application/json' },
  });
  const text = result.text;
  try {
    return JSON.parse(stripFences(text));
  } catch (err) {
    throw new Error(`Gemini returned non-JSON output: ${text.slice(0, 200)}`);
  }
}

/** Turn the raw user prompt into a concrete plan the orchestrator can execute. */
export async function planTask(userPrompt) {
  return askJSON(`
You are the planning module of an autonomous web-research agent.
User request: "${userPrompt}"

Return ONLY JSON with this exact shape:
{
  "budget_inr": number | null,
  "category": string,
  "search_queries": string[]   // 1-3 focused web search queries that will surface real product pages
}
`);
}

/** Extract a structured product spec sheet from raw page text. */
export async function extractSpecs(pageTitle, url, rawText) {
  return askJSON(`
You are the extraction module of a web-research agent. From the raw text of this
product/listing page, pull out whatever facts are actually present. Use null for
anything not present — never invent a value.

Page title: ${pageTitle}
URL: ${url}
Raw text (truncated):
"""
${rawText.slice(0, 6000)}
"""

Return ONLY JSON with this exact shape:
{
  "product_name": string | null,
  "price_inr": number | null,
  "processor": string | null,
  "ram": string | null,
  "storage": string | null,
  "display": string | null,
  "battery": string | null,
  "weight": string | null
}
`);
}

/** Score and rank the collected candidates, and write the final recommendation. */
export async function rankAndRecommend(userPrompt, candidates) {
  return askJSON(`
You are the decision module of a web-research agent. Given the user's request and
a list of candidate products (each with data pulled from multiple live sources),
score every candidate 0-100 and pick the single best match.

User request: "${userPrompt}"
Candidates:
${JSON.stringify(candidates, null, 2)}

Return ONLY JSON with this exact shape:
{
  "ranked": [ { "product_name": string, "score": number, "reason": string } ],
  "winner": {
    "product_name": string,
    "score": number,
    "why_selected": string,
    "trade_offs": string,
    "confidence_percent": number
  }
}
`);
}
