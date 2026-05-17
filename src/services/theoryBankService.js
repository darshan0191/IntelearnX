/**
 * Theory Bank Service — Multi-PDF → 100 Theory Questions
 *
 * Extracts text from up to 10 PDFs, then calls Gemini in batches
 * to generate 100 theory/descriptive questions for question banks.
 *
 * Reuses:
 *  - PDF.js CDN loader from pdfQuizService.js
 *  - geminiGenerate() from geminiaiClient.js (rate-limited, retried)
 *
 * It combines raw notes into formatted markdown and ensures
 * only domain-relevant content is stored.
 */

import { geminiGenerate, isGeminiConfigured } from './geminiaiClient';
import { validateEngineeringDomain, OUT_OF_DOMAIN_SHORT } from '../utils/engineeringDomainGuard';

// ─── PDF.js CDN (same version as pdfQuizService) ───
const PDFJS_VERSION = '3.11.174';
const PDFJS_CDN = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}`;

async function loadPdfJs() {
  if (window.pdfjsLib) return window.pdfjsLib;

  await new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `${PDFJS_CDN}/pdf.min.js`;
    script.onload = resolve;
    script.onerror = () => reject(new Error('Failed to load PDF.js from CDN.'));
    document.head.appendChild(script);
  });

  window.pdfjsLib.GlobalWorkerOptions.workerSrc = `${PDFJS_CDN}/pdf.worker.min.js`;
  return window.pdfjsLib;
}

// ─── Extract text from a single PDF ───
export async function extractTextFromPdf(file) {
  const pdfjsLib = await loadPdfJs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const textParts = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();

    let lastY = null;
    const lineGroups = [];
    let currentLine = [];

    for (const item of content.items) {
      const y = Math.round(item.transform[5]);
      if (lastY !== null && Math.abs(y - lastY) > 5) {
        if (currentLine.length > 0) lineGroups.push(currentLine.join(' ').trim());
        if (Math.abs(y - lastY) > 15) lineGroups.push('');
        currentLine = [];
      }
      if (item.str.trim()) currentLine.push(item.str);
      lastY = y;
    }
    if (currentLine.length > 0) lineGroups.push(currentLine.join(' ').trim());

    const pageText = lineGroups.filter((l) => l !== undefined).join('\n');
    if (pageText.trim()) textParts.push(pageText.trim());
  }

  return cleanText(textParts.join('\n\n'));
}

function cleanText(text) {
  if (!text) return text;
  let c = text;
  c = c.replace(/(\w)-\s*\n\s*(\w)/g, '$1$2');
  c = c.replace(/[^\x20-\x7E\n\r\t\u00A0-\u024F\u0370-\u03FF\u2000-\u206F\u2190-\u21FF\u2200-\u22FF]/g, '');
  c = c.replace(/\t/g, '  ');
  c = c.replace(/ {3,}/g, '  ');
  c = c.replace(/\n{4,}/g, '\n\n\n');
  c = c.replace(/([.!?;:,])([A-Z])/g, '$1 $2');
  c = c.replace(/^\s*(Page\s*)?\d{1,4}\s*$/gm, '');
  c = c.replace(/^\s*(©|Copyright|All rights reserved).*$/gm, '');
  return c.trim();
}

// ─── Build theory-question generation prompt ───
function buildTheoryPrompt(textChunk, batchNum, totalBatches, questionsNeeded, previousTopics = []) {
  const avoidClause =
    previousTopics.length > 0
      ? `\nAVOID REPEATING these topics that were already covered:\n${previousTopics.map((t, i) => `${i + 1}. ${t}`).join('\n')}\n`
      : '';

  return `You are an expert engineering exam paper setter. Generate exactly ${questionsNeeded} unique THEORY/DESCRIPTIVE questions from the provided study material.

This is batch ${batchNum} of ${totalBatches}. Ensure the questions are high-quality, technically accurate, and descriptive.
${avoidClause}
STRICT RULES:
1. Generate EXACTLY ${questionsNeeded} theory questions (Explain, Discuss, Derive, Compare, Analyze, etc.)
2. NO MULTIPLE CHOICE. No true/false. Only descriptive theory questions.
3. Use ONLY the provided material. Do not hallucinate.
4. VARY MARKS: Include a mix of short (2-3 marks), medium (5-6 marks), and long (10-12 marks) questions.
5. VARY DIFFICULTY: easy (recall), medium (application/understanding), and hard (analysis/synthesis).
6. Provide a concise expected answer/key points for each.
7. Return ONLY valid JSON.

