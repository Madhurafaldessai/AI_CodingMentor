import { NextResponse } from 'next/server';
import { chooseNextChallenge, getPace, updateConceptMastery } from '@backend/lib/adaptive';
import { challenges } from '@backend/lib/seed';
import { getGardenStage, getLevel, calculateXp } from '@backend/lib/xp';
import { authenticateUser } from '@backend/lib/user-supabase';
import { getCurrentStreak } from '@backend/lib/streak';
import type { HintLevel, Language } from '@backend/lib/types';
import { retainMemory } from '@backend/lib/hindsight';

type AttemptLogEntry = {
  challengeId: string;
  passed: boolean;
  hintsUsed: HintLevel[];
  attempts: number;
  timeSpentSec: number;
  errorCategories: string[];
  completedAt: string;
};

function isLanguage(value: unknown): value is Language {
  return value === 'python' || value === 'javascript' || value === 'cpp';
}

export async function GET(request: Request) {
  const auth = await authenticateUser(request);
  if (auth.error || !auth.client || !auth.user) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const [progressResult, profileResult] = await Promise.all([
    auth.client.from('learner_progress').select('*').eq('user_id', auth.user.id).maybeSingle(),
    auth.client.from('profiles').select('username,language').eq('id', auth.user.id).maybeSingle()
  ]);
  if (progressResult.error || profileResult.error) {
    console.error('Unable to load learner progress', progressResult.error || profileResult.error);
    return NextResponse.json({ error: 'Your progress could not be loaded.' }, { status: 500 });
  }

  const progress = progressResult.data;
  const attemptLog = (progress?.attempt_log ?? []) as AttemptLogEntry[];
  const activityDates: string[] = progress?.activity_dates
    ?? attemptLog.map(attempt => attempt.completedAt.slice(0, 10));
  return NextResponse.json({
    username: profileResult.data?.username ?? auth.user.email?.split('@')[0] ?? 'Learner',
    language: progress?.language ?? profileResult.data?.language ?? 'python',
    currentChallengeId: progress?.current_challenge_id ?? 'reverse-string',
    completedChallenges: progress?.completed_challenges ?? [],
    totalXp: progress?.total_xp ?? 0,
    level: progress?.level ?? 1,
    streak: getCurrentStreak(activityDates),
    pace: progress?.pace ?? 'steady',
    conceptMastery: progress?.concept_mastery ?? {}
  });
}

