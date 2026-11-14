'use client';
import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, Check, ChevronDown, ChevronRight, CircleHelp, Code2, Flame, Flower2, Leaf, Lightbulb, Menu, Moon, Play, Plus, RotateCcw, Search, Settings, Sparkles, Sun, Terminal, ThumbsDown, ThumbsUp, Trophy, UserRound, X, Zap } from 'lucide-react';
import WorkspaceView from './workspace-view';
import { PixelKnightAvatar } from './pixel-knight-avatar';
import { AuthFlow, ChallengeList, CoursePage, LessonPage } from './learning-pages';
import { useLearnerStreak, learnerProgressUpdatedEvent } from '../lib/use-learner-streak';
import { browserSupabase } from '../lib/supabase';

const concepts = [{name:'Strings',score:42},{name:'Loops',score:68},{name:'Variables',score:82},{name:'Conditionals',score:91}];
const friends = ['AlexR','CodeNinja','PyMaster','DevSam','ByteMe','LunaCode','SyntaxFox','LoopHero','NoviDev','PixelPanda'];

export const BADGE_CATALOG = [
  { id: 'first-steps', icon: '🌱', title: 'First steps', desc: 'Completed your first coding exercise' },
  { id: 'on-a-roll', icon: '🔥', title: 'On a roll', desc: 'Achieved a learning streak of at least 1 day' },
  { id: 'bug-whisperer', icon: '🧠', title: 'Bug whisperer', desc: 'Fixed an error and completed an exercise' },
  { id: 'next-up', icon: '✿', title: 'Next up', desc: 'Reached 100 or more total XP' }
];

export function getEarnedTitle(experienceLevel?: string, level: number = 1): string {
  if (level >= 5) return 'Master';
  if (level === 4) return 'Developer';
  if (level === 3) return 'Adept';
  if (level === 2) return 'Apprentice';
  if (experienceLevel) {
    const formatted = experienceLevel.charAt(0).toUpperCase() + experienceLevel.slice(1).toLowerCase();
    if (formatted === 'Beginner') return 'Beginner';
    if (formatted === 'Some_experience') return 'Apprentice';
    if (formatted === 'Confident') return 'Adept';
    return formatted;
  }
  return 'Beginner';
}

function Brand(){return <a className="brand" href="/dashboard"><span className="brand-icon"><Terminal size={16}/></span><span>Byte<span className="brand-green">Bloom</span></span></a>}

function Mascot({small=false}:{small?:boolean}){return <PixelKnightAvatar size={small?36:64}/>}

function Topbar({active='My Progress', earnedTitle='Beginner'}:{active?:string; earnedTitle?:string}){
  const [theme,setTheme]=useState<'light'|'dark'|'system'>('system');
  const [dark,setDark]=useState(false);
  const streak=useLearnerStreak();
  useEffect(()=>{
    const t=(localStorage.getItem('bb-theme')||'system') as 'light'|'dark'|'system';
    setTheme(t);
    const d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);
    setDark(d);
    document.documentElement.classList.toggle('dark',d);
  },[]);
  function toggle(){
    const next=theme==='system'?'light':theme==='light'?'dark':'system';
    const d=next==='dark'||(next==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);
    setTheme(next);
    setDark(d);
    document.documentElement.classList.toggle('dark',d);
    localStorage.setItem('bb-theme',next);
  }
  return <header className="topbar">
    <Brand/>
    <nav>
      <a className={active==='Learn'?'nav-active':''} href="/course/python">Learn</a>
      <a href="/practice">Practice</a>
      <a className={active==='My Progress'?'nav-active':''} href="/dashboard">My Progress</a>
    </nav>
    <div className="top-actions">
      <span className="streak-chip" aria-label={`${streak===null?'Loading':streak} day learning streak`}><Flame size={15}/> {streak??'—'}</span>
      <button className="icon-button" aria-label={`Theme: ${theme}. Click to change`} onClick={toggle}>{dark?<Sun size={17}/>:<Moon size={17}/>}</button>
      <a href="/profile" className={`profile-btn ${active==='Profile'?'profile-active':''}`}>{earnedTitle} <ChevronDown size={13}/></a>
    </div>
  </header>;
}


