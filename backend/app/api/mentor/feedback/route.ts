import { NextResponse } from 'next/server';
import { feedbackMentorEvent } from '@backend/lib/db';
export async function POST(request:Request){const body=await request.json();if(typeof body.eventId!=='string'||typeof body.helpful!=='boolean')return NextResponse.json({error:'Invalid feedback'},{status:400});feedbackMentorEvent(body.eventId,body.helpful);return NextResponse.json({saved:true})}
