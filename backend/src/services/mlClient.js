/**
 * HTTP client for the Python ML microservice, with a small circuit breaker.
 *
 * Design goal (graceful degradation): the ML service is an *enhancement*. Every caller must be
 * able to handle MLUnavailableError and carry on - core journaling never depends on it.
 * After FAILURE_THRESHOLD consecutive failures the breaker opens and calls fail instantly for
 * COOLDOWN_MS, so a dead ML service adds ~0 ms latency to journal writes instead of a timeout.
 */
const BASE_URL = (process.env.ML_SERVICE_URL || 'http://localhost:8000').replace(/\/$/, '');
const API_KEY = process.env.ML_SERVICE_API_KEY || '';
const DEFAULT_TIMEOUT_MS = parseInt(process.env.ML_TIMEOUT_MS || '15000', 10);
const FAILURE_THRESHOLD = parseInt(process.env.ML_BREAKER_THRESHOLD || '3', 10);
const COOLDOWN_MS = parseInt(process.env.ML_BREAKER_COOLDOWN_MS || '30000', 10);

class MLUnavailableError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'MLUnavailableError';
    this.cause = cause;
  }
}

const breaker = { failures: 0, openUntil: 0 };
const isOpen = () => Date.now() < breaker.openUntil;

function recordSuccess() {
  breaker.failures = 0;
  breaker.openUntil = 0;
}
function recordFailure() {
  breaker.failures += 1;
  if (breaker.failures >= FAILURE_THRESHOLD) {
    breaker.openUntil = Date.now() + COOLDOWN_MS;
    console.warn(`ML circuit breaker OPEN for ${COOLDOWN_MS}ms after ${breaker.failures} failures`);
  }
}

async function request(path, { method = 'POST', body, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  if (isOpen()) throw new MLUnavailableError('ML service circuit open');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(API_KEY ? { 'X-API-Key': API_KEY } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    if (res.status >= 500) throw new Error(`ML service responded ${res.status}`);
    if (!res.ok) {
      // 4xx = our request was bad; that is not an availability problem, don't trip the breaker.
      recordSuccess();
      throw new Error(`ML service rejected request (${res.status})`);
    }
    const data = await res.json();
    recordSuccess();
    return data;
  } catch (err) {
    if (err.name === 'AbortError' || err.cause || /ML service responded/.test(err.message) || err instanceof TypeError) {
      recordFailure();
      throw new MLUnavailableError(`ML service unavailable: ${err.message}`, err);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** Sentiment + embedding for one text in a single round-trip. */
const analyze = (text, timeoutMs) => request('/v1/analyze', { body: { text }, timeoutMs });
/** Embedding only (used to embed a search query). */
const embed = (texts, timeoutMs) => request('/v1/embed', { body: { texts }, timeoutMs });

async function health() {
  try {
    const data = await request('/health', { method: 'GET', timeoutMs: 2000 });
    return { reachable: true, ...data };
  } catch (err) {
    return { reachable: false, status: 'unavailable', error: err.message, breakerOpen: isOpen() };
  }
}

module.exports = { analyze, embed, health, isOpen, MLUnavailableError };
