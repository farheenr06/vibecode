import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

/**
 * Fetches a real page and reduces it to plain text for the LLM extraction step.
 * Swap this out for a Playwright-backed fetch (page.goto + page.content()) if a
 * target site is heavily JS-rendered — the rest of the pipeline doesn't change.
 */
export async function fetchPageText(url, { timeoutMs = 10_000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; ResearchAgent/1.0; +https://example.com/bot)',
        Accept: 'text/html',
      },
      redirect: 'follow',
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const html = await res.text();
    const $ = cheerio.load(html);
    $('script, style, noscript, svg, header, footer, nav').remove();

    const title = $('title').first().text().trim() || url;
    const text = $('body').text().replace(/\s+/g, ' ').trim();

    return { title, text, ok: true };
  } catch (err) {
    return { title: url, text: '', ok: false, error: err.message };
  } finally {
    clearTimeout(timer);
  }
}
