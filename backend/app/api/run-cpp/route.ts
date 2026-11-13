import { NextResponse } from 'next/server';
import { evaluateMock } from '@backend/lib/db';
import { retainMemory } from '@backend/lib/hindsight';

type TestCaseInput = {
  input: string;
  expectedOutput: string;
};

type PistonResponse = {
  compile?: {
    stdout?: string;
    stderr?: string;
    output?: string;
    code?: number | null;
  };
  run?: {
    stdout?: string;
    stderr?: string;
    output?: string;
    code?: number | null;
    signal?: string | null;
  };
};

async function runWithPiston(code: string, testCases: TestCaseInput[]) {
  const endpoint = process.env.PISTON_URL || 'https://emkc.org/api/v2/piston/execute';
  const results = [];

  for (const test of testCases) {
    const started = Date.now();
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        language: 'c++',
        version: '10.2.0',
        files: [{ name: 'main.cpp', content: code }],
        stdin: test.input,
        compile_timeout: 10000,
        run_timeout: 3000
      }),
      signal: AbortSignal.timeout(12000)
    });

    if (!response.ok) {
      throw new Error(`Piston HTTP ${response.status}`);
    }

    const data = (await response.json()) as PistonResponse;
    const elapsedMs = Date.now() - started;

    // 1. Check for C++ Compilation Error
    if (data.compile && data.compile.code !== 0) {
      const compileErr = (data.compile.stderr || data.compile.output || 'Compilation failed.').trim();
      results.push({
        input: test.input,
        expected: test.expectedOutput,
        actual: '',
        passed: false,
        timeMs: elapsedMs
      });
      return NextResponse.json({
        status: 'compile_error',
        stdout: '',
        stderr: compileErr,
        compileOutput: compileErr,
        testResults: results
      });
    }

    // 2. Check for Runtime Error / Timeout
    const run = data.run || {};
    const actual = (run.stdout || '').trim();
    const stderr = (run.stderr || '').trim();
    const timedOut = run.signal === 'SIGKILL';

    if (timedOut || (run.code !== 0 && run.code !== null && run.code !== undefined)) {
      results.push({
        input: test.input,
        expected: test.expectedOutput,
        actual,
        passed: false,
        timeMs: elapsedMs
      });
      return NextResponse.json({
        status: timedOut ? 'timeout' : 'runtime_error',
        stdout: actual,
        stderr: stderr || (timedOut ? 'Execution timed out.' : `Exited with code ${run.code}`),
        testResults: results
      });
    }

    // 3. Compare Output
    const passed = actual === test.expectedOutput.trim();
    results.push({
      input: test.input,
      expected: test.expectedOutput,
      actual,
      passed,
      timeMs: elapsedMs
    });
  }

  const allPassed = results.length === testCases.length && results.every((x) => x.passed);
  return NextResponse.json({
    status: allPassed ? 'passed' : 'failed',
    stdout: results.map((x) => x.actual).join('\n'),
    stderr: '',
    testResults: results
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      code: string;
      testCases: TestCaseInput[];
    };

    if (typeof body.code !== 'string' || !Array.isArray(body.testCases)) {
      return NextResponse.json({ error: 'Invalid test cases' }, { status: 400 });
    }
    retainMemory('anonymous', {
      category: 'experience', challengeId: 'cpp-run', language: 'cpp',
      summary: 'Ran C++ code in the browser workspace.'
    });

    // Tier 1: Judge0 (if JUDGE0_URL is configured)
    const base = process.env.JUDGE0_URL;
    if (base) {
      const endpoint = `${base.replace(/\/$/, '')}/submissions?base64_encoded=false&wait=true`;
      const headers: Record<string, string> = { 'content-type': 'application/json' };
      if (process.env.JUDGE0_API_KEY) {
        headers['X-RapidAPI-Key'] = process.env.JUDGE0_API_KEY;
        try {
          headers['X-RapidAPI-Host'] = new URL(base).host;
        } catch {}
      }

      const results = [];
      for (const test of body.testCases) {
        const started = Date.now();
        const response = await fetch(endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            language_id: 54,
            source_code: body.code,
            stdin: test.input,
            expected_output: test.expectedOutput,
            cpu_time_limit: 5,
            memory_limit: 131072
          }),
          signal: AbortSignal.timeout(10000)
        });

        if (!response.ok) {
          return NextResponse.json(
            {
              status: 'runtime_error',
              stdout: '',
              stderr: `Judge0 returned HTTP ${response.status}.`,
              testResults: []
            },
            { status: 502 }
          );
        }

        const run = (await response.json()) as {
          stdout?: string | null;
          stderr?: string | null;
          compile_output?: string | null;
          time?: string;
          status?: { id: number; description: string };
          message?: string;
        };

        const actual = (run.stdout || '').trim();
        const passed = actual === test.expectedOutput.trim() && run.status?.id === 3;
        results.push({
          input: test.input,
          expected: test.expectedOutput,
          actual,
          passed,
          timeMs: Number(run.time || 0) * 1000
        });

        if (run.status?.id === 6) {
          return NextResponse.json({
            status: 'compile_error',
            stdout: '',
            stderr: run.compile_output || run.message || 'Compilation failed.',
            compileOutput: run.compile_output || '',
            testResults: results
          });
        }
        if (run.status?.id === 5 || run.status?.id === 4) {
          return NextResponse.json({
            status: run.status.id === 5 ? 'timeout' : 'runtime_error',
            stdout: run.stdout || '',
            stderr: run.stderr || run.status.description,
            testResults: results
          });
        }
        if (Date.now() - started > 10000) break;
      }

      const passed = results.length === body.testCases.length && results.every((x) => x.passed);
      return NextResponse.json({
        status: passed ? 'passed' : 'failed',
        stdout: results.map((x) => x.actual).join('\n'),
        stderr: '',
        testResults: results
      });
    }

    // Tier 2: Free Public Piston C++ Execution API (No API key needed!)
    try {
      return await runWithPiston(body.code, body.testCases);
    } catch (pistonErr) {
      console.warn('⚠️ Piston C++ runner unavailable, falling back to local mock evaluator:', pistonErr);
    }

    // Tier 3: Offline Mock Evaluator Fallback
    const testResults = body.testCases.map(
      (c) => evaluateMock(body.code, 'cpp', c.input, c.expectedOutput).testResults[0]
    );
    const passed = testResults.every((x) => x.passed);
    return NextResponse.json({
      status: passed ? 'passed' : 'failed',
      stdout: testResults.map((x) => x.actual).join('\n'),
      stderr: '',
      testResults
    });
  } catch {
    return NextResponse.json({ error: 'Runner could not read that request.' }, { status: 400 });
  }
}
