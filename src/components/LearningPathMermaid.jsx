import { useEffect, useRef, useState } from 'react';

let configured = false;

function ensureMermaidConfig(mermaid) {
  if (configured) return;
  mermaid.initialize({
    startOnLoad: false,
    theme: 'base',
    securityLevel: 'loose',
    fontFamily: 'inherit',
    themeVariables: {
      primaryColor: '#ede9fe',
      primaryTextColor: '#1e1b4b',
      primaryBorderColor: '#a78bfa',
      lineColor: '#64748b',
      secondaryColor: '#fefefe',
      tertiaryColor: '#fff7ed',
    },
  });
  configured = true;
}

export default function LearningPathMermaid({ code }) {
  const seqRef = useRef(0);
  const [svg, setSvg] = useState('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const def = (code || '').trim();
    if (!def) {
      setSvg('');
      setFailed(false);
      return;
    }

    let cancelled = false;
    seqRef.current += 1;
    const renderId = `lp-mmd-${seqRef.current}-${Date.now()}`;

    setFailed(false);
    setSvg('');

    (async () => {
      try {
        const { default: mermaid } = await import('mermaid');
        ensureMermaidConfig(mermaid);
        const { svg: out } = await mermaid.render(renderId, def);
        if (!cancelled) setSvg(out);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [code]);

  if (!(code || '').trim()) return null;

  if (failed) {
    return (
      <div className="lp-diagram-fallback-wrap">
        <p className="lp-diagram-note">Could not render the flow diagram automatically. Raw Mermaid source:</p>
        <pre className="lp-diagram-pre" tabIndex={0}>{code.trim()}</pre>
      </div>
    );
  }

  if (!svg) {
    return <div className="lp-mermaid-loading">Drawing flow diagram…</div>;
  }

  return (
    <div
      className="lp-mermaid-svg"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
