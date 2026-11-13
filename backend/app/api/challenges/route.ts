import { NextResponse } from 'next/server';
import { challenges } from '@backend/lib/seed';
export async function GET(){return NextResponse.json(challenges)}