function Meter({value}:{value:number}){return <div className="meter"><span style={{width:`${value}%`}}/></div>}
function Panel({children,className=''}:{children:React.ReactNode,className?:string}){return <section className={`panel ${className}`}>{children}</section>}
function Garden(){return <div className="garden-scene"><div className="sun-disc"/><div className="cloud cloud-a"/><div className="cloud cloud-b"/><div className="mountain m-a"/><div className="mountain m-b"/><div className="hill hill-back"/><div className="hill hill-front"/><div className="pixel-tree tree-a">♠</div><div className="pixel-tree tree-b">♠</div><div className="field-flower f-a">✿</div><div className="field-flower f-b">✿</div><div className="field-flower f-c">✿</div><div className="banner-content"><div className="eyebrow">YOUR NEXT CHAPTER STARTS HERE</div><h1>Grow your code.<br/><span>Bloom your skills.</span></h1><p>Small steps, bright ideas, and a little help from Bloom.</p><a className="button button-primary" href="/course/python">Continue learning <ArrowRight size={16}/></a></div></div>}

type LessonRecord={attempts?:number;completed?:boolean;lastError?:string|null;lastAttemptAt?:string;completedAt?:string|null};
type LearnerSnapshot={
  username:string;
  experienceLevel:string;
  totalXp:number;
  streak:number;
  completed:Record<string,LessonRecord>;
  completedChallenges:string[];
  badges:string[];
  leaderboard:any[];
};

function computeLocalStreak(progress: Record<string, LessonRecord>): number {
  const dates = Array.from(new Set(Object.values(progress).filter(x=>x.completedAt).map(x=>x.completedAt!.slice(0,10)))).sort();
  if (!dates.length) return 0;
  const today = new Date().toISOString().slice(0,10);
  const yesterday = new Date(Date.now()-86400000).toISOString().slice(0,10);
  const set = new Set(dates);
  if (!set.has(today) && !set.has(yesterday)) return 0;
  let s = 0;
  const d = new Date(set.has(today) ? today : yesterday);
  while (set.has(d.toISOString().slice(0,10))) { s++; d.setDate(d.getDate()-1); }
  return s;
}

