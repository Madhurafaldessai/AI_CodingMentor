import { NextResponse } from 'next/server';
import { getCurrentStreak } from '@backend/lib/streak';
import { authenticateUser } from '@backend/lib/user-supabase';

const lessonIds = new Set([
  'setting-up',
  'hello-world',
  'print-and-comments',
  'your-first-bug'
]);
const languages = new Set(['python', 'javascript', 'cpp']);

type LessonRecord = {
  attempts: number;
  completed: boolean;
  lastError: string | null;
  lastAttemptAt: string;
  completedAt: string | null;
};

async function syncBadges(
  client: any,
  userId: string,
  progress: Record<string, LessonRecord>,
  streak: number
): Promise<string[]> {
  const completedCount = Object.values(progress).filter(x => x.completed).length;
  const hadErrorSolved = Object.values(progress).some(x => Boolean(x.lastError) || (x.attempts || 0) > 1);
  const totalXp = completedCount * 50;

  const earnedList: string[] = [];
  if (completedCount >= 1) earnedList.push('first-steps');
  if (streak >= 1) earnedList.push('on-a-roll');
  if (hadErrorSolved) earnedList.push('bug-whisperer');
  if (totalXp >= 100) earnedList.push('next-up');

  const now = new Date().toISOString();
  for (const badgeId of earnedList) {
    try {
      await client.from('user_badges').upsert(
        { user_id: userId, badge_id: badgeId, earned_at: now },
        { onConflict: 'user_id,badge_id' }
      );
    } catch (e) {
      console.warn('Failed to upsert badge', badgeId, e);
    }
  }

  try {
    const { data: userBadges } = await client
      .from('user_badges')
      .select('badge_id')
      .eq('user_id', userId);
    return (userBadges || []).map((b: any) => b.badge_id);
  } catch {
    return earnedList;
  }
}

export async function GET(request: Request) {
  const auth = await authenticateUser(request);
  if (auth.error || !auth.client || !auth.user) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const [lpResult, profileResult, badgesResult] = await Promise.all([
    auth.client
      .from('learner_progress')
      .select('lesson_progress, activity_dates, streak, completed_challenges')
      .eq('user_id', auth.user.id)
      .maybeSingle(),
    auth.client
      .from('profiles')
      .select('username, experience_level, total_xp')
      .eq('id', auth.user.id)
      .maybeSingle(),
    auth.client
      .from('user_badges')
      .select('badge_id, earned_at')
      .eq('user_id', auth.user.id)
  ]);

  if (lpResult.error) {
    console.error('Unable to load lesson progress', lpResult.error);
    return NextResponse.json({ error: 'Your lesson progress could not be loaded.' }, { status: 500 });
  }

  const lessonProgress = (lpResult.data?.lesson_progress ?? {}) as Record<string, LessonRecord>;
  const activityDates: string[] = lpResult.data?.activity_dates ?? [];
  const streak = getCurrentStreak(activityDates);

  let earnedBadgeIds: string[] = (badgesResult.data || []).map((b: any) => b.badge_id);
  if (earnedBadgeIds.length === 0 && Object.keys(lessonProgress).length > 0) {
    earnedBadgeIds = await syncBadges(auth.client, auth.user.id, lessonProgress, streak);
  }

  return NextResponse.json({
    lessonProgress,
    completedChallenges: lpResult.data?.completed_challenges ?? [],
    streak,
    experienceLevel: profileResult.data?.experience_level ?? 'beginner',
    username: profileResult.data?.username ?? auth.user.email?.split('@')[0] ?? 'Explorer',
    badges: earnedBadgeIds
  });
}

export async function POST(request: Request) {
  const auth = await authenticateUser(request);
  if (auth.error || !auth.client || !auth.user) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'The lesson progress request must contain valid JSON.' }, { status: 400 });
  }

  if (typeof body.lessonId !== 'string' || !lessonIds.has(body.lessonId)
    || typeof body.language !== 'string' || !languages.has(body.language)
    || typeof body.passed !== 'boolean'
    || (body.error !== undefined && typeof body.error !== 'string')) {
    return NextResponse.json({ error: 'The lesson progress request contains invalid values.' }, { status: 400 });
  }

  const { data: previous, error: loadError } = await auth.client
    .from('learner_progress')
    .select('lesson_progress, activity_dates, completed_challenges')
    .eq('user_id', auth.user.id)
    .maybeSingle();
  if (loadError) {
    console.error('Unable to load lesson progress before saving', loadError);
    return NextResponse.json({ error: 'Your lesson progress could not be saved.' }, { status: 500 });
  }

  const now = new Date().toISOString();
  const key = `${body.language}:${body.lessonId}`;
  const progress = (previous?.lesson_progress ?? {}) as Record<string, LessonRecord>;
  const existing = progress[key];
  const record: LessonRecord = {
    attempts: (existing?.attempts ?? 0) + 1,
    completed: Boolean(existing?.completed || body.passed),
    lastError: body.passed ? null : (body.error as string | undefined)?.slice(0, 500) ?? null,
    lastAttemptAt: now,
    completedAt: body.passed ? existing?.completedAt ?? now : existing?.completedAt ?? null
  };
  const updatedProgress = { ...progress, [key]: record };
  const oldDates: string[] = previous?.activity_dates ?? [];
  const today = now.slice(0, 10);
  const activityDates = oldDates.includes(today) ? oldDates : [...oldDates, today].sort();
  const streak = getCurrentStreak(activityDates);

  const { error: saveError } = await auth.client.from('learner_progress').upsert({
    user_id: auth.user.id,
    lesson_progress: updatedProgress,
    activity_dates: activityDates,
    streak,
    updated_at: now
  }, { onConflict: 'user_id' });
  if (saveError) {
    console.error('Unable to save lesson progress', saveError);
    return NextResponse.json({ error: 'Your lesson progress could not be saved.' }, { status: 500 });
  }

  const badges = await syncBadges(auth.client, auth.user.id, updatedProgress, streak);

  return NextResponse.json({
    lessonProgress: updatedProgress,
    streak,
    badges,
    completedChallenges: previous?.completed_challenges ?? []
  });
}
