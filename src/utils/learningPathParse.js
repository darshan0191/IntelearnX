/**
 * Turn AI roadmap text into display blocks (split on numbered lines).
 */
export function parseRoadmapSteps(text) {
  if (!text?.trim()) return [];
  const parts = text.split(/\n(?=\s*\d+[.)]\s)/);
  return parts
    .map((block, i) => {
      const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
      if (!lines.length) return null;
      const first = lines[0];
      const m = first.match(/^\d+[.)]\s*(.+)$/);
      const title = (m ? m[1] : first).replace(/\*\*/g, '').trim();
      const rest = m ? lines.slice(1) : lines.slice(1);
      const bullets = rest
        .filter((l) => /^[•\-*]/.test(l))
        .map((l) => l.replace(/^[•\-*]\s*/, '').replace(/\*\*/g, '').trim());
      return {
        id: `b-${i}`,
        title,
        lines: bullets.length ? bullets : rest.map((l) => l.replace(/\*\*/g, '').trim()).filter(Boolean),
      };
    })
    .filter(Boolean);
}
