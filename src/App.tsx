import React, { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';
const db = (SUPABASE_URL !== 'YOUR_SUPABASE_URL') ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

type Tab = 'league' | 'feed' | 'profile';
type LSV = 'home'|'joinCreate'|'publicLeagues'|'worldwideLeaderboard'|'leagueDetail'|'newSession'|'liveSession'|'commSettings'|'transferComm'|'handRankings'|'playerProfile'|'sessionDetail'|'seasonRecap'|'seasonArchive'|'archivedSeason';
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

const realtimeChannels: any[] = [];
function setupRealtime(leagues:any[], displayName:string){
  if(!db)return;
  realtimeChannels.forEach(ch=>db!.removeChannel(ch));
  realtimeChannels.length=0;
  leagues.forEach(lg=>{
    const ch=db!.channel(`live-${lg.id}`)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'sessions',filter:`league_id=eq.${lg.id}`},(payload:any)=>{
        if(payload.new?.is_live) sendNotif('🃏 Game is Live!',`A session just started in ${lg.name}`);
      }).subscribe();
    realtimeChannels.push(ch);
  });
  const fc=db!.channel(`friends-${displayName.toLowerCase()}`)
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'friends',filter:`recipient_name=eq.${displayName}`},(payload:any)=>{
      sendNotif('New Friend Request',`${payload.new?.requester_name} wants to be friends!`);
    }).subscribe();
  realtimeChannels.push(fc);
}

function fmtSeconds(s:number){ if(!s||s<=0)return"—"; const h=Math.floor(s/3600),m=Math.floor((s%3600)/60); if(h>0)return`${h}h ${m}m`; return`${m}m`; }
function fmtProfit(n:number){return`${n>=0?"+$":"-$"}${Math.abs(n)}`;}

// ─── SHARED UI ─────────────────────────────────────────
function Avatar({name,url,size=40,streak=0}:{name:string;url?:string|null;size?:number;streak?:number}){
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
  const onFire=streak>=3;
  const inner=src
    ?<img src={src} style={{width:size,height:size,borderRadius:"50%",objectFit:"cover" as const,flexShrink:0,display:"block"}}/>
    :<div style={{width:size,height:size,borderRadius:"50%",background:bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Playfair Display',serif",fontWeight:700,fontSize:size*0.4,color:"#0D0D0D",flexShrink:0}}>{(name||"?")[0].toUpperCase()}</div>;
  if(!onFire)return<div style={{width:size,height:size,borderRadius:"50%",overflow:"hidden",flexShrink:0,border:"2px solid rgba(201,168,76,0.3)",display:"inline-flex"}}>{inner}</div>;
  return(
    <div style={{position:"relative",display:"inline-flex",flexShrink:0,width:size+6,height:size+6,alignItems:"center",justifyContent:"center"}}>
      <style>{`@keyframes fireRing{0%,100%{opacity:1;box-shadow:0 0 4px 1px rgba(255,107,53,0.6);}50%{opacity:0.7;box-shadow:0 0 8px 2px rgba(255,140,85,0.8),0 0 14px 3px rgba(255,69,0,0.3);}}`}</style>
      <div style={{position:"absolute",inset:0,borderRadius:"50%",border:"2px solid #FF6B35",animation:"fireRing 1.8s ease-in-out infinite",pointerEvents:"none"}}/>
      <div style={{width:size,height:size,borderRadius:"50%",overflow:"hidden",flexShrink:0,border:"1.5px solid rgba(255,107,53,0.4)"}}>{inner}</div>
    </div>
  );
}
function Card({children,style={}}:any){return<div style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(201,168,76,0.2)",borderRadius:16,padding:20,...style}}>{children}</div>;}
function StatBox({label,value,accent="#C9A84C",dim=false}:any){return<div style={{background:dim?"rgba(255,255,255,0.01)":"rgba(255,255,255,0.03)",border:`1px solid ${dim?"rgba(255,255,255,0.04)":"rgba(255,255,255,0.08)"}`,borderRadius:12,padding:"10px 8px",flex:1,minWidth:50,textAlign:"center" as const,transition:"all 0.2s"}}><div style={{color:dim?"#333":"#555",fontSize:9,fontFamily:"'Space Mono',monospace",letterSpacing:1,textTransform:"uppercase",marginBottom:4,minHeight:22,display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1.3}}>{label}</div><div style={{color:dim?"#333":accent,fontSize:15,fontWeight:700,fontFamily:"'Playfair Display',serif",lineHeight:1}}>{dim?"—":value}</div></div>;}
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
  const [tab,setTab]=useState<'login'|'signup'|'reset'|'newpw'>('login');
  const [email,setEmail]=useState("");const [pw,setPw]=useState("");const [newPw,setNewPw]=useState("");const [newPw2,setNewPw2]=useState("");
  const [loading,setLoading]=useState(false);const [msg,setMsg]=useState("");const [err,setErr]=useState("");

  // Detect password recovery session from email link
  useEffect(()=>{
    if(!db)return;
    const{data:{subscription}}=db.auth.onAuthStateChange((event)=>{
      if(event==='PASSWORD_RECOVERY')setTab('newpw');
    });
    return()=>subscription.unsubscribe();
  },[]);

  const handleSetNewPassword=async()=>{
    if(!db)return;
    if(newPw.length<6){setErr("Password must be 6+ characters.");return;}
    if(newPw!==newPw2){setErr("Passwords don't match.");return;}
    setLoading(true);setErr("");
    const{error}=await db.auth.updateUser({password:newPw});
    if(error){setErr(error.message);}
    else{setMsg("Password updated! Signing you in...");setTimeout(()=>window.location.reload(),1500);}
    setLoading(false);
  };

  const handle=async()=>{
    if(!db)return;setLoading(true);setMsg("");setErr("");
    if(tab==='login'){
      const{error}=await db.auth.signInWithPassword({email,password:pw});
      if(error){setErr(error.message);}
      else{
        if(window.PasswordCredential){
          try{const c=new (window as any).PasswordCredential({id:email,password:pw});await navigator.credentials.store(c);}catch(_){}
        }
      }
    }
    else if(tab==='signup'){
      if(pw.length<6){setErr("Password must be 6+ characters.");setLoading(false);return;}
      const{error}=await db.auth.signUp({email,password:pw});
      if(error){setErr(error.message);}
      else{
        setMsg("Account created! Sign in now.");setTab('login');
        if(window.PasswordCredential){
          try{const c=new (window as any).PasswordCredential({id:email,password:pw});await navigator.credentials.store(c);}catch(_){}
        }
      }
    }
    else{
      const{error}=await db.auth.resetPasswordForEmail(email,{redirectTo:`${window.location.origin}`});
      if(error)setErr(error.message);
      else setMsg("Check your email for a reset link!");
    }
    setLoading(false);
  };

  // Set new password screen (after clicking email reset link)
  if(tab==='newpw')return(
    <div style={{minHeight:"100vh",background:"#0A0A0A",display:"flex",alignItems:"center",justifyContent:"center",padding:24,position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",inset:0,background:"radial-gradient(ellipse 80% 60% at 50% 50%, rgba(20,60,30,0.4) 0%, transparent 70%)",pointerEvents:"none"}}/>
      <div style={{width:"100%",maxWidth:400,position:"relative",zIndex:1}}>
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{display:"flex",justifyContent:"center",gap:8,marginBottom:10}}>{["♠","♥","♦","♣"].map((s,i)=><span key={i} style={{fontSize:28,color:i%2===0?"#C9A84C":"#E05555"}}>{s}</span>)}</div>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:36,fontWeight:900,color:"#C9A84C"}}>Home Game</div>
          <div style={{color:"#888",fontSize:11,fontFamily:"'Space Mono',monospace",letterSpacing:2,marginTop:8}}>SET NEW PASSWORD</div>
        </div>
        <Card>
          <div style={{marginBottom:12}}><label style={{color:"#888",fontSize:10,fontFamily:"'Space Mono',monospace",letterSpacing:1.5,display:"block",marginBottom:6}}>NEW PASSWORD</label><input type="password" autoComplete="new-password" value={newPw} onChange={e=>setNewPw(e.target.value)} placeholder="6+ characters" style={inp}/></div>
          <div style={{marginBottom:16}}><label style={{color:"#888",fontSize:10,fontFamily:"'Space Mono',monospace",letterSpacing:1.5,display:"block",marginBottom:6}}>CONFIRM PASSWORD</label><input type="password" autoComplete="new-password" value={newPw2} onChange={e=>setNewPw2(e.target.value)} placeholder="Same as above" style={inp}/></div>
          {err&&<div style={{background:"rgba(224,85,85,0.1)",border:"1px solid rgba(224,85,85,0.3)",borderRadius:8,padding:"9px 12px",color:"#E05555",fontFamily:"'Space Mono',monospace",fontSize:11,marginBottom:12}}>{err}</div>}
          {msg&&<div style={{background:"rgba(76,175,140,0.1)",border:"1px solid rgba(76,175,140,0.3)",borderRadius:8,padding:"9px 12px",color:"#4CAF8C",fontFamily:"'Space Mono',monospace",fontSize:11,marginBottom:12}}>{msg}</div>}
          <button onClick={handleSetNewPassword} disabled={loading||!newPw||!newPw2} style={{width:"100%",padding:"13px 0",background:!loading&&newPw&&newPw2?"linear-gradient(135deg,#C9A84C,#E8C56A)":"rgba(255,255,255,0.08)",border:"none",borderRadius:12,color:!loading&&newPw&&newPw2?"#0A0A0A":"#444",fontFamily:"'Space Mono',monospace",fontWeight:700,fontSize:13,letterSpacing:2,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:10}}>{loading?<Spinner size={16}/>:"UPDATE PASSWORD →"}</button>
        </Card>
      </div>
    </div>
  );
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
          <form onSubmit={e=>{e.preventDefault();handle();}} style={{padding:24}}>
            <div style={{marginBottom:12}}><label style={{color:"#888",fontSize:10,fontFamily:"'Space Mono',monospace",letterSpacing:1.5,display:"block",marginBottom:6}}>EMAIL</label><input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@email.com" style={inp}/></div>
            {tab!=='reset'&&<div style={{marginBottom:8}}><label style={{color:"#888",fontSize:10,fontFamily:"'Space Mono',monospace",letterSpacing:1.5,display:"block",marginBottom:6}}>PASSWORD</label><input type="password" autoComplete={tab==='login'?"current-password":"new-password"} value={pw} onChange={e=>setPw(e.target.value)} placeholder="••••••••" style={inp}/></div>}
            {tab==='login'&&<div style={{textAlign:"right",marginBottom:16}}><button type="button" onClick={()=>{setTab('reset');setErr("");setMsg("");}} style={{background:"none",border:"none",color:"#555",fontFamily:"'Space Mono',monospace",fontSize:11,cursor:"pointer"}}>Forgot password?</button></div>}
            {tab!=='login'&&<div style={{marginBottom:16}}/>}
            {err&&<div style={{background:"rgba(224,85,85,0.1)",border:"1px solid rgba(224,85,85,0.3)",borderRadius:8,padding:"9px 12px",color:"#E05555",fontFamily:"'Space Mono',monospace",fontSize:11,marginBottom:12,lineHeight:1.6}}>{err}</div>}
            {msg&&<div style={{background:"rgba(76,175,140,0.1)",border:"1px solid rgba(76,175,140,0.3)",borderRadius:8,padding:"9px 12px",color:"#4CAF8C",fontFamily:"'Space Mono',monospace",fontSize:11,marginBottom:12,lineHeight:1.6}}>{msg}</div>}
            <button type="submit" disabled={loading||!email||(tab!=='reset'&&!pw)} style={{width:"100%",padding:"13px 0",background:!loading&&email&&(tab==='reset'||pw)?"linear-gradient(135deg,#C9A84C,#E8C56A)":"rgba(255,255,255,0.08)",border:"none",borderRadius:12,color:!loading&&email&&(tab==='reset'||pw)?"#0A0A0A":"#444",fontFamily:"'Space Mono',monospace",fontWeight:700,fontSize:13,letterSpacing:2,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:10}}>{loading?<Spinner size={16}/>:tab==='login'?"SIGN IN →":tab==='signup'?"CREATE ACCOUNT →":"SEND RESET →"}</button>
          </form>
        </Card>
      </div>
    </div>
  );
}

function SetupProfileView({user,onDone}:any){
  const [name,setName]=useState("");const [loading,setLoading]=useState(false);const [err,setErr]=useState("");
  const save=async()=>{
    if(!db||!name.trim())return;
    setLoading(true);setErr("");
    try{
      // Try upsert first (new user or profile without display_name)
      const{error:uErr}=await db.from("profiles").upsert(
        {id:user.id,display_name:name.trim(),email:user.email,opt_in_global:false,global_total_profit:0,global_sessions:0,global_wins:0,global_time_seconds:0,chicken_dinners:0},
        {onConflict:"id"}
      );
      if(uErr){
        // Upsert failed — try plain update (profile exists, just missing display_name)
        const{error:updErr}=await db.from("profiles").update({display_name:name.trim()}).eq("id",user.id);
        if(updErr){setErr("Couldn't save name. Try signing out and back in.");return;}
      }
      onDone({id:user.id,display_name:name.trim(),email:user.email,avatar_url:null,opt_in_global:false});
    }catch(e:any){
      setErr(e.message||"Something went wrong. Check your connection.");
    }finally{
      setLoading(false);
    }
  };
  const signOut=async()=>{if(db)await db.auth.signOut();window.location.reload();};
  return(
    <div style={{minHeight:"100vh",background:"#0A0A0A",display:"flex",alignItems:"center",justifyContent:"center",padding:24,position:"relative"}}>
      <div style={{position:"absolute",inset:0,background:"radial-gradient(ellipse 80% 60% at 50% 50%, rgba(20,60,30,0.4) 0%, transparent 70%)",pointerEvents:"none"}}/>
      <div style={{width:"100%",maxWidth:400,position:"relative",zIndex:1}}>
        <div style={{textAlign:"center",marginBottom:28}}><div style={{display:"flex",justifyContent:"center",marginBottom:10}}><Icon name="person" size={38} color="#C9A84C"/></div><div style={{fontFamily:"'Playfair Display',serif",fontSize:26,color:"#fff"}}>One more thing</div><div style={{color:"#555",fontSize:11,fontFamily:"'Space Mono',monospace",letterSpacing:1.5,marginTop:6}}>WHAT DO THEY CALL YOU AT THE TABLE?</div></div>
        <Card>
          <div style={{marginBottom:14}}><input value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&save()} placeholder="e.g. Big Stack Tyler" autoFocus style={{...inp,fontSize:18,fontFamily:"'Playfair Display',serif",textAlign:"center" as const}}/></div>
          {err&&<div style={{color:"#E05555",fontSize:11,marginBottom:10}}>{err}</div>}
          <button onClick={save} disabled={loading||!name.trim()} style={{width:"100%",padding:"13px 0",background:name.trim()&&!loading?"linear-gradient(135deg,#C9A84C,#E8C56A)":"rgba(255,255,255,0.08)",border:"none",borderRadius:12,color:name.trim()&&!loading?"#0A0A0A":"#444",fontFamily:"'Space Mono',monospace",fontWeight:700,fontSize:13,letterSpacing:2,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:10,marginBottom:10}}>{loading?<Spinner size={16}/>:"LET'S PLAY →"}</button>
          <button onClick={signOut} style={{width:"100%",padding:"9px 0",background:"none",border:"none",color:"#333",fontFamily:"'Space Mono',monospace",fontSize:10,cursor:"pointer",letterSpacing:1}}>wrong account? sign out</button>
        </Card>
      </div>
    </div>
  );
}

// ─── SVG ICONS ─────────────────────────────────────────
function Icon({name,size=16,color="currentColor"}:{name:string;size?:number;color?:string}){
  const s={width:size,height:size,display:"inline-block" as const,flexShrink:0,verticalAlign:"middle" as const};
  const icons:Record<string,any>={
    crown:<svg {...s} viewBox="0 0 24 24" fill="none"><path d="M3 18h18M3 18l2-8 4 4 3-7 3 7 4-4 2 8H3z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round"/></svg>,
    lock:<svg {...s} viewBox="0 0 24 24" fill="none"><rect x="5" y="11" width="14" height="10" rx="2" stroke={color} strokeWidth={1.8}/><path d="M8 11V7a4 4 0 018 0v4" stroke={color} strokeWidth={1.8} strokeLinecap="round"/></svg>,
    unlock:<svg {...s} viewBox="0 0 24 24" fill="none"><rect x="5" y="11" width="14" height="10" rx="2" stroke={color} strokeWidth={1.8}/><path d="M8 11V7a4 4 0 018 0" stroke={color} strokeWidth={1.8} strokeLinecap="round"/></svg>,
    trophy:<svg {...s} viewBox="0 0 24 24" fill="none"><path d="M8 21h8M12 17v4M5 3H3v4a4 4 0 004 4h0M19 3h2v4a4 4 0 01-4 4h0" stroke={color} strokeWidth={1.8} strokeLinecap="round"/><path d="M5 3h14v8a5 5 0 01-10 0V3z" stroke={color} strokeWidth={1.8}/></svg>,
    bell:<svg {...s} viewBox="0 0 24 24" fill="none"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/></svg>,
    globe:<svg {...s} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke={color} strokeWidth={1.8}/><path d="M12 3c-2 3-3 5-3 9s1 6 3 9M12 3c2 3 3 5 3 9s-1 6-3 9M3 12h18" stroke={color} strokeWidth={1.5} strokeLinecap="round"/></svg>,
    pin:<svg {...s} viewBox="0 0 24 24" fill="none"><path d="M12 21s-7-6.5-7-11a7 7 0 0114 0c0 4.5-7 11-7 11z" stroke={color} strokeWidth={1.8}/><circle cx="12" cy="10" r="2.5" stroke={color} strokeWidth={1.8}/></svg>,
    link:<svg {...s} viewBox="0 0 24 24" fill="none"><path d="M10 13a5 5 0 007.5.7l2-2a5 5 0 00-7-7l-1.1 1.1" stroke={color} strokeWidth={1.8} strokeLinecap="round"/><path d="M14 11a5 5 0 00-7.5-.7l-2 2a5 5 0 007 7l1.1-1.1" stroke={color} strokeWidth={1.8} strokeLinecap="round"/></svg>,
    flame:<svg {...s} viewBox="0 0 24 24" fill="none"><path d="M12 2c0 4-4 6-4 10a4 4 0 008 0c0-2-1-3-1-5 1.5 1 2 3 2 5a6 6 0 01-12 0c0-5 4-8 4-12 1 2 1 4 3 2z" stroke={color} strokeWidth={1.5} strokeLinejoin="round"/></svg>,
    warning:<svg {...s} viewBox="0 0 24 24" fill="none"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke={color} strokeWidth={1.8} strokeLinejoin="round"/><line x1="12" y1="9" x2="12" y2="13" stroke={color} strokeWidth={1.8} strokeLinecap="round"/><circle cx="12" cy="17" r="1" fill={color}/></svg>,
    card:<svg {...s} viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="14" rx="2" stroke={color} strokeWidth={1.8}/><path d="M7 9h2M7 13h6" stroke={color} strokeWidth={1.8} strokeLinecap="round"/><path d="M16 9l1.5 4L19 9" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"/></svg>,
    camera:<svg {...s} viewBox="0 0 24 24" fill="none"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" stroke={color} strokeWidth={1.8} strokeLinejoin="round"/><circle cx="12" cy="13" r="4" stroke={color} strokeWidth={1.8}/></svg>,
    hourglass:<svg {...s} viewBox="0 0 24 24" fill="none"><path d="M5 3h14M5 21h14M6 3v3l6 6-6 6v3M18 3v3l-6 6 6 6v3" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/></svg>,
    drumstick:<svg {...s} viewBox="0 0 24 24" fill="none"><path d="M15.5 2C13.6 2 12 3.6 12 5.5c0 .8.3 1.5.7 2.1L5.8 14.5A3 3 0 0 0 5 16.5 3 3 0 0 0 8 19.5a3 3 0 0 0 2.1-.8l6.9-6.9c.5.4 1.2.7 2 .7C20.7 12.5 22 11 22 9c0-2-1.3-3.5-3-4A3.5 3.5 0 0 0 15.5 2Z" fill={color} opacity="0.9"/><circle cx="7.5" cy="16.5" r="1.5" fill={color} opacity="0.6"/></svg>,
    spade:<svg {...s} viewBox="0 0 24 24" fill="none"><path d="M12 2L4 10a5 5 0 007 7l-1 3h4l-1-3a5 5 0 007-7L12 2z" stroke={color} strokeWidth={1.8} strokeLinejoin="round"/></svg>,
    person:<svg {...s} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke={color} strokeWidth={1.8}/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke={color} strokeWidth={1.8} strokeLinecap="round"/></svg>,
    pencil:<svg {...s} viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/><path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/></svg>,
    star:<svg {...s} viewBox="0 0 24 24" fill="none"><polygon points="12,2 15.1,8.3 22,9.3 17,14.1 18.2,21 12,17.8 5.8,21 7,14.1 2,9.3 8.9,8.3" stroke={color} strokeWidth={1.8} strokeLinejoin="round"/></svg>,
    check:<svg {...s} viewBox="0 0 24 24" fill="none"><polyline points="20,6 9,17 4,12" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/></svg>,
  };
  return icons[name]||<span style={{fontSize:size*0.7,color}}>{name}</span>;
}


