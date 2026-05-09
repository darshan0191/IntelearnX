import { useState, useRef, useEffect, useCallback } from 'react';
import { geminiGenerate, isGeminiConfigured } from '../services/openaiClient';
import { retrieveContext, isVectorDbConfigured } from '../services/vectorService';
import { validateEngineeringDomain, OUT_OF_DOMAIN_MESSAGE } from '../utils/engineeringDomainGuard';
import {
  LuMessageCircle, LuSend, LuVolume2, LuVolumeX, LuTrash2,
  LuBrain, LuX, LuSparkles, LuTriangleAlert,
} from 'react-icons/lu';
import './AiDoubtsAgent.css';

/**
 * AiDoubtsAgent — Floating AI study assistant chatbot.
 *
 * Features:
 *  - Conversational AI powered by Gemini
 *  - RAG: pulls context from student's uploaded PDFs & quiz history
 *  - Text-to-Speech: each reply can be read aloud on demand
 *  - Auto-voice mode: automatically speaks every new reply
 *  - Engineering domain guard
 *  - Conversation history maintained in session
 *
 * Props:
 *  - userId {string} — current user ID for vector search filtering
 */

const SUGGESTION_PROMPTS = [
  'Explain binary search',
  'What is polymorphism?',
  'Ohm\'s law formula',
  'Explain TCP/IP model',
];

