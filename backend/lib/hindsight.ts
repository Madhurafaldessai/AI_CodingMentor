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

const HINDSIGHT_API_KEY = process.env.HINDSIGHT_API_KEY;
const HINDSIGHT_API_URL = (
  process.env.HINDSIGHT_API_URL || 'https://api.hindsight.vectorize.io'
).replace(/\/$/, '');
const HINDSIGHT_BANK_ID = process.env.HINDSIGHT_BANK_ID || 'bytebloom-learners';

const HINDSIGHT_TIMEOUT_MS = 2500;

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
  challengeId: string;
  language: Language;
  code: string;
  error?: string;
  style: ExplainStyle;
  level: HintLevel;
}): Promise<HindsightSnapshot> {
  const learnerId = params.learnerId || 'default-learner';
  const { challengeId, language, code, error, style, level } = params;

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

  // 2. Sync with Real Vectorize Hindsight Cloud (https://api.hindsight.vectorize.io)
  const bankId = `${HINDSIGHT_BANK_ID}-${learnerId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const cloudResult = await syncWithVectorizeHindsight({
    bankId,
    factToRetain: latestObservation,
    recallQuery: `Past mistakes and coding style for ${challengeId} in${language}`
  });

  const allMemories = memoryStore.get(learnerId) || [];
  const localRelevant = allMemories
    .filter((m) => m.challengeId === challengeId || m.language === language)
    .slice(0, 3)
    .map((m) => m.summary);

  const recalledFacts =
    cloudResult.recalled && cloudResult.recalled.length > 0
      ? cloudResult.recalled
      : localRelevant;

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

  return {
    retainedCount: Math.max(allMemories.length, recalledFacts.length),
    recalledFacts,
    reflection,
    syncedToCloud: cloudResult.ok
  };
}
