import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { deductHintXp, demoState, saveMentorEvent } from '@backend/lib/db';
import { explain } from '@backend/lib/mentorRules';
import { askGroq } from '@backend/lib/llm';
import { referenceSolutions } from '@backend/lib/solutions';
import { challenges } from '@backend/lib/seed';
import { learnerSummary,preferredStyle } from '@backend/lib/adaptive';
import type { ExplainStyle, HintLevel, Language } from '@backend/lib/types';
const cache=new Map<string,string>(); const windows=new Map<string,{count:number;start:number}>();
const labels:Record<HintLevel,string>={1:'Nudge',2:'Clue',3:'Breakdown',4:'Full solution'};
const styleCopy:Record<ExplainStyle,string>={analogy:'Think of it like turning a line of books around: the last one becomes first.',step_by_step:'Follow the data one small step at a time, then print the result.',visual:'Try tracing each value as it moves through the loop.',code_first:'Identify the string operation that returns a reversed copy.'};
type LessonContext = {
  title: string;
  task: string;
  expectedOutput: string;
  completedLessons: string[];
  attemptedLessons: string[];
  attempts: number;
};

function lessonFallback(language: Language, lesson: LessonContext, level: HintLevel) {
  if (level === 1) return `Compare the output your program produced with “${lesson.expectedOutput}”. Which part of the text or print statement needs to change?`;
  if (level === 2) return language === 'python'
    ? 'Use print(...) to display the exact text. Keep the letters, punctuation, and quotes in the same order as the expected output.'
    : language === 'javascript'
      ? 'Use console.log(...) to display the exact text. Check the capitalization, punctuation, and quotes against the expected output.'
      : 'Use cout to display the exact text. Check the capitalization and punctuation, and end the output statement with a semicolon.';
  if (level === 3) return `1. Find the line that prints output. 2. Replace its message with the exact text “${lesson.expectedOutput}”. 3. Run the program again and compare both outputs character by character.`;
  const text = JSON.stringify(lesson.expectedOutput);
  if (/comment/i.test(lesson.task)) {
    if (language === 'python') return `# This comment is not printed\nprint(${text})`;
    if (language === 'javascript') return `// This comment is not printed\nconsole.log(${text});`;
    return `#include <iostream>\nusing namespace std;\n\nint main() {\n  // This comment is not printed\n  cout << ${text} << endl;\n  return 0;\n}`;
  }
  if (language === 'python') return `print(${text})`;
  if (language === 'javascript') return `console.log(${text});`;
  return `#include <iostream>\nusing namespace std;\n\nint main() {\n  cout << ${text} << endl;\n  return 0;\n}`;
}

