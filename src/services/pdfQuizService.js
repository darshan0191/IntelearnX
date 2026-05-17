/**
 * 
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
import { geminiGenerate, isGeminiConfigured } from './geminiaiClient';
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

    // Preserve paragraph structure: group text items by their Y position.
    // Items on different Y lines in the PDF likely represent different lines/paragraphs.
    let lastY = null;
    const lineGroups = [];
    let currentLine = [];

    for (const item of content.items) {
      const y = Math.round(item.transform[5]); // Y coordinate
      if (lastY !== null && Math.abs(y - lastY) > 5) {
        // New line — flush current line
        if (currentLine.length > 0) {
          lineGroups.push(currentLine.join(' ').trim());
        }
        // Large gap indicates paragraph break
        if (Math.abs(y - lastY) > 15) {
          lineGroups.push(''); // Empty line = paragraph separator
        }
        currentLine = [];
      }
      if (item.str.trim()) currentLine.push(item.str);
      lastY = y;
    }
    if (currentLine.length > 0) {
      lineGroups.push(currentLine.join(' ').trim());
    }

    const pageText = lineGroups.filter(l => l !== undefined).join('\n');
    if (pageText.trim()) textParts.push(pageText.trim());
  }

  const rawText = textParts.join('\n\n');
  return cleanExtractedText(rawText);
}

/**
 * Clean and normalize text extracted from PDF.
 * Fixes common extraction artifacts that degrade search and embedding quality.
 */
