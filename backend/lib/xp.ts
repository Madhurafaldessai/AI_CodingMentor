import type { HintLevel } from './types';
export const HINT_COST:Record<HintLevel,number>={1:0,2:5,3:10,4:20};
export function calculateXp(reward:number,hints:HintLevel[]):number { return Math.max(Math.ceil(reward*.1),reward-hints.reduce((sum,l)=>sum+HINT_COST[l],0)); }
export function getLevel(totalXp:number):number { return Math.floor(Math.sqrt(Math.max(0,totalXp)/50))+1; }
export function getGardenStage(level:number):'seed'|'sprout'|'bud'|'bloom' { return level===1?'seed':level<=3?'sprout':level<=6?'bud':'bloom'; }
