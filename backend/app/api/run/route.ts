import { NextResponse } from 'next/server';
import { challenges } from '@backend/lib/seed';
import { evaluateMock } from '@backend/lib/db';
import { retainMemory } from '@backend/lib/hindsight';
import type { Language } from '@backend/lib/types';
export async function POST(request:Request){try{const body=await request.json() as {code:string;language:Language;challengeId:string};const challenge=challenges.find(x=>x.id===body.challengeId);if(!challenge||!['python','javascript','cpp'].includes(body.language)||typeof body.code!=='string')return NextResponse.json({error:'Invalid run request'},{status:400});const testResults=challenge.testCases.map(test=>evaluateMock(body.code,body.language,test.input,test.expectedOutput).testResults[0]);const passed=testResults.every(test=>test.passed);retainMemory('anonymous',{category:'experience',challengeId:body.challengeId,language:body.language,summary:`${passed?'Passed':'Attempted'} ${challenge.title}`});return NextResponse.json({status:passed?'passed':'failed',stdout:testResults.map(x=>x.actual).join('\n'),stderr:'',testResults})}catch{return NextResponse.json({error:'Runner could not read that request.'},{status:400})}}
