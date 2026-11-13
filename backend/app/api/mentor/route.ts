import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { deductHintXp, demoState, saveMentorEvent } from '@backend/lib/db';
import { explain } from '@backend/lib/mentorRules';
import { askMentorWithMeta } from '@backend/lib/llm';
import { analyzeAndRetainAttempt } from '@backend/lib/hindsight';
import { referenceSolutions } from '@backend/lib/solutions';
import { challenges } from '@backend/lib/seed';
import { learnerSummary, preferredStyle } from '@backend/lib/adaptive';
import type { ExplainStyle, HintLevel, Language } from '@backend/lib/types';

const windows = new Map<string, { count: number; start: number }>();

const styleCopy: Record<ExplainStyle, string> = {
  analogy: 'Think of slicing `s[::-1]` like reading a word in a mirror—start from the back (`-1`) to the front!',
  step_by_step: '• Take the input string.\n• Use a reverse slice `s[::-1]` (Python) or `.split("").reverse().join("")` (JS).\n• Print the result.',
  visual: 'Input: "hello" ➔ Slice [::-1] ➔ Output: "olleh"',
  code_first: 'In Python, `s[::-1]` reverses a string in a single step without converting to a list.'
};

type LessonContext = {
  title: string;
  task: string;
  expectedOutput: string;
  completedLessons: string[];
  attemptedLessons: string[];
  attempts: number;
};

