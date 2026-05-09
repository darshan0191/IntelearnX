/**
 * Engineering Domain Guard
 *
 * Validates that user queries, search terms, and study topics fall within the
 * engineering domain. IntelearnX is restricted to engineering subjects only.
 *
 * Covers: Computer Science, Software Engineering, Electrical, Mechanical,
 * Civil, Chemical, Electronics, Aerospace, Biomedical Engineering, IT,
 * Data Science, AI/ML, Robotics, Networking, Cybersecurity, Mathematics
 * (engineering context), Physics (engineering context), and related areas.
 */

// ── Engineering-related keywords & phrases (lowercase) ──
const ENGINEERING_KEYWORDS = [
  // Computer Science & Software
  'programming', 'coding', 'software', 'algorithm', 'data structure', 'dsa',
  'web development', 'frontend', 'backend', 'full stack', 'fullstack',
  'html', 'css', 'javascript', 'typescript', 'react', 'angular', 'vue',
  'node', 'express', 'django', 'flask', 'spring', 'java', 'python', 'c++',
  'c#', 'rust', 'golang', 'go lang', 'ruby', 'php', 'swift', 'kotlin',
  'api', 'rest', 'graphql', 'microservice', 'devops', 'ci/cd', 'cicd',
  'docker', 'kubernetes', 'cloud', 'aws', 'azure', 'gcp', 'serverless',
  'database', 'sql', 'nosql', 'mongodb', 'postgresql', 'mysql', 'redis',
  'git', 'version control', 'agile', 'scrum', 'sdlc', 'testing',
  'unit test', 'integration test', 'deployment', 'debugging',
  'compiler', 'interpreter', 'operating system', 'os', 'linux', 'unix',
  'kernel', 'thread', 'process', 'concurrency', 'parallelism',
  'object oriented', 'oop', 'oops', 'design pattern', 'solid',
  'polymorphism', 'inheritance', 'encapsulation', 'abstraction',
  'clean code', 'refactoring', 'architecture', 'system design',
  'leetcode', 'competitive programming', 'cp',

  // Data Science & AI/ML
  'machine learning', 'deep learning', 'artificial intelligence', 'ai', 'ml',
  'neural network', 'nlp', 'natural language processing', 'computer vision',
  'data science', 'data analytics', 'data engineering', 'big data',
  'tensorflow', 'pytorch', 'scikit', 'pandas', 'numpy', 'matplotlib',
  'statistics', 'regression', 'classification', 'clustering',
  'reinforcement learning', 'generative ai', 'llm', 'transformer',
  'cnn', 'rnn', 'lstm', 'gan', 'diffusion',

  // Electrical & Electronics
  'electrical', 'electronics', 'circuit', 'resistor', 'capacitor',
  'inductor', 'transistor', 'diode', 'amplifier', 'op-amp', 'opamp',
  'semiconductor', 'vlsi', 'embedded', 'microcontroller', 'microprocessor',
  'arduino', 'raspberry pi', 'iot', 'internet of things',
  'signal processing', 'digital signal', 'analog', 'digital',
  'power system', 'power electronics', 'control system',
  'electromagnetic', 'antenna', 'rf', 'communication system',
  'pcb', 'fpga', 'verilog', 'vhdl', 'asic',

  // Mechanical Engineering
  'mechanical', 'thermodynamics', 'heat transfer', 'fluid mechanics',
  'fluid dynamics', 'aerodynamics', 'kinematics', 'dynamics',
  'statics', 'strength of materials', 'material science',
  'manufacturing', 'machining', 'cnc', 'cad', 'cam',
  'solidworks', 'autocad', 'catia', 'ansys',
  'machine design', 'mechanism', 'gear', 'bearing', 'shaft',
  'hydraulics', 'pneumatics', 'vibration', 'acoustics',
  'automobile', 'automotive', 'ic engine', 'combustion',
  'refrigeration', 'hvac', 'turbine', 'compressor',

  // Civil Engineering
  'civil engineering', 'structural', 'construction', 'concrete',
  'steel structure', 'foundation', 'geotechnical', 'soil mechanics',
  'surveying', 'transportation', 'highway', 'bridge',
  'water resource', 'hydrology', 'hydraulic',
  'environmental engineering', 'waste management',
  'building design', 'earthquake', 'seismic',

  // Chemical Engineering
  'chemical engineering', 'reaction engineering', 'mass transfer',
  'heat exchanger', 'distillation', 'reactor design',
  'process control', 'process engineering', 'petrochemical',
  'polymer', 'catalysis', 'biochemical engineering',

  // Aerospace Engineering
  'aerospace', 'aeronautical', 'avionics', 'propulsion',
  'rocket', 'satellite', 'orbital mechanics', 'flight dynamics',

  // Biomedical Engineering
  'biomedical engineering', 'biomechanics', 'medical device',
  'bioinformatics', 'bioelectronics', 'prosthetics',

  // Networking & Cybersecurity
  'networking', 'network', 'tcp', 'ip', 'http', 'https', 'dns',
  'firewall', 'router', 'switch', 'ethernet', 'wifi', 'wireless',
  'cybersecurity', 'cyber security', 'encryption', 'cryptography',
  'penetration testing', 'ethical hacking', 'malware', 'vulnerability',
  'information security', 'infosec',

  // Mathematics (Engineering context)
  'calculus', 'differential equation', 'linear algebra', 'matrix',
  'vector', 'laplace', 'fourier', 'probability', 'discrete mathematics',
  'graph theory', 'combinatorics', 'numerical method', 'optimization',
  'complex analysis', 'transform', 'engineering mathematics',

  // Physics (Engineering context)
  'physics', 'mechanics', 'optics', 'wave', 'quantum',
  'electrostatics', 'magnetism', 'electricity', 'force',
  'motion', 'energy', 'torque', 'angular momentum',
  'gravitation', 'oscillation', 'rotation',

  // General Engineering
  'engineering', 'engineer', 'technical', 'technology',
  'robotics', 'automation', 'plc', 'scada',
  'cae', 'fea', 'cfd', 'simulation', 'modelling', 'modeling',
  'prototype', 'innovation', 'patent', 'r&d',
  'quality control', 'six sigma', 'lean manufacturing',
  'project management', 'engineering drawing', 'blueprint',

  // Engineering Exams
  'gate', 'jee', 'jee main', 'jee advanced', 'iit',
  'nit', 'iiit', 'bits', 'gre', 'ese', 'isro',
];

