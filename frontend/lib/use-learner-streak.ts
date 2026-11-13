'use client';

import { useEffect, useState } from 'react';
import { fetchWithUserSession } from './supabase';

export const learnerProgressUpdatedEvent = 'bb:learner-progress-updated';

export function useLearnerStreak() {
  const [streak, setStreak] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    async function loadStreak() {
      try {
        const response = await fetchWithUserSession('/api/progress');
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Your learning streak could not be loaded.');
        if (active && Number.isInteger(data.streak) && data.streak >= 0) setStreak(data.streak);
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