// @ts-ignore
function useLearnerSnapshot(){
  const [data,setData]=useState<LearnerSnapshot>({
    username:'Explorer',
    experienceLevel:'beginner',
    totalXp:0,
    streak:0,
    completed:{},
    completedChallenges:[],
    badges:[],
    leaderboard:[]
  });

  useEffect(()=>{
    let alive=true;
    const load=async()=>{
      let progress:Record<string,LessonRecord>={};
      let realStreak=0;
      let profileName='Explorer';
      let experienceLevel='beginner';
      let completedChallenges:string[]=[];
      let earnedBadges:string[]=[];

      try{
        const sessionResult=browserSupabase?await browserSupabase.auth.getSession():null;
        const session=sessionResult?.data?.session;
        const user=session?.user;
        const id=user?.id;

        // Fetch via lesson-progress API with auth token
        if(browserSupabase&&session){
          try{
            const res=await fetch('/api/lesson-progress',{
              headers:{Authorization:`Bearer ${session.access_token}`}
            });
            if(res.ok){
              const payload=await res.json();
              if(payload.lessonProgress) progress=payload.lessonProgress;
              if(typeof payload.streak==='number') realStreak=payload.streak;
              if(payload.experienceLevel) experienceLevel=payload.experienceLevel;
              if(payload.username) profileName=payload.username;
              if(Array.isArray(payload.completedChallenges)) completedChallenges=payload.completedChallenges;
              if(Array.isArray(payload.badges)) earnedBadges=payload.badges;
            }
          }catch(e){
            console.warn('API lesson-progress fetch failed',e);
          }
        }

        // Direct Supabase table fallback if API did not load
        if(browserSupabase&&session&&id&&Object.keys(progress).length===0){
          try{
            const [lpRes,profRes,ubRes]=await Promise.all([
              browserSupabase.from('learner_progress').select('*').eq('user_id',id).maybeSingle(),
              browserSupabase.from('profiles').select('*').eq('id',id).maybeSingle(),
              browserSupabase.from('user_badges').select('badge_id').eq('user_id',id)
            ]);
            if(lpRes.data?.lesson_progress) progress=lpRes.data.lesson_progress;
            if(typeof lpRes.data?.streak==='number') realStreak=lpRes.data.streak;
            if(Array.isArray(lpRes.data?.completed_challenges)) completedChallenges=lpRes.data.completed_challenges;
            if(profRes.data?.username) profileName=profRes.data.username;
            if(profRes.data?.experience_level) experienceLevel=profRes.data.experience_level;
            if(Array.isArray(ubRes.data)) earnedBadges=ubRes.data.map((b:any)=>b.badge_id);
          }catch(e){
            console.warn('Direct Supabase fetch failed',e);
          }
        }

        // Merge offline/localStorage data
        const localKeys=[`bb-lesson-progress-v1:${id||'guest'}`,'bb-lesson-progress-v1:guest','bb-lesson-progress-v1'];
        for(const key of localKeys){
          try{
            const raw=localStorage.getItem(key);
            if(raw){
              const parsed=JSON.parse(raw);
              for(const[k,v]of Object.entries(parsed)){
                if(!(k in progress)) progress[k]=v as LessonRecord;
              }
            }
          }catch{}
        }

        if(!realStreak) realStreak=computeLocalStreak(progress);
        if(profileName==='Explorer'){
          profileName=user?.user_metadata?.username||user?.user_metadata?.name||localStorage.getItem('bb-name')||'Explorer';
        }

        const completedCount=Object.values(progress).filter(x=>x.completed).length;
        const totalXp=completedCount*50+(completedChallenges.length*40);

        // Fallback badge derivation from real progress if not yet recorded in database
        if(earnedBadges.length===0&&completedCount>0){
          const localBadges:string[]=[];
          if(completedCount>=1) localBadges.push('first-steps');
          if(realStreak>=1) localBadges.push('on-a-roll');
          const errorSolved=Object.values(progress).some(x=>Boolean(x.lastError)||((x.attempts||0)>1));
          if(errorSolved) localBadges.push('bug-whisperer');
          if(totalXp>=100) localBadges.push('next-up');
          earnedBadges=localBadges;
        }

        const leaderboard=await fetch('/api/leaderboard').then(r=>r.ok?r.json():[]).catch(()=>[]);

        if(alive){
          setData({
            username:String(profileName),
            experienceLevel,
            totalXp,
            streak:realStreak,
            completed:progress,
            completedChallenges,
            badges:earnedBadges,
            leaderboard:Array.isArray(leaderboard)?leaderboard:[]
          });
        }
      }catch(e){
        console.error('Snapshot load error',e);
        if(alive) setData(current=>({...current,completed:progress}));
      }
    };
    void load();
    window.addEventListener('storage',load);
    window.addEventListener(learnerProgressUpdatedEvent,load);
    return()=>{
      alive=false;
      window.removeEventListener('storage',load);
      window.removeEventListener(learnerProgressUpdatedEvent,load);
    };
  },[]);
  return data;
}

