import type { HintLevel, MentorResponse, Pace, ProgressResponse, RunResult } from './types';
export const demoState:{xp:number;level:number;streak:number;solved:Set<string>;attempts:number;hints:HintLevel[];mastery:Record<string,number>;pace:Pace;styleScores:Record<string,number>;mentorEvents:Map<string,{helpful?:boolean;style:string}>;recent:{timeSpentSec:number;attempts:number;hints:number}[]}={xp:400,level:4,streak:3,solved:new Set(),attempts:0,hints:[],mastery:{strings:42,loops:68,variables:82,conditionals:91},pace:'steady',styleScores:{step_by_step:2},mentorEvents:new Map(),recent:[]};
export function saveMentorEvent(id:string,style:string){demoState.mentorEvents.set(id,{style})}
export function feedbackMentorEvent(id:string,helpful:boolean){const event=demoState.mentorEvents.get(id);if(event){event.helpful=helpful;demoState.styleScores[event.style]=(demoState.styleScores[event.style]||0)+(helpful?1:-1)}}
export function saveProgress(result:ProgressResponse){demoState.xp=result.totalXp;demoState.level=result.level;demoState.streak=result.streak;demoState.pace=result.pace;demoState.mastery=result.conceptMastery}
export function deductHintXp(cost:number){demoState.xp=Math.max(0,demoState.xp-cost);return demoState.xp}
export function evaluateMock(code:string,language:string,input:string,expected:string):RunResult{
 let actual=''; const trimmed=code.trim(); const pyRev=/\[::\s*-1\s*\]/.test(code); const jsRev=/\.split\(['"]{2}\)\.reverse\(\)\.join\(['"]{2}\)/.test(code); const cppRev=/#include\s*<algorithm>/.test(code)&&/reverse\s*\(/.test(code);
 if(expected==='olleh'||expected==='dlrow'||expected==='moolBetyB'){const inputWord=input.trim(); actual=(pyRev||jsRev||cppRev)?inputWord.split('').reverse().join(''):inputWord;}
 else if(expected==='5'&&input.match(/^-?\d+\s+-?\d+$/)){actual=String(input.trim().split(/\s+/).map(Number).reduce((a,b)=>a+b,0));}
 else if(expected==='Even'||expected==='Odd'){const n=Number(input);actual=n%2===0?'Even':'Odd';}
 else if(expected==='true'||expected==='false'){const w=input.trim().split(/\s+/);actual=String(w.length===1&&w[0]===w[0].split('').reverse().join(''));}
 else if(/print\s*\(\s*\d+\s*\+\s*\d+/.test(code)){const m=code.match(/print\s*\(\s*(\d+)\s*\+\s*(\d+)/);actual=String(Number(m?.[1])+Number(m?.[2]));}
 else if(language==='javascript'&&/console\.log\s*\(\s*['"]/.test(code)){actual=code.match(/console\.log\s*\(\s*['"]([^'"]*)['"]/)?.[1]||'';}
 else if(language==='python'&&/print\s*\(\s*['"]/.test(code)){actual=code.match(/print\s*\(\s*['"]([^'"]*)['"]/)?.[1]||'';}
 else if(language==='cpp'&&/cout\s*<<\s*['"]/.test(code)){actual=code.match(/cout\s*<<\s*['"]([^'"]*)['"]/)?.[1]||'';}
 const passed=actual.trim()===expected.trim(); return {status:passed?'passed':'failed',stdout:actual,stderr:'',testResults:[{input,expected,actual,passed,timeMs:2}]};
}
