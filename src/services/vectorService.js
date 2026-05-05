/**
 * Vector Database Service — Qdrant Cloud + Gemini Embeddings
 * 
 * Provides:
 *  - Text embedding via Gemini text-embedding-004 (768 dimensions)
 *  - Collection management (create / ensure exists)
 *  - Document upsert (chunk → embed → store)
 *  - Semantic search (query → embed → search → return ranked results)
 *  - Local embedding cache to reduce API calls
 */

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
const QDRANT_CLOUD_URL = (import.meta.env.VITE_QDRANT_URL || '').replace(/\/+$/, '');
const QDRANT_API_KEY = import.meta.env.VITE_QDRANT_API_KEY || '';

// Use Vite proxy to bypass CORS — browser calls /qdrant-proxy/*, Vite forwards to Qdrant Cloud
const QDRANT_URL = '/qdrant-proxy';

const EMBEDDING_MODEL = 'gemini-embedding-001';
const EMBEDDING_DIM = 768;
const GEMINI_EMBED_URL = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent`;

// ─── Local embedding cache (avoids re-embedding identical text) ───
const embeddingCache = new Map();
const MAX_CACHE = 500;

// ─── Helpers ───

function qdrantHeaders() {
  // API key is injected server-side by the Vite proxy, so we only need Content-Type here
  return {
    'Content-Type': 'application/json',
  };
}

function isConfigured() {
  return !!(GEMINI_API_KEY && QDRANT_CLOUD_URL && QDRANT_API_KEY);
}

/**
 * Generate a UUID-v4-like string for Qdrant point IDs.
 */
function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ─── Embedding ───

/**
 * Embed a single text string using Gemini gemini-embedding-001.
 * Returns a Float32 array of length 768.
 */
export async function embedText(text) {
  if (!GEMINI_API_KEY) throw new Error('Gemini API key not configured for embeddings.');

  const trimmed = text.slice(0, 8000).trim();
  if (!trimmed) throw new Error('Cannot embed empty text.');

  // Check cache
  const cacheKey = trimmed.slice(0, 200);
  if (embeddingCache.has(cacheKey)) return embeddingCache.get(cacheKey);

  const response = await fetch(`${GEMINI_EMBED_URL}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: `models/${EMBEDDING_MODEL}`,
      content: { parts: [{ text: trimmed }] },
      outputDimensionality: EMBEDDING_DIM,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Embedding API error ${response.status}`);
  }

  const result = await response.json();
  const values = result?.embedding?.values;
  if (!values || !Array.isArray(values) || values.length === 0) {
    throw new Error('Unexpected embedding response shape.');
  }

  // Store in cache (evict oldest if full)
  if (embeddingCache.size >= MAX_CACHE) {
    const first = embeddingCache.keys().next().value;
    embeddingCache.delete(first);
  }
  embeddingCache.set(cacheKey, values);

  return values;
}

/**
 * Batch-embed multiple text strings. Returns array of vectors.
 * Uses sequential calls with a small delay to respect rate limits.
 */
export async function embedBatch(texts, delayMs = 200) {
  const vectors = [];
  for (let i = 0; i < texts.length; i++) {
    vectors.push(await embedText(texts[i]));
    if (i < texts.length - 1 && delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  return vectors;
}

// ─── Collection Management ───

/**
 * Ensure a Qdrant collection exists. Creates it if missing.
 */
export async function ensureCollection(collectionName) {
  if (!isConfigured()) throw new Error('Qdrant is not configured. Set VITE_QDRANT_URL and VITE_QDRANT_API_KEY.');

  // Check if exists
  const checkRes = await fetch(`${QDRANT_URL}/collections/${collectionName}`, {
    headers: qdrantHeaders(),
  });

  if (checkRes.ok) return true; // Already exists

  // Create
  const createRes = await fetch(`${QDRANT_URL}/collections/${collectionName}`, {
    method: 'PUT',
    headers: qdrantHeaders(),
    body: JSON.stringify({
      vectors: {
        size: EMBEDDING_DIM,
        distance: 'Cosine',
      },
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.json().catch(() => ({}));
    throw new Error(err?.status?.error || `Failed to create collection: ${createRes.status}`);
  }

  return true;
}

/**
 * Delete a Qdrant collection (for cleanup).
 */
export async function deleteCollection(collectionName) {
  if (!isConfigured()) return;
  await fetch(`${QDRANT_URL}/collections/${collectionName}`, {
    method: 'DELETE',
    headers: qdrantHeaders(),
  });
}

// ─── Document Operations ───

/**
 * Upsert (insert or update) points into a Qdrant collection.
 * @param {string} collectionName
 * @param {Array<{id?: string, vector: number[], payload: object}>} points
 */
export async function upsertPoints(collectionName, points) {
  if (!isConfigured()) throw new Error('Qdrant not configured.');

  const formatted = points.map((p) => ({
    id: p.id || uuid(),
    vector: p.vector,
    payload: p.payload || {},
  }));

  const res = await fetch(`${QDRANT_URL}/collections/${collectionName}/points`, {
    method: 'PUT',
    headers: qdrantHeaders(),
    body: JSON.stringify({ points: formatted }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.status?.error || `Upsert failed: ${res.status}`);
  }

  return formatted.map((p) => p.id);
}

/**
 * Semantic search — embed query text, then search Qdrant for nearest neighbors.
 * @param {string} collectionName
 * @param {string} queryText - natural language query
 * @param {number} limit - max results (default 5)
 * @param {object} [filter] - optional Qdrant filter object
 * @returns {Promise<Array<{id: string, score: number, payload: object}>>}
 */
export async function semanticSearch(collectionName, queryText, limit = 5, filter = null) {
  if (!isConfigured()) return [];

  const queryVector = await embedText(queryText);

  const body = {
    vector: queryVector,
    limit,
    with_payload: true,
  };
  if (filter) body.filter = filter;

  const res = await fetch(`${QDRANT_URL}/collections/${collectionName}/points/search`, {
    method: 'POST',
    headers: qdrantHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.warn('Qdrant search error:', err);
    return [];
  }

  const data = await res.json();
  return (data.result || []).map((r) => ({
    id: r.id,
    score: r.score,
    payload: r.payload || {},
  }));
}

// ─── Text Chunking ───

/**
 * Split text into overlapping chunks for embedding.
 * @param {string} text - full document text
 * @param {number} chunkSize - characters per chunk (default 500)
 * @param {number} overlap - overlap between chunks (default 100)
 * @returns {Array<{text: string, index: number}>}
 */
export function chunkText(text, chunkSize = 500, overlap = 100) {
  const chunks = [];
  let start = 0;
  let idx = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    const chunk = text.slice(start, end).trim();
    if (chunk.length > 20) {
      chunks.push({ text: chunk, index: idx++ });
    }
    start += chunkSize - overlap;
  }
  return chunks;
}

// ─── High-Level Pipelines ───

/**
 * Ingest a full document into Qdrant: chunk → embed → upsert.
 * @param {string} collectionName
 * @param {string} fullText - the full document text
 * @param {object} metadata - extra payload fields (e.g. { source: 'pdf', userId, fileName })
 * @param {function} [onProgress] - callback(chunksDone, totalChunks)
 * @returns {Promise<{pointIds: string[], totalChunks: number}>}
 */
export async function ingestDocument(collectionName, fullText, metadata = {}, onProgress = null) {
  await ensureCollection(collectionName);

  const chunks = chunkText(fullText);
  if (chunks.length === 0) throw new Error('No meaningful text chunks extracted.');

  const pointIds = [];
  const BATCH = 5; // Embed and upsert in batches of 5

  for (let i = 0; i < chunks.length; i += BATCH) {
    const batch = chunks.slice(i, i + BATCH);
    const vectors = await embedBatch(batch.map((c) => c.text), 150);

    const points = batch.map((chunk, j) => ({
      id: uuid(),
      vector: vectors[j],
      payload: {
        text: chunk.text,
        chunkIndex: chunk.index,
        ...metadata,
        ingestedAt: new Date().toISOString(),
      },
    }));

    const ids = await upsertPoints(collectionName, points);
    pointIds.push(...ids);

    if (onProgress) {
      onProgress(Math.min(i + BATCH, chunks.length), chunks.length);
    }
  }

  return { pointIds, totalChunks: chunks.length };
}

/**
 * RAG (Retrieval Augmented Generation) — search for relevant chunks, return as context string.
 * @param {string} collectionName
 * @param {string} query - the user's question or topic
 * @param {number} topK - how many chunks to retrieve
 * @param {object} [filter] - optional Qdrant payload filter
 * @returns {Promise<{context: string, results: Array}>}
 */
export async function retrieveContext(collectionName, query, topK = 5, filter = null) {
  const results = await semanticSearch(collectionName, query, topK, filter);

  const context = results
    .filter((r) => r.score >= 0.3) // Only reasonably relevant results
    .map((r) => r.payload.text || '')
    .filter(Boolean)
    .join('\n\n---\n\n');

  return { context, results };
}

/**
 * Store quiz knowledge (question + answer + explanation) as vectors for future retrieval.
 * @param {string} userId
 * @param {Array<{question: string, correctAnswer: string, explanation: string, topic?: string, subject?: string}>} questions
 */
export async function storeQuizKnowledge(userId, questions) {
  if (!isConfigured() || !questions?.length) return;

  const COLLECTION = 'quiz_knowledge';
  await ensureCollection(COLLECTION);

  const points = [];
  for (const q of questions) {
    const text = `Question: ${q.question}\nAnswer: ${q.correctAnswer}\nExplanation: ${q.explanation}`;
    try {
      const vector = await embedText(text);
      points.push({
        id: uuid(),
        vector,
        payload: {
          userId,
          question: q.question,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation,
          topic: q.topic || '',
          subject: q.subject || '',
          storedAt: new Date().toISOString(),
        },
      });
      // Small delay between embeddings
      await new Promise((r) => setTimeout(r, 150));
    } catch (e) {
      console.warn('Failed to embed quiz question:', e.message);
    }
  }

  if (points.length > 0) {
    await upsertPoints(COLLECTION, points);
  }
}

/**
 * Search quiz knowledge base for content related to a topic/query.
 * @param {string} query - natural language topic or question
 * @param {string} [userId] - optional filter by user
 * @param {number} [limit] - max results
 * @returns {Promise<Array<{score: number, question: string, correctAnswer: string, explanation: string, topic: string}>>}
 */
export async function searchQuizKnowledge(query, userId = null, limit = 5) {
  const filter = userId
    ? { must: [{ key: 'userId', match: { value: userId } }] }
    : null;

  const results = await semanticSearch('quiz_knowledge', query, limit, filter);

  return results.map((r) => ({
    score: r.score,
    question: r.payload.question || '',
    correctAnswer: r.payload.correctAnswer || '',
    explanation: r.payload.explanation || '',
    topic: r.payload.topic || '',
    subject: r.payload.subject || '',
  }));
}

// ─── Status Check ───

/**
 * Check if Qdrant is configured and reachable.
 * @returns {Promise<{configured: boolean, connected: boolean, error?: string}>}
 */
export async function checkVectorDbStatus() {
  if (!isConfigured()) {
    return { configured: false, connected: false, error: 'Missing VITE_QDRANT_URL or VITE_QDRANT_API_KEY' };
  }

  try {
    const res = await fetch(`${QDRANT_URL}/collections`, { headers: qdrantHeaders() });
    if (res.ok) return { configured: true, connected: true };
    return { configured: true, connected: false, error: `HTTP ${res.status}` };
  } catch (e) {
    return { configured: true, connected: false, error: e.message };
  }
}

export { isConfigured as isVectorDbConfigured, EMBEDDING_DIM };
