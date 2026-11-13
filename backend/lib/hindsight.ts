import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { supabaseAdmin } from './supabase';
import type { ExplainStyle, HintLevel, Language } from './types';

export type HindsightFact = {
  id: string;
  category: 'world_fact' | 'experience' | 'opinion';
  challengeId: string;
  language: Language;
  summary: string;
  timestamp: number;
};

export type HindsightSnapshot = {
  retainedCount: number;
  recalledFacts: string[];
  reflection: string;
  syncedToCloud?: boolean;
};

const memoryStore = new Map<string, HindsightFact[]>();
const GUEST_MEMORY_FILE = join(process.cwd(), 'backend', '.hindsight-memory.json');
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
let guestMemoryLoad: Promise<void> | null = null;

const HINDSIGHT_API_KEY = process.env.HINDSIGHT_API_KEY;
const HINDSIGHT_API_URL = (
  process.env.HINDSIGHT_API_URL || 'https://api.hindsight.vectorize.io'
).replace(/\/$/, '');
const HINDSIGHT_BANK_ID = process.env.HINDSIGHT_BANK_ID || 'bytebloom-learners';

const HINDSIGHT_TIMEOUT_MS = 2500;

function isSupabaseUserId(userId?: string): userId is string {
  return Boolean(userId && UUID_PATTERN.test(userId));
}

async function loadGuestMemory(): Promise<void> {
  if (!guestMemoryLoad) {
    guestMemoryLoad = readFile(GUEST_MEMORY_FILE, 'utf8')
      .then((raw) => {
        const saved = JSON.parse(raw) as Record<string, HindsightFact[]>;
        for (const [learnerId, facts] of Object.entries(saved)) {
          if (!isSupabaseUserId(learnerId) && Array.isArray(facts)) {
            memoryStore.set(learnerId, facts.slice(0, 30));
          }
        }
      })
      .catch(() => undefined);
  }
  await guestMemoryLoad;
}

async function saveGuestMemory(): Promise<void> {
  const guests = Object.fromEntries(
    Array.from(memoryStore.entries())
      .filter(([learnerId]) => !isSupabaseUserId(learnerId))
      .map(([learnerId, facts]) => [learnerId, facts.slice(0, 30)])
  );
  try {
    await writeFile(GUEST_MEMORY_FILE, JSON.stringify(guests, null, 2), 'utf8');
  } catch (error) {
    console.warn('Unable to save guest Hindsight memory backup', error);
  }
}

type HindsightAttemptLog = {
  type: 'hindsight_memory';
  category: 'experience';
  challengeId: string;
  language: Language;
  mistake: string;
  reflection: string;
  timestamp: string;
};

async function persistSupabaseMemory(params: {
  userId: string;
  challengeId: string;
  language: Language;
  style: ExplainStyle;
  level: HintLevel;
  latestObservation: string;
  error?: string;
  reflection: string;
}): Promise<void> {
  const client = supabaseAdmin;
  if (!client) return;

  const memoryEntry: HindsightAttemptLog = {
    type: 'hindsight_memory',
    category: 'experience',
    challengeId: params.challengeId,
    language: params.language,
    mistake: params.error?.trim() || params.latestObservation,
    reflection: params.reflection,
    timestamp: new Date().toISOString()
  };

  const [{ error: eventError }, progressResult] = await Promise.all([
    client.from('mentor_events').insert({
      user_id: params.userId,
      challenge_id: params.challengeId,
      style: params.style,
      hint_level: params.level,
      message: params.latestObservation
    }),
    client
      .from('learner_progress')
      .select('attempt_log')
      .eq('user_id', params.userId)
      .maybeSingle()
  ]);

  if (eventError) console.warn('Unable to persist Hindsight mentor event', eventError);
  if (progressResult.error) {
    console.warn('Unable to load learner progress for Hindsight memory', progressResult.error);
    return;
  }

  const priorLog = Array.isArray(progressResult.data?.attempt_log)
    ? progressResult.data.attempt_log
    : [];
  const attemptLog = [...priorLog, memoryEntry].slice(-50);
  const { error: progressError } = await client.from('learner_progress').upsert({
    user_id: params.userId,
    language: params.language,
    attempt_log: attemptLog,
    updated_at: memoryEntry.timestamp
  }, { onConflict: 'user_id' });
  if (progressError) console.warn('Unable to persist Hindsight learner memory', progressError);
}

