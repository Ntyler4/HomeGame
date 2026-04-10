import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';
const db = (SUPABASE_URL !== 'YOUR_SUPABASE_URL') ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

type Tab = 'league' | 'feed' | 'profile';
type LSV = 'home'|'joinCreate'|'publicLeagues'|'leagueDetail'|'newSession'|'liveSession'|'commSettings'|'transferComm'|'handRankings'|'playerProfile'|'sessionDetail'|'seasonRecap';
type PSV = 'self'|'friends'|'friendProfile';

const HAND_RANKINGS = [
  { rank:1,  name:"Royal Flush",     desc:"A K Q J 10 of the same suit",  example:"A♠ K♠ Q♠ J♠ 10♠", color:"#C9A84C" },
  { rank:2,  name:"Straight Flush",  desc:"Five consecutive same suit",    example:"9♥ 8♥ 7♥ 6♥ 5♥",   color:"#E8C56A" },
  { rank:3,  name:"Four of a Kind",  desc:"Four cards of the same rank",   example:"K♠ K♥ K♦ K♣ 3♠",   color:"#4CAF8C" },
  { rank:4,  name:"Full House",      desc:"Three of a kind + a pair",      example:"J♠ J♥ J♦ 9♣ 9♥",   color:"#5577CC" },
  { rank:5,  name:"Flush",           desc:"Five cards of same suit",       example:"A♦ J♦ 8♦ 6♦ 2♦",   color:"#CC55AA" },
  { rank:6,  name:"Straight",        desc:"Five consecutive any suit",     example:"10♠ 9♥ 8♦ 7♣ 6♠",  color:"#77CCAA" },
  { rank:7,  name:"Three of a Kind", desc:"Three cards of the same rank",  example:"7♠ 7♥ 7♦ K♣ 2♠",   color:"#CC7744" },
  { rank:8,  name:"Two Pair",        desc:"Two different pairs",           example:"A♠ A♦ 8♥ 8♣ Q♠",   color:"#888"    },
  { rank:9,  name:"One Pair",        desc:"Two cards of the same rank",    example:"K♥ K♣ A♠ J♦ 4♥",   color:"#666"    },
  { rank:10, name:"High Card",       desc:"Highest card wins",             example:"A♠ J♥ 8♦ 5♣ 2♠",   color:"#444"    },
];
const MAX_PLAYER_OPTIONS = [5,8,12,20,50];
const MAX_PINNED = 3;

// ─── AVATAR CACHE ──────────────────────────────────────
const avatarCache: Record<string,string|null> = {};
export function bustAvatarCache(name:string, url:string|null){ avatarCache[name.toLowerCase()]=url; }

// ─── NOTIFICATIONS ─────────────────────────────────────
async function requestNotifPermission(){ if(!('Notification' in window))return false; const p=await Notification.requestPermission(); return p==='granted'; }
function sendNotif(title:string,body:string){ if('Notification' in window&&Notification.permission==='granted')new Notification(title,{body,icon:'/favicon.ico'}); }

// Keep track of active realtime channels so we can clean them up
const realtimeChannels: any[] = [];
function setupRealtime(leagues:any[], displayName:string){
  if(!db)return;
  // Tear down old channels first
  realtimeChannels.forEach(ch=>db!.removeChannel(ch));
  realtimeChannels.length=0;

  // Live session alerts per league
  leagues.forEach(lg=>{
    const ch=db!.channel(`live-${lg.id}`)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'sessions',filter:`league_id=eq.${lg.id}`},(payload:any)=>{
        if(payload.new?.is_live) sendNotif('🃏 Game is Live!',`A session just started in ${lg.name}`);
      }).subscribe();
    realtimeChannels.push(ch);
  });

  // Friend request alerts
  const fc=db!.channel(`friends-${displayName.toLowerCase()}`)
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'friends',filter:`recipient_name=eq.${displayName}`},(payload:any)=>{
      sendNotif('New Friend Request',`${payload.new?.requester_name} wants to be friends!`);
    }).subscribe();
  realtimeChannels.push(fc);
}

function fmtSeconds(s:number){ if(!s||s<=0)return"—"; const h=Math.floor(s/3600),m=Math.floor((s%3600)/60); if(h>0)return`${h}h ${m}m`; return`${m}m`; }