function Dashboard(){
  const learner=useLearnerSnapshot();
  const [editing,setEditing]=useState(false);
  const [name,setName]=useState(learner.username);
  useEffect(()=>setName(learner.username),[learner.username]);

  const records=Object.entries(learner.completed);
  const completed=records.filter(([,x])=>x.completed);
  const completedCount=completed.length;
  // Real quests completed from completedChallenges
  const questCount=learner.completedChallenges.length;
  const attempts=records.reduce((n,[,x])=>n+(x.attempts||0),0);
  const success=attempts?Math.round(completedCount/attempts*100):0;
  const level=Math.max(1,Math.floor(learner.totalXp/200)+1);
  const inLevel=learner.totalXp%200;
  const minutes=Math.max(0,attempts*3+completedCount*3);
  const time=minutes>=60?`${(minutes/60).toFixed(1)}h`:`${minutes}m`;
  const today=new Date().toISOString().slice(0,10);
  const todayCompleted=completed.filter(([,x])=>x.completedAt?.slice(0,10)===today).length;
  const todayXp=todayCompleted*50;
  const langs=[['PY','Python','python',4,'#3778ed'],['JS','JavaScript','javascript',4,'#f6c144'],['C++','C++','cpp',4,'#9b6cf5']] as const;
  const next=records.find(([,x])=>!x.completed)?.[0]?.split(':')[1]||'your next lesson';

  const earnedTitle=getEarnedTitle(learner.experienceLevel, level);
  const earnedSet=new Set(learner.badges);
  const badgeCount=learner.badges.length;

  const board=[...learner.leaderboard,{username:name,xp:learner.totalXp,avatar:'🌿'}]
    .sort((a,b)=>b.xp-a.xp)
    .filter((x,i,a)=>a.findIndex(y=>y.username===x.username)===i)
    .map((x,i)=>({...x,rank:i+1}));

  return <>
    <Topbar active="My Progress" earnedTitle={earnedTitle}/>
    <main className="page dashboard">
      <Garden/>
      <div className="dashboard-grid">
        <div className="dashboard-row">
          <Panel className="quest-card">
            <div className="card-top"><span className="pill pink">MONTHLY QUEST</span></div>
            <h3>{new Intl.DateTimeFormat('en',{month:'long'}).format(new Date())} Quest</h3>
            <p>Complete coding challenges and grow your garden.</p>
            <Meter value={Math.min(100,questCount/12*100)}/>
            <div className="row-between">
              <b>{questCount} <span className="soft">/ 12 quests</span></b>
              <span className="spark-xp"><Zap size={14}/> {questCount*50} XP</span>
            </div>
          </Panel>

          <Panel className="leader-card">
            <div className="section-title"><h3>Leaderboard</h3></div>
            <div className="leader-head"><span>RANK</span><span>LEARNER</span><span>XP</span></div>
            {board.slice(0,5).map(x=><div className="leader-row" key={x.username}>
              <b>{String(x.rank).padStart(2,'0')}</b>
              <span className="avatar">{x.avatar||'🌱'}</span>
              <span className="leader-name">{x.username}{x.username===name&&<em> YOU</em>}</span>
              <strong>{x.xp} <small>XP</small></strong>
            </div>)}
          </Panel>

          <Panel className="profile-card">
            <div className="profile-heading">
              <div className="avatar large">🌿</div>
              <div>
                <span className="tiny-muted">{earnedTitle.toUpperCase()}</span>
                {editing?<input value={name} onChange={e=>setName(e.target.value)} onBlur={()=>{const saved=name.trim()||'Explorer';setName(saved);localStorage.setItem('bb-name',saved);setEditing(false)}} autoFocus/>:<h3>{name}</h3>}
                <span className="pill blue">LEVEL {level}</span>
              </div>
              <button className="icon-button" aria-label="Edit profile" onClick={()=>setEditing(true)}><Settings size={15}/></button>
            </div>
            <div className="profile-xp">
              <div className="row-between"><b>Next bloom <span className="soft">Level {level+1}</span></b><small>{inLevel} / 200 XP</small></div>
              <Meter value={inLevel/2}/>
            </div>
            <div className="profile-stats">
              <div><strong>{completedCount}</strong><small>Exercises</small></div>
              <div><strong>{badgeCount}</strong><small>Badges</small></div>
              <div><strong>{learner.streak}</strong><small>Day streak</small></div>
            </div>
          </Panel>
        </div>

        <div className="dashboard-row">
          <Panel>
            <div className="section-title"><h3>Daily quests</h3></div>
            {[['Extend your streak',`${learner.streak} active days`,learner.streak>0],['Complete an exercise today',`${todayCompleted} done today`,todayCompleted>0],['Earn XP today',`${todayXp} XP earned`,todayXp>0]].map(([label,detail,done])=><div className="quest-row" key={String(label)}>
              <span className="quest-icon">✦</span>
              <div className="quest-copy"><b>{String(label)}</b><small>{String(detail)}</small></div>
              {done?<Check size={16} className="check-icon"/>:<Flame size={16} className="flame"/>}
            </div>)}
          </Panel>

          <Panel className="recommend">
            <div className="recommend-icon"><Lightbulb size={21}/></div>
            <div>
              <span className="pill green">BLOOM RECOMMENDS</span>
              <h3>{next}</h3>
              <p>{records.some(([,x])=>x.lastError)?'Review the exercise where you last hit an error.':'Continue with your next uncompleted exercise.'}</p>
              <a className="text-link" href="/course/python">Continue learning <ArrowRight size={14}/></a>
            </div>
          </Panel>

          <Panel>
            <div className="section-title"><h3>Statistics</h3><span className="pill purple">THIS WEEK</span></div>
            <div className="stats-grid">
              <div><strong>{questCount}</strong><small>Challenges</small></div>
              <div><strong>{learner.totalXp}</strong><small>XP earned</small></div>
              <div><strong>{success}%</strong><small>Success rate</small></div>
              <div><strong>{time}</strong><small>Time learning</small></div>
            </div>
          </Panel>
        </div>

        <div className="dashboard-row">
          <Panel className="course-list">
            <div className="section-title"><h3>My courses</h3></div>
            {langs.map(([icon,label,key,total,color])=>{
              const count=completed.filter(([id])=>id.startsWith(`${key}:`)).length;
              return <a href={`/course/${key==='cpp'?'cp+':key}`} className="course-row" key={key}>
                <span className="course-logo" style={{'--course-color':color} as React.CSSProperties}>{icon}</span>
                <div className="course-meta"><b>{label}</b><small>{count} / {total} exercises</small></div>
                <div className="course-progress"><Meter value={count/total*100}/></div>
                <ChevronRight size={15}/>
              </a>;
            })}
          </Panel>

          <Panel>
            <div className="section-title"><h3>Achievements</h3></div>
            <div className="badges">
              {BADGE_CATALOG.map(badge=>{
                const isEarned=earnedSet.has(badge.id);
                return <span className={isEarned?'':'badge-locked'} key={badge.id} title={badge.desc}>
                  {badge.icon}
                  <small>{badge.title}</small>
                </span>;
              })}
            </div>
          </Panel>
        </div>
      </div>
    </main>
  </>;
}

