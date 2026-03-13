import { useState, useEffect, useRef } from "react";
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';
const db = (SUPABASE_URL !== 'YOUR_SUPABASE_URL') ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const VIEWS = {
  setup:'setup', auth:'auth', setupProfile:'setupProfile',
  myLeagues:'myLeagues', joinCreate:'joinCreate', publicLeagues:'publicLeagues',
  league:'league', newSession:'newSession', liveSession:'liveSession',
  standings:'standings', profile:'profile', feed:'feed',
  friends:'friends', settings:'settings', myAccount:'myAccount',
  commSettings:'commSettings', globalLeaderboard:'globalLeaderboard',
  handRankings:'handRankings', friendStats:'friendStats'
};

const HAND_RANKINGS = [
  { rank:1, name:"Royal Flush", desc:"A K Q J 10 of same suit", example:"A♠ K♠ Q♠ J♠ 10♠", color:"#C9A84C" },
  { rank:2, name:"Straight Flush", desc:"Five consecutive same suit", example:"9♥ 8♥ 7♥ 6♥ 5♥", color:"#E8C56A" },
  { rank:3, name:"Four of a Kind", desc:"Four cards of same rank", example:"K♠ K♥ K♦ K♣ 3♠", color:"#4CAF8C" },
  { rank:4, name:"Full House", desc:"Three of a kind + a pair", example:"J♠ J♥ J♦ 9♣ 9♥", color:"#5577CC" },
  { rank:5, name:"Flush", desc:"Five cards of same suit", example:"A♦ J♦ 8♦ 6♦ 2♦", color:"#CC55AA" },
  { rank:6, name:"Straight", desc:"Five consecutive any suit", example:"10♠ 9♥ 8♦ 7♣ 6♠", color:"#77CCAA" },
  { rank:7, name:"Three of a Kind", desc:"Three cards of same rank", example:"7♠ 7♥ 7♦ K♣ 2♠", color:"#CC7744" },
  { rank:8, name:"Two Pair", desc:"Two different pairs", example:"A♠ A♦ 8♥ 8♣ Q♠", color:"#888" },
  { rank:9, name:"One Pair", desc:"Two cards of same rank", example:"K♥ K♣ A♠ J♦ 4♥", color:"#666" },
  { rank:10, name:"High Card", desc:"Highest card wins", example:"A♠ J♥ 8♦ 5♣ 2♠", color:"#444" },
];

// ─── SHARED UI ─────────────────────────────────────────
function Avatar({ name, url, size=40 }:{ name:string; url?:string|null; size?:number }) {
  const colors = ["#C9A84C","#4CAF8C","#E05555","#5577CC","#CC55AA"];
  const bg = colors[(name||"?").charCodeAt(0)%colors.length];
  if (url) return <img src={url} style={{ width:size,height:size,borderRadius:"50%",objectFit:"cover",flexShrink:0,border:"2px solid rgba(201,168,76,0.3)" }}/>;
  return <div style={{ width:size,height:size,borderRadius:"50%",background:bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Playfair Display',serif",fontWeight:700,fontSize:size*0.4,color:"#0D0D0D",flexShrink:0 }}>{(name||"?")[0].toUpperCase()}</div>;
}
function Card({ children, style={} }:any) {
  return <div style={{ background:"rgba(255,255,255,0.04)",border:"1px solid rgba(201,168,76,0.2)",borderRadius:16,padding:20,...style }}>{children}</div>;
}
function Badge({ text, color="#C9A84C" }:any) {
  return <span style={{ background:`${color}22`,color,border:`1px solid ${color}44`,borderRadius:20,padding:"2px 10px",fontSize:11,fontFamily:"'Space Mono',monospace",letterSpacing:1 }}>{text}</span>;
}
function StatBox({ label, value, accent="#C9A84C" }:any) {
  return <div style={{ background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:12,padding:"11px 12px",flex:1,minWidth:55 }}><div style={{ color:"#666",fontSize:9,fontFamily:"'Space Mono',monospace",letterSpacing:1.5,textTransform:"uppercase",marginBottom:4 }}>{label}</div><div style={{ color:accent,fontSize:17,fontWeight:700,fontFamily:"'Playfair Display',serif" }}>{value}</div></div>;
}
function Spinner({ size=24 }:any) {
  return <div style={{ width:size,height:size,border:`2px solid rgba(201,168,76,0.2)`,borderTopColor:"#C9A84C",borderRadius:"50%",animation:"spin 0.8s linear infinite",flexShrink:0 }}/>;
}
function Toggle({ value, onChange, label, sub }:any) {
  return <div onClick={()=>onChange(!value)} style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"13px 14px",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:12,cursor:"pointer",marginBottom:10 }}>
    <div><div style={{ color:"#fff",fontSize:13 }}>{label}</div>{sub&&<div style={{ color:"#555",fontSize:11,marginTop:2 }}>{sub}</div>}</div>
    <div style={{ width:44,height:24,borderRadius:12,background:value?"#5577CC":"rgba(255,255,255,0.1)",position:"relative",transition:"background 0.2s",flexShrink:0 }}><div style={{ width:20,height:20,borderRadius:"50%",background:"#fff",position:"absolute",top:2,left:value?22:2,transition:"left 0.2s" }}/></div>
  </div>;
}
const inp:any = { width:"100%",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(201,168,76,0.25)",borderRadius:10,padding:"12px 16px",color:"#fff",fontSize:15,fontFamily:"'Space Mono',monospace",outline:"none",boxSizing:"border-box" };
function BackHeader({ onBack, sub, title }:any) {
  return <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:20 }}><button onClick={onBack} style={{ background:"none",border:"none",color:"#555",fontSize:22,cursor:"pointer" }}>←</button><div>{sub&&<div style={{ color:"#555",fontSize:11,fontFamily:"'Space Mono',monospace",letterSpacing:2 }}>{sub}</div>}<div style={{ fontFamily:"'Playfair Display',serif",fontSize:22,color:"#fff" }}>{title}</div></div></div>;
}

// ─── AUTH ──────────────────────────────────────────────
function SetupView() {
  return <div style={{ minHeight:"100vh",background:"#0A0A0A",display:"flex",alignItems:"center",justifyContent:"center",padding:24 }}><Card style={{ maxWidth:420,width:"100%" }}><div style={{ color:"#E05555",fontFamily:"'Space Mono',monospace",fontSize:11,letterSpacing:1.5,marginBottom:12 }}>⚠ DATABASE NOT CONNECTED</div><div style={{ color:"#aaa",fontSize:13,lineHeight:1.8 }}>Open <span style={{ color:"#C9A84C" }}>App.tsx</span> and replace the placeholder Supabase credentials.</div></Card></div>;
}

function AuthView() {
  const [tab,setTab]=useState<'login'|'signup'|'reset'>('login');
  const [email,setEmail]=useState("");const [password,setPassword]=useState("");
  const [loading,setLoading]=useState(false);const [msg,setMsg]=useState("");const [err,setErr]=useState("");
  const clear=()=>{setMsg("");setErr("");};
  const handle=async()=>{
    if(!db)return;setLoading(true);clear();
    if(tab==='login'){const{error}=await db.auth.signInWithPassword({email,password});if(error)setErr(error.message);}
    else if(tab==='signup'){if(password.length<6){setErr("Password must be at least 6 characters.");setLoading(false);return;}const{error}=await db.auth.signUp({email,password});if(error)setErr(error.message);else setMsg("Account created! You can sign in now.");}
    else{const{error}=await db.auth.resetPasswordForEmail(email,{redirectTo:window.location.origin});if(error)setErr(error.message);else setMsg("Reset email sent! Check your inbox.");}
    setLoading(false);
  };
  return (
    <div style={{ minHeight:"100vh",background:"#0A0A0A",display:"flex",alignItems:"center",justifyContent:"center",padding:24,position:"relative",overflow:"hidden" }}>
      <div style={{ position:"absolute",inset:0,background:"radial-gradient(ellipse 80% 60% at 50% 50%, rgba(20,60,30,0.4) 0%, transparent 70%)",pointerEvents:"none" }}/>
      <div style={{ width:"100%",maxWidth:400,position:"relative",zIndex:1 }}>
        <div style={{ textAlign:"center",marginBottom:36 }}>
          <div style={{ display:"flex",justifyContent:"center",gap:8,marginBottom:10 }}>{["♠","♥","♦","♣"].map((s,i)=><span key={i} style={{ fontSize:28,color:i%2===0?"#C9A84C":"#E05555" }}>{s}</span>)}</div>
          <div style={{ fontFamily:"'Playfair Display',serif",fontSize:42,fontWeight:900,color:"#C9A84C",letterSpacing:-1 }}>Home Game</div>
          <div style={{ color:"#555",fontSize:11,fontFamily:"'Space Mono',monospace",letterSpacing:2,marginTop:6 }}>YOUR LEAGUE. YOUR RULES.</div>
        </div>
        <Card style={{ padding:0,overflow:"hidden" }}>
          {tab!=='reset'?<div style={{ display:"flex",borderBottom:"1px solid rgba(201,168,76,0.15)" }}>{(['login','signup'] as const).map(t=><button key={t} onClick={()=>{setTab(t);clear();}} style={{ flex:1,padding:"15px 0",background:"none",border:"none",color:tab===t?"#C9A84C":"#555",fontFamily:"'Space Mono',monospace",fontSize:12,letterSpacing:1.5,textTransform:"uppercase",cursor:"pointer",borderBottom:tab===t?"2px solid #C9A84C":"2px solid transparent" }}>{t==='login'?'Sign In':'Create Account'}</button>)}</div>:<div style={{ borderBottom:"1px solid rgba(201,168,76,0.15)",padding:"13px 20px",display:"flex",alignItems:"center",gap:10 }}><button onClick={()=>{setTab('login');clear();}} style={{ background:"none",border:"none",color:"#555",fontSize:18,cursor:"pointer" }}>←</button><span style={{ color:"#888",fontFamily:"'Space Mono',monospace",fontSize:12,letterSpacing:1.5 }}>RESET PASSWORD</span></div>}
          <div style={{ padding:26 }}>
            <div style={{ marginBottom:14 }}><label style={{ color:"#888",fontSize:11,fontFamily:"'Space Mono',monospace",letterSpacing:1.5,display:"block",marginBottom:7 }}>EMAIL</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@email.com" style={inp}/></div>
            {tab!=='reset'&&<div style={{ marginBottom:8 }}><label style={{ color:"#888",fontSize:11,fontFamily:"'Space Mono',monospace",letterSpacing:1.5,display:"block",marginBottom:7 }}>PASSWORD</label><input type="password" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handle()} placeholder={tab==='signup'?"At least 6 characters":"••••••••"} style={inp}/></div>}
            {tab==='login'&&<div style={{ textAlign:"right",marginBottom:18 }}><button onClick={()=>{setTab('reset');clear();}} style={{ background:"none",border:"none",color:"#555",fontFamily:"'Space Mono',monospace",fontSize:11,cursor:"pointer" }}>Forgot password?</button></div>}
            {tab!=='login'&&<div style={{ marginBottom:18 }}/>}
            {err&&<div style={{ background:"rgba(224,85,85,0.1)",border:"1px solid rgba(224,85,85,0.3)",borderRadius:8,padding:"10px 14px",color:"#E05555",fontFamily:"'Space Mono',monospace",fontSize:11,marginBottom:14,lineHeight:1.6 }}>{err}</div>}
            {msg&&<div style={{ background:"rgba(76,175,140,0.1)",border:"1px solid rgba(76,175,140,0.3)",borderRadius:8,padding:"10px 14px",color:"#4CAF8C",fontFamily:"'Space Mono',monospace",fontSize:11,marginBottom:14,lineHeight:1.6 }}>{msg}</div>}
            <button onClick={handle} disabled={loading||!email||(tab!=='reset'&&!password)} style={{ width:"100%",padding:"14px 0",background:!loading&&email&&(tab==='reset'||password)?"linear-gradient(135deg,#C9A84C,#E8C56A)":"rgba(255,255,255,0.08)",border:"none",borderRadius:12,color:!loading&&email&&(tab==='reset'||password)?"#0A0A0A":"#444",fontFamily:"'Space Mono',monospace",fontWeight:700,fontSize:14,letterSpacing:2,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:10 }}>{loading?<Spinner size={18}/>:tab==='login'?"SIGN IN →":tab==='signup'?"CREATE ACCOUNT →":"SEND RESET EMAIL →"}</button>
          </div>
        </Card>
      </div>
    </div>
  );
}

function SetupProfileView({ user, onDone }:any) {
  const [name,setName]=useState("");const [loading,setLoading]=useState(false);const [err,setErr]=useState("");
  const handleSave=async()=>{if(!db||!name.trim())return;setLoading(true);const{error}=await db.from("profiles").upsert({id:user.id,display_name:name.trim(),email:user.email,opt_in_global:false});if(error){setErr(error.message);setLoading(false);return;}onDone({id:user.id,display_name:name.trim(),email:user.email,avatar_url:null,opt_in_global:false});};
  return (
    <div style={{ minHeight:"100vh",background:"#0A0A0A",display:"flex",alignItems:"center",justifyContent:"center",padding:24,position:"relative",overflow:"hidden" }}>
      <div style={{ position:"absolute",inset:0,background:"radial-gradient(ellipse 80% 60% at 50% 50%, rgba(20,60,30,0.4) 0%, transparent 70%)",pointerEvents:"none" }}/>
      <div style={{ width:"100%",maxWidth:400,position:"relative",zIndex:1 }}>
        <div style={{ textAlign:"center",marginBottom:32 }}><div style={{ fontSize:40,marginBottom:12,color:"#C9A84C" }}>👤</div><div style={{ fontFamily:"'Playfair Display',serif",fontSize:28,color:"#fff" }}>One more thing</div><div style={{ color:"#555",fontSize:11,fontFamily:"'Space Mono',monospace",letterSpacing:1.5,marginTop:8 }}>WHAT DO THEY CALL YOU AT THE TABLE?</div></div>
        <Card><div style={{ marginBottom:16 }}><label style={{ color:"#888",fontSize:11,fontFamily:"'Space Mono',monospace",letterSpacing:1.5,display:"block",marginBottom:8 }}>DISPLAY NAME</label><input value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleSave()} placeholder="e.g. Big Stack Tyler" autoFocus style={{ ...inp,fontSize:18,fontFamily:"'Playfair Display',serif" }}/><div style={{ color:"#444",fontSize:11,fontFamily:"'Space Mono',monospace",marginTop:6,lineHeight:1.6 }}>This is what friends see. You can add a photo after.</div></div>{err&&<div style={{ color:"#E05555",fontSize:11,fontFamily:"'Space Mono',monospace",marginBottom:10 }}>{err}</div>}<button onClick={handleSave} disabled={loading||!name.trim()} style={{ width:"100%",padding:"14px 0",background:name.trim()&&!loading?"linear-gradient(135deg,#C9A84C,#E8C56A)":"rgba(255,255,255,0.08)",border:"none",borderRadius:12,color:name.trim()&&!loading?"#0A0A0A":"#444",fontFamily:"'Space Mono',monospace",fontWeight:700,fontSize:14,letterSpacing:2,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:10 }}>{loading?<Spinner size={18}/>:"LET'S PLAY →"}</button></Card>
      </div>
    </div>
  );
}