export default function AiDoubtsAgent({ userId = '' }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [autoVoice, setAutoVoice] = useState(false);
  const [speakingId, setSpeakingId] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const synthRef = useRef(typeof window !== 'undefined' ? window.speechSynthesis : null);

  const geminiReady = isGeminiConfigured();
  const vectorReady = isVectorDbConfigured();

  // Scroll to bottom on new messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading]);

  // Focus input when panel opens
  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [open]);

  // Cleanup speech on unmount
  useEffect(() => {
    return () => {
      if (synthRef.current) synthRef.current.cancel();
    };
  }, []);

  // ── Text-to-Speech ──
  const speakText = useCallback((text, msgId) => {
    const synth = synthRef.current;
    if (!synth) return;

    // Stop any current speech
    synth.cancel();

    // If clicking same message that's speaking, just stop
    if (speakingId === msgId) {
      setSpeakingId(null);
      return;
    }

    // Clean markdown for speech
    const cleanText = text
      .replace(/\*\*/g, '')
      .replace(/`[^`]+`/g, (m) => m.replace(/`/g, ''))
      .replace(/#{1,6}\s*/g, '')
      .replace(/[-•]\s/g, '')
      .replace(/\n+/g, '. ')
      .replace(/\s{2,}/g, ' ')
      .trim();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 0.95;
    utterance.pitch = 1;
    utterance.volume = 1;

    // Try to use a good English voice
    const voices = synth.getVoices();
    const preferred = voices.find(v =>
      v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Microsoft') || v.name.includes('Samantha'))
    ) || voices.find(v => v.lang.startsWith('en')) || voices[0];
    if (preferred) utterance.voice = preferred;

    utterance.onend = () => setSpeakingId(null);
    utterance.onerror = () => setSpeakingId(null);

    setSpeakingId(msgId);
    synth.speak(utterance);
  }, [speakingId]);

  const stopSpeaking = useCallback(() => {
    if (synthRef.current) synthRef.current.cancel();
    setSpeakingId(null);
  }, []);

  // ── Build system prompt with conversation context ──
  const buildSystemPrompt = useCallback((conversationHistory) => {
    const historyStr = conversationHistory
      .slice(-10) // Last 10 messages for context
      .map(m => `${m.role === 'user' ? 'Student' : 'Agent'}: ${m.text}`)
      .join('\n');

    return `You are IntelearnX AI Study Agent — a friendly, knowledgeable engineering tutor.

PERSONALITY:
- You are warm, encouraging, and patient
- You explain complex concepts simply using analogies when helpful
- You use clear formatting: bullet points, bold keywords, code blocks where appropriate
- You keep answers concise but thorough (3-5 paragraphs max)
- You always encourage further learning

DOMAIN:
- You ONLY answer engineering-related questions (CS, ECE, Mechanical, Civil, etc.)
- If a question is clearly outside engineering, politely redirect
- You can reference context from the student's uploaded study materials when available

CONVERSATION SO FAR:
${historyStr || '(New conversation)'}

RULES:
1. Be accurate — never fabricate facts
2. If you're unsure, say so honestly
3. Use markdown formatting for readability
4. Include relevant examples and code snippets when helpful
5. End with a follow-up suggestion or encouragement when appropriate`;
  }, []);

  // ── Send message ──
  const handleSend = useCallback(async (overrideText) => {
    const text = (overrideText || input).trim();
    if (!text || loading || !geminiReady) return;

    // Domain check
    const { isEngineering } = validateEngineeringDomain(text);
    if (!isEngineering) {
      const userMsg = { id: Date.now(), role: 'user', text, time: new Date() };
      const rejectMsg = {
        id: Date.now() + 1,
        role: 'agent',
        text: '🚫 ' + OUT_OF_DOMAIN_MESSAGE,
        time: new Date(),
      };
      setMessages(prev => [...prev, userMsg, rejectMsg]);
      setInput('');
      return;
    }

    const userMsg = { id: Date.now(), role: 'user', text, time: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      // Step 1: Retrieve relevant context from PDFs and quizzes (RAG)
      let ragContext = '';
      if (vectorReady) {
        try {
          const pdfCtx = await retrieveContext('pdf_chunks', text, { topK: 3, expand: false }).catch(() => ({ context: '' }));
          const quizCtx = await retrieveContext('quiz_knowledge', text, { topK: 3, expand: false }).catch(() => ({ context: '' }));
          const parts = [];
          if (pdfCtx.context) parts.push(`[From your PDFs]:\n${pdfCtx.context}`);
          if (quizCtx.context) parts.push(`[From your quizzes]:\n${quizCtx.context}`);
          if (parts.length > 0) {
            ragContext = `\n\nRELEVANT CONTEXT FROM STUDENT'S STUDY MATERIALS:\n${parts.join('\n\n---\n\n')}\n\nUse this context to enhance your answer when relevant. Cite it as "from your study materials" when you use it.`;
          }
        } catch (e) {
          console.warn('RAG retrieval failed:', e.message);
        }
      }

      // Step 2: Generate response with conversation history
      const allMessages = [...messages, userMsg];
      const systemPrompt = buildSystemPrompt(allMessages);

      const prompt = `${text}${ragContext}`;

      const response = await geminiGenerate(prompt, {
        systemPrompt,
        temperature: 0.4,
        maxOutputTokens: 1500,
        useCache: false,
      });

      const agentMsg = {
        id: Date.now() + 1,
        role: 'agent',
        text: response || 'I\'m sorry, I couldn\'t generate a response. Please try again.',
        time: new Date(),
      };
      setMessages(prev => [...prev, agentMsg]);

      // Auto-voice: speak the reply automatically
      if (autoVoice && response) {
        setTimeout(() => speakText(response, agentMsg.id), 300);
      }
    } catch (e) {
      const errorMsg = {
        id: Date.now() + 1,
        role: 'error',
        text: e.message || 'Failed to generate a response. Please try again.',
        time: new Date(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, geminiReady, vectorReady, messages, buildSystemPrompt, autoVoice, speakText]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = () => {
    stopSpeaking();
    setMessages([]);
  };

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // ── Render markdown-ish content ──
  const renderContent = (text) => {
    return text.split('\n').map((line, i) => {
      if (!line.trim()) return <br key={i} />;

      // Headers
      if (line.startsWith('### ')) return <strong key={i} style={{ display: 'block', margin: '6px 0 2px' }}>{line.slice(4)}</strong>;
      if (line.startsWith('## ')) return <strong key={i} style={{ display: 'block', margin: '6px 0 2px' }}>{line.slice(3)}</strong>;
      if (line.startsWith('# ')) return <strong key={i} style={{ display: 'block', margin: '8px 0 3px', fontSize: '1rem' }}>{line.slice(2)}</strong>;

      // Bold wrapping
      if (line.startsWith('**') && line.endsWith('**')) {
        return <strong key={i} style={{ display: 'block' }}>{line.replace(/\*\*/g, '')}</strong>;
      }

      // Bullets
      if (line.match(/^[-•*]\s/)) {
        return <li key={i}>{renderInline(line.slice(2))}</li>;
      }

      // Numbered list
      if (line.match(/^\d+\.\s/)) {
        return <li key={i} style={{ listStyle: 'decimal' }}>{renderInline(line.replace(/^\d+\.\s/, ''))}</li>;
      }

      // Code blocks
      if (line.startsWith('```')) return null;

      return <p key={i}>{renderInline(line)}</p>;
    });
  };

  // Inline formatting (bold, code)
  const renderInline = (text) => {
    const parts = [];
    let remaining = text;
    let key = 0;

    while (remaining) {
      // Bold
      const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
      // Inline code
      const codeMatch = remaining.match(/`([^`]+)`/);

      const matches = [boldMatch, codeMatch].filter(Boolean);
      if (matches.length === 0) {
        parts.push(remaining);
        break;
      }

      // Process the earliest match
      const earliest = matches.sort((a, b) => a.index - b.index)[0];
      if (earliest.index > 0) {
        parts.push(remaining.slice(0, earliest.index));
      }

      if (earliest === boldMatch) {
        parts.push(<strong key={key++}>{earliest[1]}</strong>);
      } else {
        parts.push(<code key={key++}>{earliest[1]}</code>);
      }

      remaining = remaining.slice(earliest.index + earliest[0].length);
    }

    return parts;
  };

  return (
    <>
      {/* Floating trigger button */}
      <button
        className={`ai-agent-trigger ${open ? 'open' : ''}`}
        onClick={() => setOpen(!open)}
        aria-label={open ? 'Close AI Agent' : 'Open AI Study Agent'}
        id="ai-doubts-agent-trigger"
      >
        {open ? <LuX /> : <LuBrain />}
        {!open && <span className="ai-agent-dot" />}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="ai-agent-panel" id="ai-doubts-agent-panel">
          {/* Header */}
          <div className="ai-agent-header">
            <div className="ai-agent-avatar">
              <LuSparkles />
            </div>
            <div className="ai-agent-header-info">
              <h3>IntelearnX Study Agent</h3>
              <span>Online — Ask any engineering doubt</span>
            </div>
            {messages.length > 0 && (
              <button
                className="ai-agent-clear-btn"
                onClick={clearChat}
                aria-label="Clear chat"
                title="Clear conversation"
              >
                <LuTrash2 />
              </button>
            )}
          </div>

          {/* Messages */}
          <div className="ai-agent-messages">
            {messages.length === 0 && !loading ? (
              <div className="ai-agent-welcome">
                <LuBrain className="ai-agent-welcome-icon" />
                <h4>Hi! I'm your study agent 🎓</h4>
                <p>
                  Ask me any engineering doubt — I'll answer using your study materials, PDFs, and quiz knowledge.
                </p>
                <div className="ai-agent-suggestions">
                  {SUGGESTION_PROMPTS.map((s, i) => (
                    <button key={i} onClick={() => handleSend(s)}>{s}</button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages.map((msg) => {
                  if (msg.role === 'error') {
                    return (
                      <div key={msg.id} className="ai-agent-error">
                        <LuTriangleAlert /> {msg.text}
                      </div>
                    );
                  }

                  return (
                    <div key={msg.id} className={`ai-msg ai-msg--${msg.role}`}>
                      <div className="ai-msg-bubble">
                        {msg.role === 'agent' ? renderContent(msg.text) : msg.text}
                      </div>
                      <div className="ai-msg-actions">
                        <span className="ai-msg-time">{formatTime(msg.time)}</span>
                        {msg.role === 'agent' && (
                          <button
                            className={`ai-msg-voice-btn ${speakingId === msg.id ? 'speaking' : ''}`}
                            onClick={() => speakText(msg.text, msg.id)}
                            title={speakingId === msg.id ? 'Stop speaking' : 'Read aloud'}
                          >
                            {speakingId === msg.id ? <LuVolumeX /> : <LuVolume2 />}
                            {speakingId === msg.id ? 'Stop' : 'Listen'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Typing indicator */}
                {loading && (
                  <div className="ai-msg ai-msg-typing">
                    <div className="ai-typing-dots">
                      <span /><span /><span />
                    </div>
                  </div>
                )}
              </>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="ai-agent-input-area">
            <button
              className={`ai-agent-voice-toggle ${autoVoice ? 'active' : ''}`}
              onClick={() => {
                setAutoVoice(!autoVoice);
                if (autoVoice) stopSpeaking();
              }}
              title={autoVoice ? 'Auto-voice ON: replies will be spoken aloud' : 'Auto-voice OFF: click to enable'}
            >
              {autoVoice ? <LuVolume2 /> : <LuVolumeX />}
              <span className="voice-label">{autoVoice ? 'ON' : 'OFF'}</span>
            </button>

            <textarea
              ref={inputRef}
              className="ai-agent-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask your doubt here…"
              rows={1}
              disabled={loading || !geminiReady}
              id="ai-doubts-agent-input"
            />

            <button
              className="ai-agent-send-btn"
              onClick={() => handleSend()}
              disabled={loading || !input.trim() || !geminiReady}
              aria-label="Send message"
              id="ai-doubts-agent-send"
            >
              <LuSend />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