export async function PATCH(request: Request) {
  const auth = await authenticateUser(request);
  if (auth.error || !auth.client || !auth.user) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'The progress request must contain valid JSON.' }, { status: 400 });
  }

  const challenge = typeof body.challengeId === 'string'
    ? challenges.find(item => item.id === body.challengeId)
    : undefined;
  if (!challenge || (body.language !== undefined && !isLanguage(body.language))) {
    return NextResponse.json({ error: 'The active challenge or language is invalid.' }, { status: 400 });
  }

  const { data: previous, error: loadError } = await auth.client
    .from('learner_progress')
    .select('*')
    .eq('user_id', auth.user.id)
    .maybeSingle();
  if (loadError) {
    console.error('Unable to load learner progress before updating the active challenge', loadError);
    return NextResponse.json({ error: 'Your saved progress could not be updated.' }, { status: 500 });
  }

  const { data: profile, error: profileError } = await auth.client
    .from('profiles')
    .select('language')
    .eq('id', auth.user.id)
    .maybeSingle();
  if (profileError) {
    console.error('Unable to load learner preferences', profileError);
    return NextResponse.json({ error: 'Your preferences could not be loaded.' }, { status: 500 });
  }

  const language: Language = isLanguage(body.language)
    ? body.language
    : previous?.language ?? profile?.language ?? 'python';
  const completed: string[] = previous?.completed_challenges ?? [];
  const currentChallenge = completed.includes(challenge.id)
    ? chooseNextChallenge(
      challenges.map(item => ({
        id: item.id,
        difficulty: item.difficulty === 'easy' ? 1 : item.difficulty === 'medium' ? 2 : 3,
        conceptTags: item.tags
      })),
      (previous?.concept_mastery ?? {}) as Record<string, number>,
      completed,
      previous?.pace ?? 'steady'
    )?.id ?? null
    : challenge.id;

  const { error: saveError } = await auth.client.from('learner_progress').upsert({
    user_id: auth.user.id,
    language,
    current_challenge_id: currentChallenge,
    completed_challenges: completed,
    total_xp: previous?.total_xp ?? 0,
    level: previous?.level ?? 1,
    streak: previous?.streak ?? 0,
    activity_dates: previous?.activity_dates ?? [],
    pace: previous?.pace ?? 'steady',
    concept_mastery: previous?.concept_mastery ?? {},
    attempt_log: previous?.attempt_log ?? [],
    updated_at: new Date().toISOString()
  }, { onConflict: 'user_id' });
  if (saveError) {
    console.error('Unable to update the active learner challenge', saveError);
    return NextResponse.json({ error: 'Your active challenge could not be saved.' }, { status: 500 });
  }

  const { error: preferenceError } = await auth.client.from('profiles')
    .upsert({ id: auth.user.id, language }, { onConflict: 'id' });
  if (preferenceError) {
    console.error('Unable to save learner language preference', preferenceError);
    return NextResponse.json({ error: 'Your active challenge was saved, but your language preference could not be saved.' }, { status: 500 });
  }

  return NextResponse.json({ currentChallengeId: currentChallenge, language });
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
    return NextResponse.json({ error: 'The progress request must contain valid JSON.' }, { status: 400 });
  }

  const challenge = typeof body.challengeId === 'string'
    ? challenges.find(item => item.id === body.challengeId)
    : undefined;
  const hintsUsed = body.hintsUsed;
  const errorCategories = body.errorCategories;
  if (!challenge || typeof body.passed !== 'boolean'
    || !Array.isArray(hintsUsed) || !hintsUsed.every(hint => [1, 2, 3, 4].includes(hint as number))
    || !Array.isArray(errorCategories) || !errorCategories.every(category => typeof category === 'string')
    || !Number.isInteger(body.attempts) || (body.attempts as number) < 1
    || !Number.isFinite(body.timeSpentSec) || (body.timeSpentSec as number) < 0
    || (body.language !== undefined && !isLanguage(body.language))) {
    return NextResponse.json({ error: 'The progress request contains invalid values.' }, { status: 400 });
  }

  const { data: previous, error: loadError } = await auth.client
    .from('learner_progress')
    .select('*')
    .eq('user_id', auth.user.id)
    .maybeSingle();
  if (loadError) {
    console.error('Unable to load learner progress before saving', loadError);
    return NextResponse.json({ error: 'Your progress could not be saved.' }, { status: 500 });
  }

  const { data: profile, error: profileError } = await auth.client
    .from('profiles')
    .select('language')
    .eq('id', auth.user.id)
    .maybeSingle();
  if (profileError) {
    console.error('Unable to load learner preferences', profileError);
    return NextResponse.json({ error: 'Your preferences could not be loaded.' }, { status: 500 });
  }

  const language: Language = isLanguage(body.language)
    ? body.language
    : previous?.language ?? profile?.language ?? 'python';
  retainMemory(auth.user.id, {
    category: 'experience',
    challengeId: challenge.id,
    language,
    summary: `${body.passed ? 'Completed' : 'Attempted'} ${challenge.id} after ${body.attempts} attempt(s): ${(body.errorCategories as string[]).join(', ') || 'no error recorded'}`
  });
  const completedChallenges: string[] = previous?.completed_challenges ?? [];
  const newlyCompleted = body.passed && !completedChallenges.includes(challenge.id);
  const updatedCompleted = newlyCompleted
    ? [...completedChallenges, challenge.id]
    : completedChallenges;
  const priorMastery = (previous?.concept_mastery ?? {}) as Record<string, number>;
  const mastery = { ...priorMastery };
  const hints = hintsUsed as HintLevel[];
  if (body.passed || !completedChallenges.includes(challenge.id)) {
    for (const tag of challenge.tags) {
      mastery[tag] = updateConceptMastery(
        mastery[tag],
        body.passed,
        body.attempts as number,
        hints
      );
    }
  }

  const attemptLog = (previous?.attempt_log ?? []) as AttemptLogEntry[];
  const nextAttempt: AttemptLogEntry = {
    challengeId: challenge.id,
    passed: body.passed,
    hintsUsed: hints,
    attempts: body.attempts as number,
    timeSpentSec: body.timeSpentSec as number,
    errorCategories: errorCategories as string[],
    completedAt: new Date().toISOString()
  };
  const updatedAttemptLog = [...attemptLog, nextAttempt].slice(-50);
  const activityDates: string[] = previous?.activity_dates
    ?? attemptLog.map(attempt => attempt.completedAt.slice(0, 10));
  const today = new Date().toISOString().slice(0, 10);
  const updatedActivityDates = activityDates.includes(today)
    ? [...activityDates]
    : [...activityDates, today];
  updatedActivityDates.sort();
  const streak = getCurrentStreak(updatedActivityDates);
  const pace = getPace(updatedAttemptLog.map(attempt => ({
    ...attempt,
    expectedTimeSec: 120
  })));
  const totalXp = (previous?.total_xp ?? 0)
    + (newlyCompleted ? calculateXp(challenge.xpReward, hints) : 0);
  const level = getLevel(totalXp);
  const candidates = challenges.map(item => ({
    id: item.id,
    difficulty: item.difficulty === 'easy' ? 1 : item.difficulty === 'medium' ? 2 : 3,
    conceptTags: item.tags
  }));
  const next = chooseNextChallenge(candidates, mastery, updatedCompleted, pace);
  const currentChallengeId = body.passed ? next?.id ?? null : challenge.id;
  const { error: saveError } = await auth.client.from('learner_progress').upsert({
    user_id: auth.user.id,
    language,
    current_challenge_id: currentChallengeId,
    completed_challenges: updatedCompleted,
    total_xp: totalXp,
    level,
    streak,
    activity_dates: updatedActivityDates,
    pace,
    concept_mastery: mastery,
    attempt_log: updatedAttemptLog,
    updated_at: new Date().toISOString()
  }, { onConflict: 'user_id' });
  if (saveError) {
    console.error('Unable to save learner progress', saveError);
    return NextResponse.json({ error: 'Your progress could not be saved.' }, { status: 500 });
  }

  const { error: preferenceError } = await auth.client.from('profiles')
    .upsert({ id: auth.user.id, language }, { onConflict: 'id' });
  if (preferenceError) {
    console.error('Unable to save learner language preference', preferenceError);
    return NextResponse.json({ error: 'Your progress was saved, but your language preference could not be saved.' }, { status: 500 });
  }

  return NextResponse.json({
    xpEarned: newlyCompleted ? calculateXp(challenge.xpReward, hints) : 0,
    totalXp,
    level,
    gardenStage: getGardenStage(level),
    streak,
    newBadges: newlyCompleted && updatedCompleted.length === 1 ? ['First Bloom'] : [],
    nextChallengeId: currentChallengeId,
    pace,
    conceptMastery: mastery,
    completedChallenges: updatedCompleted
  });
}
