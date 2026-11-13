import type { ExplainStyle, Pace, ProgressRequest } from './types';
export type AttemptSignal = ProgressRequest & { expectedTimeSec?:number; conceptTags?:string[] };
export function updateConceptMastery(oldScore:number|undefined, passed:boolean, attempts:number, hintsUsed:number[]):number {
  const old = oldScore ?? 40;
  const target = !passed ? 30 : attempts === 1 && hintsUsed.length === 0 ? 100 : attempts > 1 ? 75 : Math.max(40,85 - 8 * Math.max(0,...hintsUsed));
  return Math.round((.7 * old + .3 * target) * 10) / 10;
}
export function getPace(recent:AttemptSignal[]):Pace {
  const last = recent.slice(-5); if (!last.length) return 'steady';
  const avgHints = last.reduce((sum,a)=>sum+a.hintsUsed.length,0)/last.length;
  const avgAttempts = last.reduce((sum,a)=>sum+a.attempts,0)/last.length;
  if (avgHints > 2 || avgAttempts > 4) return 'needs_support';
  const ratios = last.filter(a=>a.expectedTimeSec).map(a=>a.timeSpentSec/(a.expectedTimeSec||1));
  if (ratios.length && ratios.reduce((a,b)=>a+b,0)/ratios.length < .6 && avgHints < 1) return 'fast';
  return 'steady';
}
export function chooseNextChallenge<T extends {id:string;difficulty:number;conceptTags:string[];review?:boolean}>(items:T[], mastery:Record<string,number>, solved:string[], pace:Pace):T|null {
  const unlocked=items.filter(item=>(!solved.includes(item.id)||item.review) && (pace!=='fast'||item.difficulty<=3));
  const pool=unlocked.length?unlocked:items.filter(item=>item.review);
  return [...pool].sort((a,b)=>{
    const ma=Math.min(...a.conceptTags.map(x=>mastery[x]??40)); const mb=Math.min(...b.conceptTags.map(x=>mastery[x]??40));
    const da=pace==='needs_support'?Math.abs(a.difficulty-1):pace==='fast'?-a.difficulty:Math.abs(a.difficulty-2);
    const db=pace==='needs_support'?Math.abs(b.difficulty-1):pace==='fast'?-b.difficulty:Math.abs(b.difficulty-2);
    return ma-mb || da-db;
  })[0]??null;
}
export function preferredStyle(scores:Partial<Record<ExplainStyle,number>>, initial:ExplainStyle='step_by_step'):ExplainStyle {
 const entries=Object.entries(scores) as [ExplainStyle,number][]; return entries.length?entries.sort((a,b)=>b[1]-a[1])[0][0]:initial;
}
export function learnerSummary(profile:{experience?:string;pace:Pace;style:ExplainStyle;mastery:Record<string,number>;errors:string[]}):string {
 const weak=Object.entries(profile.mastery).sort((a,b)=>a[1]-b[1]).slice(0,3).map(([x])=>x).join(', ')||'new concepts';
 return `Experience: ${profile.experience||'beginner'}; pace: ${profile.pace}; preferred explanation: ${profile.style}; weakest concepts: ${weak}; recent errors: ${profile.errors.slice(-3).join(', ')||'none'}`.split(/\s+/).slice(0,145).join(' ');
}
