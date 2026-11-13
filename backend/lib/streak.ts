export function getCurrentStreak(activityDates: string[], now = new Date()): number {
  const activeDays = new Set(activityDates);
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const yesterday = new Date(today);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);

  if (!activeDays.has(today.toISOString().slice(0, 10))
    && !activeDays.has(yesterday.toISOString().slice(0, 10))) {
    return 0;
  }

  let streak = 0;
  const day = activeDays.has(today.toISOString().slice(0, 10)) ? today : yesterday;
  while (activeDays.has(day.toISOString().slice(0, 10))) {
    streak += 1;
    day.setUTCDate(day.getUTCDate() - 1);
  }
  return streak;
}
