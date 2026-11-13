import { NextResponse } from 'next/server';
import { challenges } from '@backend/lib/seed';
import { demoState } from '@backend/lib/db';
export async function GET(){const date=new Date();return NextResponse.json({month:date.toLocaleString('en',{month:'long'}),daysLeft:new Date(date.getFullYear(),date.getMonth()+1,0).getDate()-date.getDate(),xp:demoState.xp,level:demoState.level,streak:demoState.streak,pace:demoState.pace,mastery:demoState.mastery,recommendation:challenges.find(x=>x.id==='reverse-string')})}