REQUIRED JSON FORMAT:
{
  "questions": [
    {
      "question": "Detailed theory question...",
      "expectedAnswer": "Key points that should be in the answer...",
      "topic": "Specific Topic",
      "difficulty": "easy|medium|hard",
      "marks": 5
    }
  ]
}

STUDY MATERIAL:
${textChunk}

Generate ${questionsNeeded} theory questions now. Return ONLY JSON:`;
}

// ─── Parse LLM response ───
function parseBatchResponse(responseText) {
  let cleaned = responseText.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/g, '').replace(/\s*```$/g, '').trim();
  cleaned = cleaned.replace(/,\s*([\]}])/g, '$1');

  let data;
  try {
    data = JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        data = JSON.parse(match[0]);
      } catch {
        data = JSON.parse(match[0].replace(/,\s*([\]}])/g, '$1'));
      }
    } else {
      throw new Error('AI response is not valid JSON.');
    }
  }

  if (!data.questions || !Array.isArray(data.questions)) {
    throw new Error('No questions in AI response.');
  }

  // Validate each question
  return data.questions
    .filter((q) => q.question && q.question.trim().length > 10)
    .map((q) => ({
      question: q.question.trim(),
      expectedAnswer: q.expectedAnswer || 'No expected answer provided.',
      topic: q.topic || 'General',
      difficulty: ['easy', 'medium', 'hard'].includes(q.difficulty) ? q.difficulty : 'medium',
      marks: [2, 3, 5, 10].includes(q.marks) ? q.marks : q.difficulty === 'easy' ? 3 : q.difficulty === 'hard' ? 10 : 5,
    }));
}

// ─── Chunk text for batch processing ───
function chunkText(text, maxChunkSize = 8000) {
  if (text.length <= maxChunkSize) return [text];

  const chunks = [];
  const paragraphs = text.split(/\n\n+/);
  let current = '';

  for (const para of paragraphs) {
    if ((current + '\n\n' + para).length > maxChunkSize && current.length > 0) {
      chunks.push(current.trim());
      current = para;
    } else {
      current = current ? current + '\n\n' + para : para;
    }
  }
  if (current.trim()) chunks.push(current.trim());

  return chunks;
}

