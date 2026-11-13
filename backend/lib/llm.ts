import { GoogleGenAI } from '@google/genai';
import type { ExplainStyle, HintLevel } from './types';

export type MentorLlmInput = {
  model: string;
  style: ExplainStyle;
  level: HintLevel;
  profile: string;
  challenge: string;
  code: string;
  error?: string;
  solution?: string;
  learningPath?: string;
  hindsightContext?: string;
};

export type MentorLlmResult = {
  text: string;
  provider: string;
  model: string;
  isLocal: boolean;
  latencyMs: number;
};

function parseKeys(envVar?: string): string[] {
  return (envVar || '')
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);
}

/**
 * Strips boring textbook headers ("### Step 1:"), robotic intros ("Certainly!"),
 * third-person phrasing ("The learner is..."), and premature code blocks on levels 1-3.
 */
export function cleanMentorText(raw: string, level: HintLevel): string {
  let text = raw.trim();

  // Remove robotic openings
  text = text.replace(/^(Certainly!|Sure!|Here is a hint:|Let's walk through[^\n]*\n+)/i, '').trim();

  // Remove markdown ### headers
  text = text.replace(/^#{1,4}\s*Step\s*\d+[:.-]?\s*/gim, '• ');
  text = text.replace(/^#{1,4}\s*(Understand the Problem|Identify the Error|Correct the Code|Update the Code|Test the Code|Explanation|Additional Tips)[:.-]?\s*/gim, '');

  // Fix third-person "The learner" -> "You"
  text = text.replace(/\bThe learner is\b/gi, 'You are');
  text = text.replace(/\bthe learner\b/gi, 'you');
  text = text.replace(/\bthe player\b/gi, 'you');
  text = text.replace(/^\s{0,3}#{1,6}\s+.*$/gm, '');
  text = text.replace(
    /(?:['\"]{0,2}\.join\(\s*reversed\(\s*list\(\s*s\s*\)\s*\)\s*\)|list\(\s*s\s*\)\s*\.reverse\(\)\s*\.join\([^)]*\))/gi,
    's[::-1]'
  );

  // If Level 1, 2, or 3, strip full fenced code blocks so it never spoils the answer early
  if (level < 4) {
    text = text.replace(/```[\s\S]*?```/g, '').trim();
    text = text.replace(/(?:^|\n)\s*(?:#{1,6}\s*)?Clean Reference Solution\s*:?[\s\S]*$/i, '').trim();
  }

  // Collapse excessive blank lines
  text = text.replace(/\n{3,}/g, '\n\n').trim();

  // Levels 1-2 stay focused while leaving room to name the bug and the fix.
  if (level <= 2) {
    const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text];
    text = sentences.slice(0, 3).join(' ').replace(/\s+/g, ' ').trim().slice(0, 420);
  } else if (level === 3) {
    const parts = text
      .split(/\n+|(?<=[.!?])\s+(?=[A-Z•-])/)
      .map((part) => part.replace(/^\s*(?:[•*-]|\d+[.)])\s*/, '').trim())
      .filter(Boolean)
      .slice(0, 3);
    text = parts.map((part) => `• ${part.slice(0, 150)}`).join('\n');
  }

  return text || 'Look closely at the difference between your output and the target output!';
}

function buildPrompts(input: MentorLlmInput) {
  const styleGuides: Record<ExplainStyle, string> = {
    analogy: 'Use one vivid, fun game or real-world analogy.',
    step_by_step: 'Give 2-3 crisp, direct action bullets.',
    visual: 'Show a tiny visual arrow trace of how the data transforms (e.g. "abc" -> "cba").',
    code_first: 'Point directly to the exact operator, slice, or function syntax needed.'
  };

  const levelGuides: Record<HintLevel, string> = {
    1: 'LEVEL 1 (NUDGE): Write 1-3 short sentences, under 420 characters, speaking directly to "you". Ask a sharp question about current output versus the goal. ZERO code blocks.',
    2: 'LEVEL 2 (CLUE): Write 1-3 short sentences, under 420 characters, speaking directly to "you". Name the exact idiomatic tool (Python reversal MUST be `s[::-1]`, never list/reverse/join). ZERO code blocks.',
    3: 'LEVEL 3 (BREAKDOWN): Write 3 short bullet points (`•`) explaining the exact fix. Do NOT paste the final code block.',
    4: 'LEVEL 4 (FULL SOLUTION): Give a 1-sentence encouragement followed by the cleanest, most idiomatic working code block.'
  };

  const system = `You are "ByteKnight", a sharp, encouraging RPG pixel-knight coding companion inside ByteBloom.
STRICT RULES:
- Speak directly to the player using "you" (NEVER say "the learner" or "Certainly!").
- NEVER use markdown headers like "### Step 1" or "### Explanation".
- Prefer clean idiomatic tricks (e.g., in Python, always recommend slice \`s[::-1]\` for reversing strings, NEVER boring list-reverse-join essays).
- NEVER waste a sentence explaining what \`input()\` or \`print()\` does. Jump straight to the exact line/expression that needs to change (e.g. changing \`print(s)\` to \`print(s[::-1])\`).
- Levels 1-2 must stay below 420 characters and use no more than 3 sentences. Level 3 must have only 2-3 short bullet points. Never use a full code block before Level 4.
- ${levelGuides[input.level]}
- Style (${input.style}): ${styleGuides[input.style]}`;

  const user = `Task: ${input.challenge}
${input.hindsightContext ? `Hindsight Memory: ${input.hindsightContext}\n` : ''}${
    input.learningPath ? `Progress: ${input.learningPath.slice(0, 600)}\n` : ''
  }Player Code:
${input.code.slice(0, 2000)}
${input.error ? `\nCurrent Output / Error: ${input.error.slice(0, 400)}` : ''}${
    input.level === 4 && input.solution ? `\nClean Reference Solution:\n${input.solution}` : ''
  }`;

  return { system, user };
}

async function callLocalOllama(
  baseUrl: string,
  model: string,
  system: string,
  user: string,
  level: HintLevel
): Promise<string | null> {
  const response = await fetch(`${baseUrl}/api/generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      system,
      prompt: user,
      stream: false,
      options: {
        temperature: 0.25,
        num_predict: level === 4 ? 320 : 120
      }
    }),
    signal: AbortSignal.timeout(5000)
  });

  if (!response.ok) throw new Error(`Ollama HTTP ${response.status}`);
  const data = (await response.json()) as { response?: string };
  return data.response?.trim() || null;
}

async function callGemini(
  apiKey: string,
  model: string,
  system: string,
  user: string,
  level: HintLevel
): Promise<string | null> {
  const ai = new GoogleGenAI({ vertexai: false, apiKey });
  const response = await ai.models.generateContent({
    model,
    contents: `${system}\n\n${user}`,
    config: {
      temperature: 0.3,
      maxOutputTokens: level === 4 ? 400 : 150
    }
  });
  return response.text?.trim() || null;
}

async function callOpenAiCompatible(
  url: string,
  apiKey: string,
  model: string,
  system: string,
  user: string,
  level: HintLevel
): Promise<string | null> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      temperature: 0.3,
      max_tokens: level === 4 ? 400 : 150
    }),
    signal: AbortSignal.timeout(10000)
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return data.choices?.[0]?.message?.content?.trim() || null;
}

export async function askMentorWithMeta(
  input: MentorLlmInput
): Promise<MentorLlmResult | null> {
  const { system, user } = buildPrompts(input);

  const ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
  const ollamaModel = process.env.OLLAMA_MODEL || 'qwen2.5-coder:3b';
  const geminiKeys = parseKeys(
    process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY
  );
  const geminiModel = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const groqKeys = parseKeys(process.env.GROQ_API_KEY);
  const groqModel = process.env.MENTOR_MODEL || input.model || 'llama-3.3-70b-versatile';

  // Default puts 'ollama' FIRST so you can immediately verify your laptop GPU/CPU agent!
  const providerOrder = (
    process.env.AI_PROVIDER_ORDER ||
    (process.env.PREFER_LOCAL_OLLAMA !== 'false' ? 'ollama,gemini,groq' : 'gemini,groq,ollama')
  )
    .split(',')
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);

  const queue: Array<{
    provider: string;
    model: string;
    isLocal: boolean;
    run: () => Promise<string | null>;
  }> = [];

  for (const p of providerOrder) {
    if (p === 'ollama') {
      queue.push({
        provider: 'Ollama Laptop Agent',
        model: ollamaModel,
        isLocal: true,
        run: () => callLocalOllama(ollamaUrl, ollamaModel, system, user, input.level)
      });
    } else if (p === 'gemini') {
      geminiKeys.forEach((key, idx) => {
        queue.push({
          provider: `Google Gemini #${idx + 1}`,
          model: geminiModel,
          isLocal: false,
          run: () => callGemini(key, geminiModel, system, user, input.level)
        });
      });
    } else if (p === 'groq') {
      groqKeys.forEach((key, idx) => {
        queue.push({
          provider: `Groq Cloud #${idx + 1}`,
          model: groqModel,
          isLocal: false,
          run: () =>
            callOpenAiCompatible(
              'https://api.groq.com/openai/v1/chat/completions',
              key,
              groqModel,
              system,
              user,
              input.level
            )
        });
      });
    }
  }

  for (const item of queue) {
    try {
      const start = Date.now();
      const rawText = await item.run();
      if (rawText) {
        const cleaned = cleanMentorText(rawText, input.level);
        const latencyMs = Date.now() - start;
        console.log(
          `✅ [ByteKnight AI] ${item.isLocal ? '🟢 LOCAL OLLAMA' : '☁️ CLOUD'} (${item.provider} - ${item.model}) in ${latencyMs}ms`
        );
        return {
          text: cleaned,
          provider: item.provider,
          model: item.model,
          isLocal: item.isLocal,
          latencyMs
        };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`⚠️ [ByteKnight AI] ${item.provider} failed (${msg}) -> trying next...`);
    }
  }

  return null;
}

// The historical name is retained, while callers now receive provider diagnostics with the text.
export async function askGroq(input: MentorLlmInput): Promise<MentorLlmResult | null> {
  return askMentorWithMeta(input);
}