const POKER_TIPS=[
  "Chicken dinner = last player standing with profit. Winner takes the glory.",
  "Fold more. Seriously. Most hands aren't worth playing.",
  "Position is everything — acting last is a massive advantage.",
  "The best hand doesn't always win. The best bluff sometimes does.",
  "If you can't spot the fish at the table, it's probably you.",
  "Slow playing a monster hand is how fish become sharks.",
  "Never go broke on one hand. Patience is a strategy.",
  "A good fold is just as important as a good call.",
  "Poker is 100% skill and 100% luck. Simultaneously.",
  "The money you save by folding counts as profit.",
  "Re-buying doesn't reset bad decisions — it funds them.",
  "Don't tap the glass. Let the bad players stay comfortable.",
  "If you're tilting, stand up. Take a breath. Come back.",
  "Pay attention even when you're not in the hand.",
  "Winning a big pot feels great. Building one slowly feels better.",
  "Everyone runs bad. The best players run bad less often.",
  "Variance is real. Your edge is also real. Play enough to find out which wins.",
  "Home games are about more than money. But the money still matters.",
];
function PokerTicker(){
  const [idx,setIdx]=useState(()=>Math.floor(Math.random()*POKER_TIPS.length));
  const [fade,setFade]=useState(true);
  useEffect(()=>{
    const t=setInterval(()=>{
      setFade(false);
      setTimeout(()=>{setIdx(i=>(i+1)%POKER_TIPS.length);setFade(true);},400);
    },12000);
    return()=>clearInterval(t);
  },[]);
  return(
    <div style={{padding:"10px 14px",marginBottom:12,marginTop:6,background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.05)",borderRadius:10,minHeight:42,display:"flex",alignItems:"center"}}>
      <div style={{color:"#666",fontSize:11,fontFamily:"'Space Mono',monospace",lineHeight:1.5,transition:"opacity 0.4s",opacity:fade?1:0}}>{POKER_TIPS[idx]}</div>
    </div>
  );
}

// ─── NOTIFICATION BELL ─────────────────────────────────
function NotificationBell({profile,myLeagues,onViewNotification}:any){
  const [count,setCount]=useState(0);const [open,setOpen]=useState(false);
  const [notifs,setNotifs]=useState<any[]>([]);const [loading,setLoading]=useState(false);
  useEffect(()=>{if(!db||!profile)return;loadCount();},[profile,myLeagues]);
  const loadCount=async()=>{
    if(!db)return;
    const name=profile.display_name;
    // Friend requests pending for me
    const{data:fr}=await db.from("friends").select("id").eq("recipient_name",name).eq("status","pending");
    // Edit alerts for sessions in leagues I'm in (all members, not just commissioner)
    const allLeagueIds=myLeagues.map((l:any)=>l.id);
    const{data:ea}=allLeagueIds.length>0
      ?await db.from("sessions").select("id").not("edit_alert","is",null).in("league_id",allLeagueIds)
      :{data:[]};
    setCount(((fr||[]).length)+((ea||[]).length));
  };
  const loadNotifs=async()=>{
    if(!db||loading)return;setLoading(true);
    const name=profile.display_name;
    const allLeagueIds=myLeagues.map((l:any)=>l.id);
    const[{data:fr},{data:ea}]=await Promise.all([
      db.from("friends").select("*").eq("recipient_name",name).eq("status","pending"),
      allLeagueIds.length>0
        ?db.from("sessions").select("id,edit_alert,notes,created_at,league_id").not("edit_alert","is",null).in("league_id",allLeagueIds)
        :Promise.resolve({data:[]}),
    ]);
    const items:any[]=[];
    (fr||[]).forEach((f:any)=>items.push({type:"friend",id:f.id,text:`${f.requester_name} sent a friend request`,ts:f.created_at}));
    (ea||[]).forEach((s:any)=>items.push({type:"session_edit",id:s.id,text:s.edit_alert?.summary||"Stats were edited",sub:s.notes||new Date(s.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric'}),ts:s.edit_alert?.ts||s.created_at,sessionId:s.id,leagueId:s.league_id}));
    items.sort((a,b)=>new Date(b.ts).getTime()-new Date(a.ts).getTime());
    setNotifs(items);setLoading(false);
  };
  const handleOpen=()=>{setOpen(o=>!o);if(!open)loadNotifs();};
  return(
    <div style={{position:"relative"}}>
      <button onClick={handleOpen} style={{background:"none",border:"none",cursor:"pointer",position:"relative",padding:4}}>
        <Icon name="bell" size={22} color={open?"#C9A84C":"#666"}/>
        {count>0&&<span style={{position:"absolute",top:0,right:0,background:"#E05555",color:"#fff",borderRadius:"50%",width:16,height:16,fontSize:9,fontFamily:"'Space Mono',monospace",fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1}}>{count>9?"9+":count}</span>}
      </button>
      {open&&<div style={{position:"absolute",top:36,right:0,width:280,background:"#141414",border:"1px solid rgba(201,168,76,0.2)",borderRadius:14,zIndex:200,boxShadow:"0 8px 32px rgba(0,0,0,0.6)",overflow:"hidden"}}>
        <div style={{padding:"12px 14px",borderBottom:"1px solid rgba(255,255,255,0.06)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{color:"#888",fontFamily:"'Space Mono',monospace",fontSize:10,letterSpacing:1.5}}>NOTIFICATIONS</span>
          <button onClick={()=>setOpen(false)} style={{background:"none",border:"none",color:"#444",fontSize:14,cursor:"pointer"}}>✕</button>
        </div>
        {loading&&<div style={{display:"flex",justifyContent:"center",padding:20}}><Spinner size={18}/></div>}
        {!loading&&notifs.length===0&&<div style={{padding:"18px 14px",color:"#444",fontFamily:"'Space Mono',monospace",fontSize:11,textAlign:"center"}}>No new notifications</div>}
        {!loading&&notifs.map((n:any,i:number)=>(
          <div key={n.id+n.type} onClick={()=>{if(n.type==="session_edit"&&onViewNotification)onViewNotification(n);setOpen(false);}} style={{padding:"11px 14px",borderBottom:i<notifs.length-1?"1px solid rgba(255,255,255,0.04)":"none",cursor:n.type==="session_edit"?"pointer":"default",background:"rgba(255,255,255,0.01)"}}>
            <div style={{display:"flex",alignItems:"flex-start",gap:9}}>
              <div style={{marginTop:1,flexShrink:0}}>{n.type==="friend"?<Icon name="person" size={16} color="#888"/>:<Icon name="warning" size={16} color="#E05555"/>}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{color:"#fff",fontSize:12,lineHeight:1.4}}>{n.text}</div>
                {n.sub&&<div style={{color:"#555",fontSize:10,fontFamily:"'Space Mono',monospace",marginTop:2}}>{n.sub}</div>}
                {n.type==="session_edit"&&<div style={{color:"#5577CC",fontSize:9,fontFamily:"'Space Mono',monospace",marginTop:3}}>tap to view →</div>}
              </div>
            </div>
          </div>
        ))}
      </div>}
    </div>
  );
}

// ─── LEAGUE HOME ───────────────────────────────────────
function LeagueHomeView({profile,myLeagues,loading,onSelectLeague,onJoinCreate,onScoreboard,onViewNotification,onViewHandRankings}:any){
  const has100hrs=(profile?.global_time_seconds||0)>=360000;
  const hoursPlayed=Math.floor((profile?.global_time_seconds||0)/3600);
  const hoursLeft=Math.max(0,100-hoursPlayed);
  return(
    <div style={{padding:"20px 16px",maxWidth:500,margin:"0 auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <div><div style={{display:"flex",gap:6,marginBottom:3,alignItems:"center"}}><Icon name="spade" size={14} color="#C9A84C"/><span style={{color:"#E05555",fontSize:14,lineHeight:1}}>♥</span></div><div style={{fontFamily:"'Playfair Display',serif",fontSize:24,color:"#C9A84C"}}>Home Game</div></div>
        <div style={{display:"flex",flexDirection:"column" as const,alignItems:"flex-end",gap:3}}>
          <NotificationBell profile={profile} myLeagues={myLeagues} onViewNotification={onViewNotification}/>
          <div style={{color:"#fff",fontSize:18,fontFamily:"'Playfair Display',serif",fontWeight:700}}>{profile.display_name}</div>
        </div>
      </div>
      <div style={{height:1,background:"rgba(201,168,76,0.1)",marginBottom:14}}/>
      <button onClick={onScoreboard} style={{width:"100%",padding:"12px 0",marginBottom:14,background:has100hrs?"rgba(201,168,76,0.08)":"rgba(255,255,255,0.03)",border:`1px solid ${has100hrs?"rgba(201,168,76,0.25)":"rgba(255,255,255,0.07)"}`,borderRadius:12,cursor:"pointer",display:"flex",flexDirection:"column" as const,alignItems:"center",gap:4}}>
        <div style={{display:"flex",alignItems:"center",gap:7,color:has100hrs?"#C9A84C":"#888",fontFamily:"'Space Mono',monospace",fontSize:12,letterSpacing:1.5}}><Icon name="trophy" size={14} color={has100hrs?"#C9A84C":"#888"}/> WORLDWIDE LEADERBOARD</div>
        {!has100hrs&&<div style={{color:"#444",fontFamily:"'Space Mono',monospace",fontSize:9,letterSpacing:1}}>{hoursLeft} hours to unlock</div>}
      </button>
      {loading&&<div style={{display:"flex",justifyContent:"center",padding:36}}><Spinner size={30}/></div>}
      {!loading&&myLeagues.length===0&&<Card style={{marginBottom:14,textAlign:"center" as const}}><div style={{padding:"18px 0",display:"flex",flexDirection:"column" as const,alignItems:"center",gap:8}}><Icon name="spade" size={28} color="#333"/><div style={{color:"#555",fontFamily:"'Space Mono',monospace",fontSize:12}}>No leagues yet — join or create one below</div></div></Card>}
      {!loading&&myLeagues.map((lg:any)=>{
        const isComm=lg.commissioner_id===lg._myUserId;
        const sessionsLeft=lg.season_length>0?lg.season_length-(lg._sessionCount||0):null;
        const est=lg.created_at?new Date(lg.created_at).toLocaleDateString('en-US',{month:'long',year:'numeric'}):null;
        return<div key={lg.id} onClick={()=>onSelectLeague(lg)} style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(201,168,76,0.12)",borderRadius:14,padding:"14px 16px",marginBottom:9,cursor:"pointer"}}>
          <div style={{display:"flex",alignItems:"center",gap:11}}>
            <div style={{width:40,height:40,borderRadius:10,background:"rgba(201,168,76,0.1)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              {lg.is_public?<Icon name="globe" size={20} color="#5577CC"/>:<Icon name="spade" size={20} color="#C9A84C"/>}
            </div>
            <div style={{flex:1,minWidth:0,textAlign:"center" as const}}>
              <div style={{color:"#fff",fontFamily:"'Playfair Display',serif",fontSize:17,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
                {lg.name}
                {isComm&&<Icon name="crown" size={13} color="#C9A84C"/>}
                {sessionsLeft!==null&&sessionsLeft<=0&&<span style={{fontSize:10,color:"#E05555",fontFamily:"'Space Mono',monospace"}}>DONE</span>}
              </div>
              {lg.description&&<div style={{color:"#666",fontSize:11,marginTop:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{lg.description}</div>}
              <div style={{color:"#444",fontSize:9,fontFamily:"'Space Mono',monospace",marginTop:3,display:"flex",alignItems:"center",justifyContent:"center",gap:4}}>{est?"Est. "+est:""}{lg.location_name&&<><Icon name="pin" size={8} color="#444"/>{lg.location_name}</>}</div>
            </div>
          </div>
        </div>;
      })}
      <button onClick={onJoinCreate} style={{width:"100%",padding:"12px 0",marginTop:4,background:"linear-gradient(135deg,#C9A84C,#E8C56A)",border:"none",borderRadius:12,color:"#0A0A0A",fontFamily:"'Space Mono',monospace",fontWeight:700,fontSize:13,letterSpacing:2,cursor:"pointer"}}>+ JOIN OR CREATE LEAGUE</button>
      <PokerTicker/>
      <button onClick={onViewHandRankings} style={{width:"100%",padding:"10px 0",background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:10,color:"#555",fontFamily:"'Space Mono',monospace",fontSize:10,letterSpacing:1.5,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:7,marginBottom:4}}><Icon name="card" size={12} color="#555"/>HAND RANKINGS</button>
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
              <div style={{marginBottom:10}}><label style={{color:"#888",fontSize:10,fontFamily:"'Space Mono',monospace",letterSpacing:1.5,display:"block",marginBottom:5}}>LOCATION</label><div style={{display:"flex",gap:8}}><input value={locationName} onChange={e=>setLocationName(e.target.value)} placeholder="e.g. San Francisco, CA" style={{...inp,flex:1}}/><button onClick={detectLocation} style={{padding:"0 13px",background:"rgba(201,168,76,0.1)",border:"1px solid rgba(201,168,76,0.2)",borderRadius:10,color:"#C9A84C",cursor:"pointer",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>{detecting?<Spinner size={13}/>:<Icon name="pin" size={14} color="#C9A84C"/>}</button></div></div>
              <Toggle value={isPublic} onChange={setIsPublic} label="Public League" sub="Anyone can find & join without a code"/>
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
      <div style={{display:"flex",gap:8,marginBottom:10}}><input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Search name or city..." style={{...inp,flex:1,padding:"9px 12px",fontSize:13}}/><button onClick={detectLocation} style={{padding:"0 13px",background:"rgba(85,119,204,0.1)",border:"1px solid rgba(85,119,204,0.3)",borderRadius:10,color:"#5577CC",cursor:"pointer",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>{detecting?<Spinner size={13}/>:<Icon name="pin" size={14} color="#5577CC"/>}</button></div>
      {userLoc&&<div style={{color:"#5577CC",fontSize:11,fontFamily:"'Space Mono',monospace",marginBottom:10,display:"flex",alignItems:"center",gap:5}}><Icon name="pin" size={11} color="#5577CC"/>Near {userLoc} first</div>}
      {loading&&<div style={{display:"flex",justifyContent:"center",padding:36}}><Spinner/></div>}
      {!loading&&sorted.length===0&&<Card><div style={{textAlign:"center",padding:"22px 0",color:"#555",fontFamily:"'Space Mono',monospace",fontSize:12}}>No public leagues found.</div></Card>}
      {sorted.map((lg:any)=><Card key={lg.id} style={{marginBottom:11}}><div style={{display:"flex",gap:11,marginBottom:11}}><div style={{width:44,height:44,borderRadius:11,background:"rgba(85,119,204,0.15)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><Icon name="spade" size={20} color="#5577CC"/></div><div style={{flex:1}}><div style={{color:"#fff",fontFamily:"'Playfair Display',serif",fontSize:16}}>{lg.name}</div>{lg.description&&<div style={{color:"#666",fontSize:11,marginTop:2}}>{lg.description}</div>}<div style={{color:"#555",fontSize:10,fontFamily:"'Space Mono',monospace",marginTop:3,display:"flex",alignItems:"center",gap:4}}>{lg.season} · ${lg.buy_in}{lg.location_name?<><Icon name="pin" size={9} color="#5577CC"/><span style={{color:"#5577CC"}}>{lg.location_name}</span></>:null} · {lg.max_players||12} max</div></div></div><button onClick={()=>onJoin(lg)} style={{width:"100%",padding:"10px 0",background:"rgba(85,119,204,0.15)",border:"1px solid rgba(85,119,204,0.3)",borderRadius:9,color:"#5577CC",fontFamily:"'Space Mono',monospace",fontSize:11,letterSpacing:1.5,cursor:"pointer"}}>JOIN LEAGUE →</button></Card>)}
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
        {sorted.map((p:any,i:number)=>{const medalColors=["#C9A84C","#888","#A0714F"];const isTop3=i<3;return<div key={p.id} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 0",borderBottom:i<sorted.length-1?"1px solid rgba(255,255,255,0.05)":"none"}}>
          <div style={{width:24,textAlign:"center",flexShrink:0}}>{isTop3?<div style={{width:20,height:20,borderRadius:"50%",background:`${medalColors[i]}22`,border:`1px solid ${medalColors[i]}66`,display:"flex",alignItems:"center",justifyContent:"center",color:medalColors[i],fontFamily:"'Space Mono',monospace",fontSize:9,fontWeight:700,margin:"0 auto"}}>{i+1}</div>:<span style={{color:"#333",fontFamily:"'Space Mono',monospace",fontSize:11}}>{i+1}</span>}</div>
          <Avatar name={p.name} size={34} streak={p.streak||0}/>
          <div style={{flex:1}}><div style={{color:"#fff",fontSize:13}}>{p.name}</div><div style={{color:"#555",fontSize:10,fontFamily:"'Space Mono',monospace"}}>{p.session_count} games · {p.wins}W</div></div>
          <div style={{color:p.total_profit>=0?"#4CAF8C":"#E05555",fontFamily:"'Space Mono',monospace",fontWeight:700,fontSize:13}}>{fmtProfit(p.total_profit)}</div>
        </div>;})}
      </Card>}
      <Card style={{marginBottom:12}}>
        <div style={{color:"#888",fontSize:10,fontFamily:"'Space Mono',monospace",letterSpacing:2,marginBottom:12}}>SEASON AWARDS</div>
        {sorted[0]&&<div style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid rgba(255,255,255,0.05)"}}><span style={{color:"#555",fontFamily:"'Space Mono',monospace",fontSize:11,display:"flex",alignItems:"center",gap:5}}><Icon name="star" size={11} color="#555"/>Most Profitable</span><span style={{color:"#4CAF8C",fontFamily:"'Space Mono',monospace",fontWeight:700}}>{sorted[0].name}</span></div>}
        {topChicken&&<div style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid rgba(255,255,255,0.05)"}}><span style={{color:"#555",fontFamily:"'Space Mono',monospace",fontSize:11,display:"flex",alignItems:"center",gap:5}}><Icon name="drumstick" size={11} color="#555"/>Most Chicken Dinners</span><span style={{color:"#C9A84C",fontFamily:"'Space Mono',monospace",fontWeight:700}}>{topChicken[0]} ×{topChicken[1]}</span></div>}
        {mostSessions&&<div style={{display:"flex",justifyContent:"space-between",padding:"8px 0"}}><span style={{color:"#555",fontFamily:"'Space Mono',monospace",fontSize:11,display:"flex",alignItems:"center",gap:5}}><Icon name="card" size={11} color="#555"/>Most Sessions</span><span style={{color:"#fff",fontFamily:"'Space Mono',monospace",fontWeight:700}}>{mostSessions.name} ({mostSessions.session_count})</span></div>}
      </Card>
    </div>
  );
}

// ─── LEAGUE DETAIL ─────────────────────────────────────
function LeagueDetailView({league,players,sessions,profile,isCommissioner,onViewPlayer,onStartSession,onBack,onCommSettings,liveSession,onLeaveLeague,onViewHandRankings,onViewSession,onSeasonRecap,onEndSeason,onViewSeasonArchive,showToast}:any){
  const [sortBy,setSortBy]=useState<'profit'|'winpct'|'time'|'chicken'>('profit');
  const [search,setSearch]=useState("");
  const getSorted=()=>{
    let c=[...players];
    if(search)c=c.filter((p:any)=>p.name.toLowerCase().includes(search.toLowerCase()));
    if(sortBy==='profit')return c.sort((a:any,b:any)=>b.total_profit-a.total_profit);
    if(sortBy==='winpct')return c.sort((a:any,b:any)=>{const ar=a.session_count>0?a.wins/a.session_count:0;const br=b.session_count>0?b.wins/b.session_count:0;return br-ar;});
    if(sortBy==='chicken')return c.sort((a:any,b:any)=>(b.chicken_dinners||0)-(a.chicken_dinners||0));
    if(sortBy==='time')return c.sort((a:any,b:any)=>(b.time_played_seconds||0)-(a.time_played_seconds||0));
    return c.sort((a:any,b:any)=>b.total_profit-a.total_profit);
  };
  const sessionsLeft=league.season_length>0?league.season_length-sessions.length:null;
  const seasonDone=sessionsLeft!==null&&sessionsLeft<=0;
  const copyInviteLink=()=>{
    const link=`${window.location.origin}/invite?join=${league.code}`;
    navigator.clipboard?.writeText(link).then(()=>showToast("Invite link copied! 🔗")).catch(()=>showToast(`Share this code: ${league.code}`));
  };
  const getPrimaryStatValue=(p:any)=>{
    if(sortBy==='profit')return{val:`${fmtProfit(p.total_profit)}`,color:p.total_profit>=0?"#4CAF8C":"#E05555"};
    if(sortBy==='winpct'){const pct=p.session_count>0?((p.wins/p.session_count)*100).toFixed(0):0;return{val:`${pct}%`,color:"#5577CC"};}
    if(sortBy==='time')return{val:fmtSeconds(p.time_played_seconds||0)||"—",color:"#888"};
    if(sortBy==='chicken')return{val:`${p.chicken_dinners||0}`,color:"#C9A84C"};
    return{val:"—",color:"#888"};
  };
  const getSubStat=(p:any)=>{
    const winPct=p.session_count>0?((p.wins/p.session_count)*100).toFixed(0):0;
    if(sortBy==='profit')return`${p.session_count} sessions · ${winPct}% win`;
    if(sortBy==='winpct')return`${p.session_count} sessions · ${fmtProfit(p.total_profit)}`;
    if(sortBy==='time')return`${p.session_count} sessions · ${fmtProfit(p.total_profit)}`;
    if(sortBy==='chicken')return`${p.session_count} sessions · ${winPct}% win`;
    return`${p.session_count} sessions`;
  };
  return(
    <div style={{maxWidth:500,margin:"0 auto"}}>
      <div style={{background:"linear-gradient(180deg,rgba(20,40,20,0.95) 0%,rgba(10,10,10,0) 100%)",padding:"18px 16px 0"}}>
        <div style={{display:"flex",alignItems:"center",gap:11,marginBottom:12}}>
          <button onClick={onBack} style={{background:"none",border:"none",color:"#555",fontSize:22,cursor:"pointer"}}>←</button>
          <div style={{flex:1,minWidth:0}}><div style={{fontFamily:"'Playfair Display',serif",fontSize:21,fontWeight:700,color:"#fff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{league.name}</div>{league.description&&<div style={{color:"#666",fontSize:11,marginTop:1}}>{league.description}</div>}</div>
          {isCommissioner&&<button onClick={onCommSettings} style={{background:"rgba(201,168,76,0.1)",border:"1px solid rgba(201,168,76,0.2)",borderRadius:20,padding:"5px 10px",color:"#C9A84C",fontFamily:"'Space Mono',monospace",fontSize:9,cursor:"pointer",flexShrink:0,display:"flex",alignItems:"center",gap:4}}><Icon name="crown" size={11} color="#C9A84C"/> MANAGE</button>}
        </div>
        {seasonDone&&<div style={{background:"rgba(224,85,85,0.1)",border:"1px solid rgba(224,85,85,0.3)",borderRadius:10,padding:"9px 14px",marginBottom:10,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <span style={{color:"#E05555",fontFamily:"'Space Mono',monospace",fontSize:11}}>🏁 Season complete — {sessions.length} sessions</span>
          <button onClick={onSeasonRecap} style={{padding:"3px 10px",background:"rgba(224,85,85,0.15)",border:"1px solid rgba(224,85,85,0.3)",borderRadius:20,color:"#E05555",fontFamily:"'Space Mono',monospace",fontSize:10,cursor:"pointer"}}>VIEW RECAP</button>
        </div>}
        {sessionsLeft!==null&&sessionsLeft>0&&sessionsLeft<=3&&<div style={{background:"rgba(201,168,76,0.08)",border:"1px solid rgba(201,168,76,0.2)",borderRadius:10,padding:"9px 14px",marginBottom:10,color:"#C9A84C",fontFamily:"'Space Mono',monospace",fontSize:11,textAlign:"center" as const,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}><Icon name="warning" size={12} color="#C9A84C"/>Only {sessionsLeft} session{sessionsLeft!==1?"s":""} left in the season!</div>}
        <div style={{display:"flex",gap:7,marginBottom:11}}>
          <StatBox label="Members" value={`${players.length}/${league.max_players||12}`}/>
          <StatBox label="Sessions" value={sessions.length}/>
          <StatBox label="Last Buy-in" value={sessions[0]?.buy_in_amount?`$${sessions[0].buy_in_amount}`:`$${league.buy_in}`} accent="#4CAF8C"/>
          <StatBox label="All-Time Vol" value={`$${sessions.reduce((a:number,s:any)=>a+(s.pot||0),0).toLocaleString()}`} accent="#C9A84C"/>
        </div>
        {/* Code / Location / Invite — evenly spaced */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,gap:8}}>
          <span style={{color:"#C9A84C",fontSize:12,fontFamily:"'Space Mono',monospace",letterSpacing:3,background:"rgba(201,168,76,0.1)",padding:"4px 10px",borderRadius:8,flexShrink:0}}>{league.code}</span>
          <span style={{color:"#555",fontSize:10,fontFamily:"'Space Mono',monospace",flex:1,textAlign:"center" as const,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",display:"flex",alignItems:"center",justifyContent:"center",gap:4}}>{league.location_name?<><Icon name="pin" size={10} color="#555"/>{league.location_name}</>:(league.is_public?<><Icon name="globe" size={10} color="#5577CC"/>Public</>:"")}</span>
          <button onClick={copyInviteLink} style={{padding:"4px 12px",background:"rgba(76,175,140,0.1)",border:"1px solid rgba(76,175,140,0.3)",borderRadius:20,color:"#4CAF8C",fontFamily:"'Space Mono',monospace",fontSize:10,cursor:"pointer",letterSpacing:1,flexShrink:0,display:"flex",alignItems:"center",gap:5}}><Icon name="link" size={11} color="#4CAF8C"/>Invite</button>
        </div>
      </div>
      <div style={{padding:"0 16px 20px"}}>
        <SeasonCountdown league={league} isCommissioner={isCommissioner} onEndSeason={onEndSeason}/>
        {liveSession&&<div onClick={onStartSession} style={{background:"rgba(76,175,140,0.1)",border:"1px solid rgba(76,175,140,0.4)",borderRadius:13,padding:"13px 16px",marginBottom:12,cursor:"pointer",display:"flex",alignItems:"center",gap:11}}><div style={{width:9,height:9,borderRadius:"50%",background:"#4CAF8C",animation:"pulse 1.5s infinite",flexShrink:0}}/><div style={{flex:1}}><div style={{color:"#4CAF8C",fontFamily:"'Space Mono',monospace",fontSize:11,letterSpacing:2}}>● GAME IS LIVE</div><div style={{color:"#888",fontSize:11,marginTop:1}}>Tap to enter your stats</div></div><span style={{color:"#4CAF8C",fontSize:20}}>›</span></div>}
        {!liveSession&&<button onClick={onStartSession} style={{width:"100%",padding:"12px 0",marginBottom:12,background:"linear-gradient(135deg,#1a4a2a,#2a6a3a)",border:"1px solid rgba(76,175,140,0.4)",borderRadius:13,color:"#4CAF8C",fontFamily:"'Space Mono',monospace",fontWeight:700,fontSize:12,letterSpacing:2,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:9}}><span style={{fontSize:17}}>♠</span> START TONIGHT'S SESSION</button>}
        <div style={{marginBottom:9}}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search players..." style={{...inp,padding:"7px 11px",fontSize:12}}/>
        </div>
        {/* Sort bar */}
        <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:11}}>
          <div style={{display:"flex",gap:5,overflowX:"auto",flex:1,scrollbarWidth:"none",msOverflowStyle:"none",WebkitOverflowScrolling:"touch"} as any}>
            <style>{`.sort-bar::-webkit-scrollbar{display:none}`}</style>
            <div className="sort-bar" style={{display:"flex",gap:5,minWidth:"max-content"}}>
              {([['profit','$ P/L'],['winpct','WIN %'],['time','TIME PLAYED'],['chicken','DINNERS']] as any[]).map(([k,l])=><button key={k} onClick={()=>setSortBy(k)} style={{padding:"4px 11px",borderRadius:20,background:sortBy===k?"rgba(201,168,76,0.2)":"rgba(255,255,255,0.04)",border:`1px solid ${sortBy===k?"rgba(201,168,76,0.4)":"rgba(255,255,255,0.08)"}`,color:sortBy===k?"#C9A84C":"#555",fontFamily:"'Space Mono',monospace",fontSize:10,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0,display:"flex",alignItems:"center",gap:4}}>{k==='chicken'&&<Icon name="drumstick" size={10} color={sortBy===k?"#C9A84C":"#555"}/>}{l}</button>)}
            </div>
          </div>
        </div>
        <Card style={{padding:0,overflow:"hidden",marginBottom:12}}>
          {getSorted().length===0&&<div style={{color:"#555",fontFamily:"'Space Mono',monospace",fontSize:12,textAlign:"center",padding:"22px 0"}}>{search?"No players match your search":"No members yet"}</div>}
          {getSorted().map((p:any,i:number)=>{
            const isComm=p.name.toLowerCase()===league.commissioner_name?.toLowerCase();
            const medals=["1","2","3"];const isTop3=i<3&&!search;
            const medalColors=["#C9A84C","#888","#A0714F"];
            const{val,color}=getPrimaryStatValue(p);
            return<div key={p.id} onClick={()=>onViewPlayer(p)} style={{display:"flex",alignItems:"center",gap:11,padding:"12px 16px",borderBottom:"1px solid rgba(255,255,255,0.05)",cursor:"pointer",background:i===0&&!search?"rgba(201,168,76,0.03)":"transparent"}}>
              <div style={{width:22,textAlign:"center",flexShrink:0}}>{isTop3?<div style={{width:20,height:20,borderRadius:"50%",background:`${medalColors[i]}22`,border:`1px solid ${medalColors[i]}66`,display:"flex",alignItems:"center",justifyContent:"center",color:medalColors[i],fontFamily:"'Space Mono',monospace",fontSize:9,fontWeight:700,margin:"0 auto"}}>{medals[i]}</div>:<span style={{color:"#333",fontFamily:"'Space Mono',monospace",fontSize:11}}>{i+1}</span>}</div>
              <Avatar name={p.name} size={38}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{color:"#fff",fontSize:13,display:"flex",alignItems:"center",gap:4}}>{p.name.length>13?p.name.slice(0,13)+"…":p.name} {isComm&&<Icon name="crown" size={12} color="#C9A84C"/>}</div>
                <div style={{color:"#555",fontSize:10,fontFamily:"'Space Mono',monospace",marginTop:1}}>{getSubStat(p)}</div>
              </div>
              <div style={{textAlign:"right",flexShrink:0}}>
                <div style={{color,fontFamily:"'Space Mono',monospace",fontWeight:700,fontSize:15}}>{val}</div>
              </div>
            </div>;
          })}
        </Card>
        {sessions.length>0&&<Card style={{marginBottom:12}}>
          <div style={{color:"#888",fontSize:10,fontFamily:"'Space Mono',monospace",letterSpacing:2,marginBottom:11}}>PAST SESSIONS</div>
          {sessions.slice(0,6).map((s:any,i:number)=>{
            const d=new Date(s.created_at);
            const title=s.notes||`${d.toLocaleDateString('en-US',{month:'short',day:'numeric'})} · $${s.pot} pot`;
            return<div key={s.id} onClick={()=>onViewSession(s)} style={{display:"flex",alignItems:"center",gap:9,padding:"10px 0",borderBottom:i<Math.min(sessions.length,6)-1?"1px solid rgba(255,255,255,0.05)":"none",cursor:"pointer"}}>
              <div style={{width:32,textAlign:"center",flexShrink:0}}>
                <div style={{color:"#C9A84C",fontSize:13,fontFamily:"'Space Mono',monospace",fontWeight:700}}>{d.getDate()}</div>
                <div style={{color:"#555",fontSize:9,fontFamily:"'Space Mono',monospace"}}>{d.toLocaleDateString('en-US',{month:'short'})}</div>
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
                  <div style={{color:"#fff",fontSize:13,display:"flex",alignItems:"center",gap:5,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{title.length>28?title.slice(0,28)+"…":title}{s.locked&&<Icon name="lock" size={11} color="#666"/>}{s.edit_alert&&<Icon name="warning" size={11} color="#E05555"/>}</div>
                  {s.chicken_dinner_name&&<div style={{color:"#C9A84C",fontFamily:"'Playfair Display',serif",fontSize:14,fontWeight:700,flexShrink:0,whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:4}}><Icon name="drumstick" size={13} color="#C9A84C"/>{s.chicken_dinner_name}</div>}
                </div>
                <div style={{color:"#555",fontSize:10,fontFamily:"'Space Mono',monospace",marginTop:2}}>${s.pot} pot{s.buy_in_amount?` · $${s.buy_in_amount} buy-in`:""}</div>
              </div>
              <span style={{color:"#555",fontSize:16,flexShrink:0}}>›</span>
            </div>;
          })}
        </Card>}
        <button onClick={onViewSeasonArchive} style={{width:"100%",padding:"9px 0",marginBottom:9,background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:11,color:"#555",fontFamily:"'Space Mono',monospace",fontSize:10,letterSpacing:1.5,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}><Icon name="trophy" size={11} color="#555"/>SEASON ARCHIVE</button>
        <button onClick={onLeaveLeague} style={{width:"100%",padding:"10px 0",background:"rgba(224,85,85,0.05)",border:"1px solid rgba(224,85,85,0.12)",borderRadius:11,color:"#E05555",fontFamily:"'Space Mono',monospace",fontSize:10,letterSpacing:1.5,cursor:"pointer"}}>LEAVE LEAGUE</button>
      </div>
    </div>
  );
}

// ─── SEASON COUNTDOWN ───────────────────────────────────
function SeasonCountdown({league,isCommissioner,onEndSeason}:any){
  const [now,setNow]=useState(new Date());
  useEffect(()=>{const t=setInterval(()=>setNow(new Date()),60000);return()=>clearInterval(t);},[]);

  // Season = 91 days (quarterly). Use season_start_date if available, else created_at
  const SEASON_DAYS=91;
  const startRaw=league.season_start_date||league.created_at;
  const start=new Date(startRaw);
  const end=new Date(start.getTime()+SEASON_DAYS*24*60*60*1000);
  const msLeft=end.getTime()-now.getTime();
  const daysLeft=Math.max(0,Math.ceil(msLeft/(1000*60*60*24)));
  const pct=Math.min(100,Math.max(0,((now.getTime()-start.getTime())/(SEASON_DAYS*24*60*60*1000))*100));
  const seasonOver=msLeft<=0;
  const seasonNum=league.season_number||1;

  const seasonName=()=>{
    const m=start.getMonth();
    if(m<3)return`Winter ${start.getFullYear()}`;
    if(m<6)return`Spring ${start.getFullYear()}`;
    if(m<9)return`Summer ${start.getFullYear()}`;
    return`Fall ${start.getFullYear()}`;
  };

  return(
    <div style={{marginBottom:12,background:seasonOver?"rgba(224,85,85,0.06)":"rgba(201,168,76,0.04)",border:`1px solid ${seasonOver?"rgba(224,85,85,0.25)":"rgba(201,168,76,0.15)"}`,borderRadius:13,padding:"11px 14px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:7}}>
        <div>
          <div style={{color:"#888",fontSize:9,fontFamily:"'Space Mono',monospace",letterSpacing:2}}>SEASON {seasonNum} · {seasonName()}</div>
          <div style={{color:seasonOver?"#E05555":"#C9A84C",fontSize:13,fontFamily:"'Playfair Display',serif",fontWeight:700,marginTop:2}}>
            {seasonOver?"Season Complete":`${daysLeft} day${daysLeft!==1?"s":""} remaining`}
          </div>
        </div>
        {isCommissioner&&seasonOver&&(
          <button onClick={onEndSeason} style={{padding:"5px 12px",background:"rgba(201,168,76,0.15)",border:"1px solid rgba(201,168,76,0.3)",borderRadius:20,color:"#C9A84C",fontFamily:"'Space Mono',monospace",fontSize:9,cursor:"pointer",letterSpacing:1}}>END SEASON →</button>
        )}
      </div>
      {/* Progress bar */}
      <div style={{height:3,background:"rgba(255,255,255,0.05)",borderRadius:2,overflow:"hidden"}}>
        <div style={{height:"100%",width:`${pct}%`,background:seasonOver?"#E05555":"linear-gradient(90deg,#C9A84C,#E8C56A)",borderRadius:2,transition:"width 0.3s"}}/>
      </div>
    </div>
  );
}

// ─── SEASON ARCHIVE VIEW ─────────────────────────────────
function SeasonArchiveView({league,onBack,onViewArchive}:any){
  const [archives,setArchives]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{
    if(!db)return;
    db.from("season_archives").select("*").eq("league_id",league.id).order("season_number",{ascending:false}).then(({data})=>{setArchives(data||[]);setLoading(false);});
  },[league.id]);
  return(
    <div style={{padding:"20px 16px",maxWidth:500,margin:"0 auto"}}>
      <BackButton onBack={onBack}/>
      <SectionTitle text="Season Archive"/>
      {loading&&<div style={{display:"flex",justifyContent:"center",padding:32}}><Spinner/></div>}
      {!loading&&archives.length===0&&<Card><div style={{textAlign:"center" as const,padding:"20px 0",color:"#555",fontFamily:"'Space Mono',monospace",fontSize:11}}>No completed seasons yet.</div></Card>}
      {archives.map((a:any)=>(
        <Card key={a.id} style={{marginBottom:10,cursor:"pointer"}} onClick={()=>onViewArchive(a)}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{width:36,height:36,borderRadius:9,background:"rgba(201,168,76,0.1)",border:"1px solid rgba(201,168,76,0.2)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              <span style={{color:"#C9A84C",fontFamily:"'Space Mono',monospace",fontSize:11,fontWeight:700}}>S{a.season_number}</span>
            </div>
            <div style={{flex:1}}>
              <div style={{color:"#fff",fontSize:13,fontFamily:"'Playfair Display',serif"}}>{a.season_name||`Season ${a.season_number}`}</div>
              <div style={{color:"#555",fontSize:10,fontFamily:"'Space Mono',monospace",marginTop:2}}>
                {a.ended_at?new Date(a.ended_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}):""}
                {a.winner_name&&<span style={{color:"#C9A84C",marginLeft:8}}>🏆 {a.winner_name}</span>}
              </div>
            </div>
            <span style={{color:"#444",fontSize:17}}>›</span>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ─── ARCHIVED SEASON SESSIONS VIEW ───────────────────────
function ArchivedSeasonView({archive,league,onBack}:any){
  const snap=archive.snapshot||{};
  const players=(snap.players||[]).sort((a:any,b:any)=>b.total_profit-a.total_profit);
  const sessions=snap.sessions||[];
  return(
    <div style={{padding:"20px 16px",maxWidth:500,margin:"0 auto"}}>
      <BackButton onBack={onBack}/>
      <div style={{textAlign:"center" as const,marginBottom:18}}>
        <div style={{color:"#888",fontSize:9,fontFamily:"'Space Mono',monospace",letterSpacing:2,marginBottom:4}}>{league.name}</div>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:22,color:"#C9A84C"}}>{archive.season_name||`Season ${archive.season_number}`}</div>
        {archive.winner_name&&<div style={{color:"#4CAF8C",fontSize:12,fontFamily:"'Space Mono',monospace",marginTop:4}}>🏆 {archive.winner_name}</div>}
        <div style={{color:"#555",fontSize:10,fontFamily:"'Space Mono',monospace",marginTop:4}}>{sessions.length} sessions played</div>
      </div>
      {players.length>0&&<Card style={{marginBottom:12}}>
        <div style={{color:"#888",fontSize:10,fontFamily:"'Space Mono',monospace",letterSpacing:2,marginBottom:11}}>FINAL STANDINGS</div>
        {players.map((p:any,i:number)=>{
          const medal=["#C9A84C","#888","#A0714F"][i];
          return<div key={p.id||i} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:i<players.length-1?"1px solid rgba(255,255,255,0.05)":"none"}}>
            <div style={{width:22,flexShrink:0,textAlign:"center" as const}}>
              {i<3?<div style={{width:18,height:18,borderRadius:"50%",background:`${medal}22`,border:`1px solid ${medal}66`,display:"flex",alignItems:"center",justifyContent:"center",color:medal,fontSize:8,fontFamily:"'Space Mono',monospace",fontWeight:700,margin:"0 auto"}}>{i+1}</div>
              :<span style={{color:"#333",fontSize:10,fontFamily:"'Space Mono',monospace"}}>{i+1}</span>}
            </div>
            <Avatar name={p.name} size={30}/>
            <div style={{flex:1}}><div style={{color:"#fff",fontSize:12}}>{p.name}</div><div style={{color:"#555",fontSize:9,fontFamily:"'Space Mono',monospace"}}>{p.session_count}G · {p.wins}W</div></div>
            <div style={{color:p.total_profit>=0?"#4CAF8C":"#E05555",fontFamily:"'Space Mono',monospace",fontWeight:700,fontSize:12}}>{fmtProfit(p.total_profit)}</div>
          </div>;
        })}
      </Card>}
      {sessions.length>0&&<Card style={{marginBottom:12}}>
        <div style={{color:"#888",fontSize:10,fontFamily:"'Space Mono',monospace",letterSpacing:2,marginBottom:11}}>SESSIONS</div>
        {sessions.map((s:any,i:number)=>{
          const d=new Date(s.created_at);
          return<div key={s.id||i} style={{display:"flex",alignItems:"center",gap:9,padding:"9px 0",borderBottom:i<sessions.length-1?"1px solid rgba(255,255,255,0.05)":"none"}}>
            <div style={{width:32,textAlign:"center" as const,flexShrink:0}}>
              <div style={{color:"#C9A84C",fontSize:12,fontFamily:"'Space Mono',monospace",fontWeight:700}}>{d.getDate()}</div>
              <div style={{color:"#555",fontSize:9,fontFamily:"'Space Mono',monospace"}}>{d.toLocaleDateString('en-US',{month:'short'})}</div>
            </div>
            <div style={{flex:1}}>
              <div style={{color:"#fff",fontSize:12}}>{s.notes||`$${s.pot} pot`}</div>
              {s.chicken_dinner_name&&<div style={{color:"#C9A84C",fontSize:10,fontFamily:"'Space Mono',monospace"}}><Icon name="drumstick" size={9} color="#C9A84C"/> {s.chicken_dinner_name}</div>}
            </div>
            <div style={{color:"#555",fontSize:10,fontFamily:"'Space Mono',monospace"}}>${s.pot}</div>
          </div>;
        })}
      </Card>}
    </div>
  );
}
function SessionDetailView({session,league,players,profile,isCommissioner,onBack,onSaved,showToast,showError}:any){
  const [entries,setEntries]=useState<any[]>([]);
  const [sessionPosts,setSessionPosts]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [editing,setEditing]=useState(false);
  const [buyInAmount,setBuyInAmount]=useState(String(session.buy_in_amount||""));
  const [editedPot,setEditedPot]=useState(String(session.pot||""));
  const [notes,setNotes]=useState(session.notes||"");
  const [editedEntries,setEditedEntries]=useState<Record<string,{buy_in:string,rebuys:string,cash_out:string}>>({});
  const [saving,setSaving]=useState(false);
  const [isLocked,setIsLocked]=useState(!!session.locked);
  // Anyone can rename the session
  const [renamingTitle,setRenamingTitle]=useState(false);
  const [titleInput,setTitleInput]=useState(session.notes||"");

  // Add missing player state
  const [addingPlayer,setAddingPlayer]=useState(false);
  const [addingGuest,setAddingGuest]=useState(false);
  const [newPlayerName,setNewPlayerName]=useState("");
  const [newPlayerBuyIn,setNewPlayerBuyIn]=useState(String(session.buy_in_amount||league.buy_in||20));
  const [newPlayerRebuys,setNewPlayerRebuys]=useState("0");
  const [newPlayerCashOut,setNewPlayerCashOut]=useState("0");
  // Guest names stored per session in state (commissioner only, max 3)
  const [guestNames,setGuestNames]=useState<string[]>([]);
  const [editingGuestIdx,setEditingGuestIdx]=useState<number|null>(null);
  const [guestInput,setGuestInput]=useState("");

  const loadEntries=async()=>{
    if(!db)return;
    const[{data:eData},{data:pData}]=await Promise.all([
      db.from("session_entries").select("*, players(id,name,total_profit,wins,best_night,session_count,chicken_dinners,time_played_seconds)").eq("session_id",session.id),
      db.from("posts").select("*").eq("session_id",session.id).order("created_at",{ascending:true})
    ]);
    const e=eData||[];setEntries(e);setSessionPosts(pData||[]);
    const edited:Record<string,{buy_in:string,rebuys:string,cash_out:string}>={};
    e.forEach((en:any)=>{edited[en.id]={buy_in:String(en.buy_in||0),rebuys:String(en.rebuys||0),cash_out:String(en.cash_out||0)};});
    setEditedEntries(edited);setLoading(false);

    // Auto-lock if 24hrs since last unlock (or creation) and not already locked
    if(!session.locked){
      const anchor=session.locked_at?new Date(session.locked_at):new Date(session.created_at);
      const ageHrs=(Date.now()-anchor.getTime())/(1000*60*60);
      if(ageHrs>24){
        setIsLocked(true);
        await db.from("sessions").update({locked:true,locked_at:new Date().toISOString()}).eq("id",session.id);
      }
    }
  };
  useEffect(()=>{loadEntries();},[session.id]);

  // Profit = cash_out - buy_in - (rebuys * buy_in). Each rebuy costs buy_in amount.
  const getProfit=(id:string)=>{
    const e=editedEntries[id];if(!e)return 0;
    return Number(e.cash_out||0)-Number(e.buy_in||0)-Number(e.rebuys||0)*Number(e.buy_in||0);
  };

  const balance=entries.reduce((a,e)=>{
    const profit=editing?getProfit(e.id):(e.profit||0);
    return a+profit;
  },0);

  const handleSave=async()=>{
    if(!db)return;setSaving(true);
    try{
      // Auto: winner + chicken dinner = highest profit player
      const newProfits:Record<string,number>={};
      entries.forEach(e=>{newProfits[e.id]=getProfit(e.id);});
      const sorted=[...entries].sort((a,b)=>(newProfits[b.id]||0)-(newProfits[a.id]||0));
      const topPlayer=sorted[0]?.players?.name||session.winner_name||"";
      // Pot = sum of all buy-ins + rebuys (each rebuy costs buy_in amount)
      const newPot=Number(editedPot)||entries.reduce((a,e)=>{
        const bi=Number(editedEntries[e.id]?.buy_in||0);
        const rb=Number(editedEntries[e.id]?.rebuys||0);
        return a+bi+(rb*bi);
      },0);

      await db.from("sessions").update({
        winner_name:topPlayer,
        chicken_dinner_name:topPlayer||null,
        buy_in_amount:Number(buyInAmount)||null,
        notes:notes||null,
        pot:newPot,
        edit_alert:isCommissioner?null:{editor:profile.display_name,ts:new Date().toISOString(),summary:`Stats updated by ${profile.display_name}`},
      }).eq("id",session.id);

      for(const e of entries){
        const newProfit=newProfits[e.id];
        const newBuyIn=Number(editedEntries[e.id]?.buy_in||0);
        const newRebuys=Number(editedEntries[e.id]?.rebuys||0);
        const newCashOut=Number(editedEntries[e.id]?.cash_out||0);
        // Always write to session_entries - all authenticated users can edit
        await db.from("session_entries").update({buy_in:newBuyIn,rebuys:newRebuys,cash_out:newCashOut,profit:newProfit}).eq("id",e.id);
        // Only update player aggregate stats if commissioner — player stats are
        // recomputed from scratch when the session is locked anyway
        if(isCommissioner&&e.players){
          const p=e.players;
          const oldProfit=e.profit||0;const diff=newProfit-oldProfit;
          if(diff!==0){
            const oldWon=oldProfit>0?1:0;const newWon=newProfit>0?1:0;const winDiff=newWon-oldWon;
            let newBest=p.best_night||0;if(newProfit>newBest)newBest=newProfit;
            await db.from("players").update({total_profit:(p.total_profit||0)+diff,wins:Math.max(0,(p.wins||0)+winDiff),best_night:newBest}).eq("id",e.player_id);
          }
          const wasChicken=session.chicken_dinner_name?.toLowerCase()===p.name?.toLowerCase();
          const isChicken=topPlayer.toLowerCase()===p.name?.toLowerCase();
          if(wasChicken!==isChicken){const delta=isChicken?1:-1;await db.from("players").update({chicken_dinners:Math.max(0,(p.chicken_dinners||0)+delta)}).eq("id",e.player_id);}
        }
      }
      showToast("Session updated!");setSaving(false);setEditing(false);onSaved();loadEntries();
    }catch(err:any){showError(err.message||"Save failed");setSaving(false);}
  };

  const handleAddPlayer=async()=>{
    if(!db||!newPlayerName.trim())return;setSaving(true);
    const isGuest=newPlayerName.trim().startsWith("(guest)");
    try{
      const bi=Number(newPlayerBuyIn)||0;const rb=Number(newPlayerRebuys)||0;const co=Number(newPlayerCashOut)||0;
      const profit=co-bi-(rb*bi);
      if(isGuest){
        // Guest — insert with null player_id, name only, no profile/standings impact
        const guestName=newPlayerName.trim()==="(guest)"?`Guest`:newPlayerName.trim();
        await db.from("session_entries").insert({session_id:session.id,player_id:null,buy_in:bi,rebuys:rb,cash_out:co,profit,notes:`guest:${guestName}`});
      }else{
        const{data:playerRows}=await db.from("players").select("*").eq("league_id",league.id).ilike("name",newPlayerName.trim());
        let playerId=playerRows?.[0]?.id;
        if(!playerId){
          const{data:np}=await db.from("players").insert({league_id:league.id,name:newPlayerName.trim(),total_profit:0,session_count:0,wins:0,best_night:0,streak:0,chicken_dinners:0,time_played_seconds:0}).select().single();
          playerId=np?.id;
        }
        if(!playerId){showError("Couldn't find or create player.");setSaving(false);return;}
        await db.from("session_entries").insert({session_id:session.id,player_id:playerId,buy_in:bi,rebuys:rb,cash_out:co,profit});
        const p=playerRows?.[0]||{total_profit:0,session_count:0,wins:0,best_night:0,chicken_dinners:0};
        await db.from("players").update({total_profit:(p.total_profit||0)+profit,session_count:(p.session_count||0)+1,wins:(p.wins||0)+(profit>0?1:0),best_night:profit>(p.best_night||0)?profit:(p.best_night||0)}).eq("id",playerId);
      }
      const newPot=(session.pot||0)+bi+(rb*bi);
      await db.from("sessions").update({pot:newPot}).eq("id",session.id);
      setEditedPot(String(newPot));
      setNewPlayerName("");setNewPlayerBuyIn(String(session.buy_in_amount||league.buy_in||20));setNewPlayerRebuys("0");setNewPlayerCashOut("0");
      setAddingPlayer(false);showToast(`${isGuest?"Guest":"Player"} added!`);onSaved();loadEntries();
    }catch(err:any){showError(err.message||"Failed to add player");}
    setSaving(false);
  };

  const handleRemovePlayer=async(entry:any)=>{
    if(!db)return;
    const name=entry.players?.name||"this player";
    if(!window.confirm(`Remove ${name} from this session?`))return;
    setSaving(true);
    try{
      const profit=entry.profit||0;
      if(entry.players){
        const p=entry.players;
        const wasWin=profit>0?1:0;
        await db.from("players").update({
          total_profit:(p.total_profit||0)-profit,
          session_count:Math.max(0,(p.session_count||0)-1),
          wins:Math.max(0,(p.wins||0)-wasWin),
        }).eq("id",entry.player_id);
        if(session.chicken_dinner_name?.toLowerCase()===p.name.toLowerCase()){
          await db.from("sessions").update({chicken_dinner_name:null,winner_name:null}).eq("id",session.id);
          await db.from("players").update({chicken_dinners:Math.max(0,(p.chicken_dinners||0)-1)}).eq("id",entry.player_id);
        }
      }
      await db.from("session_entries").delete().eq("id",entry.id);
      const newPot=Math.max(0,(session.pot||0)-(entry.buy_in||0));
      await db.from("sessions").update({pot:newPot}).eq("id",session.id);
      showToast(`${name} removed from session.`);onSaved();loadEntries();
    }catch(err:any){showError(err.message||"Failed to remove");}
    setSaving(false);
  };

  const handleToggleLock=async()=>{
    if(!db)return;
    const newLocked=!isLocked;

    if(newLocked){
      // Recompute stats from scratch for all players in this session
      // This prevents drift from multiple lock/unlock cycles
      const{data:sessionRow}=await db.from("sessions").select("stats_committed,duration_seconds,chicken_dinner_name").eq("id",session.id).single();
      const elapsed=sessionRow?.duration_seconds||0;
      const chickenDinner=(sessionRow?.chicken_dinner_name||"").toLowerCase();

      const{data:freshEntries}=await db.from("session_entries")
        .select("*, players(id,name)")
        .eq("session_id",session.id);

      for(const e of (freshEntries||[])){
        const playerName=e.players?.name||"";
        if(!playerName)continue;

        // Fetch ALL committed session entries for this player (excluding current session)
        const{data:allEntries}=await db.from("session_entries").select(`
          profit, rebuys, buy_in,
          sessions!inner(duration_seconds, chicken_dinner_name, stats_committed, id)
        `).eq("player_id",e.player_id);

        // Include only locked+committed sessions (excluding current which we're about to commit)
        const otherCommitted=(allEntries||[]).filter((ae:any)=>
          ae.sessions?.stats_committed===true && ae.sessions?.id!==session.id
        );

        // Compute totals from other committed sessions
        let tp=0,sc=0,wins=0,bestN=0,worstN=0,cds=0,timeSec=0,totalRebuys=0;
        for(const ae of otherCommitted){
          tp+=ae.profit||0;
          sc+=1;
          if((ae.profit||0)>0)wins+=1;
          if((ae.profit||0)>(bestN))bestN=ae.profit||0;
          if((ae.profit||0)<worstN)worstN=ae.profit||0;
          if((ae.sessions?.chicken_dinner_name||"").toLowerCase()===playerName.toLowerCase())cds+=1;
          timeSec+=ae.sessions?.duration_seconds||0;
          totalRebuys+=ae.rebuys||0;
        }

        // Add this session
        const thisProfit=e.profit||0;
        tp+=thisProfit;sc+=1;
        if(thisProfit>0)wins+=1;
        if(thisProfit>bestN)bestN=thisProfit;
        if(thisProfit<worstN)worstN=thisProfit;
        if(chickenDinner===playerName.toLowerCase())cds+=1;
        timeSec+=elapsed;
        totalRebuys+=e.rebuys||0;

        // Compute streak separately (needs ordering)
        const{data:streakData}=await db.from("session_entries").select(`
          profit,
          sessions!inner(created_at,stats_committed,id)
        `).eq("player_id",e.player_id).order("sessions(created_at)",{ascending:false});
        let streak=0;
        for(const sd of (streakData||[])){
          if(!sd.sessions?.stats_committed&&sd.sessions?.id!==session.id)continue;
          if(sd.sessions?.id===session.id&&thisProfit<=0)break;
          if((sd.profit||0)>0)streak++;else break;
        }

        await db.from("players").update({
          total_profit:tp,session_count:sc,wins,
          best_night:bestN,worst_night:worstN,streak,
          chicken_dinners:cds,time_played_seconds:timeSec,
        }).eq("id",e.player_id);

        // Update profile global stats
        const{data:profRow}=await db.from("profiles").select("id,opt_in_global,archived_profit,archived_sessions,archived_wins,archived_time_seconds,archived_chicken_dinners,archived_rebuys").ilike("display_name",playerName).maybeSingle();
        if(profRow){
          const arch={profit:profRow.archived_profit||0,sessions:profRow.archived_sessions||0,wins:profRow.archived_wins||0,time:profRow.archived_time_seconds||0,cds:profRow.archived_chicken_dinners||0,rebuys:profRow.archived_rebuys||0};
          const upd:any={
            global_time_seconds:timeSec+arch.time,
            total_rebuys:totalRebuys+arch.rebuys,
          };
          if(profRow.opt_in_global){
            upd.global_total_profit=tp+arch.profit;
            upd.global_sessions=sc+arch.sessions;
            upd.global_wins=wins+arch.wins;
            upd.chicken_dinners=cds+arch.cds;
          }
          await db.from("profiles").update(upd).eq("id",profRow.id);
        }
      }

      await db.from("sessions").update({locked:true,locked_at:new Date().toISOString(),edit_alert:null,stats_committed:true}).eq("id",session.id);
      setIsLocked(true);
      showToast("Session locked — stats committed to profiles");
    }else{
      // Unlock: mark as not committed so re-lock will recompute
      await db.from("sessions").update({locked:false,locked_at:new Date().toISOString(),edit_alert:null,stats_committed:false}).eq("id",session.id);
      setIsLocked(false);
      showToast("Session unlocked — stats rolled back, edits are safe");
    }
    onSaved();
  };

  const handleDismissAlert=async()=>{
    if(!db)return;
    await db.from("sessions").update({edit_alert:null}).eq("id",session.id);
    onSaved();loadEntries();
  };

  const handleSaveTitle=async()=>{
    if(!db)return;setSaving(true);
    await db.from("sessions").update({notes:titleInput.trim()||null}).eq("id",session.id);
    setRenamingTitle(false);setSaving(false);showToast("Session renamed!");onSaved();
  };

  const canEdit=!isLocked||(isLocked&&isCommissioner);
  const d=new Date(session.created_at);
  const alreadyInSession=new Set(entries.map((e:any)=>e.players?.name?.toLowerCase()));
  const missingPlayers=players.filter((p:any)=>!alreadyInSession.has(p.name.toLowerCase()));
  // Lock countdown — 24hrs since last unlock (or creation)
  const lockAnchor=session.locked_at?new Date(session.locked_at):new Date(session.created_at);
  const ageInHours=(Date.now()-lockAnchor.getTime())/(1000*60*60);
  const hoursUntilLock=Math.max(0,Math.ceil(24-ageInHours));
  const showLockCountdown=!isLocked&&hoursUntilLock<=24;

  return(
    <div style={{padding:"20px 16px",maxWidth:500,margin:"0 auto"}}>
      <BackButton onBack={onBack}/>

      {/* Edit alert banner for commissioner */}
      {isCommissioner&&session.edit_alert&&<div style={{background:"rgba(224,85,85,0.1)",border:"1px solid rgba(224,85,85,0.35)",borderRadius:11,padding:"10px 14px",marginBottom:12,display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
        <div><div style={{color:"#E05555",fontFamily:"'Space Mono',monospace",fontSize:10,letterSpacing:1,marginBottom:2,display:"flex",alignItems:"center",gap:5}}><Icon name="warning" size={12} color="#E05555"/> STATS WERE EDITED</div><div style={{color:"#aaa",fontSize:11}}>{session.edit_alert.summary||`Updated by ${session.edit_alert.editor}`}</div></div>
        <button onClick={handleDismissAlert} style={{padding:"3px 9px",background:"rgba(224,85,85,0.15)",border:"1px solid rgba(224,85,85,0.3)",borderRadius:20,color:"#E05555",fontFamily:"'Space Mono',monospace",fontSize:9,cursor:"pointer",flexShrink:0}}>DISMISS</button>
      </div>}

      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
        <div style={{flex:1,minWidth:0,marginRight:10}}>
          {renamingTitle
            ?<div style={{display:"flex",gap:7,alignItems:"center"}}>
              <input value={titleInput} onChange={e=>setTitleInput(e.target.value)} placeholder="Name this session..." style={{...inp,fontSize:14,flex:1,padding:"7px 11px"}} autoFocus/>
              <button onClick={handleSaveTitle} disabled={saving} style={{padding:"7px 12px",background:"rgba(201,168,76,0.15)",border:"1px solid rgba(201,168,76,0.3)",borderRadius:9,color:"#C9A84C",fontFamily:"'Space Mono',monospace",fontSize:10,cursor:"pointer",flexShrink:0}}>{saving?"...":"✓"}</button>
              <button onClick={()=>setRenamingTitle(false)} style={{padding:"7px 10px",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:9,color:"#555",fontFamily:"'Space Mono',monospace",fontSize:10,cursor:"pointer",flexShrink:0}}>✕</button>
            </div>
            :<div style={{display:"flex",alignItems:"baseline",gap:9,flexWrap:"wrap"}}>
              <div style={{color:"#555",fontSize:10,fontFamily:"'Space Mono',monospace",letterSpacing:1,flexShrink:0}}>{d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}{showLockCountdown&&<span style={{color:"#333",marginLeft:7}}>{hoursUntilLock===0?"locks soon":`locks in ${hoursUntilLock}h`}</span>}</div>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <div style={{fontFamily:"'Playfair Display',serif",fontSize:20,color:"#fff"}}>{session.notes||"Session Results"}</div>
                <button onClick={()=>{setTitleInput(session.notes||"");setRenamingTitle(true);}} style={{background:"none",border:"none",color:"#333",fontSize:11,cursor:"pointer",padding:"2px 4px",fontFamily:"'Space Mono',monospace"}}>✏</button>
              </div>
            </div>}
        </div>
        <div style={{display:"flex",gap:7,flexShrink:0}}>
          {isCommissioner&&<button onClick={handleToggleLock} style={{padding:"6px 11px",background:isLocked?"rgba(201,168,76,0.1)":"rgba(255,255,255,0.05)",border:`1px solid ${isLocked?"rgba(201,168,76,0.3)":"rgba(255,255,255,0.1)"}`,borderRadius:20,color:isLocked?"#C9A84C":"#666",fontFamily:"'Space Mono',monospace",fontSize:9,cursor:"pointer",display:"flex",alignItems:"center",gap:5}}><Icon name={isLocked?"unlock":"lock"} size={12} color={isLocked?"#C9A84C":"#666"}/>{isLocked?"UNLOCK":"LOCK"}</button>}
          {canEdit&&<button onClick={()=>setEditing(!editing)} style={{padding:"6px 13px",background:editing?"rgba(201,168,76,0.15)":"rgba(255,255,255,0.06)",border:`1px solid ${editing?"rgba(201,168,76,0.3)":"rgba(255,255,255,0.1)"}`,borderRadius:20,color:editing?"#C9A84C":"#888",fontFamily:"'Space Mono',monospace",fontSize:10,cursor:"pointer"}}>{editing?"CANCEL":"EDIT"}</button>}
        </div>
      </div>

      <Card style={{marginBottom:12}}>
        <div style={{display:"flex",gap:12}}>
          <div style={{flex:1,textAlign:"center"}}>
            <div style={{color:"#555",fontSize:9,fontFamily:"'Space Mono',monospace",letterSpacing:2}}>POT</div>
            {editing
              ?<input type="number" value={editedPot} onChange={e=>setEditedPot(e.target.value)} style={{...inp,textAlign:"center" as const,fontSize:20,color:"#C9A84C",marginTop:4}}/>
              :<div style={{color:"#C9A84C",fontSize:24,fontFamily:"'Space Mono',monospace",fontWeight:700,marginTop:2}}>
                ${entries.length>0
                  ? entries.reduce((a:number,e:any)=>(a+(e.buy_in||0)*(1+(e.rebuys||0))),0)
                  : (session.pot||0)}
              </div>}
          </div>
          <div style={{flex:1,textAlign:"center"}}>
            <div style={{color:"#555",fontSize:9,fontFamily:"'Space Mono',monospace",letterSpacing:2}}>BUY-IN</div>
            {editing?<input type="number" value={buyInAmount} onChange={e=>setBuyInAmount(e.target.value)} style={{...inp,textAlign:"center" as const,fontSize:20,marginTop:4}}/>:<div style={{color:"#888",fontSize:24,fontFamily:"'Space Mono',monospace",fontWeight:700,marginTop:2}}>${session.buy_in_amount||league.buy_in}</div>}
          </div>
        </div>
        {session.notes&&!editing&&<div style={{marginTop:10,paddingTop:10,borderTop:"1px solid rgba(255,255,255,0.05)",color:"#666",fontSize:12,fontStyle:"italic"}}>"{session.notes}"</div>}
        {editing&&<div style={{marginTop:10}}><label style={{color:"#888",fontSize:10,fontFamily:"'Space Mono',monospace",marginBottom:5,display:"block"}}>SESSION NOTES</label><input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="e.g. Played at Nick's — wild night" style={inp}/></div>}
      </Card>

      <Card style={{marginBottom:12}}>
        <div style={{color:"#888",fontSize:10,fontFamily:"'Space Mono',monospace",letterSpacing:2,marginBottom:11}}>RESULTS</div>
        {loading&&<div style={{display:"flex",justifyContent:"center",padding:16}}><Spinner/></div>}
        {[...entries].sort((a:any,b:any)=>(editing?getProfit(b.id)-getProfit(a.id):(b.profit||0)-(a.profit||0))).map((e:any,i:number)=>{
          const name=e.players?.name||"Unknown";
          const profit=editing?getProfit(e.id):(e.profit||0);
          const ee=editedEntries[e.id]||{buy_in:String(e.buy_in||0),rebuys:String(e.rebuys||0),cash_out:String(e.cash_out||0)};
          return<div key={e.id} style={{padding:"9px 0",borderBottom:i<entries.length-1?"1px solid rgba(255,255,255,0.05)":"none"}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:editing?7:0}}>
              <Avatar name={name} size={34} streak={e.players?.streak||0}/>
              <div style={{flex:1}}>
                <div style={{color:"#fff",fontSize:13}}>{name}</div>
                {!editing&&<div style={{color:"#555",fontSize:10,fontFamily:"'Space Mono',monospace"}}>in: ${(e.buy_in||0)*(1+(e.rebuys||0))} · rebuys: {e.rebuys||0} · out: ${e.cash_out||0}</div>}
              </div>
              <div style={{color:profit>=0?"#4CAF8C":"#E05555",fontFamily:"'Space Mono',monospace",fontWeight:700,fontSize:13}}>{fmtProfit(profit)}</div>
              {editing&&isCommissioner&&<button onClick={()=>handleRemovePlayer(e)} style={{marginLeft:4,padding:"3px 7px",background:"rgba(224,85,85,0.1)",border:"1px solid rgba(224,85,85,0.25)",borderRadius:20,color:"#E05555",fontFamily:"'Space Mono',monospace",fontSize:9,cursor:"pointer",flexShrink:0}}>✕</button>}
            </div>
            {editing&&<div style={{display:"flex",gap:6,marginLeft:44}}>
              <div style={{flex:1}}><div style={{color:"#666",fontSize:9,fontFamily:"'Space Mono',monospace",marginBottom:3}}>BUY-IN ($)</div><input type="number" value={ee.buy_in} onChange={ev=>setEditedEntries(p=>({...p,[e.id]:{...ee,buy_in:ev.target.value}}))} style={{...inp,padding:"6px 8px",fontSize:12,textAlign:"center" as const}}/></div>
              <div style={{flex:1}}><div style={{color:"#666",fontSize:9,fontFamily:"'Space Mono',monospace",marginBottom:3}}>REBUYS (#)</div><input type="number" value={ee.rebuys} onChange={ev=>setEditedEntries(p=>({...p,[e.id]:{...ee,rebuys:ev.target.value}}))} style={{...inp,padding:"6px 8px",fontSize:12,textAlign:"center" as const}}/></div>
              <div style={{flex:1}}><div style={{color:"#666",fontSize:9,fontFamily:"'Space Mono',monospace",marginBottom:3}}>CASH-OUT ($)</div><input type="number" value={ee.cash_out} onChange={ev=>setEditedEntries(p=>({...p,[e.id]:{...ee,cash_out:ev.target.value}}))} style={{...inp,padding:"6px 8px",fontSize:12,textAlign:"center" as const}}/></div>
            </div>}
          </div>;
        })}

        {guestNames.map((g,i)=>(
          <div key={`guest-${i}`} style={{padding:"9px 0",borderTop:"1px solid rgba(255,255,255,0.05)",display:"flex",alignItems:"center",gap:10}}>
            <Avatar name={g} size={34}/>
            <div style={{flex:1}}>
              <div style={{color:"#777",fontSize:13}}>{g} <span style={{color:"#5577CC",fontSize:10,fontFamily:"'Space Mono',monospace"}}>(guest)</span></div>
              <div style={{color:"#444",fontSize:9,fontFamily:"'Space Mono',monospace"}}>not tracked in standings</div>
            </div>
          </div>
        ))}

        {/* Balance calculator */}
        {entries.length>0&&<div style={{marginTop:9,paddingTop:9,borderTop:"1px solid rgba(255,255,255,0.05)",display:"flex",justifyContent:"flex-end",alignItems:"center",gap:6}}>
          <span style={{color:"#444",fontFamily:"'Space Mono',monospace",fontSize:9}}>BALANCE:</span>
          {balance===0
            ?<span style={{color:"#4CAF8C",fontFamily:"'Space Mono',monospace",fontSize:10}}>✓ balanced</span>
            :<span style={{color:balance>0?"#E8C56A":"#E05555",fontFamily:"'Space Mono',monospace",fontSize:10}}>off by {balance>0?"+":""}${balance}</span>}
        </div>}

        {/* Add missing player */}
        {isCommissioner&&!isLocked&&!addingPlayer&&<div style={{display:"flex",gap:7,marginTop:11}}>
          <button onClick={()=>setAddingPlayer(true)} style={{flex:1,padding:"8px 0",background:"rgba(85,119,204,0.1)",border:"1px solid rgba(85,119,204,0.25)",borderRadius:9,color:"#5577CC",fontFamily:"'Space Mono',monospace",fontSize:10,letterSpacing:1.5,cursor:"pointer"}}>+ ADD PLAYER</button>
          <button onClick={()=>{setNewPlayerName("(guest)");setAddingPlayer(true);}} style={{flex:1,padding:"8px 0",background:"rgba(85,119,204,0.05)",border:"1px dashed rgba(85,119,204,0.2)",borderRadius:9,color:"#5577CC",fontFamily:"'Space Mono',monospace",fontSize:10,letterSpacing:1.5,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:5}}><Icon name="person" size={11} color="#5577CC"/>+ GUEST</button>
        </div>}
        {isCommissioner&&!isLocked&&addingPlayer&&<div style={{marginTop:11,paddingTop:11,borderTop:"1px solid rgba(255,255,255,0.05)"}}>
          <div style={{color:"#5577CC",fontSize:10,fontFamily:"'Space Mono',monospace",letterSpacing:2,marginBottom:10}}>ADD PLAYER TO THIS SESSION</div>
          <div style={{marginBottom:8}}>
            <label style={{color:"#888",fontSize:10,fontFamily:"'Space Mono',monospace",marginBottom:5,display:"block"}}>PLAYER NAME</label>
            {missingPlayers.length>0&&<select value={newPlayerName} onChange={e=>setNewPlayerName(e.target.value)} style={{...inp,fontSize:13,marginBottom:6}}><option value="">-- select league member --</option>{missingPlayers.map((p:any)=><option key={p.id} value={p.name}>{p.name}</option>)}</select>}
            <input value={newPlayerName} onChange={e=>setNewPlayerName(e.target.value)} placeholder="Or type a name manually" style={{...inp,fontSize:13}}/>
          </div>
          <div style={{display:"flex",gap:8,marginBottom:10}}>
            <div style={{flex:1}}><label style={{color:"#888",fontSize:9,fontFamily:"'Space Mono',monospace",marginBottom:4,display:"block"}}>BUY-IN ($)</label><input type="number" value={newPlayerBuyIn} onChange={e=>setNewPlayerBuyIn(e.target.value)} style={{...inp,padding:"8px 10px",fontSize:13}}/></div>
            <div style={{flex:1}}><label style={{color:"#888",fontSize:9,fontFamily:"'Space Mono',monospace",marginBottom:4,display:"block"}}>REBUYS ($)</label><input type="number" value={newPlayerRebuys} onChange={e=>setNewPlayerRebuys(e.target.value)} style={{...inp,padding:"8px 10px",fontSize:13}}/></div>
            <div style={{flex:1}}><label style={{color:"#888",fontSize:9,fontFamily:"'Space Mono',monospace",marginBottom:4,display:"block"}}>CASH-OUT ($)</label><input type="number" value={newPlayerCashOut} onChange={e=>setNewPlayerCashOut(e.target.value)} style={{...inp,padding:"8px 10px",fontSize:13}}/></div>
          </div>
          <div style={{color:"#555",fontSize:10,fontFamily:"'Space Mono',monospace",marginBottom:10}}>Profit: <span style={{color:Number(newPlayerCashOut)-(Number(newPlayerBuyIn)*(1+Number(newPlayerRebuys)))>=0?"#4CAF8C":"#E05555",fontWeight:700}}>{fmtProfit(Number(newPlayerCashOut)-(Number(newPlayerBuyIn)*(1+Number(newPlayerRebuys))))}</span></div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>{setAddingPlayer(false);setNewPlayerName("");}} style={{flex:1,padding:"9px 0",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:9,color:"#888",fontFamily:"'Space Mono',monospace",fontSize:11,cursor:"pointer"}}>CANCEL</button>
            <button onClick={handleAddPlayer} disabled={saving||!newPlayerName.trim()} style={{flex:2,padding:"9px 0",background:newPlayerName.trim()&&!saving?"rgba(85,119,204,0.2)":"rgba(255,255,255,0.05)",border:`1px solid ${newPlayerName.trim()?"rgba(85,119,204,0.4)":"rgba(255,255,255,0.1)"}`,borderRadius:9,color:newPlayerName.trim()?"#5577CC":"#555",fontFamily:"'Space Mono',monospace",fontWeight:700,fontSize:11,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:7}}>{saving?<Spinner size={13}/>:"ADD TO SESSION →"}</button>
          </div>
        </div>}
      </Card>

      {/* Awards */}
      <Card style={{marginBottom:12,textAlign:"center" as const}}>
        <div style={{color:"#888",fontSize:9,fontFamily:"'Space Mono',monospace",letterSpacing:3,marginBottom:6,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}><Icon name="drumstick" size={11} color="#888"/> WINNER WINNER CHICKEN DINNER</div>
        <div style={{color:"#C9A84C",fontSize:22,fontFamily:"'Playfair Display',serif",fontWeight:700}}>{session.chicken_dinner_name||"—"}</div>
        {editing&&<div style={{color:"#444",fontSize:9,marginTop:4,fontFamily:"'Space Mono',monospace"}}>Auto-assigned to highest profit on save</div>}
      </Card>

      {isLocked
        ?<div style={{background:"rgba(76,175,140,0.06)",border:"1px solid rgba(76,175,140,0.2)",borderRadius:11,padding:"9px 14px",marginBottom:12,display:"flex",alignItems:"center",gap:8}}>
          <Icon name="lock" size={13} color="#4CAF8C"/>
          <span style={{color:"#4CAF8C",fontFamily:"'Space Mono',monospace",fontSize:10}}>Stats locked and committed to player profiles</span>
        </div>
        :<div style={{background:"rgba(201,168,76,0.04)",border:"1px solid rgba(201,168,76,0.12)",borderRadius:11,padding:"9px 14px",marginBottom:12,display:"flex",alignItems:"center",gap:8}}>
          <Icon name="hourglass" size={13} color="#666"/>
          <span style={{color:"#666",fontFamily:"'Space Mono',monospace",fontSize:10}}>{isCommissioner?"Lock this session to commit stats to player profiles":"Pending — commissioner must lock to commit stats"}</span>
        </div>}

      {editing&&canEdit&&<button onClick={handleSave} disabled={saving} style={{width:"100%",padding:"12px 0",background:saving?"rgba(255,255,255,0.08)":"linear-gradient(135deg,#C9A84C,#E8C56A)",border:"none",borderRadius:11,color:saving?"#444":"#0A0A0A",fontFamily:"'Space Mono',monospace",fontWeight:700,fontSize:13,letterSpacing:2,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:10,marginBottom:12}}>{saving?<><Spinner size={14}/> SAVING...</>:"SAVE CHANGES ✓"}</button>}

      {/* Session posts */}
      {sessionPosts.length>0&&<Card>
        <div style={{color:"#888",fontSize:10,fontFamily:"'Space Mono',monospace",letterSpacing:2,marginBottom:11}}>FROM THIS NIGHT</div>
        {sessionPosts.map((post:any,i:number)=><div key={post.id} style={{paddingBottom:i<sessionPosts.length-1?11:0,marginBottom:i<sessionPosts.length-1?11:0,borderBottom:i<sessionPosts.length-1?"1px solid rgba(255,255,255,0.05)":"none"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}><Avatar name={post.author_name} size={24}/><span style={{color:"#fff",fontSize:12}}>{post.author_name}</span><span style={{color:"#555",fontSize:9,fontFamily:"'Space Mono',monospace",marginLeft:"auto"}}>{new Date(post.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric'})}</span></div>
          {post.content&&<div style={{color:"#bbb",fontSize:12,lineHeight:1.5,marginBottom:post.media_url?7:0}}>{post.content}</div>}
          {post.media_url&&(post.media_type==="video"?<video src={post.media_url} controls style={{width:"100%",borderRadius:9,maxHeight:240}}/>:<img src={post.media_url} style={{width:"100%",borderRadius:9,maxHeight:240,objectFit:"cover"}}/>)}
        </div>)}
      </Card>}
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
  const totalPot=liveEntries.reduce((a:number,e:any)=>a+(e.buy_in||0),0);
  const handleSubmit=async()=>{if(!myPlayer)return;setSaving(true);await onSubmitEntry({player_id:myPlayer.id,player_name:profile.display_name,buy_in:myBuyIn,rebuys:myRebuys,cash_out:myCashOut});setSaving(false);};
  const handleEnd=async()=>{
    setSaving(true);
    const finalCashOuts:Record<string,number>={};
    liveEntries.forEach((e:any)=>{finalCashOuts[e.player_id]=isCommissioner?(cashOuts[e.player_id]!==undefined?cashOuts[e.player_id]:(e.cash_out||0)):(e.cash_out||0);});
    const entries=liveEntries.map((e:any)=>({
      player_id:e.player_id,
      player_name:e.player_name,
      buy_in:e.buy_in||0,
      rebuys:e.rebuys||0,
      cash_out:finalCashOuts[e.player_id],
      // Profit = cash_out - buy_in - (rebuys * buy_in)
      profit:finalCashOuts[e.player_id]-(e.buy_in||0)-(e.rebuys||0)*(e.buy_in||0),
    }));
    // Auto chicken dinner = highest profit
    const top=[...entries].sort((a,b)=>b.profit-a.profit)[0];
    const autoChicken=top?.player_name||"";
    await onEndSession({entries,elapsed,chickenDinner:autoChicken});
    setSaving(false);
  };
  const notInSession=players.filter((p:any)=>!liveEntries.some((e:any)=>e.player_id===p.id));
  const ni:any={background:"rgba(255,255,255,0.05)",border:"1px solid rgba(201,168,76,0.25)",borderRadius:8,padding:"7px 9px",color:"#fff",fontSize:13,fontFamily:"'Space Mono',monospace",outline:"none",textAlign:"center",boxSizing:"border-box"};
  return(
    <div style={{padding:"16px 16px",maxWidth:500,margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"center",gap:11,marginBottom:12}}><button onClick={onBack} style={{background:"none",border:"none",color:"#555",fontSize:22,cursor:"pointer"}}>←</button><div style={{flex:1}}><div style={{color:"#4CAF8C",fontSize:10,fontFamily:"'Space Mono',monospace",letterSpacing:2}}>● GAME IS LIVE</div><div style={{fontFamily:"'Playfair Display',serif",fontSize:19,color:"#fff"}}>{league.name}</div></div></div>
      <div style={{display:"flex",gap:9,marginBottom:12}}>
        <div style={{flex:1,background:"rgba(76,175,140,0.1)",border:"1px solid rgba(76,175,140,0.3)",borderRadius:13,padding:"12px 13px",textAlign:"center"}}><div style={{color:"#555",fontSize:9,fontFamily:"'Space Mono',monospace",letterSpacing:2}}>TIME</div><div style={{color:"#4CAF8C",fontSize:24,fontFamily:"'Space Mono',monospace",fontWeight:700,marginTop:2}}>{fmt(elapsed)}</div></div>
        <div style={{flex:1,background:"rgba(201,168,76,0.08)",border:"1px solid rgba(201,168,76,0.2)",borderRadius:13,padding:"12px 13px",textAlign:"center"}}><div style={{color:"#555",fontSize:9,fontFamily:"'Space Mono',monospace",letterSpacing:2}}>POT</div><div style={{color:"#C9A84C",fontSize:24,fontFamily:"'Space Mono',monospace",fontWeight:700,marginTop:2}}>${totalPot}</div></div>
      </div>
      {myPlayer&&<Card style={{marginBottom:12,border:"1px solid rgba(201,168,76,0.3)",background:"rgba(201,168,76,0.04)"}}>
        <div style={{color:"#C9A84C",fontSize:10,fontFamily:"'Space Mono',monospace",letterSpacing:2,marginBottom:11}}>YOUR STATS {inSession&&<span style={{color:"#4CAF8C",fontSize:9}}>✓ submitted</span>}</div>
        <div style={{display:"flex",gap:9,marginBottom:11}}>
          <div style={{flex:1}}><div style={{color:"#888",fontSize:9,fontFamily:"'Space Mono',monospace",marginBottom:4}}>BUY-IN ($)</div><input type="number" value={myBuyIn||""} onChange={e=>setMyBuyIn(Number(e.target.value))} style={{...ni,width:"100%"}}/></div>
          <div style={{flex:1}}><div style={{color:"#888",fontSize:9,fontFamily:"'Space Mono',monospace",marginBottom:4}}>REBUYS ($)</div><input type="number" value={myRebuys||""} onChange={e=>setMyRebuys(Number(e.target.value))} style={{...ni,width:"100%"}}/></div>
          <div style={{flex:1}}><div style={{color:"#888",fontSize:9,fontFamily:"'Space Mono',monospace",marginBottom:4}}>CASH-OUT ($)</div><input type="number" value={myCashOut||""} onChange={e=>setMyCashOut(Number(e.target.value))} style={{...ni,width:"100%"}}/></div>
        </div>
        <div style={{color:"#555",fontSize:10,fontFamily:"'Space Mono',monospace",marginBottom:9}}>Profit: <span style={{color:myCashOut-myBuyIn-(myRebuys*myBuyIn)>=0?"#4CAF8C":"#E05555",fontWeight:700}}>{fmtProfit(myCashOut-myBuyIn-(myRebuys*myBuyIn))}</span></div>
        <button onClick={handleSubmit} disabled={saving} style={{width:"100%",padding:"9px 0",background:"rgba(201,168,76,0.15)",border:"1px solid rgba(201,168,76,0.3)",borderRadius:9,color:"#C9A84C",fontFamily:"'Space Mono',monospace",fontSize:11,letterSpacing:1.5,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:7}}>{saving?<Spinner size={13}/>:inSession?"UPDATE MY STATS ✓":"JOIN & SUBMIT STATS →"}</button>
      </Card>}
      <Card style={{marginBottom:12}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:11}}>
          <div style={{color:"#888",fontSize:10,fontFamily:"'Space Mono',monospace",letterSpacing:2}}>IN SESSION ({liveEntries.length})</div>
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
        <div style={{marginTop:9,padding:"9px 12px",background:"rgba(201,168,76,0.06)",border:"1px solid rgba(201,168,76,0.15)",borderRadius:9}}>
          <div style={{color:"#666",fontFamily:"'Space Mono',monospace",fontSize:9,display:"flex",alignItems:"center",gap:4}}><Icon name="drumstick" size={10} color="#666"/>Chicken dinner auto-assigned to highest profit on save</div>
        </div>
        <button onClick={handleEnd} disabled={saving} style={{width:"100%",marginTop:13,padding:"11px 0",background:saving?"rgba(255,255,255,0.08)":"linear-gradient(135deg,#C9A84C,#E8C56A)",border:"none",borderRadius:9,color:saving?"#444":"#0A0A0A",fontFamily:"'Space Mono',monospace",fontWeight:700,fontSize:12,letterSpacing:2,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:9}}>{saving?<><Spinner size={14}/> SAVING...</>:"APPROVE & SAVE SESSION ✓"}</button>
      </Card>}</>}
      {!isCommissioner&&<div style={{padding:"11px 13px",background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.05)",borderRadius:11,color:"#444",fontFamily:"'Space Mono',monospace",fontSize:10,textAlign:"center" as const,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}><Icon name="crown" size={12} color="#444"/>Commissioner will finalize the session</div>}
    </div>
  );
}

// ─── NEW SESSION ───────────────────────────────────────
function NewSessionView({league,players,sessions,onStart,onBack}:any){
  const [sessionBuyIn,setSessionBuyIn]=useState(league.buy_in);const [selectedIds,setSelectedIds]=useState<string[]>([]);const [loading,setLoading]=useState(false);
  const [sessionNotes,setSessionNotes]=useState("");
  const [guestNames,setGuestNames]=useState<string[]>([]);
  const [addingGuest,setAddingGuest]=useState(false);
  const [guestInput,setGuestInput]=useState("");
  const lastSession=sessions?.[0];
  const [lastPlayerIds,setLastPlayerIds]=useState<string[]>([]);
  useEffect(()=>{
    if(!db||!lastSession)return;
    db.from("session_entries").select("player_id").eq("session_id",lastSession.id).then(({data})=>{setLastPlayerIds((data||[]).map((e:any)=>e.player_id));});
  },[lastSession?.id]);
  const handleRematch=()=>{if(lastPlayerIds.length>0){setSelectedIds(lastPlayerIds);if(lastSession.buy_in_amount)setSessionBuyIn(lastSession.buy_in_amount);}};
  const totalPlaying=selectedIds.length+guestNames.length;
  return(
    <div style={{padding:"20px 16px",maxWidth:500,margin:"0 auto"}}>
      <BackButton onBack={onBack}/><SectionTitle text="Tonight's Setup"/>
      <Card style={{marginBottom:12}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:9}}>
          <div style={{color:"#888",fontSize:10,fontFamily:"'Space Mono',monospace",letterSpacing:2}}>BUY-IN FOR TONIGHT</div>
          {lastSession&&lastPlayerIds.length>0&&<button onClick={handleRematch} style={{padding:"3px 10px",background:"rgba(201,168,76,0.1)",border:"1px solid rgba(201,168,76,0.25)",borderRadius:20,color:"#C9A84C",fontFamily:"'Space Mono',monospace",fontSize:9,cursor:"pointer",letterSpacing:1}}>↺ REMATCH</button>}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:11,marginBottom:9}}><button onClick={()=>setSessionBuyIn(Math.max(1,sessionBuyIn-5))} style={{width:38,height:38,borderRadius:9,background:"rgba(224,85,85,0.15)",border:"1px solid rgba(224,85,85,0.3)",color:"#E05555",fontSize:20,cursor:"pointer"}}>−</button><div style={{flex:1,textAlign:"center"}}><div style={{color:"#C9A84C",fontSize:30,fontFamily:"'Space Mono',monospace",fontWeight:700}}>${sessionBuyIn}</div></div><button onClick={()=>setSessionBuyIn(sessionBuyIn+5)} style={{width:38,height:38,borderRadius:9,background:"rgba(76,175,140,0.15)",border:"1px solid rgba(76,175,140,0.3)",color:"#4CAF8C",fontSize:20,cursor:"pointer"}}>+</button></div>
        <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:12}}>{[10,20,25,50,100].map(amt=><button key={amt} onClick={()=>setSessionBuyIn(amt)} style={{padding:"4px 10px",borderRadius:20,background:sessionBuyIn===amt?"rgba(201,168,76,0.2)":"rgba(255,255,255,0.04)",border:`1px solid ${sessionBuyIn===amt?"rgba(201,168,76,0.4)":"rgba(255,255,255,0.08)"}`,color:sessionBuyIn===amt?"#C9A84C":"#555",fontFamily:"'Space Mono',monospace",fontSize:11,cursor:"pointer"}}>${amt}</button>)}</div>
        <label style={{color:"#888",fontSize:10,fontFamily:"'Space Mono',monospace",letterSpacing:1.5,display:"block",marginBottom:5}}>SESSION NOTES (optional)</label>
        <input value={sessionNotes} onChange={e=>setSessionNotes(e.target.value)} placeholder="e.g. Played at Nick's house" style={{...inp,fontSize:12}}/>
      </Card>
      <div style={{color:"#888",fontSize:10,fontFamily:"'Space Mono',monospace",letterSpacing:2,marginBottom:9}}>WHO'S PLAYING</div>
      <Card style={{marginBottom:10}}>
        {players.map((p:any)=>{const sel=selectedIds.includes(p.id);return<div key={p.id} onClick={()=>setSelectedIds(sel?selectedIds.filter(x=>x!==p.id):[...selectedIds,p.id])} style={{display:"flex",alignItems:"center",gap:11,padding:"10px 0",borderBottom:"1px solid rgba(255,255,255,0.05)",cursor:"pointer",opacity:sel?1:0.5}}><div style={{width:20,height:20,borderRadius:5,border:`2px solid ${sel?"#C9A84C":"#333"}`,background:sel?"#C9A84C":"transparent",display:"flex",alignItems:"center",justifyContent:"center",color:"#000",fontSize:12,flexShrink:0}}>{sel?"✓":""}</div><Avatar name={p.name} size={32}/><div style={{flex:1}}><div style={{color:"#fff"}}>{p.name}</div><div style={{color:"#555",fontSize:10,fontFamily:"'Space Mono',monospace"}}>{p.wins}W · {fmtProfit(p.total_profit)}</div></div></div>;})}
      </Card>

      {/* GUESTS */}
      <div style={{marginBottom:14}}>
        <div style={{color:"#888",fontSize:10,fontFamily:"'Space Mono',monospace",letterSpacing:2,marginBottom:9,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <span>GUESTS (optional)</span>
          <span style={{color:"#444",fontSize:9}}>stats used for pot only · no profile</span>
        </div>
        {guestNames.map((g,i)=>(
          <div key={i} style={{display:"flex",alignItems:"center",gap:9,padding:"8px 11px",marginBottom:6,background:"rgba(85,119,204,0.06)",border:"1px solid rgba(85,119,204,0.15)",borderRadius:10}}>
            <Icon name="person" size={13} color="#5577CC"/>
            <span style={{flex:1,color:"#aaa",fontSize:13}}>{g} <span style={{color:"#5577CC",fontSize:9,fontFamily:"'Space Mono',monospace"}}>(guest)</span></span>
            <button onClick={()=>setGuestNames(guestNames.filter((_,j)=>j!==i))} style={{background:"none",border:"none",color:"#E05555",fontSize:14,cursor:"pointer",padding:"0 3px"}}>✕</button>
          </div>
        ))}
        {guestNames.length<3&&!addingGuest&&<button onClick={()=>{setAddingGuest(true);setGuestInput("");}} style={{width:"100%",padding:"8px 0",background:"rgba(85,119,204,0.05)",border:"1px dashed rgba(85,119,204,0.2)",borderRadius:9,color:"#5577CC",fontFamily:"'Space Mono',monospace",fontSize:10,letterSpacing:1.5,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
          <Icon name="person" size={11} color="#5577CC"/>+ ADD GUEST ({guestNames.length}/3)
        </button>}
        {addingGuest&&<div style={{display:"flex",gap:7}}>
          <input autoFocus value={guestInput} onChange={e=>setGuestInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&guestInput.trim()){setGuestNames([...guestNames,guestInput.trim()]);setAddingGuest(false);}}} placeholder="Guest name..." style={{...inp,flex:1,fontSize:13}}/>
          <button onClick={()=>{if(guestInput.trim())setGuestNames([...guestNames,guestInput.trim()]);setAddingGuest(false);setGuestInput("");}} disabled={!guestInput.trim()} style={{padding:"0 13px",background:guestInput.trim()?"rgba(85,119,204,0.2)":"rgba(255,255,255,0.05)",border:`1px solid ${guestInput.trim()?"rgba(85,119,204,0.4)":"rgba(255,255,255,0.1)"}`,borderRadius:9,color:guestInput.trim()?"#5577CC":"#444",fontFamily:"'Space Mono',monospace",fontSize:11,cursor:"pointer"}}>ADD</button>
          <button onClick={()=>{setAddingGuest(false);setGuestInput("");}} style={{padding:"0 10px",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:9,color:"#555",fontFamily:"'Space Mono',monospace",fontSize:11,cursor:"pointer"}}>✕</button>
        </div>}
      </div>

      <button disabled={totalPlaying<2||loading} onClick={async()=>{setLoading(true);await onStart({selectedIds,sessionBuyIn,sessionNotes,guestNames});setLoading(false);}} style={{width:"100%",padding:"13px 0",background:totalPlaying>=2&&!loading?"linear-gradient(135deg,#C9A84C,#E8C56A)":"rgba(255,255,255,0.08)",border:"none",borderRadius:11,color:totalPlaying>=2&&!loading?"#0A0A0A":"#444",fontFamily:"'Space Mono',monospace",fontWeight:700,fontSize:13,letterSpacing:2,cursor:totalPlaying>=2&&!loading?"pointer":"not-allowed",display:"flex",alignItems:"center",justifyContent:"center",gap:10}}>{loading?<Spinner size={16}/>:`START WITH ${totalPlaying} PLAYERS →`}</button>
    </div>
  );
}

// ─── HAND RANKINGS ─────────────────────────────────────
function HandRankingsView({onBack}:any){
  const [flipped,setFlipped]=useState<number|null>(null);
  const [dealtCards,setDealtCards]=useState<number[]>([]);

  const playDealSound=()=>{
    try{
      const ctx=new (window.AudioContext||(window as any).webkitAudioContext)();
      // iOS Safari requires resume() after creation
      const play=()=>{
        [0,1,2,3,4].forEach(i=>{
          const t=ctx.currentTime+i*0.08;
          const osc=ctx.createOscillator();const gain=ctx.createGain();
          osc.connect(gain);gain.connect(ctx.destination);
          osc.frequency.setValueAtTime(800+i*60,t);
          gain.gain.setValueAtTime(0.06,t);gain.gain.exponentialRampToValueAtTime(0.001,t+0.07);
          osc.start(t);osc.stop(t+0.07);
        });
      };
      if(ctx.state==='suspended'){ctx.resume().then(play);}else{play();}
    }catch(_){}
  };

  const handleFlip=(rank:number)=>{
    if(flipped===rank){setFlipped(null);setDealtCards([]);return;}
    setFlipped(rank);setDealtCards([]);
    playDealSound();
    const h=HAND_RANKINGS.find(x=>x.rank===rank)!;
    const cards=h.example.split(' ');
    cards.forEach((_,i)=>setTimeout(()=>setDealtCards(prev=>[...prev,i]),i*110+50));
  };

  const getSuit=(card:string)=>{
    if(card.includes('♠'))return{s:'♠',c:'#e8e8e8'};
    if(card.includes('♥'))return{s:'♥',c:'#E05555'};
    if(card.includes('♦'))return{s:'♦',c:'#E05555'};
    if(card.includes('♣'))return{s:'♣',c:'#e8e8e8'};
    return{s:'',c:'#fff'};
  };
  const getVal=(card:string)=>card.replace(/[♠♥♦♣]/g,'');

  return(
    <div style={{padding:"20px 16px",maxWidth:500,margin:"0 auto"}}>
      <BackButton onBack={onBack}/><SectionTitle text="Hand Rankings"/>
      {HAND_RANKINGS.map((h)=>{
        const isFlipped=flipped===h.rank;
        const cards=h.example.split(' ');
        return(
          <div key={h.rank} onClick={()=>handleFlip(h.rank)} style={{
            marginBottom:8,borderRadius:14,cursor:"pointer",
            border:`1px solid ${h.rank<=2?"rgba(201,168,76,0.25)":"rgba(255,255,255,0.07)"}`,
            overflow:"hidden",
            background:isFlipped?"rgba(10,10,10,0.98)":"rgba(255,255,255,0.03)",
            transition:"background 0.2s",
          }}>
            {/* Front row — always visible */}
            <div style={{display:"flex",alignItems:"center",gap:13,padding:"11px 14px"}}>
              <div style={{width:28,height:28,borderRadius:8,background:`${h.color}22`,border:`1px solid ${h.color}44`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Space Mono',monospace",fontWeight:700,color:h.color,fontSize:11,flexShrink:0}}>{h.rank}</div>
              <div style={{flex:1}}>
                <div style={{color:h.color,fontFamily:"'Playfair Display',serif",fontSize:14,fontWeight:700}}>{h.name}</div>
                <div style={{color:"#666",fontSize:10,marginTop:1}}>{h.desc}</div>
              </div>
              <div style={{color:"#333",fontSize:14,transition:"transform 0.2s",transform:isFlipped?"rotate(90deg)":"rotate(0deg)"}}>›</div>
            </div>
            {/* Card deal area */}
            {isFlipped&&(
              <div style={{padding:"0 14px 14px",display:"flex",gap:6,justifyContent:"center"}}>
                {cards.map((card,ci)=>{
                  const{s,c}=getSuit(card);
                  const val=getVal(card);
                  const visible=dealtCards.includes(ci);
                  return(
                    <div key={ci} style={{
                      width:42,height:62,borderRadius:7,
                      background:visible?"#1a1a1a":"rgba(255,255,255,0.06)",
                      border:`1.5px solid ${visible?h.color:"rgba(255,255,255,0.1)"}`,
                      display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
                      transition:"all 0.15s",
                      transform:visible?"translateY(0) scale(1)":"translateY(8px) scale(0.9)",
                      opacity:visible?1:0,
                      boxShadow:visible?`0 2px 12px rgba(0,0,0,0.5)`:undefined,
                      flexShrink:0,
                    }}>
                      {visible&&<>
                        <div style={{color:c,fontFamily:"'Playfair Display',serif",fontWeight:700,fontSize:15,lineHeight:1}}>{val}</div>
                        <div style={{color:c,fontSize:16,lineHeight:1,marginTop:2}}>{s}</div>
                      </>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── COMMISSIONER SETTINGS ─────────────────────────────
function CommSettingsView({league,players,onBack,onLeagueUpdated,onLeagueDeleted,showToast,showError}:any){
  const [buyIn,setBuyIn]=useState(String(league.buy_in));const [season,setSeason]=useState(league.season);const [seasonLength,setSeasonLength]=useState(String(league.season_length||0));const [description,setDescription]=useState(league.description||"");const [isPublic,setIsPublic]=useState(league.is_public||false);const [locationName,setLocationName]=useState(league.location_name||"");const [maxPlayers,setMaxPlayers]=useState(league.max_players||12);const [saving,setSaving]=useState(false);const [confirmDelete,setConfirmDelete]=useState(false);
  const [customCode,setCustomCode]=useState(league.code||"");const [savingCode,setSavingCode]=useState(false);
  // Keep customCode in sync if parent updates the league (e.g. after save)
  useEffect(()=>{setCustomCode(league.code||"");},[league.code]);
  const save=async()=>{
    if(!db)return;setSaving(true);
    const{error}=await db.from("leagues").update({buy_in:Number(buyIn),season,season_length:Number(seasonLength),description,is_public:isPublic,location_name:locationName||null,max_players:maxPlayers}).eq("id",league.id);
    if(error){showError(error.message);}else{
      const{data:fresh}=await db.from("leagues").select("*").eq("id",league.id).single();
      showToast("Settings saved!");
      if(fresh)onLeagueUpdated(fresh);
    }
    setSaving(false);
  };
  const saveCode=async()=>{
    if(!db)return;
    const c=customCode.trim().toUpperCase();
    if(c.length<6||c.length>7){showError("Code must be 6-7 characters.");return;}
    if(!/^[A-Z0-9]+$/.test(c)){showError("Letters and numbers only.");return;}
    setSavingCode(true);
    const{data:existing}=await db.from("leagues").select("id").eq("code",c).neq("id",league.id).limit(1);
    if(existing&&existing.length>0){showError("That code is already taken.");setSavingCode(false);return;}
    const{data,error}=await db.from("leagues").update({code:c}).eq("id",league.id).select().single();
    if(error)showError(error.message);else{showToast("League code updated!");onLeagueUpdated(data);}
    setSavingCode(false);
  };
  const kick=async(id:string,name:string)=>{if(!db||!window.confirm(`Kick ${name}?`))return;await db.from("players").delete().eq("id",id);await db.from("live_entries").delete().eq("player_id",id);showToast(`${name} removed.`);onLeagueUpdated(league);};
  const del=async()=>{
    if(!db)return;
    const{data:playerRows}=await db.from("players").select("*").eq("league_id",league.id);
    if(playerRows&&playerRows.length>0){
      for(const p of playerRows){
        const{data:prof}=await db.from("profiles").select("*").ilike("display_name",p.name).single();
        if(prof){
          await db.from("profiles").update({
            archived_profit:(prof.archived_profit||0)+(p.total_profit||0),
            archived_sessions:(prof.archived_sessions||0)+(p.session_count||0),
            archived_wins:(prof.archived_wins||0)+(p.wins||0),
            archived_best_night:Math.max(prof.archived_best_night||0,p.best_night||0),
            archived_time_seconds:(prof.archived_time_seconds||0)+(p.time_played_seconds||0),
            archived_chicken_dinners:(prof.archived_chicken_dinners||0)+(p.chicken_dinners||0),
          }).eq("id",prof.id);
        }
      }
    }
    await db.from("leagues").delete().eq("id",league.id);
    showToast("League deleted. Stats preserved.");
    onLeagueDeleted();
  };
  return(
    <div style={{padding:"20px 16px",maxWidth:500,margin:"0 auto"}}>
      <BackButton onBack={onBack}/><SectionTitle text={`Manage ${league.name}`}/>
      <Card style={{marginBottom:11}}>
        {([["DESCRIPTION","text",description,setDescription,"League description"],["SEASON NAME","text",season,setSeason,"Season 1"],["LOCATION","text",locationName,setLocationName,"e.g. San Francisco, CA"]] as any[]).map(([label,type,val,setter,ph])=><div key={label} style={{marginBottom:9}}><label style={{color:"#888",fontSize:10,fontFamily:"'Space Mono',monospace",letterSpacing:1.5,display:"block",marginBottom:5}}>{label}</label><input type={type} value={val} onChange={(e:any)=>setter(e.target.value)} placeholder={ph} style={inp}/></div>)}
        <div style={{display:"flex",gap:9,marginBottom:9}}><div style={{flex:1}}><label style={{color:"#888",fontSize:10,fontFamily:"'Space Mono',monospace",letterSpacing:1.5,display:"block",marginBottom:5}}>DEFAULT BUY-IN ($)</label><input type="number" value={buyIn} onChange={e=>setBuyIn(e.target.value)} style={inp}/></div><div style={{flex:1}}><label style={{color:"#888",fontSize:10,fontFamily:"'Space Mono',monospace",letterSpacing:1.5,display:"block",marginBottom:5}}>SEASON LENGTH</label><input type="number" value={seasonLength} onChange={e=>setSeasonLength(e.target.value)} style={inp}/></div></div>
        <div style={{marginBottom:11}}><label style={{color:"#888",fontSize:10,fontFamily:"'Space Mono',monospace",letterSpacing:1.5,display:"block",marginBottom:5}}>MAX PLAYERS</label><div style={{display:"flex",gap:5}}>{MAX_PLAYER_OPTIONS.map(n=><button key={n} onClick={()=>setMaxPlayers(n)} style={{flex:1,padding:"7px 0",borderRadius:9,background:maxPlayers===n?"rgba(201,168,76,0.2)":"rgba(255,255,255,0.04)",border:`1px solid ${maxPlayers===n?"rgba(201,168,76,0.4)":"rgba(255,255,255,0.08)"}`,color:maxPlayers===n?"#C9A84C":"#555",fontFamily:"'Space Mono',monospace",fontSize:11,cursor:"pointer"}}>{n}</button>)}</div></div>
        <Toggle value={isPublic} onChange={setIsPublic} label="Public League" sub="Anyone can find & join without a code"/>
        <button onClick={save} disabled={saving} style={{width:"100%",padding:"11px 0",background:"linear-gradient(135deg,#C9A84C,#E8C56A)",border:"none",borderRadius:9,color:"#0A0A0A",fontFamily:"'Space Mono',monospace",fontWeight:700,fontSize:12,letterSpacing:2,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:9}}>{saving?<Spinner size={14}/>:"SAVE ✓"}</button>
      </Card>

      <Card style={{marginBottom:11}}>
        <div style={{color:"#888",fontSize:10,fontFamily:"'Space Mono',monospace",letterSpacing:2,marginBottom:9}}>LEAGUE CODE</div>
        <div style={{color:"#555",fontSize:11,marginBottom:9}}>Set a custom code (6-7 characters). Letters and numbers only.</div>
        <div style={{display:"flex",gap:8}}>
          <input value={customCode} onChange={e=>setCustomCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,7))} placeholder="e.g. FRIDAY" style={{...inp,flex:1,color:"#C9A84C",letterSpacing:3,fontSize:16,textAlign:"center" as const}}/>
          <button onClick={saveCode} disabled={savingCode||customCode.trim().length<6} style={{padding:"0 14px",background:customCode.trim().length>=6?"rgba(201,168,76,0.15)":"rgba(255,255,255,0.04)",border:`1px solid ${customCode.trim().length>=6?"rgba(201,168,76,0.3)":"rgba(255,255,255,0.08)"}`,borderRadius:9,color:customCode.trim().length>=6?"#C9A84C":"#444",fontFamily:"'Space Mono',monospace",fontSize:11,cursor:"pointer",flexShrink:0}}>{savingCode?<Spinner size={13}/>:"SAVE"}</button>
        </div>
      </Card>

      <Card style={{marginBottom:11}}><div style={{color:"#888",fontSize:10,fontFamily:"'Space Mono',monospace",letterSpacing:2,marginBottom:11}}>PLAYERS ({players.length}/{maxPlayers})</div>{players.map((p:any,i:number)=>{const isComm=p.name.toLowerCase()===league.commissioner_name?.toLowerCase();return<div key={p.id} style={{display:"flex",alignItems:"center",gap:9,padding:"8px 0",borderBottom:i<players.length-1?"1px solid rgba(255,255,255,0.05)":"none"}}><Avatar name={p.name} size={30}/><div style={{flex:1}}><div style={{color:"#fff",display:"flex",alignItems:"center",gap:4,fontSize:13}}>{p.name} {isComm&&<Icon name="crown" size={11} color="#C9A84C"/>}</div><div style={{color:"#555",fontSize:9,fontFamily:"'Space Mono',monospace"}}>{p.session_count} sessions</div></div>{!isComm&&<button onClick={()=>kick(p.id,p.name)} style={{padding:"3px 9px",background:"rgba(224,85,85,0.1)",border:"1px solid rgba(224,85,85,0.25)",borderRadius:20,color:"#E05555",fontFamily:"'Space Mono',monospace",fontSize:10,cursor:"pointer"}}>KICK</button>}</div>;})}
      </Card>
      <Card><div style={{color:"#E05555",fontSize:10,fontFamily:"'Space Mono',monospace",letterSpacing:2,marginBottom:9}}>DANGER ZONE</div>{!confirmDelete?<button onClick={()=>setConfirmDelete(true)} style={{width:"100%",padding:"11px 0",background:"rgba(224,85,85,0.06)",border:"1px solid rgba(224,85,85,0.2)",borderRadius:9,color:"#E05555",fontFamily:"'Space Mono',monospace",fontSize:11,letterSpacing:1.5,cursor:"pointer"}}>DELETE THIS LEAGUE</button>:<div><div style={{color:"#E05555",fontSize:12,marginBottom:11,textAlign:"center",lineHeight:1.6}}>Permanently delete all data? Career stats will be preserved. Cannot be undone.</div><div style={{display:"flex",gap:9}}><button onClick={()=>setConfirmDelete(false)} style={{flex:1,padding:"10px 0",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:9,color:"#888",fontFamily:"'Space Mono',monospace",fontSize:11,cursor:"pointer"}}>CANCEL</button><button onClick={del} style={{flex:1,padding:"10px 0",background:"rgba(224,85,85,0.2)",border:"1px solid rgba(224,85,85,0.4)",borderRadius:9,color:"#E05555",fontFamily:"'Space Mono',monospace",fontWeight:700,fontSize:11,cursor:"pointer"}}>DELETE</button></div></div>}</Card>
    </div>
  );
}

// ─── FEED ──────────────────────────────────────────────
function FeedView({profile,myLeagues,isActive}:any){
  const [posts,setPosts]=useState<any[]>([]);const [loading,setLoading]=useState(true);
  const [newPost,setNewPost]=useState("");const [selectedLeagueId,setSelectedLeagueId]=useState(myLeagues[0]?.id||"");
  const [uploading,setUploading]=useState(false);const [mediaFile,setMediaFile]=useState<File|null>(null);const [mediaPreview,setMediaPreview]=useState<string|null>(null);
  const [editingPost,setEditingPost]=useState<string|null>(null);const [editContent,setEditContent]=useState("");
  const [recentSessions,setRecentSessions]=useState<any[]>([]);const [attachSessionId,setAttachSessionId]=useState("");
  const fileRef=useRef<HTMLInputElement>(null);
  useEffect(()=>{if(isActive)loadPosts();},[isActive]);

  // Load recent sessions when league changes
  useEffect(()=>{
    setAttachSessionId("");
    if(!db||!selectedLeagueId)return;
    db.from("sessions").select("id,created_at,pot,chicken_dinner_name").eq("league_id",selectedLeagueId).eq("is_live",false).order("created_at",{ascending:false}).limit(5).then(({data})=>setRecentSessions(data||[]));
  },[selectedLeagueId]);

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
    try{
      let mu=null,mt=null;
      if(mediaFile){const ext=mediaFile.name.split('.').pop();const path=`${selectedLeagueId}/${Date.now()}.${ext}`;const{error}=await db.storage.from("posts").upload(path,mediaFile);if(!error){const{data:ud}=db.storage.from("posts").getPublicUrl(path);mu=ud.publicUrl;mt=mediaFile.type.startsWith("video")?"video":"image";}}
      await db.from("posts").insert({league_id:selectedLeagueId,author_name:profile.display_name,content:newPost.trim()||null,media_url:mu,media_type:mt,session_id:attachSessionId||null});
      setNewPost("");setMediaFile(null);setMediaPreview(null);setAttachSessionId("");await loadPosts();
    }finally{setUploading(false);}
  };
  const isCommForLeague=(lid:string)=>{const lg=myLeagues.find((l:any)=>l.id===lid);return lg&&lg.commissioner_name?.toLowerCase()===profile.display_name.toLowerCase();};
  const fmtSessionLabel=(s:any)=>{const d=new Date(s.created_at);return`${d.toLocaleDateString('en-US',{month:'short',day:'numeric'})} · $${s.pot} pot${s.chicken_dinner_name?` · ${s.chicken_dinner_name} won`:""}`;};
  return(
    <div style={{padding:"20px 16px",maxWidth:500,margin:"0 auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}><div style={{fontFamily:"'Playfair Display',serif",fontSize:22,color:"#fff"}}>Feed</div><div style={{color:"#555",fontSize:10,fontFamily:"'Space Mono',monospace"}}>you + friends</div></div>
      {myLeagues.length>0&&<Card style={{marginBottom:14}}>
        <div style={{display:"flex",gap:9,marginBottom:9}}><Avatar name={profile.display_name} url={profile.avatar_url} size={30}/><textarea value={newPost} onChange={e=>setNewPost(e.target.value)} placeholder="Share a moment..." style={{flex:1,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(201,168,76,0.2)",borderRadius:9,padding:9,color:"#fff",fontFamily:"'Space Mono',monospace",fontSize:11,resize:"none",height:58,outline:"none"}}/></div>
        {myLeagues.length>1&&<div style={{marginBottom:9}}><div style={{display:"flex",gap:5,flexWrap:"wrap"}}>{myLeagues.map((lg:any)=><button key={lg.id} onClick={()=>setSelectedLeagueId(lg.id)} style={{padding:"2px 8px",borderRadius:20,background:selectedLeagueId===lg.id?"rgba(201,168,76,0.2)":"rgba(255,255,255,0.04)",border:`1px solid ${selectedLeagueId===lg.id?"rgba(201,168,76,0.4)":"rgba(255,255,255,0.08)"}`,color:selectedLeagueId===lg.id?"#C9A84C":"#555",fontFamily:"'Space Mono',monospace",fontSize:9,cursor:"pointer"}}>{lg.name}</button>)}</div></div>}
        {recentSessions.length>0&&<div style={{marginBottom:9}}>
          <select value={attachSessionId} onChange={e=>setAttachSessionId(e.target.value)} style={{...inp,fontSize:11,color:attachSessionId?"#C9A84C":"#555"}}>
            <option value="">📎 Attach to a session (optional)</option>
            {recentSessions.map((s:any)=><option key={s.id} value={s.id}>{fmtSessionLabel(s)}</option>)}
          </select>
        </div>}
        {mediaPreview&&<div style={{position:"relative",marginBottom:9}}>{mediaFile?.type.startsWith("video")?<video src={mediaPreview} controls style={{width:"100%",borderRadius:9,maxHeight:240}}/>:<img src={mediaPreview} style={{width:"100%",borderRadius:9,maxHeight:240,objectFit:"cover"}}/>}<button onClick={()=>{setMediaFile(null);setMediaPreview(null);}} style={{position:"absolute",top:5,right:5,background:"rgba(0,0,0,0.7)",border:"none",borderRadius:"50%",color:"#fff",width:24,height:24,cursor:"pointer",fontSize:12}}>×</button></div>}
        <div style={{display:"flex",gap:7,alignItems:"center"}}><button onClick={()=>fileRef.current?.click()} style={{padding:"5px 10px",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:20,color:"#888",cursor:"pointer",display:"flex",alignItems:"center",gap:4}}><Icon name="camera" size={12} color="#888"/></button><input ref={fileRef} type="file" accept="image/*,video/*" onChange={e=>{const f=e.target.files?.[0];if(f){setMediaFile(f);setMediaPreview(URL.createObjectURL(f));}}} style={{display:"none"}}/><button onClick={handlePost} disabled={uploading||(!newPost.trim()&&!mediaFile)} style={{marginLeft:"auto",padding:"5px 14px",background:(!newPost.trim()&&!mediaFile)||uploading?"rgba(255,255,255,0.06)":"linear-gradient(135deg,#C9A84C,#E8C56A)",border:"none",borderRadius:20,color:(!newPost.trim()&&!mediaFile)||uploading?"#444":"#0A0A0A",fontFamily:"'Space Mono',monospace",fontWeight:700,fontSize:10,cursor:"pointer",display:"flex",alignItems:"center",gap:5}}>{uploading?<Spinner size={11}/>:"POST"}</button></div>
      </Card>}
      {loading&&<div style={{display:"flex",justifyContent:"center",padding:36}}><Spinner/></div>}
      {!loading&&posts.length===0&&<Card><div style={{textAlign:"center",padding:"24px 0",color:"#555",fontFamily:"'Space Mono',monospace",fontSize:11}}>No posts yet.<br/>Add friends from league standings!</div></Card>}
      {posts.map((post:any)=>{
        const isMine=post.author_name.toLowerCase()===profile.display_name.toLowerCase();const canEdit=isMine||isCommForLeague(post.league_id);
        return<Card key={post.id} style={{marginBottom:11}}>
          <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:9}}><Avatar name={post.author_name} size={30}/><div style={{flex:1}}><div style={{color:"#fff",fontSize:13,fontWeight:600}}>{post.author_name}</div><div style={{display:"flex",gap:7,alignItems:"center",marginTop:1}}><span style={{color:"#C9A84C",fontSize:9,fontFamily:"'Space Mono',monospace",background:"rgba(201,168,76,0.1)",padding:"1px 6px",borderRadius:9}}>{getLeagueName(post.league_id)}</span>{post.session_id&&<span style={{color:"#5577CC",fontSize:9,fontFamily:"'Space Mono',monospace",background:"rgba(85,119,204,0.1)",padding:"1px 6px",borderRadius:9}}>📎 session</span>}<span style={{color:"#555",fontSize:9,fontFamily:"'Space Mono',monospace"}}>{timeAgo(post.created_at)}</span></div></div>{canEdit&&<div style={{display:"flex",gap:5}}>{isMine&&<button onClick={()=>{setEditingPost(post.id);setEditContent(post.content||"");}} style={{background:"none",border:"none",color:"#555",fontSize:10,cursor:"pointer",fontFamily:"'Space Mono',monospace"}}>EDIT</button>}<button onClick={async()=>{if(!db)return;await db.from("posts").delete().eq("id",post.id);await loadPosts();}} style={{background:"none",border:"none",color:"#E05555",fontSize:10,cursor:"pointer",fontFamily:"'Space Mono',monospace"}}>DEL</button></div>}</div>
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
      await db.from("profiles").update({global_total_profit:0,global_sessions:0,global_wins:0,global_time_seconds:0,chicken_dinners:0,archived_profit:0,archived_sessions:0,archived_wins:0,archived_best_night:0,archived_time_seconds:0,archived_chicken_dinners:0}).eq("id",profile.id);
      setConfirm(false);onWiped();
    }finally{setWiping(false);}
  };
  if(!confirm)return<Card style={{marginBottom:10,border:"1px solid rgba(224,85,85,0.15)",background:"rgba(224,85,85,0.04)"}}><div style={{color:"#E05555",fontSize:10,fontFamily:"'Space Mono',monospace",letterSpacing:2,marginBottom:6}}>DANGER ZONE</div><div style={{color:"#666",fontSize:11,lineHeight:1.6,marginBottom:10}}>Reset all your stats to zero across every league. Your leagues, friends, and history are not affected — only your numbers.</div><button onClick={()=>setConfirm(true)} style={{width:"100%",padding:"10px 0",background:"rgba(224,85,85,0.06)",border:"1px solid rgba(224,85,85,0.2)",borderRadius:9,color:"#E05555",fontFamily:"'Space Mono',monospace",fontSize:11,letterSpacing:1.5,cursor:"pointer"}}>WIPE MY STATS</button></Card>;
  return<Card style={{marginBottom:10,border:"1px solid rgba(224,85,85,0.4)",background:"rgba(224,85,85,0.06)"}}><div style={{color:"#E05555",fontSize:13,textAlign:"center",lineHeight:1.6,marginBottom:14}}>Are you sure? This will zero out your profit, wins, sessions, and chicken dinners everywhere. Cannot be undone.</div><div style={{display:"flex",gap:9}}><button onClick={()=>setConfirm(false)} style={{flex:1,padding:"11px 0",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:9,color:"#888",fontFamily:"'Space Mono',monospace",fontSize:12,cursor:"pointer"}}>CANCEL</button><button onClick={handleWipe} disabled={wiping} style={{flex:1,padding:"11px 0",background:"rgba(224,85,85,0.2)",border:"1px solid rgba(224,85,85,0.4)",borderRadius:9,color:"#E05555",fontFamily:"'Space Mono',monospace",fontWeight:700,fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>{wiping?<Spinner size={14}/>:"WIPE STATS"}</button></div></Card>;
}

// ─── PROFILE TAB ───────────────────────────────────────
// Count-up animation hook
function useCountUp(target:number,duration=900,enabled=true){
  const [val,setVal]=useState(0);
  useEffect(()=>{
    if(!enabled||target===0){setVal(target);return;}
    const start=Date.now();const from=0;
    const tick=()=>{
      const elapsed=Date.now()-start;
      const progress=Math.min(elapsed/duration,1);
      const ease=1-Math.pow(1-progress,3); // ease-out cubic
      setVal(Math.round(from+(target-from)*ease));
      if(progress<1)requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  },[target,enabled]);
  return val;
}

function ProfileTabView({profile,myLeagues,isSelf,externalName,onFriends,onLogout,onSendFriendRequest,onBack}:any){
  const [allStats,setAllStats]=useState<any>(null);const [loading,setLoading]=useState(true);
  const [friendCount,setFriendCount]=useState(0);const [editing,setEditing]=useState(false);
  const [newName,setNewName]=useState(profile?.display_name||"");const [savingName,setSavingName]=useState(false);
  const [uploadingAvatar,setUploadingAvatar]=useState(false);const [msg,setMsg]=useState("");
  const fileRef=useRef<HTMLInputElement>(null);
  const displayName=isSelf?profile.display_name:(externalName||profile.display_name);
  const [sessionEntries,setSessionEntries]=useState<any[]>([]);
  useEffect(()=>{loadStats();},[displayName]);

  const loadStats=async()=>{
    if(!db||!displayName)return;setLoading(true);
    const[{data:rows},{data:fd}]=await Promise.all([
      db.from("players").select("total_profit,session_count,wins,best_night,worst_night,time_played_seconds,chicken_dinners").ilike("name",displayName),
      db.from("friends").select("id").or(`requester_name.ilike.${displayName},recipient_name.ilike.${displayName}`).eq("status","accepted")
    ]);
    setFriendCount((fd||[]).length);
    const{data:profData}=await db.from("profiles")
      .select("archived_profit,archived_sessions,archived_wins,archived_best_night,archived_worst_night,archived_time_seconds,archived_chicken_dinners,archived_rebuys,total_rebuys,privacy_settings")
      .ilike("display_name",displayName).single();
    const arch=profData||{};
    const liveRows=rows||[];
    const tp=liveRows.reduce((a:number,p:any)=>a+(p.total_profit||0),0)+(arch.archived_profit||0);
    const s=liveRows.reduce((a:number,p:any)=>a+(p.session_count||0),0)+(arch.archived_sessions||0);
    const w=liveRows.reduce((a:number,p:any)=>a+(p.wins||0),0)+(arch.archived_wins||0);
    const best=Math.max(arch.archived_best_night||0,...liveRows.map((p:any)=>p.best_night||0));
    const worst=Math.min(arch.archived_worst_night||0,...liveRows.map((p:any)=>p.worst_night||0));
    const time=liveRows.reduce((a:number,p:any)=>a+(p.time_played_seconds||0),0)+(arch.archived_time_seconds||0);
    const cd=liveRows.reduce((a:number,p:any)=>a+(p.chicken_dinners||0),0)+(arch.archived_chicken_dinners||0);
    const rebuys=(arch.total_rebuys||0)+(arch.archived_rebuys||0);
    const privacy=arch.privacy_settings||{};
    setAllStats({total_profit:tp,sessions:s,wins:w,losses:s-w,best_night:best,worst_night:worst,leagues:liveRows.length,time_seconds:time,chicken_dinners:cd,avg:s>0?tp/s:0,rebuys,privacy});
    // Fetch session entries for badge/achievement computation
    const playerIdRows=(await db.from("players").select("id").ilike("name",displayName)).data||[];
    const playerIds=playerIdRows.map((p:any)=>p.id);
    const{data:seData}=await db.from("session_entries")
      .select("profit,rebuys,buy_in,cash_out,sessions!inner(stats_committed,created_at,chicken_dinner_name,pot)")
      .eq("sessions.stats_committed",true)
      .in("player_id",playerIds);
    setSessionEntries((seData||[]).sort((a:any,b:any)=>new Date(a.sessions?.created_at||0).getTime()-new Date(b.sessions?.created_at||0).getTime()));
    setLoading(false);
  };

  const handleSaveName=async()=>{if(!db||!newName.trim()||newName.trim()===profile.display_name)return;setSavingName(true);const{error}=await db.from("profiles").update({display_name:newName.trim()}).eq("id",profile.id);if(!error){bustAvatarCache(profile.display_name,profile.avatar_url);bustAvatarCache(newName.trim(),profile.avatar_url);profile.display_name=newName.trim();setMsg("Name updated!");setTimeout(()=>setMsg(""),3000);}setSavingName(false);};
  const handleAvatar=async(e:any)=>{const f=e.target.files?.[0];if(!f||!db)return;setUploadingAvatar(true);try{const ext=f.name.split('.').pop();const path=`${profile.id}/avatar.${ext}`;await db.storage.from("avatars").upload(path,f,{upsert:true});const{data:ud}=db.storage.from("avatars").getPublicUrl(path);const url=ud.publicUrl+"?t="+Date.now();await db.from("profiles").update({avatar_url:url}).eq("id",profile.id);bustAvatarCache(profile.display_name,url);profile.avatar_url=url;setMsg("Photo updated!");setTimeout(()=>setMsg(""),3000);}finally{setUploadingAvatar(false);}};
  const isUp=(allStats?.total_profit||0)>=0;
  // Count-up values — always called at top level (hooks rule)
  const cuSessions=  useCountUp(allStats?.sessions||0,950,!loading&&!!allStats);
  const cuWins=      useCountUp(allStats?.wins||0,1000,!loading&&!!allStats);
  const cuBestN=     useCountUp(allStats?.best_night||0,1050,!loading&&!!allStats);
  const cuWorstN=    useCountUp(Math.abs(allStats?.worst_night||0),1050,!loading&&!!allStats);
  const cuWinPct=    useCountUp(allStats?.sessions>0?Math.round((allStats.wins/allStats.sessions)*100):0,1000,!loading&&!!allStats);
  const cuWinStreak= useCountUp(allStats?.wins||0,950,!loading&&!!allStats);
  const cuPL=        useCountUp(Math.abs(Math.round(allStats?.total_profit||0)),1150,!loading&&!!allStats);
  const cuAvg=       useCountUp(Math.abs(Math.round(allStats?.avg||0)),1050,!loading&&!!allStats);
  const cuHrs=       useCountUp(Math.floor((allStats?.time_seconds||0)/3600),1150,!loading&&!!allStats);
  const cuDinners=   useCountUp(allStats?.chicken_dinners||0,950,!loading&&!!allStats);
  const cuRebuys=    useCountUp(allStats?.rebuys||0,950,!loading&&!!allStats);
  const cuTotalWin=  useCountUp(Math.round((sessionEntries||[]).filter((e:any)=>(e.profit||0)>0).reduce((a:number,e:any)=>a+(e.profit||0),0)),1300,!loading&&sessionEntries.length>0);
  const cuHrRate=    useCountUp(Math.abs(Math.round(allStats?.time_seconds>0?(allStats.total_profit/((allStats.time_seconds||1)/3600)):0)),1050,!loading&&!!allStats);
  const hourlyRate=  allStats?.time_seconds>0?(allStats.total_profit/((allStats.time_seconds||1)/3600)):0;
  const cuMins=      Math.floor(((allStats?.time_seconds||0)%3600)/60);
  return(
    <div style={{padding:"20px 16px",maxWidth:500,margin:"0 auto"}}>
      {!isSelf&&onBack&&<BackButton onBack={onBack}/>}
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
          {isSelf&&editing&&<button onClick={()=>fileRef.current?.click()} style={{position:"absolute",bottom:0,right:0,width:26,height:26,borderRadius:"50%",background:"#C9A84C",border:"2px solid #0A0A0A",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>{uploadingAvatar?<Spinner size={11}/>:<Icon name="camera" size={13} color="#0A0A0A"/>}</button>}
          {isSelf&&<input ref={fileRef} type="file" accept="image/*" onChange={handleAvatar} style={{display:"none"}}/>}
        </div>
        {isSelf&&editing?<div style={{marginTop:10,display:"flex",gap:7,justifyContent:"center",alignItems:"center"}}><input value={newName} onChange={e=>setNewName(e.target.value)} style={{...inp,width:200,fontSize:15,textAlign:"center" as const,fontFamily:"'Playfair Display',serif"}}/><button onClick={handleSaveName} disabled={savingName||!newName.trim()||newName.trim()===profile.display_name} style={{padding:"9px 12px",background:"rgba(201,168,76,0.15)",border:"1px solid rgba(201,168,76,0.3)",borderRadius:9,color:"#C9A84C",fontFamily:"'Space Mono',monospace",fontSize:10,cursor:"pointer"}}>{savingName?"...":"✓"}</button></div>:<div style={{fontFamily:"'Playfair Display',serif",fontSize:22,color:"#fff",marginTop:10}}>{displayName}</div>}
        {msg&&<div style={{color:"#4CAF8C",fontSize:10,fontFamily:"'Space Mono',monospace",marginTop:5}}>✓ {msg}</div>}
        <div style={{display:"flex",justifyContent:"center",gap:14,marginTop:6}}>
          <div style={{color:"#555",fontSize:10,fontFamily:"'Space Mono',monospace"}}>{allStats?.leagues||0} leagues</div>
          <div style={{color:"#555",fontSize:10,fontFamily:"'Space Mono',monospace"}}>{friendCount} friends</div>
        </div>
        {!loading&&allStats&&<>
          <div style={{color:"#4CAF8C",fontSize:32,fontFamily:"'Space Mono',monospace",fontWeight:700,marginTop:10}}>+${cuTotalWin}</div>
          <div style={{color:"#555",fontSize:10,fontFamily:"'Space Mono',monospace"}}>total winnings</div>
        </>}
        {loading&&<div style={{display:"flex",justifyContent:"center",marginTop:14}}><Spinner/></div>}
        {!loading&&allStats&&<div style={{color:"#333",fontSize:9,fontFamily:"'Space Mono',monospace",textAlign:"center" as const,marginTop:6,letterSpacing:1}}>stats reflect locked sessions only</div>}
      </div>
      {!loading&&allStats&&<>
        {!isSelf&&allStats.privacy?.hide_stats?<Card style={{marginBottom:12,textAlign:"center" as const}}><div style={{color:"#555",fontFamily:"'Space Mono',monospace",fontSize:11,padding:"14px 0",display:"flex",alignItems:"center",justifyContent:"center",gap:7}}><Icon name="lock" size={13} color="#555"/>This player's stats are private</div><div style={{display:"flex",gap:7,justifyContent:"center",marginTop:10}}><StatBox label="Time Played" value={fmtSeconds(allStats.time_seconds)} accent="#888"/></div></Card>:<>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
          <StatBox label="Sessions" value={cuSessions}/>
          <StatBox label="Wins" value={cuWins} accent="#4CAF8C"/>
          <StatBox label="Best Night" value={`$${cuBestN}`} accent="#C9A84C"/>
          <StatBox label="Worst Night" value={allStats.worst_night<0?`-$${cuWorstN}`:"—"} accent={allStats.worst_night<0?"#E05555":"#555"}/>
          <StatBox label="Win %" value={allStats.sessions>0?`${cuWinPct}%`:"—"} accent="#5577CC"/>
          <StatBox label="Win Streak" value={cuWinStreak} accent="#4CAF8C"/>
          <StatBox label="All-Time P/L" value={allStats.total_profit>=0?`+$${cuPL}`:`-$${cuPL}`} accent={isUp?"#4CAF8C":"#E05555"}/>
          <StatBox label="Avg/Game" value={allStats.sessions>0?(allStats.avg>=0?`+$${cuAvg}`:`-$${cuAvg}`):"—"} accent={allStats.avg>=0?"#4CAF8C":"#E05555"}/>
          <StatBox label="$/Hour" value={allStats.time_seconds>0?(hourlyRate>=0?`+$${cuHrRate}`:`-$${cuHrRate}`):"—"} accent={hourlyRate>=0?"#4CAF8C":"#E05555"}/>
          <StatBox label="Time Played" value={cuHrs>0?`${cuHrs}h ${cuMins}m`:"—"} accent="#888"/>
          <StatBox label="Dinners" value={cuDinners} accent="#C9A84C"/>
          <StatBox label="Rebuys" value={cuRebuys} accent="#5577CC"/>
        </div>
        </>}
        {!loading&&allStats&&<BadgeRow allStats={allStats} sessionEntries={sessionEntries} friendCount={friendCount}/>}
        {isSelf&&myLeagues.length>0&&<Card style={{marginBottom:12}}><div style={{color:"#888",fontSize:10,fontFamily:"'Space Mono',monospace",letterSpacing:2,marginBottom:11}}>MY LEAGUES</div>{myLeagues.map((lg:any,i:number)=><div key={lg.id} style={{display:"flex",alignItems:"center",gap:9,padding:"8px 0",borderBottom:i<myLeagues.length-1?"1px solid rgba(255,255,255,0.05)":"none"}}><div style={{width:30,height:30,borderRadius:7,background:"rgba(201,168,76,0.1)",display:"flex",alignItems:"center",justifyContent:"center"}}>{lg.is_public?<Icon name="globe" size={14} color="#5577CC"/>:<Icon name="spade" size={14} color="#C9A84C"/>}</div><div style={{flex:1}}><div style={{color:"#fff",fontSize:12}}>{lg.name}</div><div style={{color:"#555",fontSize:10,fontFamily:"'Space Mono',monospace"}}>{lg.season}</div></div>{lg.commissioner_id===lg._myUserId&&<Icon name="crown" size={12} color="#C9A84C"/>}</div>)}</Card>}
        {isSelf&&editing&&<>
          <Card style={{marginBottom:10}}>
            <div style={{color:"#888",fontSize:10,fontFamily:"'Space Mono',monospace",letterSpacing:2,marginBottom:10}}>PRIVACY</div>
            <Toggle value={!!allStats.privacy?.hide_stats} onChange={async(v:boolean)=>{if(!db)return;const np={...allStats.privacy,hide_stats:v};await db.from("profiles").update({privacy_settings:np}).eq("id",profile.id);setAllStats((s:any)=>({...s,privacy:np}));}} label="Hide my stats from others" sub="Others only see your time played"/>
          </Card>
          <Card style={{marginBottom:10}}><div style={{color:"#888",fontSize:10,fontFamily:"'Space Mono',monospace",letterSpacing:2,marginBottom:6}}>ACCOUNT</div><div style={{color:"#555",fontSize:11,fontFamily:"'Space Mono',monospace",marginBottom:5}}>{profile.email}</div><div style={{color:"#444",fontSize:11,lineHeight:1.6}}>To change your password, sign out and use "Forgot password?"</div></Card>
          {(profile.global_time_seconds||0)>=360000&&<Card style={{marginBottom:10}}>
            <div style={{color:"#888",fontSize:10,fontFamily:"'Space Mono',monospace",letterSpacing:2,marginBottom:6}}>WORLDWIDE LEADERBOARD</div>
            <div style={{color:"#555",fontSize:11,marginBottom:10}}>You've played 100+ hours. Opt in to appear on the worldwide leaderboard.</div>
            <Toggle value={!!profile.opt_in_global} onChange={async(v:boolean)=>{if(!db)return;await db.from("profiles").update({opt_in_global:v}).eq("id",profile.id);profile.opt_in_global=v;setMsg(v?"You're on the leaderboard!":"Removed from leaderboard.");setTimeout(()=>setMsg(""),3000);}} label="Join worldwide leaderboard" sub="Your stats are visible to all players globally"/>
          </Card>}
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

// ─── BADGES ────────────────────────────────────────────

// Road Warrior progression tiers
const RW_TIERS=[
  {sessions:10,  name:"Punt Artist",    color:"#A0714F", glow:"rgba(160,113,79,0.4)",  label:"BRONZE"},
  {sessions:50,  name:"Table Regular",  color:"#888",    glow:"rgba(160,160,160,0.4)", label:"SILVER"},
  {sessions:100, name:"Full-Time",       color:"#C9A84C", glow:"rgba(201,168,76,0.4)",  label:"GOLD"},
  {sessions:500, name:"Chip Whisperer", color:"#5BCFED", glow:"rgba(91,207,237,0.4)",  label:"DIAMOND"},
  {sessions:1000,name:"The Gambler",    color:"#FF6B35", glow:"rgba(255,107,53,0.5)",  label:"FIRE",  hidden:true},
];
function getRWTier(sessions:number){
  let tier=null;
  for(const t of RW_TIERS){if(sessions>=t.sessions)tier=t;}
  return tier;
}
function getRWNext(sessions:number){
  for(const t of RW_TIERS){if(sessions<t.sessions)return t;}
  return null;
}

// The Collector — chicken dinner progression
const COLLECTOR_TIERS=[
  {dinners:5,   name:"Hungry",    color:"#A0714F", glow:"rgba(160,113,79,0.4)",  label:"BRONZE"},
  {dinners:10,  name:"Regular",   color:"#888",    glow:"rgba(160,160,160,0.4)", label:"SILVER"},
  {dinners:50,  name:"Chef",      color:"#C9A84C", glow:"rgba(201,168,76,0.4)",  label:"GOLD"},
  {dinners:100, name:"Head Chef", color:"#5BCFED", glow:"rgba(91,207,237,0.4)",  label:"DIAMOND"},
  {dinners:500, name:"The Table", color:"#FF6B35", glow:"rgba(255,107,53,0.5)",  label:"FIRE", hidden:true},
];
function getCollectorTier(dinners:number){let t=null;for(const tier of COLLECTOR_TIERS){if(dinners>=tier.dinners)t=tier;}return t;}
function getCollectorNext(dinners:number){for(const t of COLLECTOR_TIERS){if(dinners<t.dinners)return t;}return null;}

const BADGE_DEFS=[
  {
    id:"dinner_bell", name:"Dinner Bell", repeatable:false,
    desc:"Win your first chicken dinner — highest profit in any single session. One-time honor.",
    icon:(earned:boolean,size=36)=>(
      <svg viewBox="0 0 48 48" width={size} height={size} fill="none">
        <ellipse cx="24" cy="38" rx="16" ry="4" fill={earned?"#C9A84C":"#333"} opacity="0.25"/>
        <path d="M24 8 C16 8 11 14 11 22 C11 28 15 32 18 34 L30 34 C33 32 37 28 37 22 C37 14 32 8 24 8Z" fill={earned?"#C9A84C":"#3a3a3a"}/>
        <path d="M24 8 C24 8 28 11 28 17 C28 21 26 24 24 24 C22 24 20 21 20 17 C20 11 24 8 24 8Z" fill={earned?"rgba(232,197,106,0.4)":"rgba(255,255,255,0.06)"}/>
        <rect x="21" y="3" width="6" height="7" rx="3" fill={earned?"#E8C56A":"#555"}/>
        <rect x="10" y="34" width="28" height="3" rx="1.5" fill={earned?"#E8C56A":"#444"}/>
        <path d="M16 22 Q20 18 24 22 Q28 26 32 22" stroke={earned?"rgba(0,0,0,0.5)":"rgba(0,0,0,0.3)"} strokeWidth="1.5" fill="none" strokeLinecap="round"/>
        {earned&&<ellipse cx="24" cy="8" rx="3" ry="2" fill="#E8C56A" opacity="0.6"/>}
      </svg>
    ),
  },
  {
    id:"high_roller", name:"High Roller", repeatable:true,
    desc:"Cash out +$100 profit in a single session. Earned again each time you do it.",
    icon:(earned:boolean,size=36)=>(
      <svg viewBox="0 0 48 48" width={size} height={size} fill="none">
        <rect x="6" y="17" width="36" height="22" rx="4" fill={earned?"#2a1f0a":"#222"}/>
        <rect x="6" y="17" width="36" height="22" rx="4" stroke={earned?"#C9A84C":"#444"} strokeWidth="1.5"/>
        <circle cx="24" cy="28" r="7" fill={earned?"rgba(201,168,76,0.15)":"rgba(255,255,255,0.04)"} stroke={earned?"#C9A84C":"#444"} strokeWidth="1.5"/>
        <text x="24" y="32" textAnchor="middle" fill={earned?"#C9A84C":"#444"} fontSize="9" fontFamily="monospace" fontWeight="bold">$</text>
        <circle cx="10" cy="21" r="2" fill={earned?"#E8C56A":"#333"}/>
        <circle cx="38" cy="35" r="2" fill={earned?"#E8C56A":"#333"}/>
        <rect x="8" y="11" width="32" height="8" rx="3" fill={earned?"#C9A84C":"#3a3a3a"} stroke={earned?"#E8C56A":"#444"} strokeWidth="1"/>
        <path d="M16 9 L24 12 L32 9" stroke={earned?"#C9A84C":"#444"} strokeWidth="1.5" strokeLinecap="round" fill="none"/>
      </svg>
    ),
  },
  {
    id:"road_warrior", name:"Punt Artist", repeatable:false,
    desc:"Session Legacy Badge. Levels up as you play.",
    progression:true,
    icon:(earned:boolean,size=36,tierColor="#A0714F")=>(
      <svg viewBox="0 0 48 48" width={size} height={size} fill="none">
        <path d="M24 6 L40 36 L8 36 Z" fill={earned?`${tierColor}22`:"#1a1a1a"} stroke={earned?tierColor:"#444"} strokeWidth="2"/>
        <circle cx="24" cy="24" r="6" fill={earned?"#0A0A0A":"#111"} stroke={earned?tierColor:"#333"} strokeWidth="1.5"/>
        <circle cx="24" cy="24" r="3" fill={earned?tierColor:"#2a2a2a"}/>
        <path d="M24 6 L24 3" stroke={earned?tierColor:"#333"} strokeWidth="2" strokeLinecap="round"/>
        <path d="M14 30 L10 38 M34 30 L38 38" stroke={earned?tierColor:"#2a2a2a"} strokeWidth="1.5" strokeLinecap="round" opacity="0.7"/>
        <path d="M16 36 L32 36" stroke={earned?tierColor:"#333"} strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id:"comeback_kid", name:"Comeback Kid", repeatable:true,
    desc:"Rebuy 3+ times in a single session and still walk away profitable. Earned again each time.",
    icon:(earned:boolean,size=36)=>(
      <svg viewBox="0 0 48 48" width={size} height={size} fill="none">
        <path d="M24 40 C13 40 6 32 6 24 C6 16 13 8 21 8" stroke={earned?"#C9A84C":"#3a3a3a"} strokeWidth="3" strokeLinecap="round" fill="none"/>
        <path d="M27 8 C35 8 42 16 42 24 C42 32 35 40 27 40" stroke={earned?"#E8C56A":"#444"} strokeWidth="3" strokeLinecap="round" fill="none" strokeDasharray="5 3"/>
        <path d="M19 5 L24 11 L19 17" stroke={earned?"#C9A84C":"#444"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        <path d="M20 24 L24 20 L28 24 L24 28 Z" fill={earned?"#C9A84C":"#555"} stroke={earned?"#E8C56A":"none"} strokeWidth="1"/>
        {earned&&<circle cx="24" cy="24" r="10" fill="none" stroke="#C9A84C" strokeWidth="0.5" opacity="0.3"/>}
      </svg>
    ),
  },
  {
    id:"shark", name:"Shark", repeatable:true,
    desc:"Win 5 sessions in a row. The counter increases each time you hit a new streak of 5.",
    icon:(earned:boolean,size=36)=>(
      <svg viewBox="0 0 48 48" width={size} height={size} fill="none">
        <path d="M5 26 C5 26 12 17 24 17 C36 17 43 26 43 26 C43 26 36 35 24 35 C12 35 5 26 5 26Z" fill={earned?"rgba(201,168,76,0.12)":"rgba(255,255,255,0.03)"} stroke={earned?"#C9A84C":"#3a3a3a"} strokeWidth="1.5"/>
        <path d="M24 17 L28 7 L33 17" fill={earned?"#C9A84C":"#3a3a3a"}/>
        <circle cx="17" cy="25" r="2.5" fill={earned?"#E8C56A":"#444"}/>
        <circle cx="17" cy="25" r="1" fill={earned?"#0A0A0A":"#222"}/>
        <path d="M30 23 L33 26 L30 29" stroke={earned?"#C9A84C":"#3a3a3a"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        <path d="M34 23 L37 26 L34 29" stroke={earned?"#C9A84C":"#3a3a3a"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.5"/>
        <path d="M11 30 C11 30 14 32 17 31" stroke={earned?"#C9A84C":"#3a3a3a"} strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.6"/>
      </svg>
    ),
  },
  {
    id:"degenerate", name:"Degenerate", repeatable:false,
    desc:"Log 1,000 hours at the table. You didn't choose this life. This life chose you.",
    icon:(earned:boolean,size=36)=>(
      <svg viewBox="0 0 48 48" width={size} height={size} fill="none">
        <circle cx="24" cy="24" r="18" fill={earned?"rgba(201,168,76,0.08)":"#111"} stroke={earned?"#C9A84C":"#333"} strokeWidth="1.5"/>
        <path d="M24 10 L24 24 L32 30" stroke={earned?"#C9A84C":"#444"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="24" cy="24" r="2" fill={earned?"#E8C56A":"#444"}/>
        {[0,30,60,90,120,150,180,210,240,270,300,330].map((deg,i)=>{
          const r=14;const rad=((deg-90)*Math.PI)/180;
          const x=24+r*Math.cos(rad);const y=24+r*Math.sin(rad);
          return<circle key={i} cx={x} cy={y} r={i%3===0?1.5:0.8} fill={earned?"#C9A84C":"#333"}/>;
        })}
        {earned&&<>
          <path d="M6 38 Q12 34 18 38 Q24 42 30 38 Q36 34 42 38" stroke="#C9A84C" strokeWidth="1" fill="none" opacity="0.4" strokeLinecap="round"/>
        </>}
      </svg>
    ),
  },
  // ─── COLLECTOR — progressive badge ───────────────────
  {
    id:"collector", name:"Hungry", repeatable:false,
    desc:"Chicken Dinner Legacy Badge. Levels up as you rack up wins.",
    progression:true,
    icon:(earned:boolean,size=36,tierColor="#A0714F")=>(
      <svg viewBox="0 0 48 48" width={size} height={size} fill="none">
        {/* Plate */}
        <ellipse cx="24" cy="34" rx="16" ry="4" fill={earned?`${tierColor}33`:"#1a1a1a"}/>
        <ellipse cx="24" cy="32" rx="16" ry="5" fill={earned?"#0A0A0A":"#111"} stroke={earned?tierColor:"#333"} strokeWidth="1.5"/>
        {/* Drumstick bone */}
        <path d="M18 28 C16 22 14 16 17 12 C19 9 23 9 25 12 C27 15 26 20 28 24" stroke={earned?tierColor:"#444"} strokeWidth="3" strokeLinecap="round"/>
        {/* Meat at top */}
        <ellipse cx="23" cy="11" rx="6" ry="5" fill={earned?tierColor:"#2a2a2a"} stroke={earned?"#E8C56A":"#333"} strokeWidth="1"/>
        {/* Bone knob at bottom */}
        <circle cx="28" cy="25" r="4" fill={earned?"#0A0A0A":"#111"} stroke={earned?tierColor:"#333"} strokeWidth="1.5"/>
        <circle cx="28" cy="25" r="2" fill={earned?tierColor:"#2a2a2a"}/>
        {earned&&<circle cx="23" cy="11" r="2" fill="#E8C56A" opacity="0.7"/>}
      </svg>
    ),
  },
  // ─── 6 NEW ACHIEVEMENTS ───────────────────────────────
  {
    id:"bring_a_friend", name:"Bring a Friend", repeatable:false,
    desc:"Add at least one friend on Home Game. The table's better with people you know.",
    icon:(earned:boolean,size=36)=>(
      <svg viewBox="0 0 48 48" width={size} height={size} fill="none">
        <circle cx="17" cy="16" r="7" fill={earned?"rgba(85,119,204,0.3)":"#1a1a1a"} stroke={earned?"#5577CC":"#333"} strokeWidth="1.5"/>
        <path d="M5 36 C5 28 10 24 17 24 C24 24 29 28 29 36" stroke={earned?"#5577CC":"#333"} strokeWidth="2" strokeLinecap="round" fill="none"/>
        <circle cx="33" cy="16" r="6" fill={earned?"rgba(201,168,76,0.3)":"#1a1a1a"} stroke={earned?"#C9A84C":"#333"} strokeWidth="1.5"/>
        <path d="M27 36 C27 29 31 25 37 25 C42 25 44 28 44 34" stroke={earned?"#C9A84C":"#333"} strokeWidth="2" strokeLinecap="round" fill="none"/>
        <path d="M24 20 L28 20" stroke={earned?"#4CAF8C":"#333"} strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id:"last_man_standing", name:"Last Man Standing", repeatable:true,
    desc:"Take the chicken dinner without a single rebuy. You came, you saw, you conquered.",
    icon:(earned:boolean,size=36)=>(
      <svg viewBox="0 0 48 48" width={size} height={size} fill="none">
        {/* Podium */}
        <rect x="18" y="28" width="12" height="14" rx="2" fill={earned?"rgba(201,168,76,0.2)":"#1a1a1a"} stroke={earned?"#C9A84C":"#333"} strokeWidth="1.5"/>
        {/* Person */}
        <circle cx="24" cy="15" r="6" fill={earned?"rgba(201,168,76,0.3)":"#1a1a1a"} stroke={earned?"#C9A84C":"#333"} strokeWidth="1.5"/>
        <path d="M16 26 C16 20 19 18 24 18 C29 18 32 20 32 26" stroke={earned?"#C9A84C":"#333"} strokeWidth="1.5" fill="none" strokeLinecap="round"/>
        {/* Arms up */}
        <path d="M16 22 L10 18 M32 22 L38 18" stroke={earned?"#C9A84C":"#333"} strokeWidth="2" strokeLinecap="round"/>
        {/* Crown */}
        <path d="M18 12 L20 8 L24 11 L28 8 L30 12" stroke={earned?"#E8C56A":"#444"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      </svg>
    ),
  },
  {
    id:"the_whale", name:"The Whale", repeatable:true,
    desc:"Spend $200 or more in a single session between buy-ins and rebuys. Go big or go home.",
    icon:(earned:boolean,size=36)=>(
      <svg viewBox="0 0 48 48" width={size} height={size} fill="none">
        {/* Whale body */}
        <path d="M6 26 C6 18 12 12 22 12 C34 12 44 18 44 26 C44 32 38 36 28 36 L8 36 Z" fill={earned?"rgba(85,119,204,0.25)":"#1a1a1a"} stroke={earned?"#5577CC":"#333"} strokeWidth="1.5"/>
        {/* Tail */}
        <path d="M8 36 C6 38 4 42 8 42 C10 42 10 38 12 38 C14 38 14 42 16 42 C20 42 18 38 8 36Z" fill={earned?"#5577CC":"#333"} opacity={earned?0.8:0.5}/>
        {/* Eye */}
        <circle cx="34" cy="22" r="2.5" fill={earned?"#5577CC":"#333"}/>
        <circle cx="35" cy="21" r="1" fill={earned?"#fff":"#444"}/>
        {/* Spout */}
        <path d="M28 12 C28 8 26 4 24 6 C22 4 20 8 20 12" stroke={earned?"#5577CC":"#333"} strokeWidth="1.5" fill="none" strokeLinecap="round"/>
        {/* Dollar */}
        <text x="18" y="30" fill={earned?"#E8C56A":"#444"} fontSize="10" fontFamily="monospace" fontWeight="bold">$</text>
      </svg>
    ),
  },
  {
    id:"ice_cold", name:"Ice Cold", repeatable:true,
    desc:"Cash out at exactly $0. Broke even. Not a win, not a loss — pure poker purgatory.",
    icon:(earned:boolean,size=36)=>(
      <svg viewBox="0 0 48 48" width={size} height={size} fill="none">
        {/* Snowflake */}
        <path d="M24 6 L24 42 M6 24 L42 24 M10 10 L38 38 M38 10 L10 38" stroke={earned?"#5BCFED":"#333"} strokeWidth="2" strokeLinecap="round"/>
        <circle cx="24" cy="24" r="3" fill={earned?"#5BCFED":"#333"}/>
        {/* Branch tips */}
        {[[24,6],[24,42],[6,24],[42,24],[10,10],[38,38],[38,10],[10,38]].map(([x,y],i)=>(
          <circle key={i} cx={x} cy={y} r={2} fill={earned?"#5BCFED":"#333"}/>
        ))}
        {/* Mid-arm crossbars */}
        <path d="M18 12 L24 18 L30 12 M18 36 L24 30 L30 36 M12 18 L18 24 L12 30 M36 18 L30 24 L36 30" stroke={earned?"#5BCFED":"#444"} strokeWidth="1.2" strokeLinecap="round" fill="none" opacity={earned?0.6:0.3}/>
      </svg>
    ),
  },
  {
    id:"robbery", name:"Robbery", repeatable:true,
    desc:"Win a session where your profit is at least double your buy-in. You took everyone's money.",
    icon:(earned:boolean,size=36)=>(
      <svg viewBox="0 0 48 48" width={size} height={size} fill="none">
        {/* Bag */}
        <path d="M16 20 C16 14 19 10 24 10 C29 10 32 14 32 20 L34 36 C34 38 32 40 30 40 L18 40 C16 40 14 38 14 36 Z" fill={earned?"rgba(201,168,76,0.2)":"#1a1a1a"} stroke={earned?"#C9A84C":"#333"} strokeWidth="1.5"/>
        {/* Bag tie */}
        <path d="M20 10 C20 6 28 6 28 10" stroke={earned?"#C9A84C":"#333"} strokeWidth="2" fill="none" strokeLinecap="round"/>
        {/* Dollar sign */}
        <text x="19" y="32" fill={earned?"#E8C56A":"#444"} fontSize="14" fontFamily="monospace" fontWeight="bold">$</text>
        {/* Speed lines */}
        <path d="M35 18 L42 16 M35 24 L43 24 M35 30 L41 32" stroke={earned?"#C9A84C":"#333"} strokeWidth="1.5" strokeLinecap="round" opacity={earned?0.6:0.3}/>
      </svg>
    ),
  },
  {
    id:"bounce_back", name:"Bounce Back", repeatable:true,
    desc:"Win a session immediately after a loss. You took the hit and came back swinging.",
    icon:(earned:boolean,size=36)=>(
      <svg viewBox="0 0 48 48" width={size} height={size} fill="none">
        <path d="M14 10 L14 28" stroke={earned?"#E05555":"#333"} strokeWidth="2.5" strokeLinecap="round"/>
        <path d="M8 22 L14 30 L20 22" stroke={earned?"#E05555":"#333"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        <path d="M34 38 L34 20" stroke={earned?"#4CAF8C":"#333"} strokeWidth="2.5" strokeLinecap="round"/>
        <path d="M28 26 L34 18 L40 26" stroke={earned?"#4CAF8C":"#333"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        <path d="M14 30 C14 38 34 38 34 30" stroke={earned?"#888":"#333"} strokeWidth="1.5" strokeLinecap="round" fill="none" strokeDasharray="3 2"/>
      </svg>
    ),
  },
  {
    id:"get_wrecked", name:"Get Wrecked", repeatable:true,
    desc:"Win 80% or more of the entire pot in a single session. You didn't just win — you wrecked them.",
    icon:(earned:boolean,size=36)=>(
      <svg viewBox="0 0 48 48" width={size} height={size} fill="none">
        <path d="M24 6 L28 19 L40 15 L32 24 L42 28 L30 29 L35 41 L24 33 L13 41 L18 29 L6 28 L16 24 L8 15 L20 19 Z"
          fill={earned?"rgba(201,168,76,0.2)":"#1a1a1a"} stroke={earned?"#C9A84C":"#333"} strokeWidth="1.5" strokeLinejoin="round"/>
        <circle cx="24" cy="24" r="5" fill={earned?"#C9A84C":"#2a2a2a"}/>
        <text x="21.5" y="28" fill={earned?"#0A0A0A":"#444"} fontSize="7" fontFamily="monospace" fontWeight="bold">80</text>
        {earned&&<circle cx="24" cy="24" r="9" fill="none" stroke="#E8C56A" strokeWidth="0.8" opacity="0.5"/>}
      </svg>
    ),
  },
];

function BadgeCard({b,count,sessions,dinners,flipped,onFlip}:any){
  const earned=count>0;
  const isRW=b.id==='road_warrior';
  const isCollector=b.id==='collector';
  const rwTier=isRW?getRWTier(sessions):null;
  const rwNext=isRW?getRWNext(sessions):null;
  const collTier=isCollector?getCollectorTier(dinners):null;
  const collNext=isCollector?getCollectorNext(dinners):null;
  const activeTier=rwTier||collTier;
  const activeNext=rwNext||collNext;
  const activeTiers=isRW?RW_TIERS:isCollector?COLLECTOR_TIERS:null;
  const activeVal=isRW?sessions:isCollector?dinners:0;
  const activeKey=isRW?'sessions':'dinners';
  const tierColor=activeTier?.color||"#C9A84C";
  const tierGlow=activeTier?.glow||"rgba(201,168,76,0.3)";
  const isFire=activeTier?.label==='FIRE';
  const displayName=(isRW||isCollector)
    ?(isFire&&!earned?"???":activeTier?.name||b.name)
    :b.name;

  return(
    <>
      {/* Small front-face card always in grid */}
      <div onClick={onFlip} style={{cursor:"pointer",width:"100%",borderRadius:16,
        background:isFire&&earned?"linear-gradient(145deg,rgba(20,5,0,0.95),rgba(0,0,0,0.98))":earned?`linear-gradient(145deg,rgba(0,0,0,0.9),rgba(20,15,5,0.95))`:"rgba(255,255,255,0.02)",
        border:`2px solid ${earned?tierColor:"rgba(255,255,255,0.07)"}`,
        paddingBottom:"115%",position:"relative",
        opacity:earned?1:0.4,transition:"all 0.2s",
        animation:isFire&&earned?"fireFlicker 2s ease-in-out infinite, fireBorder 2s ease-in-out infinite":undefined,
      }}>
        <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:6,padding:"8px 4px"}}>
          {b.icon(earned,38,tierColor)}
          {earned&&b.repeatable&&count>1&&(
            <div style={{position:"absolute",top:5,right:5,background:"#C9A84C",borderRadius:8,minWidth:18,height:18,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 4px",border:"2px solid #0A0A0A"}}>
              <span style={{color:"#0A0A0A",fontSize:9,fontFamily:"'Space Mono',monospace",fontWeight:700}}>{count}x</span>
            </div>
          )}
          {b.id==='road_warrior'&&rwTier&&earned&&(
            <div style={{position:"absolute",top:5,left:5,background:isFire?"#FF6B35":tierColor,borderRadius:5,padding:"1px 4px"}}>
              <span style={{color:"#0A0A0A",fontSize:7,fontFamily:"'Space Mono',monospace",fontWeight:700}}>{isFire?"🔥":rwTier.label}</span>
            </div>
          )}
          <div style={{color:earned?tierColor:"#444",fontSize:8,fontFamily:"'Space Mono',monospace",textAlign:"center",letterSpacing:0.5,lineHeight:1.3,fontWeight:700,paddingBottom:2}}>{displayName}</div>
        </div>
      </div>

      {/* Full-screen overlay when flipped */}
      {flipped&&(
        <div onClick={onFlip} style={{
          position:"fixed",inset:0,zIndex:1000,
          background:"rgba(0,0,0,0.75)",
          display:"flex",alignItems:"center",justifyContent:"center",
          padding:24,
          animation:"fadeIn 0.15s ease",
        }}>
          <div onClick={e=>e.stopPropagation()} style={{
            width:"100%",maxWidth:340,
            borderRadius:20,
            background:isFire&&earned?"rgba(12,4,0,0.99)":earned?`linear-gradient(145deg,rgba(15,10,3,0.99),rgba(0,0,0,0.99))`:"rgba(10,10,10,0.99)",
            border:`2px solid ${earned?tierColor:"rgba(255,255,255,0.12)"}`,
            padding:24,
            animation:isFire&&earned
              ?"slideUp 0.25s cubic-bezier(0.34,1.56,0.64,1), fireFlicker 2s ease-in-out 0.3s infinite, fireBorder 2s ease-in-out 0.3s infinite"
              :"slideUp 0.25s cubic-bezier(0.34,1.56,0.64,1)",
          }}>
            {/* Header */}
            <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:16}}>
              <div style={{flexShrink:0}}>{b.icon(earned,52,tierColor)}</div>
              <div style={{flex:1}}>
                <div style={{color:earned?tierColor:"#555",fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:700}}>{displayName}</div>
                <div style={{color:earned?"#888":"#333",fontSize:10,fontFamily:"'Space Mono',monospace",letterSpacing:1,marginTop:3}}>
                  {earned?"✓ EARNED"+(b.repeatable&&count>1?` · ${count}×`:""):"LOCKED"}
                </div>
              </div>
            </div>

            {/* Description */}
            <div style={{color:"#aaa",fontSize:13,lineHeight:1.7,marginBottom:b.id==='road_warrior'?16:0}}>{b.desc}</div>

            {/* Progression — road_warrior or collector */}
            {(isRW||isCollector)&&activeTiers&&(
              <div style={{borderTop:"1px solid rgba(255,255,255,0.07)",paddingTop:16}}>
                <div style={{color:"#555",fontSize:10,fontFamily:"'Space Mono',monospace",letterSpacing:1.5,marginBottom:14}}>PROGRESSION</div>
                {activeTiers.map((t:any,i:number)=>{
                  const tVal=(t as any)[activeKey];
                  const done=activeVal>=tVal;
                  const nextTVal=i<activeTiers.length-1?(activeTiers[i+1] as any)[activeKey]:null;
                  const current=done&&(i===activeTiers.length-1||activeVal<nextTVal);
                  const isFireTier=t.label==="FIRE";
                  return(
                    <div key={t.label} style={{display:"flex",alignItems:"center",gap:12,marginBottom:0}}>
                      <div style={{display:"flex",flexDirection:"column",alignItems:"center",width:20,flexShrink:0}}>
                        <div style={{
                          width:current?16:11,height:current?16:11,borderRadius:"50%",
                          background:done?t.color:"#1a1a1a",
                          border:`2px solid ${done?t.color:"#2a2a2a"}`,
                          boxShadow:current?`0 0 8px ${t.color}`:undefined,
                          animation:isFireTier&&done?"fireFlicker 2s ease-in-out infinite":undefined,
                          flexShrink:0,transition:"all 0.3s",
                        }}/>
                        {i<activeTiers.length-1&&<div style={{
                          width:2,height:28,borderRadius:1,
                          background:nextTVal&&activeVal>=nextTVal
                            ?`linear-gradient(180deg,${t.color},${(activeTiers[i+1] as any).color})`
                            :done?`linear-gradient(180deg,${t.color},#1a1a1a)`:"#1a1a1a",
                          transition:"background 0.3s",marginTop:2,
                        }}/>}
                      </div>
                      <div style={{flex:1,paddingBottom:i<activeTiers.length-1?14:0}}>
                        <div style={{
                          color:done?t.color:"#333",
                          fontSize:current?13:11,
                          fontFamily:current?"'Playfair Display',serif":"'Space Mono',monospace",
                          fontWeight:current?700:400,
                          animation:isFireTier&&done?"fireFlicker 2s ease-in-out infinite":undefined,
                        }}>
                          {(!isFireTier||done)?t.name:"????"}
                          {current&&<span style={{color:t.color,fontSize:9,fontFamily:"'Space Mono',monospace",marginLeft:8,background:`${t.color}22`,padding:"1px 6px",borderRadius:4}}>CURRENT</span>}
                        </div>
                        <div style={{color:done?t.color+"66":"#222",fontSize:9,fontFamily:"'Space Mono',monospace",marginTop:1}}>
                          {tVal} {activeKey} · {isFireTier&&!done?"????":t.label}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {activeNext&&<div style={{color:"#555",fontSize:10,fontFamily:"'Space Mono',monospace",marginTop:8,textAlign:"center" as const}}>{(activeNext as any)[activeKey]-activeVal} to go until {(activeNext as any).hidden&&!earned?"????":activeNext.name}</div>}
              </div>
            )}
            <div style={{marginTop:16,textAlign:"center" as const}}>
              <button onClick={onFlip} style={{background:"none",border:"1px solid rgba(255,255,255,0.08)",borderRadius:20,color:"#444",fontFamily:"'Space Mono',monospace",fontSize:10,padding:"6px 18px",cursor:"pointer"}}>CLOSE</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function BadgeRow({allStats,sessionEntries,friendCount}:any){
  const [flipped,setFlipped]=useState<string|null>(null);
  if(!allStats)return null;
  const sessions=allStats.sessions||0;
  const dinners=allStats.chicken_dinners||0;
  const hoursPlayed=Math.floor((allStats.time_seconds||0)/3600);

  // Existing achievement counts
  const highRollerCount=(sessionEntries||[]).filter((e:any)=>(e.profit||0)>=100).length;
  const comebackCount=(sessionEntries||[]).filter((e:any)=>(e.rebuys||0)>=3&&(e.profit||0)>0).length;
  const sharkCount=Math.floor((allStats.wins||0)/5);

  // New achievement counts
  const whaleCount=(sessionEntries||[]).filter((e:any)=>(e.buy_in||0)*(1+(e.rebuys||0))>=200).length;
  const iceColdCount=(sessionEntries||[]).filter((e:any)=>(e.profit||0)===0).length;
  const robberyCount=(sessionEntries||[]).filter((e:any)=>(e.profit||0)>=(e.buy_in||0)*2&&(e.buy_in||0)>0).length;
  const lastManCount=(sessionEntries||[]).filter((e:any)=>{
    // Must be THE winner of that specific session (chicken_dinner_name matches this player) AND no rebuys
    const wonSession=(e.sessions?.chicken_dinner_name||"").toLowerCase()===displayName.toLowerCase();
    return (e.rebuys||0)===0&&wonSession;
  }).length;
  // Bounce back: win following a loss (sessionEntries sorted by created_at already)
  let bounceBackCount=0;
  for(let i=1;i<(sessionEntries||[]).length;i++){
    if((sessionEntries[i-1].profit||0)<0&&(sessionEntries[i].profit||0)>0)bounceBackCount++;
  }

  const getWreckedCount=(sessionEntries||[]).filter((e:any)=>{
    const pot=e.sessions?.pot||0;
    return pot>0&&(e.profit||0)>=pot*0.8;
  }).length;

  const counts:Record<string,number>={
    dinner_bell:dinners>=1?1:0,
    high_roller:highRollerCount,
    road_warrior:sessions>=10?1:0,
    collector:dinners>=1?1:0,
    comeback_kid:comebackCount,
    shark:sharkCount,
    degenerate:hoursPlayed>=1000?1:0,
    bring_a_friend:(friendCount||0)>=1?1:0,
    last_man_standing:lastManCount,
    the_whale:whaleCount,
    ice_cold:iceColdCount,
    robbery:robberyCount,
    bounce_back:bounceBackCount,
    get_wrecked:getWreckedCount,
  };

  const BADGE_IDS=['road_warrior','collector'];
  const ACHIEVEMENT_IDS=['dinner_bell','high_roller','comeback_kid','shark','degenerate','bring_a_friend','last_man_standing','the_whale','ice_cold','robbery','bounce_back','get_wrecked'];
  const badgeDefs=BADGE_DEFS.filter(b=>BADGE_IDS.includes(b.id));
  const achievementDefs=BADGE_DEFS.filter(b=>ACHIEVEMENT_IDS.includes(b.id));
  const achRows:any[][]=[];
  for(let i=0;i<achievementDefs.length;i+=3)achRows.push(achievementDefs.slice(i,i+3));

  return(
    <>
      {/* BADGES — progressive */}
      <Card style={{marginBottom:12}}>
        <div style={{color:"#888",fontSize:10,fontFamily:"'Space Mono',monospace",letterSpacing:2,marginBottom:14}}>BADGES</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
          {badgeDefs.map(b=>(
            <BadgeCard key={b.id} b={b} count={counts[b.id]||0} sessions={sessions} dinners={dinners}
              flipped={flipped===b.id}
              onFlip={()=>setFlipped(flipped===b.id?null:b.id)}
            />
          ))}
          {Array(3-badgeDefs.length).fill(0).map((_,i)=>(
            <div key={i} style={{borderRadius:16,paddingBottom:"115%",background:"rgba(255,255,255,0.01)",border:"1px dashed rgba(255,255,255,0.04)"}}/>
          ))}
        </div>
      </Card>

      {/* ACHIEVEMENTS */}
      <Card style={{marginBottom:12}}>
        <div style={{color:"#888",fontSize:10,fontFamily:"'Space Mono',monospace",letterSpacing:2,marginBottom:14}}>ACHIEVEMENTS</div>
        {achRows.map((row,ri)=>(
          <div key={ri} style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:ri<achRows.length-1?10:0}}>
            {row.map(b=>(
              <BadgeCard key={b.id} b={b} count={counts[b.id]||0} sessions={sessions} dinners={dinners}
                flipped={flipped===b.id}
                onFlip={()=>setFlipped(flipped===b.id?null:b.id)}
              />
            ))}
            {row.length<3&&Array(3-row.length).fill(0).map((_,i)=><div key={i}/>)}
          </div>
        ))}
      </Card>
    </>
  );
}


function PlayerProfileView({player,profile,onBack,onSendFriendRequest}:any){
  if(!player)return null;
  const isUp=player.total_profit>=0;const isSelf=player.name.toLowerCase()===profile.display_name.toLowerCase();const winRate=player.session_count>0?((player.wins/player.session_count)*100).toFixed(0):0;
  const badges:any[]=([player.session_count>=10&&{icon:"card",label:"10 Sessions"},player.wins>=3&&{icon:"trophy",label:"3x Winner"},player.total_profit>200&&{icon:"star",label:"High Roller"},player.streak>1&&{icon:"flame",label:`${player.streak} Streak`},(player.chicken_dinners||0)>0&&{icon:"drumstick",label:`${player.chicken_dinners}× Chicken`}]).filter(Boolean) as any[];
  return(
    <div style={{padding:"20px 16px",maxWidth:500,margin:"0 auto"}}>
      <BackButton onBack={onBack}/>
      <div style={{textAlign:"center",marginBottom:18}}><Avatar name={player.name} size={68}/><div style={{fontFamily:"'Playfair Display',serif",fontSize:22,color:"#fff",marginTop:9}}>{player.name}</div><div style={{color:isUp?"#4CAF8C":"#E05555",fontSize:26,fontFamily:"'Space Mono',monospace",fontWeight:700,marginTop:3}}>{isUp?"+":""}${player.total_profit}</div><div style={{color:"#555",fontSize:10,fontFamily:"'Space Mono',monospace"}}>in this league</div>{!isSelf&&<button onClick={()=>onSendFriendRequest(player.name)} style={{marginTop:10,padding:"6px 18px",background:"rgba(201,168,76,0.1)",border:"1px solid rgba(201,168,76,0.3)",borderRadius:20,color:"#C9A84C",fontFamily:"'Space Mono',monospace",fontSize:10,cursor:"pointer",letterSpacing:1}}>+ ADD FRIEND</button>}</div>
      <div style={{display:"flex",gap:7,marginBottom:12}}><StatBox label="Sessions" value={player.session_count}/><StatBox label="Wins" value={player.wins} accent="#4CAF8C"/><StatBox label="Win %" value={`${winRate}%`} accent="#5577CC"/><StatBox label="Best" value={`$${player.best_night}`}/></div>
      {badges.length>0&&<Card style={{marginBottom:11}}><div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{badges.map((b:any,i:number)=><div key={i} style={{background:"rgba(201,168,76,0.1)",border:"1px solid rgba(201,168,76,0.25)",borderRadius:9,padding:"5px 10px",display:"flex",alignItems:"center",gap:5}}><Icon name={b.icon} size={12} color="#C9A84C"/><span style={{color:"#C9A84C",fontSize:10,fontFamily:"'Space Mono',monospace"}}>{b.label}</span></div>)}</div></Card>}
      <Card>{([["Avg/session",fmtProfit(player.session_count>0?Math.round(player.total_profit/player.session_count):0),isUp?"#4CAF8C":"#E05555"],["Biggest win",`$${player.best_night}`,"#C9A84C"],["Time in league",fmtSeconds(player.time_played_seconds||0),"#888"],["Win streak",`${player.streak}`,"#4CAF8C"]] as any[]).map(([label,val,col]:any,i:number,arr:any[])=><div key={label} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:i<arr.length-1?"1px solid rgba(255,255,255,0.05)":"none"}}><span style={{color:"#555",fontFamily:"'Space Mono',monospace",fontSize:11}}>{label}</span><span style={{color:col,fontFamily:"'Space Mono',monospace"}}>{val}</span></div>)}</Card>
    </div>
  );
}

// ─── WORLDWIDE LEADERBOARD ─────────────────────────────
function WorldwideLeaderboardView({profile,onBack}:any){
  const [players,setPlayers]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [sortBy,setSortBy]=useState<'profit'|'winpct'|'chicken'|'rebuys'|'time'>('profit');
  const has100hrs=(profile?.global_time_seconds||0)>=360000;

  useEffect(()=>{
    if(!db)return;
    db.from("profiles")
      .select("display_name,avatar_url,global_total_profit,global_sessions,global_wins,chicken_dinners,global_time_seconds,total_rebuys")
      .eq("opt_in_global",true)
      .gte("global_time_seconds",360000)
      .limit(200)
      .then(({data})=>{setPlayers(data||[]);setLoading(false);});
  },[]);

  const getSorted=()=>{
    const p=[...players];
    if(sortBy==='profit')return p.sort((a,b)=>(b.global_total_profit||0)-(a.global_total_profit||0));
    if(sortBy==='winpct')return p.sort((a,b)=>{const ar=a.global_sessions>0?a.global_wins/a.global_sessions:0;const br=b.global_sessions>0?b.global_wins/b.global_sessions:0;return br-ar;});
    if(sortBy==='chicken')return p.sort((a,b)=>(b.chicken_dinners||0)-(a.chicken_dinners||0));
    if(sortBy==='rebuys')return p.sort((a,b)=>(b.total_rebuys||0)-(a.total_rebuys||0));
    if(sortBy==='time')return p.sort((a,b)=>(b.global_time_seconds||0)-(a.global_time_seconds||0));
    return p;
  };
  const top100=getSorted().slice(0,100);

  const getStatValue=(p:any)=>{
    if(sortBy==='profit'){const v=p.global_total_profit||0;return{val:fmtProfit(v),color:v>=0?"#4CAF8C":"#E05555"};}
    if(sortBy==='winpct'){const pct=p.global_sessions>0?((p.global_wins/p.global_sessions)*100).toFixed(0):0;return{val:`${pct}%`,color:"#5577CC"};}
    if(sortBy==='chicken')return{val:`${p.chicken_dinners||0}`,color:"#C9A84C"};
    if(sortBy==='rebuys')return{val:`${p.total_rebuys||0}`,color:"#5577CC"};
    if(sortBy==='time')return{val:fmtSeconds(p.global_time_seconds||0),color:"#888"};
    return{val:"—",color:"#888"};
  };

  return(
    <div style={{padding:"20px 16px",maxWidth:500,margin:"0 auto"}}>
      <BackButton onBack={onBack}/>
      <div style={{marginBottom:16}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}><Icon name="trophy" size={22} color="#C9A84C"/><div style={{fontFamily:"'Playfair Display',serif",fontSize:26,color:"#C9A84C"}}>Worldwide</div></div>
        <div style={{color:"#555",fontSize:10,fontFamily:"'Space Mono',monospace",letterSpacing:1.5}}>TOP 100 · 100+ HOURS PLAYED</div>
      </div>

      {/* 100hr requirement notice — non-blocking */}
      {!has100hrs&&<div style={{background:"rgba(201,168,76,0.06)",border:"1px solid rgba(201,168,76,0.15)",borderRadius:11,padding:"10px 14px",marginBottom:14,display:"flex",alignItems:"center",gap:10}}>
        <span style={{fontSize:16,flexShrink:0}}>⏱</span>
        <div>
          <div style={{color:"#C9A84C",fontFamily:"'Space Mono',monospace",fontSize:10,marginBottom:2}}>100 HOURS REQUIRED TO JOIN</div>
          <div style={{color:"#555",fontSize:11}}>You have {fmtSeconds(profile?.global_time_seconds||0)} played. Keep going — the leaderboard isn't going anywhere.</div>
        </div>
      </div>}

      {/* Sort tabs */}
      <div style={{display:"flex",gap:5,marginBottom:14,flexWrap:"wrap"}}>
        {([['profit','$ PROFIT'],['winpct','WIN %'],['chicken','DINNERS'],['rebuys','REBUYS'],['time','TIME']] as any[]).map(([k,l])=><button key={k} onClick={()=>setSortBy(k)} style={{padding:"5px 11px",borderRadius:20,background:sortBy===k?"rgba(201,168,76,0.2)":"rgba(255,255,255,0.04)",border:`1px solid ${sortBy===k?"rgba(201,168,76,0.4)":"rgba(255,255,255,0.08)"}`,color:sortBy===k?"#C9A84C":"#555",fontFamily:"'Space Mono',monospace",fontSize:10,cursor:"pointer",display:"flex",alignItems:"center",gap:4}}>{k==='chicken'&&<Icon name="drumstick" size={10} color={sortBy===k?"#C9A84C":"#555"}/>}{l}</button>)}
      </div>

      {loading&&<div style={{display:"flex",justifyContent:"center",padding:36}}><Spinner/></div>}
      {!loading&&top100.length===0&&<Card><div style={{textAlign:"center",padding:"24px 0",color:"#555",fontFamily:"'Space Mono',monospace",fontSize:11}}>No players yet.<br/>Play 100 hours and opt in from Profile → Edit!</div></Card>}
      {!loading&&top100.length>0&&<Card style={{padding:0,overflow:"hidden"}}>
        {top100.map((p:any,i:number)=>{
          const isMe=p.display_name.toLowerCase()===profile.display_name.toLowerCase();
          const medalColors2=["#C9A84C","#888","#A0714F"];
          const{val,color}=getStatValue(p);
          const subLine=`${fmtSeconds(p.global_time_seconds||0)} · ${p.global_sessions||0} sessions`;
          return<div key={p.display_name} style={{display:"flex",alignItems:"center",gap:11,padding:"11px 16px",borderBottom:i<top100.length-1?"1px solid rgba(255,255,255,0.05)":"none",background:isMe?"rgba(201,168,76,0.05)":"transparent"}}>
            <div style={{width:24,flexShrink:0,display:"flex",justifyContent:"center"}}>
              {i<3?<div style={{width:20,height:20,borderRadius:"50%",background:`${medalColors2[i]}22`,border:`1px solid ${medalColors2[i]}66`,display:"flex",alignItems:"center",justifyContent:"center",color:medalColors2[i],fontFamily:"'Space Mono',monospace",fontSize:9,fontWeight:700}}>{i+1}</div>:<span style={{color:"#333",fontFamily:"'Space Mono',monospace",fontSize:11}}>{i+1}</span>}
            </div>
            <Avatar name={p.display_name} url={p.avatar_url} size={34}/>
            <div style={{flex:1,minWidth:0}}>
              <div style={{color:isMe?"#C9A84C":"#fff",fontSize:13}}>{p.display_name}{isMe&&<span style={{color:"#C9A84C",fontSize:9,fontFamily:"'Space Mono',monospace"}}> (you)</span>}</div>
              <div style={{color:"#555",fontSize:10,fontFamily:"'Space Mono',monospace"}}>{subLine}</div>
            </div>
            <div style={{color,fontFamily:"'Space Mono',monospace",fontWeight:700,fontSize:14,flexShrink:0}}>{val}</div>
          </div>;
        })}
      </Card>}
      {!loading&&has100hrs&&<div style={{color:"#333",fontSize:10,fontFamily:"'Space Mono',monospace",textAlign:"center",marginTop:14}}>Opt in/out from Profile → Edit</div>}
    </div>
  );
}

// ─── BOTTOM NAV ────────────────────────────────────────
function BottomNav({activeTab,onTab,profile}:{activeTab:Tab;onTab:(t:Tab)=>void;profile:any}){
  return(
    <div style={{position:"fixed",bottom:0,left:0,right:0,background:"rgba(10,10,10,0.97)",borderTop:"1px solid rgba(201,168,76,0.15)",display:"flex",padding:"10px 0 20px",zIndex:100}}>
      {([{key:'feed' as Tab,icon:'◈',label:'Feed'},{key:'league' as Tab,icon:'⬡',label:'League'}]).map(t=><button key={t.key} onClick={()=>onTab(t.key)} style={{flex:1,background:"none",border:"none",display:"flex",flexDirection:"column",alignItems:"center",gap:3,cursor:"pointer",color:activeTab===t.key?"#C9A84C":"#444"}}><span style={{fontSize:20}}>{t.icon}</span><span style={{fontFamily:"'Space Mono',monospace",fontSize:10,letterSpacing:1}}>{t.label}</span></button>)}
      <button onClick={()=>onTab('profile')} style={{flex:1,background:"none",border:"none",display:"flex",flexDirection:"column",alignItems:"center",gap:3,cursor:"pointer",color:activeTab==='profile'?"#C9A84C":"#444"}}>
        <div style={{width:24,height:24,borderRadius:"50%",overflow:"hidden",border:`2px solid ${activeTab==='profile'?"#C9A84C":"#333"}`,flexShrink:0}}>
          <Avatar name={profile?.display_name||"?"} url={profile?.avatar_url} size={24}/>
        </div>
        <span style={{fontFamily:"'Space Mono',monospace",fontSize:10,letterSpacing:1}}>Profile</span>
      </button>
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
  const [badgePopup,setBadgePopup]=useState<any[]>([]);
  const [selectedArchive,setSelectedArchive]=useState<any>(null);
  const [currentLeague,setCurrentLeague]=useState<any>(null);
  const [players,setPlayers]=useState<any[]>([]);const [sessions,setSessions]=useState<any[]>([]);
  const [liveSession,setLiveSession]=useState<any>(null);const [liveEntries,setLiveEntries]=useState<any[]>([]);
  const [selectedPlayer,setSelectedPlayer]=useState<any>(null);const [selectedSession,setSelectedSession]=useState<any>(null);
  const [psv,setPsv]=useState<PSV>('self');const [viewingFriend,setViewingFriend]=useState("");
  const [autoJoinCode,setAutoJoinCode]=useState("");

  const [toast,setToast]=useState("");const [error,setError]=useState("");
  const showToast=(m:string)=>{setToast(m);setTimeout(()=>setToast(""),3000);};
  const showError=(m:string)=>{setError(m);setTimeout(()=>setError(""),4000);};
  const isComm=currentLeague?(authUser?.id===currentLeague.commissioner_id||profile?.display_name?.toLowerCase()===currentLeague.commissioner_name?.toLowerCase()):false;

  useEffect(()=>{
    const params=new URLSearchParams(window.location.search);
    const joinCode=params.get('join');
    if(joinCode){setAutoJoinCode(joinCode.toUpperCase());window.history.replaceState({},'',window.location.pathname);}
  },[]);

  useEffect(()=>{
    if(autoJoinCode&&profile){setLsv('joinCreate');setActiveTab('league');}
  },[autoJoinCode,profile]);

  const initRan=useRef(false);

  useEffect(()=>{
    if(!db){setBootstrapping(false);return;}

    // Hard fallback — if nothing resolves in 10s, show login page
    const fallback=setTimeout(()=>{
      if(!initRan.current)setBootstrapping(false);
    },10000);

    // onAuthStateChange is the primary driver — fires INITIAL_SESSION on load
    const{data:{subscription}}=db.auth.onAuthStateChange(async(event,session)=>{
      if(event==='SIGNED_OUT'||!session?.user){
        clearTimeout(fallback);
        initRan.current=false;
        setAuthUser(null);
        setProfile(null);
        setBootstrapping(false);
        return;
      }
      // Covers INITIAL_SESSION, SIGNED_IN, TOKEN_REFRESHED
      if(initRan.current)return;
      initRan.current=true;
      clearTimeout(fallback);
      setAuthUser(session.user);
      await init(session.user);
    });

    return()=>{subscription.unsubscribe();clearTimeout(fallback);};
  },[]);

  const init=async(user:any,attempt=1)=>{
    if(!db)return;
    try{
      // Timeout the fetch after 6 seconds so we never hang
      const fetchPromise=db.from("profiles")
        .select("id,display_name,email,avatar_url,opt_in_global,global_time_seconds,privacy_settings")
        .eq("id",user.id)
        .maybeSingle();
      const timeout=new Promise<{data:null,error:Error}>(res=>
        setTimeout(()=>res({data:null,error:new Error("timeout")}),6000)
      );
      const{data,error}=await Promise.race([fetchPromise,timeout]) as any;

      if(data?.display_name){
        setProfile({...data,email:user.email});
        if(data.avatar_url)bustAvatarCache(data.display_name,data.avatar_url);
        const leagues=await loadMyLeagues(data.display_name,user.id);
        requestNotifPermission();
        if(leagues)setupRealtime(leagues,data.display_name);
        // Check for newly earned badges after a short delay
        setTimeout(()=>checkNewBadges(data.display_name,user.id),2000);
        setBootstrapping(false);
      }else if(error&&attempt<=3){
        // Retry with backoff — keep showing loading screen
        setTimeout(()=>init(user,attempt+1),attempt*1500);
      }else{
        // No profile found or gave up retrying → show nickname screen (new user)
        // or login screen if we somehow lost auth
        setBootstrapping(false);
      }
    }catch(e:any){
      if(attempt<=3){
        setTimeout(()=>init(user,attempt+1),attempt*1500);
      }else{
        setBootstrapping(false);
      }
    }
  };

  const loadMyLeagues=async(displayName:string,userId:string)=>{
    if(!db)return;setLoadingLeagues(true);
    try{
      const{data:rows}=await db.from("players").select("league_id").ilike("name",displayName);
      const dbIds=(rows||[]).map((r:any)=>r.league_id);
      const stored=JSON.parse(localStorage.getItem(`hg_leagues_${userId}`)||'[]');
      const allIds=[...new Set([...dbIds,...stored])];
      if(allIds.length>0){const{data:lgs}=await db.from("leagues").select("id,name,description,code,season,season_length,season_start_date,season_number,buy_in,is_public,location_name,commissioner_id,commissioner_name,max_players,created_at").in("id",allIds);const mapped=(lgs||[]).map((lg:any)=>({...lg,_myUserId:userId}));setMyLeagues(mapped);return mapped;}
      else{setMyLeagues([]);return[];}
    }finally{setLoadingLeagues(false);}
  };

  // Check for newly earned badges/achievements since last login
  const checkNewBadges=async(displayName:string,userId:string)=>{
    if(!db)return;
    try{
      // Fetch player stats
      const[{data:plRows},{data:fdRows}]=await Promise.all([
        db.from("players").select("total_profit,session_count,wins,chicken_dinners,time_played_seconds").ilike("name",displayName),
        db.from("friends").select("id").or(`requester_name.ilike.${displayName},recipient_name.ilike.${displayName}`).eq("status","accepted"),
      ]);
      const sessions=(plRows||[]).reduce((a:number,p:any)=>a+(p.session_count||0),0);
      const dinners=(plRows||[]).reduce((a:number,p:any)=>a+(p.chicken_dinners||0),0);
      const wins=(plRows||[]).reduce((a:number,p:any)=>a+(p.wins||0),0);
      const hours=Math.floor((plRows||[]).reduce((a:number,p:any)=>a+(p.time_played_seconds||0),0)/3600);
      const friends=(fdRows||[]).length;
      // Fetch session entries
      const playerIds=((await db.from("players").select("id").ilike("name",displayName)).data||[]).map((p:any)=>p.id);
      const{data:seData}=await db.from("session_entries").select("profit,rebuys,buy_in,cash_out,sessions!inner(stats_committed,created_at,chicken_dinner_name,pot)").eq("sessions.stats_committed",true).in("player_id",playerIds);
      const ses=(seData||[]).sort((a:any,b:any)=>new Date(a.sessions?.created_at||0).getTime()-new Date(b.sessions?.created_at||0).getTime());
      // Compute current earned set (same logic as BadgeRow)
      const earned:Set<string>=new Set();
      if(dinners>=1)earned.add('dinner_bell');
      if(ses.filter((e:any)=>(e.profit||0)>=100).length>0)earned.add('high_roller');
      if(sessions>=10)earned.add('road_warrior');
      if(dinners>=5)earned.add('collector');
      if(ses.filter((e:any)=>(e.rebuys||0)>=3&&(e.profit||0)>0).length>0)earned.add('comeback_kid');
      if(Math.floor(wins/5)>0)earned.add('shark');
      if(hours>=1000)earned.add('degenerate');
      if(friends>=1)earned.add('bring_a_friend');
      // last man standing
      if(ses.filter((e:any)=>(e.sessions?.chicken_dinner_name||"").toLowerCase()===displayName.toLowerCase()&&(e.rebuys||0)===0).length>0)earned.add('last_man_standing');
      if(ses.filter((e:any)=>(e.buy_in||0)*(1+(e.rebuys||0))>=200).length>0)earned.add('the_whale');
      if(ses.filter((e:any)=>(e.profit||0)===0).length>0)earned.add('ice_cold');
      if(ses.filter((e:any)=>(e.profit||0)>=(e.buy_in||0)*2&&(e.buy_in||0)>0).length>0)earned.add('robbery');
      // bounce back
      for(let i=1;i<ses.length;i++){if((ses[i-1].profit||0)<0&&(ses[i].profit||0)>0){earned.add('bounce_back');break;}}
      if(ses.filter((e:any)=>{const pot=e.sessions?.pot||0;return pot>0&&(e.profit||0)>=pot*0.8;}).length>0)earned.add('get_wrecked');
      // Compare to last seen
      const storageKey=`hg_badges_seen_${userId}`;
      const seenRaw=localStorage.getItem(storageKey);
      const seen:Set<string>=new Set(seenRaw?JSON.parse(seenRaw):[]);
      const newBadges:string[]=[...earned].filter(id=>!seen.has(id));
      // Save new seen set
      localStorage.setItem(storageKey,JSON.stringify([...earned]));
      if(newBadges.length>0){
        const defs=BADGE_DEFS.filter(b=>newBadges.includes(b.id));
        setBadgePopup(defs);
      }
    }catch(_){}
  };

  const loadLeagueData=async(lgId:string)=>{
    if(!db)return;
    const[{data:pData},{data:sData},{data:lsData}]=await Promise.all([db.from("players").select("*").eq("league_id",lgId).order("total_profit",{ascending:false}),db.from("sessions").select("id,pot,winner_name,buy_in_amount,duration_seconds,created_at,chicken_dinner_name,is_live,notes,locked,locked_at,edit_alert,stats_committed").eq("league_id",lgId).order("created_at",{ascending:false}),db.from("sessions").select("*").eq("league_id",lgId).eq("is_live",true).limit(1)]);
    setPlayers(pData||[]);setSessions((sData||[]).filter((s:any)=>!s.is_live));
    if(lsData&&lsData.length>0){setLiveSession(lsData[0]);const{data:le}=await db!.from("live_entries").select("*").eq("session_id",lsData[0].id);setLiveEntries(le||[]);}
    else{setLiveSession(null);setLiveEntries([]);}
  };

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
        const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        const code2=Array.from({length:6},()=>chars[Math.floor(Math.random()*chars.length)]).join('');
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

  const handleEndSeason=async()=>{
    if(!db||!currentLeague||!profile)return;
    if(!window.confirm("End this season? Stats will be archived and the league will reset for next season."))return;
    try{
      const seasonNum=currentLeague.season_number||1;
      const winner=[...players].sort((a:any,b:any)=>b.total_profit-a.total_profit)[0];
      // Snapshot current standings + sessions
      const snapshot={players:players.map((p:any)=>({id:p.id,name:p.name,total_profit:p.total_profit,wins:p.wins,session_count:p.session_count,chicken_dinners:p.chicken_dinners})),sessions:sessions.map((s:any)=>({id:s.id,created_at:s.created_at,pot:s.pot,notes:s.notes,chicken_dinner_name:s.chicken_dinner_name}))};
      const startRaw=currentLeague.season_start_date||currentLeague.created_at;
      // Save to season_archives
      await db.from("season_archives").insert({league_id:currentLeague.id,season_number:seasonNum,season_name:currentLeague.season||`Season ${seasonNum}`,started_at:startRaw,ended_at:new Date().toISOString(),winner_name:winner?.name||null,winner_profit:winner?.total_profit||null,snapshot});
      // Archive each player's stats to their profile, then reset league stats
      for(const p of players){
        // Add to profile archived stats
        const{data:prof}=await db.from("profiles").select("archived_profit,archived_sessions,archived_wins,archived_best_night,archived_worst_night,archived_chicken_dinners,archived_time_seconds").ilike("display_name",p.name).maybeSingle();
        if(prof){
          await db.from("profiles").update({
            archived_profit:(prof.archived_profit||0)+(p.total_profit||0),
            archived_sessions:(prof.archived_sessions||0)+(p.session_count||0),
            archived_wins:(prof.archived_wins||0)+(p.wins||0),
            archived_best_night:Math.max(prof.archived_best_night||0,p.best_night||0),
            archived_chicken_dinners:(prof.archived_chicken_dinners||0)+(p.chicken_dinners||0),
            archived_time_seconds:(prof.archived_time_seconds||0)+(p.time_played_seconds||0),
          }).ilike("display_name",p.name);
        }
        // Reset player stats in league
        await db.from("players").update({total_profit:0,session_count:0,wins:0,best_night:0,worst_night:0,chicken_dinners:0,streak:0,time_played_seconds:0}).eq("id",p.id);
      }
      // Reset league: bump season number, new start date, clear old sessions' link
      const newSeasonNum=seasonNum+1;
      await db.from("leagues").update({season_number:newSeasonNum,season_start_date:new Date().toISOString(),season:`Season ${newSeasonNum}`}).eq("id",currentLeague.id);
      // Reload
      await loadLeagueData(currentLeague.id);
      const updatedLeague={...currentLeague,season_number:newSeasonNum,season_start_date:new Date().toISOString(),season:`Season ${newSeasonNum}`};
      setCurrentLeague(updatedLeague);
      showToast(`Season ${seasonNum} archived! Season ${newSeasonNum} has begun.`);
    }catch(e:any){showError(e.message||"Failed to end season");}
  };

  const handleTransferAndLeave=async()=>{
    if(!db||!currentLeague||!profile||!authUser)return;
    const mp=players.find((p:any)=>p.name.toLowerCase()===profile.display_name.toLowerCase());if(mp)await db.from("players").delete().eq("id",mp.id);
    const stored:string[]=JSON.parse(localStorage.getItem(`hg_leagues_${authUser.id}`)||'[]');localStorage.setItem(`hg_leagues_${authUser.id}`,JSON.stringify(stored.filter((id:string)=>id!==currentLeague.id)));
    await loadMyLeagues(profile.display_name,authUser.id);showToast("League transferred. You left.");setCurrentLeague(null);setLsv('home');
  };

  const handleStartSession=async({selectedIds,sessionBuyIn,sessionNotes,guestNames=[]}:any)=>{
    if(!db||!currentLeague||!profile)return;
    const{data:session,error}=await db.from("sessions").insert({league_id:currentLeague.id,pot:0,status:"live",buy_in_amount:sessionBuyIn,is_live:true,started_at:new Date().toISOString(),notes:sessionNotes||null}).select().single();
    if(error){showError(error.message);return;}
    const sel=players.filter((p:any)=>selectedIds.includes(p.id));
    // League members as live entries
    const memberEntries=sel.map((p:any)=>({session_id:session.id,player_id:p.id,player_name:p.name,buy_in:sessionBuyIn,rebuys:0,cash_out:0}));
    // Guests as live entries with null player_id — used for pot only
    const guestEntries=(guestNames||[]).map((name:string)=>({session_id:session.id,player_id:null,player_name:`${name} (guest)`,buy_in:sessionBuyIn,rebuys:0,cash_out:0}));
    await db.from("live_entries").insert([...memberEntries,...guestEntries]);
    await db.from("posts").insert({league_id:currentLeague.id,author_name:profile.display_name,content:`Game is live! Buy-in: $${sessionBuyIn} · ${sel.length+guestEntries.length} players${guestEntries.length>0?` (${guestEntries.length} guest${guestEntries.length>1?'s':''})`:''}.${sessionNotes?` — ${sessionNotes}`:""}`});
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
      // Pot = all entries including guests (buy_in + rebuys*buy_in per person)
      const pot=entries.reduce((a:number,e:any)=>a+(e.buy_in||0)*(1+(e.rebuys||0)),0);
      // Only non-guest entries for winner/stats
      const memberEntries=entries.filter((e:any)=>e.player_id!=null);
      const top=[...memberEntries].sort((a:any,b:any)=>b.profit-a.profit)[0];
      const winnerName=players.find((p:any)=>p.id===top?.player_id)?.name||top?.player_name||"";
      await db.from("sessions").update({is_live:false,pot,winner_name:winnerName,duration_seconds:elapsed,status:"approved",chicken_dinner_name:chickenDinner||null,stats_committed:false}).eq("id",liveSession.id);
      // Only insert session_entries for real players (not guests)
      if(memberEntries.length>0){
        await db.from("session_entries").insert(memberEntries.map((e:any)=>({session_id:liveSession.id,player_id:e.player_id,buy_in:e.buy_in,rebuys:e.rebuys,cash_out:e.cash_out,profit:e.profit})));
      }
      setLiveSession(null);setLiveEntries([]);await loadLeagueData(currentLeague.id);showToast("Session saved! Lock it to commit stats to profiles.");setLsv('leagueDetail');
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
    if(lsv==='worldwideLeaderboard')return<WorldwideLeaderboardView profile={profile} onBack={()=>setLsv('home')}/>;
    if(lsv==='handRankings')return<HandRankingsView onBack={()=>setLsv(currentLeague?'leagueDetail':'home')}/>;
    if(lsv==='seasonRecap'&&currentLeague)return<SeasonRecapView league={currentLeague} players={players} sessions={sessions} onBack={()=>setLsv('leagueDetail')}/>;
    if(lsv==='seasonArchive'&&currentLeague)return<SeasonArchiveView league={currentLeague} onBack={()=>setLsv('leagueDetail')} onViewArchive={(a:any)=>{setSelectedArchive(a);setLsv('archivedSeason');}}/>;
    if(lsv==='archivedSeason'&&currentLeague&&selectedArchive)return<ArchivedSeasonView archive={selectedArchive} league={currentLeague} onBack={()=>setLsv('seasonArchive')}/>;
    if(lsv==='leagueDetail'&&currentLeague)return<LeagueDetailView league={currentLeague} players={players} sessions={sessions} profile={profile} isCommissioner={isComm} onViewPlayer={(p:any)=>{setSelectedPlayer(p);setLsv('playerProfile');}} onStartSession={()=>liveSession?setLsv('liveSession'):setLsv('newSession')} onBack={()=>{setCurrentLeague(null);setLsv('home');}} onCommSettings={()=>setLsv('commSettings')} liveSession={liveSession} onLeaveLeague={handleLeave} onViewHandRankings={()=>setLsv('handRankings')} onViewSession={(s:any)=>{setSelectedSession(s);setLsv('sessionDetail');}} onSeasonRecap={()=>setLsv('seasonRecap')} onEndSeason={handleEndSeason} onViewSeasonArchive={()=>setLsv('seasonArchive')} showToast={showToast}/>;
    if(lsv==='sessionDetail'&&selectedSession&&currentLeague)return<SessionDetailView session={selectedSession} league={currentLeague} players={players} profile={profile} isCommissioner={isComm} onBack={()=>setLsv('leagueDetail')} onSaved={()=>loadLeagueData(currentLeague.id)} showToast={showToast} showError={showError}/>;
    if(lsv==='playerProfile'&&selectedPlayer)return<PlayerProfileView player={selectedPlayer} profile={profile} onBack={()=>setLsv('leagueDetail')} onSendFriendRequest={sendFriendRequest}/>;
    if(lsv==='newSession'&&currentLeague)return<NewSessionView league={currentLeague} players={players} sessions={sessions} onStart={handleStartSession} onBack={()=>setLsv('leagueDetail')}/>;
    if(lsv==='liveSession'&&currentLeague&&liveSession)return<LiveSessionView session={liveSession} liveEntries={liveEntries} players={players} profile={profile} isCommissioner={isComm} league={currentLeague} onBack={()=>setLsv('leagueDetail')} onSubmitEntry={handleSubmitEntry} onEndSession={handleEndSession}/>;
    if(lsv==='commSettings'&&currentLeague&&isComm)return<CommSettingsView league={currentLeague} players={players} onBack={()=>setLsv('leagueDetail')} onLeagueUpdated={(lg:any)=>{setCurrentLeague({...lg,_myUserId:authUser?.id});loadLeagueData(lg.id);}} onLeagueDeleted={()=>{setCurrentLeague(null);loadMyLeagues(profile.display_name,authUser.id);setLsv('home');}} showToast={showToast} showError={showError}/>;
    if(lsv==='transferComm'&&currentLeague)return<TransferCommView league={currentLeague} players={players} profile={profile} onBack={()=>setLsv('leagueDetail')} onTransferred={handleTransferAndLeave}/>;
    return<LeagueHomeView profile={profile} myLeagues={myLeagues} loading={loadingLeagues} onSelectLeague={(lg:any)=>{setCurrentLeague(lg);loadLeagueData(lg.id);setLsv('leagueDetail');}} onJoinCreate={()=>setLsv('joinCreate')} onScoreboard={()=>setLsv('worldwideLeaderboard')} onViewHandRankings={()=>setLsv('handRankings')} onViewNotification={async(n:any)=>{
      if(n.type==='session_edit'&&n.leagueId&&n.sessionId){
        const lg=myLeagues.find((l:any)=>l.id===n.leagueId);
        if(lg){setCurrentLeague(lg);await loadLeagueData(lg.id);}
        const{data:sRow}=await db!.from("sessions").select("*").eq("id",n.sessionId).single();
        if(sRow){setSelectedSession(sRow);setLsv('sessionDetail');}
      }
    }}/>;
  };

  const renderProfile=()=>{
    if(psv==='friends')return<FriendsView profile={profile} onBack={()=>setPsv('self')} onViewFriendProfile={(n:string)=>{setViewingFriend(n);setPsv('friendProfile');}}/>;
    if(psv==='friendProfile')return<ProfileTabView profile={profile} myLeagues={myLeagues} isSelf={false} externalName={viewingFriend} onFriends={()=>setPsv('friends')} onLogout={handleLogout} onSendFriendRequest={sendFriendRequest} onBack={()=>setPsv('friends')}/>;
    return<ProfileTabView profile={profile} myLeagues={myLeagues} isSelf={true} onFriends={()=>setPsv('friends')} onLogout={handleLogout} onSendFriendRequest={sendFriendRequest}/>;
  };

  return(
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Space+Mono:wght@400;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        body,html{background:#0A0A0A;color:#fff;-webkit-font-smoothing:antialiased;overscroll-behavior-y:none;touch-action:pan-x pan-y;}
        input[type=number]{-moz-appearance:textfield;}
        input[type=number]::-webkit-inner-spin-button,input[type=number]::-webkit-outer-spin-button{-webkit-appearance:none;}
        input::placeholder,textarea::placeholder{color:#333!important;}
        select{appearance:none;-webkit-appearance:none;}
        @keyframes hg_spin{to{transform:rotate(360deg);}}
        @keyframes pulse{0%,100%{opacity:1;}50%{opacity:0.4;}}
        @keyframes fadeIn{from{opacity:0;}to{opacity:1;}}
        @keyframes slideUp{from{transform:translateY(30px) scale(0.95);opacity:0;}to{transform:translateY(0) scale(1);opacity:1;}}
        @keyframes fireFlicker{0%,100%{box-shadow:0 0 8px #FF6B35,0 0 16px rgba(255,107,53,0.4);}25%{box-shadow:0 0 12px #FF8C55,0 0 24px rgba(255,140,85,0.5);}50%{box-shadow:0 0 6px #FF4500,0 0 20px rgba(255,69,0,0.6);}75%{box-shadow:0 0 14px #FFA040,0 0 28px rgba(255,160,64,0.4);}}
        @keyframes fireBorder{0%,100%{border-color:#FF6B35;}33%{border-color:#FF8C55;}66%{border-color:#FF4500;}}
        ::-webkit-scrollbar{width:3px;}::-webkit-scrollbar-thumb{background:#2a2a2a;border-radius:4px;}
      `}</style>
      <div style={{background:"#0A0A0A",minHeight:"100vh",paddingBottom:80}}>
        {toast&&<div style={{position:"fixed",top:20,left:"50%",transform:"translateX(-50%)",background:"rgba(76,175,140,0.95)",color:"#fff",padding:"10px 20px",borderRadius:30,fontFamily:"'Space Mono',monospace",fontSize:12,zIndex:999,maxWidth:"88vw",textAlign:"center"}}>{toast}</div>}
        {error&&<div style={{position:"fixed",top:20,left:"50%",transform:"translateX(-50%)",background:"rgba(224,85,85,0.95)",color:"#fff",padding:"10px 20px",borderRadius:30,fontFamily:"'Space Mono',monospace",fontSize:12,zIndex:999,maxWidth:"88vw",textAlign:"center"}}>{error}</div>}
        {/* Badge unlock popup */}
        {badgePopup.length>0&&(()=>{
          const b=badgePopup[0];
          const isBadge=b.progression;
          return(
            <div onClick={()=>setBadgePopup(p=>p.slice(1))} style={{position:"fixed",inset:0,zIndex:1100,background:"rgba(0,0,0,0.85)",display:"flex",alignItems:"center",justifyContent:"center",padding:24,animation:"fadeIn 0.2s ease"}}>
              <div onClick={e=>e.stopPropagation()} style={{width:"100%",maxWidth:320,background:"linear-gradient(145deg,rgba(15,10,3,0.99),rgba(0,0,0,0.99))",border:"2px solid #C9A84C",borderRadius:20,padding:28,boxShadow:"0 0 40px rgba(201,168,76,0.3)",animation:"slideUp 0.3s cubic-bezier(0.34,1.56,0.64,1)"}}>
                <div style={{textAlign:"center" as const,marginBottom:16}}>
                  <div style={{color:"#C9A84C",fontSize:9,fontFamily:"'Space Mono',monospace",letterSpacing:3,marginBottom:8}}>{isBadge?"BADGE LEVEL UP":"ACHIEVEMENT UNLOCKED"}</div>
                  <div style={{display:"flex",justifyContent:"center",marginBottom:12}}>{b.icon(true,56,"#C9A84C")}</div>
                  <div style={{fontFamily:"'Playfair Display',serif",fontSize:22,color:"#C9A84C",fontWeight:700,marginBottom:6}}>{b.name}</div>
                  <div style={{color:"#888",fontSize:12,lineHeight:1.7,marginBottom:4}}>🎉 Congratulations!</div>
                  <div style={{color:"#666",fontSize:11,lineHeight:1.6}}>{b.desc}</div>
                </div>
                <button onClick={()=>setBadgePopup(p=>p.slice(1))} style={{width:"100%",padding:"11px 0",background:"linear-gradient(135deg,#C9A84C,#E8C56A)",border:"none",borderRadius:11,color:"#0A0A0A",fontFamily:"'Space Mono',monospace",fontWeight:700,fontSize:12,letterSpacing:2,cursor:"pointer"}}>
                  {badgePopup.length>1?`NEXT (${badgePopup.length-1} more)`:"LET'S GO →"}
                </button>
              </div>
            </div>
          );
        })()}
        {activeTab==='league'&&renderLeague()}
        {activeTab==='feed'&&<FeedView profile={profile} myLeagues={myLeagues} isActive={activeTab==='feed'}/>}
        {activeTab==='profile'&&renderProfile()}
        <BottomNav activeTab={activeTab} onTab={t=>{setActiveTab(t);if(t==='profile')setPsv('self');}} profile={profile}/>
      </div>
    </>
  );
}