function cleanExtractedText(text) {
  if (!text) return text;

  let cleaned = text;

  // 1. Fix broken hyphenated words from line-wrap (e.g. "algo-\nrithm" → "algorithm")
  cleaned = cleaned.replace(/(\w)-\s*\n\s*(\w)/g, '$1$2');

  // 2. Fix broken words split across lines without hyphens (e.g. "ther mo\n dynamics" → tricky, but handle common patterns)
  //    Re-join lines that end mid-word and next line starts lowercase
  cleaned = cleaned.replace(/([a-z])\s*\n\s*([a-z])/g, (match, p1, p2) => {
    // Only rejoin if it's within a "word" context (not end of sentence)
    return `${p1}${p2}`;
  });

  // 3. Remove garbled non-ASCII characters (common PDF extraction artifacts)
  //    Preserve standard Unicode letters, numbers, punctuation, math symbols
  cleaned = cleaned.replace(/[^\x20-\x7E\n\r\t\u00A0-\u024F\u0370-\u03FF\u2000-\u206F\u2190-\u21FF\u2200-\u22FF\u2300-\u23FF\u25A0-\u25FF\u2600-\u26FF]/g, '');

  // 4. Normalize whitespace
  //    a. Replace tabs with spaces
  cleaned = cleaned.replace(/\t/g, '  ');
  //    b. Remove multiple spaces (but keep single spaces)
  cleaned = cleaned.replace(/ {3,}/g, '  ');
  //    c. Remove trailing whitespace on each line
  cleaned = cleaned.replace(/[ \t]+$/gm, '');
  //    d. Collapse 3+ blank lines into 2
  cleaned = cleaned.replace(/\n{4,}/g, '\n\n\n');

  // 5. Fix missing spaces after punctuation (common PDF artifact)
  //    e.g. "sentence.Next" → "sentence. Next"
  cleaned = cleaned.replace(/([.!?;:,])([A-Z])/g, '$1 $2');

  // 6. Fix duplicate punctuation (e.g. "word.." → "word.")
  cleaned = cleaned.replace(/([.!?])\1+/g, '$1');

  // 7. Fix spaces before punctuation (e.g. "word ." → "word.")
  cleaned = cleaned.replace(/\s+([.!?,;:)])/g, '$1');

  // 8. Fix spaces after opening brackets (e.g. "( word" → "(word")
  cleaned = cleaned.replace(/([(\[])\s+/g, '$1');

  // 9. Normalize bullet/list markers to consistent format
  cleaned = cleaned.replace(/^[●○◆◇▪▸►▶→]\s*/gm, '• ');
  cleaned = cleaned.replace(/^[-–—]\s+/gm, '• ');

  // 10. Fix stray single characters on their own lines (OCR artifacts)
  //     Remove lines that contain only a single non-word character
  cleaned = cleaned.replace(/^\s*[^\w\n]{1}\s*$/gm, '');

  // 11. Normalize quotation marks
  cleaned = cleaned.replace(/[""]/g, '"');
  cleaned = cleaned.replace(/['']/g, "'");

  // 12. Fix common OCR/extraction spelling errors in technical text
  cleaned = cleaned
    .replace(/\bfl\s?oating\b/gi, 'floating')
    .replace(/\bfi\s?le\b/gi, 'file')
    .replace(/\bfi\s?nd\b/gi, 'find')
    .replace(/\bfl\s?ow\b/gi, 'flow')
    .replace(/\bfi\s?rst\b/gi, 'first')
    .replace(/\bfi\s?eld\b/gi, 'field')
    .replace(/\bfi\s?lter\b/gi, 'filter')
    .replace(/\bfi\s?gure\b/gi, 'figure')
    .replace(/\bdefi\s?ne\b/gi, 'define')
    .replace(/\bdefi\s?nition\b/gi, 'definition')
    .replace(/\bsigni\s?ficant\b/gi, 'significant');

  // 13. Remove page numbers on their own lines (e.g. lines that are just "12" or "Page 5")
  cleaned = cleaned.replace(/^\s*(Page\s*)?\d{1,4}\s*$/gm, '');

  // 14. Remove common PDF header/footer artifacts (repeated short lines)
  cleaned = cleaned.replace(/^\s*(©|Copyright|All rights reserved|Confidential).*$/gm, '');

  // 15. Final trim
  cleaned = cleaned.trim();

  return cleaned;
}


/**
 * Build the quiz generation prompt
 */
function buildPrompt(text, config, isRag = false) {
  // Route to theory prompt if quiz type is theory
  if (config.quizType === 'theory') {
    return buildTheoryPrompt(text, config, isRag);
  }

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
 * Build prompt for theory/descriptive questions
 */
function buildTheoryPrompt(text, config, isRag = false) {
  const difficultyGuide = {
    easy: 'definition-based and straightforward explanation questions',
    medium: 'questions requiring comparison, analysis, or multi-step explanation',
    hard: 'questions requiring deep critical thinking, design reasoning, or evaluation of trade-offs',
  };

  const trimmedText = isRag ? text : (text.length > 10000 ? text.substring(0, 10000) : text);

  const sourceNote = isRag
    ? 'The text below are the most relevant excerpts retrieved from a larger document using semantic search (RAG). Base all questions ONLY on these excerpts.'
    : 'Generate theory questions ONLY from the provided document text below.';

  return `You are a precise theory question generator focused on engineering education. ${sourceNote}

IMPORTANT: Only generate questions from engineering-related content (CS, ECE, Mechanical, Civil, Software Engineering, etc.). If the document is clearly non-engineering, respond with: {"error":"out_of_domain","message":"${OUT_OF_DOMAIN_SHORT}"}

STRICT RULES:
1. Generate exactly ${config.numQuestions || 5} theory/descriptive questions.
2. Difficulty level: ${config.difficulty || 'medium'} — focus on ${difficultyGuide[config.difficulty] || difficultyGuide.medium}.
3. Each question should require a detailed, descriptive answer (3-6 sentences minimum).
4. Questions should start with "Explain", "Describe", "Compare", "Discuss", "Analyze", "What is", "How does", "Why is", etc.
5. The modelAnswer must be a comprehensive, well-structured descriptive answer (4-8 sentences).
6. Include key points that a good answer should cover.
7. Questions must come ONLY from the document text. Do NOT use outside knowledge.
8. Do NOT hallucinate facts not present in the document.
9. Return ONLY valid JSON. No markdown fences, no extra text.

REQUIRED JSON FORMAT:
{
  "title": "Theory Questions on [document topic]",
  "sourceSummary": "Brief 1-2 sentence summary of the document",
  "questionType": "theory",
  "questions": [
    {
      "id": 1,
      "question": "Explain the concept of X and its significance in Y.",
      "modelAnswer": "Detailed descriptive model answer here covering all key points. This should be 4-8 sentences explaining the concept thoroughly.",
      "keyPoints": ["Key point 1", "Key point 2", "Key point 3"]
    }
  ]
}

DOCUMENT TEXT:
${trimmedText}

Generate the theory questions now. Return ONLY the JSON object:`;
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

  // Check if this is a theory quiz
  const isTheory = data.questionType === 'theory' || (data.questions[0] && data.questions[0].modelAnswer && !data.questions[0].options);

  if (isTheory) {
    // Validate theory questions
    data.questionType = 'theory';
    data.questions.forEach((q, i) => {
      q.id = i + 1;
      if (!q.question) throw new Error(`Question ${i + 1} missing 'question'`);
      if (!q.modelAnswer) throw new Error(`Question ${i + 1} missing 'modelAnswer'`);
      if (!q.keyPoints) q.keyPoints = [];
    });
  } else {
    // Validate MCQ/TF questions
    data.questions.forEach((q, i) => {
      q.id = i + 1;
      const required = ['question', 'options', 'correctAnswer', 'explanation'];
      for (const field of required) {
        if (!q[field]) throw new Error(`Question ${i + 1} missing '${field}'`);
      }
      if (q.options.length !== 4) throw new Error(`Question ${i + 1} must have 4 options`);
      if (!q.options.includes(q.correctAnswer)) q.correctAnswer = q.options[0];
    });
  }

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