// ── Explicit non-engineering topics to reject ──
const NON_ENGINEERING_KEYWORDS = [
  // Medical/Health (non-biomedical-engineering)
  'mbbs', 'neet', 'surgery', 'diagnosis', 'patient care', 'pharmacy',
  'nursing', 'anatomy', 'physiology', 'pathology', 'clinical',
  'medicine', 'doctor', 'hospital', 'prescription', 'symptom',
  'disease', 'treatment', 'therapy', 'dental', 'cardiology',
  'oncology', 'pediatrics', 'radiology', 'dermatology',

  // Commerce & Finance
  'accounting', 'chartered accountant', 'ca exam', 'tally',
  'balance sheet', 'audit', 'taxation', 'gst', 'income tax',
  'stock market', 'mutual fund', 'investment banking',
  'commerce', 'business studies', 'marketing', 'mba',
  'economics', 'macroeconomics', 'microeconomics',
  'financial accounting', 'cost accounting',
  'supply chain', 'logistics', 'human resource', 'hr',

  // Arts & Humanities
  'literature', 'poetry', 'novel', 'drama', 'fiction',
  'history', 'geography', 'political science', 'sociology',
  'psychology', 'philosophy', 'anthropology', 'archaeology',
  'linguistics', 'language learning', 'grammar',

  // Law
  'law', 'legal', 'court', 'judiciary', 'constitution',
  'criminal law', 'civil law', 'advocate', 'clat',

  // Entertainment & Lifestyle
  'cooking', 'recipe', 'fashion', 'beauty', 'makeup',
  'sports', 'cricket', 'football', 'basketball',
  'music', 'singing', 'dancing', 'painting', 'art',
  'movie', 'film', 'celebrity', 'gossip',
  'travel', 'tourism', 'hotel management',
  'fitness', 'yoga', 'meditation', 'diet',
  'astrology', 'horoscope',

  // Agriculture
  'agriculture', 'farming', 'crop', 'horticulture',
  'animal husbandry', 'veterinary',

  // Other non-engineering exams
  'upsc', 'ssc', 'bank exam', 'ias', 'ips', 'cat exam',
];

/**
 * Check whether a given text query is related to the engineering domain.
 *
 * @param {string} text — The user's search query, topic, or prompt
 * @returns {{ isEngineering: boolean, confidence: 'high'|'medium'|'low' }}
 */
export function validateEngineeringDomain(text) {
  if (!text || typeof text !== 'string') {
    return { isEngineering: false, confidence: 'high' };
  }

  const lower = text.toLowerCase().trim();

  // Very short queries (< 2 chars) — reject
  if (lower.length < 2) {
    return { isEngineering: false, confidence: 'low' };
  }

  // Check for explicit non-engineering keywords first
  const hasNonEngineering = NON_ENGINEERING_KEYWORDS.some((kw) =>
    lower.includes(kw)
  );

  // Check for engineering keywords
  const hasEngineering = ENGINEERING_KEYWORDS.some((kw) =>
    lower.includes(kw)
  );

  // If both are present, engineering wins (e.g. "machine learning in medicine" is borderline engineering)
  if (hasEngineering && hasNonEngineering) {
    return { isEngineering: true, confidence: 'medium' };
  }

  if (hasEngineering) {
    return { isEngineering: true, confidence: 'high' };
  }

  if (hasNonEngineering) {
    return { isEngineering: false, confidence: 'high' };
  }

  // If we can't determine, default to reject (strict mode)
  return { isEngineering: false, confidence: 'low' };
}

/**
 * Human-friendly rejection message.
 */
export const OUT_OF_DOMAIN_MESSAGE =
  '🚫 This search is out of domain. IntelearnX is dedicated to engineering subjects only (Computer Science, Electronics, Mechanical, Civil, Chemical, Aerospace, etc.). Please search for engineering-related topics.';

/**
 * Shorter inline message for compact UI contexts.
 */
export const OUT_OF_DOMAIN_SHORT =
  'Out of domain — IntelearnX covers engineering subjects only.';
