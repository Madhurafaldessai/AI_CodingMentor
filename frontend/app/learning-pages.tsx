'use client';
import { useEffect, useState } from 'react';
import { ArrowRight, ChevronDown, Code2, Flame, Moon, Sun, Terminal, Trophy } from 'lucide-react';
import { browserSupabase, fetchWithUserSession } from '../lib/supabase';
import type { FormEvent } from 'react';
type Lang='python'|'javascript'|'cpp';
const titles:Record<Lang,string>={python:'Python',javascript:'JavaScript',cpp:'C++'};
const chapters:Record<Lang,string[]>={python:['Hello World','Variables','Control Flow','Loops','Checkpoint Project','Lists','Functions','Classes & Objects','Modules','Final Project'],javascript:['The Console','Variables','Conditionals','Loops','Checkpoint Project','Arrays','Functions','Objects','Async Basics','Final Project'],cpp:['Hello World (C++)','Variables & Control Flow','Loops','Functions','Arrays & Strings','Pointers & References','Classes & Objects','Inheritance & Polymorphism','Standard Template Library (STL)','File Handling','Final Project']};
const exercises=['Setting Up','Hello World','Print and Comments','Your First Bug'];
const challengeList=[['reverse-string','Reverse a String','Strings · Loops','Easy'],['sum-two-numbers','Sum of Two Numbers','Variables · Input','Easy'],['even-or-odd','Even or Odd','Conditionals','Easy'],['fizzbuzz','FizzBuzz','Loops · Conditionals','Medium'],['palindrome-check','Palindrome Check','Strings · Conditions','Medium'],['factorial','Factorial','Loops · Recursion','Medium'],['count-vowels','Count Vowels','Strings · Loops','Easy'],['second-largest','Second Largest in Array','Arrays · Sorting','Hard'],['fibonacci','Fibonacci','Loops · Recursion','Medium'],['max-array','Max of Array','Arrays · Loops','Easy'],['two-sum','Two Sum','Arrays · Hash maps','Hard'],['anagram-check','Anagram Check','Strings · Sorting','Medium']];
function Header(){const [dark,setDark]=useState(false);useEffect(()=>{const t=localStorage.getItem('bb-theme')||'system';const d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);setDark(d);document.documentElement.classList.toggle('dark',d)},[]);function toggle(){const d=!dark;setDark(d);document.documentElement.classList.toggle('dark',d);localStorage.setItem('bb-theme',d?'dark':'light')}return <header className="topbar"><a className="brand" href="/dashboard"><span className="brand-icon"><Terminal size={16}/></span><span>Byte<span className="brand-green">Bloom</span></span></a><nav><a href="/dashboard">Learn</a><a href="/practice">Practice</a><a href="/interview">Interview practice</a><a href="/course/python">Switch language <ChevronDown size={13}/></a></nav><div className="top-actions"><span className="streak-chip"><Flame size={15}/> 3</span><button className="icon-button" aria-label="Toggle theme" onClick={toggle}>{dark?<Sun size={17}/>:<Moon size={17}/>}</button><a href="/settings" className="profile-btn">Profile</a></div></header>}
export function CoursePage({language}:{language:Lang}){const [open,setOpen]=useState(0);const [savedProgress,setSavedProgress]=useState<{completedChallenges:string[];totalXp:number}|null>(null);const [progressError,setProgressError]=useState('');const items=chapters[language];useEffect(()=>{let active=true;async function loadProgress(){try{const response=await fetchWithUserSession('/api/progress');const data=await response.json();if(!response.ok)throw new Error(data.error||'Your saved progress could not be loaded.');if(active)setSavedProgress({completedChallenges:data.completedChallenges,totalXp:data.totalXp})}catch(error){if(active){setProgressError(error instanceof Error?error.message:'Your saved progress could not be loaded.');console.error('Unable to load course progress',error)}}}void loadProgress();return()=>{active=false}},[]);return <><Header/><main className="page course-page"><div className="course-hero"><div><span className="pill blue">BEGINNER COURSE</span><h1>{titles[language]}</h1><p>Learn programming fundamentals through small, hands-on challenges. Bloom will be with you at every step.</p></div><div className="hero-code">{'>>> '}<span>print</span>("hello, world")</div></div><div className="course-layout"><div><div className="section-title course-title"><h2>The Course</h2><span className="tiny-muted">{savedProgress?`${savedProgress.completedChallenges.length} / 12 practice challenges complete`:'Loading saved progress…'}</span></div>{progressError&&<p className="form-error" role="status">{progressError}</p>}{items.map((name,index)=><section className="chapter" key={name}><button className="chapter-summary" onClick={()=>setOpen(open===index?-1:index)}><span className="chapter-num">{index===4||index===items.length-1?'⌖':index+1}</span><b>{name}</b><span className="chapter-progress">0 / {index===0?4:5}</span><ChevronDown size={15}/></button>{open===index&&(index===0?<>{exercises.map((exercise,j)=><a href="/lesson/python/setting-up" className="exercise-row" key={exercise}><span>Exercise {j+1}</span><b>{exercise}</b><span className="start-pill">{j===0?'Start':'???'}</span></a>)}<div className="locked-row">Bonus article <span>Complete chapter to unlock</span></div></>:<div className="locked-row">Complete the previous chapter to unlock these exercises <span>???</span></div>)}</section>)}</div><aside className="course-sidebar"><div className="panel"><div className="profile-heading"><div className="avatar">🌿</div><div><small className="tiny-muted">YOUR PROFILE</small><b>Saved progress</b></div></div><hr/><div className="label">PRACTICE PROGRESS</div><p className="side-stat">Challenges completed <b>{savedProgress?.completedChallenges.length ?? '—'} / 12</b></p><p className="side-stat">XP gained <b>{savedProgress?.totalXp ?? '—'}</b></p><hr/><div className="label">COURSE BADGES</div><div className="badges compact">{['Explorer','Problem Solver','Code Ninja','Consistent','Collaborator','Builder','Perfectionist','Graduate'].map((x,i)=><span className="grey-badge" key={x}>{['🌱','🧩','🥷','🔥','🤝','🛠️','💎','🎓'][i]}<small>{x}</small></span>)}</div></div></aside></div></main></>}
export function ChallengeList({interview=false}:{interview?:boolean}){const [language,setLanguage]=useState<Lang>('python');const [difficulty,setDifficulty]=useState('All');return <><Header/><main className="page practice-page"><div className="page-heading"><div><span className="pill pink">{interview?'INTERVIEW PRACTICE':'PRACTICE GARDEN'}</span><h1>{interview?'Practice thinking out loud.':'Choose a challenge to grow.'}</h1><p>{interview?'A five question session with step-by-step feedback.':'Short coding challenges matched to your pace and goals.'}</p></div>{interview&&<span className="streak-chip"><Flame size={14}/> 5 question session</span>}</div><div className="filter-bar"><select value={language} onChange={e=>setLanguage(e.target.value as Lang)} aria-label="Filter by language"><option value="python">Python</option><option value="javascript">JavaScript</option><option value="cpp">C++</option></select><select value={difficulty} onChange={e=>setDifficulty(e.target.value)} aria-label="Filter by difficulty"><option>All</option><option>Easy</option><option>Medium</option><option>Hard</option></select><span className="tiny-muted">12 challenges · Bloom adapts as you learn</span></div><div className="challenge-list">{challengeList.filter(row=>difficulty==='All'||row[3]===difficulty).map(([id,title,tags,level],index)=><a className="challenge-card" href={`/workspace/${id}`} key={id}><span className="challenge-index">{String(index+1).padStart(2,'0')}</span><div><h3>{title}</h3><p>{tags}</p></div><span className={`pill ${level==='Easy'?'green':level==='Hard'?'pink':'blue'}`}>{level.toUpperCase()}</span><span className="challenge-xp"><Trophy size={13}/> +40 XP</span><ArrowRight size={15}/></a>)}</div></main></>}
export function AuthFlow({mode}:{mode:'login'|'signup'|'onboarding'}){
 const [step,setStep]=useState(0);
 const [name,setName]=useState('');
 const [language,setLanguage]=useState('Python');
 const [style,setStyle]=useState('step_by_step');
 const [email,setEmail]=useState('');
 const [password,setPassword]=useState('');
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(false);

 async function handleAuth(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(!browserSupabase){setError('Sign-in is unavailable because authentication is not configured. Please contact support.');return}
  setBusy(true);setError('');
  try{
   if(mode==='signup'){
    const {data,error:signUpError}=await browserSupabase.auth.signUp({email:email.trim(),password});
    if(signUpError)throw signUpError;
    if(!data.session){setError('Your account was created, but email confirmation is enabled. Please confirm your email before logging in.');return}
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

 async function continueOnboarding(){
  if(step===0&&!/^[a-zA-Z0-9_]{3,16}$/.test(name.trim())){setError('Choose a username with 3–16 letters, numbers, or underscores.');return}
  if(step<2){setStep(step+1);setError('');return}
  if(!browserSupabase){setError('Your profile could not be saved because authentication is not configured.');return}
  setBusy(true);setError('');
  try{
   const {data:{user},error:userError}=await browserSupabase.auth.getUser();
   if(userError||!user)throw userError||new Error('Your session has expired. Please log in again.');
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

 return <main className="auth-shell"><div className="auth-meadow"><div className="auth-sun"/><div className="auth-mountains"/><div className="auth-hills"/><div className="auth-flowers">✿　✿　✿　✿　✿　✿　✿</div></div><a className="auth-brand" href="/"><span className="brand"><span className="brand-icon"><Terminal size={16}/></span><span>Byte<span className="brand-green">Bloom</span></span></span></a><button className="auth-theme" aria-label="Toggle theme" onClick={()=>{document.documentElement.classList.toggle('dark');localStorage.setItem('bb-theme',document.documentElement.classList.contains('dark')?'dark':'light')}}>☼</button><section className="auth-card">{mode==='onboarding'?<div className="gameboy"><div className="gb-brand">BYTE BLOOM</div><div className="gb-screen"><span className="pill blue">STEP {step+1} OF 3</span><h2>{['CREATE A USERNAME','SELECT CODING','YOUR LEARNING STYLE'][step]}</h2>{step===0?<input value={name} onChange={e=>setName(e.target.value)} placeholder="User Name" aria-label="Username" autoComplete="username"/>:step===1?<div className="language-picks">{['Python','JavaScript','C++'].map(x=><button type="button" className={language===x?'picked':''} onClick={()=>setLanguage(x)} key={x}>{x}</button>)}</div>:<div className="language-picks">{[['Step by step','step_by_step'],['Visual diagrams','visual'],['Analogies','analogy'],['Code first','code_first']].map(([label,value])=><button type="button" className={style===value?'picked':''} onClick={()=>setStyle(value)} key={value}>{label}</button>)}</div>}{error&&<small className="form-error" role="alert">{error}</small>}<button className="gb-continue" disabled={busy} onClick={continueOnboarding}>{busy?'SAVING…':step===2?'PLANT MY SEED':'CONTINUE'}</button></div><div className="gb-controls"><div className="dpad">✥</div><div className="gb-buttons"><b>B</b><b>A</b></div></div><div className="gb-footer">SELECT　 START</div></div>:<><span className="brand"><span className="brand-icon"><Terminal size={16}/></span><span>Byte<span className="brand-green">Bloom</span></span></span><h1>{mode==='login'?'Welcome back':'Create an account'}</h1><p className="auth-sub">{mode==='login'?'Pick up where your garden left off.':'Start growing your coding skills today.'}</p><form onSubmit={handleAuth}><label htmlFor="auth-email">Email</label><input id="auth-email" name="email" type="email" value={email} onChange={event=>setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" required/><label htmlFor="auth-password">Password</label><input id="auth-password" name="password" type="password" value={password} onChange={event=>setPassword(event.target.value)} placeholder="At least 8 characters" autoComplete={mode==='login'?'current-password':'new-password'} minLength={8} required/>{error&&<small className="form-error" role="alert">{error}</small>}<button type="submit" className="button button-primary auth-submit" disabled={busy}>{busy?'Please wait…':mode==='login'?'Log in':'Create account'} <ArrowRight size={15}/></button></form><p className="auth-login">{mode==='login'?"New to ByteBloom?":"Have an account?"} <a href={mode==='login'?'/signup':'/login'}>{mode==='login'?'Create account':'Log in'}</a></p></>}</section></main>
}