function Workspace(){
  const [code,setCode]=useState('word = input()\n# TODO: reverse the string\nprint(word)');
  const [output,setOutput]=useState('');
  const [level,setLevel]=useState(0);
  const [tab,setTab]=useState('Challenge');
  const [lang,setLang]=useState('Python');
  const [help,setHelp]=useState('');
  function run(){
    setOutput(code.includes('[::-1]')||code.includes('reverse')&&!code.includes('TODO')?'✓ Test 1 passed   hello → olleh\n✓ Test 2 passed   world → dlrow\n\nAll tests passed! +40 XP':'✕ Test 1 failed\n  Input:    hello\n  Expected: olleh\n  Received: hello\n\nYour output is unchanged. Try building the result from the last character back to the first.');
  }
  const hint=['Look at the first and last characters. What would happen if you swapped them?','Strings can be viewed from either end. How could you visit the characters in reverse order?','Try creating a reversed version of the string, then print that new value. In Python, slicing can choose a step of -1.','word = input()\nprint(word[::-1])'];
  return <div className="workspace">
    <header className="work-header">
      <Brand/>
      <span className="work-title">Workspace</span>
      <a href="/dashboard" className="work-dash">Dashboard</a>
      <div className="work-spacer"/>
      <select value={lang} onChange={e=>setLang(e.target.value)} aria-label="Select language"><option>Python</option><option>JavaScript</option><option>C++</option></select>
      <span className="streak-chip"><Flame size={14}/> 3D</span>
      <span className="xp-chip"><Sparkles size={14}/> 400 XP</span>
      <a href="/settings" className="icon-button"><Settings size={16}/></a>
    </header>
    <div className="mobile-tabs">{['Challenge','Code','Bloom'].map(x=><button className={tab===x?'selected':''} onClick={()=>setTab(x)} key={x}>{x}</button>)}</div>
    <div className="workspace-grid">
      <aside className={`work-panel challenge-panel ${tab!=='Challenge'?'mobile-hide':''}`}>
        <div className="panel-label"><BookOpen size={15}/> CHALLENGE SPEC <ChevronDown size={14}/></div>
        <div className="tags"><span className="pill green">EASY</span><span className="pill blue">STRINGS &amp; LOOPS</span></div>
        <h2>Reverse a String</h2>
        <div className="label">DESCRIPTION</div>
        <p>Write a program that reads a string from standard input and prints its reversed version to standard output.</p>
        <div className="label">EXAMPLES</div>
        <div className="example"><span>INPUT</span><code>hello</code><span>OUTPUT</span><code>olleh</code><small>Read the word from left to right, print it right to left.</small></div>
        <div className="example"><span>INPUT</span><code>world</code><span>OUTPUT</span><code>dlrow</code></div>
        <div className="label constraints-label">CONSTRAINTS</div>
        <ul className="constraints"><li>1 ≤ length of string ≤ 1,000</li><li>Input contains alphanumeric characters</li><li>Memory limit: 128 MB</li><li>Time limit: 5 seconds</li></ul>
        <a href="/course/python" className="back-link"><ArrowLeft size={14}/> Back to course</a>
      </aside>
      <section className={`work-panel editor-panel ${tab!=='Code'?'mobile-hide':''}`}>
        <div className="editor-toolbar"><span className="file-tab"><span className="python-dot">●</span> main.py <span>×</span></span><span className="editor-language">{lang} <ChevronDown size={13}/></span></div>
        <div className="editor-wrap"><div className="line-numbers">1<br/>2<br/>3<br/>4<br/>5<br/>6<br/>7</div><textarea spellCheck={false} aria-label="Code editor" value={code} onChange={e=>setCode(e.target.value)}/></div>
        <div className="action-bar"><button className="button button-quiet" onClick={()=>{setCode('word = input()\n# TODO: reverse the string\nprint(word)');setOutput('')}}><RotateCcw size={13}/> RESET</button><span className="runner"><i/> {lang==='Python'?'Pyodide · in browser':'Web Worker'}</span><span className="shortcut">Press <kbd>⌘</kbd> + <kbd>Enter</kbd></span><button className="button button-primary run-button" onClick={run}><Play size={14} fill="currentColor"/> RUN CODE</button></div>
        <div className="console"><div className="panel-label"><Terminal size={15}/> EXECUTION CONSOLE <span className="tiny-muted">TEST CASES</span></div>{output?<pre className={output.includes('passed!')?'success-output':'error-output'}>{output}</pre>:<div className="console-empty"><Terminal size={25}/><b>Your console is ready</b><span>Press RUN CODE or Cmd/Ctrl + Enter to test your solution.</span></div>}</div>
      </section>
      <aside className={`work-panel mentor-panel ${tab!=='Bloom'?'mobile-hide':''}`}>
        <div className="panel-label"><Sparkles size={15}/> AI MENTOR <ChevronDown size={14}/></div>
        <div className="mentor-welcome"><Mascot/><span className="pill pink">BLOOM, YOUR GUIDE</span><h3>Let's grow this solution.</h3><p>I adapt to how you code. When you get stuck, I'll offer a clue that helps you find your own way.</p></div>
        <div className="mentor-info"><Lightbulb size={15}/><span>Run your code to test your solution. I'm right here if a bug sprouts.</span></div>
        {output&&<button className="ask-error" onClick={()=>setHelp('Your program currently prints the original word. The missing piece is reversing its character order before printing.')}>Ask Bloom about this error <ArrowRight size={14}/></button>}
        {help&&<div className="chat-bubble"><Mascot small/><span>{help}</span><div className="feedback"><button aria-label="Helpful"><ThumbsUp size={14}/></button><button aria-label="Not helpful"><ThumbsDown size={14}/></button></div></div>}
        <div className="hint-area"><div className="label">HINT LADDER <span>(STEP {Math.min(level+1,4)})</span></div>{['Nudge','Clue','Breakdown','Full solution'].map((h,i)=><button className={`hint-row ${i<=level?'unlocked':''}`} key={h} disabled={i>level} onClick={()=>{setLevel(i+1);setHelp(hint[i])}}><span className="hint-num">{i+1}</span><span><b>{h}</b><small>{i===0?'A gentle nudge':i===1?'A concept clue':i===2?'Step by step': 'Complete answer'}</small></span><span className="hint-cost">{i===0?'FREE':`−${i*5} XP`}</span>{i>level&&<span className="lock">🔒</span>}</button>)}</div>
        <button className="ask-help" onClick={()=>setHelp(hint[Math.min(level,2)])}><CircleHelp size={16}/> Ask Bloom for a hint</button>
      </aside>
    </div>
    <footer className="workspace-footer"><span><Code2 size={14}/> Coding Practice · Challenge 1 of 5</span><div><button className="button button-quiet" onClick={()=>location.href='/course/python'}>Back</button><button className="button button-primary" onClick={run}>Submit answer <ArrowRight size={14}/></button></div></footer>
  </div>;
}

