'use client';

import { useEffect, useState } from 'react';
import { browserSupabase } from './supabase';

export const learnerProgressUpdatedEvent = 'bb:learner-progress-updated';

export function useLearnerStreak() {
  const [streak, setStreak] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    async function loadStreak() {
      try {
        // If Supabase is configured and user is logged in, read streak from learner_progress table
        if (browserSupabase) {
          const { data: session } = await browserSupabase.auth.getSession();
          if (session.session) {
            const { data, error } = await browserSupabase
              .from('learner_progress')
              .select('streak')
              .eq('user_id', session.session.user.id)
              .maybeSingle();
            if (!error && data && active) {
              setStreak(data.streak ?? 0);
              return;
            }
          }
        }
        // Fallback: compute streak from local activity_dates in localStorage
        const keys = Object.keys(localStorage).filter(k => k.startsWith('bb-lesson-progress'));
        let latestDates: string[] = [];
        for (const key of keys) {
          try {
            const raw = localStorage.getItem(key);
            if (!raw) continue;
            const parsed = JSON.parse(raw) as Record<string, { completedAt?: string | null }>;
            const dates = Object.values(parsed)
              .filter(r => r.completedAt)
              .map(r => r.completedAt!.slice(0, 10));
            if (dates.length > latestDates.length) latestDates = dates;
          } catch { /* skip */ }
        }
        if (active) {
          const unique = Array.from(new Set(latestDates)).sort();
          setStreak(computeStreak(unique));
        }
      } catch (error) {
        if (active) console.error('Unable to load learner streak', error);
      }
    }

    void loadStreak();
    window.addEventListener(learnerProgressUpdatedEvent, loadStreak);
    return () => {
      active = false;
      window.removeEventListener(learnerProgressUpdatedEvent, loadStreak);
    };
  }, []);

  return streak;
}

function computeStreak(sortedDates: string[]): number {
  if (sortedDates.length === 0) return 0;
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const set = new Set(sortedDates);
  if (!set.has(today) && !set.has(yesterday)) return 0;
  let streak = 0;
  const start = new Date(set.has(today) ? today : yesterday);
  while (set.has(start.toISOString().slice(0, 10))) {
    streak++;
    start.setDate(start.getDate() - 1);
  }
  return streak;
}
