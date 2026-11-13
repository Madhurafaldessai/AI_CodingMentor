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

export async function GET(request: Request) {
  const auth = await authenticateUser(request);
  if (auth.error || !auth.client || !auth.user) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { data, error } = await auth.client
    .from('learner_progress')
    .select('lesson_progress')
    .eq('user_id', auth.user.id)
    .maybeSingle();
  if (error) {
    console.error('Unable to load lesson progress', error);
    return NextResponse.json({ error: 'Your lesson progress could not be loaded.' }, { status: 500 });
  }

  return NextResponse.json({ lessonProgress: data?.lesson_progress ?? {} });
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
    .select('lesson_progress, activity_dates')
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

  return NextResponse.json({ lessonProgress: updatedProgress, streak });
}