function Course(){return <><Topbar/><main className="page course-page"><div className="course-hero"><div><span className="pill blue">BEGINNER COURSE</span><h1>Python</h1><p>Learn programming fundamentals with a hands-on path made for you.</p></div><div className="hero-code">{'>>> '}<span>print</span>("hello, world")</div></div></main></>;}

function Insights(){return <><Topbar/><main className="page insights-page"><div className="page-heading"><div><span className="pill green">GARDEN REPORT</span><h1>Your learning is taking root.</h1><p>See what's clicking, and where a little extra water can help.</p></div><a className="button button-primary" href="/workspace/reverse-string">Practice now <ArrowRight size={15}/></a></div><div className="insight-grid"><Panel className="mastery-card"><div className="section-title"><h3>Concept mastery</h3><span className="tiny-muted">YOUR GARDEN BED</span></div>{concepts.map(c=><div className="mastery-row" key={c.name}><span>{c.name}</span><Meter value={c.score}/><b>{c.score}%</b></div>)}</Panel><Panel className="pace-card"><span className="pill purple">YOUR CURRENT PACE</span><h2>Steady growth</h2><p>You're finding a comfortable rhythm. Keep taking small steps and asking good questions.</p><div className="pace-art">🌼</div><span className="pill green">STEADY</span></Panel><Panel className="section-title"><h3>XP this week</h3><span className="tiny-muted">LAST 7 DAYS</span></Panel><div className="chart">{[32,58,43,79,55,94,68].map((n,i)=><div key={i}><span style={{height:`${n}%`}}/><small>{'MTWTFSS'[i]}</small></div>)}</div></div></main></>;}