export async function recallMemory(params: {
  learnerId: string;
  userId?: string;
  challengeId: string;
  language: Language;
}): Promise<string[]> {
  const localRelevant = (memoryStore.get(params.learnerId) || [])
    .filter((memory) => memory.challengeId === params.challengeId || memory.language === params.language)
    .slice(0, 3)
    .map((memory) => memory.summary);

  if (!isSupabaseUserId(params.userId) || !supabaseAdmin) return localRelevant;

  const [eventsResult, attemptsResult] = await Promise.all([
    supabaseAdmin
      .from('mentor_events')
      .select('message')
      .eq('user_id', params.userId)
      .eq('challenge_id', params.challengeId)
      .order('created_at', { ascending: false })
      .limit(6),
    supabaseAdmin
      .from('attempts')
      .select('error_categories')
      .eq('user_id', params.userId)
      .eq('challenge_id', params.challengeId)
      .eq('language', params.language)
      .order('created_at', { ascending: false })
      .limit(6)
  ]);

  if (eventsResult.error) console.warn('Unable to recall Hindsight mentor events', eventsResult.error);
  if (attemptsResult.error) console.warn('Unable to recall Hindsight attempts', attemptsResult.error);
  const eventFacts = (eventsResult.data || [])
    .map((event) => typeof event.message === 'string' ? event.message.trim() : '')
    .filter(Boolean);
  const attemptFacts = (attemptsResult.data || []).flatMap((attempt) => {
    const errors = Array.isArray(attempt.error_categories) ? attempt.error_categories : [];
    return errors.filter((error): error is string => typeof error === 'string' && Boolean(error.trim()))
      .map((error) => `Previous ${params.language} attempt: ${error.trim()}`);
  });
  return Array.from(new Set([...eventFacts, ...attemptFacts, ...localRelevant])).slice(0, 6);
}

