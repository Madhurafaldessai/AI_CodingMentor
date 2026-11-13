import { NextResponse } from 'next/server';
import { challenges } from '@backend/lib/seed';
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){const {id}=await params;const challenge=challenges.find(x=>x.id===id);return challenge?NextResponse.json(challenge):NextResponse.json({error:'Challenge not found'},{status:404})}
