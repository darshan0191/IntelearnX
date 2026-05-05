import { useMemo } from 'react';

/**
 * Roadmap = flowchart: one node per day/task, edges between stops, car sits on the active node.
 */
export default function LearningPathRoadmapFlow({ phases, activeIndex }) {
  const n = phases?.length || 0;
  if (n === 0) return null;

  const safeIdx = Math.min(Math.max(activeIndex, 0), n - 1);
  const w = 680;
  const h = 150;
  const padX = 56;
  const padY = 42;

  const points = useMemo(() => {
    return Array.from({ length: n }, (_, i) => {
      const t = n <= 1 ? 0.5 : i / (n - 1);
      const x = padX + t * (w - 2 * padX);
      const y = padY + Math.sin(t * Math.PI) * 36 + (i % 2 === 0 ? 0 : 6);
      return { x, y, t };
    });
  }, [n]);

  const pathD = useMemo(() => {
    if (points.length < 2) return `M ${points[0].x} ${points[0].y}`;
    return points.reduce((acc, p, i) => {
      if (i === 0) return `M ${p.x} ${p.y}`;
      const prev = points[i - 1];
      const cx = (prev.x + p.x) / 2;
      const cy = (prev.y + p.y) / 2 + (i % 2 === 0 ? 10 : -10);
      return `${acc} Q ${cx} ${cy} ${p.x} ${p.y}`;
    }, '');
  }, [points]);

  const car = points[safeIdx];

  const shortTitle = (full) => {
    const s = String(full || '');
    const m = s.match(/Day\s*\d+\s*—\s*(.+)/i);
    const rest = m ? m[1] : s;
    return rest.length > 22 ? `${rest.slice(0, 21)}…` : rest;
  };

  return (
    <div className="lp-flow">
      <div className="lp-flow-header">
        <span className="lp-flow-badge">Roadmap</span>
        <p className="lp-flow-hint">
          Each circle is a <strong>day / task stop</strong> in order. Finish today’s work, then go to <strong>Next stop</strong> — the car moves along this path.
        </p>
      </div>

      <div className="lp-flow-svg-wrap">
        <svg
          className="lp-flow-svg"
          viewBox={`0 0 ${w} ${h}`}
          preserveAspectRatio="xMidYMid meet"
          aria-hidden
        >
          <defs>
            <linearGradient id="lpFlowEdge" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#94a3b8" />
              <stop offset="100%" stopColor="#475569" />
            </linearGradient>
          </defs>

          <path
            d={pathD}
            fill="none"
            stroke="url(#lpFlowEdge)"
            strokeWidth="10"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.95}
          />
          <path
            d={pathD}
            fill="none"
            stroke="rgba(255,255,255,0.65)"
            strokeWidth="1.5"
            strokeDasharray="8 10"
            strokeLinecap="round"
          />

          {points.map((p, i) => {
            const done = i < safeIdx;
            const on = i === safeIdx;
            const r = on ? 16 : 14;
            return (
              <g key={i} className={`lp-flow-node ${done ? 'is-done' : ''} ${on ? 'is-on' : ''}`}>
                <circle cx={p.x} cy={p.y} r={r + 4} fill="rgba(167,139,250,0.15)" className="lp-flow-node-glow" />
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={r}
                  fill={done ? '#22c55e' : on ? '#0f172a' : '#334155'}
                  stroke={on ? '#fbbf24' : '#e2e8f0'}
                  strokeWidth={on ? 3 : 2}
                />
                <text
                  x={p.x}
                  y={p.y + 5}
                  textAnchor="middle"
                  fill="#fff"
                  fontSize="12"
                  fontWeight="800"
                >
                  {i + 1}
                </text>
                <text
                  x={p.x}
                  y={p.y + 34}
                  textAnchor="middle"
                  fill="#64748b"
                  fontSize="9"
                  fontWeight="600"
                >
                  {shortTitle(phases[i]?.title)}
                </text>
              </g>
            );
          })}

          <g
            style={{
              transform: `translate(${car.x}px, ${car.y - 36}px)`,
              transition: 'transform 0.85s cubic-bezier(0.33, 1.15, 0.48, 1)',
            }}
          >
            <text textAnchor="middle" fontSize="26" style={{ filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.35))' }}>
              🚗
            </text>
          </g>
        </svg>
      </div>
    </div>
  );
}
