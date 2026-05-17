/**
 * shuffleOptions — Randomizes the order of answer options in a question
 * while keeping the `correct` index accurate.
 *
 * Works with both index-based ({ correct: 2 }) and string-based ({ answer: 'O(n)' }) formats.
 */

/**
 * Fisher-Yates shuffle — returns a new shuffled array.
 */
function fisherYatesShuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Shuffle the options of a question that uses `correct` (0-based index).
 * Returns a new question object with shuffled options and updated correct index.
 *
 * @param {{ options: string[], correct: number, [key: string]: any }} question
 * @returns {{ options: string[], correct: number, [key: string]: any }}
 */
export function shuffleQuestionOptions(question) {
  if (!question?.options || question.options.length === 0) return question;

  const correctText = question.options[question.correct];

  // Create index array, shuffle it
  const indices = question.options.map((_, i) => i);
  const shuffled = fisherYatesShuffle(indices);

  const newOptions = shuffled.map(i => question.options[i]);
  const newCorrect = newOptions.indexOf(correctText);

  return {
    ...question,
    options: newOptions,
    correct: newCorrect >= 0 ? newCorrect : question.correct,
  };
}

/**
 * Shuffle options for a question that uses `answer` (string match).
 * Returns a new question with shuffled options array.
 * The `answer` field stays unchanged since it's matched by value.
 *
 * @param {{ options: string[], answer: string, [key: string]: any }} question
 * @returns {{ options: string[], answer: string, [key: string]: any }}
 */
export function shuffleGameQuestionOptions(question) {
  if (!question?.options || question.options.length === 0) return question;
  return {
    ...question,
    options: fisherYatesShuffle(question.options),
  };
}

/**
 * Shuffle options for an array of questions (index-based correct).
 * @param {Array} questions
 * @returns {Array}
 */
export function shuffleAllQuestionOptions(questions) {
  return questions.map(shuffleQuestionOptions);
}

/**
 * Shuffle options for an array of game questions (string-based answer).
 * @param {Array} questions
 * @returns {Array}
 */
export function shuffleAllGameQuestionOptions(questions) {
  return questions.map(shuffleGameQuestionOptions);
}
