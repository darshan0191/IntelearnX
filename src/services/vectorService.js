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

/**
 * Simple hash for cache keys — avoids collisions from slicing first N chars.
 */
function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return `h_${h}_${str.length}`;
}

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

// ─── Text Preprocessing ───

/**
 * Clean and normalize text before embedding or storing.
 * Improves vector quality by removing noise and standardizing format.
 */
export function cleanTextForEmbedding(text) {
  if (!text) return '';
  let t = text;

  // Fix broken hyphenated words (common in PDFs)
  t = t.replace(/(\w)-\s*\n\s*(\w)/g, '$1$2');

  // Normalize whitespace: collapse multiple spaces, trim lines
  t = t.replace(/[ \t]+/g, ' ');
  t = t.replace(/\n\s*\n/g, '\n\n');

  // Fix missing spaces after punctuation
  t = t.replace(/([.!?;:,])([A-Z])/g, '$1 $2');

  // Fix duplicate punctuation
  t = t.replace(/([.!?])\1+/g, '$1');

  // Fix spaces before punctuation
  t = t.replace(/\s+([.!?,;:)])/g, '$1');

  // Normalize quotes (smart quotes → straight quotes)
  t = t.replace(/[\u201C\u201D\u00AB\u00BB]/g, '"');
  t = t.replace(/[\u2018\u2019\u2032\u2035]/g, "'");

  // Remove stray non-printable characters
  t = t.replace(/[^\x20-\x7E\n\r\t\u00A0-\u024F\u0370-\u03FF\u2000-\u22FF]/g, '');

  return t.trim();
}

/**
 * Expand a user query into semantic variants for multi-query search.
 * Returns the original + reformulated queries to improve recall.
 */
function expandQuery(query) {
  const q = query.trim();
  const variants = [q];

  // Add a question-form variant if not already a question
  if (!q.endsWith('?')) {
    variants.push(`What is ${q}?`);
  }

  // Add a definition-form variant
  if (!q.toLowerCase().startsWith('define') && !q.toLowerCase().startsWith('what is')) {
    variants.push(`${q} definition and explanation`);
  }

  // Add a keyword-focused variant (strip common words)
  const stopWords = new Set(['what', 'is', 'the', 'a', 'an', 'of', 'in', 'for', 'to', 'and', 'or', 'how', 'does', 'do', 'can', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'this', 'that', 'these', 'those', 'with', 'from', 'about', 'which', 'when', 'where', 'why', 'explain', 'describe', 'tell', 'me']);
  const keywords = q.toLowerCase().split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w));
  if (keywords.length >= 2) {
    variants.push(keywords.join(' '));
  }

  return variants.slice(0, 3); // Max 3 variants to avoid too many API calls
}

/**
 * Deduplicate search results by detecting overlapping text content.
 * Keeps the higher-scored result when two chunks overlap significantly.
 */
function deduplicateResults(results, overlapThreshold = 0.6) {
  if (results.length <= 1) return results;

  const unique = [];
  const usedTexts = [];

  for (const r of results) {
    const text = (r.payload?.text || '').toLowerCase().replace(/\s+/g, ' ').trim();
    if (!text || text.length < 20) continue;

    // Check if this text significantly overlaps with any already-kept result
    let isDuplicate = false;
    for (const kept of usedTexts) {
      const overlap = computeOverlap(text, kept);
      if (overlap >= overlapThreshold) {
        isDuplicate = true;
        break;
      }
    }

    if (!isDuplicate) {
      unique.push(r);
      usedTexts.push(text);
    }
  }

  return unique;
}

/**
 * Compute the ratio of overlapping words between two texts.
 */
function computeOverlap(textA, textB) {
  const wordsA = new Set(textA.split(/\s+/).filter(w => w.length > 3));
  const wordsB = new Set(textB.split(/\s+/).filter(w => w.length > 3));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let intersect = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) intersect++;
  }

  const smaller = Math.min(wordsA.size, wordsB.size);
  return intersect / smaller;
}

// ─── Embedding ───

/**
 * Embed a single text string using Gemini gemini-embedding-001.
 * Returns a Float32 array of length 768.
 */
