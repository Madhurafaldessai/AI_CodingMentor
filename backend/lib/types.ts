export type Language = 'python' | 'javascript' | 'cpp';
export type HintLevel = 1 | 2 | 3 | 4;
export type ThemeMode = 'light' | 'dark' | 'system';
export type ExplainStyle = 'analogy' | 'step_by_step' | 'visual' | 'code_first';
export type Pace = 'fast' | 'steady' | 'needs_support';
export interface Challenge { id:string; title:string; difficulty:'easy'|'medium'|'hard'; tags:string[]; languages:Language[]; description:string; examples:{input:string;output:string;explanation:string}[]; constraints:string[]; starterCode:Record<Language,string>; testCases:{input:string;expectedOutput:string;hidden?:boolean}[]; xpReward:number; memoryLimitMb:number; timeLimitSec:number }
export interface RunResult { status:'passed'|'failed'|'compile_error'|'runtime_error'|'timeout'; stdout:string; stderr:string; testResults:{input:string;expected:string;actual:string;passed:boolean;timeMs:number}[]; compileOutput?:string; errorLine?:number }
export interface MentorRequest { challengeId:string; language:Language; code:string; error?:string; lastRunResult?:RunResult; hintLevel:HintLevel }
export interface MentorResponse { level:HintLevel; message:string; xpCost:number; errorCategory?:string; solution?:string; source:'rules'|'llm'|'cache'; style?:ExplainStyle; provider?:string; model?:string; isLocal?:boolean; latencyMs?:number; hindsight?:{retainedCount:number;recalledFacts:string[];reflection:string}; visual?:{type:'trace_table'|'steps';title?:string;rows:string[][];columns?:string[]}; eventId?:string }
export interface MentorFeedbackRequest { eventId:string; helpful:boolean }
export interface ProgressRequest { challengeId:string; passed:boolean; hintsUsed:HintLevel[]; attempts:number; timeSpentSec:number; errorCategories:string[] }
export interface ProgressResponse { xpEarned:number; totalXp:number; level:number; gardenStage:'seed'|'sprout'|'bud'|'bloom'; streak:number; newBadges:string[]; nextChallengeId:string|null; nextReason?:string; pace:Pace; conceptMastery:Record<string,number> }
