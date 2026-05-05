// ── DSA Questions (Droplet + Race) ──────────────────────────────────────────
export const DSA_QUESTIONS = [
  { q: 'What is the time complexity of Binary Search?', options: ['O(n)', 'O(log n)', 'O(n²)', 'O(1)'], answer: 'O(log n)' },
  { q: 'Which data structure uses LIFO order?', options: ['Queue', 'Stack', 'Heap', 'Tree'], answer: 'Stack' },
  { q: 'What is the worst-case time complexity of QuickSort?', options: ['O(n log n)', 'O(n)', 'O(n²)', 'O(log n)'], answer: 'O(n²)' },
  { q: 'Which traversal visits root first?', options: ['Inorder', 'Postorder', 'Preorder', 'BFS'], answer: 'Preorder' },
  { q: 'What is the space complexity of Merge Sort?', options: ['O(1)', 'O(log n)', 'O(n)', 'O(n²)'], answer: 'O(n)' },
  { q: 'Which algorithm finds shortest path in a weighted graph?', options: ['BFS', 'DFS', "Dijkstra's", 'Prim\'s'], answer: "Dijkstra's" },
  { q: 'What is the best sorting algorithm for nearly sorted data?', options: ['QuickSort', 'MergeSort', 'Insertion Sort', 'Heap Sort'], answer: 'Insertion Sort' },
  { q: 'A complete binary tree with n nodes has height?', options: ['O(n)', 'O(log n)', 'O(n²)', 'O(1)'], answer: 'O(log n)' },
  { q: 'Which data structure is used in BFS?', options: ['Stack', 'Queue', 'Heap', 'Array'], answer: 'Queue' },
  { q: 'What is the time complexity of accessing an element in a Hash Table?', options: ['O(n)', 'O(log n)', 'O(1)', 'O(n²)'], answer: 'O(1)' },
  { q: 'Which sorting algorithm is stable?', options: ['QuickSort', 'HeapSort', 'Merge Sort', 'Selection Sort'], answer: 'Merge Sort' },
  { q: 'What does DFS use internally?', options: ['Queue', 'Stack', 'Heap', 'Linked List'], answer: 'Stack' },
  { q: 'Time complexity of inserting into a max-heap?', options: ['O(1)', 'O(n)', 'O(log n)', 'O(n log n)'], answer: 'O(log n)' },
  { q: 'Which algorithm uses divide and conquer?', options: ['Bubble Sort', 'Insertion Sort', 'Merge Sort', 'Selection Sort'], answer: 'Merge Sort' },
  { q: 'What is the average time complexity of QuickSort?', options: ['O(n²)', 'O(n)', 'O(n log n)', 'O(log n)'], answer: 'O(n log n)' },
];

// ── DBMS / SQL Questions (SQL Shooter) ──────────────────────────────────────
export const SQL_QUESTIONS = [
  {
    q: 'Select all records from "students" table',
    answer: 'SELECT * FROM students',
    options: [
      'SELECT * FROM students',
      'GET ALL FROM students',
      'FETCH * students',
      'SELECT students.*',
      'SHOW ALL students',
    ],
  },
  {
    q: 'Count total rows in "orders" table',
    answer: 'SELECT COUNT(*) FROM orders',
    options: [
      'SELECT COUNT(*) FROM orders',
      'COUNT ROWS IN orders',
      'SELECT TOTAL FROM orders',
      'GET COUNT orders',
      'SELECT SUM(*) FROM orders',
    ],
  },
  {
    q: 'Find students with age > 18',
    answer: 'SELECT * FROM students WHERE age > 18',
    options: [
      'SELECT * FROM students WHERE age > 18',
      'SELECT * FROM students IF age > 18',
      'FIND students WHERE age > 18',
      'SELECT * students HAVING age > 18',
      'GET * FROM students age > 18',
    ],
  },
  {
    q: 'Delete a record where id = 5',
    answer: 'DELETE FROM table WHERE id = 5',
    options: [
      'DELETE FROM table WHERE id = 5',
      'REMOVE FROM table WHERE id = 5',
      'DROP FROM table WHERE id = 5',
      'DELETE table WHERE id = 5',
      'ERASE FROM table id = 5',
    ],
  },
  {
    q: 'Insert a new row into "users" table',
    answer: 'INSERT INTO users VALUES (...)',
    options: [
      'INSERT INTO users VALUES (...)',
      'ADD INTO users VALUES (...)',
      'PUT INTO users VALUES (...)',
      'INSERT users VALUES (...)',
      'NEW ROW INTO users (...)',
    ],
  },
  {
    q: 'Sort results by "name" in ascending order',
    answer: 'SELECT * FROM t ORDER BY name ASC',
    options: [
      'SELECT * FROM t ORDER BY name ASC',
      'SELECT * FROM t SORT BY name',
      'SELECT * FROM t ORDER name ASC',
      'SELECT * FROM t ARRANGE BY name',
      'SELECT * FROM t BY name ASC',
    ],
  },
  {
    q: 'Join two tables on matching id',
    answer: 'SELECT * FROM a INNER JOIN b ON a.id = b.id',
    options: [
      'SELECT * FROM a INNER JOIN b ON a.id = b.id',
      'SELECT * FROM a JOIN b WHERE a.id = b.id',
      'MERGE a WITH b ON a.id = b.id',
      'SELECT * FROM a, b WHERE a.id = b.id',
      'COMBINE a AND b ON id',
    ],
  },
  {
    q: 'Update email where id = 3',
    answer: "UPDATE users SET email='x' WHERE id=3",
    options: [
      "UPDATE users SET email='x' WHERE id=3",
      "MODIFY users SET email='x' WHERE id=3",
      "CHANGE users email='x' WHERE id=3",
      "SET users email='x' WHERE id=3",
      "UPDATE users email='x' id=3",
    ],
  },
];

// ── Algorithm Race Questions ─────────────────────────────────────────────────
export const RACE_QUESTIONS = [
  { q: 'Best algorithm for finding shortest path?', options: ["Dijkstra's", 'BFS', 'DFS', 'Bellman-Ford'], answer: "Dijkstra's" },
  { q: 'O(n log n) average — which sort?', options: ['Bubble Sort', 'QuickSort', 'Selection Sort', 'Insertion Sort'], answer: 'QuickSort' },
  { q: 'Which is NOT a greedy algorithm?', options: ["Dijkstra's", "Kruskal's", 'Merge Sort', "Prim's"], answer: 'Merge Sort' },
  { q: 'Best for searching in sorted array?', options: ['Linear Search', 'Binary Search', 'Jump Search', 'Hash Search'], answer: 'Binary Search' },
  { q: 'Which uses dynamic programming?', options: ['QuickSort', 'MergeSort', 'Floyd-Warshall', 'BFS'], answer: 'Floyd-Warshall' },
  { q: 'Time complexity of Bubble Sort (worst)?', options: ['O(n)', 'O(n log n)', 'O(n²)', 'O(log n)'], answer: 'O(n²)' },
  { q: 'Which algorithm detects negative cycles?', options: ["Dijkstra's", 'BFS', 'Bellman-Ford', 'DFS'], answer: 'Bellman-Ford' },
  { q: 'Optimal for nearly sorted data?', options: ['Heap Sort', 'Merge Sort', 'Insertion Sort', 'Quick Sort'], answer: 'Insertion Sort' },
];
