// Quiz questions bank organized by subject and topic
// Each question has difficulty: 'easy', 'medium', 'hard'

const quizData = {
  'Full Stack Web Development': {
    'Frontend': [
      {
        id: 'web-front-1',
        question: 'Which of the following is NOT a JavaScript framework/library?',
        options: ['React', 'Angular', 'Django', 'Vue'],
        correct: 2,
        difficulty: 'easy',
        explanation: 'Django is a Python-based backend framework, not a JavaScript frontend library.',
      },
      {
        id: 'web-front-2',
        question: 'What is the purpose of the Virtual DOM in React?',
        options: ['To directly manipulate the browser DOM', 'To optimize rendering by minimizing direct DOM updates', 'To create 3D graphics', 'To manage state globally'],
        correct: 1,
        difficulty: 'medium',
        explanation: 'React uses a Virtual DOM to batch and optimize actual DOM updates, improving performance.',
      },
      {
        id: 'web-front-3',
        question: 'Which CSS concept determines which style rule applies when multiple rules conflict?',
        options: ['Inheritance', 'Specificity', 'Z-index', 'Flexbox'],
        correct: 1,
        difficulty: 'hard',
        explanation: 'Specificity is the algorithm used by browsers to determine which CSS rule is applied if multiple rules match a single element.',
      }
    ],
    'Backend': [
      {
        id: 'web-back-1',
        question: 'Which environment runs JavaScript outside the browser?',
        options: ['Python', 'Node.js', 'Apache', 'Nginx'],
        correct: 1,
        difficulty: 'easy',
        explanation: 'Node.js is a JavaScript runtime built on Chrome\'s V8 engine that runs JS outside the browser.',
      },
      {
        id: 'web-back-2',
        question: 'What does REST stand for?',
        options: ['Representational State Transfer', 'Remote State Transfer', 'Representational Server Transfer', 'Real-time Server Transfer'],
        correct: 0,
        difficulty: 'medium',
        explanation: 'REST stands for Representational State Transfer, an architectural style for designing networked applications.',
      },
      {
        id: 'web-back-3',
        question: 'What is middleware in Express.js?',
        options: ['A database connection', 'A function that has access to request, response, and the next function', 'A frontend component', 'A deployment strategy'],
        correct: 1,
        difficulty: 'hard',
        explanation: 'Middleware functions have access to the request object, response object, and the next middleware function in the application\'s request-response cycle.',
      }
    ],
  },
  'DSA': {
    'Arrays & Strings': [
      {
        id: 'dsa-arr-1',
        question: 'In a zero-indexed array of size N, what is the index of the last element?',
        options: ['N', 'N - 1', 'N + 1', '0'],
        correct: 1,
        difficulty: 'easy',
        explanation: 'Because array indexing starts at 0, the last element is at index N - 1.',
      },
      {
        id: 'dsa-arr-2',
        question: 'What is the most efficient way to reverse a string in-place?',
        options: ['Using a stack', 'Using a completely new array', 'Two-pointer approach swapping ends to middle', 'Using a queue'],
        correct: 2,
        difficulty: 'medium',
        explanation: 'A two-pointer approach (start and end) swapping elements until they meet takes O(n) time and O(1) space.',
      },
      {
        id: 'dsa-arr-3',
        question: 'Kadane\'s algorithm is used to solve which problem?',
        options: ['Longest Common Subsequence', 'Maximum Subarray Sum', 'Knapsack Problem', 'Matrix Multiplication'],
        correct: 1,
        difficulty: 'hard',
        explanation: 'Kadane\'s algorithm is an O(n) dynamic programming technique to find the maximum contiguous subarray sum.',
      }
    ],
    'Trees & Graphs': [
      {
        id: 'dsa-tree-1',
        question: 'Which data structure is best for Breadth-First Search (BFS)?',
        options: ['Stack', 'Queue', 'Array', 'Linked List'],
        correct: 1,
        difficulty: 'easy',
        explanation: 'A Queue (FIFO) is used to keep track of the nodes to visit next level by level.',
      },
      {
        id: 'dsa-tree-2',
        question: 'In a Binary Search Tree, an in-order traversal visits nodes in what order?',
        options: ['Random order', 'Decreasing order', 'Increasing order', 'Level by level'],
        correct: 2,
        difficulty: 'medium',
        explanation: 'In-order traversal (Left, Root, Right) on a BST visits nodes in ascending order.',
      },
      {
        id: 'dsa-tree-3',
        question: 'Dijkstra\'s algorithm finds the shortest path on what kind of graph?',
        options: ['Graphs with negative edges', 'Graphs with non-negative edge weights', 'Unweighted graphs only', 'Trees only'],
        correct: 1,
        difficulty: 'hard',
        explanation: 'Dijkstra\'s algorithm requires all edge weights to be non-negative to guarantee correctness.',
      }
    ]
  },
  'OOPs using Java': {
    'Basics': [
      {
        id: 'oop-bas-1',
        question: 'Which method serves as the entry point of a Java application?',
        options: ['start()', 'init()', 'main()', 'run()'],
        correct: 2,
        difficulty: 'easy',
        explanation: 'The public static void main(String[] args) method is the entry point of Java applications.',
      },
      {
        id: 'oop-bas-2',
        question: 'Which keyword prevents a class from being inherited?',
        options: ['static', 'final', 'abstract', 'private'],
        correct: 1,
        difficulty: 'medium',
        explanation: 'The "final" keyword applied to a class prevents other classes from extending it.',
      },
      {
        id: 'oop-bas-3',
        question: 'What is the default value of a boolean instance variable in Java?',
        options: ['true', 'false', 'null', '0'],
        correct: 1,
        difficulty: 'hard',
        explanation: 'Instance variables in Java are initialized to default values; for boolean, it is false.',
      }
    ],
    'Inheritance & Polymorphism': [
      {
        id: 'oop-inh-1',
        question: 'What keyword invokes the parent class constructor?',
        options: ['this', 'super', 'parent', 'base'],
        correct: 1,
        difficulty: 'easy',
        explanation: 'The "super()" call is used to invoke the constructor of the immediate parent class.',
      },
      {
        id: 'oop-inh-2',
        question: 'Method overloading happens at:',
        options: ['Compile-time', 'Runtime', 'Load-time', 'Never'],
        correct: 0,
        difficulty: 'medium',
        explanation: 'Method overloading is resolved at compile-time (static polymorphism).',
      },
      {
        id: 'oop-inh-3',
        question: 'Can an interface in Java implement another interface?',
        options: ['Yes, using the "implements" keyword', 'Yes, using the "extends" keyword', 'No', 'Only abstract interfaces can'],
        correct: 1,
        difficulty: 'hard',
        explanation: 'An interface can extend another interface using the "extends" keyword in Java.',
      }
    ]
  },
  'Software Engineering': {
    'SDLC & Methodologies': [
      {
        id: 'se-sdlc-1',
        question: 'Which SDLC model is strictly sequential?',
        options: ['Agile', 'Scrum', 'Waterfall', 'Spiral'],
        correct: 2,
        difficulty: 'easy',
        explanation: 'The Waterfall model is a linear sequential approach to software design.',
      },
      {
        id: 'se-sdlc-2',
        question: 'In Scrum, what is the role of the Product Owner?',
        options: ['Writing code', 'Managing the development team', 'Maximizing the value of the product', 'Running the daily standup'],
        correct: 2,
        difficulty: 'medium',
        explanation: 'The Product Owner represents the stakeholders and maximizes product value by managing the backlog.',
      },
      {
        id: 'se-sdlc-3',
        question: 'What does CI/CD stand for?',
        options: ['Continuous Integration / Continuous Deployment', 'Code Integration / Code Deployment', 'Consistent Integration / Constant Delivery', 'Custom Implementation / Custom Design'],
        correct: 0,
        difficulty: 'hard',
        explanation: 'CI/CD stands for Continuous Integration and Continuous Deployment (or Delivery).',
      }
    ],
    'Testing': [
      {
        id: 'se-test-1',
        question: 'What type of testing evaluates individual components in isolation?',
        options: ['System Testing', 'Integration Testing', 'Unit Testing', 'Acceptance Testing'],
        correct: 2,
        difficulty: 'easy',
        explanation: 'Unit testing isolates the smallest testable parts (units) of an application.',
      },
      {
        id: 'se-test-2',
        question: 'What does regression testing verify?',
        options: ['That a new feature works', 'That recent changes haven\'t broken existing functionality', 'Security vulnerabilities', 'System performance under load'],
        correct: 1,
        difficulty: 'medium',
        explanation: 'Regression testing checks if previously developed and tested software still performs correctly after changes.',
      },
      {
        id: 'se-test-3',
        question: 'Which testing technique does not require knowledge of internal code structure?',
        options: ['White-box testing', 'Glass-box testing', 'Black-box testing', 'Clear-box testing'],
        correct: 2,
        difficulty: 'hard',
        explanation: 'Black-box testing focuses on inputs and outputs without examining the internal workings.',
      }
    ]
  },
  'Finance': {
    'Personal Finance': [
      {
        id: 'fin-per-1',
        question: 'What is an emergency fund?',
        options: ['Money saved for a vacation', 'A bank loan', 'Money set aside for unexpected expenses', 'Credit card limit'],
        correct: 2,
        difficulty: 'easy',
        explanation: 'An emergency fund is savings dedicated to covering financial surprises or lost income.',
      },
      {
        id: 'fin-per-2',
        question: 'The 50/30/20 rule of budgeting suggests spending 20% of your income on:',
        options: ['Needs', 'Wants', 'Taxes', 'Savings and Debt Repayment'],
        correct: 3,
        difficulty: 'medium',
        explanation: 'The rule allocates 50% to needs, 30% to wants, and 20% to savings/debt.',
      },
      {
        id: 'fin-per-3',
        question: 'Which credit score factor has the largest impact?',
        options: ['Length of credit history', 'Payment history', 'New credit', 'Credit mix'],
        correct: 1,
        difficulty: 'hard',
        explanation: 'Payment history typically accounts for 35% of a FICO score, making it the most significant factor.',
      }
    ],
    'Markets & Investing': [
      {
        id: 'fin-mkt-1',
        question: 'What does buying a share of stock represent?',
        options: ['A loan to a company', 'Partial ownership of a company', 'A government bond', 'A mutual fund'],
        correct: 1,
        difficulty: 'easy',
        explanation: 'A stock is a security that represents the ownership of a fraction of a corporation.',
      },
      {
        id: 'fin-mkt-2',
        question: 'What characterizes a "Bear Market"?',
        options: ['Rising stock prices', 'Stable market conditions', 'A period of declining stock prices', 'High dividend yields'],
        correct: 2,
        difficulty: 'medium',
        explanation: 'A bear market occurs when securities fall 20% or more from recent highs amid widespread pessimism.',
      },
      {
        id: 'fin-mkt-3',
        question: 'What does "diversification" in an investment portfolio aim to achieve?',
        options: ['Maximize short-term gains', 'Concentrate on one fast-growing stock', 'Reduce overall risk', 'Eliminate taxes'],
        correct: 2,
        difficulty: 'hard',
        explanation: 'Diversification reduces risk by allocating investments across various financial instruments, industries, and categories.',
      }
    ]
  }
};

