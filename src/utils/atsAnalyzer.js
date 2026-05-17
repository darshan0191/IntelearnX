/**
 * Real-time ATS (Applicant Tracking System) Readability & Optimization Analyzer.
 * Computes a score out of 100 and yields actionable improvement steps.
 */
export function analyzeATS(data, templateId) {
  if (!data) return { score: 0, feedback: [] };

  let score = 0;
  const feedback = [];

  // 1. Contact Details Integration (Max 15 points)
  let contactPoints = 0;
  const contactChecks = [
    { field: 'email', name: 'Email Address', pts: 3 },
    { field: 'phone', name: 'Phone Number', pts: 3 },
    { field: 'location', name: 'Location (City, Country)', pts: 3 },
    { field: 'linkedin', name: 'LinkedIn Profile Link', pts: 3 },
    { field: 'github', name: 'GitHub Profile Link', pts: 3 },
  ];

  contactChecks.forEach(({ field, name, pts }) => {
    if (data[field] && data[field].trim().length > 3) {
      contactPoints += pts;
    } else {
      feedback.push({
        type: 'warning',
        category: 'contact',
        text: `Add your ${name} to enable seamless recruiter callbacks.`,
      });
    }
  });
  score += contactPoints;

  // 2. ATS Template Column Layout Safeguard (Max 20 points)
  // Single column standard formats parse 100% reliably. Multi-column/sidebars risk jumbling.
  if (templateId === 'ats' || templateId === 'executive' || templateId === 'minimalist' || templateId === 'classic') {
    score += 20;
  } else {
    feedback.push({
      type: 'danger',
      category: 'layout',
      text: 'Multi-column/sidebar layouts can confuse legacy ATS parsers. Consider switching to Harvard Executive or Tech Minimalist for drives.',
    });
  }

  // 3. Action Verb & Impact Metrics Check (Max 25 points)
  const actionVerbs = [
    'developed', 'engineered', 'spearheaded', 'designed', 'optimized',
    'implemented', 'streamlined', 'architected', 'led', 'achieved',
    'built', 'created', 'resolved', 'boosted', 'launched', 'managed',
    'delivered', 'coordinated', 'leveraged', 'facilitated', 'formulated',
    'pioneered', 'restructured', 'automated', 'executed', 'conducted'
  ];

  const experienceText = (data.experience || []).map(e => (e.description || '')).join(' ');
  const projectsText = (data.projects || []).map(p => (p.description || '')).join(' ');
  const summaryText = data.summary || '';
  const mergedText = `${summaryText} ${experienceText} ${projectsText}`.toLowerCase();

  let foundVerbs = 0;
  actionVerbs.forEach(verb => {
    if (mergedText.includes(verb)) {
      foundVerbs++;
    }
  });

  // Score action verbs (Max 15)
  if (foundVerbs >= 5) {
    score += 15;
  } else if (foundVerbs >= 2) {
    score += 8;
    feedback.push({
      type: 'warning',
      category: 'verbs',
      text: 'Inject more strong action verbs (e.g. "Engineered", "Optimized", "Automated") to start your project sentences.',
    });
  } else {
    feedback.push({
      type: 'danger',
      category: 'verbs',
      text: 'No standard action verbs found in descriptions. Standardize descriptions using the STAR method (Situation, Task, Action, Result).',
    });
  }

  // Score metrics (Max 10) - Look for percentages, ratios, growth numbers, or currency
  const hasImpactMetric = /\b\d+(%|\+)?\b/.test(mergedText) || /\b(reduced|increased|improved|saved)\b/i.test(mergedText);
  if (hasImpactMetric) {
    score += 10;
  } else {
    feedback.push({
      type: 'info',
      category: 'metrics',
      text: 'Add quantifiable metrics (e.g. "improved latency by 30%" or "boosted quiz completion rates") to substantiate your achievements.',
    });
  }

  // 4. Skills & Placement Keyword Density (Max 20 points)
  const skillsCount = data.skills?.length || 0;
  if (skillsCount >= 8) {
    score += 20;
  } else if (skillsCount >= 4) {
    score += 12;
    feedback.push({
      type: 'warning',
      category: 'skills',
      text: 'Include at least 8 specialized core skills (languages, libraries, tools) to hit recruitment search keywords.',
    });
  } else {
    score += 5;
    feedback.push({
      type: 'danger',
      category: 'skills',
      text: 'Critical skill section is thin. Add core competencies and technical frameworks to match resume screeners.',
    });
  }

  // 5. Structure & Length Density (Max 20 points)
  const wordCount = mergedText.split(/\s+/).filter(Boolean).length;
  if (wordCount >= 180 && wordCount <= 450) {
    score += 20;
  } else if (wordCount > 450) {
    score += 12;
    feedback.push({
      type: 'info',
      category: 'length',
      text: 'Resume text is long. Ensure experience bullets are concise so your resume fits neatly on a single page.',
    });
  } else {
    score += 8;
    feedback.push({
      type: 'warning',
      category: 'length',
      text: 'Resume is light in substance. Write descriptive bullet points for your projects and internships to improve keyword hit rate.',
    });
  }

  return {
    score: Math.min(Math.round(score), 100),
    feedback
  };
}