export async function POST(request:Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const { challengeId, language, code, hintLevel, error } = body;
    if (typeof challengeId !== 'string' || !['python', 'javascript', 'cpp'].includes(language as string)
      || typeof code !== 'string' || ![1, 2, 3, 4].includes(hintLevel as number)
      || (error !== undefined && typeof error !== 'string')) {
      return NextResponse.json({ error: 'Invalid mentor request' }, { status: 400 });
    }

    const rawLesson = body.lessonContext;
    let lessonContext: LessonContext | undefined;
    if (rawLesson !== undefined) {
      if (!rawLesson || typeof rawLesson !== 'object') {
        return NextResponse.json({ error: 'Invalid lesson context' }, { status: 400 });
      }
      const lesson = rawLesson as Record<string, unknown>;
      if (typeof lesson.title !== 'string' || typeof lesson.task !== 'string'
        || typeof lesson.expectedOutput !== 'string' || !Array.isArray(lesson.completedLessons)
        || !lesson.completedLessons.every(item => typeof item === 'string')
        || !Array.isArray(lesson.attemptedLessons)
        || !lesson.attemptedLessons.every(item => typeof item === 'string')
        || !Number.isInteger(lesson.attempts) || (lesson.attempts as number) < 1) {
        return NextResponse.json({ error: 'Invalid lesson context' }, { status: 400 });
      }
      lessonContext = {
        title: lesson.title.slice(0, 120),
        task: lesson.task.slice(0, 500),
        expectedOutput: lesson.expectedOutput.slice(0, 300),
        completedLessons: lesson.completedLessons.filter((item): item is string => typeof item === 'string').slice(0, 20),
        attemptedLessons: lesson.attemptedLessons.filter((item): item is string => typeof item === 'string').slice(0, 20),
        attempts: lesson.attempts as number
      };
    }

    const typedLanguage = language as Language;
    const typedLevel = hintLevel as HintLevel;
    const ip = request.headers.get('x-forwarded-for') || 'demo';
    const now = Date.now();
    const win = windows.get(ip);
    if (win && now - win.start < 60000 && win.count >= 30) {
      return NextResponse.json({ error: 'Please take a breath and try again in a moment.' }, { status: 429 });
    }
    if (!win || now - win.start >= 60000) windows.set(ip, { count: 1, start: now });
    else win.count++;

    const validStyles: ExplainStyle[] = ['analogy', 'step_by_step', 'visual', 'code_first'];
    const requestedStyle = body.style;
    const style = validStyles.includes(requestedStyle as ExplainStyle)
      ? requestedStyle as ExplainStyle
      : preferredStyle(demoState.styleScores as Record<ExplainStyle, number>);
    const key = `${challengeId}:${typedLanguage}:${code}:${typedLevel}:${style}:${error ?? ''}:${JSON.stringify(lessonContext ?? {})}`;
    let message: string;
    let source: 'rules' | 'llm' | 'cache' = 'rules';

    if (cache.has(key)) {
      message = cache.get(key)!;
      source = 'cache';
    } else {
      const rule = explain(typedLanguage, code, typeof error === 'string' ? error : undefined, typedLevel);
      if (rule && !lessonContext) {
        message = rule;
      } else {
        const challenge = challenges.find(item => item.id === challengeId);
        const context = lessonContext
          ? `Lesson: ${lessonContext.title}. Task: ${lessonContext.task}. Expected output: ${lessonContext.expectedOutput}.`
          : challenge?.description || challengeId;
        const learningPath = lessonContext
          ? `Completed lessons: ${lessonContext.completedLessons.join(', ') || 'none yet'}. Attempt history: ${lessonContext.attemptedLessons.join(' | ') || 'no saved attempts yet'}. Attempts on this lesson: ${lessonContext.attempts}.`
          : undefined;
        const generated = await askGroq({
          model: process.env.MENTOR_MODEL || 'llama-3.1-8b-instant',
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
          code,
          error: typeof error === 'string' ? error : undefined,
          solution: typedLevel === 4
            ? lessonContext
              ? lessonFallback(typedLanguage, lessonContext, 4)
              : referenceSolutions[challengeId]?.[typedLanguage]
            : undefined
        });
        if (generated) {
          message = generated;
          source = 'llm';
        } else {
          message = lessonContext
            ? lessonFallback(typedLanguage, lessonContext, typedLevel)
            : typedLevel === 4
              ? referenceSolutions[challengeId]?.[typedLanguage] || styleCopy[style]
              : styleCopy[style];
        }
      }
      cache.set(key, message);
    }

    const eventId = randomUUID();
    saveMentorEvent(eventId, style);
    const xpCost: Record<HintLevel, number> = { 1: 0, 2: 5, 3: 10, 4: 20 };
    const totalXp = deductHintXp(xpCost[typedLevel]);
    const response = {
      level: typedLevel,
      message,
      xpCost: xpCost[typedLevel],
      totalXp,
      source,
      eventId,
      style,
      ...(typedLevel === 4 ? { solution: lessonContext ? message : referenceSolutions[challengeId]?.[typedLanguage] || message } : {}),
      ...(style === 'visual' ? { visual: { type: 'steps', title: 'A small trace', rows: [['1', 'Start with the exact expected output'], ['2', 'Print it using your language'], ['3', 'Run and compare the result']] } } : {})
    };
    return NextResponse.json(response);
  } catch (error) {
    console.error('Bloom could not process a mentor request', error);
    return NextResponse.json({ error: 'Bloom could not process that request.' }, { status: 500 });
  }
}