function Auth({onboard=false}:{onboard?:boolean}){const [step,setStep]=useState(0);return <main className="auth-shell"><div className="auth-meadow"><div className="auth-sun"/><div className="auth-mountains"/><div className="auth-hills"/><div className="auth-flowers">✿　✿　✿　✿　✿　✿　✿</div></div><a className="auth-brand" href="/"><Brand/></a><a href="/" className="auth-theme">☼</a><section className="auth-card">{onboard?<><div className="gameboy"><div className="gb-brand">BYTE BLOOM</div><div className="gb-screen"><span className="pill blue">STEP {step+1} OF 3</span><h2>{['CREATE A USERNAME','SELECT CODING','YOUR LEARNING STYLE'][step]}</h2>{step===0?<input placeholder="User Name"/>:step===1?<div className="language-picks">{['Python','JavaScript','C++'].map(x=><button onClick={e=>e.currentTarget.classList.toggle('picked')} key={x}>{x}</button>)}</div>:<div className="language-picks">{['Step by step','Visual diagrams','Analogies','Code first'].map(x=><button onClick={e=>e.currentTarget.classList.toggle('picked')} key={x}>{x}</button>)}</div>}<button className="gb-continue" onClick={()=>step<2?setStep(step+1):location.href='/dashboard'}>CONTINUE</button></div><div className="gb-controls"><div className="dpad">✥</div><div className="gb-buttons"><b>B</b><b>A</b></div></div><div className="gb-footer">SELECT　 START</div></div><p className="auth-foot">A little seed. A whole new garden.</p></>:<><Brand/><h1>Create an account</h1><p className="auth-sub">Start growing your coding skills today.</p><label>Email</label><input type="email" placeholder="you@example.com"/><label>Password</label><input type="password" placeholder="At least 8 characters"/><button className="button button-primary auth-submit" onClick={()=>location.href='/onboarding/username'}>Continue <ArrowRight size={15}/></button><div className="or-line"><span/>OR<span/></div><button className="google-btn" onClick={()=>location.href='/onboarding/username'}><b>G</b> Continue with Google</button><small className="terms">By continuing, you agree to our <a>Terms</a> and <a>Privacy Policy</a>.</small><p className="auth-login">Have an account? <a href="/login">Log in</a></p></>}</section></main>}

