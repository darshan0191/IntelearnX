/**
 * PDF Quiz Service — OpenAI GPT-3.5 Turbo
 * Extracts text from PDF in browser using pdf.js loaded from CDN (avoids Vite bundling issues).
 *
 * Qdrant RAG Integration:
 *  - After extracting text, chunks are stored in Qdrant vector DB.
 *  - Quiz generation uses RAG (Retrieval Augmented Generation) to pull
 *    only the most relevant chunks, enabling support for very large PDFs.
 */

import {
  isVectorDbConfigured,
  ingestDocument,
  retrieveContext,
  storeQuizKnowledge,
} from './vectorService';
import { geminiGenerate, isGeminiConfigured } from './openaiClient';
import { validateEngineeringDomain, OUT_OF_DOMAIN_SHORT } from '../utils/engineeringDomainGuard';

// CDN version pinned to a stable 3.x build that works reliably in browsers
const PDFJS_VERSION = '3.11.174';
const PDFJS_CDN = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}`;

/**
 * Load pdfjs-dist from CDN once, cache on window.pdfjsLib.
 */
async function loadPdfJs() {
  if (window.pdfjsLib) return window.pdfjsLib;

  await new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `${PDFJS_CDN}/pdf.min.js`;
    script.onload = resolve;
    script.onerror = () => reject(new Error('Failed to load PDF.js from CDN. Check your internet connection.'));
    document.head.appendChild(script);
  });

  // Set worker source
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = `${PDFJS_CDN}/pdf.worker.min.js`;
  return window.pdfjsLib;
}

/**
 * Extract text from a PDF file using pdf.js loaded from CDN.
 */
async function extractTextFromPdf(file) {
  const pdfjsLib = await loadPdfJs();

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const textParts = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map((item) => item.str).join(' ');
    if (pageText.trim()) textParts.push(pageText);
  }

  return textParts.join('\n\n');
}

/**
 * Build the quiz generation prompt
 */
function buildPrompt(text, config, isRag = false) {
  const difficultyGuide = {
    easy: 'basic recall and simple understanding',
    medium: 'application and analysis of concepts',
    hard: 'critical thinking, edge cases, and deep reasoning',
  };

  const quizTypeGuide = {
    mcq: 'multiple choice questions with exactly 4 options each',
    true_false: "true/false questions (use ['True', 'False', 'True', 'False'] as options)",
    mixed: 'a mix of multiple choice and true/false questions',
  };

  // When using RAG, we already have focused context; otherwise limit to ~10000 chars
  const trimmedText = isRag ? text : (text.length > 10000 ? text.substring(0, 10000) : text);

  const sourceNote = isRag
    ? 'The text below are the most relevant excerpts retrieved from a larger document using semantic search (RAG). Base all questions ONLY on these excerpts.'
    : 'Generate a quiz ONLY from the provided document text below.';

  return `You are a precise quiz generator focused on engineering education. ${sourceNote}

IMPORTANT: Only generate quizzes from engineering-related content (CS, ECE, Mechanical, Civil, Software Engineering, etc.). If the document is clearly non-engineering, respond with: {"error":"out_of_domain","message":"${OUT_OF_DOMAIN_SHORT}"}

STRICT RULES:
1. Generate exactly ${config.numQuestions || 5} questions.
2. Difficulty level: ${config.difficulty || 'medium'} — focus on ${difficultyGuide[config.difficulty] || difficultyGuide.medium}.
3. Question type: ${quizTypeGuide[config.quizType] || quizTypeGuide.mcq}.
4. Every question MUST have exactly 4 options labeled as text (not A/B/C/D).
5. The correctAnswer field must exactly match one of the options strings.
6. Include a short explanation (1-2 sentences) for each correct answer.
7. Questions must come ONLY from the document text. Do NOT use outside knowledge.
8. Do NOT hallucinate facts not present in the document.
9. Return ONLY valid JSON. No markdown fences, no extra text.

REQUIRED JSON FORMAT:
{
  "title": "Quiz based on [document topic]",
  "sourceSummary": "Brief 1-2 sentence summary of the document",
  "questions": [
    {
      "id": 1,
      "question": "Question text here?",
      "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
      "correctAnswer": "Option 1",
      "explanation": "Brief explanation of why this is correct."
    }
  ]
}

DOCUMENT TEXT:
${trimmedText}

