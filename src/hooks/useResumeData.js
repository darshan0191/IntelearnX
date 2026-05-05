import { useState, useEffect } from 'react';
import { getPerformanceData, getUserBadges } from '../services/storageService';
import { badgeDefinitions } from '../data/quizData';
import { SKILL_AXES } from '../utils/dashboardInsights';

/**
 * Bootstraps resume form data from the user's IntelearnX profile + performance.
 * Returns { data, setData, loading }.
 */
export function useResumeData(user) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;

    async function bootstrap() {
      try {
        const [perf, earnedIds] = await Promise.all([
          getPerformanceData(user.id),
          getUserBadges(user.id),
        ]);

        // Derive strong subjects as skills
        const subjectSkills = Object.entries(perf?.subjectAccuracy || {})
          .filter(([, v]) => v.total > 0)
          .sort((a, b) => (b[1].correct / b[1].total) - (a[1].correct / a[1].total))
          .map(([subject]) => subject);

        // Earned badge names as achievements
        const badgeAchievements = (earnedIds || [])
          .map(id => badgeDefinitions.find(b => b.id === id))
          .filter(Boolean)
          .map(b => ({ title: `${b.icon} ${b.name}`, description: b.description }));

        // Study keywords → extra skills
        const keywordSkills = user.studyKeywords
          ? user.studyKeywords.split(/[,;]+/).map(s => s.trim()).filter(Boolean).slice(0, 8)
          : [];

        const allSkills = [...new Set([...subjectSkills, ...keywordSkills])];

        setData({
          name: user.name || '',
          email: user.email || '',
          title: user.selectedSubject ? `${user.selectedSubject} Developer` : 'Software Developer',
          phone: '',
          location: '',
          linkedin: '',
          github: '',
          website: '',
          summary: buildSummary(user, perf),
          education: [{ degree: '', institution: '', year: '', gpa: '' }],
          experience: [],
          projects: [],
          skills: allSkills.length ? allSkills : ['JavaScript', 'React', 'Node.js'],
          achievements: badgeAchievements.slice(0, 5),
        });
      } catch (err) {
        console.error('useResumeData error', err);
        setData({
          name: user.name || '', email: user.email || '', title: 'Software Developer',
          phone: '', location: '', linkedin: '', github: '', website: '',
          summary: '', education: [], experience: [], projects: [], skills: [], achievements: [],
        });
      } finally {
        setLoading(false);
      }
    }

    bootstrap();
  }, [user?.id]);

  return { data, setData, loading };
}

function buildSummary(user, perf) {
  const quizzes = perf?.totalQuizzes || 0;
  const accuracy = perf?.overallAccuracy || 0;
  const subject = user?.selectedSubject || 'software development';
  const level = user?.level || 1;
  if (quizzes === 0) return '';
  return `Motivated ${subject} student with hands-on experience through ${quizzes} adaptive quizzes on IntelearnX, achieving ${accuracy}% overall accuracy. Currently at Level ${level} with a focus on continuous learning and problem-solving.`;
}