function lessonFallback(language: Language, lesson: LessonContext, level: HintLevel) {
  if (level === 1) {
    return `Look closely at your output vs “${lesson.expectedOutput}”. What needs to change inside your print statement?`;
  }
  if (level === 2) {
    return language === 'python'
      ? `Replace the text inside \`print(...)\` so it matches "${lesson.expectedOutput}" character-for-character.`
      : language === 'javascript'
        ? `Update \`console.log(...)\` to print "${lesson.expectedOutput}" with exact capitalization.`
        : `Update \`cout << ...\` to output "${lesson.expectedOutput}" and end with a semicolon.`;
  }
  if (level === 3) {
    return `• Find your output line.\n• Replace the string with "${lesson.expectedOutput}".\n• Run the code again!`;
  }
  const text = JSON.stringify(lesson.expectedOutput);
  if (language === 'python') return `print(${text})`;
  if (language === 'javascript') return `console.log(${text});`;
  return `#include <iostream>\nusing namespace std;\n\nint main() {\n  cout << ${text} << endl;\n  return 0;\n}`;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const { challengeId, language, code, hintLevel, error } = body;

    if (
      typeof challengeId !== 'string' ||
      !['python', 'javascript', 'cpp'].includes(language as string) ||
      typeof code !== 'string' ||
      ![1, 2, 3, 4].includes(hintLevel as number) ||
      (error !== undefined && typeof error !== 'string')
    ) {
      return NextResponse.json({ error: 'Invalid mentor request' }, { status: 400 });
    }

    const rawLesson = body.lessonContext;
    let lessonContext: LessonContext | undefined;
    if (rawLesson && typeof rawLesson === 'object') {
      const lesson = rawLesson as Record<string, unknown>;
      if (
        typeof lesson.title === 'string' &&
        typeof lesson.task === 'string' &&
        typeof lesson.expectedOutput === 'string'
      ) {
        lessonContext = {
          title: lesson.title.slice(0, 120),
          task: lesson.task.slice(0, 500),
          expectedOutput: lesson.expectedOutput.slice(0, 300),
          completedLessons: Array.isArray(lesson.completedLessons)
            ? lesson.completedLessons.filter((x): x is string => typeof x === 'string').slice(0, 20)
            : [],
          attemptedLessons: Array.isArray(lesson.attemptedLessons)
            ? lesson.attemptedLessons.filter((x): x is string => typeof x === 'string').slice(0, 20)
            : [],
          attempts: typeof lesson.attempts === 'number' ? lesson.attempts : 1
        };
      }
    }

    const typedLanguage = language as Language;
    const typedLevel = hintLevel as HintLevel;
    const ip = request.headers.get('x-forwarded-for') || 'demo';
    const now = Date.now();
    const win = windows.get(ip);

    if (win && now - win.start < 60000 && win.count >= 30) {
      return NextResponse.json(
        { error: 'Please take a breath and try again in a moment.' },
        { status: 429 }
      );
    }
    if (!win || now - win.start >= 60000) {
      windows.set(ip, { count: 1, start: now });
    } else {
      win.count++;
    }

    const validStyles: ExplainStyle[] = ['analogy', 'step_by_step', 'visual', 'code_first'];
    const requestedStyle = body.style;
    const style = validStyles.includes(requestedStyle as ExplainStyle)
      ? (requestedStyle as ExplainStyle)
      : preferredStyle(demoState.styleScores as Record<ExplainStyle, number>);

    // 1. Run Hindsight Memory Engine (Retain -> Recall -> Reflect)
    const hindsight = await analyzeAndRetainAttempt({
      learnerId: ip,
      challengeId,
      language: typedLanguage,
      code,
      error: typeof error === 'string' ? error : undefined,
      style,
      level: typedLevel
    });

    const challenge = challenges.find((item) => item.id === challengeId);
    const context = lessonContext
      ? `Lesson: ${lessonContext.title}. Task: ${lessonContext.task}. Expected output: "${lessonContext.expectedOutput}".`
      : challenge?.description || challengeId;
    const learningPath = lessonContext
      ? `Completed: ${lessonContext.completedLessons.join(', ') || 'none'}. Attempts on this lesson: ${lessonContext.attempts}.`
      : undefined;

    // 2. Call AI Waterfall (Local Ollama qwen2.5-coder:3b -> Gemini -> Groq)
    const aiResult = await askMentorWithMeta({
      model: process.env.MENTOR_MODEL || 'llama-3.3-70b-versatile',
      style,
      level: typedLevel,
      profile: learnerSummary({
        pace: demoState.pace,
        style,
        mastery: demoState.mastery,
        errors: typeof error === 'string' ? [error] : []
      }),
      challenge: context,
      learningPath,
      hindsightContext: `${hindsight?.reflection || ''} | Past: ${
        Array.isArray(hindsight?.recalledFacts) ? hindsight.recalledFacts.join('; ') : ''
      }`,
      code,
      error: typeof error === 'string' ? error : undefined,
      solution:
        typedLevel === 4
          ? lessonContext
            ? lessonFallback(typedLanguage, lessonContext, 4)
            : referenceSolutions[challengeId]?.[typedLanguage]
          : undefined
    });

    let message: string;
    let source: 'rules' | 'llm' | 'cache' = 'rules';
    let provider = 'Offline Rule Engine';
    let model = 'mentorRules';
    let isLocal = true;
    let latencyMs = 1;

    if (aiResult) {
      message = aiResult.text;
      source = 'llm';
      provider = aiResult.provider;
      model = aiResult.model;
      isLocal = aiResult.isLocal;
      latencyMs = aiResult.latencyMs;
    } else {
      const rule = explain(
        typedLanguage,
        code,
        typeof error === 'string' ? error : undefined,
        typedLevel
      );
      message =
        rule && !lessonContext
          ? rule
          : lessonContext
            ? lessonFallback(typedLanguage, lessonContext, typedLevel)
            : typedLevel === 4
              ? referenceSolutions[challengeId]?.[typedLanguage] || styleCopy[style]
              : styleCopy[style];
    }

    const eventId = randomUUID();
    saveMentorEvent(eventId, style);
    const xpCost: Record<HintLevel, number> = { 1: 0, 2: 5, 3: 10, 4: 20 };
    const totalXp = deductHintXp(xpCost[typedLevel]);

    return NextResponse.json({
      level: typedLevel,
      message,
      xpCost: xpCost[typedLevel],
      totalXp,
      source,
      provider,
      model,
      isLocal,
      latencyMs,
      hindsight,
      eventId,
      style,
      ...(typedLevel === 4
        ? {
            solution: lessonContext
              ? message
              : referenceSolutions[challengeId]?.[typedLanguage] || message
          }
        : {}),
      ...(style === 'visual'
        ? {
            visual: {
              type: 'steps',
              title: 'ByteKnight Visual Trace',
              rows: [
                ['1', 'Read your current output vs target'],
                ['2', 'Apply the 1-line idiomatic fix'],
                ['3', 'Run and claim your XP!']
              ]
            }
          }
        : {})
    });
  } catch (error) {
    console.error('Bloom could not process a mentor request', error);
    return NextResponse.json({ error: 'Bloom could not process that request.' }, { status: 500 });
  }
}