// ─── SHARED UI ─────────────────────────────────────────
function Avatar({name,url,size=40}:{name:string;url?:string|null;size?:number}){
  const [src,setSrc]=useState<string|null>(url||null);
  useEffect(()=>{
    if(url!==undefined){setSrc(url);if(name)avatarCache[name.toLowerCase()]=url;return;}
    if(!name)return;
    const key=name.toLowerCase();
    if(key in avatarCache){setSrc(avatarCache[key]);return;}
    if(!db)return;
    db.from("profiles").select("avatar_url").ilike("display_name",name).limit(1).then(({data})=>{const u=data?.[0]?.avatar_url||null;avatarCache[key]=u;setSrc(u);});
  },[name,url]);
  const colors=["#C9A84C","#4CAF8C","#E05555","#5577CC","#CC55AA"];
  const bg=colors[(name||"?").charCodeAt(0)%colors.length];
  if(src)return<img src={src} style={{width:size,height:size,borderRadius:"50%",objectFit:"cover",flexShrink:0,border:"2px solid rgba(201,168,76,0.3)"}}/>;
  return<div style={{width:size,height:size,borderRadius:"50%",background:bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Playfair Display',serif",fontWeight:700,fontSize:size*0.4,color:"#0D0D0D",flexShrink:0}}>{(name||"?")[0].toUpperCase()}</div>;
}
function Card({children,style={}}:any){return<div style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(201,168,76,0.2)",borderRadius:16,padding:20,...style}}>{children}</div>;}
function StatBox({label,value,accent="#C9A84C"}:any){return<div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:12,padding:"10px 10px",flex:1,minWidth:50}}><div style={{color:"#666",fontSize:9,fontFamily:"'Space Mono',monospace",letterSpacing:1.5,textTransform:"uppercase",marginBottom:3}}>{label}</div><div style={{color:accent,fontSize:16,fontWeight:700,fontFamily:"'Playfair Display',serif"}}>{value}</div></div>;}
function Spinner({size=24}:any){
  return<><style>{`@keyframes hg_spin{to{transform:rotate(360deg);}}`}</style><div style={{width:size,height:size,border:`2px solid rgba(201,168,76,0.15)`,borderTopColor:"#C9A84C",borderRadius:"50%",animation:"hg_spin 0.7s linear infinite",flexShrink:0}}/></>;
}
function Toggle({value,onChange,label,sub}:any){return<div onClick={()=>onChange(!value)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 14px",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:12,cursor:"pointer",marginBottom:10}}><div style={{flex:1,paddingRight:12}}><div style={{color:"#fff",fontSize:13}}>{label}</div>{sub&&<div style={{color:"#555",fontSize:11,marginTop:2}}>{sub}</div>}</div><div style={{width:44,height:24,borderRadius:12,background:value?"#5577CC":"rgba(255,255,255,0.1)",position:"relative",transition:"background 0.2s",flexShrink:0}}><div style={{width:20,height:20,borderRadius:"50%",background:"#fff",position:"absolute",top:2,left:value?22:2,transition:"left 0.2s"}}/></div></div>;}
function Badge({text,color="#C9A84C"}:any){return<span style={{background:`${color}22`,color,border:`1px solid ${color}44`,borderRadius:20,padding:"2px 10px",fontSize:11,fontFamily:"'Space Mono',monospace",letterSpacing:1}}>{text}</span>;}
const inp:any={width:"100%",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(201,168,76,0.25)",borderRadius:10,padding:"11px 14px",color:"#fff",fontSize:14,fontFamily:"'Space Mono',monospace",outline:"none",boxSizing:"border-box"};
function BackButton({onBack}:any){return<button onClick={onBack} style={{background:"none",border:"none",color:"#555",fontSize:22,cursor:"pointer",marginBottom:14,display:"block"}}>←</button>;}
function SectionTitle({text}:any){return<div style={{fontFamily:"'Playfair Display',serif",fontSize:22,color:"#fff",marginBottom:16}}>{text}</div>;}
function LoadingScreen(){
  return(
    <div style={{minHeight:"100vh",background:"#0A0A0A",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <style>{`@keyframes hg_spin{to{transform:rotate(360deg);}}`}</style>
      <div style={{textAlign:"center"}}>
        <div style={{position:"relative",width:60,height:60,margin:"0 auto 16px"}}>
          <div style={{position:"absolute",inset:0,border:"2px solid rgba(201,168,76,0.15)",borderTopColor:"#C9A84C",borderRadius:"50%",animation:"hg_spin 0.7s linear infinite"}}/>
          <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,color:"#C9A84C"}}>♠</div>
        </div>
        <div style={{color:"#444",fontFamily:"'Space Mono',monospace",fontSize:10,letterSpacing:2}}>LOADING</div>
      </div>
    </div>
  );
}

// ─── AUTH ──────────────────────────────────────────────
function SetupView(){return<div style={{minHeight:"100vh",background:"#0A0A0A",display:"flex",alignItems:"center",justifyContent:"center",padding:24}}><Card style={{maxWidth:420,width:"100%"}}><div style={{color:"#E05555",fontFamily:"'Space Mono',monospace",fontSize:11,letterSpacing:1.5,marginBottom:12}}>⚠ DATABASE NOT CONNECTED</div><div style={{color:"#aaa",fontSize:13,lineHeight:1.8}}>Add your Supabase credentials to App.tsx.</div></Card></div>;}

function AuthView(){
  const [tab,setTab]=useState<'login'|'signup'|'reset'>('login');
  const [email,setEmail]=useState("");const [pw,setPw]=useState("");
  const [loading,setLoading]=useState(false);const [msg,setMsg]=useState("");const [err,setErr]=useState("");
  const handle=async()=>{
    if(!db)return;setLoading(true);setMsg("");setErr("");
    if(tab==='login'){const{error}=await db.auth.signInWithPassword({email,password:pw});if(error)setErr(error.message);}
    else if(tab==='signup'){if(pw.length<6){setErr("Password must be 6+ characters.");setLoading(false);return;}const{error}=await db.auth.signUp({email,password:pw});if(error)setErr(error.message);else setMsg("Account created! Sign in now.");}
    else{const{error}=await db.auth.resetPasswordForEmail(email,{redirectTo:window.location.origin});if(error)setErr(error.message);else setMsg("Reset email sent!");}
    setLoading(false);
  };
  return(
    <div style={{minHeight:"100vh",background:"#0A0A0A",display:"flex",alignItems:"center",justifyContent:"center",padding:24,position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",inset:0,background:"radial-gradient(ellipse 80% 60% at 50% 50%, rgba(20,60,30,0.4) 0%, transparent 70%)",pointerEvents:"none"}}/>
      <div style={{width:"100%",maxWidth:400,position:"relative",zIndex:1}}>
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{display:"flex",justifyContent:"center",gap:8,marginBottom:10}}>{["♠","♥","♦","♣"].map((s,i)=><span key={i} style={{fontSize:28,color:i%2===0?"#C9A84C":"#E05555"}}>{s}</span>)}</div>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:42,fontWeight:900,color:"#C9A84C",letterSpacing:-1}}>Home Game</div>
          <div style={{color:"#555",fontSize:11,fontFamily:"'Space Mono',monospace",letterSpacing:2,marginTop:6}}>YOUR LEAGUE. YOUR RULES.</div>
        </div>
        <Card style={{padding:0,overflow:"hidden"}}>
          {tab!=='reset'?<div style={{display:"flex",borderBottom:"1px solid rgba(201,168,76,0.15)"}}>{(['login','signup'] as const).map(t=><button key={t} onClick={()=>{setTab(t);setErr("");setMsg("");}} style={{flex:1,padding:"14px 0",background:"none",border:"none",color:tab===t?"#C9A84C":"#555",fontFamily:"'Space Mono',monospace",fontSize:12,letterSpacing:1.5,textTransform:"uppercase",cursor:"pointer",borderBottom:tab===t?"2px solid #C9A84C":"2px solid transparent"}}>{t==='login'?'Sign In':'Create Account'}</button>)}</div>:<div style={{borderBottom:"1px solid rgba(201,168,76,0.15)",padding:"12px 20px",display:"flex",alignItems:"center",gap:10}}><button onClick={()=>{setTab('login');setErr("");setMsg("");}} style={{background:"none",border:"none",color:"#555",fontSize:18,cursor:"pointer"}}>←</button><span style={{color:"#888",fontFamily:"'Space Mono',monospace",fontSize:12}}>RESET PASSWORD</span></div>}
          <div style={{padding:24}}>
            <div style={{marginBottom:12}}><label style={{color:"#888",fontSize:10,fontFamily:"'Space Mono',monospace",letterSpacing:1.5,display:"block",marginBottom:6}}>EMAIL</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@email.com" style={inp}/></div>
            {tab!=='reset'&&<div style={{marginBottom:8}}><label style={{color:"#888",fontSize:10,fontFamily:"'Space Mono',monospace",letterSpacing:1.5,display:"block",marginBottom:6}}>PASSWORD</label><input type="password" value={pw} onChange={e=>setPw(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handle()} placeholder="••••••••" style={inp}/></div>}
            {tab==='login'&&<div style={{textAlign:"right",marginBottom:16}}><button onClick={()=>{setTab('reset');setErr("");setMsg("");}} style={{background:"none",border:"none",color:"#555",fontFamily:"'Space Mono',monospace",fontSize:11,cursor:"pointer"}}>Forgot password?</button></div>}
            {tab!=='login'&&<div style={{marginBottom:16}}/>}
            {err&&<div style={{background:"rgba(224,85,85,0.1)",border:"1px solid rgba(224,85,85,0.3)",borderRadius:8,padding:"9px 12px",color:"#E05555",fontFamily:"'Space Mono',monospace",fontSize:11,marginBottom:12,lineHeight:1.6}}>{err}</div>}
            {msg&&<div style={{background:"rgba(76,175,140,0.1)",border:"1px solid rgba(76,175,140,0.3)",borderRadius:8,padding:"9px 12px",color:"#4CAF8C",fontFamily:"'Space Mono',monospace",fontSize:11,marginBottom:12,lineHeight:1.6}}>{msg}</div>}
            <button onClick={handle} disabled={loading||!email||(tab!=='reset'&&!pw)} style={{width:"100%",padding:"13px 0",background:!loading&&email&&(tab==='reset'||pw)?"linear-gradient(135deg,#C9A84C,#E8C56A)":"rgba(255,255,255,0.08)",border:"none",borderRadius:12,color:!loading&&email&&(tab==='reset'||pw)?"#0A0A0A":"#444",fontFamily:"'Space Mono',monospace",fontWeight:700,fontSize:13,letterSpacing:2,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:10}}>{loading?<Spinner size={16}/>:tab==='login'?"SIGN IN →":tab==='signup'?"CREATE ACCOUNT →":"SEND RESET →"}</button>
          </div>
        </Card>
      </div>
    </div>
  );
}

function SetupProfileView({user,onDone}:any){
  const [name,setName]=useState("");const [loading,setLoading]=useState(false);const [err,setErr]=useState("");
  const save=async()=>{
    if(!db||!name.trim())return;
    setLoading(true);
    try{
      const{error}=await db.from("profiles").upsert({id:user.id,display_name:name.trim(),email:user.email,opt_in_global:false,global_total_profit:0,global_sessions:0,global_wins:0,global_time_seconds:0,chicken_dinners:0});
      if(error){setErr(error.message);return;}
      onDone({id:user.id,display_name:name.trim(),email:user.email,avatar_url:null,opt_in_global:false});
    }catch(e:any){
      setErr(e.message||"Something went wrong. Check your connection.");
    }finally{
      setLoading(false);
    }
  };
  return(
    <div style={{minHeight:"100vh",background:"#0A0A0A",display:"flex",alignItems:"center",justifyContent:"center",padding:24,position:"relative"}}>
      <div style={{position:"absolute",inset:0,background:"radial-gradient(ellipse 80% 60% at 50% 50%, rgba(20,60,30,0.4) 0%, transparent 70%)",pointerEvents:"none"}}/>
      <div style={{width:"100%",maxWidth:400,position:"relative",zIndex:1}}>
        <div style={{textAlign:"center",marginBottom:28}}><div style={{fontSize:38,marginBottom:10,color:"#C9A84C"}}>👤</div><div style={{fontFamily:"'Playfair Display',serif",fontSize:26,color:"#fff"}}>One more thing</div><div style={{color:"#555",fontSize:11,fontFamily:"'Space Mono',monospace",letterSpacing:1.5,marginTop:6}}>WHAT DO THEY CALL YOU AT THE TABLE?</div></div>
        <Card><div style={{marginBottom:14}}><input value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&save()} placeholder="e.g. Big Stack Tyler" autoFocus style={{...inp,fontSize:18,fontFamily:"'Playfair Display',serif",textAlign:"center" as const}}/></div>{err&&<div style={{color:"#E05555",fontSize:11,marginBottom:10}}>{err}</div>}<button onClick={save} disabled={loading||!name.trim()} style={{width:"100%",padding:"13px 0",background:name.trim()&&!loading?"linear-gradient(135deg,#C9A84C,#E8C56A)":"rgba(255,255,255,0.08)",border:"none",borderRadius:12,color:name.trim()&&!loading?"#0A0A0A":"#444",fontFamily:"'Space Mono',monospace",fontWeight:700,fontSize:13,letterSpacing:2,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:10}}>{loading?<Spinner size={16}/>:"LET'S PLAY →"}</button></Card>
      </div>
    </div>
  );
}

// ─── LEAGUE HOME ───────────────────────────────────────
function LeagueHomeView({profile,myLeagues,loading,pinnedIds,onSelectLeague,onJoinCreate,onPublicLeagues,onTogglePin}:any){
  const pinned=myLeagues.filter((lg:any)=>pinnedIds.includes(lg.id));
  const rest=myLeagues.filter((lg:any)=>!pinnedIds.includes(lg.id));
  const ordered=[...pinned,...rest];
  return(
    <div style={{padding:"20px 16px",maxWidth:500,margin:"0 auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <div><div style={{display:"flex",gap:5,marginBottom:3}}>{["♠","♥"].map((s,i)=><span key={i} style={{color:i===0?"#C9A84C":"#E05555",fontSize:15}}>{s}</span>)}</div><div style={{fontFamily:"'Playfair Display',serif",fontSize:24,color:"#C9A84C"}}>Home Game</div></div>
        <div style={{color:"#555",fontSize:11,fontFamily:"'Space Mono',monospace",textAlign:"right"}}><div style={{color:"#fff",fontSize:14}}>{profile.display_name}</div>{myLeagues.length} league{myLeagues.length!==1?"s":""}</div>
      </div>
      <div style={{height:1,background:"rgba(201,168,76,0.1)",marginBottom:16}}/>
      {loading&&<div style={{display:"flex",justifyContent:"center",padding:36}}><Spinner size={30}/></div>}
      {!loading&&myLeagues.length===0&&<Card style={{marginBottom:14,textAlign:"center"}}><div style={{padding:"18px 0"}}><div style={{fontSize:28,marginBottom:8}}>♠</div><div style={{color:"#555",fontFamily:"'Space Mono',monospace",fontSize:12}}>No leagues yet — join or create one below</div></div></Card>}
      {!loading&&ordered.map((lg:any)=>{
        const isComm=lg.commissioner_id===lg._myUserId;const isPinned=pinnedIds.includes(lg.id);const canPin=isPinned||pinnedIds.length<MAX_PINNED;
        const sessionsLeft=lg.season_length>0?lg.season_length-(lg._sessionCount||0):null;
        return<div key={lg.id} style={{background:"rgba(255,255,255,0.03)",border:`1px solid ${isPinned?"rgba(201,168,76,0.3)":"rgba(201,168,76,0.12)"}`,borderRadius:14,padding:"13px 14px",marginBottom:9,display:"flex",alignItems:"center",gap:11}}>
          <div onClick={()=>onSelectLeague(lg)} style={{width:42,height:42,borderRadius:11,background:"rgba(201,168,76,0.12)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0,cursor:"pointer"}}>{isPinned?"📌":lg.is_public?"🌍":"♠"}</div>
          <div onClick={()=>onSelectLeague(lg)} style={{flex:1,minWidth:0,cursor:"pointer"}}>
            <div style={{color:"#fff",fontFamily:"'Playfair Display',serif",fontSize:16,display:"flex",alignItems:"center",gap:5}}>{lg.name} {isComm&&<span style={{fontSize:12}}>👑</span>} {sessionsLeft!==null&&sessionsLeft<=0&&<span style={{fontSize:11,color:"#E05555",fontFamily:"'Space Mono',monospace"}}>DONE</span>}</div>
            {lg.description&&<div style={{color:"#666",fontSize:11,marginTop:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{lg.description}</div>}
            <div style={{color:"#555",fontSize:10,fontFamily:"'Space Mono',monospace",marginTop:2}}>{lg.season}{lg.location_name?` · 📍${lg.location_name}`:""} · <span style={{color:"#C9A84C",letterSpacing:2}}>{lg.code}</span></div>
          </div>
          <button onClick={()=>canPin&&onTogglePin(lg.id)} style={{background:"none",border:"none",fontSize:16,cursor:canPin?"pointer":"not-allowed",opacity:canPin?1:0.3,padding:4,flexShrink:0}} title={isPinned?"Unpin":"Pin"}>{isPinned?"📌":"📍"}</button>
        </div>;
      })}
      {!loading&&ordered.length>0&&pinnedIds.length<MAX_PINNED&&<div style={{color:"#333",fontSize:10,fontFamily:"'Space Mono',monospace",textAlign:"center",marginBottom:12}}>📍 Tap pin icon to pin up to {MAX_PINNED} leagues</div>}
      <button onClick={onJoinCreate} style={{width:"100%",padding:"12px 0",marginTop:4,background:"linear-gradient(135deg,#C9A84C,#E8C56A)",border:"none",borderRadius:12,color:"#0A0A0A",fontFamily:"'Space Mono',monospace",fontWeight:700,fontSize:13,letterSpacing:2,cursor:"pointer",marginBottom:9}}>+ JOIN OR CREATE LEAGUE</button>
      <button onClick={onPublicLeagues} style={{width:"100%",padding:"11px 0",background:"rgba(85,119,204,0.1)",border:"1px solid rgba(85,119,204,0.3)",borderRadius:12,color:"#5577CC",fontFamily:"'Space Mono',monospace",fontSize:11,letterSpacing:1.5,cursor:"pointer"}}>🌍 BROWSE PUBLIC LEAGUES</button>
    </div>
  );
}

// ─── JOIN / CREATE ──────────────────────────────────────
function JoinCreateView({profile,loading,onBack,onEnter,prefillCode=""}:any){
  const [tab,setTab]=useState(prefillCode?"join":"join");
  const [code,setCode]=useState(prefillCode);const [leagueName,setLeagueName]=useState("");const [description,setDescription]=useState("");
  const [buyIn,setBuyIn]=useState("20");const [season,setSeason]=useState("Season 1");const [seasonLength,setSeasonLength]=useState("0");
  const [isPublic,setIsPublic]=useState(false);const [locationName,setLocationName]=useState("");const [maxPlayers,setMaxPlayers]=useState(12);
  const [detecting,setDetecting]=useState(false);
  const canSubmit=tab==="join"?code.trim():leagueName.trim();
  const detectLocation=()=>{setDetecting(true);navigator.geolocation?.getCurrentPosition(async(pos)=>{try{const r=await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`);const d=await r.json();setLocationName(d.address?.city||d.address?.town||d.address?.state||"");}catch(e){}setDetecting(false);},()=>setDetecting(false));};
  return(
    <div style={{padding:"20px 16px",maxWidth:500,margin:"0 auto"}}>
      <BackButton onBack={onBack}/><SectionTitle text="Add a League"/>
      <Card style={{padding:0,overflow:"hidden"}}>
        <div style={{display:"flex",borderBottom:"1px solid rgba(201,168,76,0.15)"}}>{["join","create"].map(t=><button key={t} onClick={()=>setTab(t)} style={{flex:1,padding:"13px 0",background:"none",border:"none",color:tab===t?"#C9A84C":"#555",fontFamily:"'Space Mono',monospace",fontSize:12,letterSpacing:1.5,textTransform:"uppercase",cursor:"pointer",borderBottom:tab===t?"2px solid #C9A84C":"2px solid transparent"}}>{t==="join"?"Join":"Create"}</button>)}</div>
        <div style={{padding:20}}>
          {tab==="join"?<div style={{marginBottom:14}}>
            <label style={{color:"#888",fontSize:10,fontFamily:"'Space Mono',monospace",letterSpacing:1.5,display:"block",marginBottom:6}}>INVITE CODE</label>
            <input value={code} onChange={e=>setCode(e.target.value.toUpperCase())} placeholder="e.g. FNP2026" style={{...inp,color:"#C9A84C",fontSize:20,letterSpacing:4,textAlign:"center" as const}}/>
          </div>:(
            <>
              {([["LEAGUE NAME",leagueName,setLeagueName,"Friday Night Poker"],["DESCRIPTION",description,setDescription,"Weekly home game"],["SEASON NAME",season,setSeason,"Season 1"]] as any[]).map(([label,val,setter,ph])=><div key={label} style={{marginBottom:10}}><label style={{color:"#888",fontSize:10,fontFamily:"'Space Mono',monospace",letterSpacing:1.5,display:"block",marginBottom:5}}>{label}</label><input value={val} onChange={(e:any)=>setter(e.target.value)} placeholder={ph} style={inp}/></div>)}
              <div style={{display:"flex",gap:10,marginBottom:10}}><div style={{flex:1}}><label style={{color:"#888",fontSize:10,fontFamily:"'Space Mono',monospace",letterSpacing:1.5,display:"block",marginBottom:5}}>BUY-IN ($)</label><input type="number" value={buyIn} onChange={e=>setBuyIn(e.target.value)} style={inp}/></div><div style={{flex:1}}><label style={{color:"#888",fontSize:10,fontFamily:"'Space Mono',monospace",letterSpacing:1.5,display:"block",marginBottom:5}}>SEASON LENGTH</label><input type="number" value={seasonLength} onChange={e=>setSeasonLength(e.target.value)} placeholder="0=unlimited" style={inp}/></div></div>
              <div style={{marginBottom:10}}><label style={{color:"#888",fontSize:10,fontFamily:"'Space Mono',monospace",letterSpacing:1.5,display:"block",marginBottom:5}}>MAX PLAYERS</label><div style={{display:"flex",gap:5}}>{MAX_PLAYER_OPTIONS.map(n=><button key={n} onClick={()=>setMaxPlayers(n)} style={{flex:1,padding:"8px 0",borderRadius:9,background:maxPlayers===n?"rgba(201,168,76,0.2)":"rgba(255,255,255,0.04)",border:`1px solid ${maxPlayers===n?"rgba(201,168,76,0.4)":"rgba(255,255,255,0.08)"}`,color:maxPlayers===n?"#C9A84C":"#555",fontFamily:"'Space Mono',monospace",fontSize:11,cursor:"pointer"}}>{n}</button>)}</div></div>
              <div style={{marginBottom:10}}><label style={{color:"#888",fontSize:10,fontFamily:"'Space Mono',monospace",letterSpacing:1.5,display:"block",marginBottom:5}}>LOCATION</label><div style={{display:"flex",gap:8}}><input value={locationName} onChange={e=>setLocationName(e.target.value)} placeholder="e.g. San Francisco, CA" style={{...inp,flex:1}}/><button onClick={detectLocation} style={{padding:"0 13px",background:"rgba(201,168,76,0.1)",border:"1px solid rgba(201,168,76,0.2)",borderRadius:10,color:"#C9A84C",cursor:"pointer",flexShrink:0}}>{detecting?<Spinner size={13}/>:"📍"}</button></div></div>
              <Toggle value={isPublic} onChange={setIsPublic} label="Public League 🌍" sub="Anyone can find & join without a code"/>
            </>
          )}
          <button onClick={()=>canSubmit&&!loading&&onEnter({tab,code,leagueName,description,buyIn:Number(buyIn),season,seasonLength:Number(seasonLength),isPublic,locationName,maxPlayers})} style={{width:"100%",padding:"12px 0",marginTop:6,background:canSubmit&&!loading?"linear-gradient(135deg,#C9A84C,#E8C56A)":"rgba(255,255,255,0.08)",border:"none",borderRadius:11,color:canSubmit&&!loading?"#0A0A0A":"#444",fontFamily:"'Space Mono',monospace",fontWeight:700,fontSize:13,letterSpacing:2,cursor:canSubmit&&!loading?"pointer":"not-allowed",display:"flex",alignItems:"center",justifyContent:"center",gap:10}}>{loading?<Spinner size={16}/>:tab==="join"?"Join League →":"Create League →"}</button>
        </div>
      </Card>
    </div>
  );
}

// ─── PUBLIC LEAGUES ────────────────────────────────────
function PublicLeaguesView({onBack,onJoin}:any){
  const [leagues,setLeagues]=useState<any[]>([]);const [loading,setLoading]=useState(true);
  const [userLoc,setUserLoc]=useState("");const [detecting,setDetecting]=useState(false);const [filter,setFilter]=useState("");
  useEffect(()=>{if(!db)return;db.from("leagues").select("*").eq("is_public",true).order("created_at",{ascending:false}).then(({data})=>{setLeagues(data||[]);setLoading(false);});},[]);
  const detectLocation=()=>{setDetecting(true);navigator.geolocation?.getCurrentPosition(async(pos)=>{try{const r=await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`);const d=await r.json();setUserLoc(d.address?.city||d.address?.state||"");}catch(e){}setDetecting(false);},()=>setDetecting(false));};
  const filtered=leagues.filter(lg=>!filter||(lg.name?.toLowerCase().includes(filter.toLowerCase())||lg.location_name?.toLowerCase().includes(filter.toLowerCase())));
  const sorted=userLoc?[...filtered].sort((a,b)=>{const am=a.location_name?.toLowerCase().includes(userLoc.toLowerCase())?0:1;const bm=b.location_name?.toLowerCase().includes(userLoc.toLowerCase())?0:1;return am-bm;}):filtered;
  return(
    <div style={{padding:"20px 16px",maxWidth:500,margin:"0 auto"}}>
      <BackButton onBack={onBack}/><SectionTitle text="Public Leagues"/>
      <div style={{display:"flex",gap:8,marginBottom:10}}><input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Search name or city..." style={{...inp,flex:1,padding:"9px 12px",fontSize:13}}/><button onClick={detectLocation} style={{padding:"0 13px",background:"rgba(85,119,204,0.1)",border:"1px solid rgba(85,119,204,0.3)",borderRadius:10,color:"#5577CC",cursor:"pointer",flexShrink:0}}>{detecting?<Spinner size={13}/>:"📍"}</button></div>
      {userLoc&&<div style={{color:"#5577CC",fontSize:11,fontFamily:"'Space Mono',monospace",marginBottom:10}}>📍 Near {userLoc} first</div>}
      {loading&&<div style={{display:"flex",justifyContent:"center",padding:36}}><Spinner/></div>}
      {!loading&&sorted.length===0&&<Card><div style={{textAlign:"center",padding:"22px 0",color:"#555",fontFamily:"'Space Mono',monospace",fontSize:12}}>No public leagues found.</div></Card>}
      {sorted.map((lg:any)=><Card key={lg.id} style={{marginBottom:11}}><div style={{display:"flex",gap:11,marginBottom:11}}><div style={{width:44,height:44,borderRadius:11,background:"rgba(85,119,204,0.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>♠</div><div style={{flex:1}}><div style={{color:"#fff",fontFamily:"'Playfair Display',serif",fontSize:16}}>{lg.name}</div>{lg.description&&<div style={{color:"#666",fontSize:11,marginTop:2}}>{lg.description}</div>}<div style={{color:"#555",fontSize:10,fontFamily:"'Space Mono',monospace",marginTop:3}}>{lg.season} · ${lg.buy_in}{lg.location_name?<span style={{color:"#5577CC"}}> · 📍{lg.location_name}</span>:null} · {lg.max_players||12} max</div></div></div><button onClick={()=>onJoin(lg)} style={{width:"100%",padding:"10px 0",background:"rgba(85,119,204,0.15)",border:"1px solid rgba(85,119,204,0.3)",borderRadius:9,color:"#5577CC",fontFamily:"'Space Mono',monospace",fontSize:11,letterSpacing:1.5,cursor:"pointer"}}>JOIN LEAGUE →</button></Card>)}
    </div>
  );
}

// ─── SEASON RECAP ──────────────────────────────────────
function SeasonRecapView({league,players,sessions,onBack}:any){
  const sorted=[...players].sort((a:any,b:any)=>b.total_profit-a.total_profit);
  const totalPot=sessions.reduce((a:number,s:any)=>a+(s.pot||0),0);
  const chickenWins:Record<string,number>={};
  sessions.forEach((s:any)=>{if(s.chicken_dinner_name){chickenWins[s.chicken_dinner_name]=(chickenWins[s.chicken_dinner_name]||0)+1;}});
  const topChicken=Object.entries(chickenWins).sort((a:any,b:any)=>b[1]-a[1])[0];
  const mostSessions=[...players].sort((a:any,b:any)=>b.session_count-a.session_count)[0];
  return(
    <div style={{padding:"20px 16px",maxWidth:500,margin:"0 auto"}}>
      <BackButton onBack={onBack}/>
      <div style={{textAlign:"center",marginBottom:24}}>
        <div style={{fontSize:40,marginBottom:8}}>🏁</div>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:26,color:"#C9A84C"}}>Season Complete!</div>
        <div style={{color:"#555",fontSize:12,fontFamily:"'Space Mono',monospace",marginTop:4}}>{league.name} · {league.season}</div>
      </div>
      <div style={{display:"flex",gap:8,marginBottom:14}}>
        <StatBox label="Sessions" value={sessions.length}/>
        <StatBox label="Total Pot" value={`$${totalPot}`} accent="#4CAF8C"/>
        <StatBox label="Players" value={players.length}/>
      </div>
      {sorted.length>0&&<Card style={{marginBottom:12}}>
        <div style={{color:"#888",fontSize:10,fontFamily:"'Space Mono',monospace",letterSpacing:2,marginBottom:14}}>FINAL STANDINGS</div>
        {sorted.map((p:any,i:number)=>{const medals=["🥇","🥈","🥉"];const isTop3=i<3;return<div key={p.id} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 0",borderBottom:i<sorted.length-1?"1px solid rgba(255,255,255,0.05)":"none"}}>
          <div style={{width:24,textAlign:"center",fontSize:isTop3?15:12,fontFamily:"'Space Mono',monospace",color:isTop3?"#C9A84C":"#444"}}>{isTop3?medals[i]:i+1}</div>
          <Avatar name={p.name} size={34}/>
          <div style={{flex:1}}><div style={{color:"#fff",fontSize:13}}>{p.name}</div><div style={{color:"#555",fontSize:10,fontFamily:"'Space Mono',monospace"}}>{p.session_count} games · {p.wins}W</div></div>
          <div style={{color:p.total_profit>=0?"#4CAF8C":"#E05555",fontFamily:"'Space Mono',monospace",fontWeight:700,fontSize:13}}>{p.total_profit>=0?"+":""}${p.total_profit}</div>
        </div>;})}
      </Card>}
      <Card style={{marginBottom:12}}>
        <div style={{color:"#888",fontSize:10,fontFamily:"'Space Mono',monospace",letterSpacing:2,marginBottom:12}}>SEASON AWARDS</div>
        {sorted[0]&&<div style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid rgba(255,255,255,0.05)"}}><span style={{color:"#555",fontFamily:"'Space Mono',monospace",fontSize:11}}>💰 Most Profitable</span><span style={{color:"#4CAF8C",fontFamily:"'Space Mono',monospace",fontWeight:700}}>{sorted[0].name}</span></div>}
        {topChicken&&<div style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid rgba(255,255,255,0.05)"}}><span style={{color:"#555",fontFamily:"'Space Mono',monospace",fontSize:11}}>🍗 Most Chicken Dinners</span><span style={{color:"#C9A84C",fontFamily:"'Space Mono',monospace",fontWeight:700}}>{topChicken[0]} ×{topChicken[1]}</span></div>}
        {mostSessions&&<div style={{display:"flex",justifyContent:"space-between",padding:"8px 0"}}><span style={{color:"#555",fontFamily:"'Space Mono',monospace",fontSize:11}}>🃏 Most Sessions</span><span style={{color:"#fff",fontFamily:"'Space Mono',monospace",fontWeight:700}}>{mostSessions.name} ({mostSessions.session_count})</span></div>}
      </Card>
    </div>
  );
}

// ─── LEAGUE DETAIL ─────────────────────────────────────
function LeagueDetailView({league,players,sessions,profile,isCommissioner,onViewPlayer,onStartSession,onBack,onCommSettings,liveSession,onLeaveLeague,onViewHandRankings,onViewSession,onSeasonRecap,showToast}:any){
  const [sortBy,setSortBy]=useState<'profit'|'winpct'|'sessions'>('profit');
  const [search,setSearch]=useState("");
  const getSorted=()=>{
    let c=[...players];
    if(search)c=c.filter((p:any)=>p.name.toLowerCase().includes(search.toLowerCase()));
    if(sortBy==='profit')return c.sort((a:any,b:any)=>b.total_profit-a.total_profit);
    if(sortBy==='winpct')return c.sort((a:any,b:any)=>{const ar=a.session_count>0?a.wins/a.session_count:0;const br=b.session_count>0?b.wins/b.session_count:0;return br-ar;});
    return c.sort((a:any,b:any)=>b.session_count-a.session_count);
  };
  const sessionsLeft=league.season_length>0?league.season_length-sessions.length:null;
  const seasonDone=sessionsLeft!==null&&sessionsLeft<=0;

  const copyInviteLink=()=>{
    const link=`${window.location.origin}?join=${league.code}`;
    navigator.clipboard?.writeText(link).then(()=>showToast("Invite link copied! 🔗")).catch(()=>showToast(`Share this code: ${league.code}`));
  };

  return(
    <div style={{maxWidth:500,margin:"0 auto"}}>
      <div style={{background:"linear-gradient(180deg,rgba(20,40,20,0.95) 0%,rgba(10,10,10,0) 100%)",padding:"18px 16px 0"}}>
        <div style={{display:"flex",alignItems:"center",gap:11,marginBottom:12}}>
          <button onClick={onBack} style={{background:"none",border:"none",color:"#555",fontSize:22,cursor:"pointer"}}>←</button>
          <div style={{flex:1,minWidth:0}}><div style={{fontFamily:"'Playfair Display',serif",fontSize:21,fontWeight:700,color:"#fff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{league.name}</div>{league.description&&<div style={{color:"#666",fontSize:11,marginTop:1}}>{league.description}</div>}</div>
          {isCommissioner&&<button onClick={onCommSettings} style={{background:"rgba(201,168,76,0.1)",border:"1px solid rgba(201,168,76,0.2)",borderRadius:20,padding:"5px 10px",color:"#C9A84C",fontFamily:"'Space Mono',monospace",fontSize:9,cursor:"pointer",flexShrink:0}}>👑 MANAGE</button>}
        </div>
        {seasonDone&&<div style={{background:"rgba(224,85,85,0.1)",border:"1px solid rgba(224,85,85,0.3)",borderRadius:10,padding:"9px 14px",marginBottom:10,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <span style={{color:"#E05555",fontFamily:"'Space Mono',monospace",fontSize:11}}>🏁 Season complete — {sessions.length} sessions</span>
          <button onClick={onSeasonRecap} style={{padding:"3px 10px",background:"rgba(224,85,85,0.15)",border:"1px solid rgba(224,85,85,0.3)",borderRadius:20,color:"#E05555",fontFamily:"'Space Mono',monospace",fontSize:10,cursor:"pointer"}}>VIEW RECAP</button>
        </div>}
        {sessionsLeft!==null&&sessionsLeft>0&&sessionsLeft<=3&&<div style={{background:"rgba(201,168,76,0.08)",border:"1px solid rgba(201,168,76,0.2)",borderRadius:10,padding:"9px 14px",marginBottom:10,color:"#C9A84C",fontFamily:"'Space Mono',monospace",fontSize:11,textAlign:"center"}}>⚠ Only {sessionsLeft} session{sessionsLeft!==1?"s":""} left in the season!</div>}
        <div style={{display:"flex",gap:7,marginBottom:11}}>
          <StatBox label="Members" value={`${players.length}/${league.max_players||12}`}/>
          <StatBox label="Sessions" value={sessions.length}/>
          <StatBox label="Buy-in" value={`$${league.buy_in}`} accent="#4CAF8C"/>
          {sessionsLeft!==null&&<StatBox label={seasonDone?"Done":"Left"} value={seasonDone?"✓":sessionsLeft} accent={seasonDone?"#E05555":"#C9A84C"}/>}
        </div>
        <div style={{display:"flex",gap:7,alignItems:"center",marginBottom:10,flexWrap:"wrap"}}>
          <span style={{color:"#555",fontSize:10,fontFamily:"'Space Mono',monospace"}}>Code:</span>
          <span style={{color:"#C9A84C",fontSize:11,fontFamily:"'Space Mono',monospace",letterSpacing:3,background:"rgba(201,168,76,0.1)",padding:"2px 9px",borderRadius:6}}>{league.code}</span>
          {league.is_public&&<Badge text="PUBLIC 🌍" color="#5577CC"/>}
          {league.location_name&&<span style={{color:"#555",fontSize:10}}>📍{league.location_name}</span>}
          {/* INVITE LINK button */}
          <button onClick={copyInviteLink} style={{padding:"2px 10px",background:"rgba(76,175,140,0.1)",border:"1px solid rgba(76,175,140,0.3)",borderRadius:20,color:"#4CAF8C",fontFamily:"'Space Mono',monospace",fontSize:10,cursor:"pointer",letterSpacing:1}}>🔗 INVITE</button>
        </div>
      </div>
      <div style={{padding:"0 16px 20px"}}>
        {liveSession&&<div onClick={onStartSession} style={{background:"rgba(76,175,140,0.1)",border:"1px solid rgba(76,175,140,0.4)",borderRadius:13,padding:"13px 16px",marginBottom:12,cursor:"pointer",display:"flex",alignItems:"center",gap:11}}><div style={{width:9,height:9,borderRadius:"50%",background:"#4CAF8C",animation:"pulse 1.5s infinite",flexShrink:0}}/><div style={{flex:1}}><div style={{color:"#4CAF8C",fontFamily:"'Space Mono',monospace",fontSize:11,letterSpacing:2}}>● GAME IS LIVE</div><div style={{color:"#888",fontSize:11,marginTop:1}}>Tap to enter your stats</div></div><span style={{color:"#4CAF8C",fontSize:20}}>›</span></div>}
        {!liveSession&&<button onClick={onStartSession} style={{width:"100%",padding:"12px 0",marginBottom:12,background:"linear-gradient(135deg,#1a4a2a,#2a6a3a)",border:"1px solid rgba(76,175,140,0.4)",borderRadius:13,color:"#4CAF8C",fontFamily:"'Space Mono',monospace",fontWeight:700,fontSize:12,letterSpacing:2,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:9}}><span style={{fontSize:17}}>♠</span> START TONIGHT'S SESSION</button>}
        {/* Search + sort */}
        <div style={{display:"flex",gap:7,marginBottom:9,alignItems:"center"}}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search players..." style={{...inp,flex:1,padding:"7px 11px",fontSize:12}}/>
        </div>
        <div style={{display:"flex",gap:5,marginBottom:11,alignItems:"center"}}>
          <div style={{color:"#444",fontSize:9,fontFamily:"'Space Mono',monospace",marginRight:3}}>SORT:</div>
          {([['profit','$ P/L'],['winpct','WIN %'],['sessions','GAMES']] as any[]).map(([k,l])=><button key={k} onClick={()=>setSortBy(k)} style={{padding:"4px 10px",borderRadius:20,background:sortBy===k?"rgba(201,168,76,0.2)":"rgba(255,255,255,0.04)",border:`1px solid ${sortBy===k?"rgba(201,168,76,0.4)":"rgba(255,255,255,0.08)"}`,color:sortBy===k?"#C9A84C":"#555",fontFamily:"'Space Mono',monospace",fontSize:10,cursor:"pointer"}}>{l}</button>)}
          <button onClick={onViewHandRankings} style={{marginLeft:"auto",padding:"4px 10px",borderRadius:20,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",color:"#555",fontFamily:"'Space Mono',monospace",fontSize:10,cursor:"pointer"}}>🃏 HANDS</button>
        </div>
        <Card style={{padding:0,overflow:"hidden",marginBottom:12}}>
          {getSorted().length===0&&<div style={{color:"#555",fontFamily:"'Space Mono',monospace",fontSize:12,textAlign:"center",padding:"22px 0"}}>{search?"No players match your search":"No members yet"}</div>}
          {getSorted().map((p:any,i:number)=>{const isComm=p.name.toLowerCase()===league.commissioner_name?.toLowerCase();const winPct=p.session_count>0?((p.wins/p.session_count)*100).toFixed(0):0;const medals=["🥇","🥈","🥉"];const isTop3=i<3&&!search;return<div key={p.id} onClick={()=>onViewPlayer(p)} style={{display:"flex",alignItems:"center",gap:11,padding:"12px 16px",borderBottom:"1px solid rgba(255,255,255,0.05)",cursor:"pointer",background:i===0&&!search?"rgba(201,168,76,0.03)":"transparent"}}><div style={{width:22,textAlign:"center",fontSize:isTop3?15:12,fontFamily:"'Space Mono',monospace",color:isTop3?"#C9A84C":"#444"}}>{isTop3?medals[i]:i+1}</div><Avatar name={p.name} size={38}/><div style={{flex:1,minWidth:0}}><div style={{color:"#fff",fontSize:13,display:"flex",alignItems:"center",gap:4}}>{p.name.length>13?p.name.slice(0,13)+"…":p.name} {isComm&&<span>👑</span>} {p.streak>1&&<span>🔥</span>} {(p.chicken_dinners||0)>0&&<span>🍗</span>}</div><div style={{color:"#555",fontSize:10,fontFamily:"'Space Mono',monospace",marginTop:1}}>{p.session_count} games · {p.wins}W · {winPct}% win</div></div><div style={{textAlign:"right",flexShrink:0}}><div style={{color:p.total_profit>=0?"#4CAF8C":"#E05555",fontFamily:"'Space Mono',monospace",fontWeight:700,fontSize:13}}>{p.total_profit>=0?"+":""}${p.total_profit}</div><div style={{color:"#444",fontSize:9}}>best ${p.best_night}</div></div></div>;})}
        </Card>
        {sessions.length>0&&<Card style={{marginBottom:12}}>
          <div style={{color:"#888",fontSize:10,fontFamily:"'Space Mono',monospace",letterSpacing:2,marginBottom:11}}>PAST SESSIONS</div>
          {sessions.slice(0,6).map((s:any,i:number)=>{const d=new Date(s.created_at);return<div key={s.id} onClick={()=>onViewSession(s)} style={{display:"flex",alignItems:"center",gap:9,padding:"8px 0",borderBottom:i<Math.min(sessions.length,6)-1?"1px solid rgba(255,255,255,0.05)":"none",cursor:"pointer"}}><div style={{width:30,textAlign:"center",flexShrink:0}}><div style={{color:"#C9A84C",fontSize:10,fontFamily:"'Space Mono',monospace"}}>{d.getDate()}</div><div style={{color:"#555",fontSize:9}}>{d.toLocaleDateString('en-US',{month:'short'})}</div></div><div style={{flex:1}}><div style={{color:"#fff",fontSize:12}}>${s.pot} pot{s.buy_in_amount?` · $${s.buy_in_amount} buy-in`:""}</div><div style={{color:"#555",fontSize:10,fontFamily:"'Space Mono',monospace"}}>🏆 {s.winner_name||"TBD"}{s.chicken_dinner_name?` · 🍗 ${s.chicken_dinner_name}`:""}{s.notes?` · "${s.notes.slice(0,30)}…"`:""}</div></div><span style={{color:"#555",fontSize:16}}>›</span></div>;})}
        </Card>}
        <button onClick={onLeaveLeague} style={{width:"100%",padding:"10px 0",background:"rgba(224,85,85,0.05)",border:"1px solid rgba(224,85,85,0.12)",borderRadius:11,color:"#E05555",fontFamily:"'Space Mono',monospace",fontSize:10,letterSpacing:1.5,cursor:"pointer"}}>LEAVE LEAGUE</button>
      </div>
    </div>
  );
}

// ─── SESSION DETAIL ─────────────────────────────────────
function SessionDetailView({session,league,players,isCommissioner,onBack,onSaved,showToast,showError}:any){
  const [entries,setEntries]=useState<any[]>([]);const [loading,setLoading]=useState(true);
  const [editing,setEditing]=useState(false);
  const [winnerName,setWinnerName]=useState(session.winner_name||"");
  const [chickenDinner,setChickenDinner]=useState(session.chicken_dinner_name||"");
  const [buyInAmount,setBuyInAmount]=useState(String(session.buy_in_amount||""));
  const [notes,setNotes]=useState(session.notes||"");
  const [editedProfits,setEditedProfits]=useState<Record<string,string>>({});
  const [saving,setSaving]=useState(false);

  useEffect(()=>{
    if(!db)return;
    db.from("session_entries").select("*, players(id,name,total_profit,wins,best_night,session_count,chicken_dinners)").eq("session_id",session.id).then(({data})=>{
      const e=data||[];setEntries(e);
      const profits:Record<string,string>={};e.forEach((en:any)=>{profits[en.id]=String(en.profit||0);});
      setEditedProfits(profits);setLoading(false);
    });
  },[session.id]);

  const handleSave=async()=>{
    if(!db)return;setSaving(true);
    try{
      await db.from("sessions").update({winner_name:winnerName,chicken_dinner_name:chickenDinner||null,buy_in_amount:Number(buyInAmount)||null,notes:notes||null}).eq("id",session.id);
      for(const e of entries){
        const oldProfit=e.profit||0;const newProfit=Number(editedProfits[e.id]||0);const diff=newProfit-oldProfit;
        await db.from("session_entries").update({profit:newProfit}).eq("id",e.id);
        if(diff!==0&&e.players){
          const p=e.players;const oldWon=oldProfit>0?1:0;const newWon=newProfit>0?1:0;const winDiff=newWon-oldWon;
          let newBest=p.best_night||0;if(newProfit>newBest)newBest=newProfit;
          await db.from("players").update({total_profit:(p.total_profit||0)+diff,wins:Math.max(0,(p.wins||0)+winDiff),best_night:newBest}).eq("id",e.player_id);
        }
        const wasChicken=session.chicken_dinner_name?.toLowerCase()===e.players?.name?.toLowerCase();
        const isChicken=chickenDinner?.toLowerCase()===e.players?.name?.toLowerCase();
        if(wasChicken!==isChicken&&e.players){const delta=isChicken?1:-1;await db.from("players").update({chicken_dinners:Math.max(0,(e.players.chicken_dinners||0)+delta)}).eq("id",e.player_id);}
      }
      showToast("Session updated!");setSaving(false);setEditing(false);onSaved();
    }catch(err:any){showError(err.message||"Save failed");setSaving(false);}
  };

  const d=new Date(session.created_at);
  return(
    <div style={{padding:"20px 16px",maxWidth:500,margin:"0 auto"}}>
      <BackButton onBack={onBack}/>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <div><div style={{color:"#888",fontSize:10,fontFamily:"'Space Mono',monospace",letterSpacing:2}}>{d.toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}</div><div style={{fontFamily:"'Playfair Display',serif",fontSize:20,color:"#fff",marginTop:2}}>Session Results</div></div>
        {isCommissioner&&<button onClick={()=>setEditing(!editing)} style={{padding:"6px 13px",background:editing?"rgba(201,168,76,0.15)":"rgba(255,255,255,0.06)",border:`1px solid ${editing?"rgba(201,168,76,0.3)":"rgba(255,255,255,0.1)"}`,borderRadius:20,color:editing?"#C9A84C":"#888",fontFamily:"'Space Mono',monospace",fontSize:10,cursor:"pointer"}}>{editing?"CANCEL":"EDIT"}</button>}
      </div>
      <Card style={{marginBottom:12}}>
        <div style={{display:"flex",gap:12}}>
          <div style={{flex:1,textAlign:"center"}}><div style={{color:"#555",fontSize:9,fontFamily:"'Space Mono',monospace",letterSpacing:2}}>POT</div><div style={{color:"#C9A84C",fontSize:24,fontFamily:"'Space Mono',monospace",fontWeight:700,marginTop:2}}>${session.pot}</div></div>
          <div style={{flex:1,textAlign:"center"}}><div style={{color:"#555",fontSize:9,fontFamily:"'Space Mono',monospace",letterSpacing:2}}>BUY-IN</div><div style={{color:"#888",fontSize:24,fontFamily:"'Space Mono',monospace",fontWeight:700,marginTop:2}}>${session.buy_in_amount||league.buy_in}</div></div>
        </div>
        {session.notes&&!editing&&<div style={{marginTop:10,paddingTop:10,borderTop:"1px solid rgba(255,255,255,0.05)",color:"#666",fontSize:12,fontStyle:"italic"}}>"{session.notes}"</div>}
        {editing&&<div style={{marginTop:10}}><label style={{color:"#888",fontSize:10,fontFamily:"'Space Mono',monospace",marginBottom:5,display:"block"}}>OVERRIDE BUY-IN</label><input type="number" value={buyInAmount} onChange={e=>setBuyInAmount(e.target.value)} style={{...inp,marginBottom:8}}/><label style={{color:"#888",fontSize:10,fontFamily:"'Space Mono',monospace",marginBottom:5,display:"block"}}>SESSION NOTES</label><input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="e.g. Played at Nick's — wild night" style={inp}/></div>}
      </Card>
      <Card style={{marginBottom:12}}>
        <div style={{color:"#888",fontSize:10,fontFamily:"'Space Mono',monospace",letterSpacing:2,marginBottom:11}}>RESULTS</div>
        {loading&&<div style={{display:"flex",justifyContent:"center",padding:16}}><Spinner/></div>}
        {[...entries].sort((a:any,b:any)=>b.profit-a.profit).map((e:any,i:number)=>{
          const name=e.players?.name||"Unknown";const profit=editing?Number(editedProfits[e.id]||0):(e.profit||0);
          return<div key={e.id} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 0",borderBottom:i<entries.length-1?"1px solid rgba(255,255,255,0.05)":"none"}}>
            <Avatar name={name} size={34}/>
            <div style={{flex:1}}><div style={{color:"#fff",fontSize:13}}>{name}</div><div style={{color:"#555",fontSize:10,fontFamily:"'Space Mono',monospace"}}>in: ${(e.buy_in||0)+(e.rebuys||0)} · out: ${e.cash_out||0}</div></div>
            {editing?<input type="number" value={editedProfits[e.id]||""} onChange={ev=>setEditedProfits(p=>({...p,[e.id]:ev.target.value}))} style={{...inp,width:80,textAlign:"center" as const,padding:"7px 8px",fontSize:13}}/>:<div style={{color:profit>=0?"#4CAF8C":"#E05555",fontFamily:"'Space Mono',monospace",fontWeight:700,fontSize:13}}>{profit>=0?"+":""}${profit}</div>}
          </div>;
        })}
      </Card>
      <Card style={{marginBottom:12}}>
        <div style={{color:"#888",fontSize:10,fontFamily:"'Space Mono',monospace",letterSpacing:2,marginBottom:11}}>AWARDS</div>
        <div style={{display:"flex",gap:10}}>
          <div style={{flex:1}}><div style={{color:"#555",fontSize:10,fontFamily:"'Space Mono',monospace",marginBottom:6}}>🏆 WINNER</div>
            {editing?<select value={winnerName} onChange={e=>setWinnerName(e.target.value)} style={{...inp,fontSize:13}}><option value="">-- select --</option>{entries.map((en:any)=><option key={en.id} value={en.players?.name}>{en.players?.name}</option>)}</select>:<div style={{color:"#fff",fontSize:14,fontFamily:"'Playfair Display',serif"}}>{session.winner_name||"—"}</div>}
          </div>
          <div style={{flex:1}}><div style={{color:"#555",fontSize:10,fontFamily:"'Space Mono',monospace",marginBottom:6}}>🍗 CHICKEN DINNER</div>
            {editing?<select value={chickenDinner} onChange={e=>setChickenDinner(e.target.value)} style={{...inp,fontSize:13}}><option value="">-- none --</option>{entries.map((en:any)=><option key={en.id} value={en.players?.name}>{en.players?.name}</option>)}</select>:<div style={{color:"#fff",fontSize:14,fontFamily:"'Playfair Display',serif"}}>{session.chicken_dinner_name||"—"}</div>}
          </div>
        </div>
      </Card>
      {editing&&<button onClick={handleSave} disabled={saving} style={{width:"100%",padding:"12px 0",background:saving?"rgba(255,255,255,0.08)":"linear-gradient(135deg,#C9A84C,#E8C56A)",border:"none",borderRadius:11,color:saving?"#444":"#0A0A0A",fontFamily:"'Space Mono',monospace",fontWeight:700,fontSize:13,letterSpacing:2,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:10}}>{saving?<><Spinner size={14}/> SAVING...</>:"SAVE CHANGES ✓"}</button>}
    </div>
  );
}

// ─── TRANSFER COMMISSIONER ─────────────────────────────
function TransferCommView({league,players,profile,onBack,onTransferred}:any){
  const [selected,setSelected]=useState("");const [loading,setLoading]=useState(false);
  const others=players.filter((p:any)=>p.name.toLowerCase()!==profile.display_name.toLowerCase());
  const handleTransfer=async()=>{if(!db||!selected)return;setLoading(true);const{data:np}=await db.from("profiles").select("id").ilike("display_name",selected).limit(1);const newCommId=np?.[0]?.id||null;if(!newCommId){setLoading(false);return;}await db.from("leagues").update({commissioner_name:selected,commissioner_id:newCommId}).eq("id",league.id);onTransferred();};
  return(
    <div style={{padding:"20px 16px",maxWidth:500,margin:"0 auto"}}>
      <BackButton onBack={onBack}/><SectionTitle text="Transfer Commissioner"/>
      <div style={{color:"#888",fontSize:12,lineHeight:1.7,marginBottom:16}}>Choose who takes over before you leave.</div>
      <Card style={{marginBottom:14}}>{others.length===0&&<div style={{color:"#555",textAlign:"center",padding:"14px 0",fontFamily:"'Space Mono',monospace",fontSize:12}}>No other players.</div>}{others.map((p:any)=><div key={p.id} onClick={()=>setSelected(p.name)} style={{display:"flex",alignItems:"center",gap:11,padding:"10px 0",borderBottom:"1px solid rgba(255,255,255,0.05)",cursor:"pointer"}}><div style={{width:20,height:20,borderRadius:5,border:`2px solid ${selected===p.name?"#C9A84C":"#333"}`,background:selected===p.name?"#C9A84C":"transparent",display:"flex",alignItems:"center",justifyContent:"center",color:"#000",fontSize:12,flexShrink:0}}>{selected===p.name?"✓":""}</div><Avatar name={p.name} size={32}/><div style={{color:"#fff"}}>{p.name}</div></div>)}</Card>
      <button onClick={handleTransfer} disabled={!selected||loading} style={{width:"100%",padding:"12px 0",background:selected&&!loading?"linear-gradient(135deg,#C9A84C,#E8C56A)":"rgba(255,255,255,0.08)",border:"none",borderRadius:11,color:selected&&!loading?"#0A0A0A":"#444",fontFamily:"'Space Mono',monospace",fontWeight:700,fontSize:13,letterSpacing:2,cursor:selected&&!loading?"pointer":"not-allowed",display:"flex",alignItems:"center",justifyContent:"center",gap:10}}>{loading?<Spinner size={16}/>:"TRANSFER & LEAVE →"}</button>
    </div>
  );
}

// ─── LIVE SESSION ──────────────────────────────────────
function LiveSessionView({session,liveEntries,players,profile,isCommissioner,league,onBack,onSubmitEntry,onEndSession}:any){
  const [elapsed,setElapsed]=useState(0);const [myBuyIn,setMyBuyIn]=useState(session.buy_in_amount||league.buy_in||20);const [myRebuys,setMyRebuys]=useState(0);const [myCashOut,setMyCashOut]=useState(0);
  const [cashOuts,setCashOuts]=useState<any>({});const [saving,setSaving]=useState(false);const [showCashout,setShowCashout]=useState(false);const [chickenDinner,setChickenDinner]=useState("");
  const [addingPlayer,setAddingPlayer]=useState(false);
  const myPlayer=players.find((p:any)=>p.name.toLowerCase()===profile.display_name.toLowerCase());
  const myEntry=liveEntries.find((e:any)=>e.player_name.toLowerCase()===profile.display_name.toLowerCase());
  const inSession=!!myEntry;

  useEffect(()=>{if(session?.started_at){const t=setInterval(()=>setElapsed(Math.floor((Date.now()-new Date(session.started_at).getTime())/1000)),1000);return()=>clearInterval(t);}},[session]);
  useEffect(()=>{if(myEntry){setMyBuyIn(myEntry.buy_in||0);setMyRebuys(myEntry.rebuys||0);setMyCashOut(myEntry.cash_out||0);}else{setMyBuyIn(session.buy_in_amount||league.buy_in||20);}},[myEntry]);

  const fmt=(s:number)=>`${Math.floor(s/3600)}:${String(Math.floor((s%3600)/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;
  const totalPot=liveEntries.reduce((a:number,e:any)=>a+(e.buy_in||0)+(e.rebuys||0),0);
  const handleSubmit=async()=>{if(!myPlayer)return;setSaving(true);await onSubmitEntry({player_id:myPlayer.id,player_name:profile.display_name,buy_in:myBuyIn,rebuys:myRebuys,cash_out:myCashOut});setSaving(false);};
  const handleEnd=async()=>{setSaving(true);const entries=liveEntries.map((e:any)=>({player_id:e.player_id,player_name:e.player_name,buy_in:e.buy_in||0,rebuys:e.rebuys||0,cash_out:isCommissioner?(cashOuts[e.player_id]!==undefined?cashOuts[e.player_id]:(e.cash_out||0)):(e.cash_out||0),profit:(isCommissioner?(cashOuts[e.player_id]!==undefined?cashOuts[e.player_id]:(e.cash_out||0)):(e.cash_out||0))-((e.buy_in||0)+(e.rebuys||0))}));await onEndSession({entries,elapsed,chickenDinner});setSaving(false);};

  // Non-selected players in the league can join mid-game
  const notInSession=players.filter((p:any)=>!liveEntries.some((e:any)=>e.player_id===p.id));
  const ni:any={background:"rgba(255,255,255,0.05)",border:"1px solid rgba(201,168,76,0.25)",borderRadius:8,padding:"7px 9px",color:"#fff",fontSize:13,fontFamily:"'Space Mono',monospace",outline:"none",textAlign:"center",boxSizing:"border-box"};

  return(
    <div style={{padding:"16px 16px",maxWidth:500,margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"center",gap:11,marginBottom:12}}><button onClick={onBack} style={{background:"none",border:"none",color:"#555",fontSize:22,cursor:"pointer"}}>←</button><div style={{flex:1}}><div style={{color:"#4CAF8C",fontSize:10,fontFamily:"'Space Mono',monospace",letterSpacing:2}}>● GAME IS LIVE</div><div style={{fontFamily:"'Playfair Display',serif",fontSize:19,color:"#fff"}}>{league.name}</div></div></div>
      <div style={{display:"flex",gap:9,marginBottom:12}}>
        <div style={{flex:1,background:"rgba(76,175,140,0.1)",border:"1px solid rgba(76,175,140,0.3)",borderRadius:13,padding:"12px 13px",textAlign:"center"}}><div style={{color:"#555",fontSize:9,fontFamily:"'Space Mono',monospace",letterSpacing:2}}>TIME</div><div style={{color:"#4CAF8C",fontSize:24,fontFamily:"'Space Mono',monospace",fontWeight:700,marginTop:2}}>{fmt(elapsed)}</div></div>
        <div style={{flex:1,background:"rgba(201,168,76,0.08)",border:"1px solid rgba(201,168,76,0.2)",borderRadius:13,padding:"12px 13px",textAlign:"center"}}><div style={{color:"#555",fontSize:9,fontFamily:"'Space Mono',monospace",letterSpacing:2}}>POT</div><div style={{color:"#C9A84C",fontSize:24,fontFamily:"'Space Mono',monospace",fontWeight:700,marginTop:2}}>${totalPot}</div></div>
      </div>

      {/* Your stats — always shown if you're in the league */}
      {myPlayer&&<Card style={{marginBottom:12,border:"1px solid rgba(201,168,76,0.3)",background:"rgba(201,168,76,0.04)"}}>
        <div style={{color:"#C9A84C",fontSize:10,fontFamily:"'Space Mono',monospace",letterSpacing:2,marginBottom:11}}>YOUR STATS {inSession&&<span style={{color:"#4CAF8C",fontSize:9}}>✓ submitted</span>}</div>
        <div style={{display:"flex",gap:9,marginBottom:11}}>
          <div style={{flex:1}}><div style={{color:"#888",fontSize:9,fontFamily:"'Space Mono',monospace",marginBottom:4}}>BUY-IN ($)</div><input type="number" value={myBuyIn||""} onChange={e=>setMyBuyIn(Number(e.target.value))} style={{...ni,width:"100%"}}/></div>
          <div style={{flex:1}}><div style={{color:"#888",fontSize:9,fontFamily:"'Space Mono',monospace",marginBottom:4}}>REBUYS ($)</div><input type="number" value={myRebuys||""} onChange={e=>setMyRebuys(Number(e.target.value))} style={{...ni,width:"100%"}}/></div>
          <div style={{flex:1}}><div style={{color:"#888",fontSize:9,fontFamily:"'Space Mono',monospace",marginBottom:4}}>CASH-OUT ($)</div><input type="number" value={myCashOut||""} onChange={e=>setMyCashOut(Number(e.target.value))} style={{...ni,width:"100%"}}/></div>
        </div>
        <div style={{color:"#555",fontSize:10,fontFamily:"'Space Mono',monospace",marginBottom:9}}>Profit: <span style={{color:myCashOut-(myBuyIn+myRebuys)>=0?"#4CAF8C":"#E05555",fontWeight:700}}>{myCashOut-(myBuyIn+myRebuys)>=0?"+":""}${myCashOut-(myBuyIn+myRebuys)}</span></div>
        <button onClick={handleSubmit} disabled={saving} style={{width:"100%",padding:"9px 0",background:"rgba(201,168,76,0.15)",border:"1px solid rgba(201,168,76,0.3)",borderRadius:9,color:"#C9A84C",fontFamily:"'Space Mono',monospace",fontSize:11,letterSpacing:1.5,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:7}}>{saving?<Spinner size={13}/>:inSession?"UPDATE MY STATS ✓":"JOIN & SUBMIT STATS →"}</button>
      </Card>}

      <Card style={{marginBottom:12}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:11}}>
          <div style={{color:"#888",fontSize:10,fontFamily:"'Space Mono',monospace",letterSpacing:2}}>IN SESSION ({liveEntries.length})</div>
          {/* Commissioner can add players mid-game */}
          {isCommissioner&&notInSession.length>0&&<button onClick={()=>setAddingPlayer(!addingPlayer)} style={{padding:"3px 9px",background:"rgba(76,175,140,0.1)",border:"1px solid rgba(76,175,140,0.3)",borderRadius:20,color:"#4CAF8C",fontFamily:"'Space Mono',monospace",fontSize:9,cursor:"pointer"}}>+ ADD PLAYER</button>}
        </div>
        {addingPlayer&&isCommissioner&&<div style={{marginBottom:11,paddingBottom:11,borderBottom:"1px solid rgba(255,255,255,0.05)"}}>
          <div style={{color:"#555",fontSize:10,fontFamily:"'Space Mono',monospace",marginBottom:7}}>Select player to add:</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {notInSession.map((p:any)=><button key={p.id} onClick={async()=>{if(!db||!session)return;await db.from("live_entries").insert({session_id:session.id,player_id:p.id,player_name:p.name,buy_in:session.buy_in_amount||league.buy_in,rebuys:0,cash_out:0});setAddingPlayer(false);}} style={{padding:"5px 10px",borderRadius:20,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",color:"#fff",fontFamily:"'Space Mono',monospace",fontSize:11,cursor:"pointer"}}>{p.name}</button>)}
          </div>
        </div>}
        {liveEntries.length===0&&<div style={{color:"#555",fontSize:11,fontFamily:"'Space Mono',monospace",textAlign:"center",padding:"10px 0"}}>Waiting for players...</div>}
        {liveEntries.map((e:any,i:number)=>{const total=(e.buy_in||0)+(e.rebuys||0);const isMe=e.player_name.toLowerCase()===profile.display_name.toLowerCase();return<div key={e.id||i} style={{display:"flex",alignItems:"center",gap:9,padding:"7px 0",borderBottom:i<liveEntries.length-1?"1px solid rgba(255,255,255,0.05)":"none"}}><Avatar name={e.player_name} size={30}/><div style={{flex:1}}><div style={{color:"#fff",fontSize:12}}>{e.player_name}{isMe&&<span style={{color:"#C9A84C",fontSize:9,fontFamily:"'Space Mono',monospace"}}> (you)</span>}</div><div style={{color:"#555",fontSize:9,fontFamily:"'Space Mono',monospace"}}>in: ${e.buy_in||0} · rebuys: ${e.rebuys||0} · out: ${e.cash_out||0}</div></div><div style={{color:"#4CAF8C",fontFamily:"'Space Mono',monospace",fontWeight:700,fontSize:12}}>${total}</div></div>;})}
      </Card>

      {isCommissioner&&<>{!showCashout&&<button onClick={()=>setShowCashout(true)} style={{width:"100%",padding:"12px 0",background:"linear-gradient(135deg,#5a0000,#8B1A1A)",border:"1px solid rgba(224,85,85,0.4)",borderRadius:11,color:"#E05555",fontFamily:"'Space Mono',monospace",fontWeight:700,fontSize:12,letterSpacing:2,cursor:"pointer"}}>END GAME & FINALIZE →</button>}{showCashout&&<Card>
        <div style={{color:"#888",fontSize:10,fontFamily:"'Space Mono',monospace",letterSpacing:2,marginBottom:11}}>VERIFY / OVERRIDE CASH-OUTS</div>
        {liveEntries.map((e:any)=><div key={e.player_id} style={{display:"flex",alignItems:"center",gap:9,marginBottom:9}}><Avatar name={e.player_name} size={26}/><div style={{flex:1}}><div style={{color:"#fff",fontSize:12}}>{e.player_name}</div><div style={{color:"#555",fontSize:9,fontFamily:"'Space Mono',monospace"}}>submitted: ${e.cash_out||0}</div></div><input type="number" value={cashOuts[e.player_id]!==undefined?cashOuts[e.player_id]:(e.cash_out||"")} onChange={ev=>setCashOuts((c:any)=>({...c,[e.player_id]:Number(ev.target.value)}))} style={{...ni,width:"72px"}}/></div>)}
        <div style={{marginTop:11,marginBottom:3}}><div style={{color:"#C9A84C",fontSize:10,fontFamily:"'Space Mono',monospace",letterSpacing:2,marginBottom:7}}>🍗 CHICKEN DINNER</div><div style={{display:"flex",gap:5,flexWrap:"wrap"}}>{liveEntries.map((e:any)=><button key={e.player_id} onClick={()=>setChickenDinner(e.player_name)} style={{padding:"5px 10px",borderRadius:20,background:chickenDinner===e.player_name?"rgba(201,168,76,0.2)":"rgba(255,255,255,0.04)",border:`1px solid ${chickenDinner===e.player_name?"rgba(201,168,76,0.4)":"rgba(255,255,255,0.08)"}`,color:chickenDinner===e.player_name?"#C9A84C":"#555",fontFamily:"'Space Mono',monospace",fontSize:10,cursor:"pointer"}}>{e.player_name}</button>)}</div></div>
        <button onClick={handleEnd} disabled={saving} style={{width:"100%",marginTop:13,padding:"11px 0",background:saving?"rgba(255,255,255,0.08)":"linear-gradient(135deg,#C9A84C,#E8C56A)",border:"none",borderRadius:9,color:saving?"#444":"#0A0A0A",fontFamily:"'Space Mono',monospace",fontWeight:700,fontSize:12,letterSpacing:2,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:9}}>{saving?<><Spinner size={14}/> SAVING...</>:"APPROVE & SAVE SESSION ✓"}</button>
      </Card>}</>}
      {!isCommissioner&&<div style={{padding:"11px 13px",background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.05)",borderRadius:11,color:"#444",fontFamily:"'Space Mono',monospace",fontSize:10,textAlign:"center"}}>👑 Commissioner will finalize the session</div>}
    </div>
  );
}

// ─── NEW SESSION ───────────────────────────────────────
function NewSessionView({league,players,sessions,onStart,onBack}:any){
  const [sessionBuyIn,setSessionBuyIn]=useState(league.buy_in);const [selectedIds,setSelectedIds]=useState<string[]>([]);const [loading,setLoading]=useState(false);
  const [sessionNotes,setSessionNotes]=useState("");

  // Rematch: pre-select last session's players
  const lastSession=sessions?.[0];
  const [lastPlayerIds,setLastPlayerIds]=useState<string[]>([]);
  useEffect(()=>{
    if(!db||!lastSession)return;
    db.from("session_entries").select("player_id").eq("session_id",lastSession.id).then(({data})=>{setLastPlayerIds((data||[]).map((e:any)=>e.player_id));});
  },[lastSession?.id]);

  const handleRematch=()=>{
    if(lastPlayerIds.length>0){setSelectedIds(lastPlayerIds);if(lastSession.buy_in_amount)setSessionBuyIn(lastSession.buy_in_amount);}
  };

  return(
    <div style={{padding:"20px 16px",maxWidth:500,margin:"0 auto"}}>
      <BackButton onBack={onBack}/><SectionTitle text="Tonight's Setup"/>
      <Card style={{marginBottom:12}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:9}}>
          <div style={{color:"#888",fontSize:10,fontFamily:"'Space Mono',monospace",letterSpacing:2}}>BUY-IN FOR TONIGHT</div>
          {lastSession&&lastPlayerIds.length>0&&<button onClick={handleRematch} style={{padding:"3px 10px",background:"rgba(201,168,76,0.1)",border:"1px solid rgba(201,168,76,0.25)",borderRadius:20,color:"#C9A84C",fontFamily:"'Space Mono',monospace",fontSize:9,cursor:"pointer",letterSpacing:1}}>🔄 REMATCH</button>}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:11,marginBottom:9}}><button onClick={()=>setSessionBuyIn(Math.max(1,sessionBuyIn-5))} style={{width:38,height:38,borderRadius:9,background:"rgba(224,85,85,0.15)",border:"1px solid rgba(224,85,85,0.3)",color:"#E05555",fontSize:20,cursor:"pointer"}}>−</button><div style={{flex:1,textAlign:"center"}}><div style={{color:"#C9A84C",fontSize:30,fontFamily:"'Space Mono',monospace",fontWeight:700}}>${sessionBuyIn}</div></div><button onClick={()=>setSessionBuyIn(sessionBuyIn+5)} style={{width:38,height:38,borderRadius:9,background:"rgba(76,175,140,0.15)",border:"1px solid rgba(76,175,140,0.3)",color:"#4CAF8C",fontSize:20,cursor:"pointer"}}>+</button></div>
        <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:12}}>{[10,20,25,50,100].map(amt=><button key={amt} onClick={()=>setSessionBuyIn(amt)} style={{padding:"4px 10px",borderRadius:20,background:sessionBuyIn===amt?"rgba(201,168,76,0.2)":"rgba(255,255,255,0.04)",border:`1px solid ${sessionBuyIn===amt?"rgba(201,168,76,0.4)":"rgba(255,255,255,0.08)"}`,color:sessionBuyIn===amt?"#C9A84C":"#555",fontFamily:"'Space Mono',monospace",fontSize:11,cursor:"pointer"}}>${amt}</button>)}</div>
        <label style={{color:"#888",fontSize:10,fontFamily:"'Space Mono',monospace",letterSpacing:1.5,display:"block",marginBottom:5}}>SESSION NOTES (optional)</label>
        <input value={sessionNotes} onChange={e=>setSessionNotes(e.target.value)} placeholder="e.g. Played at Nick's house" style={{...inp,fontSize:12}}/>
      </Card>
      <div style={{color:"#888",fontSize:10,fontFamily:"'Space Mono',monospace",letterSpacing:2,marginBottom:9}}>WHO'S PLAYING</div>
      <Card style={{marginBottom:14}}>
        {players.map((p:any)=>{const sel=selectedIds.includes(p.id);return<div key={p.id} onClick={()=>setSelectedIds(sel?selectedIds.filter(x=>x!==p.id):[...selectedIds,p.id])} style={{display:"flex",alignItems:"center",gap:11,padding:"10px 0",borderBottom:"1px solid rgba(255,255,255,0.05)",cursor:"pointer",opacity:sel?1:0.5}}><div style={{width:20,height:20,borderRadius:5,border:`2px solid ${sel?"#C9A84C":"#333"}`,background:sel?"#C9A84C":"transparent",display:"flex",alignItems:"center",justifyContent:"center",color:"#000",fontSize:12,flexShrink:0}}>{sel?"✓":""}</div><Avatar name={p.name} size={32}/><div style={{flex:1}}><div style={{color:"#fff"}}>{p.name}</div><div style={{color:"#555",fontSize:10,fontFamily:"'Space Mono',monospace"}}>{p.wins}W · {p.total_profit>=0?"+":""}${p.total_profit}</div></div></div>;})}
      </Card>
      <button disabled={selectedIds.length<2||loading} onClick={async()=>{setLoading(true);await onStart({selectedIds,sessionBuyIn,sessionNotes});setLoading(false);}} style={{width:"100%",padding:"13px 0",background:selectedIds.length>=2&&!loading?"linear-gradient(135deg,#C9A84C,#E8C56A)":"rgba(255,255,255,0.08)",border:"none",borderRadius:11,color:selectedIds.length>=2&&!loading?"#0A0A0A":"#444",fontFamily:"'Space Mono',monospace",fontWeight:700,fontSize:13,letterSpacing:2,cursor:selectedIds.length>=2&&!loading?"pointer":"not-allowed",display:"flex",alignItems:"center",justifyContent:"center",gap:10}}>{loading?<Spinner size={16}/>:`START WITH ${selectedIds.length} PLAYERS →`}</button>
    </div>
  );
}

// ─── HAND RANKINGS ─────────────────────────────────────
function HandRankingsView({onBack}:any){
  return(
    <div style={{padding:"20px 16px",maxWidth:500,margin:"0 auto"}}>
      <BackButton onBack={onBack}/><SectionTitle text="Hand Rankings"/>
      {HAND_RANKINGS.map((h,i)=><div key={h.rank} style={{display:"flex",alignItems:"center",gap:13,padding:"11px 14px",marginBottom:6,background:"rgba(255,255,255,0.03)",border:`1px solid ${h.rank<=2?"rgba(201,168,76,0.25)":"rgba(255,255,255,0.07)"}`,borderRadius:12}}><div style={{width:28,height:28,borderRadius:8,background:`${h.color}22`,border:`1px solid ${h.color}44`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Space Mono',monospace",fontWeight:700,color:h.color,fontSize:11,flexShrink:0}}>{h.rank}</div><div style={{flex:1}}><div style={{color:h.color,fontFamily:"'Playfair Display',serif",fontSize:14,fontWeight:700}}>{h.name}</div><div style={{color:"#666",fontSize:10,marginTop:1}}>{h.desc}</div><div style={{color:"#444",fontSize:9,fontFamily:"'Space Mono',monospace",marginTop:1,letterSpacing:1}}>{h.example}</div></div>{h.rank<=3&&<div style={{fontSize:14,flexShrink:0}}>{["👑","⭐","💎"][i]}</div>}</div>)}
    </div>
  );
}

// ─── COMMISSIONER SETTINGS ─────────────────────────────
function CommSettingsView({league,players,onBack,onLeagueUpdated,onLeagueDeleted,showToast,showError}:any){
  const [buyIn,setBuyIn]=useState(String(league.buy_in));const [season,setSeason]=useState(league.season);const [seasonLength,setSeasonLength]=useState(String(league.season_length||0));const [description,setDescription]=useState(league.description||"");const [isPublic,setIsPublic]=useState(league.is_public||false);const [locationName,setLocationName]=useState(league.location_name||"");const [maxPlayers,setMaxPlayers]=useState(league.max_players||12);const [saving,setSaving]=useState(false);const [confirmDelete,setConfirmDelete]=useState(false);
  const save=async()=>{if(!db)return;setSaving(true);const{data,error}=await db.from("leagues").update({buy_in:Number(buyIn),season,season_length:Number(seasonLength),description,is_public:isPublic,location_name:locationName||null,max_players:maxPlayers}).eq("id",league.id).select().single();if(error)showError(error.message);else{showToast("Settings saved!");onLeagueUpdated(data);}setSaving(false);};
  const kick=async(id:string,name:string)=>{if(!db||!window.confirm(`Kick ${name}?`))return;await db.from("players").delete().eq("id",id);await db.from("live_entries").delete().eq("player_id",id);showToast(`${name} removed.`);onLeagueUpdated(league);};
  const del=async()=>{if(!db)return;await db.from("leagues").delete().eq("id",league.id);showToast("League deleted.");onLeagueDeleted();};
  return(
    <div style={{padding:"20px 16px",maxWidth:500,margin:"0 auto"}}>
      <BackButton onBack={onBack}/><SectionTitle text={`👑 Manage ${league.name}`}/>
      <Card style={{marginBottom:11}}>
        {([["DESCRIPTION","text",description,setDescription,"League description"],["SEASON NAME","text",season,setSeason,"Season 1"],["LOCATION","text",locationName,setLocationName,"e.g. San Francisco, CA"]] as any[]).map(([label,type,val,setter,ph])=><div key={label} style={{marginBottom:9}}><label style={{color:"#888",fontSize:10,fontFamily:"'Space Mono',monospace",letterSpacing:1.5,display:"block",marginBottom:5}}>{label}</label><input type={type} value={val} onChange={(e:any)=>setter(e.target.value)} placeholder={ph} style={inp}/></div>)}
        <div style={{display:"flex",gap:9,marginBottom:9}}><div style={{flex:1}}><label style={{color:"#888",fontSize:10,fontFamily:"'Space Mono',monospace",letterSpacing:1.5,display:"block",marginBottom:5}}>DEFAULT BUY-IN ($)</label><input type="number" value={buyIn} onChange={e=>setBuyIn(e.target.value)} style={inp}/></div><div style={{flex:1}}><label style={{color:"#888",fontSize:10,fontFamily:"'Space Mono',monospace",letterSpacing:1.5,display:"block",marginBottom:5}}>SEASON LENGTH</label><input type="number" value={seasonLength} onChange={e=>setSeasonLength(e.target.value)} style={inp}/></div></div>
        <div style={{marginBottom:11}}><label style={{color:"#888",fontSize:10,fontFamily:"'Space Mono',monospace",letterSpacing:1.5,display:"block",marginBottom:5}}>MAX PLAYERS</label><div style={{display:"flex",gap:5}}>{MAX_PLAYER_OPTIONS.map(n=><button key={n} onClick={()=>setMaxPlayers(n)} style={{flex:1,padding:"7px 0",borderRadius:9,background:maxPlayers===n?"rgba(201,168,76,0.2)":"rgba(255,255,255,0.04)",border:`1px solid ${maxPlayers===n?"rgba(201,168,76,0.4)":"rgba(255,255,255,0.08)"}`,color:maxPlayers===n?"#C9A84C":"#555",fontFamily:"'Space Mono',monospace",fontSize:11,cursor:"pointer"}}>{n}</button>)}</div></div>
        <Toggle value={isPublic} onChange={setIsPublic} label="Public League 🌍" sub="Anyone can find & join without a code"/>
        <button onClick={save} disabled={saving} style={{width:"100%",padding:"11px 0",background:"linear-gradient(135deg,#C9A84C,#E8C56A)",border:"none",borderRadius:9,color:"#0A0A0A",fontFamily:"'Space Mono',monospace",fontWeight:700,fontSize:12,letterSpacing:2,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:9}}>{saving?<Spinner size={14}/>:"SAVE ✓"}</button>
      </Card>
      <Card style={{marginBottom:11}}><div style={{color:"#888",fontSize:10,fontFamily:"'Space Mono',monospace",letterSpacing:2,marginBottom:11}}>PLAYERS ({players.length}/{maxPlayers})</div>{players.map((p:any,i:number)=>{const isComm=p.name.toLowerCase()===league.commissioner_name?.toLowerCase();return<div key={p.id} style={{display:"flex",alignItems:"center",gap:9,padding:"8px 0",borderBottom:i<players.length-1?"1px solid rgba(255,255,255,0.05)":"none"}}><Avatar name={p.name} size={30}/><div style={{flex:1}}><div style={{color:"#fff",display:"flex",alignItems:"center",gap:4,fontSize:13}}>{p.name} {isComm&&<span>👑</span>}</div><div style={{color:"#555",fontSize:9,fontFamily:"'Space Mono',monospace"}}>{p.session_count} sessions</div></div>{!isComm&&<button onClick={()=>kick(p.id,p.name)} style={{padding:"3px 9px",background:"rgba(224,85,85,0.1)",border:"1px solid rgba(224,85,85,0.25)",borderRadius:20,color:"#E05555",fontFamily:"'Space Mono',monospace",fontSize:10,cursor:"pointer"}}>KICK</button>}</div>;})}
      </Card>
      <Card><div style={{color:"#E05555",fontSize:10,fontFamily:"'Space Mono',monospace",letterSpacing:2,marginBottom:9}}>DANGER ZONE</div>{!confirmDelete?<button onClick={()=>setConfirmDelete(true)} style={{width:"100%",padding:"11px 0",background:"rgba(224,85,85,0.06)",border:"1px solid rgba(224,85,85,0.2)",borderRadius:9,color:"#E05555",fontFamily:"'Space Mono',monospace",fontSize:11,letterSpacing:1.5,cursor:"pointer"}}>DELETE THIS LEAGUE</button>:<div><div style={{color:"#E05555",fontSize:12,marginBottom:11,textAlign:"center",lineHeight:1.6}}>Permanently delete all data? Cannot be undone.</div><div style={{display:"flex",gap:9}}><button onClick={()=>setConfirmDelete(false)} style={{flex:1,padding:"10px 0",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:9,color:"#888",fontFamily:"'Space Mono',monospace",fontSize:11,cursor:"pointer"}}>CANCEL</button><button onClick={del} style={{flex:1,padding:"10px 0",background:"rgba(224,85,85,0.2)",border:"1px solid rgba(224,85,85,0.4)",borderRadius:9,color:"#E05555",fontFamily:"'Space Mono',monospace",fontWeight:700,fontSize:11,cursor:"pointer"}}>DELETE</button></div></div>}</Card>
    </div>
  );
}

// ─── FEED ──────────────────────────────────────────────
function FeedView({profile,myLeagues,isActive}:any){
  const [posts,setPosts]=useState<any[]>([]);const [loading,setLoading]=useState(true);
  const [newPost,setNewPost]=useState("");const [selectedLeagueId,setSelectedLeagueId]=useState(myLeagues[0]?.id||"");
  const [uploading,setUploading]=useState(false);const [mediaFile,setMediaFile]=useState<File|null>(null);const [mediaPreview,setMediaPreview]=useState<string|null>(null);
  const [editingPost,setEditingPost]=useState<string|null>(null);const [editContent,setEditContent]=useState("");
  const fileRef=useRef<HTMLInputElement>(null);
  useEffect(()=>{if(isActive)loadPosts();},[isActive]);
  const loadPosts=async()=>{
    if(!db||myLeagues.length===0){setLoading(false);return;}setLoading(true);
    const name=profile.display_name;
    const[{data:friendData},{data:postsData}]=await Promise.all([db.from("friends").select("requester_name,recipient_name").or(`requester_name.ilike.${name},recipient_name.ilike.${name}`).eq("status","accepted"),db.from("posts").select("*").in("league_id",myLeagues.map((l:any)=>l.id)).order("created_at",{ascending:false})]);
    const mutual=new Set<string>([name.toLowerCase()]);(friendData||[]).forEach((f:any)=>{mutual.add(f.requester_name.toLowerCase());mutual.add(f.recipient_name.toLowerCase());});
    setPosts((postsData||[]).filter((p:any)=>mutual.has(p.author_name.toLowerCase())));setLoading(false);
  };
  const getLeagueName=(id:string)=>myLeagues.find((l:any)=>l.id===id)?.name||"";
  const timeAgo=(ts:string)=>{const diff=Date.now()-new Date(ts).getTime();const m=Math.floor(diff/60000),h=Math.floor(m/60),d=Math.floor(h/24);if(d>0)return`${d}d`;if(h>0)return`${h}h`;if(m>0)return`${m}m`;return"now";};
  const handlePost=async()=>{
    if(!db||(!newPost.trim()&&!mediaFile)||!selectedLeagueId)return;setUploading(true);
    try{let mu=null,mt=null;if(mediaFile){const ext=mediaFile.name.split('.').pop();const path=`${selectedLeagueId}/${Date.now()}.${ext}`;const{error}=await db.storage.from("posts").upload(path,mediaFile);if(!error){const{data:ud}=db.storage.from("posts").getPublicUrl(path);mu=ud.publicUrl;mt=mediaFile.type.startsWith("video")?"video":"image";}}await db.from("posts").insert({league_id:selectedLeagueId,author_name:profile.display_name,content:newPost.trim()||null,media_url:mu,media_type:mt});setNewPost("");setMediaFile(null);setMediaPreview(null);await loadPosts();}finally{setUploading(false);}
  };
  const isCommForLeague=(lid:string)=>{const lg=myLeagues.find((l:any)=>l.id===lid);return lg&&lg.commissioner_name?.toLowerCase()===profile.display_name.toLowerCase();};
  return(
    <div style={{padding:"20px 16px",maxWidth:500,margin:"0 auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}><div style={{fontFamily:"'Playfair Display',serif",fontSize:22,color:"#fff"}}>Feed</div><div style={{color:"#555",fontSize:10,fontFamily:"'Space Mono',monospace"}}>you + friends</div></div>
      {myLeagues.length>0&&<Card style={{marginBottom:14}}>
        <div style={{display:"flex",gap:9,marginBottom:9}}><Avatar name={profile.display_name} url={profile.avatar_url} size={30}/><textarea value={newPost} onChange={e=>setNewPost(e.target.value)} placeholder="Share a moment..." style={{flex:1,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(201,168,76,0.2)",borderRadius:9,padding:9,color:"#fff",fontFamily:"'Space Mono',monospace",fontSize:11,resize:"none",height:58,outline:"none"}}/></div>
        {myLeagues.length>1&&<div style={{marginBottom:9}}><div style={{display:"flex",gap:5,flexWrap:"wrap"}}>{myLeagues.map((lg:any)=><button key={lg.id} onClick={()=>setSelectedLeagueId(lg.id)} style={{padding:"2px 8px",borderRadius:20,background:selectedLeagueId===lg.id?"rgba(201,168,76,0.2)":"rgba(255,255,255,0.04)",border:`1px solid ${selectedLeagueId===lg.id?"rgba(201,168,76,0.4)":"rgba(255,255,255,0.08)"}`,color:selectedLeagueId===lg.id?"#C9A84C":"#555",fontFamily:"'Space Mono',monospace",fontSize:9,cursor:"pointer"}}>{lg.name}</button>)}</div></div>}
        {mediaPreview&&<div style={{position:"relative",marginBottom:9}}>{mediaFile?.type.startsWith("video")?<video src={mediaPreview} controls style={{width:"100%",borderRadius:9,maxHeight:240}}/>:<img src={mediaPreview} style={{width:"100%",borderRadius:9,maxHeight:240,objectFit:"cover"}}/>}<button onClick={()=>{setMediaFile(null);setMediaPreview(null);}} style={{position:"absolute",top:5,right:5,background:"rgba(0,0,0,0.7)",border:"none",borderRadius:"50%",color:"#fff",width:24,height:24,cursor:"pointer",fontSize:12}}>×</button></div>}
        <div style={{display:"flex",gap:7,alignItems:"center"}}><button onClick={()=>fileRef.current?.click()} style={{padding:"5px 10px",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:20,color:"#888",fontFamily:"'Space Mono',monospace",fontSize:9,cursor:"pointer"}}>📷</button><input ref={fileRef} type="file" accept="image/*,video/*" onChange={e=>{const f=e.target.files?.[0];if(f){setMediaFile(f);setMediaPreview(URL.createObjectURL(f));}}} style={{display:"none"}}/><button onClick={handlePost} disabled={uploading||(!newPost.trim()&&!mediaFile)} style={{marginLeft:"auto",padding:"5px 14px",background:(!newPost.trim()&&!mediaFile)||uploading?"rgba(255,255,255,0.06)":"linear-gradient(135deg,#C9A84C,#E8C56A)",border:"none",borderRadius:20,color:(!newPost.trim()&&!mediaFile)||uploading?"#444":"#0A0A0A",fontFamily:"'Space Mono',monospace",fontWeight:700,fontSize:10,cursor:"pointer",display:"flex",alignItems:"center",gap:5}}>{uploading?<Spinner size={11}/>:"POST"}</button></div>
      </Card>}
      {loading&&<div style={{display:"flex",justifyContent:"center",padding:36}}><Spinner/></div>}
      {!loading&&posts.length===0&&<Card><div style={{textAlign:"center",padding:"24px 0",color:"#555",fontFamily:"'Space Mono',monospace",fontSize:11}}>No posts yet.<br/>Add friends from league standings!</div></Card>}
      {posts.map((post:any)=>{
        const isMine=post.author_name.toLowerCase()===profile.display_name.toLowerCase();const canEdit=isMine||isCommForLeague(post.league_id);
        return<Card key={post.id} style={{marginBottom:11}}>
          <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:9}}><Avatar name={post.author_name} size={30}/><div style={{flex:1}}><div style={{color:"#fff",fontSize:13,fontWeight:600}}>{post.author_name}</div><div style={{display:"flex",gap:7,alignItems:"center",marginTop:1}}><span style={{color:"#C9A84C",fontSize:9,fontFamily:"'Space Mono',monospace",background:"rgba(201,168,76,0.1)",padding:"1px 6px",borderRadius:9}}>{getLeagueName(post.league_id)}</span><span style={{color:"#555",fontSize:9,fontFamily:"'Space Mono',monospace"}}>{timeAgo(post.created_at)}</span></div></div>{canEdit&&<div style={{display:"flex",gap:5}}>{isMine&&<button onClick={()=>{setEditingPost(post.id);setEditContent(post.content||"");}} style={{background:"none",border:"none",color:"#555",fontSize:10,cursor:"pointer",fontFamily:"'Space Mono',monospace"}}>EDIT</button>}<button onClick={async()=>{if(!db)return;await db.from("posts").delete().eq("id",post.id);await loadPosts();}} style={{background:"none",border:"none",color:"#E05555",fontSize:10,cursor:"pointer",fontFamily:"'Space Mono',monospace"}}>DEL</button></div>}</div>
          {editingPost===post.id?<div><textarea value={editContent} onChange={e=>setEditContent(e.target.value)} style={{width:"100%",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(201,168,76,0.2)",borderRadius:9,padding:9,color:"#fff",fontFamily:"'Space Mono',monospace",fontSize:11,resize:"none",height:58,outline:"none",marginBottom:7}}/><div style={{display:"flex",gap:7}}><button onClick={()=>setEditingPost(null)} style={{padding:"5px 12px",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:20,color:"#888",fontFamily:"'Space Mono',monospace",fontSize:10,cursor:"pointer"}}>Cancel</button><button onClick={async()=>{if(!db)return;await db.from("posts").update({content:editContent}).eq("id",post.id);setEditingPost(null);await loadPosts();}} style={{padding:"5px 12px",background:"rgba(201,168,76,0.15)",border:"1px solid rgba(201,168,76,0.3)",borderRadius:20,color:"#C9A84C",fontFamily:"'Space Mono',monospace",fontSize:10,cursor:"pointer"}}>Save</button></div></div>
          :<>{post.content&&<div style={{color:"#ccc",fontSize:12,lineHeight:1.6,marginBottom:post.media_url?9:0}}>{post.content}</div>}{post.media_url&&(post.media_type==="video"?<video src={post.media_url} controls style={{width:"100%",borderRadius:9,maxHeight:320}}/>:<img src={post.media_url} style={{width:"100%",borderRadius:9,maxHeight:320,objectFit:"cover"}}/>)}</>}
        </Card>;
      })}
    </div>
  );
}

// ─── WIPE STATS BUTTON ─────────────────────────────────
function WipeStatsButton({profile,onWiped}:any){
  const [confirm,setConfirm]=useState(false);const [wiping,setWiping]=useState(false);
  const handleWipe=async()=>{
    if(!db)return;setWiping(true);
    try{
      await db.from("players").update({total_profit:0,session_count:0,wins:0,best_night:0,streak:0,chicken_dinners:0,time_played_seconds:0}).ilike("name",profile.display_name);
      await db.from("profiles").update({global_total_profit:0,global_sessions:0,global_wins:0,global_time_seconds:0,chicken_dinners:0}).eq("id",profile.id);
      setConfirm(false);onWiped();
    }finally{setWiping(false);}
  };
  if(!confirm)return<Card style={{marginBottom:10,border:"1px solid rgba(224,85,85,0.15)",background:"rgba(224,85,85,0.04)"}}><div style={{color:"#E05555",fontSize:10,fontFamily:"'Space Mono',monospace",letterSpacing:2,marginBottom:6}}>DANGER ZONE</div><div style={{color:"#666",fontSize:11,lineHeight:1.6,marginBottom:10}}>Reset all your stats to zero across every league. Your leagues, friends, and history are not affected — only your numbers.</div><button onClick={()=>setConfirm(true)} style={{width:"100%",padding:"10px 0",background:"rgba(224,85,85,0.06)",border:"1px solid rgba(224,85,85,0.2)",borderRadius:9,color:"#E05555",fontFamily:"'Space Mono',monospace",fontSize:11,letterSpacing:1.5,cursor:"pointer"}}>WIPE MY STATS</button></Card>;
  return<Card style={{marginBottom:10,border:"1px solid rgba(224,85,85,0.4)",background:"rgba(224,85,85,0.06)"}}><div style={{color:"#E05555",fontSize:13,textAlign:"center",lineHeight:1.6,marginBottom:14}}>Are you sure? This will zero out your profit, wins, sessions, and chicken dinners everywhere. Cannot be undone.</div><div style={{display:"flex",gap:9}}><button onClick={()=>setConfirm(false)} style={{flex:1,padding:"11px 0",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:9,color:"#888",fontFamily:"'Space Mono',monospace",fontSize:12,cursor:"pointer"}}>CANCEL</button><button onClick={handleWipe} disabled={wiping} style={{flex:1,padding:"11px 0",background:"rgba(224,85,85,0.2)",border:"1px solid rgba(224,85,85,0.4)",borderRadius:9,color:"#E05555",fontFamily:"'Space Mono',monospace",fontWeight:700,fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>{wiping?<Spinner size={14}/>:"WIPE STATS"}</button></div></Card>;
}

// ─── PROFILE TAB ───────────────────────────────────────
function ProfileTabView({profile,myLeagues,isSelf,externalName,onFriends,onLogout,onSendFriendRequest}:any){
  const [allStats,setAllStats]=useState<any>(null);const [loading,setLoading]=useState(true);
  const [friendCount,setFriendCount]=useState(0);const [editing,setEditing]=useState(false);
  const [newName,setNewName]=useState(profile?.display_name||"");const [savingName,setSavingName]=useState(false);
  const [uploadingAvatar,setUploadingAvatar]=useState(false);const [msg,setMsg]=useState("");
  const fileRef=useRef<HTMLInputElement>(null);
  const displayName=isSelf?profile.display_name:(externalName||profile.display_name);
  useEffect(()=>{loadStats();},[displayName]);
  const loadStats=async()=>{
    if(!db||!displayName)return;setLoading(true);
    const[{data:rows},{data:fd}]=await Promise.all([db.from("players").select("total_profit,session_count,wins,best_night,time_played_seconds,chicken_dinners").ilike("name",displayName),db.from("friends").select("id").or(`requester_name.ilike.${displayName},recipient_name.ilike.${displayName}`).eq("status","accepted")]);
    setFriendCount((fd||[]).length);
    if(!rows||rows.length===0){setAllStats({total_profit:0,sessions:0,wins:0,best_night:0,leagues:0,time_seconds:0,chicken_dinners:0,avg:0,losses:0});setLoading(false);return;}
    const tp=rows.reduce((a:number,p:any)=>a+(p.total_profit||0),0);const s=rows.reduce((a:number,p:any)=>a+(p.session_count||0),0);const w=rows.reduce((a:number,p:any)=>a+(p.wins||0),0);
    setAllStats({total_profit:tp,sessions:s,wins:w,losses:s-w,best_night:Math.max(0,...rows.map((p:any)=>p.best_night||0)),leagues:rows.length,time_seconds:rows.reduce((a:number,p:any)=>a+(p.time_played_seconds||0),0),chicken_dinners:rows.reduce((a:number,p:any)=>a+(p.chicken_dinners||0),0),avg:s>0?tp/s:0});
    setLoading(false);
  };
  const handleSaveName=async()=>{if(!db||!newName.trim()||newName.trim()===profile.display_name)return;setSavingName(true);const{error}=await db.from("profiles").update({display_name:newName.trim()}).eq("id",profile.id);if(!error){bustAvatarCache(profile.display_name,profile.avatar_url);bustAvatarCache(newName.trim(),profile.avatar_url);profile.display_name=newName.trim();setMsg("Name updated!");setTimeout(()=>setMsg(""),3000);}setSavingName(false);};
  const handleAvatar=async(e:any)=>{const f=e.target.files?.[0];if(!f||!db)return;setUploadingAvatar(true);try{const ext=f.name.split('.').pop();const path=`${profile.id}/avatar.${ext}`;await db.storage.from("avatars").upload(path,f,{upsert:true});const{data:ud}=db.storage.from("avatars").getPublicUrl(path);const url=ud.publicUrl+"?t="+Date.now();await db.from("profiles").update({avatar_url:url}).eq("id",profile.id);bustAvatarCache(profile.display_name,url);profile.avatar_url=url;setMsg("Photo updated!");setTimeout(()=>setMsg(""),3000);}finally{setUploadingAvatar(false);}};
  const isUp=(allStats?.total_profit||0)>=0;
  return(
    <div style={{padding:"20px 16px",maxWidth:500,margin:"0 auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:18}}>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:22,color:"#fff"}}>Profile</div>
        {isSelf&&<div style={{display:"flex",gap:7}}>
          <button onClick={onFriends} style={{padding:"5px 11px",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:20,color:"#888",fontFamily:"'Space Mono',monospace",fontSize:9,cursor:"pointer"}}>FRIENDS</button>
          <button onClick={()=>setEditing(!editing)} style={{padding:"5px 11px",background:editing?"rgba(201,168,76,0.15)":"rgba(255,255,255,0.04)",border:`1px solid ${editing?"rgba(201,168,76,0.3)":"rgba(255,255,255,0.1)"}`,borderRadius:20,color:editing?"#C9A84C":"#888",fontFamily:"'Space Mono',monospace",fontSize:9,cursor:"pointer"}}>EDIT</button>
        </div>}
        {!isSelf&&<button onClick={()=>onSendFriendRequest&&onSendFriendRequest(displayName)} style={{padding:"6px 14px",background:"rgba(201,168,76,0.1)",border:"1px solid rgba(201,168,76,0.3)",borderRadius:20,color:"#C9A84C",fontFamily:"'Space Mono',monospace",fontSize:9,cursor:"pointer",letterSpacing:1}}>+ ADD FRIEND</button>}
      </div>
      <div style={{textAlign:"center",marginBottom:18}}>
        <div style={{position:"relative",display:"inline-block"}}>
          <Avatar name={displayName} url={isSelf?profile.avatar_url:null} size={76}/>
          {isSelf&&editing&&<button onClick={()=>fileRef.current?.click()} style={{position:"absolute",bottom:0,right:0,width:26,height:26,borderRadius:"50%",background:"#C9A84C",border:"2px solid #0A0A0A",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:13}}>{uploadingAvatar?<Spinner size={11}/>:"📷"}</button>}
          {isSelf&&<input ref={fileRef} type="file" accept="image/*" onChange={handleAvatar} style={{display:"none"}}/>}
        </div>
        {isSelf&&editing?<div style={{marginTop:10,display:"flex",gap:7,justifyContent:"center",alignItems:"center"}}><input value={newName} onChange={e=>setNewName(e.target.value)} style={{...inp,width:200,fontSize:15,textAlign:"center" as const,fontFamily:"'Playfair Display',serif"}}/><button onClick={handleSaveName} disabled={savingName||!newName.trim()||newName.trim()===profile.display_name} style={{padding:"9px 12px",background:"rgba(201,168,76,0.15)",border:"1px solid rgba(201,168,76,0.3)",borderRadius:9,color:"#C9A84C",fontFamily:"'Space Mono',monospace",fontSize:10,cursor:"pointer"}}>{savingName?"...":"✓"}</button></div>:<div style={{fontFamily:"'Playfair Display',serif",fontSize:22,color:"#fff",marginTop:10}}>{displayName}</div>}
        {msg&&<div style={{color:"#4CAF8C",fontSize:10,fontFamily:"'Space Mono',monospace",marginTop:5}}>✓ {msg}</div>}
        <div style={{display:"flex",justifyContent:"center",gap:14,marginTop:6}}>
          <div style={{color:"#555",fontSize:10,fontFamily:"'Space Mono',monospace"}}>{allStats?.leagues||0} leagues</div>
          <div style={{color:"#555",fontSize:10,fontFamily:"'Space Mono',monospace"}}>{friendCount} friends</div>
        </div>
        {!loading&&allStats&&<><div style={{color:isUp?"#4CAF8C":"#E05555",fontSize:32,fontFamily:"'Space Mono',monospace",fontWeight:700,marginTop:10}}>{isUp?"+":""}${allStats.total_profit}</div><div style={{color:"#555",fontSize:10,fontFamily:"'Space Mono',monospace"}}>all-time profit</div></>}
        {loading&&<div style={{display:"flex",justifyContent:"center",marginTop:14}}><Spinner/></div>}
      </div>
      {!loading&&allStats&&<>
        <div style={{display:"flex",gap:7,marginBottom:9}}><StatBox label="Sessions" value={allStats.sessions}/><StatBox label="Wins" value={allStats.wins} accent="#4CAF8C"/><StatBox label="Win %" value={allStats.sessions>0?`${((allStats.wins/allStats.sessions)*100).toFixed(0)}%`:"—"} accent="#5577CC"/><StatBox label="Best Night" value={`$${allStats.best_night}`}/></div>
        <div style={{display:"flex",gap:7,marginBottom:14}}><StatBox label="Time Played" value={fmtSeconds(allStats.time_seconds)} accent="#888"/><StatBox label="🍗 Dinners" value={allStats.chicken_dinners} accent="#C9A84C"/><StatBox label="Avg/Game" value={allStats.sessions>0?`${allStats.avg>=0?"+":""}$${Math.abs(allStats.avg).toFixed(0)}`:"—"} accent={allStats.avg>=0?"#4CAF8C":"#E05555"}/></div>
        <Card style={{marginBottom:12}}>{([["All-time profit",`${isUp?"+":""}$${allStats.total_profit}`,isUp?"#4CAF8C":"#E05555"],["Sessions won",`${allStats.wins}`,"#4CAF8C"],["Sessions lost",`${allStats.losses}`,"#E05555"],["Biggest single win",`$${allStats.best_night}`,"#C9A84C"],["Chicken dinners 🍗",`${allStats.chicken_dinners}`,"#C9A84C"],["Time at the table",fmtSeconds(allStats.time_seconds),"#888"]] as any[]).map(([label,val,col]:any,i:number,arr:any[])=><div key={label} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:i<arr.length-1?"1px solid rgba(255,255,255,0.05)":"none"}}><span style={{color:"#555",fontFamily:"'Space Mono',monospace",fontSize:11}}>{label}</span><span style={{color:col,fontFamily:"'Space Mono',monospace",fontWeight:700,fontSize:12}}>{val}</span></div>)}</Card>
        {isSelf&&myLeagues.length>0&&<Card style={{marginBottom:12}}><div style={{color:"#888",fontSize:10,fontFamily:"'Space Mono',monospace",letterSpacing:2,marginBottom:11}}>MY LEAGUES</div>{myLeagues.map((lg:any,i:number)=><div key={lg.id} style={{display:"flex",alignItems:"center",gap:9,padding:"8px 0",borderBottom:i<myLeagues.length-1?"1px solid rgba(255,255,255,0.05)":"none"}}><div style={{width:30,height:30,borderRadius:7,background:"rgba(201,168,76,0.1)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>{lg.is_public?"🌍":"♠"}</div><div style={{flex:1}}><div style={{color:"#fff",fontSize:12}}>{lg.name}</div><div style={{color:"#555",fontSize:10,fontFamily:"'Space Mono',monospace"}}>{lg.season}</div></div>{lg.commissioner_id===lg._myUserId&&<span style={{fontSize:12}}>👑</span>}</div>)}</Card>}
        {isSelf&&editing&&<>
          <Card style={{marginBottom:10}}><div style={{color:"#888",fontSize:10,fontFamily:"'Space Mono',monospace",letterSpacing:2,marginBottom:6}}>ACCOUNT</div><div style={{color:"#555",fontSize:11,fontFamily:"'Space Mono',monospace",marginBottom:5}}>{profile.email}</div><div style={{color:"#444",fontSize:11,lineHeight:1.6}}>To change your password, sign out and use "Forgot password?"</div></Card>
          <WipeStatsButton profile={profile} onWiped={()=>{loadStats();setMsg("Stats wiped.");setTimeout(()=>setMsg(""),3000);}}/>
          <button onClick={onLogout} style={{width:"100%",padding:"13px 0",background:"rgba(224,85,85,0.08)",border:"1px solid rgba(224,85,85,0.25)",borderRadius:11,color:"#E05555",fontFamily:"'Space Mono',monospace",fontWeight:700,fontSize:12,letterSpacing:2,cursor:"pointer"}}>SIGN OUT</button>
        </>}
      </>}
    </div>
  );
}

// ─── FRIENDS ───────────────────────────────────────────
function FriendsView({profile,onBack,onViewFriendProfile}:any){
  const [friends,setFriends]=useState<any[]>([]);const [pending,setPending]=useState<any[]>([]);const [loading,setLoading]=useState(true);
  useEffect(()=>{if(!db)return;(async()=>{const name=profile.display_name;const{data}=await db.from("friends").select("*").or(`requester_name.ilike.${name},recipient_name.ilike.${name}`);const all=data||[];setFriends(all.filter((f:any)=>f.status==="accepted"));setPending(all.filter((f:any)=>f.status==="pending"&&f.recipient_name.toLowerCase()===name.toLowerCase()));setLoading(false);})();},[]);
  const accept=async(id:string)=>{if(!db)return;await db.from("friends").update({status:"accepted"}).eq("id",id);const{data}=await db.from("friends").select("*").or(`requester_name.ilike.${profile.display_name},recipient_name.ilike.${profile.display_name}`);const all=data||[];setFriends(all.filter((f:any)=>f.status==="accepted"));setPending(all.filter((f:any)=>f.status==="pending"&&f.recipient_name.toLowerCase()===profile.display_name.toLowerCase()));};
  const decline=async(id:string)=>{if(!db)return;await db.from("friends").delete().eq("id",id);setPending(p=>p.filter(f=>f.id!==id));};
  const getN=(f:any)=>f.requester_name.toLowerCase()===profile.display_name.toLowerCase()?f.recipient_name:f.requester_name;
  return(
    <div style={{padding:"20px 16px",maxWidth:500,margin:"0 auto"}}>
      <BackButton onBack={onBack}/><SectionTitle text="Friends"/>
      <div style={{color:"#555",fontSize:10,fontFamily:"'Space Mono',monospace",marginBottom:12}}>Add friends from league standings. Mutual friends appear in your feed.</div>
      {loading&&<div style={{display:"flex",justifyContent:"center",padding:32}}><Spinner/></div>}
      {!loading&&pending.length>0&&<div style={{marginBottom:18}}><div style={{color:"#888",fontSize:10,fontFamily:"'Space Mono',monospace",letterSpacing:2,marginBottom:9}}>PENDING ({pending.length})</div>{pending.map((f:any)=><Card key={f.id} style={{marginBottom:9,display:"flex",alignItems:"center",gap:11}}><Avatar name={f.requester_name} size={38}/><div style={{flex:1}}><div style={{color:"#fff",fontSize:13}}>{f.requester_name}</div><div style={{color:"#555",fontSize:10,fontFamily:"'Space Mono',monospace"}}>wants to be friends</div></div><div style={{display:"flex",gap:7}}><button onClick={()=>accept(f.id)} style={{padding:"4px 10px",background:"rgba(76,175,140,0.2)",border:"1px solid rgba(76,175,140,0.4)",borderRadius:20,color:"#4CAF8C",fontFamily:"'Space Mono',monospace",fontSize:10,cursor:"pointer"}}>Accept</button><button onClick={()=>decline(f.id)} style={{padding:"4px 10px",background:"rgba(224,85,85,0.1)",border:"1px solid rgba(224,85,85,0.3)",borderRadius:20,color:"#E05555",fontFamily:"'Space Mono',monospace",fontSize:10,cursor:"pointer"}}>Decline</button></div></Card>)}</div>}
      <div><div style={{color:"#888",fontSize:10,fontFamily:"'Space Mono',monospace",letterSpacing:2,marginBottom:9}}>FRIENDS ({friends.length})</div>{!loading&&friends.length===0&&<Card><div style={{textAlign:"center",padding:"20px 0",color:"#555",fontFamily:"'Space Mono',monospace",fontSize:11}}>No friends yet — tap players in league standings!</div></Card>}{friends.map((f:any)=>{const n=getN(f);return<Card key={f.id} style={{marginBottom:9,display:"flex",alignItems:"center",gap:11,cursor:"pointer"}} onClick={()=>onViewFriendProfile(n)}><Avatar name={n} size={38}/><div style={{flex:1}}><div style={{color:"#fff",fontSize:13}}>{n}</div><div style={{color:"#4CAF8C",fontSize:10,fontFamily:"'Space Mono',monospace"}}>● Friends</div></div><span style={{color:"#555",fontSize:17}}>›</span></Card>;})}</div>
    </div>
  );
}

// ─── PLAYER PROFILE ────────────────────────────────────
function PlayerProfileView({player,profile,onBack,onSendFriendRequest}:any){
  if(!player)return null;
  const isUp=player.total_profit>=0;const isSelf=player.name.toLowerCase()===profile.display_name.toLowerCase();const winRate=player.session_count>0?((player.wins/player.session_count)*100).toFixed(0):0;
  const badges:any[]=([player.session_count>=10&&{icon:"🃏",label:"10 Sessions"},player.wins>=3&&{icon:"🏆",label:"3x Winner"},player.total_profit>200&&{icon:"💰",label:"High Roller"},player.streak>1&&{icon:"🔥",label:`${player.streak} Streak`},(player.chicken_dinners||0)>0&&{icon:"🍗",label:`${player.chicken_dinners}× Chicken`}]).filter(Boolean) as any[];
  return(
    <div style={{padding:"20px 16px",maxWidth:500,margin:"0 auto"}}>
      <BackButton onBack={onBack}/>
      <div style={{textAlign:"center",marginBottom:18}}><Avatar name={player.name} size={68}/><div style={{fontFamily:"'Playfair Display',serif",fontSize:22,color:"#fff",marginTop:9}}>{player.name}</div><div style={{color:isUp?"#4CAF8C":"#E05555",fontSize:26,fontFamily:"'Space Mono',monospace",fontWeight:700,marginTop:3}}>{isUp?"+":""}${player.total_profit}</div><div style={{color:"#555",fontSize:10,fontFamily:"'Space Mono',monospace"}}>in this league</div>{!isSelf&&<button onClick={()=>onSendFriendRequest(player.name)} style={{marginTop:10,padding:"6px 18px",background:"rgba(201,168,76,0.1)",border:"1px solid rgba(201,168,76,0.3)",borderRadius:20,color:"#C9A84C",fontFamily:"'Space Mono',monospace",fontSize:10,cursor:"pointer",letterSpacing:1}}>+ ADD FRIEND</button>}</div>
      <div style={{display:"flex",gap:7,marginBottom:12}}><StatBox label="Sessions" value={player.session_count}/><StatBox label="Wins" value={player.wins} accent="#4CAF8C"/><StatBox label="Win %" value={`${winRate}%`} accent="#5577CC"/><StatBox label="Best" value={`$${player.best_night}`}/></div>
      {badges.length>0&&<Card style={{marginBottom:11}}><div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{badges.map((b:any,i:number)=><div key={i} style={{background:"rgba(201,168,76,0.1)",border:"1px solid rgba(201,168,76,0.25)",borderRadius:9,padding:"5px 10px",display:"flex",alignItems:"center",gap:4}}><span style={{fontSize:13}}>{b.icon}</span><span style={{color:"#C9A84C",fontSize:10,fontFamily:"'Space Mono',monospace"}}>{b.label}</span></div>)}</div></Card>}
      <Card>{([["Avg/session",`${isUp?"+":""}$${player.session_count>0?(player.total_profit/player.session_count).toFixed(0):0}`,isUp?"#4CAF8C":"#E05555"],["Biggest win",`$${player.best_night}`,"#C9A84C"],["Time in league",fmtSeconds(player.time_played_seconds||0),"#888"],["Win streak",`${player.streak}${player.streak>1?" 🔥":""}`, "#fff"]] as any[]).map(([label,val,col]:any,i:number,arr:any[])=><div key={label} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:i<arr.length-1?"1px solid rgba(255,255,255,0.05)":"none"}}><span style={{color:"#555",fontFamily:"'Space Mono',monospace",fontSize:11}}>{label}</span><span style={{color:col,fontFamily:"'Space Mono',monospace"}}>{val}</span></div>)}</Card>
    </div>
  );
}

// ─── BOTTOM NAV ────────────────────────────────────────
function BottomNav({activeTab,onTab}:{activeTab:Tab;onTab:(t:Tab)=>void}){
  return(
    <div style={{position:"fixed",bottom:0,left:0,right:0,background:"rgba(10,10,10,0.97)",borderTop:"1px solid rgba(201,168,76,0.15)",display:"flex",padding:"10px 0 20px",zIndex:100}}>
      {([{key:'league' as Tab,icon:'⬡',label:'League'},{key:'feed' as Tab,icon:'◈',label:'Feed'},{key:'profile' as Tab,icon:'👤',label:'Profile'}]).map(t=><button key={t.key} onClick={()=>onTab(t.key)} style={{flex:1,background:"none",border:"none",display:"flex",flexDirection:"column",alignItems:"center",gap:3,cursor:"pointer",color:activeTab===t.key?"#C9A84C":"#444"}}><span style={{fontSize:20}}>{t.icon}</span><span style={{fontFamily:"'Space Mono',monospace",fontSize:10,letterSpacing:1}}>{t.label}</span></button>)}
    </div>
  );
}

// ─── MAIN APP ──────────────────────────────────────────
export default function HomeGameApp(){
  const [bootstrapping,setBootstrapping]=useState(true);
  const [authUser,setAuthUser]=useState<any>(null);
  const [profile,setProfile]=useState<any>(null);
  const [myLeagues,setMyLeagues]=useState<any[]>([]);
  const [loadingLeagues,setLoadingLeagues]=useState(false);
  const [activeTab,setActiveTab]=useState<Tab>('league');
  const [lsv,setLsv]=useState<LSV>('home');
  const [currentLeague,setCurrentLeague]=useState<any>(null);
  const [players,setPlayers]=useState<any[]>([]);const [sessions,setSessions]=useState<any[]>([]);
  const [liveSession,setLiveSession]=useState<any>(null);const [liveEntries,setLiveEntries]=useState<any[]>([]);
  const [selectedPlayer,setSelectedPlayer]=useState<any>(null);const [selectedSession,setSelectedSession]=useState<any>(null);
  const [psv,setPsv]=useState<PSV>('self');const [viewingFriend,setViewingFriend]=useState("");
  const [autoJoinCode,setAutoJoinCode]=useState("");

  const getPinned=useCallback(()=>JSON.parse(localStorage.getItem(`hg_pinned_${authUser?.id||'x'}`)||'[]'),[authUser]);
  const [pinnedIds,setPinnedIds]=useState<string[]>([]);
  const togglePin=(id:string)=>{const cur=getPinned();let next:string[];if(cur.includes(id)){next=cur.filter((x:string)=>x!==id);}else if(cur.length<MAX_PINNED){next=[...cur,id];}else return;localStorage.setItem(`hg_pinned_${authUser?.id||'x'}`,JSON.stringify(next));setPinnedIds(next);};

  const [toast,setToast]=useState("");const [error,setError]=useState("");
  const showToast=(m:string)=>{setToast(m);setTimeout(()=>setToast(""),3000);};
  const showError=(m:string)=>{setError(m);setTimeout(()=>setError(""),4000);};
  const isComm=currentLeague?(authUser?.id===currentLeague.commissioner_id||profile?.display_name?.toLowerCase()===currentLeague.commissioner_name?.toLowerCase()):false;

  // Check URL for ?join=CODE invite link
  useEffect(()=>{
    const params=new URLSearchParams(window.location.search);
    const joinCode=params.get('join');
    if(joinCode){setAutoJoinCode(joinCode.toUpperCase());window.history.replaceState({},'',window.location.pathname);}
  },[]);

  // Auto-navigate to join when we have a code and user is loaded
  useEffect(()=>{
    if(autoJoinCode&&profile){setLsv('joinCreate');setActiveTab('league');}
  },[autoJoinCode,profile]);

  useEffect(()=>{
    if(!db){setBootstrapping(false);return;}
    // Timeout fallback — if session check hangs for 8s, bail to login screen
    const timeout=setTimeout(()=>setBootstrapping(false),8000);
    db.auth.getSession().then(async({data:{session}})=>{clearTimeout(timeout);if(session?.user){setAuthUser(session.user);setPinnedIds(JSON.parse(localStorage.getItem(`hg_pinned_${session.user.id}`)||'[]'));await init(session.user);}else setBootstrapping(false);}).catch(()=>{clearTimeout(timeout);setBootstrapping(false);});
    const{data:{subscription}}=db.auth.onAuthStateChange(async(_,session)=>{if(session?.user){setAuthUser(session.user);setPinnedIds(JSON.parse(localStorage.getItem(`hg_pinned_${session.user.id}`)||'[]'));await init(session.user);}else{setAuthUser(null);setProfile(null);setBootstrapping(false);}});
    return()=>subscription.unsubscribe();
  },[]);

  const init=async(user:any)=>{
    if(!db)return;
    try{
      const{data,error}=await db.from("profiles").select("id,display_name,email,avatar_url,opt_in_global").eq("id",user.id).single();
      if(data&&!error){
        setProfile({...data,email:user.email});
        if(data.avatar_url)bustAvatarCache(data.display_name,data.avatar_url);
        const leagues=await loadMyLeagues(data.display_name,user.id);
        await requestNotifPermission();
        if(leagues)setupRealtime(leagues,data.display_name);
      }
      // if no profile row exists, show setup screen — this is intentional for new users
    }catch(e){
      // on fetch error, still clear bootstrapping so user sees login, not frozen screen
    }
    setBootstrapping(false);
  };

  const loadMyLeagues=async(displayName:string,userId:string)=>{
    if(!db)return;setLoadingLeagues(true);
    try{
      const{data:rows}=await db.from("players").select("league_id").ilike("name",displayName);
      const dbIds=(rows||[]).map((r:any)=>r.league_id);
      const stored=JSON.parse(localStorage.getItem(`hg_leagues_${userId}`)||'[]');
      const allIds=[...new Set([...dbIds,...stored])];
      if(allIds.length>0){const{data:lgs}=await db.from("leagues").select("id,name,description,code,season,season_length,buy_in,is_public,location_name,commissioner_id,commissioner_name,max_players").in("id",allIds);const mapped=(lgs||[]).map((lg:any)=>({...lg,_myUserId:userId}));setMyLeagues(mapped);return mapped;}
      else{setMyLeagues([]);return[];}
    }finally{setLoadingLeagues(false);}
  };

  const loadLeagueData=async(lgId:string)=>{
    if(!db)return;
    const[{data:pData},{data:sData},{data:lsData}]=await Promise.all([db.from("players").select("*").eq("league_id",lgId).order("total_profit",{ascending:false}),db.from("sessions").select("id,pot,winner_name,buy_in_amount,duration_seconds,created_at,chicken_dinner_name,is_live,notes").eq("league_id",lgId).order("created_at",{ascending:false}),db.from("sessions").select("*").eq("league_id",lgId).eq("is_live",true).limit(1)]);
    setPlayers(pData||[]);setSessions((sData||[]).filter((s:any)=>!s.is_live));
    if(lsData&&lsData.length>0){setLiveSession(lsData[0]);const{data:le}=await db!.from("live_entries").select("*").eq("session_id",lsData[0].id);setLiveEntries(le||[]);}
    else{setLiveSession(null);setLiveEntries([]);}
  };

  // Poll live session + banner on both views
  useEffect(()=>{
    if(!currentLeague||!['leagueDetail','liveSession'].includes(lsv))return;
    const t=setInterval(async()=>{
      if(!db||!currentLeague)return;
      if(lsv==='leagueDetail'){
        const{data:lsData}=await db.from("sessions").select("*").eq("league_id",currentLeague.id).eq("is_live",true).limit(1);
        if(lsData&&lsData.length>0&&lsData[0].id!==liveSession?.id){setLiveSession(lsData[0]);const{data:le}=await db.from("live_entries").select("*").eq("session_id",lsData[0].id);setLiveEntries(le||[]);}
        else if((!lsData||lsData.length===0)&&liveSession){setLiveSession(null);setLiveEntries([]);}
        else if(liveSession){const{data:le}=await db.from("live_entries").select("*").eq("session_id",liveSession.id);setLiveEntries(le||[]);}
      }
      if(lsv==='liveSession'&&liveSession){const{data}=await db.from("live_entries").select("*").eq("session_id",liveSession.id);setLiveEntries(data||[]);}
    },8000);
    return()=>clearInterval(t);
  },[currentLeague,lsv,liveSession]);

  const joinLeague=async(lg:any)=>{
    if(!db||!authUser||!profile)return;
    const{data:cp}=await db.from("players").select("id").eq("league_id",lg.id);
    if((cp||[]).length>=(lg.max_players||12)){showError(`League is full (${lg.max_players||12} max).`);return;}
    const{data:ex}=await db.from("players").select("id").eq("league_id",lg.id).ilike("name",profile.display_name).limit(1);
    if(!ex||ex.length===0)await db.from("players").insert({league_id:lg.id,name:profile.display_name,total_profit:0,session_count:0,wins:0,best_night:0,streak:0,chicken_dinners:0,time_played_seconds:0});
    const stored=JSON.parse(localStorage.getItem(`hg_leagues_${authUser.id}`)||'[]');if(!stored.includes(lg.id)){stored.push(lg.id);localStorage.setItem(`hg_leagues_${authUser.id}`,JSON.stringify(stored));}
    await loadMyLeagues(profile.display_name,authUser.id);setCurrentLeague({...lg,_myUserId:authUser.id});await loadLeagueData(lg.id);
    showToast(`Joined ${lg.name}! 🎉`);setLsv('leagueDetail');
  };

  const handleJoinCreate=async({tab,code,leagueName,description,buyIn,season,seasonLength,isPublic,locationName,maxPlayers}:any)=>{
    if(!db||!authUser||!profile)return;setLoadingLeagues(true);
    try{
      if(tab==="join"){
        const{data:lgs}=await db.from("leagues").select("*").eq("code",code.trim()).limit(1);
        if(!lgs||lgs.length===0){showError("League not found.");return;}
        const lg=lgs[0];const{data:ex}=await db.from("players").select("id").eq("league_id",lg.id).ilike("name",profile.display_name).limit(1);
        if(ex&&ex.length>0){showError("You're already in this league!");return;}
        await joinLeague(lg);setAutoJoinCode("");
      }else{
        const code2=profile.display_name.toUpperCase().replace(/\s/g,"").slice(0,3)+Math.floor(1000+Math.random()*9000);
        const{data:lg,error:lgErr}=await db.from("leagues").insert({name:leagueName,description:description||null,code:code2,commissioner_name:profile.display_name,commissioner_id:authUser.id,buy_in:buyIn,season,season_length:seasonLength||0,is_public:isPublic||false,location_name:locationName||null,max_players:maxPlayers||12}).select().single();
        if(lgErr)throw lgErr;
        await db.from("players").insert({league_id:lg.id,name:profile.display_name,total_profit:0,session_count:0,wins:0,best_night:0,streak:0,chicken_dinners:0,time_played_seconds:0});
        const stored=JSON.parse(localStorage.getItem(`hg_leagues_${authUser.id}`)||'[]');stored.push(lg.id);localStorage.setItem(`hg_leagues_${authUser.id}`,JSON.stringify(stored));
        await loadMyLeagues(profile.display_name,authUser.id);setCurrentLeague({...lg,_myUserId:authUser.id});await loadLeagueData(lg.id);
        showToast(`${leagueName} created! 🎉`);setLsv('leagueDetail');
      }
    }catch(e:any){showError(e.message||"Something went wrong.");}finally{setLoadingLeagues(false);}
  };

  const handleLeave=async()=>{
    if(!db||!currentLeague||!profile||!authUser)return;
    if(isComm){if(players.length<=1){if(window.confirm("You're the only member. Delete this league?"))await db.from("leagues").delete().eq("id",currentLeague.id);}else{setLsv('transferComm');}return;}
    if(!window.confirm(`Leave ${currentLeague.name}?`))return;
    const mp=players.find((p:any)=>p.name.toLowerCase()===profile.display_name.toLowerCase());if(mp)await db.from("players").delete().eq("id",mp.id);
    const stored:string[]=JSON.parse(localStorage.getItem(`hg_leagues_${authUser.id}`)||'[]');localStorage.setItem(`hg_leagues_${authUser.id}`,JSON.stringify(stored.filter((id:string)=>id!==currentLeague.id)));
    await loadMyLeagues(profile.display_name,authUser.id);showToast("You left the league.");setCurrentLeague(null);setLsv('home');
  };

  const handleTransferAndLeave=async()=>{
    if(!db||!currentLeague||!profile||!authUser)return;
    const mp=players.find((p:any)=>p.name.toLowerCase()===profile.display_name.toLowerCase());if(mp)await db.from("players").delete().eq("id",mp.id);
    const stored:string[]=JSON.parse(localStorage.getItem(`hg_leagues_${authUser.id}`)||'[]');localStorage.setItem(`hg_leagues_${authUser.id}`,JSON.stringify(stored.filter((id:string)=>id!==currentLeague.id)));
    await loadMyLeagues(profile.display_name,authUser.id);showToast("League transferred. You left.");setCurrentLeague(null);setLsv('home');
  };

  const handleStartSession=async({selectedIds,sessionBuyIn,sessionNotes}:any)=>{
    if(!db||!currentLeague||!profile)return;
    const{data:session,error}=await db.from("sessions").insert({league_id:currentLeague.id,pot:0,status:"live",buy_in_amount:sessionBuyIn,is_live:true,started_at:new Date().toISOString(),notes:sessionNotes||null}).select().single();
    if(error){showError(error.message);return;}
    const sel=players.filter((p:any)=>selectedIds.includes(p.id));
    await db.from("live_entries").insert(sel.map((p:any)=>({session_id:session.id,player_id:p.id,player_name:p.name,buy_in:sessionBuyIn,rebuys:0,cash_out:0})));
    await db.from("posts").insert({league_id:currentLeague.id,author_name:profile.display_name,content:`🃏 Game is live! Buy-in: $${sessionBuyIn} · ${sel.length} players. Join from the league tab!${sessionNotes?` — ${sessionNotes}`:""}`});
    setLiveSession(session);const{data:le}=await db.from("live_entries").select("*").eq("session_id",session.id);setLiveEntries(le||[]);
    showToast("Session started!");setLsv('liveSession');
  };

  const handleSubmitEntry=async({player_id,player_name,buy_in,rebuys,cash_out}:any)=>{
    if(!db||!liveSession)return;
    await db.from("live_entries").upsert({session_id:liveSession.id,player_id,player_name,buy_in,rebuys,cash_out,updated_at:new Date().toISOString()},{onConflict:"session_id,player_id"});
    const{data}=await db.from("live_entries").select("*").eq("session_id",liveSession.id);setLiveEntries(data||[]);showToast("Stats submitted!");
  };

  const handleEndSession=async({entries,elapsed,chickenDinner}:any)=>{
    if(!db||!currentLeague||!liveSession)return;
    try{
      const pot=entries.reduce((a:number,e:any)=>a+(e.buy_in+e.rebuys),0);
      const top=[...entries].sort((a:any,b:any)=>b.profit-a.profit)[0];
      const winnerName=players.find((p:any)=>p.id===top.player_id)?.name||top.player_name;
      await db.from("sessions").update({is_live:false,pot,winner_name:winnerName,duration_seconds:elapsed,status:"approved",chicken_dinner_name:chickenDinner||null}).eq("id",liveSession.id);
      await db.from("session_entries").insert(entries.map((e:any)=>({session_id:liveSession.id,player_id:e.player_id,buy_in:e.buy_in,rebuys:e.rebuys,cash_out:e.cash_out,profit:e.profit})));
      for(const e of entries){
        const p:any=players.find((pl:any)=>pl.id===e.player_id);if(!p)continue;
        const won=e.profit>0?1:0;const isC=chickenDinner&&e.player_name.toLowerCase()===chickenDinner.toLowerCase()?1:0;
        await db.from("players").update({total_profit:(p.total_profit||0)+e.profit,session_count:(p.session_count||0)+1,wins:(p.wins||0)+won,best_night:e.profit>(p.best_night||0)?e.profit:(p.best_night||0),streak:won?(p.streak||0)+1:0,chicken_dinners:(p.chicken_dinners||0)+isC,time_played_seconds:(p.time_played_seconds||0)+elapsed}).eq("id",e.player_id);
      }
      setLiveSession(null);setLiveEntries([]);await loadLeagueData(currentLeague.id);showToast("Session saved! ✓");setLsv('leagueDetail');
    }catch(e:any){showError(e.message||"Failed to save.");}
  };

  const sendFriendRequest=async(name:string)=>{
    if(!db||!profile)return;const myName=profile.display_name;
    const{data:existing}=await db.from("friends").select("id").or(`and(requester_name.ilike.${myName},recipient_name.ilike.${name}),and(requester_name.ilike.${name},recipient_name.ilike.${myName})`).limit(1);
    if(existing&&existing.length>0){showError("Already friends or request already sent!");return;}
    const{error}=await db.from("friends").insert({requester_name:myName,recipient_name:name,status:"pending"});
    if(error)showError("Couldn't send request.");else showToast(`Request sent to ${name}!`);
  };

  const handleLogout=async()=>{if(!db)return;await db.auth.signOut();setCurrentLeague(null);setPlayers([]);setSessions([]);setMyLeagues([]);setLsv('home');setActiveTab('league');};

  if(!db)return<SetupView/>;
  if(bootstrapping)return<LoadingScreen/>;
  if(!authUser)return<AuthView/>;
  if(!profile)return<SetupProfileView user={authUser} onDone={(p:any)=>{setProfile(p);loadMyLeagues(p.display_name,authUser.id);}}/>;

  const renderLeague=()=>{
    if(lsv==='joinCreate')return<JoinCreateView profile={profile} loading={loadingLeagues} onBack={()=>{setLsv('home');setAutoJoinCode("");}} onEnter={handleJoinCreate} prefillCode={autoJoinCode}/>;
    if(lsv==='publicLeagues')return<PublicLeaguesView onBack={()=>setLsv('home')} onJoin={joinLeague}/>;
    if(lsv==='handRankings')return<HandRankingsView onBack={()=>setLsv('leagueDetail')}/>;
    if(lsv==='seasonRecap'&&currentLeague)return<SeasonRecapView league={currentLeague} players={players} sessions={sessions} onBack={()=>setLsv('leagueDetail')}/>;
    if(lsv==='leagueDetail'&&currentLeague)return<LeagueDetailView league={currentLeague} players={players} sessions={sessions} profile={profile} isCommissioner={isComm} onViewPlayer={(p:any)=>{setSelectedPlayer(p);setLsv('playerProfile');}} onStartSession={()=>liveSession?setLsv('liveSession'):setLsv('newSession')} onBack={()=>{setCurrentLeague(null);setLsv('home');}} onCommSettings={()=>setLsv('commSettings')} liveSession={liveSession} onLeaveLeague={handleLeave} onViewHandRankings={()=>setLsv('handRankings')} onViewSession={(s:any)=>{setSelectedSession(s);setLsv('sessionDetail');}} onSeasonRecap={()=>setLsv('seasonRecap')} showToast={showToast}/>;
    if(lsv==='sessionDetail'&&selectedSession&&currentLeague)return<SessionDetailView session={selectedSession} league={currentLeague} players={players} isCommissioner={isComm} onBack={()=>setLsv('leagueDetail')} onSaved={()=>loadLeagueData(currentLeague.id)} showToast={showToast} showError={showError}/>;
    if(lsv==='playerProfile'&&selectedPlayer)return<PlayerProfileView player={selectedPlayer} profile={profile} onBack={()=>setLsv('leagueDetail')} onSendFriendRequest={sendFriendRequest}/>;
    if(lsv==='newSession'&&currentLeague)return<NewSessionView league={currentLeague} players={players} sessions={sessions} onStart={handleStartSession} onBack={()=>setLsv('leagueDetail')}/>;
    if(lsv==='liveSession'&&currentLeague&&liveSession)return<LiveSessionView session={liveSession} liveEntries={liveEntries} players={players} profile={profile} isCommissioner={isComm} league={currentLeague} onBack={()=>setLsv('leagueDetail')} onSubmitEntry={handleSubmitEntry} onEndSession={handleEndSession}/>;
    if(lsv==='commSettings'&&currentLeague&&isComm)return<CommSettingsView league={currentLeague} players={players} onBack={()=>setLsv('leagueDetail')} onLeagueUpdated={(lg:any)=>{setCurrentLeague({...lg,_myUserId:authUser?.id});loadLeagueData(lg.id);}} onLeagueDeleted={()=>{setCurrentLeague(null);loadMyLeagues(profile.display_name,authUser.id);setLsv('home');}} showToast={showToast} showError={showError}/>;
    if(lsv==='transferComm'&&currentLeague)return<TransferCommView league={currentLeague} players={players} profile={profile} onBack={()=>setLsv('leagueDetail')} onTransferred={handleTransferAndLeave}/>;
    return<LeagueHomeView profile={profile} myLeagues={myLeagues} loading={loadingLeagues} pinnedIds={pinnedIds} onSelectLeague={(lg:any)=>{setCurrentLeague(lg);loadLeagueData(lg.id);setLsv('leagueDetail');}} onJoinCreate={()=>setLsv('joinCreate')} onPublicLeagues={()=>setLsv('publicLeagues')} onTogglePin={togglePin}/>;
  };

  const renderProfile=()=>{
    if(psv==='friends')return<FriendsView profile={profile} onBack={()=>setPsv('self')} onViewFriendProfile={(n:string)=>{setViewingFriend(n);setPsv('friendProfile');}}/>;
    if(psv==='friendProfile')return<ProfileTabView profile={profile} myLeagues={myLeagues} isSelf={false} externalName={viewingFriend} onFriends={()=>setPsv('friends')} onLogout={handleLogout} onSendFriendRequest={sendFriendRequest}/>;
    return<ProfileTabView profile={profile} myLeagues={myLeagues} isSelf={true} onFriends={()=>setPsv('friends')} onLogout={handleLogout} onSendFriendRequest={sendFriendRequest}/>;
  };

  return(
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Space+Mono:wght@400;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        body,html{background:#0A0A0A;color:#fff;-webkit-font-smoothing:antialiased;overscroll-behavior-y:none;}
        input[type=number]{-moz-appearance:textfield;}
        input[type=number]::-webkit-inner-spin-button,input[type=number]::-webkit-outer-spin-button{-webkit-appearance:none;}
        input::placeholder,textarea::placeholder{color:#333!important;}
        select{appearance:none;-webkit-appearance:none;}
        @keyframes hg_spin{to{transform:rotate(360deg);}}
        @keyframes pulse{0%,100%{opacity:1;}50%{opacity:0.4;}}
        ::-webkit-scrollbar{width:3px;}::-webkit-scrollbar-thumb{background:#2a2a2a;border-radius:4px;}
      `}</style>
      <div style={{background:"#0A0A0A",minHeight:"100vh",paddingBottom:80}}>
        {toast&&<div style={{position:"fixed",top:20,left:"50%",transform:"translateX(-50%)",background:"rgba(76,175,140,0.95)",color:"#fff",padding:"10px 20px",borderRadius:30,fontFamily:"'Space Mono',monospace",fontSize:12,zIndex:999,maxWidth:"88vw",textAlign:"center"}}>{toast}</div>}
        {error&&<div style={{position:"fixed",top:20,left:"50%",transform:"translateX(-50%)",background:"rgba(224,85,85,0.95)",color:"#fff",padding:"10px 20px",borderRadius:30,fontFamily:"'Space Mono',monospace",fontSize:12,zIndex:999,maxWidth:"88vw",textAlign:"center"}}>{error}</div>}
        {activeTab==='league'&&renderLeague()}
        {activeTab==='feed'&&<FeedView profile={profile} myLeagues={myLeagues} isActive={activeTab==='feed'}/>}
        {activeTab==='profile'&&renderProfile()}
        <BottomNav activeTab={activeTab} onTab={t=>{setActiveTab(t);if(t==='profile')setPsv('self');}}/>
      </div>
    </>
  );
}