/**
 * Gemini Client — Centralized, rate-limited, cached API client.
 *
 * Uses Gemini 2.5 Flash (free tier) with automatic fallback to Gemini 2.5 Flash-Lite.
 *
 * Prevents 429/503 errors with:
 *  1. Global sequential queue — one request at a time
 *  2. Exponential backoff with jitter on retries
 *  3. Global cooldown after rate limit hit
 *  4. Response cache for identical prompts
 *  5. In-flight request deduplication
 *  6. Automatic model fallback (flash → flash-lite)
 */

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const PRIMARY_MODEL = 'gemini-2.5-flash';
const FALLBACK_MODEL = 'gemini-2.5-flash-lite';

// ─── Global State ───

/** Minimum ms between API calls */
const MIN_INTERVAL_MS = 2500;
let lastCallTime = 0;

/** Global cooldown until this timestamp (set after a 429) */
let cooldownUntil = 0;

/** In-flight request dedup map: promptHash → Promise */
const inflightRequests = new Map();

/** Response cache: promptHash → { text, timestamp } */
const responseCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 50;

/** Sequential queue to prevent parallel calls */
let queuePromise = Promise.resolve();

// ─── Helpers ───

function hashPrompt(prompt, systemPrompt) {
  const str = (systemPrompt || '') + '|' + (prompt || '');
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return String(h);
}

function jitter(baseMs) {
  return baseMs + Math.floor(Math.random() * baseMs * 0.5 - baseMs * 0.25);
}

export function isGeminiConfigured() {
  return !!GEMINI_API_KEY;
}

export function isInCooldown() {
  return Date.now() < cooldownUntil;
}

export function getCooldownRemaining() {
  const remaining = cooldownUntil - Date.now();
  return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
}

// ─── Core API Call (single attempt, one model) ───

async function _callGemini(prompt, systemPrompt, temperature, maxOutputTokens, model) {
  const url = `${GEMINI_BASE}/${model}:generateContent?key=${GEMINI_API_KEY}`;

  // Build the prompt: prepend system instruction if provided
  const fullPrompt = systemPrompt
    ? `${systemPrompt}\n\n${prompt}`
    : prompt;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: fullPrompt }] }],
      generationConfig: {
        temperature,
        maxOutputTokens,
      },
    }),
  });

  if (response.ok) {
    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Empty response from Gemini.');
    return text;
  }

  const errBody = await response.json().catch(() => ({}));
  const errMsg = errBody?.error?.message || `Gemini error ${response.status}`;

  if (response.status === 429) {
    cooldownUntil = Date.now() + 60000;
    const err = new Error('Rate limited (429). Cooling down for 60s.');
    err.status = 429;
    throw err;
  }

  if (response.status === 503) {
    const err = new Error(`Gemini overloaded (503): ${errMsg}`);
    err.status = 503;
    err.retryable = true;
    throw err;
  }

  if (response.status === 500) {
    const err = new Error(`Server error (500): ${errMsg}`);
    err.status = 500;
    err.retryable = true;
    throw err;
  }

  // Non-retryable (400, 401, 403, etc.)
  const err = new Error(errMsg);
  err.status = response.status;
  err.retryable = false;
  throw err;
}

// ─── Public API ───

/**
 * Call Gemini with full protection stack:
 *  - Global cooldown check
 *  - Response cache
 *  - In-flight deduplication
 *  - Sequential queue (one call at a time)
 *  - Exponential backoff with jitter
 *  - Automatic model fallback (flash → flash-lite)
 *
 * @param {string} prompt - The user message
 * @param {object} [opts]
 * @param {string} [opts.systemPrompt='You return ONLY valid JSON.']
 * @param {number} [opts.temperature=0.4]
 * @param {number} [opts.maxOutputTokens=4096]
 * @param {number} [opts.maxRetries=2]
 * @param {boolean} [opts.useCache=true]
 * @returns {Promise<string>} The model's reply text
 */
export async function geminiGenerate(prompt, opts = {}) {
  if (!GEMINI_API_KEY) {
    throw new Error('Gemini API key not configured. Add VITE_GEMINI_API_KEY to your .env file.');
  }

  const {
    systemPrompt = 'You return ONLY valid JSON.',
    temperature = 0.4,
    maxOutputTokens = 4096,
    maxRetries = 2,
    useCache = true,
  } = opts;

  // 1. Global cooldown check
  if (isInCooldown()) {
    const secs = getCooldownRemaining();
    throw new Error(`Gemini is rate-limited. Please wait ${secs} seconds.`);
  }

  const key = hashPrompt(prompt, systemPrompt);

  // 2. Cache check
  if (useCache) {
    const cached = responseCache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.text;
    }
  }

  // 3. Deduplication
  if (inflightRequests.has(key)) {
    return inflightRequests.get(key);
  }

  // 4. Enqueue sequentially
  const requestPromise = new Promise((resolve, reject) => {
    queuePromise = queuePromise.then(async () => {
      try {
        if (isInCooldown()) {
          throw new Error(`Gemini is rate-limited. Please wait ${getCooldownRemaining()} seconds.`);
        }

        // Rate limiting: min interval between calls
        const now = Date.now();
        const elapsed = now - lastCallTime;
        if (elapsed < MIN_INTERVAL_MS) {
          await new Promise((r) => setTimeout(r, MIN_INTERVAL_MS - elapsed));
        }

        // Try primary model, then fallback
        const models = [PRIMARY_MODEL, FALLBACK_MODEL];
        let lastError;

        for (const model of models) {
          for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
              if (isInCooldown()) {
                throw new Error(`Gemini is rate-limited. Please wait ${getCooldownRemaining()} seconds.`);
              }

              lastCallTime = Date.now();
              const text = await _callGemini(prompt, systemPrompt, temperature, maxOutputTokens, model);

              // Cache successful response
              if (useCache) {
                if (responseCache.size >= MAX_CACHE_SIZE) {
                  const oldest = responseCache.keys().next().value;
                  responseCache.delete(oldest);
                }
                responseCache.set(key, { text, timestamp: Date.now() });
              }

              resolve(text);
              return;
            } catch (e) {
              lastError = e;

              if (e.retryable === false) { reject(e); return; }
              if (e.status === 429) { reject(e); return; }

              // Retryable — backoff with jitter, then try again or fall to next model
              if (attempt < maxRetries - 1) {
                const baseDelay = Math.min(3000 * Math.pow(2, attempt), 30000);
                const delay = jitter(baseDelay);
                console.warn(`Gemini ${model} attempt ${attempt + 1} failed (${e.status || 'network'}), retrying in ${delay}ms…`);
                await new Promise((r) => setTimeout(r, delay));
              }
            }
          }
          // All retries failed for this model — try fallback
          if (model === PRIMARY_MODEL) {
            console.warn(`Primary model ${PRIMARY_MODEL} failed, trying fallback ${FALLBACK_MODEL}…`);
          }
        }

        reject(lastError || new Error('Gemini API failed after all retries.'));
      } catch (e) {
        reject(e);
      }
    });
  });

  inflightRequests.set(key, requestPromise);
  requestPromise.finally(() => inflightRequests.delete(key));

  return requestPromise;
}

/**
 * Safe version — returns null on failure instead of throwing.
 * Use for non-critical features like dashboard suggestions.
 */
export async function geminiGenerateSafe(prompt, opts = {}) {
  try {
    return await geminiGenerate(prompt, opts);
  } catch (e) {
    console.warn('Gemini call failed (safe mode):', e.message);
    return null;
  }
}

/**
 * Clear the response cache.
 */
export function clearGeminiCache() {
  responseCache.clear();
}