// ─── MY LEAGUES HUB ────────────────────────────────────
function MyLeaguesView({ profile, myLeagues, loading, onSelectLeague, onJoinCreate, onFriends, onSettings, onFeed, onPublicLeagues, onMyAccount, onGlobalLeaderboard }:any) {
  return (
    <div style={{ minHeight:"100vh",background:"#0A0A0A",padding:"20px 16px 100px",maxWidth:500,margin:"0 auto" }}>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:22 }}>
        <div><div style={{ display:"flex",gap:5,marginBottom:4 }}>{["♠","♥"].map((s,i)=><span key={i} style={{ color:i===0?"#C9A84C":"#E05555",fontSize:16 }}>{s}</span>)}</div><div style={{ fontFamily:"'Playfair Display',serif",fontSize:26,color:"#C9A84C" }}>Home Game</div></div>
        <div style={{ display:"flex",gap:8,alignItems:"center" }}>
          <button onClick={onFeed} style={{ background:"rgba(201,168,76,0.1)",border:"1px solid rgba(201,168,76,0.2)",borderRadius:20,padding:"5px 11px",color:"#C9A84C",fontFamily:"'Space Mono',monospace",fontSize:10,cursor:"pointer" }}>◈ FEED</button>
          <button onClick={onSettings} style={{ background:"none",border:"none",cursor:"pointer",padding:2 }}><Avatar name={profile.display_name} url={profile.avatar_url} size={36}/></button>
        </div>
      </div>
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18 }}>
        <div><div style={{ color:"#fff",fontFamily:"'Playfair Display',serif",fontSize:18 }}>Hey, {profile.display_name} 👋</div><div style={{ color:"#555",fontSize:11,fontFamily:"'Space Mono',monospace",marginTop:2 }}>{myLeagues.length} league{myLeagues.length!==1?"s":""}</div></div>
        <div style={{ display:"flex",gap:8 }}>
          <button onClick={onFriends} style={{ background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:20,padding:"5px 12px",color:"#888",fontFamily:"'Space Mono',monospace",fontSize:10,cursor:"pointer" }}>FRIENDS</button>
          <button onClick={onMyAccount} style={{ background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:20,padding:"5px 12px",color:"#888",fontFamily:"'Space Mono',monospace",fontSize:10,cursor:"pointer" }}>MY STATS</button>
        </div>
      </div>
      <div style={{ height:1,background:"rgba(201,168,76,0.1)",marginBottom:18 }}/>
      {loading&&<div style={{ display:"flex",justifyContent:"center",padding:40 }}><Spinner/></div>}
      {!loading&&myLeagues.length===0&&<Card style={{ marginBottom:14,textAlign:"center" }}><div style={{ padding:"20px 0" }}><div style={{ fontSize:32,marginBottom:10 }}>♠</div><div style={{ color:"#555",fontFamily:"'Space Mono',monospace",fontSize:12 }}>No leagues yet</div></div></Card>}
      {!loading&&myLeagues.map((lg:any)=>{
        const isComm=lg.commissioner_id===lg._myUserId;
        return <div key={lg.id} onClick={()=>onSelectLeague(lg)} style={{ background:"rgba(255,255,255,0.03)",border:"1px solid rgba(201,168,76,0.15)",borderRadius:14,padding:"14px 15px",marginBottom:10,cursor:"pointer",display:"flex",alignItems:"center",gap:12 }}>
          <div style={{ width:44,height:44,borderRadius:12,background:"rgba(201,168,76,0.12)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0 }}>{lg.is_public?"🌍":"♠"}</div>
          <div style={{ flex:1,minWidth:0 }}>
            <div style={{ color:"#fff",fontFamily:"'Playfair Display',serif",fontSize:17,display:"flex",alignItems:"center",gap:5 }}>{lg.name} {isComm&&<span style={{ fontSize:13 }}>👑</span>}</div>
            {lg.description&&<div style={{ color:"#666",fontSize:11,marginTop:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{lg.description}</div>}
            <div style={{ color:"#555",fontSize:10,fontFamily:"'Space Mono',monospace",marginTop:2 }}>{lg.season}{lg.location_name?` · ${lg.location_name}`:""} · Code: <span style={{ color:"#C9A84C",letterSpacing:2 }}>{lg.code}</span></div>
          </div>
          <span style={{ color:"#555",fontSize:20,flexShrink:0 }}>›</span>
        </div>;
      })}
      <button onClick={onJoinCreate} style={{ width:"100%",padding:"13px 0",marginTop:4,background:"linear-gradient(135deg,#C9A84C,#E8C56A)",border:"none",borderRadius:12,color:"#0A0A0A",fontFamily:"'Space Mono',monospace",fontWeight:700,fontSize:13,letterSpacing:2,cursor:"pointer",marginBottom:10 }}>+ JOIN OR CREATE LEAGUE</button>
      <div style={{ display:"flex",gap:8 }}>
        <button onClick={onPublicLeagues} style={{ flex:1,padding:"12px 0",background:"rgba(85,119,204,0.1)",border:"1px solid rgba(85,119,204,0.3)",borderRadius:12,color:"#5577CC",fontFamily:"'Space Mono',monospace",fontSize:11,letterSpacing:1.5,cursor:"pointer" }}>🌍 PUBLIC LEAGUES</button>
        <button onClick={onGlobalLeaderboard} style={{ flex:1,padding:"12px 0",background:"rgba(201,168,76,0.08)",border:"1px solid rgba(201,168,76,0.2)",borderRadius:12,color:"#C9A84C",fontFamily:"'Space Mono',monospace",fontSize:11,letterSpacing:1.5,cursor:"pointer" }}>🏆 GLOBAL BOARD</button>
      </div>
    </div>
  );
}

// ─── JOIN / CREATE ──────────────────────────────────────
function JoinCreateView({ profile, loading, onBack, onEnter }:any) {
  const [tab,setTab]=useState("join");
  const [code,setCode]=useState("");const [leagueName,setLeagueName]=useState("");const [description,setDescription]=useState("");
  const [buyIn,setBuyIn]=useState("20");const [season,setSeason]=useState("Season 1");const [seasonLength,setSeasonLength]=useState("0");
  const [isPublic,setIsPublic]=useState(false);const [locationName,setLocationName]=useState("");
  const [detecting,setDetecting]=useState(false);
  const canSubmit=tab==="join"?code.trim():leagueName.trim();

  const detectLocation=()=>{
    setDetecting(true);
    navigator.geolocation?.getCurrentPosition(async(pos)=>{
      try{const r=await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`);const d=await r.json();setLocationName(d.address?.city||d.address?.town||d.address?.state||"");}catch(e){}
      setDetecting(false);
    },()=>setDetecting(false));
  };

  return (
    <div style={{ minHeight:"100vh",background:"#0A0A0A",display:"flex",alignItems:"center",justifyContent:"center",padding:24,position:"relative",overflow:"hidden" }}>
      <div style={{ position:"absolute",inset:0,background:"radial-gradient(ellipse 80% 60% at 50% 50%, rgba(20,60,30,0.4) 0%, transparent 70%)",pointerEvents:"none" }}/>
      <div style={{ width:"100%",maxWidth:420,position:"relative",zIndex:1 }}>
        <BackHeader onBack={onBack} sub={profile.display_name.toUpperCase()} title="Add a League"/>
        <Card style={{ padding:0,overflow:"hidden" }}>
          <div style={{ display:"flex",borderBottom:"1px solid rgba(201,168,76,0.15)" }}>{["join","create"].map(t=><button key={t} onClick={()=>setTab(t)} style={{ flex:1,padding:"15px 0",background:"none",border:"none",color:tab===t?"#C9A84C":"#555",fontFamily:"'Space Mono',monospace",fontSize:12,letterSpacing:1.5,textTransform:"uppercase",cursor:"pointer",borderBottom:tab===t?"2px solid #C9A84C":"2px solid transparent" }}>{t==="join"?"Join":"Create"}</button>)}</div>
          <div style={{ padding:24 }}>
            {tab==="join"?<div style={{ marginBottom:20 }}><label style={{ color:"#888",fontSize:11,fontFamily:"'Space Mono',monospace",letterSpacing:1.5,display:"block",marginBottom:8 }}>INVITE CODE</label><input value={code} onChange={e=>setCode(e.target.value.toUpperCase())} placeholder="e.g. FNP2026" style={{ ...inp,color:"#C9A84C",fontSize:20,letterSpacing:4,textAlign:"center" as const }}/></div>:(
              <>
                {([["LEAGUE NAME","text",leagueName,setLeagueName,"Friday Night Poker"],["DESCRIPTION","text",description,setDescription,"Weekly home game"],["SEASON NAME","text",season,setSeason,"Season 1"]] as any[]).map(([label,type,val,setter,ph])=><div key={label} style={{ marginBottom:11 }}><label style={{ color:"#888",fontSize:11,fontFamily:"'Space Mono',monospace",letterSpacing:1.5,display:"block",marginBottom:7 }}>{label}</label><input type={type} value={val} onChange={e=>setter(e.target.value)} placeholder={ph} style={inp}/></div>)}
                <div style={{ display:"flex",gap:10,marginBottom:11 }}>
                  <div style={{ flex:1 }}><label style={{ color:"#888",fontSize:11,fontFamily:"'Space Mono',monospace",letterSpacing:1.5,display:"block",marginBottom:7 }}>BUY-IN ($)</label><input type="number" value={buyIn} onChange={e=>setBuyIn(e.target.value)} style={inp}/></div>
                  <div style={{ flex:1 }}><label style={{ color:"#888",fontSize:11,fontFamily:"'Space Mono',monospace",letterSpacing:1.5,display:"block",marginBottom:7 }}>SEASON LENGTH</label><input type="number" value={seasonLength} onChange={e=>setSeasonLength(e.target.value)} placeholder="0=unlimited" style={inp}/><div style={{ color:"#444",fontSize:10,marginTop:3 }}>0 = no limit</div></div>
                </div>
                <div style={{ marginBottom:11 }}>
                  <label style={{ color:"#888",fontSize:11,fontFamily:"'Space Mono',monospace",letterSpacing:1.5,display:"block",marginBottom:7 }}>LOCATION (for discovery)</label>
                  <div style={{ display:"flex",gap:8 }}>
                    <input value={locationName} onChange={e=>setLocationName(e.target.value)} placeholder="e.g. San Francisco, CA" style={{ ...inp,flex:1 }}/>
                    <button onClick={detectLocation} style={{ padding:"0 14px",background:"rgba(201,168,76,0.1)",border:"1px solid rgba(201,168,76,0.2)",borderRadius:10,color:"#C9A84C",fontFamily:"'Space Mono',monospace",fontSize:11,cursor:"pointer",flexShrink:0 }}>{detecting?<Spinner size={14}/>:"📍"}</button>
                  </div>
                </div>
                <Toggle value={isPublic} onChange={setIsPublic} label="Public League 🌍" sub="Anyone can find & join without a code"/>
              </>
            )}
            <button onClick={()=>canSubmit&&!loading&&onEnter({tab,code,leagueName,description,buyIn:Number(buyIn),season,seasonLength:Number(seasonLength),isPublic,locationName})} style={{ width:"100%",padding:"14px 0",marginTop:8,background:canSubmit&&!loading?"linear-gradient(135deg,#C9A84C,#E8C56A)":"rgba(255,255,255,0.08)",border:"none",borderRadius:12,color:canSubmit&&!loading?"#0A0A0A":"#444",fontFamily:"'Space Mono',monospace",fontWeight:700,fontSize:14,letterSpacing:2,cursor:canSubmit&&!loading?"pointer":"not-allowed",display:"flex",alignItems:"center",justifyContent:"center",gap:10 }}>{loading?<Spinner size={18}/>:tab==="join"?"Join League →":"Create League →"}</button>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ─── PUBLIC LEAGUES ────────────────────────────────────
function PublicLeaguesView({ profile, onBack, onJoin }:any) {
  const [leagues,setLeagues]=useState<any[]>([]);const [loading,setLoading]=useState(true);
  const [userLocation,setUserLocation]=useState<string>("");const [detecting,setDetecting]=useState(false);
  const [filter,setFilter]=useState("");

  useEffect(()=>{loadPublic();},[]);

  const loadPublic=async()=>{
    if(!db)return;setLoading(true);
    const{data}=await db.from("leagues").select("*").eq("is_public",true).order("created_at",{ascending:false});
    setLeagues(data||[]);setLoading(false);
  };

  const detectLocation=()=>{
    setDetecting(true);
    navigator.geolocation?.getCurrentPosition(async(pos)=>{
      try{const r=await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`);const d=await r.json();setUserLocation(d.address?.city||d.address?.state||"");}catch(e){}
      setDetecting(false);
    },()=>setDetecting(false));
  };

  const filtered=leagues.filter(lg=>{
    if(!filter)return true;
    const f=filter.toLowerCase();
    return lg.name?.toLowerCase().includes(f)||lg.location_name?.toLowerCase().includes(f)||lg.description?.toLowerCase().includes(f);
  });

  const nearbyFirst=userLocation?[...filtered].sort((a,b)=>{
    const aMatch=a.location_name?.toLowerCase().includes(userLocation.toLowerCase())?0:1;
    const bMatch=b.location_name?.toLowerCase().includes(userLocation.toLowerCase())?0:1;
    return aMatch-bMatch;
  }):filtered;

  return (
    <div style={{ padding:"20px 16px",maxWidth:500,margin:"0 auto" }}>
      <BackHeader onBack={onBack} sub="DISCOVER" title="Public Leagues"/>
      <div style={{ display:"flex",gap:8,marginBottom:14 }}>
        <input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Search by name or city..." style={{ ...inp,fontSize:13,padding:"10px 14px",flex:1 }}/>
        <button onClick={detectLocation} style={{ padding:"0 14px",background:"rgba(85,119,204,0.1)",border:"1px solid rgba(85,119,204,0.3)",borderRadius:10,color:"#5577CC",fontFamily:"'Space Mono',monospace",fontSize:11,cursor:"pointer",flexShrink:0 }}>{detecting?<Spinner size={14}/>:"📍 NEAR ME"}</button>
      </div>
      {userLocation&&<div style={{ color:"#5577CC",fontSize:11,fontFamily:"'Space Mono',monospace",marginBottom:12 }}>📍 Showing leagues near {userLocation} first</div>}
      {loading&&<div style={{ display:"flex",justifyContent:"center",padding:40 }}><Spinner/></div>}
      {!loading&&nearbyFirst.length===0&&<Card><div style={{ textAlign:"center",padding:"24px 0",color:"#555",fontFamily:"'Space Mono',monospace",fontSize:12 }}>No public leagues found.</div></Card>}
      {nearbyFirst.map((lg:any)=>(
        <Card key={lg.id} style={{ marginBottom:12 }}>
          <div style={{ display:"flex",alignItems:"flex-start",gap:12,marginBottom:12 }}>
            <div style={{ width:46,height:46,borderRadius:12,background:"rgba(85,119,204,0.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0 }}>♠</div>
            <div style={{ flex:1 }}>
              <div style={{ color:"#fff",fontFamily:"'Playfair Display',serif",fontSize:17 }}>{lg.name}</div>
              {lg.description&&<div style={{ color:"#666",fontSize:12,marginTop:2 }}>{lg.description}</div>}
              <div style={{ color:"#555",fontSize:11,fontFamily:"'Space Mono',monospace",marginTop:4 }}>
                {lg.season} · ${lg.buy_in} buy-in{lg.location_name?<span style={{ color:"#5577CC" }}> · 📍 {lg.location_name}</span>:null}
              </div>
            </div>
          </div>
          <button onClick={()=>onJoin(lg)} style={{ width:"100%",padding:"11px 0",background:"rgba(85,119,204,0.15)",border:"1px solid rgba(85,119,204,0.3)",borderRadius:10,color:"#5577CC",fontFamily:"'Space Mono',monospace",fontSize:12,letterSpacing:1.5,cursor:"pointer" }}>JOIN LEAGUE →</button>
        </Card>
      ))}
    </div>
  );
}

// ─── GLOBAL LEADERBOARD ────────────────────────────────
function GlobalLeaderboardView({ profile, onBack }:any) {
  const [leaders,setLeaders]=useState<any[]>([]);const [loading,setLoading]=useState(true);
  const [myStats,setMyStats]=useState<any>(null);

  useEffect(()=>{loadLeaders();},[]);

  const loadLeaders=async()=>{
    if(!db)return;setLoading(true);
    const{data}=await db.from("profiles").select("*").eq("opt_in_global",true).order("global_total_profit",{ascending:false});
    setLeaders(data||[]);
    const{data:me}=await db.from("profiles").select("*").eq("id",profile.id).single();
    setMyStats(me);
    setLoading(false);
  };

  const canPlace=myStats&&(myStats.global_sessions||0)>=50;

  return (
    <div style={{ padding:"20px 16px",maxWidth:500,margin:"0 auto" }}>
      <BackHeader onBack={onBack} sub="WORLDWIDE" title="🏆 Global Leaderboard"/>
      <Card style={{ marginBottom:18,background:"rgba(201,168,76,0.06)",border:"1px solid rgba(201,168,76,0.25)" }}>
        <div style={{ color:"#C9A84C",fontSize:12,fontFamily:"'Space Mono',monospace",letterSpacing:1.5,marginBottom:8 }}>HOW IT WORKS</div>
        <div style={{ color:"#888",fontSize:12,lineHeight:1.7 }}>Players who opt in from Settings are shown here. You need <span style={{ color:"#C9A84C" }}>50 sessions minimum</span> to appear on the board. Anyone can view it.</div>
        {myStats&&(
          <div style={{ marginTop:12,paddingTop:12,borderTop:"1px solid rgba(201,168,76,0.15)" }}>
            <div style={{ color:"#555",fontSize:11,fontFamily:"'Space Mono',monospace" }}>YOUR SESSIONS: <span style={{ color:(myStats.global_sessions||0)>=50?"#4CAF8C":"#E05555" }}>{myStats.global_sessions||0}/50</span> {(myStats.global_sessions||0)<50&&" — keep playing to qualify!"}</div>
            {!myStats.opt_in_global&&canPlace&&<div style={{ color:"#C9A84C",fontSize:11,fontFamily:"'Space Mono',monospace",marginTop:6 }}>You qualify! Opt in from Settings → to appear here.</div>}
          </div>
        )}
      </Card>
      {loading&&<div style={{ display:"flex",justifyContent:"center",padding:40 }}><Spinner/></div>}
      {!loading&&leaders.length===0&&<Card><div style={{ textAlign:"center",padding:"28px 0",color:"#555",fontFamily:"'Space Mono',monospace",fontSize:12 }}>No one on the board yet — opt in from Settings to be first!</div></Card>}
      {leaders.map((p:any,i:number)=>{
        const isMe=p.id===profile.id;
        const medals=["🥇","🥈","🥉"];
        return (
          <div key={p.id} style={{ display:"flex",alignItems:"center",gap:12,padding:"12px 14px",marginBottom:8,background:isMe?"rgba(201,168,76,0.06)":"rgba(255,255,255,0.02)",border:`1px solid ${isMe?"rgba(201,168,76,0.3)":"rgba(255,255,255,0.06)"}`,borderRadius:13 }}>
            <div style={{ width:28,textAlign:"center",fontFamily:"'Space Mono',monospace",color:i<3?"#C9A84C":"#444",fontSize:14 }}>{i<3?medals[i]:i+1}</div>
            <Avatar name={p.display_name} url={p.avatar_url} size={38}/>
            <div style={{ flex:1 }}>
              <div style={{ color:"#fff",fontSize:14 }}>{p.display_name} {isMe&&<span style={{ color:"#C9A84C",fontSize:11,fontFamily:"'Space Mono',monospace" }}>(you)</span>}</div>
              <div style={{ color:"#555",fontSize:11,fontFamily:"'Space Mono',monospace" }}>{p.global_sessions||0} sessions · {p.global_wins||0}W</div>
            </div>
            <div style={{ textAlign:"right" }}>
              <div style={{ color:(p.global_total_profit||0)>=0?"#4CAF8C":"#E05555",fontFamily:"'Space Mono',monospace",fontWeight:700 }}>{(p.global_total_profit||0)>=0?"+":""}${p.global_total_profit||0}</div>
              <div style={{ color:"#444",fontSize:10,fontFamily:"'Space Mono',monospace" }}>{p.global_sessions>0?((p.global_wins/p.global_sessions)*100).toFixed(0):0}% win</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── LEAGUE PAGE (Clash Royale style) ──────────────────
function LeagueView({ league, players, sessions, profile, isCommissioner, onNav, onStartSession, onBack, onCommSettings, liveSession }:any) {
  const [sortBy,setSortBy]=useState<'profit'|'winpct'|'sessions'>('profit');

  const getSorted=()=>{
    const c=[...players];
    if(sortBy==='profit')return c.sort((a:any,b:any)=>b.total_profit-a.total_profit);
    if(sortBy==='winpct')return c.sort((a:any,b:any)=>{const ar=a.session_count>0?a.wins/a.session_count:0;const br=b.session_count>0?b.wins/b.session_count:0;return br-ar;});
    return c.sort((a:any,b:any)=>b.session_count-a.session_count);
  };
  const sorted=getSorted();
  const sessionsLeft=league.season_length>0?league.season_length-sessions.length:null;

  return (
    <div style={{ maxWidth:500,margin:"0 auto" }}>
      {/* Header banner */}
      <div style={{ background:"linear-gradient(180deg,rgba(20,40,20,0.95) 0%,rgba(10,10,10,0) 100%)",padding:"20px 16px 0" }}>
        <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:14 }}>
          <button onClick={onBack} style={{ background:"none",border:"none",color:"#555",fontSize:22,cursor:"pointer" }}>←</button>
          <div style={{ flex:1,minWidth:0 }}>
            <div style={{ fontFamily:"'Playfair Display',serif",fontSize:22,fontWeight:700,color:"#fff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{league.name}</div>
            {league.description&&<div style={{ color:"#666",fontSize:12,marginTop:1 }}>{league.description}</div>}
          </div>
          {isCommissioner&&<button onClick={onCommSettings} style={{ background:"rgba(201,168,76,0.1)",border:"1px solid rgba(201,168,76,0.2)",borderRadius:20,padding:"5px 11px",color:"#C9A84C",fontFamily:"'Space Mono',monospace",fontSize:10,cursor:"pointer",flexShrink:0 }}>👑 MANAGE</button>}
        </div>

        {/* Stats row */}
        <div style={{ display:"flex",gap:8,marginBottom:14 }}>
          <StatBox label="Members" value={players.length}/>
          <StatBox label="Sessions" value={sessions.length}/>
          <StatBox label="Buy-in" value={`$${league.buy_in}`} accent="#4CAF8C"/>
          {sessionsLeft!==null&&<StatBox label="Left" value={sessionsLeft<=0?"Done!":sessionsLeft} accent={sessionsLeft<=0?"#E05555":"#C9A84C"}/>}
        </div>

        {/* Code row */}
        <div style={{ display:"flex",gap:8,alignItems:"center",marginBottom:16,flexWrap:"wrap" }}>
          <span style={{ color:"#555",fontSize:11,fontFamily:"'Space Mono',monospace" }}>Code:</span>
          <span style={{ color:"#C9A84C",fontSize:12,fontFamily:"'Space Mono',monospace",letterSpacing:3,background:"rgba(201,168,76,0.1)",padding:"2px 10px",borderRadius:6 }}>{league.code}</span>
          {league.is_public&&<Badge text="PUBLIC 🌍" color="#5577CC"/>}
          {league.location_name&&<span style={{ color:"#555",fontSize:11,fontFamily:"'Space Mono',monospace" }}>📍 {league.location_name}</span>}
        </div>
      </div>

      <div style={{ padding:"0 16px 20px" }}>
        {/* Live session banner */}
        {liveSession&&(
          <div onClick={()=>onNav(VIEWS.liveSession)} style={{ background:"rgba(76,175,140,0.1)",border:"1px solid rgba(76,175,140,0.4)",borderRadius:14,padding:"14px 18px",marginBottom:16,cursor:"pointer",display:"flex",alignItems:"center",gap:12 }}>
            <div style={{ width:10,height:10,borderRadius:"50%",background:"#4CAF8C",animation:"pulse 1.5s infinite",flexShrink:0 }}/>
            <div style={{ flex:1 }}>
              <div style={{ color:"#4CAF8C",fontFamily:"'Space Mono',monospace",fontSize:12,letterSpacing:2 }}>GAME IS LIVE</div>
              <div style={{ color:"#888",fontSize:11,marginTop:2 }}>Tap to view session & enter your stats</div>
            </div>
            <span style={{ color:"#4CAF8C",fontSize:20 }}>›</span>
          </div>
        )}

        {/* Start session (commissioner only) */}
        {isCommissioner&&!liveSession&&(
          <button onClick={onStartSession} style={{ width:"100%",padding:"14px 0",marginBottom:16,background:"linear-gradient(135deg,#1a4a2a,#2a6a3a)",border:"1px solid rgba(76,175,140,0.4)",borderRadius:14,color:"#4CAF8C",fontFamily:"'Space Mono',monospace",fontWeight:700,fontSize:13,letterSpacing:2,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:10 }}><span style={{ fontSize:18 }}>♠</span> START TONIGHT'S SESSION</button>
        )}
        {!isCommissioner&&!liveSession&&<div style={{ marginBottom:16,padding:"11px 14px",background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.05)",borderRadius:12,color:"#444",fontFamily:"'Space Mono',monospace",fontSize:11,textAlign:"center" }}>👑 Commissioner starts sessions · stay tuned</div>}

        {/* Sort tabs */}
        <div style={{ display:"flex",gap:6,marginBottom:14 }}>
          <div style={{ color:"#555",fontSize:11,fontFamily:"'Space Mono',monospace",alignSelf:"center",marginRight:4 }}>SORT:</div>
          {([['profit','$ P/L'],['winpct','WIN %'],['sessions','GAMES']] as any[]).map(([key,label])=><button key={key} onClick={()=>setSortBy(key)} style={{ padding:"5px 12px",borderRadius:20,background:sortBy===key?"rgba(201,168,76,0.2)":"rgba(255,255,255,0.04)",border:`1px solid ${sortBy===key?"rgba(201,168,76,0.4)":"rgba(255,255,255,0.08)"}`,color:sortBy===key?"#C9A84C":"#555",fontFamily:"'Space Mono',monospace",fontSize:11,cursor:"pointer" }}>{label}</button>)}
        </div>

        {/* Member list */}
        <Card style={{ padding:0,overflow:"hidden" }}>
          {sorted.length===0&&<div style={{ color:"#555",fontFamily:"'Space Mono',monospace",fontSize:12,textAlign:"center",padding:"24px 0" }}>No members yet</div>}
          {sorted.map((p:any,i:number)=>{
            const isComm=p.name.toLowerCase()===league.commissioner_name?.toLowerCase();
            const winPct=p.session_count>0?((p.wins/p.session_count)*100).toFixed(0):0;
            const medals=["🥇","🥈","🥉"];
            const isTop3=i<3;
            return (
              <div key={p.id} onClick={()=>onNav(VIEWS.profile,p)} style={{ display:"flex",alignItems:"center",gap:12,padding:"13px 18px",borderBottom:"1px solid rgba(255,255,255,0.05)",cursor:"pointer",background:i===0?"rgba(201,168,76,0.04)":"transparent" }}>
                <div style={{ width:24,textAlign:"center",fontSize:isTop3?16:13,fontFamily:"'Space Mono',monospace",color:isTop3?"#C9A84C":"#444" }}>{isTop3?medals[i]:i+1}</div>
                <Avatar name={p.name} size={40}/>
                <div style={{ flex:1,minWidth:0 }}>
                  <div style={{ color:"#fff",fontSize:14,display:"flex",alignItems:"center",gap:5,overflow:"hidden" }}>{p.name.length>14?p.name.slice(0,14)+"…":p.name} {isComm&&<span style={{ fontSize:13 }}>👑</span>} {p.streak>1&&<span>🔥</span>}</div>
                  <div style={{ color:"#555",fontSize:10,fontFamily:"'Space Mono',monospace",marginTop:2 }}>{p.session_count} games · {p.wins}W · {winPct}% win</div>
                </div>
                <div style={{ textAlign:"right",flexShrink:0 }}>
                  <div style={{ color:p.total_profit>=0?"#4CAF8C":"#E05555",fontFamily:"'Space Mono',monospace",fontWeight:700,fontSize:14 }}>{p.total_profit>=0?"+":""}${p.total_profit}</div>
                  <div style={{ color:"#444",fontSize:10,fontFamily:"'Space Mono',monospace" }}>best ${p.best_night}</div>
                </div>
              </div>
            );
          })}
        </Card>

        {/* Recent sessions */}
        {sessions.length>0&&(
          <Card style={{ marginTop:14 }}>
            <div style={{ color:"#888",fontSize:11,fontFamily:"'Space Mono',monospace",letterSpacing:2,marginBottom:12 }}>RECENT SESSIONS</div>
            {sessions.slice(0,4).map((s:any,i:number)=>{
              const d=new Date(s.created_at);
              return <div key={s.id} style={{ display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:i<Math.min(sessions.length,4)-1?"1px solid rgba(255,255,255,0.05)":"none" }}>
                <div style={{ width:32,textAlign:"center" }}><div style={{ color:"#C9A84C",fontSize:11,fontFamily:"'Space Mono',monospace" }}>{d.getDate()}</div><div style={{ color:"#555",fontSize:9 }}>{d.toLocaleDateString('en-US',{month:'short'})}</div></div>
                <div style={{ flex:1 }}><div style={{ color:"#fff",fontSize:12 }}>${s.pot} pot{s.buy_in_amount?` · $${s.buy_in_amount} buy-in`:""}</div><div style={{ color:"#555",fontSize:10,fontFamily:"'Space Mono',monospace" }}>🏆 {s.winner_name||"TBD"}</div></div>
                <Badge text="✓" color="#4CAF8C"/>
              </div>;
            })}
          </Card>
        )}
      </div>
    </div>
  );
}

// ─── LIVE SESSION VIEW (all players) ───────────────────
function LiveSessionView({ session, liveEntries, players, profile, isCommissioner, league, onBack, onSubmitEntry, onEndSession }:any) {
  const [elapsed,setElapsed]=useState(0);
  const [myBuyIn,setMyBuyIn]=useState(0);
  const [myRebuys,setMyRebuys]=useState(0);
  const [cashOuts,setCashOuts]=useState<any>({});
  const [saving,setSaving]=useState(false);
  const [showCashout,setShowCashout]=useState(false);

  const myPlayer=players.find((p:any)=>p.name.toLowerCase()===profile.display_name.toLowerCase());
  const myEntry=liveEntries.find((e:any)=>e.player_name.toLowerCase()===profile.display_name.toLowerCase());

  useEffect(()=>{
    if(session?.started_at){const t=setInterval(()=>{setElapsed(Math.floor((Date.now()-new Date(session.started_at).getTime())/1000));},1000);return()=>clearInterval(t);}
  },[session]);

  useEffect(()=>{
    if(myEntry){setMyBuyIn(myEntry.buy_in||0);setMyRebuys(myEntry.rebuys||0);}
    else{setMyBuyIn(league.buy_in);setMyRebuys(0);}
  },[myEntry]);

  const fmt=(s:number)=>`${Math.floor(s/3600)}:${String(Math.floor((s%3600)/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;
  const totalPot=liveEntries.reduce((a:number,e:any)=>a+(e.buy_in||0)+(e.rebuys||0),0);

  const handleSubmitMyStats=async()=>{
    if(!myPlayer)return;setSaving(true);
    await onSubmitEntry({player_id:myPlayer.id,player_name:profile.display_name,buy_in:myBuyIn,rebuys:myRebuys});
    setSaving(false);
  };

  const handleEndSession=async()=>{
    setSaving(true);
    const entries=liveEntries.map((e:any)=>({player_id:e.player_id,player_name:e.player_name,buy_in:e.buy_in||0,rebuys:e.rebuys||0,cash_out:cashOuts[e.player_id]||0,profit:(cashOuts[e.player_id]||0)-((e.buy_in||0)+(e.rebuys||0))}));
    await onEndSession({entries,elapsed});setSaving(false);
  };

  const ni:any={background:"rgba(255,255,255,0.05)",border:"1px solid rgba(201,168,76,0.25)",borderRadius:8,padding:"8px 10px",color:"#fff",fontSize:14,fontFamily:"'Space Mono',monospace",outline:"none",width:65,textAlign:"center",boxSizing:"border-box"};

  return (
    <div style={{ padding:"16px 16px",maxWidth:500,margin:"0 auto" }}>
      <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:16 }}>
        <button onClick={onBack} style={{ background:"none",border:"none",color:"#555",fontSize:22,cursor:"pointer" }}>←</button>
        <div style={{ flex:1 }}>
          <div style={{ color:"#4CAF8C",fontSize:11,fontFamily:"'Space Mono',monospace",letterSpacing:2 }}>● GAME IS LIVE</div>
          <div style={{ fontFamily:"'Playfair Display',serif",fontSize:20,color:"#fff" }}>{league.name}</div>
        </div>
      </div>

      {/* Timer + pot */}
      <div style={{ display:"flex",gap:10,marginBottom:16 }}>
        <div style={{ flex:1,background:"rgba(76,175,140,0.1)",border:"1px solid rgba(76,175,140,0.3)",borderRadius:14,padding:"14px 16px",textAlign:"center" }}>
          <div style={{ color:"#555",fontSize:10,fontFamily:"'Space Mono',monospace",letterSpacing:2 }}>TIME</div>
          <div style={{ color:"#4CAF8C",fontSize:28,fontFamily:"'Space Mono',monospace",fontWeight:700,marginTop:4 }}>{fmt(elapsed)}</div>
        </div>
        <div style={{ flex:1,background:"rgba(201,168,76,0.08)",border:"1px solid rgba(201,168,76,0.2)",borderRadius:14,padding:"14px 16px",textAlign:"center" }}>
          <div style={{ color:"#555",fontSize:10,fontFamily:"'Space Mono',monospace",letterSpacing:2 }}>TOTAL POT</div>
          <div style={{ color:"#C9A84C",fontSize:28,fontFamily:"'Space Mono',monospace",fontWeight:700,marginTop:4 }}>${totalPot}</div>
        </div>
      </div>

      {/* My stats entry (non-commissioner) */}
      {!isCommissioner&&myPlayer&&(
        <Card style={{ marginBottom:14,border:"1px solid rgba(201,168,76,0.3)",background:"rgba(201,168,76,0.04)" }}>
          <div style={{ color:"#C9A84C",fontSize:11,fontFamily:"'Space Mono',monospace",letterSpacing:2,marginBottom:12 }}>YOUR STATS</div>
          <div style={{ display:"flex",gap:16,alignItems:"center",marginBottom:12 }}>
            <div style={{ flex:1 }}><div style={{ color:"#888",fontSize:10,fontFamily:"'Space Mono',monospace",marginBottom:6 }}>BUY-IN</div><input type="number" value={myBuyIn||""} onChange={e=>setMyBuyIn(Number(e.target.value))} style={{...ni,width:"100%"}}/></div>
            <div style={{ flex:1 }}><div style={{ color:"#888",fontSize:10,fontFamily:"'Space Mono',monospace",marginBottom:6 }}>REBUYS ($)</div><input type="number" value={myRebuys||""} onChange={e=>setMyRebuys(Number(e.target.value))} style={{...ni,width:"100%"}}/></div>
          </div>
          <button onClick={handleSubmitMyStats} disabled={saving} style={{ width:"100%",padding:"11px 0",background:"rgba(201,168,76,0.15)",border:"1px solid rgba(201,168,76,0.3)",borderRadius:10,color:"#C9A84C",fontFamily:"'Space Mono',monospace",fontSize:12,letterSpacing:1.5,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8 }}>{saving?<Spinner size={14}/>:"SUBMIT MY STATS ✓"}</button>
        </Card>
      )}

      {/* All players in session */}
      <Card style={{ marginBottom:14 }}>
        <div style={{ color:"#888",fontSize:11,fontFamily:"'Space Mono',monospace",letterSpacing:2,marginBottom:12 }}>PLAYERS IN SESSION ({liveEntries.length})</div>
        {liveEntries.length===0&&<div style={{ color:"#555",fontSize:12,fontFamily:"'Space Mono',monospace",textAlign:"center",padding:"12px 0" }}>Waiting for players to submit stats...</div>}
        {liveEntries.map((e:any,i:number)=>{
          const total=(e.buy_in||0)+(e.rebuys||0);
          const isMe=e.player_name.toLowerCase()===profile.display_name.toLowerCase();
          return <div key={e.id||i} style={{ display:"flex",alignItems:"center",gap:10,padding:"9px 0",borderBottom:i<liveEntries.length-1?"1px solid rgba(255,255,255,0.05)":"none" }}>
            <Avatar name={e.player_name} size={34}/>
            <div style={{ flex:1 }}><div style={{ color:"#fff",fontSize:13 }}>{e.player_name} {isMe&&<span style={{ color:"#C9A84C",fontSize:10 }}>(you)</span>}</div><div style={{ color:"#555",fontSize:10,fontFamily:"'Space Mono',monospace" }}>Buy-in: ${e.buy_in||0} · Rebuys: ${e.rebuys||0}</div></div>
            <div style={{ color:"#4CAF8C",fontFamily:"'Space Mono',monospace",fontWeight:700 }}>${total}</div>
          </div>;
        })}
      </Card>

      {/* Commissioner: end session + cashouts */}
      {isCommissioner&&(
        <>
          {!showCashout&&<button onClick={()=>setShowCashout(true)} style={{ width:"100%",padding:"14px 0",background:"linear-gradient(135deg,#5a0000,#8B1A1A)",border:"1px solid rgba(224,85,85,0.4)",borderRadius:12,color:"#E05555",fontFamily:"'Space Mono',monospace",fontWeight:700,fontSize:13,letterSpacing:2,cursor:"pointer" }}>END GAME & ENTER CASH-OUTS →</button>}
          {showCashout&&(
            <Card>
              <div style={{ color:"#888",fontSize:11,fontFamily:"'Space Mono',monospace",letterSpacing:2,marginBottom:12 }}>ENTER CASH-OUTS</div>
              {liveEntries.map((e:any)=>(
                <div key={e.player_id} style={{ display:"flex",alignItems:"center",gap:10,marginBottom:10 }}>
                  <Avatar name={e.player_name} size={30}/>
                  <div style={{ flex:1 }}><div style={{ color:"#fff",fontSize:13 }}>{e.player_name}</div><div style={{ color:"#555",fontSize:10,fontFamily:"'Space Mono',monospace" }}>In: ${(e.buy_in||0)+(e.rebuys||0)}</div></div>
                  <input type="number" value={cashOuts[e.player_id]||""} onChange={ev=>setCashOuts((c:any)=>({...c,[e.player_id]:Number(ev.target.value)}))} placeholder="$0" style={{...ni,width:"75px"}}/>
                </div>
              ))}
              <button onClick={handleEndSession} disabled={saving} style={{ width:"100%",marginTop:12,padding:"13px 0",background:saving?"rgba(255,255,255,0.08)":"linear-gradient(135deg,#C9A84C,#E8C56A)",border:"none",borderRadius:10,color:saving?"#444":"#0A0A0A",fontFamily:"'Space Mono',monospace",fontWeight:700,fontSize:13,letterSpacing:2,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:10 }}>{saving?<><Spinner size={16}/>SAVING...</>:"APPROVE & SAVE SESSION ✓"}</button>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// ─── NEW SESSION (commissioner setup) ──────────────────
function NewSessionView({ league, players, onStart, onBack }:any) {
  const [sessionBuyIn,setSessionBuyIn]=useState(league.buy_in);
  const [selectedIds,setSelectedIds]=useState<string[]>([]);
  const [loading,setLoading]=useState(false);

  const handleStart=async()=>{
    if(selectedIds.length<2||!db)return;setLoading(true);
    await onStart({selectedIds,sessionBuyIn});setLoading(false);
  };

  return (
    <div style={{ padding:"20px 16px",maxWidth:500,margin:"0 auto" }}>
      <BackHeader onBack={onBack} sub="NEW SESSION" title="Tonight's Setup"/>
      <Card style={{ marginBottom:14 }}>
        <div style={{ color:"#888",fontSize:11,fontFamily:"'Space Mono',monospace",letterSpacing:2,marginBottom:12 }}>BUY-IN FOR TONIGHT</div>
        <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:12 }}>
          <button onClick={()=>setSessionBuyIn(Math.max(1,sessionBuyIn-5))} style={{ width:40,height:40,borderRadius:10,background:"rgba(224,85,85,0.15)",border:"1px solid rgba(224,85,85,0.3)",color:"#E05555",fontSize:20,cursor:"pointer" }}>−</button>
          <div style={{ flex:1,textAlign:"center" }}><div style={{ color:"#C9A84C",fontSize:34,fontFamily:"'Space Mono',monospace",fontWeight:700 }}>${sessionBuyIn}</div><div style={{ color:"#555",fontSize:11,fontFamily:"'Space Mono',monospace" }}>default: ${league.buy_in}</div></div>
          <button onClick={()=>setSessionBuyIn(sessionBuyIn+5)} style={{ width:40,height:40,borderRadius:10,background:"rgba(76,175,140,0.15)",border:"1px solid rgba(76,175,140,0.3)",color:"#4CAF8C",fontSize:20,cursor:"pointer" }}>+</button>
        </div>
        <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>{[10,20,25,50,100].map(amt=><button key={amt} onClick={()=>setSessionBuyIn(amt)} style={{ padding:"5px 12px",borderRadius:20,background:sessionBuyIn===amt?"rgba(201,168,76,0.2)":"rgba(255,255,255,0.04)",border:`1px solid ${sessionBuyIn===amt?"rgba(201,168,76,0.4)":"rgba(255,255,255,0.08)"}`,color:sessionBuyIn===amt?"#C9A84C":"#555",fontFamily:"'Space Mono',monospace",fontSize:12,cursor:"pointer" }}>${amt}</button>)}</div>
      </Card>
      <div style={{ color:"#888",fontSize:11,fontFamily:"'Space Mono',monospace",letterSpacing:2,marginBottom:10 }}>WHO'S PLAYING TONIGHT</div>
      <Card style={{ marginBottom:18 }}>
        {players.map((p:any)=>{const sel=selectedIds.includes(p.id);return <div key={p.id} onClick={()=>setSelectedIds(sel?selectedIds.filter(x=>x!==p.id):[...selectedIds,p.id])} style={{ display:"flex",alignItems:"center",gap:12,padding:"11px 0",borderBottom:"1px solid rgba(255,255,255,0.05)",cursor:"pointer",opacity:sel?1:0.5 }}>
          <div style={{ width:22,height:22,borderRadius:6,border:`2px solid ${sel?"#C9A84C":"#333"}`,background:sel?"#C9A84C":"transparent",display:"flex",alignItems:"center",justifyContent:"center",color:"#000",fontSize:13,flexShrink:0 }}>{sel?"✓":""}</div>
          <Avatar name={p.name} size={36}/><div style={{ flex:1 }}><div style={{ color:"#fff" }}>{p.name}</div><div style={{ color:"#555",fontSize:10,fontFamily:"'Space Mono',monospace" }}>{p.wins}W · {p.total_profit>=0?"+":""}${p.total_profit}</div></div>
        </div>;})}
      </Card>
      <button disabled={selectedIds.length<2||loading} onClick={handleStart} style={{ width:"100%",padding:"14px 0",background:selectedIds.length>=2&&!loading?"linear-gradient(135deg,#C9A84C,#E8C56A)":"rgba(255,255,255,0.08)",border:"none",borderRadius:12,color:selectedIds.length>=2&&!loading?"#0A0A0A":"#444",fontFamily:"'Space Mono',monospace",fontWeight:700,fontSize:13,letterSpacing:2,cursor:selectedIds.length>=2&&!loading?"pointer":"not-allowed",display:"flex",alignItems:"center",justifyContent:"center",gap:10 }}>{loading?<Spinner size={18}/>:`START SESSION WITH ${selectedIds.length} PLAYERS →`}</button>
    </div>
  );
}

// ─── HAND RANKINGS ─────────────────────────────────────
function HandRankingsView({ onBack }:any) {
  const suits=["♠","♥","♦","♣"];
  return (
    <div style={{ padding:"20px 16px",maxWidth:500,margin:"0 auto" }}>
      <BackHeader onBack={onBack} sub="POKER REFERENCE" title="Hand Rankings"/>
      <div style={{ color:"#555",fontSize:12,fontFamily:"'Space Mono',monospace",marginBottom:18 }}>#1 is the best hand · #10 is the lowest</div>
      {HAND_RANKINGS.map((h,i)=>(
        <div key={h.rank} style={{ display:"flex",alignItems:"center",gap:14,padding:"13px 16px",marginBottom:8,background:"rgba(255,255,255,0.03)",border:`1px solid ${h.rank<=2?"rgba(201,168,76,0.25)":"rgba(255,255,255,0.07)"}`,borderRadius:13 }}>
          <div style={{ width:32,height:32,borderRadius:10,background:`${h.color}22`,border:`1px solid ${h.color}44`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Space Mono',monospace",fontWeight:700,color:h.color,fontSize:13,flexShrink:0 }}>{h.rank}</div>
          <div style={{ flex:1 }}>
            <div style={{ color:h.color,fontFamily:"'Playfair Display',serif",fontSize:16,fontWeight:700 }}>{h.name}</div>
            <div style={{ color:"#666",fontSize:11,marginTop:2 }}>{h.desc}</div>
            <div style={{ color:"#444",fontSize:11,fontFamily:"'Space Mono',monospace",marginTop:3,letterSpacing:1 }}>{h.example}</div>
          </div>
          {h.rank<=3&&<div style={{ fontSize:18,flexShrink:0 }}>{["👑","⭐","💎"][i]}</div>}
        </div>
      ))}
      <Card style={{ marginTop:16,background:"rgba(201,168,76,0.04)" }}>
        <div style={{ color:"#C9A84C",fontSize:11,fontFamily:"'Space Mono',monospace",letterSpacing:2,marginBottom:10 }}>QUICK TIP</div>
        <div style={{ color:"#888",fontSize:12,lineHeight:1.7 }}>In Texas Hold'em, you use the best 5 cards from your 2 hole cards + 5 community cards. Ties are broken by the highest card in the hand.</div>
      </Card>
    </div>
  );
}

// ─── FEED (mutual friends only) ────────────────────────
function FeedView({ profile, myLeagues, currentLeague, onBack }:any) {
  const [posts,setPosts]=useState<any[]>([]);const [loading,setLoading]=useState(true);
  const [newPost,setNewPost]=useState("");const [selectedLeagueId,setSelectedLeagueId]=useState(currentLeague?.id||(myLeagues[0]?.id||""));
  const [uploading,setUploading]=useState(false);const [mediaFile,setMediaFile]=useState<File|null>(null);const [mediaPreview,setMediaPreview]=useState<string|null>(null);
  const fileRef=useRef<HTMLInputElement>(null);

  useEffect(()=>{loadPosts();},[]);

  const loadPosts=async()=>{
    if(!db||myLeagues.length===0){setLoading(false);return;}setLoading(true);
    // Get mutual friends
    const name=profile.display_name;
    const{data:friendData}=await db.from("friends").select("*").or(`requester_name.ilike.${name},recipient_name.ilike.${name}`).eq("status","accepted");
    const mutualNames=new Set<string>([name]);
    (friendData||[]).forEach((f:any)=>{mutualNames.add(f.requester_name.toLowerCase());mutualNames.add(f.recipient_name.toLowerCase());});
    const ids=myLeagues.map((l:any)=>l.id);
    const{data}=await db.from("posts").select("*").in("league_id",ids).order("created_at",{ascending:false});
    // Filter to mutual friends only
    const filtered=(data||[]).filter((p:any)=>mutualNames.has(p.author_name.toLowerCase()));
    setPosts(filtered);setLoading(false);
  };

  const getLeagueName=(id:string)=>myLeagues.find((l:any)=>l.id===id)?.name||"Unknown";
  const timeAgo=(ts:string)=>{const diff=Date.now()-new Date(ts).getTime();const m=Math.floor(diff/60000),h=Math.floor(m/60),d=Math.floor(h/24);if(d>0)return`${d}d ago`;if(h>0)return`${h}h ago`;if(m>0)return`${m}m ago`;return"just now";};
  const handleMedia=(e:any)=>{const f=e.target.files?.[0];if(!f)return;setMediaFile(f);setMediaPreview(URL.createObjectURL(f));};

  const handlePost=async()=>{
    if(!db||(!newPost.trim()&&!mediaFile)||!selectedLeagueId)return;setUploading(true);
    try{let mediaUrl=null,mediaType=null;if(mediaFile){const ext=mediaFile.name.split('.').pop();const path=`${selectedLeagueId}/${Date.now()}.${ext}`;const{error:upErr}=await db.storage.from("posts").upload(path,mediaFile);if(!upErr){const{data:urlData}=db.storage.from("posts").getPublicUrl(path);mediaUrl=urlData.publicUrl;mediaType=mediaFile.type.startsWith("video")?"video":"image";}}await db.from("posts").insert({league_id:selectedLeagueId,author_name:profile.display_name,content:newPost.trim()||null,media_url:mediaUrl,media_type:mediaType});setNewPost("");setMediaFile(null);setMediaPreview(null);await loadPosts();}finally{setUploading(false);}
  };

  return (
    <div style={{ padding:"20px 16px",maxWidth:500,margin:"0 auto" }}>
      <BackHeader onBack={onBack} title="League Feed"/>
      <div style={{ color:"#555",fontSize:11,fontFamily:"'Space Mono',monospace",marginBottom:14 }}>Posts from you + mutual friends across your leagues</div>
      {myLeagues.length>0&&(
        <Card style={{ marginBottom:16 }}>
          <div style={{ display:"flex",gap:10,marginBottom:10 }}><Avatar name={profile.display_name} url={profile.avatar_url} size={34}/><textarea value={newPost} onChange={e=>setNewPost(e.target.value)} placeholder="Share a moment from the game..." style={{ flex:1,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(201,168,76,0.2)",borderRadius:10,padding:10,color:"#fff",fontFamily:"'Space Mono',monospace",fontSize:12,resize:"none",height:65,outline:"none" }}/></div>
          {myLeagues.length>1&&<div style={{ marginBottom:10 }}><div style={{ color:"#666",fontSize:10,fontFamily:"'Space Mono',monospace",letterSpacing:1.5,marginBottom:6 }}>POST TO</div><div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>{myLeagues.map((lg:any)=><button key={lg.id} onClick={()=>setSelectedLeagueId(lg.id)} style={{ padding:"3px 10px",borderRadius:20,background:selectedLeagueId===lg.id?"rgba(201,168,76,0.2)":"rgba(255,255,255,0.04)",border:`1px solid ${selectedLeagueId===lg.id?"rgba(201,168,76,0.4)":"rgba(255,255,255,0.08)"}`,color:selectedLeagueId===lg.id?"#C9A84C":"#555",fontFamily:"'Space Mono',monospace",fontSize:10,cursor:"pointer" }}>{lg.name}</button>)}</div></div>}
          {mediaPreview&&<div style={{ position:"relative",marginBottom:10 }}>{mediaFile?.type.startsWith("video")?<video src={mediaPreview} controls style={{ width:"100%",borderRadius:10,maxHeight:280 }}/>:<img src={mediaPreview} style={{ width:"100%",borderRadius:10,maxHeight:280,objectFit:"cover" }}/>}<button onClick={()=>{setMediaFile(null);setMediaPreview(null);}} style={{ position:"absolute",top:6,right:6,background:"rgba(0,0,0,0.7)",border:"none",borderRadius:"50%",color:"#fff",width:26,height:26,cursor:"pointer",fontSize:13 }}>×</button></div>}
          <div style={{ display:"flex",gap:8,alignItems:"center" }}>
            <button onClick={()=>fileRef.current?.click()} style={{ padding:"6px 12px",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:20,color:"#888",fontFamily:"'Space Mono',monospace",fontSize:10,cursor:"pointer" }}>📷 PHOTO/VIDEO</button>
            <input ref={fileRef} type="file" accept="image/*,video/*" onChange={handleMedia} style={{ display:"none" }}/>
            <button onClick={handlePost} disabled={uploading||(!newPost.trim()&&!mediaFile)} style={{ marginLeft:"auto",padding:"6px 16px",background:(!newPost.trim()&&!mediaFile)||uploading?"rgba(255,255,255,0.06)":"linear-gradient(135deg,#C9A84C,#E8C56A)",border:"none",borderRadius:20,color:(!newPost.trim()&&!mediaFile)||uploading?"#444":"#0A0A0A",fontFamily:"'Space Mono',monospace",fontWeight:700,fontSize:11,cursor:"pointer",display:"flex",alignItems:"center",gap:6 }}>{uploading?<Spinner size={12}/>:"POST"}</button>
          </div>
        </Card>
      )}
      {loading&&<div style={{ display:"flex",justifyContent:"center",padding:40 }}><Spinner/></div>}
      {!loading&&posts.length===0&&<Card><div style={{ textAlign:"center",padding:"28px 0",color:"#555",fontFamily:"'Space Mono',monospace",fontSize:12 }}>No posts yet from you or your friends.<br/>Add friends from league standings!</div></Card>}
      {posts.map((post:any)=>(
        <Card key={post.id} style={{ marginBottom:12 }}>
          <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:10 }}><Avatar name={post.author_name} size={34}/><div style={{ flex:1 }}><div style={{ color:"#fff",fontWeight:600 }}>{post.author_name}</div><div style={{ display:"flex",gap:8,alignItems:"center",marginTop:2 }}><span style={{ color:"#C9A84C",fontSize:10,fontFamily:"'Space Mono',monospace",background:"rgba(201,168,76,0.1)",padding:"1px 8px",borderRadius:10 }}>{getLeagueName(post.league_id)}</span><span style={{ color:"#555",fontSize:10,fontFamily:"'Space Mono',monospace" }}>{timeAgo(post.created_at)}</span></div></div></div>
          {post.content&&<div style={{ color:"#ccc",fontSize:13,lineHeight:1.6,marginBottom:post.media_url?10:0 }}>{post.content}</div>}
          {post.media_url&&(post.media_type==="video"?<video src={post.media_url} controls style={{ width:"100%",borderRadius:10,maxHeight:360 }}/>:<img src={post.media_url} style={{ width:"100%",borderRadius:10,maxHeight:360,objectFit:"cover" }}/>)}
        </Card>
      ))}
    </div>
  );
}

// ─── STANDINGS ─────────────────────────────────────────
function StandingsView({ players, league, onNav, onBack }:any) {
  const [sortBy,setSortBy]=useState("profit");
  const sorted=[...players].sort((a:any,b:any)=>sortBy==="profit"?b.total_profit-a.total_profit:sortBy==="wins"?b.wins-a.wins:sortBy==="sessions"?b.session_count-a.session_count:b.best_night-a.best_night);
  const top3=[...players].sort((a:any,b:any)=>b.total_profit-a.total_profit).slice(0,3);
  return (
    <div style={{ padding:"20px 16px",maxWidth:500,margin:"0 auto" }}>
      <BackHeader onBack={onBack} sub={league.season} title="Standings"/>
      {top3.length>=2&&<div style={{ display:"flex",alignItems:"flex-end",justifyContent:"center",gap:12,marginBottom:22,height:120 }}>{[top3[1],top3[0],top3[2]].map((p:any,i:number)=>{const h=[76,116,58][i];const rank=[2,1,3][i];return p?<div key={p.id} onClick={()=>onNav(VIEWS.profile,p)} style={{ display:"flex",flexDirection:"column",alignItems:"center",cursor:"pointer" }}><Avatar name={p.name} size={rank===1?44:32}/><div style={{ fontSize:rank===1?17:13,marginTop:3 }}>{["🥇","🥈","🥉"][rank-1]}</div><div style={{ width:rank===1?70:54,height:h,background:`rgba(201,168,76,${[0.12,0.28,0.08][i]})`,border:`1px solid rgba(201,168,76,${[0.2,0.45,0.12][i]})`,borderRadius:"6px 6px 0 0",marginTop:4,display:"flex",alignItems:"center",justifyContent:"center",color:"#C9A84C",fontFamily:"'Space Mono',monospace",fontSize:13,fontWeight:700 }}>{rank}</div></div>:<div key={i} style={{ width:54 }}/>;})}</div>}
      <div style={{ display:"flex",gap:6,marginBottom:12,flexWrap:"wrap" }}>{[["profit","Profit"],["wins","Wins"],["sessions","Sessions"],["best","Best Night"]].map(([key,label])=><button key={key} onClick={()=>setSortBy(key)} style={{ padding:"5px 12px",borderRadius:20,background:sortBy===key?"rgba(201,168,76,0.2)":"rgba(255,255,255,0.04)",border:`1px solid ${sortBy===key?"rgba(201,168,76,0.4)":"rgba(255,255,255,0.08)"}`,color:sortBy===key?"#C9A84C":"#555",fontSize:11,fontFamily:"'Space Mono',monospace",cursor:"pointer" }}>{label}</button>)}</div>
      <Card>{sorted.length===0&&<div style={{ color:"#555",fontFamily:"'Space Mono',monospace",fontSize:12,textAlign:"center",padding:"16px 0" }}>No data yet</div>}{sorted.map((p:any,i:number)=>{const isComm=p.name.toLowerCase()===league.commissioner_name?.toLowerCase();return <div key={p.id} onClick={()=>onNav(VIEWS.profile,p)} style={{ display:"flex",alignItems:"center",gap:10,padding:"10px 0",borderBottom:i<sorted.length-1?"1px solid rgba(255,255,255,0.05)":"none",cursor:"pointer" }}><div style={{ color:i<3?"#C9A84C":"#444",fontFamily:"'Space Mono',monospace",fontSize:13,width:18 }}>{i+1}</div><Avatar name={p.name} size={36}/><div style={{ flex:1 }}><div style={{ color:"#fff",display:"flex",alignItems:"center",gap:5 }}>{p.name} {isComm&&<span style={{ fontSize:12 }}>👑</span>} {p.streak>1&&<span>🔥</span>}</div><div style={{ color:"#555",fontSize:10,fontFamily:"'Space Mono',monospace" }}>{p.session_count} sessions · {p.wins}W</div></div><div style={{ textAlign:"right" }}><div style={{ color:p.total_profit>=0?"#4CAF8C":"#E05555",fontFamily:"'Space Mono',monospace",fontWeight:700,fontSize:13 }}>{p.total_profit>=0?"+":""}${p.total_profit}</div>{p.session_count>0&&<div style={{ color:"#444",fontSize:10 }}>{((p.wins/p.session_count)*100).toFixed(0)}% win</div>}</div></div>;})}</Card>
    </div>
  );
}

// ─── PROFILE ───────────────────────────────────────────
function ProfileView({ player, profile, onBack, onSendFriendRequest, canAddFriend }:any) {
  if(!player)return null;
  const isUp=player.total_profit>=0;const isSelf=player.name.toLowerCase()===profile.display_name.toLowerCase();
  const winRate=player.session_count>0?((player.wins/player.session_count)*100).toFixed(0):0;
  const badges:any[]=([player.session_count>=10&&{icon:"🃏",label:"10 Sessions"},player.wins>=3&&{icon:"🏆",label:"3x Winner"},player.total_profit>200&&{icon:"💰",label:"High Roller"},player.streak>1&&{icon:"🔥",label:`${player.streak} Streak`}]).filter(Boolean) as any[];
  return (
    <div style={{ padding:"20px 16px",maxWidth:500,margin:"0 auto" }}>
      <button onClick={onBack} style={{ background:"none",border:"none",color:"#555",fontSize:22,cursor:"pointer",marginBottom:16 }}>←</button>
      <div style={{ textAlign:"center",marginBottom:22 }}>
        <Avatar name={player.name} size={74}/>
        <div style={{ fontFamily:"'Playfair Display',serif",fontSize:26,color:"#fff",marginTop:10 }}>{player.name}</div>
        <div style={{ color:isUp?"#4CAF8C":"#E05555",fontSize:30,fontFamily:"'Space Mono',monospace",fontWeight:700,marginTop:4 }}>{isUp?"+":""}${player.total_profit}</div>
        <div style={{ color:"#555",fontSize:11,fontFamily:"'Space Mono',monospace" }}>in this league</div>
        {!isSelf&&canAddFriend&&<button onClick={()=>onSendFriendRequest(player.name)} style={{ marginTop:12,padding:"8px 22px",background:"rgba(201,168,76,0.1)",border:"1px solid rgba(201,168,76,0.3)",borderRadius:20,color:"#C9A84C",fontFamily:"'Space Mono',monospace",fontSize:11,cursor:"pointer",letterSpacing:1 }}>+ ADD FRIEND</button>}
        {!isSelf&&!canAddFriend&&<div style={{ marginTop:10,color:"#444",fontSize:11,fontFamily:"'Space Mono',monospace" }}>Join the same league to add as friend</div>}
      </div>
      <div style={{ display:"flex",gap:8,marginBottom:16 }}><StatBox label="Sessions" value={player.session_count}/><StatBox label="Wins" value={player.wins} accent="#4CAF8C"/><StatBox label="Win %" value={`${winRate}%`} accent="#5577CC"/><StatBox label="Best" value={`$${player.best_night}`}/></div>
      {badges.length>0&&<Card style={{ marginBottom:12 }}><div style={{ color:"#888",fontSize:11,fontFamily:"'Space Mono',monospace",letterSpacing:2,marginBottom:10 }}>BADGES</div><div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>{badges.map((b:any,i:number)=><div key={i} style={{ background:"rgba(201,168,76,0.1)",border:"1px solid rgba(201,168,76,0.25)",borderRadius:10,padding:"6px 12px",display:"flex",alignItems:"center",gap:6 }}><span style={{ fontSize:15 }}>{b.icon}</span><span style={{ color:"#C9A84C",fontSize:11,fontFamily:"'Space Mono',monospace" }}>{b.label}</span></div>)}</div></Card>}
      <Card>{([["Avg / session",`${isUp?"+":""}$${player.session_count>0?(player.total_profit/player.session_count).toFixed(0):0}`,isUp?"#4CAF8C":"#E05555"],["Biggest win",`$${player.best_night}`,"#C9A84C"],["Win streak",`${player.streak}${player.streak>1?" 🔥":""}`, "#fff"]] as any[]).map(([label,val,col]:any,i:number,arr:any[])=><div key={label} style={{ display:"flex",justifyContent:"space-between",padding:"9px 0",borderBottom:i<arr.length-1?"1px solid rgba(255,255,255,0.05)":"none" }}><span style={{ color:"#555",fontFamily:"'Space Mono',monospace",fontSize:12 }}>{label}</span><span style={{ color:col,fontFamily:"'Space Mono',monospace" }}>{val}</span></div>)}</Card>
    </div>
  );
}

// ─── MY ACCOUNT ────────────────────────────────────────
function MyAccountView({ profile, myLeagues, onBack }:any) {
  const [allStats,setAllStats]=useState<any>(null);const [loading,setLoading]=useState(true);
  useEffect(()=>{loadStats();},[]);
  const loadStats=async()=>{
    if(!db)return;setLoading(true);
    const{data:rows}=await db.from("players").select("*").ilike("name",profile.display_name);
    if(!rows||rows.length===0){setAllStats({total_profit:0,sessions:0,wins:0,best_night:0,leagues:0});setLoading(false);return;}
    setAllStats({total_profit:rows.reduce((a:number,p:any)=>a+(p.total_profit||0),0),sessions:rows.reduce((a:number,p:any)=>a+(p.session_count||0),0),wins:rows.reduce((a:number,p:any)=>a+(p.wins||0),0),best_night:Math.max(...rows.map((p:any)=>p.best_night||0)),leagues:rows.length});
    setLoading(false);
  };
  const isUp=allStats?.total_profit>=0;
  return (
    <div style={{ padding:"20px 16px",maxWidth:500,margin:"0 auto" }}>
      <BackHeader onBack={onBack} sub="ALL-TIME" title="My Account"/>
      <div style={{ textAlign:"center",marginBottom:24 }}><Avatar name={profile.display_name} url={profile.avatar_url} size={78}/><div style={{ fontFamily:"'Playfair Display',serif",fontSize:24,color:"#fff",marginTop:10 }}>{profile.display_name}</div><div style={{ color:"#555",fontSize:11,fontFamily:"'Space Mono',monospace",marginTop:4 }}>{profile.email}</div>{!loading&&allStats&&<><div style={{ color:isUp?"#4CAF8C":"#E05555",fontSize:36,fontFamily:"'Space Mono',monospace",fontWeight:700,marginTop:14 }}>{isUp?"+":""}${allStats.total_profit}</div><div style={{ color:"#555",fontSize:11,fontFamily:"'Space Mono',monospace" }}>all-time profit · {allStats.leagues} leagues</div></>}{loading&&<div style={{ display:"flex",justifyContent:"center",marginTop:20 }}><Spinner/></div>}</div>
      {!loading&&allStats&&<><div style={{ display:"flex",gap:8,marginBottom:16 }}><StatBox label="Sessions" value={allStats.sessions}/><StatBox label="Wins" value={allStats.wins} accent="#4CAF8C"/><StatBox label="Win %" value={allStats.sessions>0?`${((allStats.wins/allStats.sessions)*100).toFixed(0)}%`:"—"} accent="#5577CC"/><StatBox label="Best" value={`$${allStats.best_night}`}/></div><Card><div style={{ color:"#888",fontSize:11,fontFamily:"'Space Mono',monospace",letterSpacing:2,marginBottom:12 }}>MY LEAGUES</div>{myLeagues.length===0&&<div style={{ color:"#555",fontSize:12,fontFamily:"'Space Mono',monospace" }}>No leagues yet.</div>}{myLeagues.map((lg:any,i:number)=><div key={lg.id} style={{ display:"flex",alignItems:"center",gap:10,padding:"9px 0",borderBottom:i<myLeagues.length-1?"1px solid rgba(255,255,255,0.05)":"none" }}><div style={{ width:32,height:32,borderRadius:8,background:"rgba(201,168,76,0.1)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:15 }}>{lg.is_public?"🌍":"♠"}</div><div style={{ flex:1 }}><div style={{ color:"#fff",fontSize:13 }}>{lg.name}</div><div style={{ color:"#555",fontSize:11,fontFamily:"'Space Mono',monospace" }}>{lg.season}</div></div>{lg.commissioner_id===lg._myUserId&&<span style={{ fontSize:14 }}>👑</span>}</div>)}</Card></>}
    </div>
  );
}

// ─── FRIENDS (league-scoped) ────────────────────────────
function FriendsView({ profile, onBack, onViewFriendStats }:any) {
  const [friends,setFriends]=useState<any[]>([]);const [pending,setPending]=useState<any[]>([]);const [loading,setLoading]=useState(true);
  useEffect(()=>{loadFriends();},[]);
  const loadFriends=async()=>{
    if(!db)return;setLoading(true);const name=profile.display_name;
    const{data}=await db.from("friends").select("*").or(`requester_name.ilike.${name},recipient_name.ilike.${name}`);
    const all=data||[];setFriends(all.filter((f:any)=>f.status==="accepted"));setPending(all.filter((f:any)=>f.status==="pending"&&f.recipient_name.toLowerCase()===name.toLowerCase()));setLoading(false);
  };
  const accept=async(id:string)=>{if(!db)return;await db.from("friends").update({status:"accepted"}).eq("id",id);await loadFriends();};
  const decline=async(id:string)=>{if(!db)return;await db.from("friends").delete().eq("id",id);await loadFriends();};
  const getFriendName=(f:any)=>f.requester_name.toLowerCase()===profile.display_name.toLowerCase()?f.recipient_name:f.requester_name;
  return (
    <div style={{ padding:"20px 16px",maxWidth:500,margin:"0 auto" }}>
      <BackHeader onBack={onBack} title="Friends"/>
      <div style={{ color:"#555",fontSize:11,fontFamily:"'Space Mono',monospace",marginBottom:14 }}>Add friends from league standings. Mutual friends appear in your feed.</div>
      {loading&&<div style={{ display:"flex",justifyContent:"center",padding:40 }}><Spinner/></div>}
      {!loading&&pending.length>0&&<div style={{ marginBottom:20 }}><div style={{ color:"#888",fontSize:11,fontFamily:"'Space Mono',monospace",letterSpacing:2,marginBottom:10 }}>PENDING ({pending.length})</div>{pending.map((f:any)=><Card key={f.id} style={{ marginBottom:10,display:"flex",alignItems:"center",gap:12 }}><Avatar name={f.requester_name} size={40}/><div style={{ flex:1 }}><div style={{ color:"#fff" }}>{f.requester_name}</div><div style={{ color:"#555",fontSize:11,fontFamily:"'Space Mono',monospace" }}>wants to be friends</div></div><div style={{ display:"flex",gap:8 }}><button onClick={()=>accept(f.id)} style={{ padding:"5px 12px",background:"rgba(76,175,140,0.2)",border:"1px solid rgba(76,175,140,0.4)",borderRadius:20,color:"#4CAF8C",fontFamily:"'Space Mono',monospace",fontSize:11,cursor:"pointer" }}>Accept</button><button onClick={()=>decline(f.id)} style={{ padding:"5px 12px",background:"rgba(224,85,85,0.1)",border:"1px solid rgba(224,85,85,0.3)",borderRadius:20,color:"#E05555",fontFamily:"'Space Mono',monospace",fontSize:11,cursor:"pointer" }}>Decline</button></div></Card>)}</div>}
      <div><div style={{ color:"#888",fontSize:11,fontFamily:"'Space Mono',monospace",letterSpacing:2,marginBottom:10 }}>FRIENDS ({friends.length})</div>{!loading&&friends.length===0&&<Card><div style={{ textAlign:"center",padding:"22px 0",color:"#555",fontFamily:"'Space Mono',monospace",fontSize:12 }}>No friends yet — tap a player in standings to add them!</div></Card>}{friends.map((f:any)=>{const name=getFriendName(f);return <Card key={f.id} style={{ marginBottom:10,display:"flex",alignItems:"center",gap:12,cursor:"pointer" }} onClick={()=>onViewFriendStats(name)}><Avatar name={name} size={42}/><div style={{ flex:1 }}><div style={{ color:"#fff" }}>{name}</div><div style={{ color:"#4CAF8C",fontSize:11,fontFamily:"'Space Mono',monospace" }}>● Friends · tap to see stats</div></div><span style={{ color:"#555",fontSize:18 }}>›</span></Card>;})}</div>
    </div>
  );
}

// ─── FRIEND STATS ──────────────────────────────────────
function FriendStatsView({ friendName, onBack }:any) {
  const [stats,setStats]=useState<any>(null);const [loading,setLoading]=useState(true);
  useEffect(()=>{if(!db)return;(async()=>{setLoading(true);const{data:rows}=await db.from("players").select("*").ilike("name",friendName);if(!rows||rows.length===0){setStats(null);setLoading(false);return;}setStats({total_profit:rows.reduce((a:number,p:any)=>a+(p.total_profit||0),0),sessions:rows.reduce((a:number,p:any)=>a+(p.session_count||0),0),wins:rows.reduce((a:number,p:any)=>a+(p.wins||0),0),best_night:Math.max(...rows.map((p:any)=>p.best_night||0)),leagues:rows.length});setLoading(false);})();},[friendName]);
  const isUp=stats?.total_profit>=0;
  return (
    <div style={{ padding:"20px 16px",maxWidth:500,margin:"0 auto" }}>
      <BackHeader onBack={onBack} sub="FRIEND STATS" title={friendName}/>
      {loading&&<div style={{ display:"flex",justifyContent:"center",padding:40 }}><Spinner/></div>}
      {!loading&&!stats&&<Card><div style={{ textAlign:"center",padding:"24px 0",color:"#555",fontFamily:"'Space Mono',monospace",fontSize:12 }}>No stats found.</div></Card>}
      {!loading&&stats&&<><div style={{ textAlign:"center",marginBottom:22 }}><Avatar name={friendName} size={70}/><div style={{ fontFamily:"'Playfair Display',serif",fontSize:24,color:"#fff",marginTop:10 }}>{friendName}</div><div style={{ color:isUp?"#4CAF8C":"#E05555",fontSize:34,fontFamily:"'Space Mono',monospace",fontWeight:700,marginTop:8 }}>{isUp?"+":""}${stats.total_profit}</div><div style={{ color:"#555",fontSize:11,fontFamily:"'Space Mono',monospace" }}>all-time · {stats.leagues} leagues</div></div><div style={{ display:"flex",gap:8,marginBottom:14 }}><StatBox label="Sessions" value={stats.sessions}/><StatBox label="Wins" value={stats.wins} accent="#4CAF8C"/><StatBox label="Win %" value={stats.sessions>0?`${((stats.wins/stats.sessions)*100).toFixed(0)}%`:"—"} accent="#5577CC"/><StatBox label="Best" value={`$${stats.best_night}`}/></div><Card>{([["Avg / session",`${isUp?"+":""}$${stats.sessions>0?(stats.total_profit/stats.sessions).toFixed(0):0}`,isUp?"#4CAF8C":"#E05555"],["Best single night",`$${stats.best_night}`,"#C9A84C"],["Total leagues",`${stats.leagues}`,"#fff"]] as any[]).map(([label,val,col]:any,i:number,arr:any[])=><div key={label} style={{ display:"flex",justifyContent:"space-between",padding:"9px 0",borderBottom:i<arr.length-1?"1px solid rgba(255,255,255,0.05)":"none" }}><span style={{ color:"#555",fontFamily:"'Space Mono',monospace",fontSize:12 }}>{label}</span><span style={{ color:col,fontFamily:"'Space Mono',monospace" }}>{val}</span></div>)}</Card></>}
    </div>
  );
}

// ─── COMMISSIONER SETTINGS ─────────────────────────────
function CommSettingsView({ league, players, onBack, onLeagueUpdated, onLeagueDeleted, showToast, showError }:any) {
  const [buyIn,setBuyIn]=useState(String(league.buy_in));const [season,setSeason]=useState(league.season);const [seasonLength,setSeasonLength]=useState(String(league.season_length||0));const [description,setDescription]=useState(league.description||"");const [isPublic,setIsPublic]=useState(league.is_public||false);const [locationName,setLocationName]=useState(league.location_name||"");const [saving,setSaving]=useState(false);const [confirmDelete,setConfirmDelete]=useState(false);
  const handleSave=async()=>{if(!db)return;setSaving(true);const{data,error}=await db.from("leagues").update({buy_in:Number(buyIn),season,season_length:Number(seasonLength),description,is_public:isPublic,location_name:locationName||null}).eq("id",league.id).select().single();if(error)showError(error.message);else{showToast("Settings saved!");onLeagueUpdated(data);}setSaving(false);};
  const handleKick=async(playerId:string,playerName:string)=>{if(!db)return;if(!window.confirm(`Kick ${playerName}?`))return;await db.from("players").delete().eq("id",playerId);showToast(`${playerName} removed.`);onLeagueUpdated(league);};
  const handleDelete=async()=>{if(!db)return;await db.from("leagues").delete().eq("id",league.id);showToast("League deleted.");onLeagueDeleted();};
  return (
    <div style={{ padding:"20px 16px",maxWidth:500,margin:"0 auto" }}>
      <BackHeader onBack={onBack} sub="COMMISSIONER PANEL" title={`Manage ${league.name}`}/>
      <Card style={{ marginBottom:12 }}>
        <div style={{ color:"#888",fontSize:11,fontFamily:"'Space Mono',monospace",letterSpacing:2,marginBottom:12 }}>LEAGUE SETTINGS</div>
        {([["DESCRIPTION","text",description,setDescription,"League description"],["SEASON NAME","text",season,setSeason,"Season 1"],["LOCATION","text",locationName,setLocationName,"e.g. San Francisco, CA"]] as any[]).map(([label,type,val,setter,ph])=><div key={label} style={{ marginBottom:10 }}><label style={{ color:"#888",fontSize:11,fontFamily:"'Space Mono',monospace",letterSpacing:1.5,display:"block",marginBottom:6 }}>{label}</label><input type={type} value={val} onChange={e=>setter(e.target.value)} placeholder={ph} style={inp}/></div>)}
        <div style={{ display:"flex",gap:10,marginBottom:12 }}><div style={{ flex:1 }}><label style={{ color:"#888",fontSize:11,fontFamily:"'Space Mono',monospace",letterSpacing:1.5,display:"block",marginBottom:6 }}>DEFAULT BUY-IN ($)</label><input type="number" value={buyIn} onChange={e=>setBuyIn(e.target.value)} style={inp}/></div><div style={{ flex:1 }}><label style={{ color:"#888",fontSize:11,fontFamily:"'Space Mono',monospace",letterSpacing:1.5,display:"block",marginBottom:6 }}>SEASON LENGTH</label><input type="number" value={seasonLength} onChange={e=>setSeasonLength(e.target.value)} style={inp}/></div></div>
        <Toggle value={isPublic} onChange={setIsPublic} label="Public League 🌍" sub="Anyone can find & join without a code"/>
        <button onClick={handleSave} disabled={saving} style={{ width:"100%",padding:"12px 0",background:"linear-gradient(135deg,#C9A84C,#E8C56A)",border:"none",borderRadius:10,color:"#0A0A0A",fontFamily:"'Space Mono',monospace",fontWeight:700,fontSize:13,letterSpacing:2,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:10 }}>{saving?<Spinner size={16}/>:"SAVE SETTINGS ✓"}</button>
      </Card>
      <Card style={{ marginBottom:12 }}>
        <div style={{ color:"#888",fontSize:11,fontFamily:"'Space Mono',monospace",letterSpacing:2,marginBottom:12 }}>PLAYERS ({players.length})</div>
        {players.map((p:any,i:number)=>{const isComm=p.name.toLowerCase()===league.commissioner_name?.toLowerCase();return <div key={p.id} style={{ display:"flex",alignItems:"center",gap:10,padding:"9px 0",borderBottom:i<players.length-1?"1px solid rgba(255,255,255,0.05)":"none" }}><Avatar name={p.name} size={34}/><div style={{ flex:1 }}><div style={{ color:"#fff",display:"flex",alignItems:"center",gap:5 }}>{p.name} {isComm&&<span>👑</span>}</div><div style={{ color:"#555",fontSize:10,fontFamily:"'Space Mono',monospace" }}>{p.session_count} sessions · {p.total_profit>=0?"+":""}${p.total_profit}</div></div>{!isComm&&<button onClick={()=>handleKick(p.id,p.name)} style={{ padding:"4px 10px",background:"rgba(224,85,85,0.1)",border:"1px solid rgba(224,85,85,0.25)",borderRadius:20,color:"#E05555",fontFamily:"'Space Mono',monospace",fontSize:10,cursor:"pointer" }}>KICK</button>}</div>;})}
      </Card>
      <Card><div style={{ color:"#E05555",fontSize:11,fontFamily:"'Space Mono',monospace",letterSpacing:2,marginBottom:10 }}>DANGER ZONE</div>{!confirmDelete?<button onClick={()=>setConfirmDelete(true)} style={{ width:"100%",padding:"12px 0",background:"rgba(224,85,85,0.06)",border:"1px solid rgba(224,85,85,0.2)",borderRadius:10,color:"#E05555",fontFamily:"'Space Mono',monospace",fontSize:12,letterSpacing:1.5,cursor:"pointer" }}>DELETE THIS LEAGUE</button>:<div><div style={{ color:"#E05555",fontSize:13,marginBottom:12,textAlign:"center",lineHeight:1.6 }}>Permanently delete all sessions, standings, and posts? This cannot be undone.</div><div style={{ display:"flex",gap:10 }}><button onClick={()=>setConfirmDelete(false)} style={{ flex:1,padding:"11px 0",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,color:"#888",fontFamily:"'Space Mono',monospace",fontSize:12,cursor:"pointer" }}>CANCEL</button><button onClick={handleDelete} style={{ flex:1,padding:"11px 0",background:"rgba(224,85,85,0.2)",border:"1px solid rgba(224,85,85,0.4)",borderRadius:10,color:"#E05555",fontFamily:"'Space Mono',monospace",fontWeight:700,fontSize:12,cursor:"pointer" }}>DELETE</button></div></div>}</Card>
    </div>
  );
}

// ─── SETTINGS ──────────────────────────────────────────
function SettingsView({ profile, onBack, onLogout, onProfileUpdated }:any) {
  const [newName,setNewName]=useState(profile.display_name);const [saving,setSaving]=useState(false);const [uploadingAvatar,setUploadingAvatar]=useState(false);const [optIn,setOptIn]=useState(profile.opt_in_global||false);const [msg,setMsg]=useState("");
  const fileRef=useRef<HTMLInputElement>(null);
  const handleSaveName=async()=>{if(!db||!newName.trim()||newName.trim()===profile.display_name)return;setSaving(true);const{error}=await db.from("profiles").update({display_name:newName.trim()}).eq("id",profile.id);if(!error){setMsg("Name updated!");onProfileUpdated({...profile,display_name:newName.trim()});setTimeout(()=>setMsg(""),3000);}setSaving(false);};
  const handleOptIn=async(val:boolean)=>{if(!db)return;setOptIn(val);await db.from("profiles").update({opt_in_global:val}).eq("id",profile.id);onProfileUpdated({...profile,opt_in_global:val});setMsg(val?"You're now on the global leaderboard!":"Removed from global leaderboard.");setTimeout(()=>setMsg(""),3000);};
  const handleAvatar=async(e:any)=>{const f=e.target.files?.[0];if(!f||!db)return;setUploadingAvatar(true);try{const ext=f.name.split('.').pop();const path=`${profile.id}/avatar.${ext}`;await db.storage.from("avatars").upload(path,f,{upsert:true});const{data:urlData}=db.storage.from("avatars").getPublicUrl(path);const avatarUrl=urlData.publicUrl+"?t="+Date.now();await db.from("profiles").update({avatar_url:avatarUrl}).eq("id",profile.id);onProfileUpdated({...profile,avatar_url:avatarUrl});setMsg("Photo updated!");setTimeout(()=>setMsg(""),3000);}finally{setUploadingAvatar(false);}};
  return (
    <div style={{ padding:"20px 16px",maxWidth:500,margin:"0 auto" }}>
      <BackHeader onBack={onBack} title="Settings"/>
      <div style={{ textAlign:"center",marginBottom:22 }}>
        <div style={{ position:"relative",display:"inline-block" }}>
          <Avatar name={profile.display_name} url={profile.avatar_url} size={78}/>
          <button onClick={()=>fileRef.current?.click()} style={{ position:"absolute",bottom:0,right:0,width:28,height:28,borderRadius:"50%",background:"#C9A84C",border:"2px solid #0A0A0A",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:14 }}>{uploadingAvatar?<Spinner size={12}/>:"📷"}</button>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatar} style={{ display:"none" }}/>
        </div>
        <div style={{ color:"#555",fontSize:11,fontFamily:"'Space Mono',monospace",marginTop:8 }}>Tap camera to update photo</div>
      </div>
      <Card style={{ marginBottom:12 }}>
        <div style={{ color:"#888",fontSize:11,fontFamily:"'Space Mono',monospace",letterSpacing:2,marginBottom:10 }}>DISPLAY NAME</div>
        <input value={newName} onChange={e=>setNewName(e.target.value)} style={inp}/>
        {msg&&<div style={{ color:"#4CAF8C",fontSize:11,fontFamily:"'Space Mono',monospace",marginTop:8 }}>✓ {msg}</div>}
        <button onClick={handleSaveName} disabled={saving||!newName.trim()||newName.trim()===profile.display_name} style={{ width:"100%",marginTop:12,padding:"11px 0",background:newName.trim()&&newName.trim()!==profile.display_name?"rgba(201,168,76,0.15)":"rgba(255,255,255,0.04)",border:`1px solid ${newName.trim()&&newName.trim()!==profile.display_name?"rgba(201,168,76,0.3)":"rgba(255,255,255,0.08)"}`,borderRadius:10,color:newName.trim()&&newName.trim()!==profile.display_name?"#C9A84C":"#444",fontFamily:"'Space Mono',monospace",fontSize:12,cursor:"pointer",letterSpacing:1.5 }}>{saving?"SAVING...":"SAVE NAME"}</button>
      </Card>
      <Card style={{ marginBottom:12 }}>
        <div style={{ color:"#888",fontSize:11,fontFamily:"'Space Mono',monospace",letterSpacing:2,marginBottom:10 }}>GLOBAL LEADERBOARD</div>
        <Toggle value={optIn} onChange={handleOptIn} label="Show me on Global Leaderboard 🏆" sub="Requires 50+ sessions. Stats visible to everyone."/>
        <div style={{ color:"#555",fontSize:11,lineHeight:1.6 }}>When opted in, your all-time profit, sessions, and win rate appear on the worldwide leaderboard.</div>
      </Card>
      <Card style={{ marginBottom:12 }}>
        <div style={{ color:"#888",fontSize:11,fontFamily:"'Space Mono',monospace",letterSpacing:2,marginBottom:6 }}>ACCOUNT</div>
        <div style={{ color:"#555",fontSize:12,fontFamily:"'Space Mono',monospace",marginBottom:8 }}>{profile.email}</div>
        <div style={{ color:"#444",fontSize:11,lineHeight:1.6 }}>To change your password, sign out and use "Forgot password?" on the login screen.</div>
      </Card>
      <button onClick={onLogout} style={{ width:"100%",padding:"14px 0",background:"rgba(224,85,85,0.08)",border:"1px solid rgba(224,85,85,0.25)",borderRadius:12,color:"#E05555",fontFamily:"'Space Mono',monospace",fontWeight:700,fontSize:13,letterSpacing:2,cursor:"pointer" }}>SIGN OUT</button>
    </div>
  );
}

// ─── NAV BAR ───────────────────────────────────────────
function NavBar({ view, onNav, onHandRankings }:any) {
  const inLeague=[VIEWS.league,VIEWS.feed,VIEWS.standings,VIEWS.profile,VIEWS.newSession,VIEWS.commSettings,VIEWS.liveSession].includes(view);
  if(!inLeague)return null;
  return (
    <div style={{ position:"fixed",bottom:0,left:0,right:0,background:"rgba(10,10,10,0.97)",borderTop:"1px solid rgba(201,168,76,0.15)",display:"flex",justifyContent:"space-around",padding:"10px 0 20px",zIndex:100 }}>
      {([{key:VIEWS.league,icon:"⬡",label:"League"},{key:VIEWS.feed,icon:"◈",label:"Feed"},{key:VIEWS.standings,icon:"▲",label:"Standings"},{key:"hands",icon:"🃏",label:"Hands"}] as any[]).map(t=>(
        <button key={t.key} onClick={()=>t.key==="hands"?onHandRankings():onNav(t.key)} style={{ background:"none",border:"none",display:"flex",flexDirection:"column",alignItems:"center",gap:3,cursor:"pointer",color:view===t.key?"#C9A84C":"#444" }}>
          <span style={{ fontSize:18 }}>{t.icon}</span>
          <span style={{ fontFamily:"'Space Mono',monospace",fontSize:10,letterSpacing:1 }}>{t.label}</span>
        </button>
      ))}
    </div>
  );
}

// ─── MAIN APP ──────────────────────────────────────────
export default function HomeGameApp() {
  const [view,setView]=useState(db?VIEWS.auth:VIEWS.setup);
  const [authUser,setAuthUser]=useState<any>(null);const [profile,setProfile]=useState<any>(null);
  const [myLeagues,setMyLeagues]=useState<any[]>([]);const [league,setLeague]=useState<any>(null);
  const [players,setPlayers]=useState<any[]>([]);const [sessions,setSessions]=useState<any[]>([]);
  const [liveSession,setLiveSession]=useState<any>(null);const [liveEntries,setLiveEntries]=useState<any[]>([]);
  const [loading,setLoading]=useState(false);const [selectedPlayer,setSelectedPlayer]=useState<any>(null);
  const [viewingFriend,setViewingFriend]=useState<string>("");const [prevView,setPrevView]=useState<string>("");
  const [toast,setToast]=useState("");const [error,setError]=useState("");const [bootstrapping,setBootstrapping]=useState(true);

  const showToast=(msg:string)=>{setToast(msg);setTimeout(()=>setToast(""),3000);};
  const showError=(msg:string)=>{setError(msg);setTimeout(()=>setError(""),4000);};

  useEffect(()=>{
    if(!db){setBootstrapping(false);return;}
    db.auth.getSession().then(async({data:{session}})=>{if(session?.user){setAuthUser(session.user);await loadProfile(session.user);}else setView(VIEWS.auth);setBootstrapping(false);});
    const{data:{subscription}}=db.auth.onAuthStateChange(async(_event,session)=>{if(session?.user){setAuthUser(session.user);await loadProfile(session.user);}else{setAuthUser(null);setProfile(null);setView(VIEWS.auth);}});
    return()=>subscription.unsubscribe();
  },[]);

  const loadProfile=async(user:any)=>{
    if(!db)return;const{data}=await db.from("profiles").select("*").eq("id",user.id).single();
    if(data){setProfile({...data,email:user.email});await loadMyLeagues(data.display_name,user.id);setView(VIEWS.myLeagues);}
    else setView(VIEWS.setupProfile);
  };

  const loadMyLeagues=async(displayName:string,userId:string)=>{
    if(!db)return;setLoading(true);
    try{const{data:rows}=await db.from("players").select("league_id").ilike("name",displayName);const dbIds=(rows||[]).map((r:any)=>r.league_id);const stored=JSON.parse(localStorage.getItem(`hg_leagues_${userId}`)||'[]');const allIds=[...new Set([...dbIds,...stored])];if(allIds.length>0){const{data:leagues}=await db.from("leagues").select("*").in("id",allIds);setMyLeagues((leagues||[]).map((lg:any)=>({...lg,_myUserId:userId})));}else setMyLeagues([]);}
    finally{setLoading(false);}
  };

  const loadLeagueData=async(lgId:string)=>{
    if(!db)return;
    const[{data:pData},{data:sData},{data:lsData}]=await Promise.all([db.from("players").select("*").eq("league_id",lgId).order("total_profit",{ascending:false}),db.from("sessions").select("*").eq("league_id",lgId).order("created_at",{ascending:false}),db.from("sessions").select("*").eq("league_id",lgId).eq("is_live",true).limit(1)]);
    setPlayers(pData||[]);setSessions(sData||[]);
    if(lsData&&lsData.length>0){setLiveSession(lsData[0]);await loadLiveEntries(lsData[0].id);}
    else{setLiveSession(null);setLiveEntries([]);}
  };

  const loadLiveEntries=async(sessionId:string)=>{
    if(!db)return;const{data}=await db.from("live_entries").select("*").eq("session_id",sessionId);setLiveEntries(data||[]);
  };

  // Poll live session every 10s when in league or live view
  useEffect(()=>{
    if(!league||![VIEWS.league,VIEWS.liveSession].includes(view))return;
    const interval=setInterval(async()=>{if(liveSession)await loadLiveEntries(liveSession.id);},10000);
    return()=>clearInterval(interval);
  },[league,view,liveSession]);

  const handleSelectLeague=async(lg:any)=>{setLeague(lg);await loadLeagueData(lg.id);setView(VIEWS.league);};

  const handleJoinCreate=async({tab,code,leagueName,description,buyIn,season,seasonLength,isPublic,locationName}:any)=>{
    if(!db||!authUser||!profile)return;setLoading(true);
    try{
      if(tab==="join"){const{data:leagues}=await db.from("leagues").select("*").eq("code",code.trim()).limit(1);if(!leagues||leagues.length===0){showError("League not found. Check your invite code.");return;}const lg=leagues[0];const{data:existing}=await db.from("players").select("*").eq("league_id",lg.id).ilike("name",profile.display_name).limit(1);if(!existing||existing.length===0)await db.from("players").insert({league_id:lg.id,name:profile.display_name,total_profit:0,session_count:0,wins:0,best_night:0,streak:0});const stored=JSON.parse(localStorage.getItem(`hg_leagues_${authUser.id}`)||'[]');if(!stored.includes(lg.id)){stored.push(lg.id);localStorage.setItem(`hg_leagues_${authUser.id}`,JSON.stringify(stored));}await loadMyLeagues(profile.display_name,authUser.id);setLeague({...lg,_myUserId:authUser.id});await loadLeagueData(lg.id);setView(VIEWS.league);}
      else{const genCode=profile.display_name.toUpperCase().replace(/\s/g,"").slice(0,3)+Math.floor(1000+Math.random()*9000);const{data:lg,error:lgErr}=await db.from("leagues").insert({name:leagueName,description:description||null,code:genCode,commissioner_name:profile.display_name,commissioner_id:authUser.id,buy_in:buyIn,season,season_length:seasonLength||0,is_public:isPublic||false,location_name:locationName||null}).select().single();if(lgErr)throw lgErr;await db.from("players").insert({league_id:lg.id,name:profile.display_name,total_profit:0,session_count:0,wins:0,best_night:0,streak:0});const stored=JSON.parse(localStorage.getItem(`hg_leagues_${authUser.id}`)||'[]');stored.push(lg.id);localStorage.setItem(`hg_leagues_${authUser.id}`,JSON.stringify(stored));await loadMyLeagues(profile.display_name,authUser.id);setLeague({...lg,_myUserId:authUser.id});await loadLeagueData(lg.id);setView(VIEWS.league);}
    }catch(e:any){showError(e.message||"Something went wrong.");}finally{setLoading(false);}
  };

  const handleJoinPublic=async(lg:any)=>{
    if(!db||!authUser||!profile)return;setLoading(true);
    try{const{data:existing}=await db.from("players").select("*").eq("league_id",lg.id).ilike("name",profile.display_name).limit(1);if(!existing||existing.length===0)await db.from("players").insert({league_id:lg.id,name:profile.display_name,total_profit:0,session_count:0,wins:0,best_night:0,streak:0});const stored=JSON.parse(localStorage.getItem(`hg_leagues_${authUser.id}`)||'[]');if(!stored.includes(lg.id)){stored.push(lg.id);localStorage.setItem(`hg_leagues_${authUser.id}`,JSON.stringify(stored));}await loadMyLeagues(profile.display_name,authUser.id);setLeague({...lg,_myUserId:authUser.id});await loadLeagueData(lg.id);setView(VIEWS.league);}
    finally{setLoading(false);}
  };

  const handleStartSession=async({selectedIds,sessionBuyIn}:any)=>{
    if(!db||!league)return;
    const{data:session,error}=await db.from("sessions").insert({league_id:league.id,pot:0,status:"live",buy_in_amount:sessionBuyIn,is_live:true,started_at:new Date().toISOString()}).select().single();
    if(error){showError(error.message);return;}
    // Create live entries for selected players
    const selectedPlayers=players.filter((p:any)=>selectedIds.includes(p.id));
    await db.from("live_entries").insert(selectedPlayers.map((p:any)=>({session_id:session.id,player_id:p.id,player_name:p.name,buy_in:sessionBuyIn,rebuys:0})));
    setLiveSession(session);await loadLiveEntries(session.id);showToast("Session started! Players can now see it live.");setView(VIEWS.liveSession);
  };

  const handleSubmitEntry=async({player_id,player_name,buy_in,rebuys}:any)=>{
    if(!db||!liveSession)return;
    await db.from("live_entries").upsert({session_id:liveSession.id,player_id,player_name,buy_in,rebuys,updated_at:new Date().toISOString()},{onConflict:"session_id,player_id"});
    await loadLiveEntries(liveSession.id);showToast("Stats submitted!");
  };

  const handleEndSession=async({entries,elapsed}:any)=>{
    if(!db||!league||!liveSession)return;
    try{
      const pot=entries.reduce((a:number,e:any)=>a+(e.buy_in+e.rebuys),0);
      const top=[...entries].sort((a:any,b:any)=>b.profit-a.profit)[0];
      await db.from("sessions").update({is_live:false,pot,winner_name:players.find((p:any)=>p.id===top.player_id)?.name||top.player_name,duration_seconds:elapsed,status:"approved"}).eq("id",liveSession.id);
      await db.from("session_entries").insert(entries.map((e:any)=>({session_id:liveSession.id,player_id:e.player_id,buy_in:e.buy_in,rebuys:e.rebuys,cash_out:e.cash_out,profit:e.profit})));
      for(const e of entries){const p:any=players.find((pl:any)=>pl.id===e.player_id);if(!p)continue;const won=e.profit>0?1:0;await db.from("players").update({total_profit:(p.total_profit||0)+e.profit,session_count:(p.session_count||0)+1,wins:(p.wins||0)+won,best_night:e.profit>(p.best_night||0)?e.profit:(p.best_night||0),streak:won?(p.streak||0)+1:0}).eq("id",e.player_id);}
      // Update global stats for opted-in players
      for(const e of entries){const p:any=players.find((pl:any)=>pl.id===e.player_id);if(!p)continue;const{data:prof}=await db.from("profiles").select("*").ilike("display_name",p.name).single();if(prof&&prof.opt_in_global){const won=e.profit>0?1:0;await db.from("profiles").update({global_total_profit:(prof.global_total_profit||0)+e.profit,global_sessions:(prof.global_sessions||0)+1,global_wins:(prof.global_wins||0)+won}).eq("id",prof.id);}}
      setLiveSession(null);setLiveEntries([]);await loadLeagueData(league.id);showToast("Session saved! ✓");setView(VIEWS.league);
    }catch(e:any){showError(e.message||"Failed to save session.");}
  };

  const handleSendFriendRequest=async(recipientName:string)=>{
    if(!db||!profile)return;const{error}=await db.from("friends").insert({requester_name:profile.display_name,recipient_name:recipientName,status:"pending"});
    if(error)showError("Already sent or already friends!");else showToast(`Friend request sent to ${recipientName}!`);
  };

  const handleLogout=async()=>{if(!db)return;await db.auth.signOut();setLeague(null);setPlayers([]);setSessions([]);setMyLeagues([]);};
  const isCommissioner=league?(authUser?.id===league.commissioner_id||profile?.display_name?.toLowerCase()===league.commissioner_name?.toLowerCase()):false;
  const inLeagueView=[VIEWS.league,VIEWS.feed,VIEWS.standings,VIEWS.profile,VIEWS.newSession,VIEWS.commSettings,VIEWS.liveSession].includes(view);

  const handleNav=(newView:string,data:any=null)=>{if(newView===VIEWS.profile&&data)setSelectedPlayer(data);setView(newView);};

  if(bootstrapping)return <div style={{ minHeight:"100vh",background:"#0A0A0A",display:"flex",alignItems:"center",justifyContent:"center" }}><div style={{ textAlign:"center" }}><div style={{ fontSize:36,color:"#C9A84C",marginBottom:20 }}>♠</div><Spinner size={32}/></div></div>;

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
      <div style={{ background:"#0A0A0A",minHeight:"100vh",paddingBottom:inLeagueView?80:0 }}>
        {toast&&<div style={{ position:"fixed",top:20,left:"50%",transform:"translateX(-50%)",background:"rgba(76,175,140,0.95)",color:"#fff",padding:"11px 22px",borderRadius:30,fontFamily:"'Space Mono',monospace",fontSize:13,zIndex:999,whiteSpace:"nowrap" }}>{toast}</div>}
        {error&&<div style={{ position:"fixed",top:20,left:"50%",transform:"translateX(-50%)",background:"rgba(224,85,85,0.95)",color:"#fff",padding:"11px 22px",borderRadius:30,fontFamily:"'Space Mono',monospace",fontSize:13,zIndex:999,maxWidth:"90vw",textAlign:"center" }}>{error}</div>}

        {view===VIEWS.setup&&<SetupView/>}
        {view===VIEWS.auth&&<AuthView/>}
        {view===VIEWS.setupProfile&&authUser&&<SetupProfileView user={authUser} onDone={(p:any)=>{setProfile(p);loadMyLeagues(p.display_name,authUser.id);setView(VIEWS.myLeagues);}}/>}
        {view===VIEWS.myLeagues&&profile&&<MyLeaguesView profile={profile} myLeagues={myLeagues} loading={loading} onSelectLeague={handleSelectLeague} onJoinCreate={()=>setView(VIEWS.joinCreate)} onFriends={()=>setView(VIEWS.friends)} onSettings={()=>setView(VIEWS.settings)} onFeed={()=>setView(VIEWS.feed)} onPublicLeagues={()=>setView(VIEWS.publicLeagues)} onMyAccount={()=>setView(VIEWS.myAccount)} onGlobalLeaderboard={()=>setView(VIEWS.globalLeaderboard)}/>}
        {view===VIEWS.joinCreate&&profile&&<JoinCreateView profile={profile} loading={loading} onBack={()=>setView(VIEWS.myLeagues)} onEnter={handleJoinCreate}/>}
        {view===VIEWS.publicLeagues&&profile&&<PublicLeaguesView profile={profile} onBack={()=>setView(VIEWS.myLeagues)} onJoin={handleJoinPublic}/>}
        {view===VIEWS.globalLeaderboard&&profile&&<GlobalLeaderboardView profile={profile} onBack={()=>setView(VIEWS.myLeagues)}/>}
        {view===VIEWS.league&&league&&profile&&<LeagueView league={league} players={players} sessions={sessions} profile={profile} isCommissioner={isCommissioner} onNav={handleNav} onStartSession={()=>setView(VIEWS.newSession)} onBack={()=>setView(VIEWS.myLeagues)} onCommSettings={()=>setView(VIEWS.commSettings)} liveSession={liveSession}/>}
        {view===VIEWS.commSettings&&league&&isCommissioner&&<CommSettingsView league={league} players={players} onBack={()=>setView(VIEWS.league)} onLeagueUpdated={(lg:any)=>{setLeague({...lg,_myUserId:authUser?.id});loadLeagueData(lg.id);}} onLeagueDeleted={()=>{setLeague(null);loadMyLeagues(profile.display_name,authUser.id);setView(VIEWS.myLeagues);}} showToast={showToast} showError={showError}/>}
        {view===VIEWS.newSession&&league&&isCommissioner&&<NewSessionView league={league} players={players} onStart={handleStartSession} onBack={()=>setView(VIEWS.league)}/>}
        {view===VIEWS.liveSession&&league&&liveSession&&<LiveSessionView session={liveSession} liveEntries={liveEntries} players={players} profile={profile} isCommissioner={isCommissioner} league={league} onBack={()=>setView(VIEWS.league)} onSubmitEntry={handleSubmitEntry} onEndSession={handleEndSession}/>}
        {view===VIEWS.feed&&profile&&<FeedView profile={profile} myLeagues={myLeagues} currentLeague={league} onBack={()=>league?setView(VIEWS.league):setView(VIEWS.myLeagues)}/>}
        {view===VIEWS.standings&&league&&<StandingsView players={players} league={league} onNav={handleNav} onBack={()=>setView(VIEWS.league)}/>}
        {view===VIEWS.profile&&profile&&<ProfileView player={selectedPlayer} profile={profile} onBack={()=>setView(VIEWS.standings)} onSendFriendRequest={handleSendFriendRequest} canAddFriend={true}/>}
        {view===VIEWS.myAccount&&profile&&<MyAccountView profile={profile} myLeagues={myLeagues} onBack={()=>setView(VIEWS.myLeagues)}/>}
        {view===VIEWS.friends&&profile&&<FriendsView profile={profile} onBack={()=>setView(VIEWS.myLeagues)} onViewFriendStats={(name:string)=>{setViewingFriend(name);setView(VIEWS.friendStats);}}/>}
        {view===VIEWS.friendStats&&<FriendStatsView friendName={viewingFriend} onBack={()=>setView(VIEWS.friends)}/>}
        {view===VIEWS.handRankings&&<HandRankingsView onBack={()=>setView(prevView||VIEWS.league)}/>}
        {view===VIEWS.settings&&profile&&<SettingsView profile={profile} onBack={()=>setView(VIEWS.myLeagues)} onLogout={handleLogout} onProfileUpdated={(p:any)=>setProfile(p)}/>}

        <NavBar view={view} onNav={handleNav} onHandRankings={()=>{setPrevView(view);setView(VIEWS.handRankings);}}/>
      </div>
    </>
  );
}