// Resource recommendations mapped to topics
export const resourceBank = {
  'Full Stack Web Development': {
    'Frontend': [
      { type: 'video', title: 'React Crash Course', url: 'https://react.dev/learn', rating: 4.8 },
      { type: 'article', title: 'MDN Web Docs', url: 'https://developer.mozilla.org/', rating: 4.9 },
    ],
    'Backend': [
      { type: 'video', title: 'Node.js Tutorial', url: 'https://nodejs.org/en/learn', rating: 4.7 },
      { type: 'article', title: 'Express Routing', url: 'https://expressjs.com/en/guide/routing.html', rating: 4.5 },
    ]
  },
  'DSA': {
    'Arrays & Strings': [
      { type: 'practice', title: 'LeetCode Arrays', url: 'https://leetcode.com/explore/learn/card/fun-with-arrays/', rating: 4.8 },
    ],
    'Trees & Graphs': [
      { type: 'video', title: 'Graph Algorithms', url: 'https://www.youtube.com/watch?v=tWVWeAqZ0WU', rating: 4.9 },
    ]
  },
  'OOPs using Java': {
    'Basics': [
      { type: 'article', title: 'Java Basics Docs', url: 'https://docs.oracle.com/javase/tutorial/java/', rating: 4.5 },
    ],
    'Inheritance & Polymorphism': [
      { type: 'video', title: 'Java OOP Concepts', url: 'https://www.youtube.com/watch?v=a199KZGMNxk', rating: 4.7 },
    ]
  },
  'Software Engineering': {
    'SDLC & Methodologies': [
      { type: 'article', title: 'Agile Manifesto', url: 'https://agilemanifesto.org/', rating: 4.8 },
    ],
    'Testing': [
      { type: 'article', title: 'Software Testing Fundamentals', url: 'http://softwaretestingfundamentals.com/', rating: 4.6 },
    ]
  },
  'Finance': {
    'Personal Finance': [
      { type: 'article', title: 'Investopedia: Budgeting Basics', url: 'https://www.investopedia.com/terms/b/budget.asp', rating: 4.8 },
    ],
    'Markets & Investing': [
      { type: 'video', title: 'Stock Market Basics', url: 'https://www.youtube.com/watch?v=p7HKvqRI_Bo', rating: 4.7 },
    ]
  }
};

