import { NextResponse } from 'next/server';
import { demoState } from '@backend/lib/db';
import { challenges } from '@backend/lib/seed';
export async function GET(){return NextResponse.json({pace:demoState.pace,conceptMastery:demoState.mastery,xpByDay:[45,80,30,95,55,120,70],errors:['wrong answer','syntax'],recommended:challenges.slice(0,3)})}
