/**
 * Question Paper Service — Multi-PDF → 3 Sets of Question Papers
 */

import { geminiGenerate, isGeminiConfigured } from './openaiClient';
import { validateEngineeringDomain, OUT_OF_DOMAIN_SHORT } from '../utils/engineeringDomainGuard';
import { extractTextFromPdf } from './theoryBankService';

export const PAPER_FORMATS = {
  FORMAT_30: 'format_30', // Q1: 3x8m (any 2), Q2: 3x7m (any 2) -> Total 30 marks
  FORMAT_50: 'format_50', // Q1: 3x8m (any 2), Q2: 3x8m (any 2), Q3: 4x6m (any 3) -> Total 50 marks
};

function buildPaperPrompt(textChunk, format) {
  const formatDesc = format === PAPER_FORMATS.FORMAT_30
    ? `FORMAT: 30 Marks Total
       Q1: 3 questions of 8 marks each (Student must answer any 2)
       Q2: 3 questions of 7 marks each (Student must answer any 2)`
    : `FORMAT: 50 Marks Total
       Q1: 3 questions of 8 marks each (Student must answer any 2)
       Q2: 3 questions of 8 marks each (Student must answer any 2)
       Q3: 4 questions of 6 marks each (Student must answer any 3)`;

  const structureJson = format === PAPER_FORMATS.FORMAT_30
    ? `{
        "setA": { "q1": [...], "q2": [...] },
        "setB": { "q1": [...], "q2": [...] },
        "setC": { "q1": [...], "q2": [...] }
       }`
    : `{
        "setA": { "q1": [...], "q2": [...], "q3": [...] },
        "setB": { "q1": [...], "q2": [...], "q3": [...] },
        "setC": { "q1": [...], "q2": [...], "q3": [...] }
       }`;

  return `You are an expert exam paper setter. Generate THREE distinct sets (Set A, Set B, and Set C) of a formal engineering question paper using ONLY the provided study material.

${formatDesc}

STRICT RULES:
1. Generate unique, high-quality theory questions for each set. Ensure no significant overlap between Set A, B, and C.
2. Follow the structure EXACTLY for EVERY set.
3. Use ONLY the provided text.
4. Return ONLY valid JSON. No markdown.

REQUIRED JSON FORMAT:
{
  "setA": ${format === PAPER_FORMATS.FORMAT_30 ? '{"q1": [{"question": "...", "marks": 8}, ...], "q2": [{"question": "...", "marks": 7}, ...]}' : '{"q1": [...], "q2": [...], "q3": [...]}'},
  "setB": ...,
  "setC": ...
}

STUDY MATERIAL:
${textChunk}

Generate all 3 sets now:`;
}

export async function generateQuestionPaperSets(files, format, onProgress = null) {
  if (!isGeminiConfigured()) {
    throw new Error('Gemini API key not configured.');
  }

  // ── Step 1: Extract text ──
  const allTexts = [];
  for (let i = 0; i < files.length; i++) {
    if (onProgress) onProgress(`Extracting text from PDF ${i + 1} of ${files.length}…`, 10 + Math.round((i / files.length) * 20));
    const text = await extractTextFromPdf(files[i]);
    if (text) allTexts.push(text);
  }

  if (allTexts.length === 0) throw new Error('Could not extract text.');
  const combinedText = allTexts.join('\n\n').substring(0, 15000);

  // ── Step 2: Generate all 3 Sets in ONE call to avoid rate limits ──
  if (onProgress) onProgress(`Generating all 3 Question Paper Sets…`, 50);

  const prompt = buildPaperPrompt(combinedText, format);
  try {
    const response = await geminiGenerate(prompt, {
      systemPrompt: 'You are a precise exam setter. Return ONLY valid JSON.',
      temperature: 0.7,
      maxOutputTokens: 8192, // Ensure enough room for all 3 sets
    });

    const parsed = JSON.parse(response.replace(/```json|```/g, ''));
    
    // Map back to the expected array format [ { setLabel, data }, ... ]
    const results = [
      { setLabel: 'A', data: parsed.setA },
      { setLabel: 'B', data: parsed.setB },
      { setLabel: 'C', data: parsed.setC },
    ];

    if (onProgress) onProgress('Finalizing sets…', 100);
    return results;
  } catch (err) {
    console.error(`Generation failed`, err);
    throw err;
  }
}
