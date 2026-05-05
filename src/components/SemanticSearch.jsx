import { useState, useRef, useEffect } from 'react';
import { semanticSearch, isVectorDbConfigured, retrieveContext } from '../services/vectorService';
import { getQuizHistory } from '../services/storageService';
import { geminiGenerate, isGeminiConfigured } from '../services/openaiClient';
import { validateEngineeringDomain, OUT_OF_DOMAIN_MESSAGE } from '../utils/engineeringDomainGuard';
import {
  LuSearch, LuLoader, LuSparkles, LuBookOpen, LuFileText,
  LuBrain, LuX, LuChevronDown, LuChevronUp, LuShieldAlert,
} from 'react-icons/lu';
import './SemanticSearch.css';

/**
 * SemanticSearch — AI-powered semantic search bar.
 *
 * Searches across:
 *  1. PDF chunks stored in Qdrant (pdf_chunks collection)
 *  2. Quiz knowledge stored in Qdrant (quiz_knowledge collection)
 *  3. Quiz history from Firebase (getQuizHistory)
 *
 * Then uses Gemini to synthesize a comprehensive AI answer from the
 * combined context, showing source citations.
 *
 * Props:
 *  - userId {string} — current user ID for filtered results
 *  - placeholder {string} — custom placeholder text
 *  - maxResults {number} — max results to show (default 6)
 *  - compact {boolean} — compact mode for sidebar usage
 */
