/**
 * First-time onboarding quiz — 10 questions in fixed order:
 * Fullstack, DSA, Cybersecurity, AI & ML, Embedded systems — 2 each.
 * Questions emphasize reasoning over memorized technical detail.
 */

export const INTRO_QUIZ_TITLE = 'Welcome assessment';

export const introQuizQuestions = [
  // Full Stack (2)
  {
    id: 'intro-fs-1',
    topic: 'Full Stack Development',
    question:
      'You add client-side checks so a user cannot submit an empty email. Why still validate the same rule on the server?',
    options: [
      'So the page loads faster',
      'Because people can send requests that skip the browser checks',
      'Because HTML cannot display errors',
      'So you never need a database',
    ],
    correct: 1,
    difficulty: 'easy',
    explanation:
      'Anything running in the browser can be bypassed. The server must enforce rules for security and data integrity.',
  },
  {
    id: 'intro-fs-2',
    topic: 'Full Stack Development',
    question:
      'One teammate focuses on screens and layout; another connects forms to APIs and the database. What does this split mainly reflect?',
    options: [
      'Using two programming languages',
      'Separating what users interact with from where data is stored and processed',
      'Avoiding version control',
      'Running everything only on the user’s phone',
    ],
    correct: 1,
    difficulty: 'easy',
    explanation:
      'Full-stack work often divides presentation (front end) from business logic and persistence (back end), even if one person does both.',
  },

  // DSA (2)
  {
    id: 'intro-dsa-1',
    topic: 'DSA',
    question:
      'A list of IDs is sorted. You need to find one ID. You may compare the middle item and discard half of the list each time. That idea is closest to:',
    options: [
      'Reading every item from start to finish',
      'Repeatedly cutting the search space in half',
      'Picking random items until you succeed',
      'Copying the whole list each time',
    ],
    correct: 1,
    difficulty: 'easy',
    explanation:
      'Binary search (and similar “divide the problem” ideas) work by shrinking what remains to search.',
  },
  {
    id: 'intro-dsa-2',
    topic: 'DSA',
    question:
      'A help desk serves tickets in the order they arrived: first ticket in is handled first. Which everyday analogy fits that “first in, first out” behavior?',
    options: [
      'A stack of plates (you take from the top)',
      'A single-file queue at a counter',
      'A family tree of managers',
      'A shortcut that jumps to the last item only',
    ],
    correct: 1,
    difficulty: 'easy',
    explanation:
      'A queue processes items in arrival order—like a line—unlike a stack, which is last-in, first-out.',
  },

  // Cybersecurity (2)
  {
    id: 'intro-cyber-1',
    topic: 'Cybersecurity',
    question:
      'You get an email claiming your account will be closed unless you “verify” via a link. The link domain almost matches your bank’s but has a small spelling mistake. What is the most reasonable first step?',
    options: [
      'Click quickly before the account closes',
      'Treat it as suspicious; open your account through the official site or app, not that link',
      'Forward it to everyone you know',
      'Assume any email with a logo is automatically safe',
    ],
    correct: 1,
    difficulty: 'easy',
    explanation:
      'Phishing often uses urgency and look-alike links. Verify through trusted channels instead of unknown links.',
  },
  {
    id: 'intro-cyber-2',
    topic: 'Cybersecurity',
    question:
      'Why is using the same password for email, shopping, and work accounts especially risky?',
    options: [
      'Browsers only save one password total',
      'If one service leaks credentials, attackers can try them everywhere',
      'Long passwords are illegal on shopping sites',
      'It makes two-factor authentication unnecessary',
    ],
    correct: 1,
    difficulty: 'easy',
    explanation:
      'Credential stuffing and leaks mean one reused password can unlock many accounts.',
  },

  // AI & ML (2)
  {
    id: 'intro-ai-1',
    topic: 'AI & ML',
    question:
      'A system learns from past hiring data to screen résumés. If past decisions were unfair to some groups, what is a serious risk?',
    options: [
      'The software will run slower',
      'The model may learn and repeat unfair patterns unless carefully checked and corrected',
      'Machine learning ignores all historical data',
      'Bias only appears in robotics, not in hiring tools',
    ],
    correct: 1,
    difficulty: 'easy',
    explanation:
      'Models reflect patterns in training data; unfair history can lead to unfair outcomes without oversight.',
  },
  {
    id: 'intro-ai-2',
    topic: 'AI & ML',
    question:
      'In plain terms, “training” a predictive model usually means:',
    options: [
      'Deleting old files from a computer',
      'Using examples so the system adjusts internal parameters to improve on a task',
      'Writing down every answer by hand for each user',
      'Turning off the model when it makes a mistake',
    ],
    correct: 1,
    difficulty: 'easy',
    explanation:
      'Training is learning from data—adjusting the model so predictions or classifications improve.',
  },

  // Embedded / hardware (2)
  {
    id: 'intro-emb-1',
    topic: 'Embedded Systems',
    question:
      'You build a small device that reads a sensor and switches a motor on or off. Why is a microcontroller a typical choice?',
    options: [
      'It runs a focused program close to sensors and actuators with predictable timing',
      'It removes the need for power',
      'It only works when tethered to a data center',
      'It is mainly for editing videos',
    ],
    correct: 0,
    difficulty: 'easy',
    explanation:
      'Embedded controllers run dedicated firmware next to hardware—sensors, motors, and timing—without needing a full PC.',
  },
  {
    id: 'intro-emb-2',
    topic: 'Embedded Systems',
    question:
      'A value (like room temperature) changes slowly. Sampling it thousands of times per second is often:',
    options: [
      'Required for every project',
      'Unnecessary overhead; a slower rate may be enough and save power',
      'Impossible on any microcontroller',
      'Only allowed for audio, never for sensors',
    ],
    correct: 1,
    difficulty: 'easy',
    explanation:
      'Match sample rate to how fast the signal really changes—oversampling wastes energy and processing.',
  },
];

