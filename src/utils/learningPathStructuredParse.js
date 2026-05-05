/**
 * Parse AI learning-path responses that use a structured JSON schema.
 */

export function stripAiJsonFence(text) {
  let t = String(text || '').trim();
  t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  return t;
}

function normalizeYoutubeUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const u = url.trim();
  if (!/^https?:\/\/(www\.)?(youtube\.com\/(watch\?v=|embed\/)|youtu\.be\/)/i.test(u)) return '';
  return u;
}

function normalizeSubtopic(s) {
  if (!s || typeof s !== 'object') return null;
  const name = String(s.name || s.title || '').trim();
  if (!name) return null;
  const url = normalizeYoutubeUrl(s.youtubeUrl);
  const q = s.youtubeSearchQuery != null ? String(s.youtubeSearchQuery).trim() : '';
  return {
    name,
    detail: s.detail ? String(s.detail).trim() : '',
    youtubeUrl: url,
    youtubeSearchQuery: q,
  };
}

function normalizePhase(p, i) {
  if (!p || typeof p !== 'object') return null;
  const rawSubs = Array.isArray(p.subtopics) ? p.subtopics : [];
  const subtopics = rawSubs.map(normalizeSubtopic).filter(Boolean);
  const seq = p.studySequence || p.studyBlocks || p.blocks;
  const studySequence = Array.isArray(seq) ? seq.map((x) => String(x).trim()).filter(Boolean) : [];
  const dayNum = typeof p.day === 'number' ? p.day : typeof p.dayNumber === 'number' ? p.dayNumber : i + 1;
  return {
    day: dayNum,
    title: String(p.title || `Day ${dayNum}`).trim(),
    timeEstimate: p.timeEstimate ? String(p.timeEstimate).trim() : '',
    overview: p.overview ? String(p.overview).trim() : '',
    studySequence,
    subtopics,
    actions: Array.isArray(p.actions) ? p.actions.map((x) => String(x).trim()).filter(Boolean) : [],
  };
}

function normalizeSevenDayPlanItem(d, i) {
  return normalizePhase(
    {
      ...d,
      day: d.day ?? d.dayNumber ?? i + 1,
      title: d.title || `Day ${i + 1}`,
    },
    i,
  );
}

export function normalizeStructuredRoadmap(data) {
  if (!data || typeof data !== 'object') return null;
  let phasesIn = Array.isArray(data.phases) ? data.phases : [];
  const seven = Array.isArray(data.sevenDayPlan) ? data.sevenDayPlan : null;
  if (seven?.length) {
    phasesIn = seven.map((d, i) => normalizeSevenDayPlanItem(d, i)).filter(Boolean);
  } else {
    phasesIn = phasesIn.map(normalizePhase).filter(Boolean);
  }
  const phases = phasesIn;
  if (!phases.length) return null;

  let diagramMermaid =
    typeof data.diagramMermaid === 'string'
      ? data.diagramMermaid.trim()
      : typeof data.diagram === 'string'
        ? data.diagram.trim()
        : '';
  if (!diagramMermaid && data.flowDiagramMermaid) {
    diagramMermaid = String(data.flowDiagramMermaid).trim();
  }

  return {
    primaryTopic: String(data.primaryTopic || '').trim(),
    summary: String(data.summary || '').trim(),
    diagramDescription: String(data.diagramDescription || '').trim(),
    diagramMermaid,
    phases,
    funChallenge: data.funChallenge ? String(data.funChallenge).trim() : '',
    quizReminder: data.quizReminder ? String(data.quizReminder).trim() : '',
  };
}

/** Stable id for saved journey progress; changes when phase titles / count change. */
export function learningPathFingerprint(structured) {
  if (!structured?.phases?.length) return '';
  const titles = structured.phases.map((p) => p.title).join('\u0001');
  let h = 5381;
  for (let i = 0; i < titles.length; i += 1) {
    h = ((h << 5) + h) ^ titles.charCodeAt(i);
  }
  return `lp_${(h >>> 0).toString(36)}_${structured.phases.length}`;
}

export function parseStructuredRoadmap(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const cleaned = stripAiJsonFence(raw);
  try {
    const data = JSON.parse(cleaned);
    return normalizeStructuredRoadmap(data);
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
      const data = JSON.parse(m[0]);
      return normalizeStructuredRoadmap(data);
    } catch {
      return null;
    }
  }
}