// Badge definitions
export const badgeDefinitions = [
  { id: 'first_quiz', name: 'First Steps', description: 'Complete your first quiz', icon: '🎯', condition: (stats) => stats.totalQuizzes >= 1, xpReward: 50 },
  { id: 'five_quizzes', name: 'Quiz Explorer', description: 'Complete 5 quizzes', icon: '📚', condition: (stats) => stats.totalQuizzes >= 5, xpReward: 100 },
  { id: 'ten_quizzes', name: 'Knowledge Seeker', description: 'Complete 10 quizzes', icon: '🏆', condition: (stats) => stats.totalQuizzes >= 10, xpReward: 200 },
  { id: 'perfect_score', name: 'Perfect Score', description: 'Score 100% on a quiz', icon: '⭐', condition: (stats) => stats.perfectScores >= 1, xpReward: 150 },
  { id: 'streak_3', name: 'Hot Streak', description: 'Get 3 correct answers in a row', icon: '🔥', condition: (stats) => stats.maxStreak >= 3, xpReward: 75 },
  { id: 'streak_5', name: 'On Fire!', description: 'Get 5 correct answers in a row', icon: '💥', condition: (stats) => stats.maxStreak >= 5, xpReward: 150 },
  { id: 'streak_10', name: 'Unstoppable', description: 'Get 10 correct answers in a row', icon: '🚀', condition: (stats) => stats.maxStreak >= 10, xpReward: 300 },
  { id: 'multi_subject', name: 'Well Rounded', description: 'Attempt quizzes in 3 different subjects', icon: '🌍', condition: (stats) => stats.subjectsAttempted >= 3, xpReward: 200 },
  { id: 'fast_learner', name: 'Speed Demon', description: 'Answer 5 questions under 10 seconds each', icon: '⚡', condition: (stats) => stats.fastAnswers >= 5, xpReward: 100 },
  { id: 'xp_500', name: 'Rising Star', description: 'Earn 500 XP', icon: '✨', condition: (stats) => stats.totalXP >= 500, xpReward: 50 },
  { id: 'xp_1000', name: 'Scholar', description: 'Earn 1000 XP', icon: '🎓', condition: (stats) => stats.totalXP >= 1000, xpReward: 100 },
  { id: 'xp_2500', name: 'Grandmaster', description: 'Earn 2500 XP', icon: '👑', condition: (stats) => stats.totalXP >= 2500, xpReward: 250 },
  { id: 'hard_master', name: 'Challenge Master', description: 'Score 80%+ on a hard difficulty quiz', icon: '💎', condition: (stats) => stats.hardQuizHighScore >= 80, xpReward: 200 },
  { id: 'daily_login_7', name: 'Dedicated', description: 'Log in 7 days in a row', icon: '📅', condition: (stats) => stats.loginStreak >= 7, xpReward: 150 },
];

export default quizData;