Generate the quiz now. Return ONLY the JSON object:`;
}

/**
 * Parse and validate the LLM response
 */
function parseLLMResponse(responseText) {
  let cleaned = responseText.trim();
  // Strip markdown fences (```json ... ``` or ``` ... ```)
  cleaned = cleaned.replace(/^```(?:json)?\s*/g, '').replace(/\s*```$/g, '').trim();

  // Remove trailing commas before ] or } (common LLM mistake)
  function removeTrailingCommas(str) {
    return str.replace(/,\s*([\]}])/g, '$1');
  }

  let data;
  try {
    data = JSON.parse(cleaned);
  } catch {
    // Try after removing trailing commas
    try {
      data = JSON.parse(removeTrailingCommas(cleaned));
    } catch {
      // Try extracting the JSON object from the response
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          data = JSON.parse(match[0]);
        } catch {
          data = JSON.parse(removeTrailingCommas(match[0]));
        }
      } else {
        throw new Error('AI response is not valid JSON. Please try again.');
      }
    }
  }

  if (!data.questions || !Array.isArray(data.questions) || data.questions.length === 0) {
    throw new Error('No questions generated');
  }

  // Validate & fix each question
  data.questions.forEach((q, i) => {
    q.id = i + 1;
    const required = ['question', 'options', 'correctAnswer', 'explanation'];
    for (const field of required) {
      if (!q[field]) throw new Error(`Question ${i + 1} missing '${field}'`);
    }
    if (q.options.length !== 4) throw new Error(`Question ${i + 1} must have 4 options`);
    if (!q.options.includes(q.correctAnswer)) q.correctAnswer = q.options[0];
  });

  data.title = data.title || 'Generated Quiz';
  data.sourceSummary = data.sourceSummary || 'Quiz generated from uploaded document.';

  return data;
}

/**
 * Upload a PDF and generate a quiz — all in the browser.
 * Uses RAG (Retrieval Augmented Generation) when Qdrant is configured:
 *  1. Extract text from PDF
 *  2. Chunk and store in Qdrant vector DB
 *  3. Retrieve only the most relevant chunks for quiz generation
 *  4. Generate quiz from focused context (works with 100+ page PDFs)
 *
 * Falls back to direct text truncation when Qdrant is not configured.
 *
 * @param {File} file - The PDF file
 * @param {object} config - { numQuestions, difficulty, quizType }
 * @param {object} [options] - { userId, onProgress }
 * @returns {Promise<object>} Generated quiz JSON
 */
export async function generateQuizFromPdf(file, config = {}, options = {}) {
  if (!isGeminiConfigured()) {
    throw new Error('Gemini API key not configured. Add VITE_GEMINI_API_KEY to your .env file.');
  }

  const { userId = '', onProgress = null } = options;

  // Step 1: Extract text from PDF in browser
  const text = await extractTextFromPdf(file);

  if (!text || text.trim().length < 100) {
    throw new Error('Could not extract enough text from the PDF. It may be scanned or image-based.');
  }

  // ── Engineering domain gate: check extracted text ──
  const textSample = text.slice(0, 3000); // Check first 3000 chars for domain signals
  const { isEngineering } = validateEngineeringDomain(textSample);
  if (!isEngineering) {
    throw new Error(OUT_OF_DOMAIN_SHORT);
  }

  let promptText = text;
  let isRag = false;

  // Step 2: If Qdrant is configured, use RAG pipeline
  if (isVectorDbConfigured()) {
    try {
      if (onProgress) onProgress('Storing document in vector database…');

      // Ingest the document into Qdrant
      await ingestDocument('pdf_chunks', text, {
        source: 'pdf',
        fileName: file.name,
        userId,
      });

      if (onProgress) onProgress('Retrieving relevant content with AI…');

      // Build a search query from the config to find the most relevant chunks
      const searchQuery = `Generate a ${config.difficulty || 'medium'} difficulty quiz about the main topics and key concepts in this document`;
      const { context } = await retrieveContext('pdf_chunks', searchQuery, 8, {
        must: [{ key: 'fileName', match: { value: file.name } }],
      });

      if (context && context.length > 200) {
        promptText = context;
        isRag = true;
      }
    } catch (ragErr) {
      console.warn('RAG pipeline failed, falling back to direct text:', ragErr.message);
      // Fall through to direct text approach
    }
  }

  // Step 3: Call Gemini with retry + fallback (handles rate limits)
  const prompt = buildPrompt(promptText, config, isRag);

  if (onProgress) onProgress('Generating quiz with Gemini AI…');

  const responseText = await geminiGenerate(prompt, {
    systemPrompt: 'You are a precise quiz generator. Return ONLY valid JSON.',
    temperature: 0.4,
    maxOutputTokens: 4096,
    useCache: false, // Each quiz should be unique
  });

  // Step 4: Parse and validate
  const quizData = parseLLMResponse(responseText);

  // Step 5: Store generated quiz questions in Qdrant for future semantic search
  if (isVectorDbConfigured() && quizData.questions?.length > 0) {
    try {
      await storeQuizKnowledge(userId, quizData.questions.map((q) => ({
        question: q.question,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        topic: quizData.title || 'PDF Quiz',
        subject: 'PDF Upload',
      })));
    } catch (storeErr) {
      console.warn('Failed to store quiz knowledge in vector DB:', storeErr.message);
    }
  }

  return quizData;
}

/**
 * Evaluate quiz answers (client-side — no backend needed)
 */
export function evaluateQuiz(questions, userAnswers) {
  let correctCount = 0;
  const results = questions.map((q) => {
    const userAnswer = userAnswers[String(q.id)] || '';
    const isCorrect = userAnswer === q.correctAnswer;
    if (isCorrect) correctCount++;
    return {
      questionId: q.id,
      question: q.question,
      userAnswer,
      correctAnswer: q.correctAnswer,
      isCorrect,
      explanation: q.explanation,
    };
  });

  return {
    totalQuestions: questions.length,
    correctCount,
    accuracy: questions.length > 0 ? Math.round((correctCount / questions.length) * 100 * 10) / 10 : 0,
    results,
  };
}
