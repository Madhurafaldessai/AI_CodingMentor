import { NextResponse } from 'next/server';
const names=['AlexR','CodeNinja','PyMaster','DevSam','ByteMe','LunaCode','SyntaxFox','LoopHero','NoviDev','PixelPanda'];
export async function GET(){return NextResponse.json(names.map((name,index)=>({rank:index+1,username:name,xp:[1420,1280,980,840,710,640,590,510,460,390][index],avatar:['🌱','🧑🏽‍💻','🦊','👩🏻‍💻','🐸','🌙','🪴','🦋','🌼','🐼'][index]})))}