export async function embedText(text) {
  if (!GEMINI_API_KEY) throw new Error('Gemini API key not configured for embeddings.');

  // Clean and normalize whitespace before embedding for consistency
  const trimmed = cleanTextForEmbedding(text).slice(0, 8000).replace(/\s+/g, ' ').trim();
  if (!trimmed) throw new Error('Cannot embed empty text.');

  // Check cache using hash to avoid collisions
  const cacheKey = hashString(trimmed);
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

  if (checkRes.ok) {
    // Already exists. We don't need to recreate.
    return true;
  }

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

  // Create necessary indexes for adjacent chunk retrieval
  await fetch(`${QDRANT_URL}/collections/${collectionName}/index`, {
    method: 'PUT', headers: qdrantHeaders(),
    body: JSON.stringify({ field_name: 'chunkIndex', field_schema: 'integer' }),
  }).catch(() => {});
  
  await fetch(`${QDRANT_URL}/collections/${collectionName}/index`, {
    method: 'PUT', headers: qdrantHeaders(),
    body: JSON.stringify({ field_name: 'fileName', field_schema: 'keyword' }),
  }).catch(() => {});

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
export async function semanticSearch(collectionName, queryText, limit = 5, filter = null, scoreThreshold = 0.35) {
  if (!isConfigured()) return [];

  const queryVector = await embedText(queryText);

  const body = {
    vector: queryVector,
    limit,
    with_payload: true,
    score_threshold: scoreThreshold,  // Filter out low-relevance noise at DB level
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
 * Split text into paragraph-aware, overlapping chunks for embedding.
 * Preserves paragraph and sentence boundaries for more coherent context.
 *
 * Strategy:
 *  1. Split on double-newlines (paragraph boundaries)
 *  2. Merge small paragraphs together until maxChunkSize is reached
 *  3. If a single paragraph exceeds maxChunkSize, split at sentence boundaries
 *  4. Add overlap from the previous chunk's tail for continuity
 *
 * @param {string} text - full document text
 * @param {number} maxChunkSize - max characters per chunk (default 1200)
 * @param {number} overlap - overlap characters from previous chunk (default 200)
 * @returns {Array<{text: string, index: number}>}
 */
export function chunkText(text, maxChunkSize = 1200, overlap = 200) {
  if (!text || text.trim().length < 30) return [];

  // Normalize whitespace while preserving paragraph breaks
  const normalized = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

  // Split into paragraphs (double newline)
  const rawParagraphs = normalized.split(/\n\n+/);
  const paragraphs = rawParagraphs.map(p => p.replace(/\s+/g, ' ').trim()).filter(p => p.length > 15);

  if (paragraphs.length === 0) {
    // Fallback: no clear paragraphs, use sentence-based splitting
    return splitBySentences(normalized, maxChunkSize, overlap);
  }

  const chunks = [];
  let idx = 0;
  let currentChunk = '';
  let prevTail = ''; // overlap from previous chunk

  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i];

    // If a single paragraph is larger than maxChunkSize, split it at sentences
    if (para.length > maxChunkSize) {
      // Flush current buffer first
      if (currentChunk.trim().length > 30) {
        chunks.push({ text: (prevTail ? prevTail + '\n\n' : '') + currentChunk.trim(), index: idx++ });
        prevTail = currentChunk.trim().slice(-overlap);
        currentChunk = '';
      }
      // Split the long paragraph by sentences
      const sentenceChunks = splitBySentences(para, maxChunkSize, overlap);
      for (const sc of sentenceChunks) {
        chunks.push({ text: (prevTail ? prevTail + ' ' : '') + sc.text, index: idx++ });
        prevTail = sc.text.slice(-overlap);
      }
      continue;
    }

    // Would adding this paragraph exceed the limit?
    const combined = currentChunk ? currentChunk + '\n\n' + para : para;
    if (combined.length > maxChunkSize && currentChunk.trim().length > 30) {
      // Flush the current chunk
      chunks.push({ text: (prevTail ? prevTail + '\n\n' : '') + currentChunk.trim(), index: idx++ });
      prevTail = currentChunk.trim().slice(-overlap);
      currentChunk = para;
    } else {
      currentChunk = combined;
    }
  }

  // Flush remaining
  if (currentChunk.trim().length > 30) {
    chunks.push({ text: (prevTail ? prevTail + '\n\n' : '') + currentChunk.trim(), index: idx++ });
  }

  return chunks;
}

/**
 * Fallback: split text at sentence boundaries.
 */
function splitBySentences(text, maxChunkSize, overlap) {
  // Split on sentence-ending punctuation followed by space or newline
  const sentences = text.match(/[^.!?\n]+[.!?]+[\s]*/g) || [text];
  const chunks = [];
  let current = '';
  let idx = 0;
  let prevTail = '';

  for (const sentence of sentences) {
    if ((current + sentence).length > maxChunkSize && current.length > 30) {
      chunks.push({ text: (prevTail ? prevTail + ' ' : '') + current.trim(), index: idx++ });
      prevTail = current.trim().slice(-overlap);
      current = sentence;
    } else {
      current += sentence;
    }
  }
  if (current.trim().length > 30) {
    chunks.push({ text: (prevTail ? prevTail + ' ' : '') + current.trim(), index: idx++ });
  }
  return chunks;
}

// ─── High-Level Pipelines ───

/**
 * Ingest a full document into Qdrant: clean → chunk → embed → upsert.
 * @param {string} collectionName
 * @param {string} fullText - the full document text
 * @param {object} metadata - extra payload fields (e.g. { source: 'pdf', userId, fileName })
 * @param {function} [onProgress] - callback(chunksDone, totalChunks)
 * @returns {Promise<{pointIds: string[], totalChunks: number}>}
 */
export async function ingestDocument(collectionName, fullText, metadata = {}, onProgress = null) {
  await ensureCollection(collectionName);

  // Pre-clean the full text before chunking
  const cleanedText = cleanTextForEmbedding(fullText);
  const chunks = chunkText(cleanedText);
  if (chunks.length === 0) throw new Error('No meaningful text chunks extracted.');

  const pointIds = [];
  const BATCH = 5; // Embed and upsert in batches of 5
  const totalChunks = chunks.length;

  for (let i = 0; i < chunks.length; i += BATCH) {
    const batch = chunks.slice(i, i + BATCH);
    const vectors = await embedBatch(batch.map((c) => c.text), 150);

    const points = batch.map((chunk, j) => ({
      id: uuid(),
      vector: vectors[j],
      payload: {
        text: chunk.text,
        chunkIndex: chunk.index,
        totalChunks,                     // Store total for adjacent retrieval
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

  return { pointIds, totalChunks };
}

/**
 * RAG (Retrieval Augmented Generation) — multi-query search with deduplication.
 *
 * Improves accuracy over single-query search by:
 *  1. Expanding the user query into semantic variants
 *  2. Searching each variant against Qdrant
 *  3. Merging and deduplicating results
 *  4. Fetching adjacent chunks for fuller context
 *
 * @param {string} collectionName
 * @param {string} query - the user's question or topic
 * @param {number} topK - how many chunks to retrieve
 * @param {object} [filter] - optional Qdrant payload filter
 * @returns {Promise<{context: string, results: Array}>}
 */
export async function retrieveContext(collectionName, query, options = {}) {
  const { topK = 5, filter = null, expand = true } = options;

  // Step 1: Multi-query — optionally expand the query into variants for better recall
  const queryVariants = expand ? expandQuery(query) : [query.trim()];

  // Step 2: Pre-embed variants sequentially to avoid Gemini rate limits, then search in parallel
  const vectors = [];
  for (const q of queryVariants) {
    try {
      const v = await embedText(q);
      vectors.push(v);
    } catch (e) {
      console.warn('Failed to embed variant:', q, e);
    }
  }

  const searchPromises = vectors.map(queryVector => {
    const body = {
      vector: queryVector,
      limit: topK,
      with_payload: true,
      score_threshold: 0.40,
    };
    if (filter) body.filter = filter;

    return fetch(`${QDRANT_URL}/collections/${collectionName}/points/search`, {
      method: 'POST',
      headers: qdrantHeaders(),
      body: JSON.stringify(body),
    })
    .then(r => r.ok ? r.json() : { result: [] })
    .then(data => (data.result || []).map(r => ({
      id: r.id, score: r.score, payload: r.payload || {},
    })))
    .catch(() => []);
  });

  const allResultArrays = await Promise.all(searchPromises);

  // Step 3: Merge all results, keeping the highest score for each unique ID
  const mergedMap = new Map();
  for (const results of allResultArrays) {
    for (const r of results) {
      const existing = mergedMap.get(r.id);
      if (!existing || r.score > existing.score) {
        mergedMap.set(r.id, r);
      }
    }
  }

  // Step 4: Sort by score and apply quality threshold
  let merged = Array.from(mergedMap.values())
    .filter((r) => r.score >= 0.45)
    .sort((a, b) => b.score - a.score);

  // Step 5: Deduplicate overlapping text
  merged = deduplicateResults(merged);

  // Step 6: Take top K
  merged = merged.slice(0, topK);

  // Step 7: Fetch adjacent chunks for fuller context
  const enrichedResults = await enrichWithAdjacentChunks(collectionName, merged, filter);

  const context = enrichedResults
    .map((r) => r.payload.text || '')
    .filter(Boolean)
    .join('\n\n---\n\n');

  return { context, results: enrichedResults };
}

/**
 * Fetch adjacent chunks (before/after) for results that have chunkIndex info.
 * This gives fuller paragraph context instead of partial snippets.
 */
async function enrichWithAdjacentChunks(collectionName, results, filter) {
  if (!isConfigured() || results.length === 0) return results;

  const enriched = [];

  for (const r of results) {
    const chunkIdx = r.payload?.chunkIndex;
    const totalChunks = r.payload?.totalChunks;
    const fileName = r.payload?.fileName;

    // Only attempt adjacent retrieval if we have chunk metadata
    if (chunkIdx === undefined || !fileName) {
      enriched.push(r);
      continue;
    }

    // Look for adjacent chunks (chunkIndex ± 1) from the same file
    const adjacentTexts = [r.payload.text || ''];

    try {
      // Fetch the previous chunk
      if (chunkIdx > 0) {
        const prevFilter = {
          must: [
            { key: 'fileName', match: { value: fileName } },
            { key: 'chunkIndex', match: { value: chunkIdx - 1 } },
          ],
        };
        const prevRes = await fetch(`${QDRANT_URL}/collections/${collectionName}/points/scroll`, {
          method: 'POST',
          headers: qdrantHeaders(),
          body: JSON.stringify({ filter: prevFilter, limit: 1, with_payload: true }),
        });
        if (prevRes.ok) {
          const prevData = await prevRes.json();
          const prevText = prevData?.result?.points?.[0]?.payload?.text;
          if (prevText) adjacentTexts.unshift(prevText);
        }
      }

      // Fetch the next chunk
      if (!totalChunks || chunkIdx < totalChunks - 1) {
        const nextFilter = {
          must: [
            { key: 'fileName', match: { value: fileName } },
            { key: 'chunkIndex', match: { value: chunkIdx + 1 } },
          ],
        };
        const nextRes = await fetch(`${QDRANT_URL}/collections/${collectionName}/points/scroll`, {
          method: 'POST',
          headers: qdrantHeaders(),
          body: JSON.stringify({ filter: nextFilter, limit: 1, with_payload: true }),
        });
        if (nextRes.ok) {
          const nextData = await nextRes.json();
          const nextText = nextData?.result?.points?.[0]?.payload?.text;
          if (nextText) adjacentTexts.push(nextText);
        }
      }
    } catch (e) {
      // Adjacent retrieval is best-effort; don't fail the whole search
      console.warn('Adjacent chunk retrieval failed:', e.message);
    }

    // Merge adjacent texts, deduplicating overlap regions
    const fullText = mergeAdjacentTexts(adjacentTexts);

    enriched.push({
      ...r,
      payload: {
        ...r.payload,
        text: fullText,
      },
    });
  }

  return enriched;
}

/**
 * Merge adjacent text chunks, removing overlapping regions.
 */
function mergeAdjacentTexts(texts) {
  if (texts.length <= 1) return texts[0] || '';

  let merged = texts[0];
  for (let i = 1; i < texts.length; i++) {
    const next = texts[i];
    // Find the longest overlap between the end of merged and start of next
    let bestOverlap = 0;
    const maxCheck = Math.min(merged.length, next.length, 300);
    for (let len = 20; len <= maxCheck; len++) {
      if (merged.slice(-len) === next.slice(0, len)) {
        bestOverlap = len;
      }
    }
    if (bestOverlap > 20) {
      merged += next.slice(bestOverlap);
    } else {
      merged += '\n\n' + next;
    }
  }
  return merged;
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
    // Embed the question text separately for better retrieval precision.
    // The full answer + explanation is stored in the payload for display.
    const embeddingText = q.question + (q.explanation ? ' — ' + q.explanation : '');
    const fullText = `Q: ${q.question}\nAnswer: ${q.correctAnswer}\nExplanation: ${q.explanation}`;
    try {
      const vector = await embedText(embeddingText);
      points.push({
        id: uuid(),
        vector,
        payload: {
          userId,
          text: fullText,  // Store full text for display in search results
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

  const results = await semanticSearch('quiz_knowledge', query, limit, filter, 0.40);

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