function SettingsPage(){return <><Topbar active="Profile"/><main className="page settings-page"><div className="page-heading profile-page-heading"><div><span className="pill yellow">YOUR PROFILE</span><h1>Profile</h1><p>Manage your profile and learning preferences.</p></div><a className="button button-quiet" href="/dashboard"><ArrowLeft size={15}/> Back to dashboard</a></div><div className="settings-layout"><Panel><div className="settings-row"><div><b>Appearance</b><small>Choose the theme for your garden</small></div><select defaultValue="Dark"><option>System</option><option>Light</option><option>Dark</option></select></div><div className="settings-row"><div><b>Learning language</b><small>Change your active course</small></div><select defaultValue="Python"><option>Python</option><option>JavaScript</option><option>C++</option></select></div><div className="settings-row"><div><b>Experience level</b><small>Bloom uses this to tune your challenges</small></div><select defaultValue="Beginner"><option>Beginner</option><option>Some experience</option><option>Confident</option></select></div><div className="settings-row"><div><b>Explanation style</b><small>How Bloom should explain new ideas</small></div><select defaultValue="Step by step"><option>Step by step</option><option>Analogies</option><option>Visual diagrams</option><option>Code first</option></select></div><div className="settings-row"><div><b>Sound effects</b><small>A little chime when you pass a challenge</small></div><input type="checkbox"/></div><div className="profile-actions"><button className="button button-quiet" type="button" onClick={()=>{localStorage.removeItem('bb-name');localStorage.removeItem('bb-language');localStorage.removeItem('bb-style');location.href='/login'}}>Log out</button></div></Panel><Panel className="settings-bloom"><Mascot/><h3>Your garden is in good hands.</h3><p>Bloom uses your learning preferences to make each hint feel like it was planted just for you.</p><a href="/insights" className="text-link">See your Garden Report <ArrowRight size={14}/></a></Panel></div></main></>}


function Landing(){return <><Topbar active=""/><main className="page landing"><Garden/><div className="landing-below"><div><span className="pill green">MADE FOR YOUR PACE</span><h2>A coding mentor that grows with you.</h2><p>Practice in a real editor, get unstuck with thoughtful hints, and build a learning garden one challenge at a time.</p><a className="button button-primary" href="/signup">Get started <ArrowRight size={15}/></a></div><div className="landing-card"><Mascot/><div><b>Meet ByteKnight</b><p>Gentle nudges, clear explanations, and help exactly when you need it.</p><span className="pill pink">YOUR AI MENTOR</span></div></div></div></main></>}

export default function ByteBloom({path}:{path:string}){
  const p=path||'/';
  if(p.startsWith('/workspace'))return <WorkspaceView challengeId={p.split('/')[2]||'reverse-string'}/>;
  if(p.startsWith('/lesson')){
    const [, ,rawLanguage,exerciseId]=p.split('/');
    const language=rawLanguage==='javascript'||rawLanguage==='cpp'?rawLanguage:'python';
    return <LessonPage language={language} exerciseId={exerciseId||''}/>;
  }
  if(p.startsWith('/course')){
    const raw=p.split('/')[2]||'python';
    const language=raw==='javascript'||raw==='cpp'||raw==='cp+'?raw==='cp+'?'cpp':raw:'python';
    return <CoursePage language={language}/>;
  }
  if(p==='/practice'||p==='/interview')return <ChallengeList interview={p==='/interview'}/>;
  if(p==='/dashboard'||p==='/insights'||p==='/settings'||p==='/profile')return p==='/insights'?<Insights/>:p==='/settings'||p==='/profile'?<SettingsPage/>:<Dashboard/>;
  if(p==='/signup')return <AuthFlow mode="signup"/>;
  if(p==='/login')return <AuthFlow mode="login"/>;
  if(p.startsWith('/onboarding'))return <AuthFlow mode="onboarding"/>;
  return <Landing/>;
}