async function hindsightFetch(
  path: string,
  body: Record<string, unknown>,
  method: 'POST' | 'PUT' = 'POST'
): Promise<Response | null> {
  if (!HINDSIGHT_API_KEY) return null;
  try {
    return await fetch(`${HINDSIGHT_API_URL}${path}`, {
      method,
      headers: { Authorization: `Bearer ${HINDSIGHT_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(HINDSIGHT_TIMEOUT_MS)
    });
  } catch {
    return null;
  }
}

/** Calls Retain, Recall, and Reflect with independent 2.5 s circuit breakers. */
async function syncWithVectorizeHindsight(params: {
  bankId: string;
  factToRetain: string;
  recallQuery: string;
}): Promise<{ recalled?: string[]; reflection?: string; ok: boolean }> {
  const bankPath = `/v1/default/banks/${encodeURIComponent(params.bankId)}`;

  // Creating a bank is idempotent: Hindsight may return 409 when it already exists.
  await hindsightFetch(bankPath, { name: params.bankId }, 'PUT');
  const retainRes = await hindsightFetch(`${bankPath}/memories`, {
    items: [{ content: params.factToRetain, context: 'ByteBloom AI Coding Mentor session' }]
  });
  const retainedToCloud = Boolean(retainRes?.ok);

  const [recallRes, reflectRes] = await Promise.all([
    hindsightFetch(`${bankPath}/memories/recall`, {
      query: params.recallQuery,
      max_tokens: 180,
      budget: 'low'
    }),
    hindsightFetch(`${bankPath}/reflect`, {
      query: "Give one short, actionable sentence about this learner's coding pattern.",
      context: params.recallQuery,
      budget: 'low'
    })
  ]);

  if (!recallRes?.ok) return { ok: retainedToCloud };
  try {
    const recallData = (await recallRes.json()) as {
      results?: Array<{ text?: string; content?: string }>;
    };
    const recalled = (recallData.results || [])
      .map((result) => (result.text || result.content || '').trim())
      .filter(Boolean)
      .slice(0, 3);

    let reflection: string | undefined;
    if (reflectRes?.ok) {
      const reflectData = (await reflectRes.json()) as { text?: string };
      reflection = reflectData.text?.replace(/\s+/g, ' ').trim().match(/^[^.!?]+[.!?]?/)?.[0];
    }
    return { recalled, reflection, ok: retainedToCloud };
  } catch {
    return { ok: retainedToCloud };
  }
}

export function retainMemory(
  learnerId: string,
  entry: Omit<HindsightFact, 'id' | 'timestamp'>
) {
  const list = memoryStore.get(learnerId) || [];
  if (!list.some((item) => item.summary === entry.summary)) {
    list.unshift({
      ...entry,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now()
    });
  }
  memoryStore.set(learnerId, list.slice(0, 30));
}

export async function analyzeAndRetainAttempt(params: {
  learnerId?: string;
  userId?: string;
  challengeId: string;
  language: Language;
  code: string;
  error?: string;
  style: ExplainStyle;
  level: HintLevel;
}): Promise<HindsightSnapshot> {
  const learnerId = params.learnerId || 'default-learner';
  const { challengeId, language, code, error, style, level, userId } = params;
  if (!isSupabaseUserId(userId)) await loadGuestMemory();

  // 1. RETAIN locally right away
  let latestObservation = `Practicing ${challengeId} in ${language.toUpperCase()} (Hint L${level}, ${style} style).`;

  if (language === 'python' && /list\(.*\)|\.reverse\(\)|\.join\(/.test(code)) {
    latestObservation = `Learner used verbose list/reverse/join on ${challengeId} instead of Python slice s[::-1].`;
    retainMemory(learnerId, {
      category: 'experience',
      challengeId,
      language,
      summary: latestObservation
    });
  } else if (error && error.trim()) {
    const cleanErr = error.trim().split('\n')[0].slice(0, 90);
    latestObservation = `Learner encountered issue on ${challengeId} (${language}): "${cleanErr}"`;
    retainMemory(learnerId, {
      category: 'experience',
      challengeId,
      language,
      summary: latestObservation
    });
  }

  retainMemory(learnerId, {
    category: 'opinion',
    challengeId,
    language,
    summary: `Prefers ${style.replace('_', '-')} coaching in ${language.toUpperCase()}`
  });
  if (!isSupabaseUserId(userId)) await saveGuestMemory();

  // 2. Sync with Real Vectorize Hindsight Cloud (https://api.hindsight.vectorize.io)
  const bankId = `${HINDSIGHT_BANK_ID}-${learnerId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const cloudResult = await syncWithVectorizeHindsight({
    bankId,
    factToRetain: latestObservation,
    recallQuery: `Past mistakes and coding style for ${challengeId} in${language}`
  });

  const allMemories = memoryStore.get(learnerId) || [];
  const recalledFromStorage = await recallMemory({ learnerId, userId, challengeId, language });

  const recalledFacts = Array.from(new Set([...(cloudResult.recalled || []), ...recalledFromStorage])).slice(0, 6);

  // 3. REFLECT: Generate a sharp insight
  let reflection =
    cloudResult.reflection ||
    `Tracking your ${language.toUpperCase()} patterns locally (${style.replace('_', ' ')} mode).`;

  if (language === 'python' && /reverse/i.test(challengeId)) {
    reflection =
      'Pythonic shortcut: `s[::-1]` reverses a string in one slice without converting to a list first!';
  } else if (recalledFacts.length > 0) {
    reflection = `Recalled ${recalledFacts.length} memory node(s) for${challengeId}—comparing your current output against past attempts.`;
  }

  if (isSupabaseUserId(userId)) {
    await persistSupabaseMemory({
      userId,
      challengeId,
      language,
      style,
      level,
      latestObservation,
      error,
      reflection
    });
  }

  return {
    retainedCount: Math.max(allMemories.length, recalledFacts.length),
    recalledFacts,
    reflection,
    syncedToCloud: cloudResult.ok
  };
}
