'use client';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowRight, ChevronDown, Code2, Flame, Lightbulb, Moon, Sun, Terminal, Trophy } from 'lucide-react';
import { learnerProgressUpdatedEvent, useLearnerStreak } from '../lib/use-learner-streak';
import { browserSupabase } from '../lib/supabase';
import { fetchWithUserSession } from '../lib/supabase';
import { runInWorker } from '../lib/runners/client';
import { PixelKnightMentorBox, type MentorMeta } from './pixel-knight-avatar';
type Lang='python'|'javascript'|'cpp';
const titles:Record<Lang,string>={python:'Python',javascript:'JavaScript',cpp:'C++'};
const chapters:Record<Lang,string[]>={python:['Hello World','Variables','Control Flow','Loops','Checkpoint Project','Lists','Functions','Classes & Objects','Modules','Final Project'],javascript:['The Console','Variables','Conditionals','Loops','Checkpoint Project','Arrays','Functions','Objects','Async Basics','Final Project'],cpp:['Hello World (C++)','Variables & Control Flow','Loops','Functions','Arrays & Strings','Pointers & References','Classes & Objects','Inheritance & Polymorphism','Standard Template Library (STL)','File Handling','Final Project']};
const exercises=[['setting-up','Setting Up'],['hello-world','Hello World'],['print-and-comments','Print and Comments'],['your-first-bug','Your First Bug']] as const;
const lessonProgressStorageKey='bb-lesson-progress-v1';
const lessonContent={
  'setting-up':{
    title:'Set up your coding workspace',
    description:'Your coding environment is ready in the browser. Write and run a tiny program to check that your selected language is working.',
    task:'Make the program print exactly: Your coding setup is ready!',
    expected:'Your coding setup is ready!',
    starter:{python:'# Type your first line of Python here',javascript:'// Type your first line of JavaScript here',cpp:'#include <iostream>\nusing namespace std;\n\nint main() {\n  // Print a message to check your setup\n  return 0;\n}'}
  },
  'hello-world':{
    title:'Print your first greeting',
    description:'Programs can show text as output. Use your language’s print command to display a greeting.',
    task:'Print exactly: Hello, World!',
    expected:'Hello, World!',
    starter:{python:'# Print your greeting here',javascript:'// Print your greeting here',cpp:'#include <iostream>\nusing namespace std;\n\nint main() {\n  // Print your greeting here\n  return 0;\n}'}
  },
  'print-and-comments':{
    title:'Print a message and add a comment',
    description:'Comments are notes for people reading your code. They do not appear in the program output.',
    task:'Keep a comment in your code and print exactly: Comments do not print!',
    expected:'Comments do not print!',
    starter:{python:'# This comment will not appear in the output\nprint("Write your message here")',javascript:'// This comment will not appear in the output\nconsole.log("Write your message here");',cpp:'#include <iostream>\nusing namespace std;\n\nint main() {\n  // This comment will not appear in the output\n  cout << "Write your message here";\n  return 0;\n}'}
  },
  'your-first-bug':{
    title:'Find and fix your first bug',
    description:'A small typo can change a program’s output. Compare the output with the task and fix the greeting.',
    task:'Fix the text so the program prints exactly: I fixed my first bug!',
    expected:'I fixed my first bug!',
    starter:{python:'print("I fixed my first bug")',javascript:'console.log("I fixed my first bug");',cpp:'#include <iostream>\nusing namespace std;\n\nint main() {\n  cout << "I fixed my first bug";\n  return 0;\n}'}
  }
} satisfies Record<string,{title:string;description:string;task:string;expected:string;starter:Record<Lang,string>}>;
const challengeList=[['reverse-string','Reverse a String','Strings · Loops','Easy'],['sum-two-numbers','Sum of Two Numbers','Variables · Input','Easy'],['even-or-odd','Even or Odd','Conditionals','Easy'],['fizzbuzz','FizzBuzz','Loops · Conditionals','Medium'],['palindrome-check','Palindrome Check','Strings · Conditions','Medium'],['factorial','Factorial','Loops · Recursion','Medium'],['count-vowels','Count Vowels','Strings · Loops','Easy'],['second-largest','Second Largest in Array','Arrays · Sorting','Hard'],['fibonacci','Fibonacci','Loops · Recursion','Medium'],['max-array','Max of Array','Arrays · Loops','Easy'],['two-sum','Two Sum','Arrays · Hash maps','Hard'],['anagram-check','Anagram Check','Strings · Sorting','Medium']];
function Header({active='Learn',courseHref='/course/python',language}:{active?:string;courseHref?:string;language?:Lang}) {
  const [dark,setDark]=useState(false);
  const [earnedTitle,setEarnedTitle]=useState('Beginner');
  const streak=useLearnerStreak();
  useEffect(()=>{
    const t=localStorage.getItem('bb-theme')||'system';
    const d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);
    setDark(d);
    document.documentElement.classList.toggle('dark',d);
    async function loadTitle(){
      try{
        if(browserSupabase){
          const {data:sessionData}=await browserSupabase.auth.getSession();
          if(sessionData.session){
            const {data:profile}=await browserSupabase.from('profiles').select('experience_level').eq('id',sessionData.session.user.id).maybeSingle();
            if(profile?.experience_level){
              const lvl=profile.experience_level;
              setEarnedTitle(lvl==='beginner'?'Beginner':lvl.charAt(0).toUpperCase()+lvl.slice(1));
              return;
            }
          }
        }
        const saved=localStorage.getItem('bb-experience-level')||'Beginner';
        setEarnedTitle(saved.charAt(0).toUpperCase()+saved.slice(1));
      }catch{}
    }
    void loadTitle();
  },[]);
  function toggle(){
    const d=!dark;
    setDark(d);
    document.documentElement.classList.toggle('dark',d);
    localStorage.setItem('bb-theme',d?'dark':'light');
  }
  return <header className="topbar">
    <a className="brand" href="/dashboard"><span className="brand-icon"><Terminal size={16}/></span><span>Byte<span className="brand-green">Bloom</span></span></a>
    <nav>
      <a className={active==='Learn'?'nav-active':''} href={courseHref}>Learn</a>
      <a className={active==='Practice'?'nav-active':''} href="/practice">Practice</a>
      <a className={active==='My Progress'?'nav-active':''} href="/dashboard">My Progress</a>
    </nav>
    <div className="top-actions">
      <span className="streak-chip" aria-label={`${streak===null?'Loading':streak} day learning streak`}><Flame size={15}/> {streak??'—'}</span>
      <button className="icon-button" aria-label="Toggle theme" onClick={toggle}>{dark?<Sun size={17}/>:<Moon size={17}/>}</button>
      {active==='Learn'&&language&&<label className="course-language-picker">
        <span>Switch Language</span>
        <select aria-label="Switch course language" value={language} onChange={event=>{
          const selected=event.currentTarget.value;
          if(selected==='cpp')location.href='/course/cp+';
          else if(selected==='python'||selected==='javascript')location.href=`/course/${selected}`;
        }}>
          <option value="python">Python</option>
          <option value="cpp">C++</option>
          <option value="javascript">JavaScript</option>
        </select>
      </label>}
      <a href="/profile" className={`profile-btn ${active==='Profile'?'profile-active':''}`}>{earnedTitle}</a>
    </div>
  </header>;
}
export function CoursePage({language}:{language:Lang}) {
  const [open,setOpen]=useState(0);
  const [completedLessons,setCompletedLessons]=useState<Set<string>>(new Set());
  const items=chapters[language];
  const courseHref=`/course/${language==='cpp'?'cp+':language}`;
  useEffect(()=>{
    let active=true;
    async function loadCompletedLessons(){
      let local:Record<string,{completed?:boolean}>={};
      try{
        const {data,error}=browserSupabase?await browserSupabase.auth.getSession():{data:{session:null},error:null};
        if(error)throw error;
        const localKey=data.session?`${lessonProgressStorageKey}:${data.session.user.id}`:`${lessonProgressStorageKey}:guest`;
        const saved=localStorage.getItem(localKey);
        local=saved?JSON.parse(saved):{};
        if(!local||typeof local!=='object'||Array.isArray(local))throw new Error('Saved lesson progress has an invalid format.');
        if(active)setCompletedLessons(new Set(Object.entries(local).filter(([,record])=>record.completed).map(([key])=>key)));
        if(!data.session)return;
        const response=await fetchWithUserSession('/api/lesson-progress');
        const payload=await response.json();
        if(!response.ok)throw new Error(payload.error||'Your saved learning path could not be loaded.');
        if(active){
          const remote=payload.lessonProgress||{};
          setCompletedLessons(new Set(Object.entries(remote).filter(([,record])=>(record as {completed?:boolean}).completed).map(([key])=>key)));
        }
      }catch(error){
        console.error('Unable to read local lesson progress',error);
      }
    }
    void loadCompletedLessons();
    return()=>{active=false};
  },[language]);
  return <>
    <Header active="Learn" courseHref={courseHref} language={language}/>
    <main className="page course-page">
      <div className="course-hero">
        <div className="course-copy">
          <span className="pill blue">BEGINNER COURSE</span>
          <h1>{titles[language]}</h1>
          <p>Learn programming fundamentals through small, hands-on challenges. Bloom will be with you at every step.</p>
        </div>
        <div className="hero-code">{'>>> '}<span>print</span>("hello, world")</div>
      </div>
      <div className="course-layout">
          <div className="section-title course-title">
            <h2>The Course</h2>
            <span className="tiny-muted">{Array.from(completedLessons).filter(key=>key.startsWith(`${language}:`)).length} / {language==='python'?43:39} exercises complete</span>
          </div>
          {items.map((name,index)=><section className="chapter" key={name}>
            <button className="chapter-summary" onClick={()=>setOpen(open===index?-1:index)}>
              <span className="chapter-num">{index===4||index===items.length-1?'⌖':index+1}</span>
              <b>{name}</b>
              <span className="chapter-progress">{index===0?exercises.filter(([id])=>completedLessons.has(`${language}:${id}`)).length:0} / {index===0?4:5}</span>
              <ChevronDown size={15}/>
            </button>
            {open===index&&(index===0?<>{exercises.map(([id,exercise],j)=>{
              const isComplete=completedLessons.has(`${language}:${id}`);
              const isUnlocked=j===0||completedLessons.has(`${language}:${exercises[j-1][0]}`);
              return isUnlocked
                ?<a href={`/lesson/${language}/${id}`} className="exercise-row" key={id}><span>Exercise {j+1}</span><b>{exercise}</b><span className="start-pill">{isComplete?'Completed':'Start'}</span></a>
                :<div className="exercise-row exercise-locked" key={id} aria-disabled="true"><span>Exercise {j+1}</span><b>{exercise}</b><span className="start-pill">Locked</span></div>;
            })}<div className="locked-row">Bonus article <span>Complete chapter to unlock</span></div></>:<div className="locked-row">Complete the previous chapter to unlock these exercises <span>???</span></div>)}
          </section>)}
      </div>
    </main>
  </>;
}
export function LessonPage({language,exerciseId}:{language:Lang;exerciseId:string}) {
  const lesson=lessonContent[exerciseId as keyof typeof lessonContent];
  const [code,setCode]=useState(lesson?.starter[language]||lessonContent['setting-up'].starter[language]);
  const [result,setResult]=useState<{status:string;stdout?:string;stderr:string;testResults:{actual:string;passed:boolean}[]}|null>(null);
  const [busy,setBusy]=useState(false);
  const [progress,setProgress]=useState<Record<string,{attempts:number;completed:boolean;lastError:string|null;lastAttemptAt:string;completedAt:string|null}>>({});
  const [progressMode,setProgressMode]=useState<'loading'|'guest'|'account'|'local-fallback'|'error'>('loading');
  const [progressError,setProgressError]=useState('');
  const [mentorMessage,setMentorMessage]=useState('');
  const [mentorError,setMentorError]=useState('');
  const [mentorBusy,setMentorBusy]=useState(false);
  const [mentorMeta,setMentorMeta]=useState<MentorMeta|null>(null);
  const [nextHintLevel,setNextHintLevel]=useState(1);
  const courseHref=`/course/${language==='cpp'?'cp+':language}`;
  const langLabel=titles[language];
  const [storageKey,setStorageKey]=useState(`${lessonProgressStorageKey}:guest`);
  const progressKey=`${language}:${exerciseId}`;
  const exerciseIndex=exercises.findIndex(([id])=>id===exerciseId);
  const lessonRecord=progress[progressKey];
  const previousExercise=exerciseIndex>0?exercises[exerciseIndex-1][0]:null;
  const locked=Boolean(previousExercise&&!progress[`${language}:${previousExercise}`]?.completed);

  useEffect(()=>{
    setCode(lesson?.starter[language]||lessonContent['setting-up'].starter[language]);
    setResult(null);
    setMentorMessage('');
    setMentorError('');
    setNextHintLevel(1);
  },[exerciseId,language,lesson]);

  useEffect(()=>{
    let active=true;
    async function loadProgress(){
      let localProgress:typeof progress={};
      try{
        const auth=browserSupabase?await browserSupabase.auth.getSession():{data:{session:null},error:null};
        if(auth.error)throw auth.error;
        const session=auth.data.session;
        const currentStorageKey=session?`${lessonProgressStorageKey}:${session.user.id}`:`${lessonProgressStorageKey}:guest`;
        if(active)setStorageKey(currentStorageKey);
        const raw=localStorage.getItem(currentStorageKey);
        localProgress=raw?JSON.parse(raw):{};
        if(!localProgress||typeof localProgress!=='object'||Array.isArray(localProgress))throw new Error('Saved lesson progress has an invalid format.');
        if(!session){
          if(active){setProgress(localProgress);setProgressMode('guest')}
          return;
        }
      }catch(error){
        if(active){
          setProgressMode('error');
          setProgressError(error instanceof Error?error.message:'Your saved learning path could not be read.');
        }
        return;
      }
      try{
        const response=await fetchWithUserSession('/api/lesson-progress');
        const payload=await response.json();
        if(!response.ok)throw new Error(payload.error||'Your saved learning path could not be loaded.');
        if(active){setProgress(payload.lessonProgress||{});setProgressMode('account')}
      }catch(error){
        if(active){
          setProgress(localProgress);
          setProgressMode('local-fallback');
          setProgressError(`Progress sync is unavailable. You can continue locally, but it will not sync to your account yet. ${error instanceof Error?error.message:'Please try again later.'}`);
        }
      }
    }
    void loadProgress();
    return()=>{active=false};
  },[language]);

  function saveLocalProgress(next:Record<string,{attempts:number;completed:boolean;lastError:string|null;lastAttemptAt:string;completedAt:string|null}>){
    try{localStorage.setItem(storageKey,JSON.stringify(next))}
    catch(error){console.error('Unable to save local lesson progress',error);setProgressError('Your progress could not be saved in this browser. Check available storage and try again.')}
  }

  async function askBloom(level:number,currentCode:string,errorText:string,attempts:number){
    if(!lesson)return;
    setMentorBusy(true);setMentorError('');
    try{
      const completedLessons=Object.entries(progress)
        .filter(([key,record])=>key.startsWith(`${language}:`)&&record.completed)
        .map(([key])=>key.slice(language.length+1));
      const attemptedLessons=Object.entries(progress)
        .filter(([key,record])=>key.startsWith(`${language}:`)&&record.attempts>0)
        .map(([key,record])=>`${key.slice(language.length+1)}: ${record.attempts} attempt(s)${record.lastError?`, latest issue: ${record.lastError}`:''}`);
      const response=await fetch('/api/mentor',{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({
          challengeId:`lesson-${exerciseId}`,
          language,
          code:currentCode,
          error:errorText,
          hintLevel:level,
          style:localStorage.getItem('bb-style')||'step_by_step',
          lessonContext:{title:lesson.title,task:lesson.task,expectedOutput:lesson.expected,completedLessons,attemptedLessons,attempts}
        })
      });
      const payload=await response.json();
      if(!response.ok)throw new Error(payload.error||'Bloom could not prepare a hint right now.');
      setMentorMessage(payload.message||'Compare your output with the expected result, one character at a time.');
      setMentorMeta(payload);
      setNextHintLevel(Math.min(level+1,4));
    }catch(error){
      setMentorError(error instanceof Error?error.message:'Bloom could not prepare a hint right now.');
    }finally{setMentorBusy(false)}
  }

  async function run(){
    if(!lesson||locked||progressMode==='loading'||progressMode==='error')return;
    setBusy(true);setResult(null);
    try{
      let output:{status:string;stdout?:string;stderr:string;testResults:{actual:string;passed:boolean}[]};
      if(language==='cpp'){
        const response=await fetch('/api/run-cpp',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code,testCases:[{input:'',expectedOutput:lesson.expected}]})});
        const data=await response.json();
        if(!response.ok)throw new Error(data.error||'The code runner could not process this program.');
        output=data;
      }else{
        const response=await runInWorker(code,language,[{input:'',expected:lesson.expected}]);
        output={...response,stdout:response.testResults.map(test=>test.actual).join('\n')};
      }
      setResult(output);
      const passed=output.status==='passed';
      const failedTest=output.testResults.find(test=>!test.passed);
      const actual=failedTest?.actual??output.stdout??output.stderr??'';
      const errorText=passed?'':output.stderr||`Your output was ${JSON.stringify(failedTest?.actual??output.stdout??'')}, but the expected output is ${JSON.stringify(lesson.expected)}.`;
      const oldRecord=progress[progressKey];
      const nextRecord={
        attempts:(oldRecord?.attempts??0)+1,
        completed:Boolean(oldRecord?.completed||passed),
        lastError:passed?null:errorText,
        lastAttemptAt:new Date().toISOString(),
        completedAt:passed?oldRecord?.completedAt??new Date().toISOString():oldRecord?.completedAt??null
      };
      const nextProgress={...progress,[progressKey]:nextRecord};
      if(progressMode==='guest'){
        saveLocalProgress(nextProgress);
        setProgress(nextProgress);
      }else{
        try{
          const response=await fetchWithUserSession('/api/lesson-progress',{
            method:'POST',
            headers:{'content-type':'application/json'},
            body:JSON.stringify({lessonId:exerciseId,language,passed,error:errorText})
          });
          const payload=await response.json();
          if(!response.ok)throw new Error(payload.error||'Your learning activity could not be saved.');
          setProgress(payload.lessonProgress||nextProgress);
          setProgressMode('account');
          setProgressError('');
          window.dispatchEvent(new Event(learnerProgressUpdatedEvent));
        }catch(error){
          const message=error instanceof Error?error.message:'Your learning activity could not be saved.';
          setProgressError(`Progress sync is unavailable. Your activity is saved in this browser only. ${message}`);
          saveLocalProgress(nextProgress);
          setProgress(nextProgress);
          setProgressMode('local-fallback');
        }
      }
      if(!passed){
        setMentorMessage(`🛡️ Close! Your code output '${actual}' instead of '${lesson.expected}'. Want a tactical clue?`);
        setNextHintLevel(level=>Math.min(level+1,4));
        void askBloom(nextHintLevel,code,errorText,nextRecord.attempts);
      }else{
        setMentorMessage('⚔️ Quest Complete! Your output matched every test case!');
        setMentorError('');
      }
    }catch(error){
      const message=error instanceof Error?error.message:'Your program could not be run.';
      setResult({status:'runtime_error',stderr:message,testResults:[]});
    }finally{setBusy(false)}
  }
  if(!lesson)return <><Header active="Learn" courseHref={courseHref} language={language}/><main className="page lesson-page"><section className="panel"><h1>Exercise not found</h1><p>Choose an exercise from the course page to continue learning.</p><a className="button button-primary" href={courseHref}>Back to course <ArrowRight size={15}/></a></section></main></>;
  if(progressMode==='loading')return <><Header active="Learn" courseHref={courseHref} language={language}/><main className="page lesson-page"><p role="status">Loading your saved learning path…</p></main></>;
  if(progressMode==='error')return <><Header active="Learn" courseHref={courseHref} language={language}/><main className="page lesson-page"><section className="panel"><h1>Your learning path could not be loaded</h1><p role="alert">{progressError}</p><a className="button button-primary" href={courseHref}>Back to course <ArrowRight size={15}/></a></section></main></>;
  if(locked)return <><Header active="Learn" courseHref={courseHref} language={language}/><main className="page lesson-page"><section className="panel lesson-locked"><span className="pill yellow">LESSON LOCKED</span><h1>Finish the previous exercise first</h1><p>Run the previous lesson’s program and match its expected output. Bloom can guide you if you get stuck.</p><a className="button button-primary" href={`/lesson/${language}/${previousExercise}`}>Return to the previous exercise <ArrowRight size={15}/></a></section></main></>;
  return <><Header active="Learn" courseHref={courseHref} language={language}/><main className="page lesson-page">
    <a className="lesson-back" href={courseHref}>← Back to {langLabel} course</a>
    <div className="lesson-heading"><span className="pill blue">BEGINNER COURSE · EXERCISE</span><h1>{lesson.title}</h1><p>{lesson.description}</p></div>
    <div className="lesson-grid">
      <section className="panel lesson-instructions"><h2>Your task</h2><p>{lesson.task}</p><div className="lesson-tip"><b>What to learn</b><span>{exerciseId==='setting-up'?'The browser editor is already set up. Use the print statement for your selected language.':exerciseId==='hello-world'?'Use the print command to show text on the screen.':exerciseId==='print-and-comments'?'Use # for Python comments, // for JavaScript and C++ comments.':'Read the expected output carefully: the message must match exactly.'}</span></div><div className="lesson-example"><span>EXPECTED OUTPUT</span><code>{lesson.expected}</code></div></section>
      <section className="panel lesson-editor-panel"><div className="lesson-editor-head"><b>{langLabel}</b><span>main.{language==='python'?'py':language==='javascript'?'js':'cpp'}</span></div><label className="sr-only" htmlFor="lesson-code">Code editor</label><textarea id="lesson-code" className="lesson-code" spellCheck={false} value={code} onChange={event=>setCode(event.target.value)}/><button type="button" className="button button-primary lesson-run" disabled={busy} onClick={()=>void run()}>{busy?'Running…':'Run code'} <ArrowRight size={15}/></button>{result&&<div className={`lesson-output ${result.status==='passed'?'lesson-output-success':'lesson-output-error'}`} role="status"><b>{result.status==='passed'?'Nice work — that’s correct.':result.status==='failed'?'Not quite. Check your output and try again.':result.status==='save_error'?'Correct output, but progress could not be saved.':'Your program could not run.'}</b><pre>{result.stdout||result.stderr||'No output was produced.'}</pre></div>}
        {progressError&&<p className="lesson-save-error" role="alert">{progressError}</p>}
        <div className="lesson-mentor"><PixelKnightMentorBox message={mentorMessage} busy={mentorBusy||busy} meta={mentorMeta} onAsk={()=>void askBloom(nextHintLevel,code,lessonRecord?.lastError||'',(lessonRecord?.attempts||0)+1)} buttonLabel={mentorMessage?'Ask ByteKnight for another hint →':'Ask ByteKnight for a hint →'}/>{mentorError&&<p className="lesson-save-error" role="alert">{mentorError}</p>}</div>
      </section>
    </div>
    <div className="lesson-navigation"><span>Exercise {exerciseIndex+1} of {exercises.length}{lessonRecord?.completed?' · Completed':''}</span>{exerciseIndex<exercises.length-1&&(lessonRecord?.completed?<a href={`/lesson/${language}/${exercises[exerciseIndex+1][0]}`}>Next exercise <ArrowRight size={14}/></a>:<span className="lesson-next-locked" aria-disabled="true">Complete this exercise to unlock the next one</span>)}</div>
  </main></>;
}
export function ChallengeList({interview=false}:{interview?:boolean}){const [language,setLanguage]=useState<Lang>('python');const [difficulty,setDifficulty]=useState('All');return <><Header active={interview?'Interview practice':'Practice'}/><main className="page practice-page"><div className="page-heading"><div><span className="pill pink">{interview?'INTERVIEW PRACTICE':'PRACTICE GARDEN'}</span><h1>{interview?'Practice thinking out loud.':'Choose a challenge to grow.'}</h1><p>{interview?'A five question session with step-by-step feedback.':'Short coding challenges matched to your pace and goals.'}</p></div>{interview&&<span className="streak-chip"><Flame size={14}/> 5 question session</span>}</div><div className="filter-bar"><select value={language} onChange={e=>setLanguage(e.target.value as Lang)} aria-label="Filter by language"><option value="python">Python</option><option value="javascript">JavaScript</option><option value="cpp">C++</option></select><select value={difficulty} onChange={e=>setDifficulty(e.target.value)} aria-label="Filter by difficulty"><option>All</option><option>Easy</option><option>Medium</option><option>Hard</option></select><span className="tiny-muted">12 challenges · Bloom adapts as you learn</span></div><div className="challenge-list">{challengeList.filter(row=>difficulty==='All'||row[3]===difficulty).map(([id,title,tags,level],index)=><a className="challenge-card" href={`/workspace/${id}`} key={id}><span className="challenge-index">{String(index+1).padStart(2,'0')}</span><div><h3>{title}</h3><p>{tags}</p></div><span className={`pill ${level==='Easy'?'green':level==='Hard'?'pink':'blue'}`}>{level.toUpperCase()}</span><span className="challenge-xp"><Trophy size={13}/> +40 XP</span><ArrowRight size={15}/></a>)}</div></main></>}
export function AuthFlow({mode}:{mode:'login'|'signup'|'onboarding'}){
  const [step,setStep]=useState(0);
  const [name,setName]=useState('');
  const [language,setLanguage]=useState('Python');
  const [style,setStyle]=useState('step_by_step');
  const [error,setError]=useState('');
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [busy,setBusy]=useState(false);

  async function finish(){
    if(step===0&&!/^[a-zA-Z0-9_]{3,16}$/.test(name.trim())){
      setError('Use 3–16 letters, numbers, or underscores.');
      return;
    }
    if(step<2){setStep(step+1);setError('');return}
    if(!browserSupabase){setError('Sign-in is unavailable because authentication is not configured.');return}
    setBusy(true);setError('');
    try{
      const {data:{user},error:userError}=await browserSupabase.auth.getUser();
      if(userError||!user)throw userError||new Error('Please log in to finish setting up your profile.');
      const {error:saveError}=await browserSupabase.from('profiles').upsert({
        id:user.id,
        username:name.trim(),
        language:language.toLowerCase(),
        explain_style:style
      },{onConflict:'id'});
      if(saveError)throw saveError;
      localStorage.setItem('bb-name',name.trim());
      localStorage.setItem('bb-language',language.toLowerCase());
      localStorage.setItem('bb-style',style);
      location.assign('/dashboard');
    }catch(error){
      setError(error instanceof Error?error.message:'Your profile could not be saved. Please try again.');
    }finally{setBusy(false)}
  }

  async function continueWithCredentials(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(!browserSupabase){setError('Sign-in is unavailable because authentication is not configured.');return}
    setBusy(true);setError('');
    try{
      if(mode==='signup'){
        const {data,error:signUpError}=await browserSupabase.auth.signUp({email:email.trim(),password});
        if(signUpError)throw signUpError;
        if(!data.session)throw new Error('Your account was created, but email confirmation is enabled. Confirm your email before logging in.');
        location.assign('/onboarding/username');
        return;
      }
      const {data,error:signInError}=await browserSupabase.auth.signInWithPassword({email:email.trim(),password});
      if(signInError)throw signInError;
      const {data:profile,error:profileError}=await browserSupabase.from('profiles').select('username').eq('id',data.user.id).maybeSingle();
      if(profileError)throw profileError;
      if(!profile?.username){location.assign('/onboarding/username');return}
      localStorage.setItem('bb-name',profile.username);
      const next=new URLSearchParams(location.search).get('next');
      location.assign(next?.startsWith('/')&&!next.startsWith('//')?next:'/dashboard');
    }catch(error){
      setError(error instanceof Error?error.message:'We could not complete sign-in. Please try again.');
    }finally{setBusy(false)}
  }

  return <main className="auth-shell">
    <div className="auth-meadow"><div className="auth-sun"/><div className="auth-mountains"/><div className="auth-hills"/><div className="auth-flowers">✿　✿　✿　✿　✿　✿　✿</div></div>
    <a className="auth-brand" href="/"><span className="brand"><span className="brand-icon"><Terminal size={16}/></span><span>Byte<span className="brand-green">Bloom</span></span></span></a>
    <button className="auth-theme" aria-label="Toggle theme" onClick={()=>{document.documentElement.classList.toggle('dark');localStorage.setItem('bb-theme',document.documentElement.classList.contains('dark')?'dark':'light')}}>☼</button>
    <section className="auth-card">
      {mode==='onboarding'?<div className="gameboy">
        <div className="gb-brand">BYTE BLOOM</div>
        <div className="gb-screen">
          <span className="pill blue">STEP {step+1} OF 3</span>
          <h2>{['CREATE A USERNAME','SELECT CODING','YOUR LEARNING STYLE'][step]}</h2>
          {step===0?<input value={name} onChange={e=>setName(e.target.value)} placeholder="User Name" autoComplete="username"/>:step===1
            ?<div className="language-picks">{['Python','JavaScript','C++'].map(x=><button type="button" className={language===x?'picked':''} onClick={()=>setLanguage(x)} key={x}>{x}</button>)}</div>
            :<div className="language-picks">{[['Step by step','step_by_step'],['Visual diagrams','visual'],['Analogies','analogy'],['Code first','code_first']].map(([label,value])=><button type="button" className={style===value?'picked':''} onClick={()=>setStyle(value)} key={value}>{label}</button>)}</div>}
          {error&&<small className="form-error" role="alert">{error}</small>}
          <button type="button" className="gb-continue" onClick={finish} disabled={busy}>{busy?'SAVING…':step===2?'PLANT MY SEED':'CONTINUE'}</button>
        </div>
        <div className="gb-controls"><div className="dpad">✥</div><div className="gb-buttons"><b>B</b><b>A</b></div></div><div className="gb-footer">SELECT　 START</div>
      </div>:<>
        <span className="brand"><span className="brand-icon"><Terminal size={16}/></span><span>Byte<span className="brand-green">Bloom</span></span></span>
        <h1>{mode==='login'?'Welcome back':'Create an account'}</h1>
        <p className="auth-sub">{mode==='login'?'Pick up where your garden left off.':'Start growing your coding skills today.'}</p>
        <form onSubmit={continueWithCredentials}>
          <label htmlFor="auth-email">Email</label>
          <input id="auth-email" name="email" type="email" value={email} onChange={event=>setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" required/>
          <label htmlFor="auth-password">Password</label>
          <input id="auth-password" name="password" type="password" value={password} onChange={event=>setPassword(event.target.value)} placeholder="At least 8 characters" autoComplete={mode==='login'?'current-password':'new-password'} minLength={8} required/>
          {error&&<small className="form-error" role="alert">{error}</small>}
          <button type="submit" className="button button-primary auth-submit" disabled={busy}>{busy?'Please wait…':mode==='login'?'Log in':'Create account'} <ArrowRight size={15}/></button>
        </form>
        <p className="auth-login">{mode==='login'?"New to ByteBloom?":"Have an account?"} <a href={mode==='login'?'/signup':'/login'}>{mode==='login'?'Create account':'Log in'}</a></p>
      </>}
    </section>
  </main>;
}
