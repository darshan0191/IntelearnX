/**
 * Question Paper Service — Multi-PDF → 3 Sets of Question Papers
 */

import { geminiGenerate, isGeminiConfigured } from './geminiaiClient';
import { validateEngineeringDomain, OUT_OF_DOMAIN_SHORT } from '../utils/engineeringDomainGuard';
import { extractTextFromPdf } from './theoryBankService';

export const PAPER_FORMATS = {
  FORMAT_30: 'format_30', // Q1: 3x8m (any 2), Q2: 3x7m (any 2) -> Total 30 marks
  FORMAT_50: 'format_50', // Q1: 3x8m (any 2), Q2: 3x8m (any 2), Q3: 4x6m (any 3) -> Total 50 marks
};

function buildPaperPrompt(textChunk, format) {
  const is50 = format === PAPER_FORMATS.FORMAT_50;
  
  const formatDesc = is50
    ? `FORMAT: 50 Marks Total
       SECTION 1 (Q1): 3 questions of 8 marks each (Answer any 2)
       SECTION 2 (Q2): 3 questions of 8 marks each (Answer any 2)
       SECTION 3 (Q3): 4 questions of 6 marks each (Answer any 3)`
    : `FORMAT: 30 Marks Total
       SECTION 1 (Q1): 3 questions of 8 marks each (Answer any 2)
       SECTION 2 (Q2): 3 questions of 7 marks each (Answer any 2)`;

  const exampleJson = is50
    ? `{
        "setA": {
          "q1": [{"question": "Q1.1 text", "marks": 8}, {"question": "Q1.2 text", "marks": 8}, {"question": "Q1.3 text", "marks": 8}],
          "q2": [{"question": "Q2.1 text", "marks": 8}, {"question": "Q2.2 text", "marks": 8}, {"question": "Q2.3 text", "marks": 8}],
          "q3": [{"question": "Q3.1 text", "marks": 6}, {"question": "Q3.2 text", "marks": 6}, {"question": "Q3.3 text", "marks": 6}, {"question": "Q3.4 text", "marks": 6}]
        },
        "setB": { ... same structure ... },
        "setC": { ... same structure ... }
       }`
    : `{
        "setA": {
          "q1": [{"question": "Q1.1 text", "marks": 8}, {"question": "Q1.2 text", "marks": 8}, {"question": "Q1.3 text", "marks": 8}],
          "q2": [{"question": "Q2.1 text", "marks": 7}, {"question": "Q2.2 text", "marks": 7}, {"question": "Q2.3 text", "marks": 7}]
        },
        "setB": { ... },
        "setC": { ... }
       }`;

  return `You are an expert engineering exam paper setter. Generate THREE distinct sets (Set A, Set B, and Set C) of a formal engineering question paper using ONLY the provided study material.

${formatDesc}

STRICT RULES:
1. Generate unique, high-quality theory questions for each set. Ensure no significant overlap between Set A, B, and C.
2. Follow the structure EXACTLY for EVERY set.
3. Use ONLY the provided text.
4. Each set must be complete (Q1 and Q2 for 30m; Q1, Q2, and Q3 for 50m).
5. Return ONLY valid JSON. No markdown.

REQUIRED JSON FORMAT:
${exampleJson}

STUDY MATERIAL:
${textChunk}

Generate all 3 sets now. Return ONLY the JSON object:`;
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

  // ── Step 2: Generate all 3 Sets in ONE call ──
  if (onProgress) onProgress(`Generating all 3 Question Paper Sets…`, 50);

  const prompt = buildPaperPrompt(combinedText, format);
  try {
    const response = await geminiGenerate(prompt, {
      systemPrompt: 'You are a precise exam setter. Return ONLY valid JSON.',
      temperature: 0.7,
      maxOutputTokens: 8192,
    });

    // Clean response
    let cleaned = response.trim();
    cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    
    const parsed = JSON.parse(cleaned);
    
    // Map back to the expected array format
    const results = [
      { setLabel: 'A', data: parsed.setA },
      { setLabel: 'B', data: parsed.setB },
      { setLabel: 'C', data: parsed.setC },
    ];

    // Basic validation
    if (!results[0].data || !results[0].data.q1) {
      throw new Error('AI response was incomplete. Please try again.');
    }

    if (onProgress) onProgress('Finalizing sets…', 100);
    return results;
  } catch (err) {
    console.error(`Generation failed`, err);
    throw new Error(`Failed to generate sets: ${err.message}`);
  }
}