export default function SemanticSearch({
  userId = '',
  placeholder = 'Search your study material semantically…',
  maxResults = 6,
  compact = false,
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');
  const [expandedIdx, setExpandedIdx] = useState(null);
  const [aiAnswer, setAiAnswer] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  const configured = isVectorDbConfigured();
  const geminiReady = isGeminiConfigured();

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  const [domainRejected, setDomainRejected] = useState(false);

  // ── Search quiz history from Firebase for keyword matches ──
  const searchQuizHistory = async (searchQuery) => {
    if (!userId) return [];
    try {
      const history = await getQuizHistory(userId);
      const lowerQuery = searchQuery.toLowerCase();
      const queryTerms = lowerQuery.split(/\s+/).filter(t => t.length > 2);

      const matched = [];
      for (const quiz of history) {
        // Check if quiz topic/subject matches
        const topicMatch = queryTerms.some(term =>
          (quiz.topic || '').toLowerCase().includes(term) ||
          (quiz.subject || '').toLowerCase().includes(term)
        );

        // Check individual questions if available
        if (quiz.questions && Array.isArray(quiz.questions)) {
          for (const q of quiz.questions) {
            const qText = (q.question || '').toLowerCase();
            const aText = (q.correctAnswer || q.explanation || '').toLowerCase();
            const questionMatch = queryTerms.some(term =>
              qText.includes(term) || aText.includes(term)
            );

            if (questionMatch || topicMatch) {
              matched.push({
                id: `quiz-${quiz.id}-${q.id || Math.random()}`,
                score: questionMatch ? 0.7 : 0.5,
                source: 'quiz-history',
                payload: {
                  text: `Q: ${q.question}`,
                  question: q.question,
                  correctAnswer: q.correctAnswer || q.correct_answer || '',
                  explanation: q.explanation || '',
                  topic: quiz.topic || '',
                  subject: quiz.subject || '',
                  quizDate: quiz.timestamp,
                },
              });
            }
          }
        }

        // Also add quiz-level summary if topic matched
        if (topicMatch && !quiz.questions) {
          matched.push({
            id: `quizsummary-${quiz.id}`,
            score: 0.45,
            source: 'quiz-history',
            payload: {
              text: `Quiz: ${quiz.topic} (${quiz.subject}) — Score: ${quiz.correctAnswers}/${quiz.totalQuestions}`,
              topic: quiz.topic || '',
              subject: quiz.subject || '',
              quizDate: quiz.timestamp,
            },
          });
        }
      }
      return matched.slice(0, maxResults);
    } catch (e) {
      console.warn('Quiz history search failed:', e);
      return [];
    }
  };

  // ── Generate AI answer from combined context ──
  const generateAiAnswer = async (searchQuery, contextResults) => {
    if (!geminiReady || contextResults.length === 0) return;

    setAiLoading(true);
    try {
      // Build context from all sources
      const contextParts = contextResults
        .filter(r => r.score >= 0.3)
        .map((r, i) => {
          const sourceLabel = r.source === 'pdf' ? `[PDF: ${r.payload?.fileName || 'Document'}]`
            : r.source === 'quiz' ? '[Quiz Knowledge]'
            : '[Past Quiz]';
          const text = r.payload?.text || r.payload?.question || '';
          const answer = r.payload?.correctAnswer ? `\nAnswer: ${r.payload.correctAnswer}` : '';
          const explanation = r.payload?.explanation ? `\nExplanation: ${r.payload.explanation}` : '';
          return `Source ${i + 1} ${sourceLabel}:\n${text}${answer}${explanation}`;
        })
        .join('\n\n---\n\n');

      if (!contextParts.trim()) { setAiLoading(false); return; }

      const prompt = `You are an intelligent study assistant for IntelearnX, an engineering learning platform.

A student asked: "${searchQuery}"

Below is the relevant context retrieved from their uploaded PDFs and past quiz data. Answer their question using ONLY the information below. Be accurate, concise, and educational.

CONTEXT:
${contextParts}

RULES:
1. Answer based ONLY on the context above. Do not make up information.
2. If the context directly answers the question, provide a clear, detailed answer.
3. If the context partially covers the topic, answer what you can and note what isn't covered.
4. Reference which source (PDF or Quiz) the information came from.
5. Format your answer with clear headings and bullet points where helpful.
6. Keep the answer focused and concise (2-4 paragraphs max).
7. If nothing in the context relates to the question, say "No relevant information found in your study materials for this query."

Answer:`;

      const response = await geminiGenerate(prompt, {
        systemPrompt: 'You are a helpful study assistant. Give clear, accurate answers based only on the provided context.',
        temperature: 0.3,
        maxOutputTokens: 1024,
        useCache: true,
      });

      setAiAnswer(response || '');
    } catch (e) {
      console.warn('AI answer generation failed:', e.message);
      setAiAnswer('');
    } finally {
      setAiLoading(false);
    }
  };

  const handleSearch = async (searchQuery) => {
    const q = (searchQuery || query).trim();
    if (!q || q.length < 3) return;

    // ── Engineering domain gate ──
    const { isEngineering } = validateEngineeringDomain(q);
    if (!isEngineering) {
      setDomainRejected(true);
      setResults([]);
      setAiAnswer('');
      setSearched(true);
      setLoading(false);
      return;
    }

    setDomainRejected(false);
    setLoading(true);
    setError('');
    setSearched(true);
    setExpandedIdx(null);
    setAiAnswer('');

    try {
      // Search all sources in parallel
      const searchPromises = [
        searchQuizHistory(q),
      ];

      if (configured) {
        searchPromises.push(
          semanticSearch('pdf_chunks', q, maxResults).catch(() => []),
          semanticSearch('quiz_knowledge', q, maxResults).catch(() => []),
        );
      }

      const [quizHistResults, pdfResults = [], quizVectorResults = []] = await Promise.all(searchPromises);

      // Merge, tag source, sort by score
      const merged = [
        ...pdfResults.map((r) => ({ ...r, source: 'pdf' })),
        ...quizVectorResults.map((r) => ({ ...r, source: 'quiz' })),
        ...quizHistResults.map((r) => r), // already tagged
      ]
        .sort((a, b) => b.score - a.score)
        .slice(0, maxResults);

      setResults(merged);
      setLoading(false);

      // Generate AI answer from combined context
      generateAiAnswer(q, merged);
    } catch (e) {
      setError(e.message || 'Search failed.');
      setResults([]);
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (val.trim().length >= 3) {
      debounceRef.current = setTimeout(() => handleSearch(val), 600);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      handleSearch();
    }
    if (e.key === 'Escape') {
      clearSearch();
    }
  };

  const clearSearch = () => {
    setQuery('');
    setResults([]);
    setSearched(false);
    setError('');
    setDomainRejected(false);
    setExpandedIdx(null);
    setAiAnswer('');
    inputRef.current?.focus();
  };

  const getSourceIcon = (source) => {
    if (source === 'pdf') return <LuFileText />;
    return <LuBrain />;
  };

  const getSourceLabel = (source) => {
    if (source === 'pdf') return 'PDF';
    if (source === 'quiz-history') return 'Past Quiz';
    return 'Quiz Knowledge';
  };

  const getRelevanceClass = (score) => {
    if (score >= 0.75) return 'high';
    if (score >= 0.5) return 'medium';
    return 'low';
  };

  return (
    <div className={`ss-container ${compact ? 'ss-compact' : ''}`} id="semantic-search">
      {/* Search Input */}
      <div className="ss-input-wrap">
        <LuSearch className="ss-input-icon" />
        <input
          ref={inputRef}
          type="text"
          className="ss-input"
          placeholder={placeholder}
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          id="semantic-search-input"
        />
        {loading && <LuLoader className="ss-input-loader pq-spin" />}
        {query && !loading && (
          <button className="ss-clear-btn" onClick={clearSearch} aria-label="Clear search">
            <LuX />
          </button>
        )}
        <button
          className="ss-search-btn"
          onClick={() => handleSearch()}
          disabled={loading || query.trim().length < 3}
          aria-label="Search"
        >
          <LuSparkles /> Search
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="ss-error">
          <span>⚠️ {error}</span>
        </div>
      )}

      {/* Domain rejection banner */}
      {domainRejected && (
        <div className="ss-domain-rejected">
          <LuShieldAlert className="ss-domain-rejected-icon" />
          <p>{OUT_OF_DOMAIN_MESSAGE}</p>
        </div>
      )}

      {/* Results */}
      {searched && !loading && !domainRejected && (
        <div className="ss-results">
          {/* AI Answer Section */}
          {(aiLoading || aiAnswer) && (
            <div className="ss-ai-answer">
              <div className="ss-ai-answer-header">
                <LuSparkles className="ss-ai-icon" />
                <span>AI Answer</span>
                {aiLoading && <LuLoader className="ss-ai-loader pq-spin" />}
              </div>
              {aiAnswer ? (
                <div className="ss-ai-answer-body">
                  {aiAnswer.split('\n').map((line, i) => {
                    if (!line.trim()) return <br key={i} />;
                    if (line.startsWith('**') && line.endsWith('**')) {
                      return <strong key={i} className="ss-ai-heading">{line.replace(/\*\*/g, '')}</strong>;
                    }
                    if (line.startsWith('- ') || line.startsWith('• ')) {
                      return <li key={i} className="ss-ai-bullet">{line.slice(2)}</li>;
                    }
                    return <p key={i}>{line}</p>;
                  })}
                </div>
              ) : (
                <p className="ss-ai-thinking">Synthesizing answer from your study materials…</p>
              )}
            </div>
          )}

          {results.length === 0 && !aiAnswer && !aiLoading ? (
            <div className="ss-no-results">
              <LuBookOpen className="ss-no-results-icon" />
              <p>No relevant results found for "<em>{query}</em>"</p>
              <span>Try different keywords or upload more PDFs to build your knowledge base.</span>
            </div>
          ) : results.length > 0 && (
            <>
              <div className="ss-results-header">
                <span className="ss-results-count">{results.length} source{results.length !== 1 ? 's' : ''} found</span>
                <span className="ss-results-tag"><LuSparkles /> Ranked by relevance</span>
              </div>
              <div className="ss-results-list">
                {results.map((r, idx) => {
                  const expanded = expandedIdx === idx;
                  const text = r.payload?.text || r.payload?.question || '';
                  const preview = text.slice(0, 150);
                  const hasMore = text.length > 150;
                  const relevance = getRelevanceClass(r.score);

                  return (
                    <div
                      key={r.id || idx}
                      className={`ss-result-card ${expanded ? 'expanded' : ''}`}
                      onClick={() => setExpandedIdx(expanded ? null : idx)}
                    >
                      <div className="ss-result-top">
                        <div className="ss-result-meta">
                          <span className={`ss-source-badge ss-source-${r.source}`}>
                            {getSourceIcon(r.source)} {getSourceLabel(r.source)}
                          </span>
                          <span className={`ss-relevance-badge ss-relevance-${relevance}`}>
                            {Math.round(r.score * 100)}% match
                          </span>
                          {r.payload?.topic && (
                            <span className="ss-topic-chip">{r.payload.topic}</span>
                          )}
                        </div>
                        {hasMore && (
                          <button className="ss-expand-btn" aria-label={expanded ? 'Collapse' : 'Expand'}>
                            {expanded ? <LuChevronUp /> : <LuChevronDown />}
                          </button>
                        )}
                      </div>

                      <p className="ss-result-text">
                        {expanded ? text : preview}{!expanded && hasMore ? '…' : ''}
                      </p>

                      {/* Extra details for quiz results */}
                      {expanded && (r.source === 'quiz' || r.source === 'quiz-history') && (
                        <div className="ss-result-extra">
                          {r.payload?.correctAnswer && (
                            <div className="ss-result-answer">
                              <strong>Answer:</strong> {r.payload.correctAnswer}
                            </div>
                          )}
                          {r.payload?.explanation && (
                            <div className="ss-result-explanation">
                              <strong>Explanation:</strong> {r.payload.explanation}
                            </div>
                          )}
                          {r.payload?.quizDate && (
                            <div className="ss-result-date">
                              Solved on: {new Date(r.payload.quizDate).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Extra details for PDF results */}
                      {expanded && r.source === 'pdf' && r.payload?.fileName && (
                        <div className="ss-result-extra">
                          <span className="ss-file-ref">
                            <LuFileText /> From: {r.payload.fileName}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
