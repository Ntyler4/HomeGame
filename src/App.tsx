import { useState, useEffect, useRef } from "react";
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';
const db = (SUPABASE_URL !== 'YOUR_SUPABASE_URL') ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

// Active tab drives which "section" is showing
// Within the League tab, a sub-view stack is maintained
type Tab = 'league' | 'feed' | 'profile';

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

const MAX_PLAYER_OPTIONS = [5, 8, 12, 20, 50];
const HOURS_REQUIRED_GLOBAL = 100;
const MAX_PINNED = 3;

function fmtSeconds(s:number) {
  const h=Math.floor(s/3600),m=Math.floor((s%3600)/60);
  if(h>0)return`${h}h ${m}m`;return`${m}m`;
}

// ─── SHARED UI ─────────────────────────────────────────
function Avatar({ name, url, size=40 }:{ name:string; url?:string|null; size?:number }) {
  const colors=["#C9A84C","#4CAF8C","#E05555","#5577CC","#CC55AA"];
  const bg=colors[(name||"?").charCodeAt(0)%colors.length];
  if(url)return<img src={url} style={{ width:size,height:size,borderRadius:"50%",objectFit:"cover",flexShrink:0,border:"2px solid rgba(201,168,76,0.3)" }}/>;
  return<div style={{ width:size,height:size,borderRadius:"50%",background:bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Playfair Display',serif",fontWeight:700,fontSize:size*0.4,color:"#0D0D0D",flexShrink:0 }}>{(name||"?")[0].toUpperCase()}</div>;
}
function Card({ children, style={} }:any){return<div style={{ background:"rgba(255,255,255,0.04)",border:"1px solid rgba(201,168,76,0.2)",borderRadius:16,padding:20,...style }}>{children}</div>;}
function Badge({ text, color="#C9A84C" }:any){return<span style={{ background:`${color}22`,color,border:`1px solid ${color}44`,borderRadius:20,padding:"2px 10px",fontSize:11,fontFamily:"'Space Mono',monospace",letterSpacing:1 }}>{text}</span>;}
function StatBox({ label, value, accent="#C9A84C" }:any){return<div style={{ background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:12,padding:"11px 12px",flex:1,minWidth:55 }}><div style={{ color:"#666",fontSize:9,fontFamily:"'Space Mono',monospace",letterSpacing:1.5,textTransform:"uppercase",marginBottom:4 }}>{label}</div><div style={{ color:accent,fontSize:17,fontWeight:700,fontFamily:"'Playfair Display',serif" }}>{value}</div></div>;}
function Spinner({ size=24 }:any){return<div style={{ width:size,height:size,border:`2px solid rgba(201,168,76,0.2)`,borderTopColor:"#C9A84C",borderRadius:"50%",animation:"spin 0.7s linear infinite",flexShrink:0 }}/>;}
function LoadingScreen(){return<div style={{ minHeight:"100vh",background:"#0A0A0A",display:"flex",alignItems:"center",justifyContent:"center" }}><div style={{ textAlign:"center" }}><div style={{ position:"relative",width:64,height:64,margin:"0 auto 20px" }}><div style={{ position:"absolute",inset:0,border:"2px solid rgba(201,168,76,0.15)",borderTopColor:"#C9A84C",borderRadius:"50%",animation:"spin 0.7s linear infinite" }}/><div style={{ position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,color:"#C9A84C" }}>♠</div></div><div style={{ color:"#333",fontFamily:"'Space Mono',monospace",fontSize:11,letterSpacing:2 }}>LOADING</div></div></div>;}
function Toggle({ value, onChange, label, sub }:any){return<div onClick={()=>onChange(!value)} style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"13px 14px",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:12,cursor:"pointer",marginBottom:10 }}><div style={{ flex:1,paddingRight:12 }}><div style={{ color:"#fff",fontSize:13 }}>{label}</div>{sub&&<div style={{ color:"#555",fontSize:11,marginTop:2 }}>{sub}</div>}</div><div style={{ width:44,height:24,borderRadius:12,background:value?"#5577CC":"rgba(255,255,255,0.1)",position:"relative",transition:"background 0.2s",flexShrink:0 }}><div style={{ width:20,height:20,borderRadius:"50%",background:"#fff",position:"absolute",top:2,left:value?22:2,transition:"left 0.2s" }}/></div></div>;}
const inp:any={ width:"100%",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(201,168,76,0.25)",borderRadius:10,padding:"12px 16px",color:"#fff",fontSize:15,fontFamily:"'Space Mono',monospace",outline:"none",boxSizing:"border-box" };
function BackButton({ onBack }:any){return<button onClick={onBack} style={{ background:"none",border:"none",color:"#555",fontSize:22,cursor:"pointer",marginBottom:16,display:"block" }}>←</button>;}

// ─── SETUP (no db) ─────────────────────────────────────
function SetupView(){return<div style={{ minHeight:"100vh",background:"#0A0A0A",display:"flex",alignItems:"center",justifyContent:"center",padding:24 }}><Card style={{ maxWidth:420,width:"100%" }}><div style={{ color:"#E05555",fontFamily:"'Space Mono',monospace",fontSize:11,letterSpacing:1.5,marginBottom:12 }}>⚠ DATABASE NOT CONNECTED</div><div style={{ color:"#aaa",fontSize:13,lineHeight:1.8 }}>Open <span style={{ color:"#C9A84C" }}>App.tsx</span> and replace the placeholder Supabase credentials.</div></Card></div>;}

// ─── AUTH ──────────────────────────────────────────────
function AuthView(){
  const [tab,setTab]=useState<'login'|'signup'|'reset'>('login');
  const [email,setEmail]=useState("");const [pw,setPw]=useState("");
  const [loading,setLoading]=useState(false);const [msg,setMsg]=useState("");const [err,setErr]=useState("");
  const clear=()=>{setMsg("");setErr("");};
  const handle=async()=>{
    if(!db)return;setLoading(true);clear();
    if(tab==='login'){const{error}=await db.auth.signInWithPassword({email,password:pw});if(error)setErr(error.message);}
    else if(tab==='signup'){if(pw.length<6){setErr("Password must be 6+ characters.");setLoading(false);return;}const{error}=await db.auth.signUp({email,password:pw});if(error)setErr(error.message);else setMsg("Account created! Sign in now.");}
    else{const{error}=await db.auth.resetPasswordForEmail(email,{redirectTo:window.location.origin});if(error)setErr(error.message);else setMsg("Reset email sent!");}
    setLoading(false);
  };
  return(
    <div style={{ minHeight:"100vh",background:"#0A0A0A",display:"flex",alignItems:"center",justifyContent:"center",padding:24,position:"relative",overflow:"hidden" }}>
      <div style={{ position:"absolute",inset:0,background:"radial-gradient(ellipse 80% 60% at 50% 50%, rgba(20,60,30,0.4) 0%, transparent 70%)",pointerEvents:"none" }}/>
      <div style={{ width:"100%",maxWidth:400,position:"relative",zIndex:1 }}>
        <div style={{ textAlign:"center",marginBottom:36 }}>
          <div style={{ display:"flex",justifyContent:"center",gap:8,marginBottom:10 }}>{["♠","♥","♦","♣"].map((s,i)=><span key={i} style={{ fontSize:28,color:i%2===0?"#C9A84C":"#E05555" }}>{s}</span>)}</div>
          <div style={{ fontFamily:"'Playfair Display',serif",fontSize:42,fontWeight:900,color:"#C9A84C",letterSpacing:-1 }}>Home Game</div>
          <div style={{ color:"#555",fontSize:11,fontFamily:"'Space Mono',monospace",letterSpacing:2,marginTop:6 }}>YOUR LEAGUE. YOUR RULES.</div>
        </div>
        <Card style={{ padding:0,overflow:"hidden" }}>
          {tab!=='reset'
            ?<div style={{ display:"flex",borderBottom:"1px solid rgba(201,168,76,0.15)" }}>{(['login','signup'] as const).map(t=><button key={t} onClick={()=>{setTab(t);clear();}} style={{ flex:1,padding:"15px 0",background:"none",border:"none",color:tab===t?"#C9A84C":"#555",fontFamily:"'Space Mono',monospace",fontSize:12,letterSpacing:1.5,textTransform:"uppercase",cursor:"pointer",borderBottom:tab===t?"2px solid #C9A84C":"2px solid transparent" }}>{t==='login'?'Sign In':'Create Account'}</button>)}</div>
            :<div style={{ borderBottom:"1px solid rgba(201,168,76,0.15)",padding:"13px 20px",display:"flex",alignItems:"center",gap:10 }}><button onClick={()=>{setTab('login');clear();}} style={{ background:"none",border:"none",color:"#555",fontSize:18,cursor:"pointer" }}>←</button><span style={{ color:"#888",fontFamily:"'Space Mono',monospace",fontSize:12,letterSpacing:1.5 }}>RESET PASSWORD</span></div>}
          <div style={{ padding:26 }}>
            <div style={{ marginBottom:14 }}><label style={{ color:"#888",fontSize:11,fontFamily:"'Space Mono',monospace",letterSpacing:1.5,display:"block",marginBottom:7 }}>EMAIL</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@email.com" style={inp}/></div>
            {tab!=='reset'&&<div style={{ marginBottom:8 }}><label style={{ color:"#888",fontSize:11,fontFamily:"'Space Mono',monospace",letterSpacing:1.5,display:"block",marginBottom:7 }}>PASSWORD</label><input type="password" value={pw} onChange={e=>setPw(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handle()} placeholder={tab==='signup'?"At least 6 characters":"••••••••"} style={inp}/></div>}
            {tab==='login'&&<div style={{ textAlign:"right",marginBottom:18 }}><button onClick={()=>{setTab('reset');clear();}} style={{ background:"none",border:"none",color:"#555",fontFamily:"'Space Mono',monospace",fontSize:11,cursor:"pointer" }}>Forgot password?</button></div>}
            {tab!=='login'&&<div style={{ marginBottom:18 }}/>}
            {err&&<div style={{ background:"rgba(224,85,85,0.1)",border:"1px solid rgba(224,85,85,0.3)",borderRadius:8,padding:"10px 14px",color:"#E05555",fontFamily:"'Space Mono',monospace",fontSize:11,marginBottom:14,lineHeight:1.6 }}>{err}</div>}
            {msg&&<div style={{ background:"rgba(76,175,140,0.1)",border:"1px solid rgba(76,175,140,0.3)",borderRadius:8,padding:"10px 14px",color:"#4CAF8C",fontFamily:"'Space Mono',monospace",fontSize:11,marginBottom:14,lineHeight:1.6 }}>{msg}</div>}
            <button onClick={handle} disabled={loading||!email||(tab!=='reset'&&!pw)} style={{ width:"100%",padding:"14px 0",background:!loading&&email&&(tab==='reset'||pw)?"linear-gradient(135deg,#C9A84C,#E8C56A)":"rgba(255,255,255,0.08)",border:"none",borderRadius:12,color:!loading&&email&&(tab==='reset'||pw)?"#0A0A0A":"#444",fontFamily:"'Space Mono',monospace",fontWeight:700,fontSize:14,letterSpacing:2,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:10 }}>{loading?<Spinner size={18}/>:tab==='login'?"SIGN IN →":tab==='signup'?"CREATE ACCOUNT →":"SEND RESET EMAIL →"}</button>
          </div>
        </Card>
      </div>
    </div>
  );
}

function SetupProfileView({ user, onDone }:any){
  const [name,setName]=useState("");const [loading,setLoading]=useState(false);const [err,setErr]=useState("");
  const save=async()=>{if(!db||!name.trim())return;setLoading(true);const{error}=await db.from("profiles").upsert({id:user.id,display_name:name.trim(),email:user.email,opt_in_global:false,global_total_profit:0,global_sessions:0,global_wins:0,global_time_seconds:0,chicken_dinners:0});if(error){setErr(error.message);setLoading(false);return;}onDone({id:user.id,display_name:name.trim(),email:user.email,avatar_url:null,opt_in_global:false});};
  return(
    <div style={{ minHeight:"100vh",background:"#0A0A0A",display:"flex",alignItems:"center",justifyContent:"center",padding:24,position:"relative",overflow:"hidden" }}>
      <div style={{ position:"absolute",inset:0,background:"radial-gradient(ellipse 80% 60% at 50% 50%, rgba(20,60,30,0.4) 0%, transparent 70%)",pointerEvents:"none" }}/>
      <div style={{ width:"100%",maxWidth:400,position:"relative",zIndex:1 }}>
        <div style={{ textAlign:"center",marginBottom:32 }}><div style={{ fontSize:40,marginBottom:12,color:"#C9A84C" }}>👤</div><div style={{ fontFamily:"'Playfair Display',serif",fontSize:28,color:"#fff" }}>One more thing</div><div style={{ color:"#555",fontSize:11,fontFamily:"'Space Mono',monospace",letterSpacing:1.5,marginTop:8 }}>WHAT DO THEY CALL YOU AT THE TABLE?</div></div>
        <Card><div style={{ marginBottom:16 }}><label style={{ color:"#888",fontSize:11,fontFamily:"'Space Mono',monospace",letterSpacing:1.5,display:"block",marginBottom:8 }}>DISPLAY NAME</label><input value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&save()} placeholder="e.g. Big Stack Tyler" autoFocus style={{ ...inp,fontSize:18,fontFamily:"'Playfair Display',serif" }}/></div>{err&&<div style={{ color:"#E05555",fontSize:11,fontFamily:"'Space Mono',monospace",marginBottom:10 }}>{err}</div>}<button onClick={save} disabled={loading||!name.trim()} style={{ width:"100%",padding:"14px 0",background:name.trim()&&!loading?"linear-gradient(135deg,#C9A84C,#E8C56A)":"rgba(255,255,255,0.08)",border:"none",borderRadius:12,color:name.trim()&&!loading?"#0A0A0A":"#444",fontFamily:"'Space Mono',monospace",fontWeight:700,fontSize:14,letterSpacing:2,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:10 }}>{loading?<Spinner size={18}/>:"LET'S PLAY →"}</button></Card>
      </div>
    </div>
  );
}

// ─── LEAGUE TAB — home screen (leagues list) ───────────
function LeagueHomeView({ profile, myLeagues, loading, pinnedIds, onSelectLeague, onJoinCreate, onPublicLeagues, onGlobalLeaderboard, onTogglePin }:any) {
  const pinned=myLeagues.filter((lg:any)=>pinnedIds.includes(lg.id));
  const rest=myLeagues.filter((lg:any)=>!pinnedIds.includes(lg.id));
  const ordered=[...pinned,...rest];

  const LeagueRow=({ lg }:any)=>{
    const isComm=lg.commissioner_id===lg._myUserId;
    const isPinned=pinnedIds.includes(lg.id);
    const canPin=isPinned||pinnedIds.length<MAX_PINNED;
    return(
      <div style={{ background:"rgba(255,255,255,0.03)",border:`1px solid ${isPinned?"rgba(201,168,76,0.3)":"rgba(201,168,76,0.12)"}`,borderRadius:14,padding:"14px 15px",marginBottom:10,display:"flex",alignItems:"center",gap:12 }}>
        <div onClick={()=>onSelectLeague(lg)} style={{ width:44,height:44,borderRadius:12,background:isPinned?"rgba(201,168,76,0.18)":"rgba(201,168,76,0.1)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0,cursor:"pointer" }}>{isPinned?"📌":lg.is_public?"🌍":"♠"}</div>
        <div onClick={()=>onSelectLeague(lg)} style={{ flex:1,minWidth:0,cursor:"pointer" }}>
          <div style={{ color:"#fff",fontFamily:"'Playfair Display',serif",fontSize:17,display:"flex",alignItems:"center",gap:5 }}>{lg.name} {isComm&&<span style={{ fontSize:13 }}>👑</span>}</div>
          {lg.description&&<div style={{ color:"#666",fontSize:11,marginTop:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{lg.description}</div>}
          <div style={{ color:"#555",fontSize:10,fontFamily:"'Space Mono',monospace",marginTop:2 }}>{lg.season}{lg.location_name?` · 📍${lg.location_name}`:""} · <span style={{ color:"#C9A84C",letterSpacing:2 }}>{lg.code}</span></div>
        </div>
        <button onClick={()=>canPin&&onTogglePin(lg.id)} style={{ background:"none",border:"none",fontSize:18,cursor:canPin?"pointer":"not-allowed",opacity:canPin?1:0.3,padding:"4px",flexShrink:0 }} title={isPinned?"Unpin":"Pin (top 3)"}>
          {isPinned?"📌":"📍"}
        </button>
      </div>
    );
  };

  return(
    <div style={{ padding:"20px 16px 20px",maxWidth:500,margin:"0 auto" }}>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:22 }}>
        <div><div style={{ display:"flex",gap:5,marginBottom:4 }}>{["♠","♥"].map((s,i)=><span key={i} style={{ color:i===0?"#C9A84C":"#E05555",fontSize:16 }}>{s}</span>)}</div><div style={{ fontFamily:"'Playfair Display',serif",fontSize:26,color:"#C9A84C" }}>Home Game</div></div>
        <div style={{ textAlign:"right" }}>
          <div style={{ color:"#fff",fontSize:14,fontFamily:"'Playfair Display',serif" }}>{profile.display_name}</div>
          <div style={{ color:"#555",fontSize:11,fontFamily:"'Space Mono',monospace" }}>{myLeagues.length} league{myLeagues.length!==1?"s":""}</div>
        </div>
      </div>
      <div style={{ height:1,background:"rgba(201,168,76,0.1)",marginBottom:18 }}/>
      {loading&&<div style={{ display:"flex",justifyContent:"center",padding:40 }}><Spinner size={32}/></div>}
      {!loading&&myLeagues.length===0&&<Card style={{ marginBottom:14,textAlign:"center" }}><div style={{ padding:"20px 0" }}><div style={{ fontSize:32,marginBottom:10 }}>♠</div><div style={{ color:"#555",fontFamily:"'Space Mono',monospace",fontSize:12 }}>No leagues yet — join or create one below</div></div></Card>}
      {!loading&&ordered.map((lg:any)=><LeagueRow key={lg.id} lg={lg}/>)}
      {!loading&&pinnedIds.length<MAX_PINNED&&myLeagues.length>0&&<div style={{ color:"#444",fontSize:11,fontFamily:"'Space Mono',monospace",textAlign:"center",marginBottom:14 }}>📍 Tap pin icon to pin up to {MAX_PINNED} leagues to the top</div>}
      <button onClick={onJoinCreate} style={{ width:"100%",padding:"13px 0",marginTop:4,background:"linear-gradient(135deg,#C9A84C,#E8C56A)",border:"none",borderRadius:12,color:"#0A0A0A",fontFamily:"'Space Mono',monospace",fontWeight:700,fontSize:13,letterSpacing:2,cursor:"pointer",marginBottom:10 }}>+ JOIN OR CREATE LEAGUE</button>
      <div style={{ display:"flex",gap:8 }}>
        <button onClick={onPublicLeagues} style={{ flex:1,padding:"11px 0",background:"rgba(85,119,204,0.1)",border:"1px solid rgba(85,119,204,0.3)",borderRadius:12,color:"#5577CC",fontFamily:"'Space Mono',monospace",fontSize:11,letterSpacing:1.5,cursor:"pointer" }}>🌍 PUBLIC LEAGUES</button>
        <button onClick={onGlobalLeaderboard} style={{ flex:1,padding:"11px 0",background:"rgba(201,168,76,0.08)",border:"1px solid rgba(201,168,76,0.2)",borderRadius:12,color:"#C9A84C",fontFamily:"'Space Mono',monospace",fontSize:11,letterSpacing:1.5,cursor:"pointer" }}>🏆 GLOBAL BOARD</button>
      </div>
    </div>
  );
}

// ─── JOIN / CREATE ──────────────────────────────────────
function JoinCreateView({ profile, loading, onBack, onEnter }:any){
  const [tab,setTab]=useState("join");
  const [code,setCode]=useState("");const [leagueName,setLeagueName]=useState("");const [description,setDescription]=useState("");
  const [buyIn,setBuyIn]=useState("20");const [season,setSeason]=useState("Season 1");const [seasonLength,setSeasonLength]=useState("0");
  const [isPublic,setIsPublic]=useState(false);const [locationName,setLocationName]=useState("");const [maxPlayers,setMaxPlayers]=useState(12);
  const [detecting,setDetecting]=useState(false);
  const canSubmit=tab==="join"?code.trim():leagueName.trim();
  const detectLocation=()=>{setDetecting(true);navigator.geolocation?.getCurrentPosition(async(pos)=>{try{const r=await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`);const d=await r.json();setLocationName(d.address?.city||d.address?.town||d.address?.state||"");}catch(e){}setDetecting(false);},()=>setDetecting(false));};
  return(
    <div style={{ padding:"20px 16px",maxWidth:500,margin:"0 auto" }}>
      <BackButton onBack={onBack}/>
      <div style={{ fontFamily:"'Playfair Display',serif",fontSize:24,color:"#fff",marginBottom:20 }}>Add a League</div>
      <Card style={{ padding:0,overflow:"hidden" }}>
        <div style={{ display:"flex",borderBottom:"1px solid rgba(201,168,76,0.15)" }}>{["join","create"].map(t=><button key={t} onClick={()=>setTab(t)} style={{ flex:1,padding:"14px 0",background:"none",border:"none",color:tab===t?"#C9A84C":"#555",fontFamily:"'Space Mono',monospace",fontSize:12,letterSpacing:1.5,textTransform:"uppercase",cursor:"pointer",borderBottom:tab===t?"2px solid #C9A84C":"2px solid transparent" }}>{t==="join"?"Join":"Create"}</button>)}</div>
        <div style={{ padding:22 }}>
          {tab==="join"?<div style={{ marginBottom:16 }}><label style={{ color:"#888",fontSize:11,fontFamily:"'Space Mono',monospace",letterSpacing:1.5,display:"block",marginBottom:8 }}>INVITE CODE</label><input value={code} onChange={e=>setCode(e.target.value.toUpperCase())} placeholder="e.g. FNP2026" style={{ ...inp,color:"#C9A84C",fontSize:20,letterSpacing:4,textAlign:"center" as const }}/></div>:(
            <>
              {([["LEAGUE NAME","text",leagueName,setLeagueName,"Friday Night Poker"],["DESCRIPTION","text",description,setDescription,"Weekly home game"],["SEASON NAME","text",season,setSeason,"Season 1"]] as any[]).map(([label,type,val,setter,ph])=><div key={label} style={{ marginBottom:10 }}><label style={{ color:"#888",fontSize:11,fontFamily:"'Space Mono',monospace",letterSpacing:1.5,display:"block",marginBottom:6 }}>{label}</label><input type={type} value={val} onChange={e=>setter(e.target.value)} placeholder={ph} style={inp}/></div>)}
              <div style={{ display:"flex",gap:10,marginBottom:10 }}><div style={{ flex:1 }}><label style={{ color:"#888",fontSize:11,fontFamily:"'Space Mono',monospace",letterSpacing:1.5,display:"block",marginBottom:6 }}>BUY-IN ($)</label><input type="number" value={buyIn} onChange={e=>setBuyIn(e.target.value)} style={inp}/></div><div style={{ flex:1 }}><label style={{ color:"#888",fontSize:11,fontFamily:"'Space Mono',monospace",letterSpacing:1.5,display:"block",marginBottom:6 }}>SEASON LENGTH</label><input type="number" value={seasonLength} onChange={e=>setSeasonLength(e.target.value)} placeholder="0=unlimited" style={inp}/></div></div>
              <div style={{ marginBottom:10 }}><label style={{ color:"#888",fontSize:11,fontFamily:"'Space Mono',monospace",letterSpacing:1.5,display:"block",marginBottom:6 }}>MAX PLAYERS</label><div style={{ display:"flex",gap:6 }}>{MAX_PLAYER_OPTIONS.map(n=><button key={n} onClick={()=>setMaxPlayers(n)} style={{ flex:1,padding:"9px 0",borderRadius:10,background:maxPlayers===n?"rgba(201,168,76,0.2)":"rgba(255,255,255,0.04)",border:`1px solid ${maxPlayers===n?"rgba(201,168,76,0.4)":"rgba(255,255,255,0.08)"}`,color:maxPlayers===n?"#C9A84C":"#555",fontFamily:"'Space Mono',monospace",fontSize:12,cursor:"pointer" }}>{n}</button>)}</div></div>
              <div style={{ marginBottom:10 }}><label style={{ color:"#888",fontSize:11,fontFamily:"'Space Mono',monospace",letterSpacing:1.5,display:"block",marginBottom:6 }}>LOCATION</label><div style={{ display:"flex",gap:8 }}><input value={locationName} onChange={e=>setLocationName(e.target.value)} placeholder="e.g. San Francisco, CA" style={{ ...inp,flex:1 }}/><button onClick={detectLocation} style={{ padding:"0 14px",background:"rgba(201,168,76,0.1)",border:"1px solid rgba(201,168,76,0.2)",borderRadius:10,color:"#C9A84C",fontFamily:"'Space Mono',monospace",fontSize:11,cursor:"pointer",flexShrink:0 }}>{detecting?<Spinner size={14}/>:"📍"}</button></div></div>
              <Toggle value={isPublic} onChange={setIsPublic} label="Public League 🌍" sub="Anyone can find & join without a code"/>
            </>
          )}
          <button onClick={()=>canSubmit&&!loading&&onEnter({tab,code,leagueName,description,buyIn:Number(buyIn),season,seasonLength:Number(seasonLength),isPublic,locationName,maxPlayers})} style={{ width:"100%",padding:"13px 0",marginTop:8,background:canSubmit&&!loading?"linear-gradient(135deg,#C9A84C,#E8C56A)":"rgba(255,255,255,0.08)",border:"none",borderRadius:12,color:canSubmit&&!loading?"#0A0A0A":"#444",fontFamily:"'Space Mono',monospace",fontWeight:700,fontSize:13,letterSpacing:2,cursor:canSubmit&&!loading?"pointer":"not-allowed",display:"flex",alignItems:"center",justifyContent:"center",gap:10 }}>{loading?<Spinner size={18}/>:tab==="join"?"Join League →":"Create League →"}</button>
        </div>
      </Card>
    </div>
  );
}

// ─── PUBLIC LEAGUES ────────────────────────────────────
function PublicLeaguesView({ onBack, onJoin }:any){
  const [leagues,setLeagues]=useState<any[]>([]);const [loading,setLoading]=useState(true);
  const [userLocation,setUserLocation]=useState("");const [detecting,setDetecting]=useState(false);const [filter,setFilter]=useState("");
  useEffect(()=>{if(!db)return;(async()=>{const{data}=await db.from("leagues").select("*").eq("is_public",true).order("created_at",{ascending:false});setLeagues(data||[]);setLoading(false);})();},[]);
  const detectLocation=()=>{setDetecting(true);navigator.geolocation?.getCurrentPosition(async(pos)=>{try{const r=await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`);const d=await r.json();setUserLocation(d.address?.city||d.address?.state||"");}catch(e){}setDetecting(false);},()=>setDetecting(false));};
  const filtered=leagues.filter(lg=>!filter||(lg.name?.toLowerCase().includes(filter.toLowerCase())||lg.location_name?.toLowerCase().includes(filter.toLowerCase())));
  const sorted=userLocation?[...filtered].sort((a,b)=>{const am=a.location_name?.toLowerCase().includes(userLocation.toLowerCase())?0:1;const bm=b.location_name?.toLowerCase().includes(userLocation.toLowerCase())?0:1;return am-bm;}):filtered;
  return(
    <div style={{ padding:"20px 16px",maxWidth:500,margin:"0 auto" }}>
      <BackButton onBack={onBack}/>
      <div style={{ fontFamily:"'Playfair Display',serif",fontSize:24,color:"#fff",marginBottom:16 }}>Public Leagues</div>
      <div style={{ display:"flex",gap:8,marginBottom:12 }}><input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Search name or city..." style={{ ...inp,fontSize:13,padding:"10px 14px",flex:1 }}/><button onClick={detectLocation} style={{ padding:"0 14px",background:"rgba(85,119,204,0.1)",border:"1px solid rgba(85,119,204,0.3)",borderRadius:10,color:"#5577CC",fontFamily:"'Space Mono',monospace",fontSize:11,cursor:"pointer",flexShrink:0 }}>{detecting?<Spinner size={14}/>:"📍"}</button></div>
      {userLocation&&<div style={{ color:"#5577CC",fontSize:11,fontFamily:"'Space Mono',monospace",marginBottom:12 }}>📍 Near {userLocation} first</div>}
      {loading&&<div style={{ display:"flex",justifyContent:"center",padding:40 }}><Spinner/></div>}
      {!loading&&sorted.length===0&&<Card><div style={{ textAlign:"center",padding:"24px 0",color:"#555",fontFamily:"'Space Mono',monospace",fontSize:12 }}>No public leagues found.</div></Card>}
      {sorted.map((lg:any)=><Card key={lg.id} style={{ marginBottom:12 }}><div style={{ display:"flex",gap:12,marginBottom:12 }}><div style={{ width:46,height:46,borderRadius:12,background:"rgba(85,119,204,0.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0 }}>♠</div><div style={{ flex:1 }}><div style={{ color:"#fff",fontFamily:"'Playfair Display',serif",fontSize:17 }}>{lg.name}</div>{lg.description&&<div style={{ color:"#666",fontSize:12,marginTop:2 }}>{lg.description}</div>}<div style={{ color:"#555",fontSize:11,fontFamily:"'Space Mono',monospace",marginTop:4 }}>{lg.season} · ${lg.buy_in}{lg.location_name?<span style={{ color:"#5577CC" }}> · 📍{lg.location_name}</span>:null}</div></div></div><button onClick={()=>onJoin(lg)} style={{ width:"100%",padding:"10px 0",background:"rgba(85,119,204,0.15)",border:"1px solid rgba(85,119,204,0.3)",borderRadius:10,color:"#5577CC",fontFamily:"'Space Mono',monospace",fontSize:12,letterSpacing:1.5,cursor:"pointer" }}>JOIN LEAGUE →</button></Card>)}
    </div>
  );
}

// ─── GLOBAL LEADERBOARD ────────────────────────────────
function GlobalLeaderboardView({ profile, onBack }:any){
  const [leaders,setLeaders]=useState<any[]>([]);const [loading,setLoading]=useState(true);
  const [sortBy,setSortBy]=useState<'profit'|'winpct'|'time'>('profit');const [myStats,setMyStats]=useState<any>(null);
  useEffect(()=>{if(!db)return;(async()=>{const{data}=await db.from("profiles").select("*").eq("opt_in_global",true);setLeaders(data||[]);const{data:me}=await db.from("profiles").select("*").eq("id",profile.id).single();setMyStats(me);setLoading(false);})();},[]);
  const myHours=myStats?Math.floor((myStats.global_time_seconds||0)/3600):0;
  const getSorted=()=>{const c=[...leaders];if(sortBy==='profit')return c.sort((a,b)=>(b.global_total_profit||0)-(a.global_total_profit||0));if(sortBy==='winpct')return c.sort((a,b)=>{const ar=a.global_sessions>0?a.global_wins/a.global_sessions:0;const br=b.global_sessions>0?b.global_wins/b.global_sessions:0;return br-ar;});return c.sort((a,b)=>(b.global_time_seconds||0)-(a.global_time_seconds||0));};
  return(
    <div style={{ padding:"20px 16px",maxWidth:500,margin:"0 auto" }}>
      <BackButton onBack={onBack}/>
      <div style={{ fontFamily:"'Playfair Display',serif",fontSize:24,color:"#fff",marginBottom:16 }}>🏆 Global Leaderboard</div>
      <Card style={{ marginBottom:16,background:"rgba(201,168,76,0.05)",border:"1px solid rgba(201,168,76,0.2)" }}>
        <div style={{ color:"#C9A84C",fontSize:11,fontFamily:"'Space Mono',monospace",letterSpacing:1.5,marginBottom:8 }}>HOW IT WORKS</div>
        <div style={{ color:"#888",fontSize:12,lineHeight:1.7 }}>Opt in from <span style={{ color:"#fff" }}>Profile → Settings</span> to appear here. You need <span style={{ color:"#C9A84C" }}>{HOURS_REQUIRED_GLOBAL} hours</span> of league play to place. Anyone can view.</div>
        {myStats&&<div style={{ marginTop:10,paddingTop:10,borderTop:"1px solid rgba(201,168,76,0.15)" }}><div style={{ color:"#555",fontSize:11,fontFamily:"'Space Mono',monospace" }}>YOUR TIME: <span style={{ color:myHours>=HOURS_REQUIRED_GLOBAL?"#4CAF8C":"#E05555" }}>{myHours}/{HOURS_REQUIRED_GLOBAL}h</span>{myHours<HOURS_REQUIRED_GLOBAL&&" — keep grinding!"}</div></div>}
      </Card>
      <div style={{ display:"flex",gap:6,marginBottom:14 }}>{([['profit','$ PROFIT'],['winpct','WIN %'],['time','TIME']] as any[]).map(([k,l])=><button key={k} onClick={()=>setSortBy(k)} style={{ flex:1,padding:"8px 0",borderRadius:20,background:sortBy===k?"rgba(201,168,76,0.2)":"rgba(255,255,255,0.04)",border:`1px solid ${sortBy===k?"rgba(201,168,76,0.4)":"rgba(255,255,255,0.08)"}`,color:sortBy===k?"#C9A84C":"#555",fontFamily:"'Space Mono',monospace",fontSize:10,cursor:"pointer",letterSpacing:1 }}>{l}</button>)}</div>
      {loading&&<div style={{ display:"flex",justifyContent:"center",padding:40 }}><Spinner/></div>}
      {!loading&&getSorted().length===0&&<Card><div style={{ textAlign:"center",padding:"28px 0",color:"#555",fontFamily:"'Space Mono',monospace",fontSize:12 }}>No one on the board yet.</div></Card>}
      {getSorted().map((p:any,i:number)=>{const isMe=p.id===profile.id;const medals=["🥇","🥈","🥉"];const winPct=p.global_sessions>0?((p.global_wins/p.global_sessions)*100).toFixed(0):0;const hrs=Math.floor((p.global_time_seconds||0)/3600);return<div key={p.id} style={{ display:"flex",alignItems:"center",gap:12,padding:"12px 14px",marginBottom:8,background:isMe?"rgba(201,168,76,0.06)":"rgba(255,255,255,0.02)",border:`1px solid ${isMe?"rgba(201,168,76,0.3)":"rgba(255,255,255,0.06)"}`,borderRadius:13 }}><div style={{ width:28,textAlign:"center",fontFamily:"'Space Mono',monospace",color:i<3?"#C9A84C":"#444",fontSize:14 }}>{i<3?medals[i]:i+1}</div><Avatar name={p.display_name} url={p.avatar_url} size={38}/><div style={{ flex:1 }}><div style={{ color:"#fff",fontSize:14 }}>{p.display_name}{isMe&&<span style={{ color:"#C9A84C",fontSize:10,fontFamily:"'Space Mono',monospace" }}> (you)</span>}</div><div style={{ color:"#555",fontSize:10,fontFamily:"'Space Mono',monospace" }}>{p.global_sessions||0} games · {winPct}% win · {hrs}h</div></div><div style={{ textAlign:"right" }}><div style={{ color:(p.global_total_profit||0)>=0?"#4CAF8C":"#E05555",fontFamily:"'Space Mono',monospace",fontWeight:700 }}>{(p.global_total_profit||0)>=0?"+":""}${p.global_total_profit||0}</div>{p.chicken_dinners>0&&<div style={{ color:"#C9A84C",fontSize:10 }}>🍗×{p.chicken_dinners}</div>}</div></div>;})}
    </div>
  );
}

// ─── LEAGUE DETAIL (Clash Royale style) ────────────────
function LeagueDetailView({ league, players, sessions, profile, isCommissioner, onViewPlayer, onStartSession, onBack, onCommSettings, liveSession, onLeaveLeague, onViewHandRankings }:any){
  const [sortBy,setSortBy]=useState<'profit'|'winpct'|'sessions'>('profit');
  const getSorted=()=>{const c=[...players];if(sortBy==='profit')return c.sort((a:any,b:any)=>b.total_profit-a.total_profit);if(sortBy==='winpct')return c.sort((a:any,b:any)=>{const ar=a.session_count>0?a.wins/a.session_count:0;const br=b.session_count>0?b.wins/b.session_count:0;return br-ar;});return c.sort((a:any,b:any)=>b.session_count-a.session_count);};
  const sorted=getSorted();const sessionsLeft=league.season_length>0?league.season_length-sessions.length:null;
  return(
    <div style={{ maxWidth:500,margin:"0 auto" }}>
      <div style={{ background:"linear-gradient(180deg,rgba(20,40,20,0.95) 0%,rgba(10,10,10,0) 100%)",padding:"20px 16px 0" }}>
        <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:14 }}>
          <button onClick={onBack} style={{ background:"none",border:"none",color:"#555",fontSize:22,cursor:"pointer" }}>←</button>
          <div style={{ flex:1,minWidth:0 }}><div style={{ fontFamily:"'Playfair Display',serif",fontSize:22,fontWeight:700,color:"#fff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{league.name}</div>{league.description&&<div style={{ color:"#666",fontSize:12,marginTop:1 }}>{league.description}</div>}</div>
          {isCommissioner&&<button onClick={onCommSettings} style={{ background:"rgba(201,168,76,0.1)",border:"1px solid rgba(201,168,76,0.2)",borderRadius:20,padding:"5px 11px",color:"#C9A84C",fontFamily:"'Space Mono',monospace",fontSize:10,cursor:"pointer",flexShrink:0 }}>👑 MANAGE</button>}
        </div>
        <div style={{ display:"flex",gap:8,marginBottom:12 }}>
          <StatBox label="Members" value={`${players.length}/${league.max_players||12}`}/>
          <StatBox label="Sessions" value={sessions.length}/>
          <StatBox label="Buy-in" value={`$${league.buy_in}`} accent="#4CAF8C"/>
          {sessionsLeft!==null&&<StatBox label="Left" value={sessionsLeft<=0?"Done!":sessionsLeft} accent={sessionsLeft<=0?"#E05555":"#C9A84C"}/>}
        </div>
        <div style={{ display:"flex",gap:8,alignItems:"center",marginBottom:16,flexWrap:"wrap" }}>
          <span style={{ color:"#555",fontSize:11,fontFamily:"'Space Mono',monospace" }}>Code:</span>
          <span style={{ color:"#C9A84C",fontSize:12,fontFamily:"'Space Mono',monospace",letterSpacing:3,background:"rgba(201,168,76,0.1)",padding:"2px 10px",borderRadius:6 }}>{league.code}</span>
          {league.is_public&&<Badge text="PUBLIC 🌍" color="#5577CC"/>}
          {league.location_name&&<span style={{ color:"#555",fontSize:11 }}>📍{league.location_name}</span>}
        </div>
      </div>
      <div style={{ padding:"0 16px 20px" }}>
        {liveSession&&<div onClick={onStartSession} style={{ background:"rgba(76,175,140,0.1)",border:"1px solid rgba(76,175,140,0.4)",borderRadius:14,padding:"14px 18px",marginBottom:14,cursor:"pointer",display:"flex",alignItems:"center",gap:12 }}><div style={{ width:10,height:10,borderRadius:"50%",background:"#4CAF8C",animation:"pulse 1.5s infinite",flexShrink:0 }}/><div style={{ flex:1 }}><div style={{ color:"#4CAF8C",fontFamily:"'Space Mono',monospace",fontSize:12,letterSpacing:2 }}>● GAME IS LIVE</div><div style={{ color:"#888",fontSize:11,marginTop:2 }}>Tap to view session & enter your stats</div></div><span style={{ color:"#4CAF8C",fontSize:20 }}>›</span></div>}
        {!liveSession&&<button onClick={onStartSession} style={{ width:"100%",padding:"13px 0",marginBottom:14,background:"linear-gradient(135deg,#1a4a2a,#2a6a3a)",border:"1px solid rgba(76,175,140,0.4)",borderRadius:14,color:"#4CAF8C",fontFamily:"'Space Mono',monospace",fontWeight:700,fontSize:13,letterSpacing:2,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:10 }}><span style={{ fontSize:18 }}>♠</span> START TONIGHT'S SESSION</button>}
        <div style={{ display:"flex",gap:6,marginBottom:12,alignItems:"center" }}>
          <div style={{ color:"#444",fontSize:10,fontFamily:"'Space Mono',monospace",marginRight:4 }}>SORT:</div>
          {([['profit','$ P/L'],['winpct','WIN %'],['sessions','GAMES']] as any[]).map(([k,l])=><button key={k} onClick={()=>setSortBy(k)} style={{ padding:"5px 11px",borderRadius:20,background:sortBy===k?"rgba(201,168,76,0.2)":"rgba(255,255,255,0.04)",border:`1px solid ${sortBy===k?"rgba(201,168,76,0.4)":"rgba(255,255,255,0.08)"}`,color:sortBy===k?"#C9A84C":"#555",fontFamily:"'Space Mono',monospace",fontSize:11,cursor:"pointer" }}>{l}</button>)}
          <button onClick={onViewHandRankings} style={{ marginLeft:"auto",padding:"5px 11px",borderRadius:20,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",color:"#555",fontFamily:"'Space Mono',monospace",fontSize:11,cursor:"pointer" }}>🃏 HANDS</button>
        </div>
        <Card style={{ padding:0,overflow:"hidden",marginBottom:14 }}>
          {sorted.length===0&&<div style={{ color:"#555",fontFamily:"'Space Mono',monospace",fontSize:12,textAlign:"center",padding:"24px 0" }}>No members yet</div>}
          {sorted.map((p:any,i:number)=>{const isComm=p.name.toLowerCase()===league.commissioner_name?.toLowerCase();const winPct=p.session_count>0?((p.wins/p.session_count)*100).toFixed(0):0;const medals=["🥇","🥈","🥉"];const isTop3=i<3;return<div key={p.id} onClick={()=>onViewPlayer(p)} style={{ display:"flex",alignItems:"center",gap:12,padding:"13px 18px",borderBottom:"1px solid rgba(255,255,255,0.05)",cursor:"pointer",background:i===0?"rgba(201,168,76,0.04)":"transparent" }}><div style={{ width:24,textAlign:"center",fontSize:isTop3?16:13,fontFamily:"'Space Mono',monospace",color:isTop3?"#C9A84C":"#444" }}>{isTop3?medals[i]:i+1}</div><Avatar name={p.name} size={40}/><div style={{ flex:1,minWidth:0 }}><div style={{ color:"#fff",fontSize:14,display:"flex",alignItems:"center",gap:5 }}>{p.name.length>14?p.name.slice(0,14)+"…":p.name} {isComm&&<span>👑</span>} {p.streak>1&&<span>🔥</span>} {(p.chicken_dinners||0)>0&&<span>🍗</span>}</div><div style={{ color:"#555",fontSize:10,fontFamily:"'Space Mono',monospace",marginTop:2 }}>{p.session_count} games · {p.wins}W · {winPct}% win</div></div><div style={{ textAlign:"right",flexShrink:0 }}><div style={{ color:p.total_profit>=0?"#4CAF8C":"#E05555",fontFamily:"'Space Mono',monospace",fontWeight:700,fontSize:14 }}>{p.total_profit>=0?"+":""}${p.total_profit}</div><div style={{ color:"#444",fontSize:10 }}>best ${p.best_night}</div></div></div>;})}
        </Card>
        {sessions.length>0&&<Card style={{ marginBottom:14 }}><div style={{ color:"#888",fontSize:11,fontFamily:"'Space Mono',monospace",letterSpacing:2,marginBottom:12 }}>RECENT SESSIONS</div>{sessions.slice(0,4).map((s:any,i:number)=>{const d=new Date(s.created_at);return<div key={s.id} style={{ display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:i<Math.min(sessions.length,4)-1?"1px solid rgba(255,255,255,0.05)":"none" }}><div style={{ width:32,textAlign:"center" }}><div style={{ color:"#C9A84C",fontSize:11,fontFamily:"'Space Mono',monospace" }}>{d.getDate()}</div><div style={{ color:"#555",fontSize:9 }}>{d.toLocaleDateString('en-US',{month:'short'})}</div></div><div style={{ flex:1 }}><div style={{ color:"#fff",fontSize:12 }}>${s.pot} pot{s.buy_in_amount?` · $${s.buy_in_amount} buy-in`:""}</div><div style={{ color:"#555",fontSize:10,fontFamily:"'Space Mono',monospace" }}>🏆 {s.winner_name||"TBD"}{s.chicken_dinner_name?` · 🍗 ${s.chicken_dinner_name}`:""}</div></div><Badge text="✓" color="#4CAF8C"/></div>;})}</Card>}
        <button onClick={onLeaveLeague} style={{ width:"100%",padding:"11px 0",background:"rgba(224,85,85,0.05)",border:"1px solid rgba(224,85,85,0.15)",borderRadius:12,color:"#E05555",fontFamily:"'Space Mono',monospace",fontSize:11,letterSpacing:1.5,cursor:"pointer" }}>LEAVE LEAGUE</button>
      </div>
    </div>
  );
}

// ─── TRANSFER COMMISSIONER ─────────────────────────────
function TransferCommView({ league, players, profile, onBack, onTransferred }:any){
  const [selected,setSelected]=useState("");const [loading,setLoading]=useState(false);
  const others=players.filter((p:any)=>p.name.toLowerCase()!==profile.display_name.toLowerCase());
  const handleTransfer=async()=>{if(!db||!selected)return;setLoading(true);const{data:newProf}=await db.from("profiles").select("id").ilike("display_name",selected).limit(1);const newCommId=newProf?.[0]?.id||null;await db.from("leagues").update({commissioner_name:selected,commissioner_id:newCommId}).eq("id",league.id);onTransferred();};
  return(
    <div style={{ padding:"20px 16px",maxWidth:500,margin:"0 auto" }}>
      <BackButton onBack={onBack}/>
      <div style={{ fontFamily:"'Playfair Display',serif",fontSize:22,color:"#fff",marginBottom:8 }}>Transfer Commissioner</div>
      <div style={{ color:"#888",fontSize:12,lineHeight:1.7,marginBottom:18 }}>You're the commissioner. Choose who takes over before you leave.</div>
      <Card style={{ marginBottom:16 }}>{others.length===0&&<div style={{ color:"#555",fontFamily:"'Space Mono',monospace",fontSize:12,textAlign:"center",padding:"16px 0" }}>No other players to transfer to.</div>}{others.map((p:any)=><div key={p.id} onClick={()=>setSelected(p.name)} style={{ display:"flex",alignItems:"center",gap:12,padding:"11px 0",borderBottom:"1px solid rgba(255,255,255,0.05)",cursor:"pointer" }}><div style={{ width:22,height:22,borderRadius:6,border:`2px solid ${selected===p.name?"#C9A84C":"#333"}`,background:selected===p.name?"#C9A84C":"transparent",display:"flex",alignItems:"center",justifyContent:"center",color:"#000",fontSize:13,flexShrink:0 }}>{selected===p.name?"✓":""}</div><Avatar name={p.name} size={34}/><div style={{ flex:1 }}><div style={{ color:"#fff" }}>{p.name}</div><div style={{ color:"#555",fontSize:10,fontFamily:"'Space Mono',monospace" }}>{p.session_count} sessions</div></div></div>)}</Card>
      <button onClick={handleTransfer} disabled={!selected||loading} style={{ width:"100%",padding:"13px 0",background:selected&&!loading?"linear-gradient(135deg,#C9A84C,#E8C56A)":"rgba(255,255,255,0.08)",border:"none",borderRadius:12,color:selected&&!loading?"#0A0A0A":"#444",fontFamily:"'Space Mono',monospace",fontWeight:700,fontSize:13,letterSpacing:2,cursor:selected&&!loading?"pointer":"not-allowed",display:"flex",alignItems:"center",justifyContent:"center",gap:10 }}>{loading?<Spinner size={18}/>:"TRANSFER & LEAVE →"}</button>
    </div>
  );
}

// ─── LIVE SESSION ──────────────────────────────────────
function LiveSessionView({ session, liveEntries, players, profile, isCommissioner, league, onBack, onSubmitEntry, onEndSession }:any){
  const [elapsed,setElapsed]=useState(0);const [myBuyIn,setMyBuyIn]=useState(0);const [myRebuys,setMyRebuys]=useState(0);const [cashOuts,setCashOuts]=useState<any>({});const [saving,setSaving]=useState(false);const [showCashout,setShowCashout]=useState(false);const [chickenDinner,setChickenDinner]=useState("");
  const myPlayer=players.find((p:any)=>p.name.toLowerCase()===profile.display_name.toLowerCase());
  const myEntry=liveEntries.find((e:any)=>e.player_name.toLowerCase()===profile.display_name.toLowerCase());
  useEffect(()=>{if(session?.started_at){const t=setInterval(()=>setElapsed(Math.floor((Date.now()-new Date(session.started_at).getTime())/1000)),1000);return()=>clearInterval(t);}},[session]);
  useEffect(()=>{if(myEntry){setMyBuyIn(myEntry.buy_in||0);setMyRebuys(myEntry.rebuys||0);}else{setMyBuyIn(league.buy_in||20);}},[myEntry]);
  const fmt=(s:number)=>`${Math.floor(s/3600)}:${String(Math.floor((s%3600)/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;
  const totalPot=liveEntries.reduce((a:number,e:any)=>a+(e.buy_in||0)+(e.rebuys||0),0);
  const handleSubmit=async()=>{if(!myPlayer)return;setSaving(true);await onSubmitEntry({player_id:myPlayer.id,player_name:profile.display_name,buy_in:myBuyIn,rebuys:myRebuys});setSaving(false);};
  const handleEnd=async()=>{setSaving(true);const entries=liveEntries.map((e:any)=>({player_id:e.player_id,player_name:e.player_name,buy_in:e.buy_in||0,rebuys:e.rebuys||0,cash_out:cashOuts[e.player_id]||0,profit:(cashOuts[e.player_id]||0)-((e.buy_in||0)+(e.rebuys||0))}));await onEndSession({entries,elapsed,chickenDinner});setSaving(false);};
  const ni:any={background:"rgba(255,255,255,0.05)",border:"1px solid rgba(201,168,76,0.25)",borderRadius:8,padding:"8px 10px",color:"#fff",fontSize:14,fontFamily:"'Space Mono',monospace",outline:"none",width:70,textAlign:"center",boxSizing:"border-box"};
  return(
    <div style={{ padding:"16px 16px",maxWidth:500,margin:"0 auto" }}>
      <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:14 }}><button onClick={onBack} style={{ background:"none",border:"none",color:"#555",fontSize:22,cursor:"pointer" }}>←</button><div style={{ flex:1 }}><div style={{ color:"#4CAF8C",fontSize:11,fontFamily:"'Space Mono',monospace",letterSpacing:2 }}>● GAME IS LIVE</div><div style={{ fontFamily:"'Playfair Display',serif",fontSize:20,color:"#fff" }}>{league.name}</div></div></div>
      <div style={{ display:"flex",gap:10,marginBottom:14 }}>
        <div style={{ flex:1,background:"rgba(76,175,140,0.1)",border:"1px solid rgba(76,175,140,0.3)",borderRadius:14,padding:"13px 14px",textAlign:"center" }}><div style={{ color:"#555",fontSize:9,fontFamily:"'Space Mono',monospace",letterSpacing:2 }}>TIME</div><div style={{ color:"#4CAF8C",fontSize:26,fontFamily:"'Space Mono',monospace",fontWeight:700,marginTop:3 }}>{fmt(elapsed)}</div></div>
        <div style={{ flex:1,background:"rgba(201,168,76,0.08)",border:"1px solid rgba(201,168,76,0.2)",borderRadius:14,padding:"13px 14px",textAlign:"center" }}><div style={{ color:"#555",fontSize:9,fontFamily:"'Space Mono',monospace",letterSpacing:2 }}>POT</div><div style={{ color:"#C9A84C",fontSize:26,fontFamily:"'Space Mono',monospace",fontWeight:700,marginTop:3 }}>${totalPot}</div></div>
      </div>
      {myPlayer&&<Card style={{ marginBottom:14,border:"1px solid rgba(201,168,76,0.3)",background:"rgba(201,168,76,0.04)" }}><div style={{ color:"#C9A84C",fontSize:11,fontFamily:"'Space Mono',monospace",letterSpacing:2,marginBottom:12 }}>YOUR STATS</div><div style={{ display:"flex",gap:12,marginBottom:12 }}><div style={{ flex:1 }}><div style={{ color:"#888",fontSize:10,fontFamily:"'Space Mono',monospace",marginBottom:5 }}>BUY-IN ($)</div><input type="number" value={myBuyIn||""} onChange={e=>setMyBuyIn(Number(e.target.value))} style={{...ni,width:"100%"}}/></div><div style={{ flex:1 }}><div style={{ color:"#888",fontSize:10,fontFamily:"'Space Mono',monospace",marginBottom:5 }}>REBUYS ($)</div><input type="number" value={myRebuys||""} onChange={e=>setMyRebuys(Number(e.target.value))} style={{...ni,width:"100%"}}/></div></div><button onClick={handleSubmit} disabled={saving} style={{ width:"100%",padding:"10px 0",background:"rgba(201,168,76,0.15)",border:"1px solid rgba(201,168,76,0.3)",borderRadius:10,color:"#C9A84C",fontFamily:"'Space Mono',monospace",fontSize:12,letterSpacing:1.5,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8 }}>{saving?<Spinner size={14}/>:"SUBMIT MY STATS ✓"}</button></Card>}
      <Card style={{ marginBottom:14 }}><div style={{ color:"#888",fontSize:11,fontFamily:"'Space Mono',monospace",letterSpacing:2,marginBottom:12 }}>IN SESSION ({liveEntries.length})</div>{liveEntries.length===0&&<div style={{ color:"#555",fontSize:12,fontFamily:"'Space Mono',monospace",textAlign:"center",padding:"10px 0" }}>Waiting for players...</div>}{liveEntries.map((e:any,i:number)=>{const total=(e.buy_in||0)+(e.rebuys||0);const isMe=e.player_name.toLowerCase()===profile.display_name.toLowerCase();return<div key={e.id||i} style={{ display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:i<liveEntries.length-1?"1px solid rgba(255,255,255,0.05)":"none" }}><Avatar name={e.player_name} size={32}/><div style={{ flex:1 }}><div style={{ color:"#fff",fontSize:13 }}>{e.player_name}{isMe&&<span style={{ color:"#C9A84C",fontSize:10,fontFamily:"'Space Mono',monospace" }}> (you)</span>}</div><div style={{ color:"#555",fontSize:10,fontFamily:"'Space Mono',monospace" }}>in: ${e.buy_in||0} + rebuys: ${e.rebuys||0}</div></div><div style={{ color:"#4CAF8C",fontFamily:"'Space Mono',monospace",fontWeight:700 }}>${total}</div></div>;})}
      </Card>
      {isCommissioner&&<>{!showCashout&&<button onClick={()=>setShowCashout(true)} style={{ width:"100%",padding:"13px 0",background:"linear-gradient(135deg,#5a0000,#8B1A1A)",border:"1px solid rgba(224,85,85,0.4)",borderRadius:12,color:"#E05555",fontFamily:"'Space Mono',monospace",fontWeight:700,fontSize:13,letterSpacing:2,cursor:"pointer" }}>END GAME & CASH-OUTS →</button>}{showCashout&&<Card><div style={{ color:"#888",fontSize:11,fontFamily:"'Space Mono',monospace",letterSpacing:2,marginBottom:12 }}>CASH-OUTS</div>{liveEntries.map((e:any)=><div key={e.player_id} style={{ display:"flex",alignItems:"center",gap:10,marginBottom:10 }}><Avatar name={e.player_name} size={28}/><div style={{ flex:1 }}><div style={{ color:"#fff",fontSize:13 }}>{e.player_name}</div><div style={{ color:"#555",fontSize:10,fontFamily:"'Space Mono',monospace" }}>in: ${(e.buy_in||0)+(e.rebuys||0)}</div></div><input type="number" value={cashOuts[e.player_id]||""} onChange={ev=>setCashOuts((c:any)=>({...c,[e.player_id]:Number(ev.target.value)}))} placeholder="$0" style={{...ni,width:"75px"}}/></div>)}<div style={{ marginTop:12,marginBottom:4 }}><div style={{ color:"#C9A84C",fontSize:11,fontFamily:"'Space Mono',monospace",letterSpacing:2,marginBottom:8 }}>🍗 CHICKEN DINNER</div><div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>{liveEntries.map((e:any)=><button key={e.player_id} onClick={()=>setChickenDinner(e.player_name)} style={{ padding:"6px 12px",borderRadius:20,background:chickenDinner===e.player_name?"rgba(201,168,76,0.2)":"rgba(255,255,255,0.04)",border:`1px solid ${chickenDinner===e.player_name?"rgba(201,168,76,0.4)":"rgba(255,255,255,0.08)"}`,color:chickenDinner===e.player_name?"#C9A84C":"#555",fontFamily:"'Space Mono',monospace",fontSize:11,cursor:"pointer" }}>{e.player_name}</button>)}</div></div><button onClick={handleEnd} disabled={saving} style={{ width:"100%",marginTop:14,padding:"12px 0",background:saving?"rgba(255,255,255,0.08)":"linear-gradient(135deg,#C9A84C,#E8C56A)",border:"none",borderRadius:10,color:saving?"#444":"#0A0A0A",fontFamily:"'Space Mono',monospace",fontWeight:700,fontSize:13,letterSpacing:2,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:10 }}>{saving?<><Spinner size={16}/> SAVING...</>:"APPROVE & SAVE SESSION ✓"}</button></Card>}</>}
      {!isCommissioner&&<div style={{ padding:"12px 14px",background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:12,color:"#444",fontFamily:"'Space Mono',monospace",fontSize:11,textAlign:"center" }}>👑 Commissioner ends the session</div>}
    </div>
  );
}

// ─── NEW SESSION ───────────────────────────────────────
function NewSessionView({ league, players, onStart, onBack }:any){
  const [sessionBuyIn,setSessionBuyIn]=useState(league.buy_in);const [selectedIds,setSelectedIds]=useState<string[]>([]);const [loading,setLoading]=useState(false);
  return(
    <div style={{ padding:"20px 16px",maxWidth:500,margin:"0 auto" }}>
      <BackButton onBack={onBack}/>
      <div style={{ fontFamily:"'Playfair Display',serif",fontSize:22,color:"#fff",marginBottom:18 }}>Tonight's Setup</div>
      <Card style={{ marginBottom:14 }}><div style={{ color:"#888",fontSize:11,fontFamily:"'Space Mono',monospace",letterSpacing:2,marginBottom:10 }}>BUY-IN FOR TONIGHT</div><div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:10 }}><button onClick={()=>setSessionBuyIn(Math.max(1,sessionBuyIn-5))} style={{ width:40,height:40,borderRadius:10,background:"rgba(224,85,85,0.15)",border:"1px solid rgba(224,85,85,0.3)",color:"#E05555",fontSize:20,cursor:"pointer" }}>−</button><div style={{ flex:1,textAlign:"center" }}><div style={{ color:"#C9A84C",fontSize:32,fontFamily:"'Space Mono',monospace",fontWeight:700 }}>${sessionBuyIn}</div></div><button onClick={()=>setSessionBuyIn(sessionBuyIn+5)} style={{ width:40,height:40,borderRadius:10,background:"rgba(76,175,140,0.15)",border:"1px solid rgba(76,175,140,0.3)",color:"#4CAF8C",fontSize:20,cursor:"pointer" }}>+</button></div><div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>{[10,20,25,50,100].map(amt=><button key={amt} onClick={()=>setSessionBuyIn(amt)} style={{ padding:"5px 11px",borderRadius:20,background:sessionBuyIn===amt?"rgba(201,168,76,0.2)":"rgba(255,255,255,0.04)",border:`1px solid ${sessionBuyIn===amt?"rgba(201,168,76,0.4)":"rgba(255,255,255,0.08)"}`,color:sessionBuyIn===amt?"#C9A84C":"#555",fontFamily:"'Space Mono',monospace",fontSize:12,cursor:"pointer" }}>${amt}</button>)}</div></Card>
      <div style={{ color:"#888",fontSize:11,fontFamily:"'Space Mono',monospace",letterSpacing:2,marginBottom:10 }}>WHO'S PLAYING</div>
      <Card style={{ marginBottom:16 }}>{players.map((p:any)=>{const sel=selectedIds.includes(p.id);return<div key={p.id} onClick={()=>setSelectedIds(sel?selectedIds.filter(x=>x!==p.id):[...selectedIds,p.id])} style={{ display:"flex",alignItems:"center",gap:12,padding:"11px 0",borderBottom:"1px solid rgba(255,255,255,0.05)",cursor:"pointer",opacity:sel?1:0.5 }}><div style={{ width:22,height:22,borderRadius:6,border:`2px solid ${sel?"#C9A84C":"#333"}`,background:sel?"#C9A84C":"transparent",display:"flex",alignItems:"center",justifyContent:"center",color:"#000",fontSize:13,flexShrink:0 }}>{sel?"✓":""}</div><Avatar name={p.name} size={34}/><div style={{ flex:1 }}><div style={{ color:"#fff" }}>{p.name}</div><div style={{ color:"#555",fontSize:10,fontFamily:"'Space Mono',monospace" }}>{p.wins}W · {p.total_profit>=0?"+":""}${p.total_profit}</div></div></div>;})}
      </Card>
      <button disabled={selectedIds.length<2||loading} onClick={async()=>{setLoading(true);await onStart({selectedIds,sessionBuyIn});setLoading(false);}} style={{ width:"100%",padding:"14px 0",background:selectedIds.length>=2&&!loading?"linear-gradient(135deg,#C9A84C,#E8C56A)":"rgba(255,255,255,0.08)",border:"none",borderRadius:12,color:selectedIds.length>=2&&!loading?"#0A0A0A":"#444",fontFamily:"'Space Mono',monospace",fontWeight:700,fontSize:13,letterSpacing:2,cursor:selectedIds.length>=2&&!loading?"pointer":"not-allowed",display:"flex",alignItems:"center",justifyContent:"center",gap:10 }}>{loading?<Spinner size={18}/>:`START WITH ${selectedIds.length} PLAYERS →`}</button>
    </div>
  );
}

// ─── HAND RANKINGS ─────────────────────────────────────
function HandRankingsView({ onBack }:any){
  return(
    <div style={{ padding:"20px 16px",maxWidth:500,margin:"0 auto" }}>
      <BackButton onBack={onBack}/>
      <div style={{ fontFamily:"'Playfair Display',serif",fontSize:22,color:"#fff",marginBottom:16 }}>Hand Rankings</div>
      {HAND_RANKINGS.map((h,i)=><div key={h.rank} style={{ display:"flex",alignItems:"center",gap:14,padding:"12px 15px",marginBottom:7,background:"rgba(255,255,255,0.03)",border:`1px solid ${h.rank<=2?"rgba(201,168,76,0.25)":"rgba(255,255,255,0.07)"}`,borderRadius:13 }}><div style={{ width:30,height:30,borderRadius:9,background:`${h.color}22`,border:`1px solid ${h.color}44`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Space Mono',monospace",fontWeight:700,color:h.color,fontSize:12,flexShrink:0 }}>{h.rank}</div><div style={{ flex:1 }}><div style={{ color:h.color,fontFamily:"'Playfair Display',serif",fontSize:15,fontWeight:700 }}>{h.name}</div><div style={{ color:"#666",fontSize:11,marginTop:1 }}>{h.desc}</div><div style={{ color:"#444",fontSize:10,fontFamily:"'Space Mono',monospace",marginTop:2,letterSpacing:1 }}>{h.example}</div></div>{h.rank<=3&&<div style={{ fontSize:16,flexShrink:0 }}>{["👑","⭐","💎"][i]}</div>}</div>)}
    </div>
  );
}

// ─── COMMISSIONER SETTINGS ─────────────────────────────
function CommSettingsView({ league, players, onBack, onLeagueUpdated, onLeagueDeleted, showToast, showError }:any){
  const [buyIn,setBuyIn]=useState(String(league.buy_in));const [season,setSeason]=useState(league.season);const [seasonLength,setSeasonLength]=useState(String(league.season_length||0));const [description,setDescription]=useState(league.description||"");const [isPublic,setIsPublic]=useState(league.is_public||false);const [locationName,setLocationName]=useState(league.location_name||"");const [maxPlayers,setMaxPlayers]=useState(league.max_players||12);const [saving,setSaving]=useState(false);const [confirmDelete,setConfirmDelete]=useState(false);
  const handleSave=async()=>{if(!db)return;setSaving(true);const{data,error}=await db.from("leagues").update({buy_in:Number(buyIn),season,season_length:Number(seasonLength),description,is_public:isPublic,location_name:locationName||null,max_players:maxPlayers}).eq("id",league.id).select().single();if(error)showError(error.message);else{showToast("Settings saved!");onLeagueUpdated(data);}setSaving(false);};
  const handleKick=async(playerId:string,playerName:string)=>{if(!db)return;if(!window.confirm(`Kick ${playerName}?`))return;await db.from("players").delete().eq("id",playerId);showToast(`${playerName} removed.`);onLeagueUpdated(league);};
  const handleDelete=async()=>{if(!db)return;await db.from("leagues").delete().eq("id",league.id);showToast("League deleted.");onLeagueDeleted();};
  return(
    <div style={{ padding:"20px 16px",maxWidth:500,margin:"0 auto" }}>
      <BackButton onBack={onBack}/>
      <div style={{ fontFamily:"'Playfair Display',serif",fontSize:22,color:"#fff",marginBottom:18 }}>👑 Manage {league.name}</div>
      <Card style={{ marginBottom:12 }}>
        <div style={{ color:"#888",fontSize:11,fontFamily:"'Space Mono',monospace",letterSpacing:2,marginBottom:12 }}>LEAGUE SETTINGS</div>
        {([["DESCRIPTION","text",description,setDescription,"League description"],["SEASON NAME","text",season,setSeason,"Season 1"],["LOCATION","text",locationName,setLocationName,"e.g. San Francisco, CA"]] as any[]).map(([label,type,val,setter,ph])=><div key={label} style={{ marginBottom:10 }}><label style={{ color:"#888",fontSize:11,fontFamily:"'Space Mono',monospace",letterSpacing:1.5,display:"block",marginBottom:6 }}>{label}</label><input type={type} value={val} onChange={e=>setter(e.target.value)} placeholder={ph} style={inp}/></div>)}
        <div style={{ display:"flex",gap:10,marginBottom:10 }}><div style={{ flex:1 }}><label style={{ color:"#888",fontSize:11,fontFamily:"'Space Mono',monospace",letterSpacing:1.5,display:"block",marginBottom:6 }}>DEFAULT BUY-IN ($)</label><input type="number" value={buyIn} onChange={e=>setBuyIn(e.target.value)} style={inp}/></div><div style={{ flex:1 }}><label style={{ color:"#888",fontSize:11,fontFamily:"'Space Mono',monospace",letterSpacing:1.5,display:"block",marginBottom:6 }}>SEASON LENGTH</label><input type="number" value={seasonLength} onChange={e=>setSeasonLength(e.target.value)} style={inp}/></div></div>
        <div style={{ marginBottom:12 }}><label style={{ color:"#888",fontSize:11,fontFamily:"'Space Mono',monospace",letterSpacing:1.5,display:"block",marginBottom:6 }}>MAX PLAYERS</label><div style={{ display:"flex",gap:6 }}>{MAX_PLAYER_OPTIONS.map(n=><button key={n} onClick={()=>setMaxPlayers(n)} style={{ flex:1,padding:"8px 0",borderRadius:10,background:maxPlayers===n?"rgba(201,168,76,0.2)":"rgba(255,255,255,0.04)",border:`1px solid ${maxPlayers===n?"rgba(201,168,76,0.4)":"rgba(255,255,255,0.08)"}`,color:maxPlayers===n?"#C9A84C":"#555",fontFamily:"'Space Mono',monospace",fontSize:12,cursor:"pointer" }}>{n}</button>)}</div></div>
        <Toggle value={isPublic} onChange={setIsPublic} label="Public League 🌍" sub="Anyone can find & join without a code"/>
        <button onClick={handleSave} disabled={saving} style={{ width:"100%",padding:"12px 0",background:"linear-gradient(135deg,#C9A84C,#E8C56A)",border:"none",borderRadius:10,color:"#0A0A0A",fontFamily:"'Space Mono',monospace",fontWeight:700,fontSize:13,letterSpacing:2,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:10 }}>{saving?<Spinner size={16}/>:"SAVE SETTINGS ✓"}</button>
      </Card>
      <Card style={{ marginBottom:12 }}><div style={{ color:"#888",fontSize:11,fontFamily:"'Space Mono',monospace",letterSpacing:2,marginBottom:12 }}>PLAYERS ({players.length}/{maxPlayers})</div>{players.map((p:any,i:number)=>{const isComm=p.name.toLowerCase()===league.commissioner_name?.toLowerCase();return<div key={p.id} style={{ display:"flex",alignItems:"center",gap:10,padding:"9px 0",borderBottom:i<players.length-1?"1px solid rgba(255,255,255,0.05)":"none" }}><Avatar name={p.name} size={32}/><div style={{ flex:1 }}><div style={{ color:"#fff",display:"flex",alignItems:"center",gap:5 }}>{p.name} {isComm&&<span>👑</span>}</div><div style={{ color:"#555",fontSize:10,fontFamily:"'Space Mono',monospace" }}>{p.session_count} sessions · {p.total_profit>=0?"+":""}${p.total_profit}</div></div>{!isComm&&<button onClick={()=>handleKick(p.id,p.name)} style={{ padding:"4px 10px",background:"rgba(224,85,85,0.1)",border:"1px solid rgba(224,85,85,0.25)",borderRadius:20,color:"#E05555",fontFamily:"'Space Mono',monospace",fontSize:10,cursor:"pointer" }}>KICK</button>}</div>;})}
      </Card>
      <Card><div style={{ color:"#E05555",fontSize:11,fontFamily:"'Space Mono',monospace",letterSpacing:2,marginBottom:10 }}>DANGER ZONE</div>{!confirmDelete?<button onClick={()=>setConfirmDelete(true)} style={{ width:"100%",padding:"12px 0",background:"rgba(224,85,85,0.06)",border:"1px solid rgba(224,85,85,0.2)",borderRadius:10,color:"#E05555",fontFamily:"'Space Mono',monospace",fontSize:12,letterSpacing:1.5,cursor:"pointer" }}>DELETE THIS LEAGUE</button>:<div><div style={{ color:"#E05555",fontSize:13,marginBottom:12,textAlign:"center",lineHeight:1.6 }}>Permanently delete all sessions, standings, and posts? Cannot be undone.</div><div style={{ display:"flex",gap:10 }}><button onClick={()=>setConfirmDelete(false)} style={{ flex:1,padding:"11px 0",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,color:"#888",fontFamily:"'Space Mono',monospace",fontSize:12,cursor:"pointer" }}>CANCEL</button><button onClick={handleDelete} style={{ flex:1,padding:"11px 0",background:"rgba(224,85,85,0.2)",border:"1px solid rgba(224,85,85,0.4)",borderRadius:10,color:"#E05555",fontFamily:"'Space Mono',monospace",fontWeight:700,fontSize:12,cursor:"pointer" }}>DELETE</button></div></div>}</Card>
    </div>
  );
}

// ─── FEED TAB ──────────────────────────────────────────
function FeedView({ profile, myLeagues }:any){
  const [posts,setPosts]=useState<any[]>([]);const [loading,setLoading]=useState(true);
  const [newPost,setNewPost]=useState("");const [selectedLeagueId,setSelectedLeagueId]=useState(myLeagues[0]?.id||"");
  const [uploading,setUploading]=useState(false);const [mediaFile,setMediaFile]=useState<File|null>(null);const [mediaPreview,setMediaPreview]=useState<string|null>(null);
  const [editingPost,setEditingPost]=useState<string|null>(null);const [editContent,setEditContent]=useState("");
  const fileRef=useRef<HTMLInputElement>(null);
  useEffect(()=>{loadPosts();},[]);
  const loadPosts=async()=>{
    if(!db||myLeagues.length===0){setLoading(false);return;}setLoading(true);
    const name=profile.display_name;const{data:friendData}=await db.from("friends").select("*").or(`requester_name.ilike.${name},recipient_name.ilike.${name}`).eq("status","accepted");
    const mutualNames=new Set<string>([name.toLowerCase()]);(friendData||[]).forEach((f:any)=>{mutualNames.add(f.requester_name.toLowerCase());mutualNames.add(f.recipient_name.toLowerCase());});
    const ids=myLeagues.map((l:any)=>l.id);const{data}=await db.from("posts").select("*").in("league_id",ids).order("created_at",{ascending:false});
    setPosts((data||[]).filter((p:any)=>mutualNames.has(p.author_name.toLowerCase())));setLoading(false);
  };
  const getLeagueName=(id:string)=>myLeagues.find((l:any)=>l.id===id)?.name||"Unknown";
  const timeAgo=(ts:string)=>{const diff=Date.now()-new Date(ts).getTime();const m=Math.floor(diff/60000),h=Math.floor(m/60),d=Math.floor(h/24);if(d>0)return`${d}d`;if(h>0)return`${h}h`;if(m>0)return`${m}m`;return"now";};
  const handleMedia=(e:any)=>{const f=e.target.files?.[0];if(!f)return;setMediaFile(f);setMediaPreview(URL.createObjectURL(f));};
  const handlePost=async()=>{
    if(!db||(!newPost.trim()&&!mediaFile)||!selectedLeagueId)return;setUploading(true);
    try{let mediaUrl=null,mediaType=null;if(mediaFile){const ext=mediaFile.name.split('.').pop();const path=`${selectedLeagueId}/${Date.now()}.${ext}`;const{error:upErr}=await db.storage.from("posts").upload(path,mediaFile);if(!upErr){const{data:urlData}=db.storage.from("posts").getPublicUrl(path);mediaUrl=urlData.publicUrl;mediaType=mediaFile.type.startsWith("video")?"video":"image";}}await db.from("posts").insert({league_id:selectedLeagueId,author_name:profile.display_name,content:newPost.trim()||null,media_url:mediaUrl,media_type:mediaType});setNewPost("");setMediaFile(null);setMediaPreview(null);await loadPosts();}finally{setUploading(false);}
  };
  const handleDelete=async(postId:string)=>{if(!db)return;await db.from("posts").delete().eq("id",postId);await loadPosts();};
  const handleEdit=async(postId:string)=>{if(!db)return;await db.from("posts").update({content:editContent}).eq("id",postId);setEditingPost(null);await loadPosts();};
  const leagueForPost=(lid:string)=>myLeagues.find((l:any)=>l.id===lid);
  const isCommForLeague=(lid:string)=>{const lg=leagueForPost(lid);return lg&&lg.commissioner_name?.toLowerCase()===profile.display_name.toLowerCase();};
  return(
    <div style={{ padding:"20px 16px",maxWidth:500,margin:"0 auto" }}>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18 }}>
        <div style={{ fontFamily:"'Playfair Display',serif",fontSize:24,color:"#fff" }}>Feed</div>
        <div style={{ color:"#555",fontSize:11,fontFamily:"'Space Mono',monospace" }}>you + mutual friends</div>
      </div>
      {myLeagues.length>0&&<Card style={{ marginBottom:16 }}>
        <div style={{ display:"flex",gap:10,marginBottom:10 }}><Avatar name={profile.display_name} url={profile.avatar_url} size={32}/><textarea value={newPost} onChange={e=>setNewPost(e.target.value)} placeholder="Share a moment..." style={{ flex:1,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(201,168,76,0.2)",borderRadius:10,padding:10,color:"#fff",fontFamily:"'Space Mono',monospace",fontSize:12,resize:"none",height:62,outline:"none" }}/></div>
        {myLeagues.length>1&&<div style={{ marginBottom:10 }}><div style={{ color:"#666",fontSize:9,fontFamily:"'Space Mono',monospace",letterSpacing:1.5,marginBottom:5 }}>POST TO</div><div style={{ display:"flex",gap:5,flexWrap:"wrap" }}>{myLeagues.map((lg:any)=><button key={lg.id} onClick={()=>setSelectedLeagueId(lg.id)} style={{ padding:"3px 9px",borderRadius:20,background:selectedLeagueId===lg.id?"rgba(201,168,76,0.2)":"rgba(255,255,255,0.04)",border:`1px solid ${selectedLeagueId===lg.id?"rgba(201,168,76,0.4)":"rgba(255,255,255,0.08)"}`,color:selectedLeagueId===lg.id?"#C9A84C":"#555",fontFamily:"'Space Mono',monospace",fontSize:10,cursor:"pointer" }}>{lg.name}</button>)}</div></div>}
        {mediaPreview&&<div style={{ position:"relative",marginBottom:10 }}>{mediaFile?.type.startsWith("video")?<video src={mediaPreview} controls style={{ width:"100%",borderRadius:10,maxHeight:260 }}/>:<img src={mediaPreview} style={{ width:"100%",borderRadius:10,maxHeight:260,objectFit:"cover" }}/>}<button onClick={()=>{setMediaFile(null);setMediaPreview(null);}} style={{ position:"absolute",top:6,right:6,background:"rgba(0,0,0,0.7)",border:"none",borderRadius:"50%",color:"#fff",width:26,height:26,cursor:"pointer",fontSize:13 }}>×</button></div>}
        <div style={{ display:"flex",gap:8,alignItems:"center" }}><button onClick={()=>fileRef.current?.click()} style={{ padding:"6px 12px",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:20,color:"#888",fontFamily:"'Space Mono',monospace",fontSize:10,cursor:"pointer" }}>📷</button><input ref={fileRef} type="file" accept="image/*,video/*" onChange={handleMedia} style={{ display:"none" }}/><button onClick={handlePost} disabled={uploading||(!newPost.trim()&&!mediaFile)} style={{ marginLeft:"auto",padding:"6px 16px",background:(!newPost.trim()&&!mediaFile)||uploading?"rgba(255,255,255,0.06)":"linear-gradient(135deg,#C9A84C,#E8C56A)",border:"none",borderRadius:20,color:(!newPost.trim()&&!mediaFile)||uploading?"#444":"#0A0A0A",fontFamily:"'Space Mono',monospace",fontWeight:700,fontSize:11,cursor:"pointer",display:"flex",alignItems:"center",gap:6 }}>{uploading?<Spinner size={12}/>:"POST"}</button></div>
      </Card>}
      {loading&&<div style={{ display:"flex",justifyContent:"center",padding:40 }}><Spinner/></div>}
      {!loading&&posts.length===0&&<Card><div style={{ textAlign:"center",padding:"28px 0",color:"#555",fontFamily:"'Space Mono',monospace",fontSize:12 }}>No posts yet.<br/>Add friends from league standings to see their posts!</div></Card>}
      {posts.map((post:any)=>{
        const isMine=post.author_name.toLowerCase()===profile.display_name.toLowerCase();
        const canEdit=isMine||isCommForLeague(post.league_id);
        return<Card key={post.id} style={{ marginBottom:12 }}>
          <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:10 }}><Avatar name={post.author_name} size={32}/><div style={{ flex:1 }}><div style={{ color:"#fff",fontWeight:600 }}>{post.author_name}</div><div style={{ display:"flex",gap:8,alignItems:"center",marginTop:2 }}><span style={{ color:"#C9A84C",fontSize:10,fontFamily:"'Space Mono',monospace",background:"rgba(201,168,76,0.1)",padding:"1px 7px",borderRadius:10 }}>{getLeagueName(post.league_id)}</span><span style={{ color:"#555",fontSize:10,fontFamily:"'Space Mono',monospace" }}>{timeAgo(post.created_at)}</span></div></div>{canEdit&&<div style={{ display:"flex",gap:6 }}>{isMine&&<button onClick={()=>{setEditingPost(post.id);setEditContent(post.content||"");}} style={{ background:"none",border:"none",color:"#555",fontSize:11,cursor:"pointer",fontFamily:"'Space Mono',monospace" }}>EDIT</button>}<button onClick={()=>handleDelete(post.id)} style={{ background:"none",border:"none",color:"#E05555",fontSize:11,cursor:"pointer",fontFamily:"'Space Mono',monospace" }}>DEL</button></div>}</div>
          {editingPost===post.id?<div><textarea value={editContent} onChange={e=>setEditContent(e.target.value)} style={{ width:"100%",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(201,168,76,0.2)",borderRadius:10,padding:10,color:"#fff",fontFamily:"'Space Mono',monospace",fontSize:12,resize:"none",height:62,outline:"none",marginBottom:8 }}/><div style={{ display:"flex",gap:8 }}><button onClick={()=>setEditingPost(null)} style={{ padding:"6px 14px",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:20,color:"#888",fontFamily:"'Space Mono',monospace",fontSize:11,cursor:"pointer" }}>Cancel</button><button onClick={()=>handleEdit(post.id)} style={{ padding:"6px 14px",background:"rgba(201,168,76,0.15)",border:"1px solid rgba(201,168,76,0.3)",borderRadius:20,color:"#C9A84C",fontFamily:"'Space Mono',monospace",fontSize:11,cursor:"pointer" }}>Save</button></div></div>
          :<>{post.content&&<div style={{ color:"#ccc",fontSize:13,lineHeight:1.6,marginBottom:post.media_url?10:0 }}>{post.content}</div>}{post.media_url&&(post.media_type==="video"?<video src={post.media_url} controls style={{ width:"100%",borderRadius:10,maxHeight:340 }}/>:<img src={post.media_url} style={{ width:"100%",borderRadius:10,maxHeight:340,objectFit:"cover" }}/>)}</>}
        </Card>;
      })}
    </div>
  );
}

// ─── PROFILE TAB (own view + others' view) ─────────────
function ProfileTabView({ profile, myLeagues, isSelf, onSettings, onFriends, onGlobalLeaderboard, onSendFriendRequest, externalPlayerName }:any){
  const [allStats,setAllStats]=useState<any>(null);const [loading,setLoading]=useState(true);
  const [friendCount,setFriendCount]=useState(0);const [editing,setEditing]=useState(false);
  const [newName,setNewName]=useState(profile?.display_name||"");const [savingName,setSavingName]=useState(false);
  const [uploadingAvatar,setUploadingAvatar]=useState(false);const [optIn,setOptIn]=useState(profile?.opt_in_global||false);
  const [msg,setMsg]=useState("");const [viewingFriend,setViewingFriend]=useState("");
  const fileRef=useRef<HTMLInputElement>(null);
  const displayName=isSelf?profile.display_name:externalPlayerName;

  useEffect(()=>{loadStats();},[displayName]);

  const loadStats=async()=>{
    if(!db||!displayName)return;setLoading(true);
    const[{data:rows},{data:friendData}]=await Promise.all([db.from("players").select("*").ilike("name",displayName),db.from("friends").select("*").or(`requester_name.ilike.${displayName},recipient_name.ilike.${displayName}`).eq("status","accepted")]);
    setFriendCount((friendData||[]).length);
    if(!rows||rows.length===0){setAllStats({total_profit:0,sessions:0,wins:0,best_night:0,leagues:0,time_seconds:0,chicken_dinners:0,avg:0,losses:0});setLoading(false);return;}
    const total_profit=rows.reduce((a:number,p:any)=>a+(p.total_profit||0),0);
    const sessions=rows.reduce((a:number,p:any)=>a+(p.session_count||0),0);
    const wins=rows.reduce((a:number,p:any)=>a+(p.wins||0),0);
    const best_night=Math.max(0,...rows.map((p:any)=>p.best_night||0));
    const time_seconds=rows.reduce((a:number,p:any)=>a+(p.time_played_seconds||0),0);
    const chicken_dinners=rows.reduce((a:number,p:any)=>a+(p.chicken_dinners||0),0);
    setAllStats({total_profit,sessions,wins,losses:sessions-wins,best_night,leagues:rows.length,time_seconds,chicken_dinners,avg:sessions>0?total_profit/sessions:0});
    setLoading(false);
  };

  const handleSaveName=async()=>{if(!db||!newName.trim()||newName.trim()===profile.display_name)return;setSavingName(true);const{error}=await db.from("profiles").update({display_name:newName.trim()}).eq("id",profile.id);if(!error){setMsg("Name updated!");profile.display_name=newName.trim();setTimeout(()=>setMsg(""),3000);}setSavingName(false);};
  const handleOptIn=async(val:boolean)=>{if(!db)return;setOptIn(val);await db.from("profiles").update({opt_in_global:val}).eq("id",profile.id);setMsg(val?"You're on the global leaderboard!":"Removed from leaderboard.");setTimeout(()=>setMsg(""),3000);};
  const handleAvatar=async(e:any)=>{const f=e.target.files?.[0];if(!f||!db)return;setUploadingAvatar(true);try{const ext=f.name.split('.').pop();const path=`${profile.id}/avatar.${ext}`;await db.storage.from("avatars").upload(path,f,{upsert:true});const{data:urlData}=db.storage.from("avatars").getPublicUrl(path);const avatarUrl=urlData.publicUrl+"?t="+Date.now();await db.from("profiles").update({avatar_url:avatarUrl}).eq("id",profile.id);profile.avatar_url=avatarUrl;setMsg("Photo updated!");setTimeout(()=>setMsg(""),3000);}finally{setUploadingAvatar(false);}};

  const isUp=(allStats?.total_profit||0)>=0;

  return(
    <div style={{ padding:"20px 16px",maxWidth:500,margin:"0 auto" }}>
      {/* Header */}
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20 }}>
        <div style={{ fontFamily:"'Playfair Display',serif",fontSize:24,color:"#fff" }}>Profile</div>
        {isSelf&&<div style={{ display:"flex",gap:8 }}>
          <button onClick={onFriends} style={{ padding:"6px 12px",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:20,color:"#888",fontFamily:"'Space Mono',monospace",fontSize:10,cursor:"pointer" }}>FRIENDS</button>
          <button onClick={()=>setEditing(!editing)} style={{ padding:"6px 12px",background:editing?"rgba(201,168,76,0.15)":"rgba(255,255,255,0.04)",border:`1px solid ${editing?"rgba(201,168,76,0.3)":"rgba(255,255,255,0.1)"}`,borderRadius:20,color:editing?"#C9A84C":"#888",fontFamily:"'Space Mono',monospace",fontSize:10,cursor:"pointer" }}>EDIT</button>
        </div>}
        {!isSelf&&<button onClick={()=>onSendFriendRequest&&onSendFriendRequest(displayName)} style={{ padding:"7px 16px",background:"rgba(201,168,76,0.1)",border:"1px solid rgba(201,168,76,0.3)",borderRadius:20,color:"#C9A84C",fontFamily:"'Space Mono',monospace",fontSize:10,cursor:"pointer",letterSpacing:1 }}>+ ADD FRIEND</button>}
      </div>

      {/* Avatar + name */}
      <div style={{ textAlign:"center",marginBottom:20 }}>
        <div style={{ position:"relative",display:"inline-block" }}>
          <Avatar name={displayName} url={isSelf?profile.avatar_url:null} size={80}/>
          {isSelf&&editing&&<button onClick={()=>fileRef.current?.click()} style={{ position:"absolute",bottom:0,right:0,width:28,height:28,borderRadius:"50%",background:"#C9A84C",border:"2px solid #0A0A0A",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:14 }}>{uploadingAvatar?<Spinner size={12}/>:"📷"}</button>}
          {isSelf&&<input ref={fileRef} type="file" accept="image/*" onChange={handleAvatar} style={{ display:"none" }}/>}
        </div>
        {isSelf&&editing?(
          <div style={{ marginTop:12,display:"flex",gap:8,justifyContent:"center",alignItems:"center" }}>
            <input value={newName} onChange={e=>setNewName(e.target.value)} style={{ ...inp,width:220,fontSize:16,textAlign:"center",fontFamily:"'Playfair Display',serif" }}/>
            <button onClick={handleSaveName} disabled={savingName||!newName.trim()||newName.trim()===profile.display_name} style={{ padding:"10px 14px",background:"rgba(201,168,76,0.15)",border:"1px solid rgba(201,168,76,0.3)",borderRadius:10,color:"#C9A84C",fontFamily:"'Space Mono',monospace",fontSize:11,cursor:"pointer" }}>{savingName?"...":"✓"}</button>
          </div>
        ):(
          <div style={{ fontFamily:"'Playfair Display',serif",fontSize:24,color:"#fff",marginTop:12 }}>{displayName}</div>
        )}
        {msg&&<div style={{ color:"#4CAF8C",fontSize:11,fontFamily:"'Space Mono',monospace",marginTop:6 }}>✓ {msg}</div>}
        <div style={{ display:"flex",justifyContent:"center",gap:16,marginTop:8 }}>
          <div style={{ color:"#555",fontSize:11,fontFamily:"'Space Mono',monospace" }}>{allStats?.leagues||0} leagues</div>
          <div style={{ color:"#555",fontSize:11,fontFamily:"'Space Mono',monospace" }}>{friendCount} friends</div>
        </div>
        {!loading&&allStats&&<><div style={{ color:isUp?"#4CAF8C":"#E05555",fontSize:34,fontFamily:"'Space Mono',monospace",fontWeight:700,marginTop:12 }}>{isUp?"+":""}${allStats.total_profit}</div><div style={{ color:"#555",fontSize:11,fontFamily:"'Space Mono',monospace" }}>all-time profit</div></>}
        {loading&&<div style={{ display:"flex",justifyContent:"center",marginTop:16 }}><Spinner/></div>}
      </div>

      {!loading&&allStats&&<>
        <div style={{ display:"flex",gap:8,marginBottom:10 }}>
          <StatBox label="Sessions" value={allStats.sessions}/>
          <StatBox label="Wins" value={allStats.wins} accent="#4CAF8C"/>
          <StatBox label="Win %" value={allStats.sessions>0?`${((allStats.wins/allStats.sessions)*100).toFixed(0)}%`:"—"} accent="#5577CC"/>
          <StatBox label="Best Night" value={`$${allStats.best_night}`}/>
        </div>
        <div style={{ display:"flex",gap:8,marginBottom:16 }}>
          <StatBox label="Time Played" value={allStats.time_seconds>0?fmtSeconds(allStats.time_seconds):"—"} accent="#888"/>
          <StatBox label="🍗 Dinners" value={allStats.chicken_dinners} accent="#C9A84C"/>
          <StatBox label="Avg / Game" value={allStats.sessions>0?`${allStats.avg>=0?"+":""}$${Math.abs(allStats.avg).toFixed(0)}`:"—"} accent={allStats.avg>=0?"#4CAF8C":"#E05555"}/>
        </div>
        <Card style={{ marginBottom:12 }}>
          {([["All-time profit",`${isUp?"+":""}$${allStats.total_profit}`,isUp?"#4CAF8C":"#E05555"],["Sessions won",`${allStats.wins}`,"#4CAF8C"],["Sessions lost",`${allStats.losses}`,"#E05555"],["Biggest single win",`$${allStats.best_night}`,"#C9A84C"],["Chicken dinners 🍗",`${allStats.chicken_dinners}`,"#C9A84C"],["Time at the table",allStats.time_seconds>0?fmtSeconds(allStats.time_seconds):"—","#888"]] as any[]).map(([label,val,col]:any,i:number,arr:any[])=><div key={label} style={{ display:"flex",justifyContent:"space-between",padding:"9px 0",borderBottom:i<arr.length-1?"1px solid rgba(255,255,255,0.05)":"none" }}><span style={{ color:"#555",fontFamily:"'Space Mono',monospace",fontSize:12 }}>{label}</span><span style={{ color:col,fontFamily:"'Space Mono',monospace",fontWeight:700 }}>{val}</span></div>)}
        </Card>
      </>}

      {/* My leagues (own profile only) */}
      {isSelf&&!loading&&myLeagues.length>0&&<Card style={{ marginBottom:12 }}>
        <div style={{ color:"#888",fontSize:11,fontFamily:"'Space Mono',monospace",letterSpacing:2,marginBottom:12 }}>MY LEAGUES</div>
        {myLeagues.map((lg:any,i:number)=><div key={lg.id} style={{ display:"flex",alignItems:"center",gap:10,padding:"9px 0",borderBottom:i<myLeagues.length-1?"1px solid rgba(255,255,255,0.05)":"none" }}><div style={{ width:32,height:32,borderRadius:8,background:"rgba(201,168,76,0.1)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:15 }}>{lg.is_public?"🌍":"♠"}</div><div style={{ flex:1 }}><div style={{ color:"#fff",fontSize:13 }}>{lg.name}</div><div style={{ color:"#555",fontSize:11,fontFamily:"'Space Mono',monospace" }}>{lg.season}</div></div>{lg.commissioner_id===lg._myUserId&&<span style={{ fontSize:13 }}>👑</span>}</div>)}
      </Card>}

      {/* Own profile settings section */}
      {isSelf&&editing&&<>
        <Card style={{ marginBottom:12 }}>
          <div style={{ color:"#888",fontSize:11,fontFamily:"'Space Mono',monospace",letterSpacing:2,marginBottom:10 }}>GLOBAL LEADERBOARD</div>
          <Toggle value={optIn} onChange={handleOptIn} label="Show me on Global Leaderboard 🏆" sub={`Requires ${HOURS_REQUIRED_GLOBAL}+ hours of league play.`}/>
          <button onClick={onGlobalLeaderboard} style={{ width:"100%",padding:"10px 0",background:"rgba(201,168,76,0.08)",border:"1px solid rgba(201,168,76,0.2)",borderRadius:10,color:"#C9A84C",fontFamily:"'Space Mono',monospace",fontSize:11,letterSpacing:1.5,cursor:"pointer" }}>VIEW GLOBAL LEADERBOARD →</button>
        </Card>
        <Card style={{ marginBottom:12 }}>
          <div style={{ color:"#888",fontSize:11,fontFamily:"'Space Mono',monospace",letterSpacing:2,marginBottom:6 }}>ACCOUNT</div>
          <div style={{ color:"#555",fontSize:12,fontFamily:"'Space Mono',monospace",marginBottom:6 }}>{profile.email}</div>
          <div style={{ color:"#444",fontSize:11,lineHeight:1.6 }}>To change your password, sign out and use "Forgot password?" on the login screen.</div>
        </Card>
        <button onClick={onSettings} style={{ width:"100%",padding:"13px 0",marginBottom:12,background:"rgba(224,85,85,0.08)",border:"1px solid rgba(224,85,85,0.25)",borderRadius:12,color:"#E05555",fontFamily:"'Space Mono',monospace",fontWeight:700,fontSize:13,letterSpacing:2,cursor:"pointer" }}>SIGN OUT</button>
      </>}
    </div>
  );
}

// ─── FRIENDS ───────────────────────────────────────────
function FriendsView({ profile, onBack, onViewFriendProfile }:any){
  const [friends,setFriends]=useState<any[]>([]);const [pending,setPending]=useState<any[]>([]);const [loading,setLoading]=useState(true);
  useEffect(()=>{loadFriends();},[]);
  const loadFriends=async()=>{if(!db)return;setLoading(true);const name=profile.display_name;const{data}=await db.from("friends").select("*").or(`requester_name.ilike.${name},recipient_name.ilike.${name}`);const all=data||[];setFriends(all.filter((f:any)=>f.status==="accepted"));setPending(all.filter((f:any)=>f.status==="pending"&&f.recipient_name.toLowerCase()===name.toLowerCase()));setLoading(false);};
  const accept=async(id:string)=>{if(!db)return;await db.from("friends").update({status:"accepted"}).eq("id",id);await loadFriends();};
  const decline=async(id:string)=>{if(!db)return;await db.from("friends").delete().eq("id",id);await loadFriends();};
  const getFriendName=(f:any)=>f.requester_name.toLowerCase()===profile.display_name.toLowerCase()?f.recipient_name:f.requester_name;
  return(
    <div style={{ padding:"20px 16px",maxWidth:500,margin:"0 auto" }}>
      <BackButton onBack={onBack}/>
      <div style={{ fontFamily:"'Playfair Display',serif",fontSize:22,color:"#fff",marginBottom:16 }}>Friends</div>
      <div style={{ color:"#555",fontSize:11,fontFamily:"'Space Mono',monospace",marginBottom:14 }}>Add friends from league standings. Mutual friends appear in your feed.</div>
      {loading&&<div style={{ display:"flex",justifyContent:"center",padding:40 }}><Spinner/></div>}
      {!loading&&pending.length>0&&<div style={{ marginBottom:20 }}><div style={{ color:"#888",fontSize:11,fontFamily:"'Space Mono',monospace",letterSpacing:2,marginBottom:10 }}>PENDING ({pending.length})</div>{pending.map((f:any)=><Card key={f.id} style={{ marginBottom:10,display:"flex",alignItems:"center",gap:12 }}><Avatar name={f.requester_name} size={40}/><div style={{ flex:1 }}><div style={{ color:"#fff" }}>{f.requester_name}</div><div style={{ color:"#555",fontSize:11,fontFamily:"'Space Mono',monospace" }}>wants to be friends</div></div><div style={{ display:"flex",gap:8 }}><button onClick={()=>accept(f.id)} style={{ padding:"5px 12px",background:"rgba(76,175,140,0.2)",border:"1px solid rgba(76,175,140,0.4)",borderRadius:20,color:"#4CAF8C",fontFamily:"'Space Mono',monospace",fontSize:11,cursor:"pointer" }}>Accept</button><button onClick={()=>decline(f.id)} style={{ padding:"5px 12px",background:"rgba(224,85,85,0.1)",border:"1px solid rgba(224,85,85,0.3)",borderRadius:20,color:"#E05555",fontFamily:"'Space Mono',monospace",fontSize:11,cursor:"pointer" }}>Decline</button></div></Card>)}</div>}
      <div><div style={{ color:"#888",fontSize:11,fontFamily:"'Space Mono',monospace",letterSpacing:2,marginBottom:10 }}>FRIENDS ({friends.length})</div>{!loading&&friends.length===0&&<Card><div style={{ textAlign:"center",padding:"22px 0",color:"#555",fontFamily:"'Space Mono',monospace",fontSize:12 }}>No friends yet — tap players in league standings!</div></Card>}{friends.map((f:any)=>{const name=getFriendName(f);return<Card key={f.id} style={{ marginBottom:10,display:"flex",alignItems:"center",gap:12,cursor:"pointer" }} onClick={()=>onViewFriendProfile(name)}><Avatar name={name} size={40}/><div style={{ flex:1 }}><div style={{ color:"#fff" }}>{name}</div><div style={{ color:"#4CAF8C",fontSize:11,fontFamily:"'Space Mono',monospace" }}>● Friends · tap to view profile</div></div><span style={{ color:"#555",fontSize:18 }}>›</span></Card>;})}</div>
    </div>
  );
}

// ─── PERSISTENT BOTTOM NAV ─────────────────────────────
function BottomNav({ activeTab, onTab }:{ activeTab:Tab; onTab:(t:Tab)=>void }){
  const tabs=[{key:'league' as Tab,icon:'⬡',label:'League'},{key:'feed' as Tab,icon:'◈',label:'Feed'},{key:'profile' as Tab,icon:'👤',label:'Profile'}];
  return(
    <div style={{ position:"fixed",bottom:0,left:0,right:0,background:"rgba(10,10,10,0.97)",borderTop:"1px solid rgba(201,168,76,0.15)",display:"flex",justifyContent:"space-around",padding:"10px 0 20px",zIndex:100 }}>
      {tabs.map(t=><button key={t.key} onClick={()=>onTab(t.key)} style={{ background:"none",border:"none",display:"flex",flexDirection:"column",alignItems:"center",gap:3,cursor:"pointer",color:activeTab===t.key?"#C9A84C":"#444",flex:1 }}><span style={{ fontSize:20 }}>{t.icon}</span><span style={{ fontFamily:"'Space Mono',monospace",fontSize:10,letterSpacing:1 }}>{t.label}</span></button>)}
    </div>
  );
}

// ─── MAIN APP ──────────────────────────────────────────
export default function HomeGameApp() {
  const [bootstrapping,setBootstrapping]=useState(true);
  const [authUser,setAuthUser]=useState<any>(null);
  const [profile,setProfile]=useState<any>(null);
  const [myLeagues,setMyLeagues]=useState<any[]>([]);
  const [loadingLeagues,setLoadingLeagues]=useState(false);

  // 3-tab navigation
  const [activeTab,setActiveTab]=useState<Tab>('feed');

  // League tab sub-stack
  type LeagueSubView = 'home'|'joinCreate'|'publicLeagues'|'globalLeaderboard'|'leagueDetail'|'newSession'|'liveSession'|'commSettings'|'transferComm'|'handRankings'|'playerProfile';
  const [leagueSubView,setLeagueSubView]=useState<LeagueSubView>('home');
  const [currentLeague,setCurrentLeague]=useState<any>(null);
  const [players,setPlayers]=useState<any[]>([]);
  const [sessions,setSessions]=useState<any[]>([]);
  const [liveSession,setLiveSession]=useState<any>(null);
  const [liveEntries,setLiveEntries]=useState<any[]>([]);
  const [selectedPlayer,setSelectedPlayer]=useState<any>(null);

  // Profile tab sub-stack
  const [profileSubView,setProfileSubView]=useState<'self'|'friends'|'friendProfile'>('self');
  const [viewingFriendName,setViewingFriendName]=useState("");

  // Pinned leagues
  const getPinnedIds=()=>JSON.parse(localStorage.getItem(`hg_pinned_${authUser?.id||'x'}`)||'[]');
  const [pinnedIds,setPinnedIds]=useState<string[]>([]);
  const togglePin=(id:string)=>{const current=getPinnedIds();let next:string[];if(current.includes(id)){next=current.filter((x:string)=>x!==id);}else if(current.length<MAX_PINNED){next=[...current,id];}else return;localStorage.setItem(`hg_pinned_${authUser?.id||'x'}`,JSON.stringify(next));setPinnedIds(next);};

  const [toast,setToast]=useState("");const [error,setError]=useState("");
  const showToast=(msg:string)=>{setToast(msg);setTimeout(()=>setToast(""),3000);};
  const showError=(msg:string)=>{setError(msg);setTimeout(()=>setError(""),4000);};

  const isCommissioner=currentLeague?(authUser?.id===currentLeague.commissioner_id||profile?.display_name?.toLowerCase()===currentLeague.commissioner_name?.toLowerCase()):false;

  useEffect(()=>{
    if(!db){setBootstrapping(false);return;}
    db.auth.getSession().then(async({data:{session}})=>{if(session?.user){setAuthUser(session.user);setPinnedIds(JSON.parse(localStorage.getItem(`hg_pinned_${session.user.id}`)||'[]'));await loadProfile(session.user);}else setBootstrapping(false);});
    const{data:{subscription}}=db.auth.onAuthStateChange(async(_event,session)=>{if(session?.user){setAuthUser(session.user);setPinnedIds(JSON.parse(localStorage.getItem(`hg_pinned_${session.user.id}`)||'[]'));await loadProfile(session.user);}else{setAuthUser(null);setProfile(null);setBootstrapping(false);}});
    return()=>subscription.unsubscribe();
  },[]);

  const loadProfile=async(user:any)=>{
    if(!db)return;const{data}=await db.from("profiles").select("*").eq("id",user.id).single();
    if(data){setProfile({...data,email:user.email});await loadMyLeagues(data.display_name,user.id);}
    setBootstrapping(false);
  };

  const loadMyLeagues=async(displayName:string,userId:string)=>{
    if(!db)return;setLoadingLeagues(true);
    try{const{data:rows}=await db.from("players").select("league_id").ilike("name",displayName);const dbIds=(rows||[]).map((r:any)=>r.league_id);const stored=JSON.parse(localStorage.getItem(`hg_leagues_${userId}`)||'[]');const allIds=[...new Set([...dbIds,...stored])];if(allIds.length>0){const{data:leagues}=await db.from("leagues").select("*").in("id",allIds);setMyLeagues((leagues||[]).map((lg:any)=>({...lg,_myUserId:userId})));}else setMyLeagues([]);}
    finally{setLoadingLeagues(false);}
  };

  const loadLeagueData=async(lgId:string)=>{
    if(!db)return;
    const[{data:pData},{data:sData},{data:lsData}]=await Promise.all([db.from("players").select("*").eq("league_id",lgId).order("total_profit",{ascending:false}),db.from("sessions").select("*").eq("league_id",lgId).order("created_at",{ascending:false}),db.from("sessions").select("*").eq("league_id",lgId).eq("is_live",true).limit(1)]);
    setPlayers(pData||[]);setSessions((sData||[]).filter((s:any)=>!s.is_live));
    if(lsData&&lsData.length>0){setLiveSession(lsData[0]);const{data:le}=await db!.from("live_entries").select("*").eq("session_id",lsData[0].id);setLiveEntries(le||[]);}
    else{setLiveSession(null);setLiveEntries([]);}
  };

  useEffect(()=>{
    if(!currentLeague||leagueSubView!=='liveSession'||!liveSession)return;
    const interval=setInterval(async()=>{const{data}=await db!.from("live_entries").select("*").eq("session_id",liveSession.id);setLiveEntries(data||[]);},8000);
    return()=>clearInterval(interval);
  },[currentLeague,leagueSubView,liveSession]);

  const handleSelectLeague=async(lg:any)=>{setCurrentLeague(lg);await loadLeagueData(lg.id);setLeagueSubView('leagueDetail');};

  const handleJoinCreate=async({tab,code,leagueName,description,buyIn,season,seasonLength,isPublic,locationName,maxPlayers}:any)=>{
    if(!db||!authUser||!profile)return;setLoadingLeagues(true);
    try{
      if(tab==="join"){
        const{data:leagues}=await db.from("leagues").select("*").eq("code",code.trim()).limit(1);
        if(!leagues||leagues.length===0){showError("League not found.");return;}
        const lg=leagues[0];
        const{data:existing}=await db.from("players").select("*").eq("league_id",lg.id).ilike("name",profile.display_name).limit(1);
        if(existing&&existing.length>0){showError("You're already in this league!");return;}
        const{data:cp}=await db.from("players").select("id").eq("league_id",lg.id);
        if((cp||[]).length>=(lg.max_players||12)){showError(`League is full (${lg.max_players||12} max).`);return;}
        await db.from("players").insert({league_id:lg.id,name:profile.display_name,total_profit:0,session_count:0,wins:0,best_night:0,streak:0,chicken_dinners:0,time_played_seconds:0});
        const stored=JSON.parse(localStorage.getItem(`hg_leagues_${authUser.id}`)||'[]');if(!stored.includes(lg.id)){stored.push(lg.id);localStorage.setItem(`hg_leagues_${authUser.id}`,JSON.stringify(stored));}
        await loadMyLeagues(profile.display_name,authUser.id);setCurrentLeague({...lg,_myUserId:authUser.id});await loadLeagueData(lg.id);setLeagueSubView('leagueDetail');
      }else{
        const genCode=profile.display_name.toUpperCase().replace(/\s/g,"").slice(0,3)+Math.floor(1000+Math.random()*9000);
        const{data:lg,error:lgErr}=await db.from("leagues").insert({name:leagueName,description:description||null,code:genCode,commissioner_name:profile.display_name,commissioner_id:authUser.id,buy_in:buyIn,season,season_length:seasonLength||0,is_public:isPublic||false,location_name:locationName||null,max_players:maxPlayers||12}).select().single();
        if(lgErr)throw lgErr;
        await db.from("players").insert({league_id:lg.id,name:profile.display_name,total_profit:0,session_count:0,wins:0,best_night:0,streak:0,chicken_dinners:0,time_played_seconds:0});
        const stored=JSON.parse(localStorage.getItem(`hg_leagues_${authUser.id}`)||'[]');stored.push(lg.id);localStorage.setItem(`hg_leagues_${authUser.id}`,JSON.stringify(stored));
        await loadMyLeagues(profile.display_name,authUser.id);setCurrentLeague({...lg,_myUserId:authUser.id});await loadLeagueData(lg.id);setLeagueSubView('leagueDetail');
      }
    }catch(e:any){showError(e.message||"Something went wrong.");}finally{setLoadingLeagues(false);}
  };

  const handleJoinPublic=async(lg:any)=>{
    if(!db||!authUser||!profile)return;setLoadingLeagues(true);
    try{
      const{data:cp}=await db.from("players").select("id").eq("league_id",lg.id);
      if((cp||[]).length>=(lg.max_players||12)){showError(`League is full.`);return;}
      const{data:existing}=await db.from("players").select("*").eq("league_id",lg.id).ilike("name",profile.display_name).limit(1);
      if(!existing||existing.length===0)await db.from("players").insert({league_id:lg.id,name:profile.display_name,total_profit:0,session_count:0,wins:0,best_night:0,streak:0,chicken_dinners:0,time_played_seconds:0});
      const stored=JSON.parse(localStorage.getItem(`hg_leagues_${authUser.id}`)||'[]');if(!stored.includes(lg.id)){stored.push(lg.id);localStorage.setItem(`hg_leagues_${authUser.id}`,JSON.stringify(stored));}
      await loadMyLeagues(profile.display_name,authUser.id);setCurrentLeague({...lg,_myUserId:authUser.id});await loadLeagueData(lg.id);setLeagueSubView('leagueDetail');
    }finally{setLoadingLeagues(false);}
  };

  const handleLeaveLeague=async()=>{
    if(!db||!currentLeague||!profile||!authUser)return;
    const isComm=authUser.id===currentLeague.commissioner_id||profile.display_name.toLowerCase()===currentLeague.commissioner_name?.toLowerCase();
    if(isComm){if(players.length<=1){if(window.confirm("You're the only member. Delete this league?"))await db.from("leagues").delete().eq("id",currentLeague.id);}else{setLeagueSubView('transferComm');}return;}
    if(!window.confirm(`Leave ${currentLeague.name}?`))return;
    const myPlayer=players.find((p:any)=>p.name.toLowerCase()===profile.display_name.toLowerCase());
    if(myPlayer)await db.from("players").delete().eq("id",myPlayer.id);
    const stored:string[]=JSON.parse(localStorage.getItem(`hg_leagues_${authUser.id}`)||'[]');localStorage.setItem(`hg_leagues_${authUser.id}`,JSON.stringify(stored.filter((id:string)=>id!==currentLeague.id)));
    await loadMyLeagues(profile.display_name,authUser.id);showToast("You left the league.");setCurrentLeague(null);setLeagueSubView('home');
  };

  const handleTransferAndLeave=async()=>{
    if(!db||!currentLeague||!profile||!authUser)return;
    const myPlayer=players.find((p:any)=>p.name.toLowerCase()===profile.display_name.toLowerCase());
    if(myPlayer)await db.from("players").delete().eq("id",myPlayer.id);
    const stored:string[]=JSON.parse(localStorage.getItem(`hg_leagues_${authUser.id}`)||'[]');localStorage.setItem(`hg_leagues_${authUser.id}`,JSON.stringify(stored.filter((id:string)=>id!==currentLeague.id)));
    await loadMyLeagues(profile.display_name,authUser.id);showToast("League transferred. You left.");setCurrentLeague(null);setLeagueSubView('home');
  };

  const handleStartSession=async({selectedIds,sessionBuyIn}:any)=>{
    if(!db||!currentLeague||!profile)return;
    const{data:session,error}=await db.from("sessions").insert({league_id:currentLeague.id,pot:0,status:"live",buy_in_amount:sessionBuyIn,is_live:true,started_at:new Date().toISOString()}).select().single();
    if(error){showError(error.message);return;}
    const sel=players.filter((p:any)=>selectedIds.includes(p.id));
    await db.from("live_entries").insert(sel.map((p:any)=>({session_id:session.id,player_id:p.id,player_name:p.name,buy_in:sessionBuyIn,rebuys:0})));
    await db.from("posts").insert({league_id:currentLeague.id,author_name:profile.display_name,content:`🃏 Game is live! Buy-in: $${sessionBuyIn} · ${sel.length} players seated. Join from the league tab!`});
    setLiveSession(session);const{data:le}=await db.from("live_entries").select("*").eq("session_id",session.id);setLiveEntries(le||[]);
    showToast("Session started! Posted to feed.");setLeagueSubView('liveSession');
  };

  const handleSubmitEntry=async({player_id,player_name,buy_in,rebuys}:any)=>{
    if(!db||!liveSession)return;
    await db.from("live_entries").upsert({session_id:liveSession.id,player_id,player_name,buy_in,rebuys,updated_at:new Date().toISOString()},{onConflict:"session_id,player_id"});
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
        const won=e.profit>0?1:0;const isChicken=chickenDinner&&e.player_name.toLowerCase()===chickenDinner.toLowerCase()?1:0;
        await db.from("players").update({total_profit:(p.total_profit||0)+e.profit,session_count:(p.session_count||0)+1,wins:(p.wins||0)+won,best_night:e.profit>(p.best_night||0)?e.profit:(p.best_night||0),streak:won?(p.streak||0)+1:0,chicken_dinners:(p.chicken_dinners||0)+isChicken,time_played_seconds:(p.time_played_seconds||0)+elapsed}).eq("id",e.player_id);
        const{data:prof}=await db.from("profiles").select("*").ilike("display_name",p.name).single();
        if(prof&&prof.opt_in_global){await db.from("profiles").update({global_total_profit:(prof.global_total_profit||0)+e.profit,global_sessions:(prof.global_sessions||0)+1,global_wins:(prof.global_wins||0)+won,global_time_seconds:(prof.global_time_seconds||0)+elapsed,chicken_dinners:(prof.chicken_dinners||0)+isChicken}).eq("id",prof.id);}
      }
      setLiveSession(null);setLiveEntries([]);await loadLeagueData(currentLeague.id);showToast("Session saved! ✓");setLeagueSubView('leagueDetail');
    }catch(e:any){showError(e.message||"Failed to save session.");}
  };

  const handleSendFriendRequest=async(recipientName:string)=>{
    if(!db||!profile)return;const{error}=await db.from("friends").insert({requester_name:profile.display_name,recipient_name:recipientName,status:"pending"});
    if(error)showError("Already sent or already friends!");else showToast(`Friend request sent to ${recipientName}!`);
  };

  const handleLogout=async()=>{if(!db)return;await db.auth.signOut();setCurrentLeague(null);setPlayers([]);setSessions([]);setMyLeagues([]);setLeagueSubView('home');setActiveTab('feed');};

  if(!db)return<SetupView/>;
  if(bootstrapping)return<LoadingScreen/>;
  if(!authUser)return<AuthView/>;
  if(!profile)return<SetupProfileView user={authUser} onDone={(p:any)=>{setProfile(p);loadMyLeagues(p.display_name,authUser.id);}}/>;

  const renderLeagueTab=()=>{
    if(leagueSubView==='joinCreate')return<JoinCreateView profile={profile} loading={loadingLeagues} onBack={()=>setLeagueSubView('home')} onEnter={handleJoinCreate}/>;
    if(leagueSubView==='publicLeagues')return<PublicLeaguesView onBack={()=>setLeagueSubView('home')} onJoin={(lg:any)=>{handleJoinPublic(lg);}}/>;
    if(leagueSubView==='globalLeaderboard')return<GlobalLeaderboardView profile={profile} onBack={()=>setLeagueSubView('home')}/>;
    if(leagueSubView==='handRankings')return<HandRankingsView onBack={()=>setLeagueSubView('leagueDetail')}/>;
    if(leagueSubView==='leagueDetail'&&currentLeague)return<LeagueDetailView league={currentLeague} players={players} sessions={sessions} profile={profile} isCommissioner={isCommissioner} onViewPlayer={(p:any)=>{setSelectedPlayer(p);setLeagueSubView('playerProfile');}} onStartSession={()=>liveSession?setLeagueSubView('liveSession'):setLeagueSubView('newSession')} onBack={()=>{setCurrentLeague(null);setLeagueSubView('home');}} onCommSettings={()=>setLeagueSubView('commSettings')} liveSession={liveSession} onLeaveLeague={handleLeaveLeague} onViewHandRankings={()=>setLeagueSubView('handRankings')}/>;
    if(leagueSubView==='playerProfile'&&selectedPlayer)return<PlayerProfileInLeague player={selectedPlayer} profile={profile} onBack={()=>setLeagueSubView('leagueDetail')} onSendFriendRequest={handleSendFriendRequest}/>;
    if(leagueSubView==='newSession'&&currentLeague)return<NewSessionView league={currentLeague} players={players} onStart={handleStartSession} onBack={()=>setLeagueSubView('leagueDetail')}/>;
    if(leagueSubView==='liveSession'&&currentLeague&&liveSession)return<LiveSessionView session={liveSession} liveEntries={liveEntries} players={players} profile={profile} isCommissioner={isCommissioner} league={currentLeague} onBack={()=>setLeagueSubView('leagueDetail')} onSubmitEntry={handleSubmitEntry} onEndSession={handleEndSession}/>;
    if(leagueSubView==='commSettings'&&currentLeague&&isCommissioner)return<CommSettingsView league={currentLeague} players={players} onBack={()=>setLeagueSubView('leagueDetail')} onLeagueUpdated={(lg:any)=>{setCurrentLeague({...lg,_myUserId:authUser?.id});loadLeagueData(lg.id);}} onLeagueDeleted={()=>{setCurrentLeague(null);loadMyLeagues(profile.display_name,authUser.id);setLeagueSubView('home');}} showToast={showToast} showError={showError}/>;
    if(leagueSubView==='transferComm'&&currentLeague)return<TransferCommView league={currentLeague} players={players} profile={profile} onBack={()=>setLeagueSubView('leagueDetail')} onTransferred={handleTransferAndLeave}/>;
    return<LeagueHomeView profile={profile} myLeagues={myLeagues} loading={loadingLeagues} pinnedIds={pinnedIds} onSelectLeague={handleSelectLeague} onJoinCreate={()=>setLeagueSubView('joinCreate')} onPublicLeagues={()=>setLeagueSubView('publicLeagues')} onGlobalLeaderboard={()=>setLeagueSubView('globalLeaderboard')} onTogglePin={togglePin}/>;
  };

  const renderProfileTab=()=>{
    if(profileSubView==='friends')return<FriendsView profile={profile} onBack={()=>setProfileSubView('self')} onViewFriendProfile={(name:string)=>{setViewingFriendName(name);setProfileSubView('friendProfile');}}/>;
    if(profileSubView==='friendProfile')return<ProfileTabView profile={profile} myLeagues={myLeagues} isSelf={false} externalPlayerName={viewingFriendName} onSettings={handleLogout} onFriends={()=>setProfileSubView('friends')} onGlobalLeaderboard={()=>{setActiveTab('league');setLeagueSubView('globalLeaderboard');}} onSendFriendRequest={handleSendFriendRequest}/>;
    return<ProfileTabView profile={profile} myLeagues={myLeagues} isSelf={true} onSettings={handleLogout} onFriends={()=>setProfileSubView('friends')} onGlobalLeaderboard={()=>{setActiveTab('league');setLeagueSubView('globalLeaderboard');}} onSendFriendRequest={handleSendFriendRequest}/>;
  };

  return(
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Space+Mono:wght@400;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        body,html{background:#0A0A0A;color:#fff;-webkit-font-smoothing:antialiased;}
        input[type=number]{-moz-appearance:textfield;}
        input[type=number]::-webkit-inner-spin-button,input[type=number]::-webkit-outer-spin-button{-webkit-appearance:none;}
        input::placeholder,textarea::placeholder{color:#333!important;}
        @keyframes spin{to{transform:rotate(360deg);}}
        @keyframes pulse{0%,100%{opacity:1;}50%{opacity:0.4;}}
        ::-webkit-scrollbar{width:3px;}::-webkit-scrollbar-thumb{background:#2a2a2a;border-radius:4px;}
      `}</style>
      <div style={{ background:"#0A0A0A",minHeight:"100vh",paddingBottom:80 }}>
        {toast&&<div style={{ position:"fixed",top:20,left:"50%",transform:"translateX(-50%)",background:"rgba(76,175,140,0.95)",color:"#fff",padding:"11px 22px",borderRadius:30,fontFamily:"'Space Mono',monospace",fontSize:13,zIndex:999,whiteSpace:"nowrap",maxWidth:"90vw",textAlign:"center" }}>{toast}</div>}
        {error&&<div style={{ position:"fixed",top:20,left:"50%",transform:"translateX(-50%)",background:"rgba(224,85,85,0.95)",color:"#fff",padding:"11px 22px",borderRadius:30,fontFamily:"'Space Mono',monospace",fontSize:13,zIndex:999,maxWidth:"90vw",textAlign:"center" }}>{error}</div>}

        {activeTab==='league'&&renderLeagueTab()}
        {activeTab==='feed'&&<FeedView profile={profile} myLeagues={myLeagues}/>}
        {activeTab==='profile'&&renderProfileTab()}

        <BottomNav activeTab={activeTab} onTab={(t)=>{setActiveTab(t);if(t==='profile')setProfileSubView('self');}}/>
      </div>
    </>
  );
}

// ─── PLAYER PROFILE IN LEAGUE (tap from standings) ─────
function PlayerProfileInLeague({ player, profile, onBack, onSendFriendRequest }:any){
  if(!player)return null;
  const isUp=player.total_profit>=0;const isSelf=player.name.toLowerCase()===profile.display_name.toLowerCase();
  const winRate=player.session_count>0?((player.wins/player.session_count)*100).toFixed(0):0;
  const badges:any[]=([player.session_count>=10&&{icon:"🃏",label:"10 Sessions"},player.wins>=3&&{icon:"🏆",label:"3x Winner"},player.total_profit>200&&{icon:"💰",label:"High Roller"},player.streak>1&&{icon:"🔥",label:`${player.streak} Streak`},(player.chicken_dinners||0)>0&&{icon:"🍗",label:`${player.chicken_dinners}× Chicken`}]).filter(Boolean) as any[];
  return(
    <div style={{ padding:"20px 16px",maxWidth:500,margin:"0 auto" }}>
      <BackButton onBack={onBack}/>
      <div style={{ textAlign:"center",marginBottom:20 }}>
        <Avatar name={player.name} size={70}/>
        <div style={{ fontFamily:"'Playfair Display',serif",fontSize:24,color:"#fff",marginTop:10 }}>{player.name}</div>
        <div style={{ color:isUp?"#4CAF8C":"#E05555",fontSize:28,fontFamily:"'Space Mono',monospace",fontWeight:700,marginTop:4 }}>{isUp?"+":""}${player.total_profit}</div>
        <div style={{ color:"#555",fontSize:11,fontFamily:"'Space Mono',monospace" }}>in this league</div>
        {!isSelf&&<button onClick={()=>onSendFriendRequest(player.name)} style={{ marginTop:12,padding:"7px 20px",background:"rgba(201,168,76,0.1)",border:"1px solid rgba(201,168,76,0.3)",borderRadius:20,color:"#C9A84C",fontFamily:"'Space Mono',monospace",fontSize:11,cursor:"pointer",letterSpacing:1 }}>+ ADD FRIEND</button>}
      </div>
      <div style={{ display:"flex",gap:8,marginBottom:12 }}><StatBox label="Sessions" value={player.session_count}/><StatBox label="Wins" value={player.wins} accent="#4CAF8C"/><StatBox label="Win %" value={`${winRate}%`} accent="#5577CC"/><StatBox label="Best" value={`$${player.best_night}`}/></div>
      {badges.length>0&&<Card style={{ marginBottom:12 }}><div style={{ color:"#888",fontSize:11,fontFamily:"'Space Mono',monospace",letterSpacing:2,marginBottom:10 }}>BADGES</div><div style={{ display:"flex",gap:7,flexWrap:"wrap" }}>{badges.map((b:any,i:number)=><div key={i} style={{ background:"rgba(201,168,76,0.1)",border:"1px solid rgba(201,168,76,0.25)",borderRadius:10,padding:"6px 11px",display:"flex",alignItems:"center",gap:5 }}><span style={{ fontSize:14 }}>{b.icon}</span><span style={{ color:"#C9A84C",fontSize:11,fontFamily:"'Space Mono',monospace" }}>{b.label}</span></div>)}</div></Card>}
      <Card>{([["Avg / session",`${isUp?"+":""}$${player.session_count>0?(player.total_profit/player.session_count).toFixed(0):0}`,isUp?"#4CAF8C":"#E05555"],["Biggest win",`$${player.best_night}`,"#C9A84C"],["Time in this league",player.time_played_seconds>0?fmtSeconds(player.time_played_seconds):"—","#888"],["Win streak",`${player.streak}${player.streak>1?" 🔥":""}`, "#fff"]] as any[]).map(([label,val,col]:any,i:number,arr:any[])=><div key={label} style={{ display:"flex",justifyContent:"space-between",padding:"9px 0",borderBottom:i<arr.length-1?"1px solid rgba(255,255,255,0.05)":"none" }}><span style={{ color:"#555",fontFamily:"'Space Mono',monospace",fontSize:12 }}>{label}</span><span style={{ color:col,fontFamily:"'Space Mono',monospace" }}>{val}</span></div>)}</Card>
    </div>
  );
}