// ─── Deduplication ───
function deduplicateQuestions(questions) {
  const seen = new Set();
  return questions.filter((q) => {
    // Normalize for comparison: lowercase, remove extra whitespace and punctuation
    const key = q.question
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ═══════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════

/**
 * Generate a theory question bank from multiple PDFs.
 *
 * @param {File[]} files - Array of PDF files (max 10)
 * @param {function} [onProgress] - Progress callback: (message, percentComplete)
 * @returns {Promise<{ questions: object[], sourceFiles: string[], totalGenerated: number }>}
 */
export async function generateTheoryBank(files, onProgress = null) {
  if (!isGeminiConfigured()) {
    throw new Error('Gemini API key not configured. Add VITE_GEMINI_API_KEY to your .env file.');
  }

  // ── Validation ──
  if (!files || files.length === 0) {
    throw new Error('Please upload at least one PDF file.');
  }
  if (files.length > 10) {
    throw new Error('Maximum 10 PDF files allowed.');
  }

  for (const file of files) {
    if (file.type !== 'application/pdf') {
      throw new Error(`"${file.name}" is not a PDF file.`);
    }
    if (file.size > 10 * 1024 * 1024) {
      throw new Error(`"${file.name}" exceeds 10 MB limit.`);
    }
  }

  // ── Step 1: Extract text from all PDFs ──
  const allTexts = [];
  for (let i = 0; i < files.length; i++) {
    if (onProgress) onProgress(`Extracting text from PDF ${i + 1} of ${files.length}…`, Math.round(((i) / files.length) * 20));
    try {
      const text = await extractTextFromPdf(files[i]);
      if (text && text.trim().length > 50) {
        allTexts.push({ fileName: files[i].name, text });
      } else {
        console.warn(`Skipped "${files[i].name}" — not enough extractable text.`);
      }
    } catch (err) {
      console.warn(`Failed to extract text from "${files[i].name}":`, err.message);
    }
  }

  if (allTexts.length === 0) {
    throw new Error('Could not extract text from any of the uploaded PDFs. They may be scanned or image-based.');
  }

  // ── Step 2: Domain validation ──
  if (onProgress) onProgress('Validating engineering content…', 22);
  const combinedSample = allTexts.map((t) => t.text.slice(0, 1500)).join('\n');
  const { isEngineering } = validateEngineeringDomain(combinedSample);
  if (!isEngineering) {
    throw new Error(OUT_OF_DOMAIN_SHORT);
  }

  // ── Step 3: Prepare text chunks ──
  const combinedText = allTexts.map((t) => `=== Source: ${t.fileName} ===\n${t.text}`).join('\n\n');
  const chunks = chunkText(combinedText, 8000);

  // Decide how many batches and questions per batch
  const TARGET_QUESTIONS = 100;
  // Use fewer, larger batches to avoid 429 rate limits on Gemini free tier
  const numBatches = Math.min(chunks.length, 4); 
  const questionsPerBatch = Math.ceil(TARGET_QUESTIONS / numBatches);

  // Distribute chunks across batches
  const batchChunks = [];
  const chunksPerBatch = Math.ceil(chunks.length / numBatches);
  for (let i = 0; i < numBatches; i++) {
    const start = i * chunksPerBatch;
    const end = Math.min(start + chunksPerBatch, chunks.length);
    batchChunks.push(chunks.slice(start, end).join('\n\n'));
  }

  // ── Step 4: Generate questions in batches ──
  let allQuestions = [];
  const previousTopics = [];

  for (let b = 0; b < batchChunks.length; b++) {
    const pct = 25 + Math.round((b / batchChunks.length) * 65);
    if (onProgress) onProgress(`Generating questions — batch ${b + 1} of ${batchChunks.length}…`, pct);

    // Trim chunk if too long for the prompt
    const chunkText = batchChunks[b].length > 9000
      ? batchChunks[b].substring(0, 9000)
      : batchChunks[b];

    const prompt = buildTheoryPrompt(
      chunkText,
      b + 1,
      batchChunks.length,
      questionsPerBatch,
      previousTopics
    );

    try {
      const responseText = await geminiGenerate(prompt, {
        systemPrompt: 'You are a precise exam paper setter. Return ONLY valid JSON.',
        temperature: 0.5,
        maxOutputTokens: 8192,
        useCache: false,
      });

      const batchQuestions = parseBatchResponse(responseText);
      allQuestions.push(...batchQuestions);

      // Track topics to avoid duplicates in next batch
      batchQuestions.forEach((q) => {
        if (q.topic && !previousTopics.includes(q.topic)) {
          previousTopics.push(q.topic);
        }
      });
    } catch (err) {
      console.warn(`Batch ${b + 1} failed:`, err.message);
      // Continue with remaining batches
    }
  }

  // ── Step 5: Deduplicate and finalize ──
  if (onProgress) onProgress('Finalizing question bank…', 92);

  allQuestions = deduplicateQuestions(allQuestions);

  // Trim to exactly 100 if we got more, or keep all if less
  if (allQuestions.length > TARGET_QUESTIONS) {
    allQuestions = allQuestions.slice(0, TARGET_QUESTIONS);
  }

  // Number the questions
  allQuestions = allQuestions.map((q, i) => ({ id: i + 1, ...q }));

  if (allQuestions.length === 0) {
    throw new Error('AI could not generate any questions from the uploaded content. Please try different PDFs.');
  }

  if (onProgress) onProgress('Done!', 100);

  return {
    questions: allQuestions,
    sourceFiles: allTexts.map((t) => t.fileName),
    totalGenerated: allQuestions.length,
  };
}

/**
 * Format questions as a plain text string for copy/download.
 */
export function formatQuestionsAsText(questions, sourceFiles = []) {
  const header = `THEORY QUESTION BANK\nGenerated by IntelearnX AI\nTotal Questions: ${questions.length}\nSource PDFs: ${sourceFiles.join(', ') || 'N/A'}\nGenerated on: ${new Date().toLocaleString()}\n${'═'.repeat(60)}\n\n`;

  const body = questions
    .map((q) => {
      const diffLabel = q.difficulty === 'easy' ? '★' : q.difficulty === 'hard' ? '★★★' : '★★';
      return `Q${q.id}. [${q.marks} marks] [${q.difficulty.toUpperCase()}] ${diffLabel}\nTopic: ${q.topic}\n\n${q.question}\n\nExpected Answer:\n${q.expectedAnswer}\n\n${'─'.repeat(40)}`;
    })
    .join('\n\n');

  return header + body;
}
