import React, { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';
const db = (SUPABASE_URL !== 'YOUR_SUPABASE_URL') ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

type Tab = 'league' | 'feed' | 'profile';
type LSV = 'home'|'joinCreate'|'publicLeagues'|'leagueDetail'|'newSession'|'liveSession'|'commSettings'|'transferComm'|'handRankings'|'playerProfile'|'sessionDetail'|'seasonRecap'|'seasonArchive'|'archivedSeason';
type PSV = 'self'|'friends'|'friendProfile';

const HAND_RANKINGS = [
  { rank:1,  name:"Royal Flush",     desc:"A K Q J 10 of the same suit",  example:"A♠ K♠ Q♠ J♠ 10♠", color:"#E9B949" },
  { rank:2,  name:"Straight Flush",  desc:"Five consecutive same suit",    example:"9♥ 8♥ 7♥ 6♥ 5♥",   color:"#F0CA5A" },
  { rank:3,  name:"Four of a Kind",  desc:"Four cards of the same rank",   example:"K♠ K♥ K♦ K♣ 3♠",   color:"#4ADE80" },
  { rank:4,  name:"Full House",      desc:"Three of a kind + a pair",      example:"J♠ J♥ J♦ 9♣ 9♥",   color:"#8AB4FF" },
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
  const colors=["#E9B949","#4ADE80","#F87171","#8AB4FF","#CC55AA"];
  const bg=colors[(name||"?").charCodeAt(0)%colors.length];
  const onFire=streak>=3;
  const inner=src
    ?<img src={src} style={{width:size,height:size,borderRadius:"50%",objectFit:"cover" as const,flexShrink:0,display:"block"}}/>
    :<div style={{width:size,height:size,borderRadius:"50%",background:bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Fraunces',serif",fontWeight:700,fontSize:size*0.4,color:"#0D0D0D",flexShrink:0}}>{(name||"?")[0].toUpperCase()}</div>;
  if(!onFire)return<div style={{width:size,height:size,borderRadius:"50%",overflow:"hidden",flexShrink:0,border:"1px solid rgba(255,255,255,0.10)",display:"inline-flex"}}>{inner}</div>;
  return(
    <div style={{position:"relative",display:"inline-flex",flexShrink:0,width:size+6,height:size+6,alignItems:"center",justifyContent:"center"}}>
      <style>{`@keyframes fireRing{0%,100%{opacity:1;box-shadow:0 0 4px 1px rgba(255,107,53,0.6);}50%{opacity:0.7;box-shadow:0 0 8px 2px rgba(255,140,85,0.8),0 0 14px 3px rgba(255,69,0,0.3);}}`}</style>
      <div style={{position:"absolute",inset:0,borderRadius:"50%",border:"2px solid #FF6B35",animation:"fireRing 1.8s ease-in-out infinite",pointerEvents:"none"}}/>
      <div style={{width:size,height:size,borderRadius:"50%",overflow:"hidden",flexShrink:0,border:"1.5px solid rgba(255,107,53,0.4)"}}>{inner}</div>
    </div>
  );
}
function Card({children,style={}}:any){return<div style={{background:"#131317",border:"1px solid rgba(255,255,255,0.06)",borderRadius:16,padding:20,...style}}>{children}</div>;}
function StatBox({label,value,accent="#E9B949",dim=false}:any){return<div style={{background:dim?"rgba(255,255,255,0.01)":"rgba(255,255,255,0.03)",border:`1px solid ${dim?"rgba(255,255,255,0.04)":"rgba(255,255,255,0.08)"}`,borderRadius:12,padding:"10px 8px",flex:1,minWidth:50,textAlign:"center" as const,transition:"all 0.2s"}}><div style={{color:dim?"#333":"#5C616B",fontSize:9,fontFamily:"'JetBrains Mono',monospace",letterSpacing:1,textTransform:"uppercase",marginBottom:4,minHeight:22,display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1.3}}>{label}</div><div style={{color:dim?"#333":accent,fontSize:15,fontWeight:700,fontFamily:"'Fraunces',serif",lineHeight:1}}>{dim?"—":value}</div></div>;}
function Spinner({size=24}:any){
  return<><style>{`@keyframes hg_spin{to{transform:rotate(360deg);}}`}</style><div style={{width:size,height:size,border:`2px solid rgba(233,185,73,0.15)`,borderTopColor:"#E9B949",borderRadius:"50%",animation:"hg_spin 0.7s linear infinite",flexShrink:0}}/></>;
}
function Toggle({value,onChange,label,sub}:any){return<div onClick={()=>onChange(!value)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 14px",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:12,cursor:"pointer",marginBottom:10}}><div style={{flex:1,paddingRight:12}}><div style={{color:"#fff",fontSize:13}}>{label}</div>{sub&&<div style={{color:"#555",fontSize:11,marginTop:2}}>{sub}</div>}</div><div style={{width:44,height:24,borderRadius:12,background:value?"#8AB4FF":"rgba(255,255,255,0.1)",position:"relative",transition:"background 0.2s",flexShrink:0}}><div style={{width:20,height:20,borderRadius:"50%",background:"#fff",position:"absolute",top:2,left:value?22:2,transition:"left 0.2s"}}/></div></div>;}
function Badge({text,color="#E9B949"}:any){return<span style={{background:`${color}22`,color,border:`1px solid ${color}44`,borderRadius:20,padding:"2px 10px",fontSize:11,fontFamily:"'JetBrains Mono',monospace",letterSpacing:1}}>{text}</span>;}
const inp:any={width:"100%",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:10,padding:"11px 14px",color:"#F2F2F3",fontSize:14,fontFamily:"'JetBrains Mono',monospace",outline:"none",boxSizing:"border-box"};
function BackButton({onBack}:any){return<button onClick={onBack} style={{background:"#131317",border:"1px solid rgba(255,255,255,0.06)",color:"#F2F2F3",borderRadius:10,padding:"6px 10px",cursor:"pointer",marginBottom:14,display:"inline-flex",alignItems:"center",fontSize:15}}>←</button>;}
function SectionTitle({text}:any){return<div style={{fontFamily:"'Fraunces',serif",fontSize:26,fontWeight:500,letterSpacing:-0.5,color:"#F2F2F3",marginBottom:16}}>{text}</div>;}

function VaultHeader({title,subtitle,right,showBack,onBack}:{title:string;subtitle?:string;right?:any;showBack?:boolean;onBack?:()=>void;}){
  return(
    <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20,minHeight:44}}>
      {showBack&&<button onClick={onBack} style={{background:"#131317",border:"1px solid rgba(255,255,255,0.06)",color:"#F2F2F3",borderRadius:10,padding:"6px 10px",cursor:"pointer",flexShrink:0,fontSize:15,display:"flex",alignItems:"center"}}>←</button>}
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontFamily:"'Fraunces',serif",fontSize:28,fontWeight:500,letterSpacing:-0.5,lineHeight:1.1,color:"#F2F2F3"}}>{title}</div>
        {subtitle&&<div style={{color:"#9AA0A6",fontSize:13,marginTop:4}}>{subtitle}</div>}
      </div>
      {right}
    </div>
  );
}
function LoadingScreen(){
  return(
    <div style={{minHeight:"100vh",background:"#0B0B0D",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <style>{`@keyframes hg_spin{to{transform:rotate(360deg);}}`}</style>
      <div style={{textAlign:"center"}}>
        <div style={{position:"relative",width:60,height:60,margin:"0 auto 16px"}}>
          <div style={{position:"absolute",inset:0,border:"2px solid rgba(233,185,73,0.15)",borderTopColor:"#E9B949",borderRadius:"50%",animation:"hg_spin 0.7s linear infinite"}}/>
          <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,color:"#E9B949"}}>♠</div>
        </div>
        <div style={{color:"#444",fontFamily:"'JetBrains Mono',monospace",fontSize:10,letterSpacing:2}}>LOADING</div>
      </div>
    </div>
  );
}

// ─── AUTH ──────────────────────────────────────────────
function SetupView(){return<div style={{minHeight:"100vh",background:"#0B0B0D",display:"flex",alignItems:"center",justifyContent:"center",padding:24}}><Card style={{maxWidth:420,width:"100%"}}><div style={{color:"#F87171",fontFamily:"'JetBrains Mono',monospace",fontSize:11,letterSpacing:1.5,marginBottom:12}}>⚠ DATABASE NOT CONNECTED</div><div style={{color:"#aaa",fontSize:13,lineHeight:1.8}}>Add your Supabase credentials to App.tsx.</div></Card></div>;}

function AuthView(){
  const [tab,setTab]=useState<'login'|'signup'|'reset'|'newpw'>('login');
  const [email,setEmail]=useState("");const [pw,setPw]=useState("");const [newPw,setNewPw]=useState("");const [newPw2,setNewPw2]=useState("");
  const [loading,setLoading]=useState(false);const [msg,setMsg]=useState("");const [err,setErr]=useState("");const [showPw,setShowPw]=useState(false);const [showNewPw,setShowNewPw]=useState(false);

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
      const{error}=await db.auth.resetPasswordForEmail(email,{redirectTo:`${window.location.origin}/?type=recovery`});
      if(error)setErr(error.message);
      else setMsg("Check your email for a reset link!");
    }
    setLoading(false);
  };

  // Set new password screen (after clicking email reset link)
  if(tab==='newpw')return(
    <div style={{minHeight:"100vh",background:"#0B0B0D",display:"flex",alignItems:"center",justifyContent:"center",padding:24,position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",inset:0,background:"radial-gradient(circle at 30% 20%, rgba(233,185,73,0.08), transparent 50%), radial-gradient(circle at 70% 80%, rgba(74,222,128,0.05), transparent 50%)",pointerEvents:"none"}}/>
      <div style={{width:"100%",maxWidth:400,position:"relative",zIndex:1}}>
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{display:"flex",justifyContent:"center",gap:8,marginBottom:10}}>{["♠","♥","♦","♣"].map((s,i)=><span key={i} style={{fontSize:28,color:i%2===0?"#E9B949":"#F87171"}}>{s}</span>)}</div>
          <div style={{fontFamily:"'Fraunces',serif",fontSize:36,fontWeight:900,color:"#E9B949"}}>Home Game</div>
          <div style={{color:"#888",fontSize:11,fontFamily:"'JetBrains Mono',monospace",letterSpacing:2,marginTop:8}}>SET NEW PASSWORD</div>
        </div>
        <Card>
          <div style={{marginBottom:12}}><label style={{color:"#888",fontSize:10,fontFamily:"'JetBrains Mono',monospace",letterSpacing:1.5,display:"block",marginBottom:6}}>NEW PASSWORD</label><input type="password" autoComplete="new-password" value={newPw} onChange={e=>setNewPw(e.target.value)} placeholder="6+ characters" style={inp}/></div>
          <div style={{marginBottom:16}}><label style={{color:"#888",fontSize:10,fontFamily:"'JetBrains Mono',monospace",letterSpacing:1.5,display:"block",marginBottom:6}}>CONFIRM PASSWORD</label><input type="password" autoComplete="new-password" value={newPw2} onChange={e=>setNewPw2(e.target.value)} placeholder="Same as above" style={inp}/></div>
          {err&&<div style={{background:"rgba(248,113,113,0.1)",border:"1px solid rgba(248,113,113,0.3)",borderRadius:8,padding:"9px 12px",color:"#F87171",fontFamily:"'JetBrains Mono',monospace",fontSize:11,marginBottom:12}}>{err}</div>}
          {msg&&<div style={{background:"rgba(74,222,128,0.1)",border:"1px solid rgba(74,222,128,0.3)",borderRadius:8,padding:"9px 12px",color:"#4ADE80",fontFamily:"'JetBrains Mono',monospace",fontSize:11,marginBottom:12}}>{msg}</div>}
          <button onClick={handleSetNewPassword} disabled={loading||!newPw||!newPw2} style={{width:"100%",padding:"13px 0",background:!loading&&newPw&&newPw2?"linear-gradient(135deg,#E9B949,#F0CA5A)":"rgba(255,255,255,0.08)",border:"none",borderRadius:12,color:!loading&&newPw&&newPw2?"#0A0A0A":"#444",fontFamily:"'JetBrains Mono',monospace",fontWeight:700,fontSize:13,letterSpacing:2,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:10}}>{loading?<Spinner size={16}/>:"UPDATE PASSWORD →"}</button>
        </Card>
      </div>
    </div>
  );
  return(
    <div style={{minHeight:"100vh",background:"#0B0B0D",display:"flex",alignItems:"center",justifyContent:"center",padding:24,position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",inset:0,background:"radial-gradient(circle at 30% 20%, rgba(233,185,73,0.08), transparent 50%), radial-gradient(circle at 70% 80%, rgba(74,222,128,0.05), transparent 50%)",pointerEvents:"none"}}/>
      <div style={{width:"100%",maxWidth:400,position:"relative",zIndex:1}}>
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{display:"flex",justifyContent:"center",gap:8,marginBottom:10}}>{["♠","♥","♦","♣"].map((s,i)=><span key={i} style={{fontSize:28,color:i%2===0?"#E9B949":"#F87171"}}>{s}</span>)}</div>
          <div style={{fontFamily:"'Fraunces',serif",fontSize:42,fontWeight:900,color:"#E9B949",letterSpacing:-1}}>Home Game</div>
          <div style={{color:"#555",fontSize:11,fontFamily:"'JetBrains Mono',monospace",letterSpacing:2,marginTop:6}}>YOUR LEAGUE. YOUR RULES.</div>
        </div>
        <Card style={{padding:0,overflow:"hidden"}}>
          {tab!=='reset'?<div style={{display:"flex",borderBottom:"1px solid rgba(233,185,73,0.15)"}}>{(['login','signup'] as const).map(t=><button key={t} onClick={()=>{setTab(t);setErr("");setMsg("");}} style={{flex:1,padding:"14px 0",background:"none",border:"none",color:tab===t?"#E9B949":"#555",fontFamily:"'JetBrains Mono',monospace",fontSize:12,letterSpacing:1.5,textTransform:"uppercase",cursor:"pointer",borderBottom:tab===t?"2px solid #E9B949":"2px solid transparent"}}>{t==='login'?'Sign In':'Create Account'}</button>)}</div>:<div style={{borderBottom:"1px solid rgba(233,185,73,0.15)",padding:"12px 20px",display:"flex",alignItems:"center",gap:10}}><button onClick={()=>{setTab('login');setErr("");setMsg("");}} style={{background:"none",border:"none",color:"#555",fontSize:18,cursor:"pointer"}}>←</button><span style={{color:"#888",fontFamily:"'JetBrains Mono',monospace",fontSize:12}}>RESET PASSWORD</span></div>}
          <form onSubmit={e=>{e.preventDefault();handle();}} style={{padding:24}}>
            <div style={{marginBottom:12}}><label style={{color:"#888",fontSize:10,fontFamily:"'JetBrains Mono',monospace",letterSpacing:1.5,display:"block",marginBottom:6}}>EMAIL</label><input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@email.com" style={inp}/></div>
            {tab!=='reset'&&<div style={{marginBottom:8}}><label style={{color:"#888",fontSize:10,fontFamily:"'JetBrains Mono',monospace",letterSpacing:1.5,display:"block",marginBottom:6}}>PASSWORD</label><div style={{position:"relative"}}><input type={showPw?"text":"password"} autoComplete={tab==='login'?"current-password":"new-password"} value={pw} onChange={e=>setPw(e.target.value)} placeholder="••••••••" style={{...inp,paddingRight:40}}/><button type="button" onClick={()=>setShowPw(p=>!p)} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:"#555",cursor:"pointer",fontFamily:"'JetBrains Mono',monospace",fontSize:10,padding:0}}>{showPw?"HIDE":"SHOW"}</button></div></div>}
            {tab==='login'&&<div style={{textAlign:"right",marginBottom:16}}><button type="button" onClick={()=>{setTab('reset');setErr("");setMsg("");}} style={{background:"none",border:"none",color:"#555",fontFamily:"'JetBrains Mono',monospace",fontSize:11,cursor:"pointer"}}>Forgot password?</button></div>}
            {tab!=='login'&&<div style={{marginBottom:16}}/>}
            {err&&<div style={{background:"rgba(248,113,113,0.1)",border:"1px solid rgba(248,113,113,0.3)",borderRadius:8,padding:"9px 12px",color:"#F87171",fontFamily:"'JetBrains Mono',monospace",fontSize:11,marginBottom:12,lineHeight:1.6}}>{err}</div>}
            {msg&&<div style={{background:"rgba(74,222,128,0.1)",border:"1px solid rgba(74,222,128,0.3)",borderRadius:8,padding:"9px 12px",color:"#4ADE80",fontFamily:"'JetBrains Mono',monospace",fontSize:11,marginBottom:12,lineHeight:1.6}}>{msg}</div>}
            <button type="submit" disabled={loading||!email||(tab!=='reset'&&!pw)} style={{width:"100%",padding:"13px 0",background:!loading&&email&&(tab==='reset'||pw)?"linear-gradient(135deg,#E9B949,#F0CA5A)":"rgba(255,255,255,0.08)",border:"none",borderRadius:12,color:!loading&&email&&(tab==='reset'||pw)?"#0A0A0A":"#444",fontFamily:"'JetBrains Mono',monospace",fontWeight:700,fontSize:13,letterSpacing:2,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:10}}>{loading?<Spinner size={16}/>:tab==='login'?"SIGN IN →":tab==='signup'?"CREATE ACCOUNT →":"SEND RESET →"}</button>
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
    <div style={{minHeight:"100vh",background:"#0B0B0D",display:"flex",alignItems:"center",justifyContent:"center",padding:24,position:"relative"}}>
      <div style={{position:"absolute",inset:0,background:"radial-gradient(circle at 30% 20%, rgba(233,185,73,0.08), transparent 50%), radial-gradient(circle at 70% 80%, rgba(74,222,128,0.05), transparent 50%)",pointerEvents:"none"}}/>
      <div style={{width:"100%",maxWidth:400,position:"relative",zIndex:1}}>
        <div style={{textAlign:"center",marginBottom:28}}><div style={{display:"flex",justifyContent:"center",marginBottom:10}}><Icon name="person" size={38} color="#E9B949"/></div><div style={{fontFamily:"'Fraunces',serif",fontSize:26,color:"#fff"}}>One more thing</div><div style={{color:"#555",fontSize:11,fontFamily:"'JetBrains Mono',monospace",letterSpacing:1.5,marginTop:6}}>WHAT DO THEY CALL YOU AT THE TABLE?</div></div>
        <Card>
          <div style={{marginBottom:14}}><input value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&save()} placeholder="e.g. Big Stack Tyler" autoFocus style={{...inp,fontSize:18,fontFamily:"'Fraunces',serif",textAlign:"center" as const}}/></div>
          {err&&<div style={{color:"#F87171",fontSize:11,marginBottom:10}}>{err}</div>}
          <button onClick={save} disabled={loading||!name.trim()} style={{width:"100%",padding:"13px 0",background:name.trim()&&!loading?"linear-gradient(135deg,#E9B949,#F0CA5A)":"rgba(255,255,255,0.08)",border:"none",borderRadius:12,color:name.trim()&&!loading?"#0A0A0A":"#444",fontFamily:"'JetBrains Mono',monospace",fontWeight:700,fontSize:13,letterSpacing:2,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:10,marginBottom:10}}>{loading?<Spinner size={16}/>:"LET'S PLAY →"}</button>
          <button onClick={signOut} style={{width:"100%",padding:"9px 0",background:"none",border:"none",color:"#333",fontFamily:"'JetBrains Mono',monospace",fontSize:10,cursor:"pointer",letterSpacing:1}}>wrong account? sign out</button>
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
    <div style={{padding:"10px 14px",marginBottom:12,marginTop:6,background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.05)",borderRadius:10,minHeight:42,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{color:"#666",fontSize:12,fontFamily:"'JetBrains Mono',monospace",lineHeight:1.5,transition:"opacity 0.4s",opacity:fade?1:0,textAlign:"center" as const,width:"100%"}}>{POKER_TIPS[idx]}</div>
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
    const{data:fr}=await db.from("friends").select("id").eq("recipient_name",name).eq("status","pending");
    const allLeagueIds=myLeagues.map((l:any)=>l.id);
    const{data:ea}=allLeagueIds.length>0
      ?await db.from("sessions").select("id").not("edit_alert","is",null).in("league_id",allLeagueIds)
      :{data:[]};
    // Recent feed posts in my leagues (last 24h, not by me)
    const cutoff=new Date(Date.now()-24*60*60*1000).toISOString();
    const{data:fp}=allLeagueIds.length>0
      ?await db.from("posts").select("id").in("league_id",allLeagueIds).neq("author_name",name).gte("created_at",cutoff)
      :{data:[]};
    setCount(((fr||[]).length)+((ea||[]).length)+((fp||[]).length));
  };
  const loadNotifs=async()=>{
    if(!db||loading)return;setLoading(true);
    const name=profile.display_name;
    const allLeagueIds=myLeagues.map((l:any)=>l.id);
    const cutoff=new Date(Date.now()-24*60*60*1000).toISOString();
    const[{data:fr},{data:ea},{data:fp},{data:ls}]=await Promise.all([
      db.from("friends").select("*").eq("recipient_name",name).eq("status","pending"),
      allLeagueIds.length>0
        ?db.from("sessions").select("id,edit_alert,notes,created_at,league_id").not("edit_alert","is",null).in("league_id",allLeagueIds)
        :Promise.resolve({data:[]}),
      allLeagueIds.length>0
        ?db.from("posts").select("*").in("league_id",allLeagueIds).neq("author_name",name).gte("created_at",cutoff).order("created_at",{ascending:false}).limit(10)
        :Promise.resolve({data:[]}),
      allLeagueIds.length>0
        ?db.from("sessions").select("id,is_live,created_at,league_id,buy_in_amount").eq("is_live",true).in("league_id",allLeagueIds).gte("created_at",cutoff)
        :Promise.resolve({data:[]}),
    ]);
    const items:any[]=[];
    (fr||[]).forEach((f:any)=>items.push({type:"friend",id:f.id,text:`${f.requester_name} sent a friend request`,ts:f.created_at}));
    (ea||[]).forEach((s:any)=>items.push({type:"session_edit",id:s.id,text:s.edit_alert?.summary||"Stats were edited",sub:s.notes||new Date(s.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric'}),ts:s.edit_alert?.ts||s.created_at,sessionId:s.id,leagueId:s.league_id}));
    (ls||[]).forEach((s:any)=>{const lg=myLeagues.find((l:any)=>l.id===s.league_id);items.push({type:"live",id:s.id,text:`Game is live in ${lg?.name||"your league"}`,sub:`Buy-in: $${s.buy_in_amount||"?"}`,ts:s.created_at});});
    (fp||[]).forEach((p:any)=>{const lg=myLeagues.find((l:any)=>l.id===p.league_id);items.push({type:"post",id:p.id,text:p.author_name==="HomeGame"?p.content:`${p.author_name} posted in ${lg?.name||"league"}`,sub:p.author_name!=="HomeGame"?p.content?.slice(0,60):undefined,ts:p.created_at});});
    items.sort((a,b)=>new Date(b.ts).getTime()-new Date(a.ts).getTime());
    setNotifs(items.slice(0,15));setLoading(false);
  };
  const handleOpen=()=>{setOpen(o=>!o);if(!open)loadNotifs();};
  return(
    <div style={{position:"relative"}}>
      <button onClick={handleOpen} style={{background:"none",border:"none",cursor:"pointer",position:"relative",padding:4}}>
        <Icon name="bell" size={22} color={open?"#E9B949":"#666"}/>
        {count>0&&<span style={{position:"absolute",top:0,right:0,background:"#F87171",color:"#fff",borderRadius:"50%",width:16,height:16,fontSize:9,fontFamily:"'JetBrains Mono',monospace",fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1}}>{count>9?"9+":count}</span>}
      </button>
      {open&&<div style={{position:"absolute",top:36,right:0,width:280,background:"#141414",border:"1px solid rgba(233,185,73,0.2)",borderRadius:14,zIndex:200,boxShadow:"0 8px 32px rgba(0,0,0,0.6)",overflow:"hidden"}}>
        <div style={{padding:"12px 14px",borderBottom:"1px solid rgba(255,255,255,0.06)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{color:"#888",fontFamily:"'JetBrains Mono',monospace",fontSize:10,letterSpacing:1.5}}>NOTIFICATIONS</span>
          <button onClick={()=>setOpen(false)} style={{background:"none",border:"none",color:"#444",fontSize:14,cursor:"pointer"}}>✕</button>
        </div>
        {loading&&<div style={{display:"flex",justifyContent:"center",padding:20}}><Spinner size={18}/></div>}
        {!loading&&notifs.length===0&&<div style={{padding:"18px 14px",color:"#444",fontFamily:"'JetBrains Mono',monospace",fontSize:11,textAlign:"center"}}>No new notifications</div>}
        {!loading&&notifs.map((n:any,i:number)=>(
          <div key={n.id+n.type} onClick={()=>{if(n.type==="session_edit"&&onViewNotification)onViewNotification(n);setOpen(false);}} style={{padding:"11px 14px",borderBottom:i<notifs.length-1?"1px solid rgba(255,255,255,0.04)":"none",cursor:n.type==="session_edit"?"pointer":"default",background:"rgba(255,255,255,0.01)"}}>
            <div style={{display:"flex",alignItems:"flex-start",gap:9}}>
              <div style={{marginTop:1,flexShrink:0}}>{n.type==="friend"?<Icon name="person" size={16} color="#888"/>:n.type==="live"?<span style={{fontSize:14}}>♠</span>:n.type==="post"?<span style={{fontSize:14}}>◈</span>:<Icon name="warning" size={16} color="#F87171"/>}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{color:"#fff",fontSize:12,lineHeight:1.4}}>{n.text}</div>
                {n.sub&&<div style={{color:"#555",fontSize:10,fontFamily:"'JetBrains Mono',monospace",marginTop:2}}>{n.sub}</div>}
                {n.type==="session_edit"&&<div style={{color:"#8AB4FF",fontSize:9,fontFamily:"'JetBrains Mono',monospace",marginTop:3}}>tap to view →</div>}
              </div>
            </div>
          </div>
        ))}
      </div>}
    </div>
  );
}

// ─── LEAGUE HOME ───────────────────────────────────────
function LeagueHomeView({profile,myLeagues,loading,onSelectLeague,onJoinCreate,onViewPublicLeagues,onViewNotification,onViewHandRankings,onViewFriends}:any){
  const [fishOverlay,setFishOverlay]=useState<{player:any,league:any}|null>(null);

  const handleSelectLeague=async(lg:any)=>{
    // Fish of the Month: check if it should show this month
    // Shows on the last day of months 1, 2, 3 of a season (3x per season)
    // Only shows once per user per league per month (stored in localStorage)
    const now=new Date();
    const yr=now.getFullYear();const mo=now.getMonth()+1; // 1-12
    const fishKey=`hg_fish_${lg.id}_${yr}_${mo}`;
    const alreadySeen=localStorage.getItem(fishKey);
    // Check if today is the last day of any of the 3 fish-of-month windows
    // Season = 91 days. Fish shows at end of month 1 (~day 30), month 2 (~day 61), month 3 (~day 91)
    const seasonStart=new Date(lg.season_start_date||lg.created_at);
    const dayOfSeason=Math.floor((now.getTime()-seasonStart.getTime())/(86400000))+1;
    const isLastDayOfMonth1=dayOfSeason>=28&&dayOfSeason<=32;
    const isLastDayOfMonth2=dayOfSeason>=58&&dayOfSeason<=63;
    const isLastDayOfMonth3=dayOfSeason>=88&&dayOfSeason<=93;
    const isFishDay=isLastDayOfMonth1||isLastDayOfMonth2||isLastDayOfMonth3;
    if(isFishDay&&!alreadySeen&&db){
      const{data:plrs}=await db.from("players").select("id,name,total_profit,session_count").eq("league_id",lg.id).gt("session_count",0).order("total_profit",{ascending:true}).limit(1);
      const worst=plrs?.[0];
      if(worst&&worst.total_profit<0){
        const{data:prof}=await db.from("profiles").select("avatar_url").ilike("display_name",worst.name).maybeSingle();
        localStorage.setItem(fishKey,"1");
        setFishOverlay({player:{...worst,avatar_url:prof?.avatar_url||null},league:lg});
        return;
      }
    }
    onSelectLeague(lg);
  };
  return(
    <div style={{padding:"20px 16px",maxWidth:500,margin:"0 auto"}}>
      {fishOverlay&&<FishOfMonthOverlay player={fishOverlay.player} onDone={()=>{const lg=fishOverlay.league;setFishOverlay(null);onSelectLeague(lg);}}/>}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <div><div style={{display:"flex",gap:6,marginBottom:3,alignItems:"center"}}><Icon name="spade" size={14} color="#E9B949"/><span style={{color:"#F87171",fontSize:14,lineHeight:1}}>♥</span></div><div style={{fontFamily:"'Fraunces',serif",fontSize:24,color:"#E9B949"}}>Home Game</div></div>
        <div style={{display:"flex",flexDirection:"column" as const,alignItems:"flex-end",gap:4}}>
          <div style={{color:"#fff",fontSize:17,fontFamily:"'Fraunces',serif",fontWeight:700}}>{profile.display_name}</div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <button onClick={onViewFriends} style={{background:"none",border:"none",cursor:"pointer",padding:0,display:"flex",flexDirection:"column" as const,alignItems:"center",gap:2}}><div style={{width:24,height:24,borderRadius:"50%",background:"rgba(255,255,255,0.05)",border:"2px solid #333",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><Icon name="person" size={13} color="#666"/></div></button>
            <NotificationBell profile={profile} myLeagues={myLeagues} onViewNotification={onViewNotification}/>
          </div>
        </div>
      </div>
      <div style={{height:1,background:"rgba(233,185,73,0.1)",marginBottom:14}}/>

      {loading&&<div style={{display:"flex",justifyContent:"center",padding:36}}><Spinner size={30}/></div>}
      {!loading&&myLeagues.length===0&&<Card style={{marginBottom:14,textAlign:"center" as const}}><div style={{padding:"18px 0",display:"flex",flexDirection:"column" as const,alignItems:"center",gap:8}}><Icon name="spade" size={28} color="#333"/><div style={{color:"#555",fontFamily:"'JetBrains Mono',monospace",fontSize:12}}>No leagues yet — join or create one below</div></div></Card>}
      {!loading&&myLeagues.map((lg:any)=>{
        const isComm=lg.commissioner_id===lg._myUserId;
        const sessionsLeft=lg.season_length>0?lg.season_length-(lg._sessionCount||0):null;
        const est=lg.created_at?new Date(lg.created_at).toLocaleDateString('en-US',{month:'long',year:'numeric'}):null;
        return<div key={lg.id} onClick={()=>handleSelectLeague(lg)} style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(233,185,73,0.12)",borderRadius:14,padding:"14px 16px",marginBottom:9,cursor:"pointer"}}>
          <div style={{display:"flex",alignItems:"center",gap:11}}>
            <div style={{width:40,height:40,borderRadius:10,background:"rgba(233,185,73,0.1)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              {lg.is_public?<Icon name="globe" size={20} color="#8AB4FF"/>:<Icon name="spade" size={20} color="#E9B949"/>}
            </div>
            <div style={{flex:1,minWidth:0,textAlign:"center" as const}}>
              <div style={{color:"#fff",fontFamily:"'Fraunces',serif",fontSize:17,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
                {lg.name}
                {isComm&&<Icon name="crown" size={13} color="#E9B949"/>}
                {sessionsLeft!==null&&sessionsLeft<=0&&<span style={{fontSize:10,color:"#F87171",fontFamily:"'JetBrains Mono',monospace"}}>DONE</span>}
              </div>
              {lg.description&&<div style={{color:"#666",fontSize:11,marginTop:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{lg.description}</div>}
              <div style={{color:"#444",fontSize:9,fontFamily:"'JetBrains Mono',monospace",marginTop:3,display:"flex",alignItems:"center",justifyContent:"center",gap:4}}>{est?"Est. "+est:""}{lg.location_name&&<><Icon name="pin" size={8} color="#444"/>{lg.location_name}</>}</div>
            </div>
          </div>
        </div>;
      })}
      <div style={{display:"flex",gap:9,marginTop:4,marginBottom:20}}>
        <button onClick={onJoinCreate} style={{flex:2,padding:"12px 0",background:"linear-gradient(135deg,#E9B949,#F0CA5A)",border:"none",borderRadius:12,color:"#0A0A0A",fontFamily:"'JetBrains Mono',monospace",fontWeight:700,fontSize:12,letterSpacing:1.5,cursor:"pointer"}}>+ JOIN OR CREATE</button>
        <button onClick={onViewPublicLeagues} style={{flex:1,padding:"12px 0",background:"rgba(138,180,255,0.12)",border:"1px solid rgba(138,180,255,0.35)",borderRadius:12,color:"#8AB4FF",fontFamily:"'JetBrains Mono',monospace",fontWeight:700,fontSize:11,letterSpacing:1,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:5}}><Icon name="globe" size={13} color="#8AB4FF"/>PUBLIC</button>
      </div>
      <div style={{borderTop:"1px solid rgba(255,255,255,0.04)",paddingTop:16}}>
        <PokerTicker/>
        <button onClick={onViewHandRankings} style={{width:"100%",padding:"10px 0",background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:10,color:"#555",fontFamily:"'JetBrains Mono',monospace",fontSize:10,letterSpacing:1.5,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:7}}><Icon name="card" size={12} color="#555"/>HAND RANKINGS</button>
      </div>
    </div>
  );
}

const FISH_LINES=[
  "Better luck next time, champ.",
  "The table called. It wants its money back.",
  "Legend says they're still looking for their chips.",
  "Some play to win. This one plays to experience loss.",
  "The official sponsor of the rebuy button.",
  "A true student of the game. Just not a good one.",
  "Remember: poker is 100% skill. Good luck with that.",
  "Has reread 'The Theory of Poker' 12 times. Hasn't helped.",
  "Their bankroll has filed a restraining order.",
  "The human equivalent of a bad beat.",
  "Every dog has its day. This is not that day.",
  "They came, they saw, they got felted.",
  "Somewhere out there is a worse poker player. Probably.",
  "The chips went home with someone else again.",
  "Playing scared money since day one.",
];

function FishOfMonthOverlay({player,onDone}:any){
  const [line]=useState(()=>FISH_LINES[Math.floor(Math.random()*FISH_LINES.length)]);
  if(!player)return null;
  return(
    <div style={{position:"fixed",inset:0,zIndex:1200,background:"rgba(0,0,0,0.95)",display:"flex",flexDirection:"column" as const,alignItems:"center",justifyContent:"center",padding:24,animation:"fadeIn 0.3s ease"}}>
      <div style={{textAlign:"center" as const,maxWidth:300,flex:1,display:"flex",flexDirection:"column" as const,alignItems:"center",justifyContent:"center"}}>
        <div style={{color:"#4ADE80",fontSize:8,fontFamily:"'JetBrains Mono',monospace",letterSpacing:4,marginBottom:6}}>🐟 FISH OF THE MONTH</div>
        <div style={{color:"#333",fontSize:8,fontFamily:"'JetBrains Mono',monospace",letterSpacing:2,marginBottom:20}}>presenting this month's biggest loser</div>
        <div style={{position:"relative" as const,display:"inline-block",marginBottom:18}}>
          <svg viewBox="0 0 120 120" width={140} height={140} fill="none">
            <rect x="45" y="100" width="30" height="6" rx="3" fill="#2a1a0a"/>
            <rect x="50" y="94" width="20" height="8" rx="2" fill="#2a1a0a"/>
            <ellipse cx="60" cy="60" rx="32" ry="22" fill="#0d2a1a" stroke="#1a8a4a" strokeWidth="2"/>
            <path d="M92 60 L110 43 L110 77 Z" fill="#1a8a4a" opacity="0.9"/>
            <path d="M50 38 Q60 26 70 38" stroke="#1a8a4a" strokeWidth="2" fill="none"/>
            <path d="M45 72 Q52 82 60 77 Q68 82 75 72" stroke="#1a8a4a" strokeWidth="1.5" fill="none"/>
            <circle cx="38" cy="56" r="5" fill="#0a0a0a" stroke="#4ADE80" strokeWidth="1.5"/>
            <circle cx="36" cy="54" r="2" fill="#4ADE80"/>
            <path d="M28 62 Q32 67 36 62" stroke="#4ADE80" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
            {[[55,52],[65,52],[75,52],[50,62],[60,62],[70,62],[55,72],[65,72]].map(([x,y],i)=>(
              <ellipse key={i} cx={x} cy={y} rx="5" ry="3" stroke="#1a8a4a" strokeWidth="0.8" fill="none" opacity="0.5"/>
            ))}
            <ellipse cx="60" cy="60" rx="34" ry="24" stroke="#4ADE80" strokeWidth="0.5" opacity="0.2" fill="none"/>
          </svg>
          <div style={{position:"absolute" as const,top:"50%",left:"50%",transform:"translate(-28%,-58%)",width:44,height:44,borderRadius:"50%",overflow:"hidden",border:"2.5px solid #4ADE80",boxShadow:"0 0 12px rgba(74,222,128,0.5)",background:"#0a0a0a"}}>
            <Avatar name={player.name} url={player.avatar_url} size={44}/>
          </div>
        </div>
        <div style={{fontFamily:"'Fraunces',serif",fontSize:22,color:"#4ADE80",fontWeight:700,marginBottom:6}}>{player.name}</div>
        <div style={{color:"#F87171",fontSize:11,fontFamily:"'JetBrains Mono',monospace",marginBottom:16}}>{player.total_profit<0?`$${Math.abs(player.total_profit)} in the hole`:'somehow still swimming'}</div>
        <div style={{background:"rgba(74,222,128,0.06)",border:"1px solid rgba(74,222,128,0.15)",borderRadius:10,padding:"12px 16px",marginBottom:20}}>
          <div style={{color:"#666",fontSize:12,fontFamily:"'JetBrains Mono',monospace",lineHeight:1.7,fontStyle:"italic"}}>"{line}"</div>
        </div>
      </div>
      <button onClick={onDone} style={{width:"100%",maxWidth:300,padding:"13px 0",background:"rgba(74,222,128,0.12)",border:"1px solid rgba(74,222,128,0.3)",borderRadius:11,color:"#4ADE80",fontFamily:"'JetBrains Mono',monospace",fontWeight:700,fontSize:12,letterSpacing:2,cursor:"pointer",flexShrink:0,marginBottom:8}}>
        DISMISS
      </button>
    </div>
  );
}


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
        <div style={{display:"flex",borderBottom:"1px solid rgba(233,185,73,0.15)"}}>{["join","create"].map(t=><button key={t} onClick={()=>setTab(t)} style={{flex:1,padding:"13px 0",background:"none",border:"none",color:tab===t?"#E9B949":"#555",fontFamily:"'JetBrains Mono',monospace",fontSize:12,letterSpacing:1.5,textTransform:"uppercase",cursor:"pointer",borderBottom:tab===t?"2px solid #E9B949":"2px solid transparent"}}>{t==="join"?"Join":"Create"}</button>)}</div>
        <div style={{padding:20}}>
          {tab==="join"?<>
            <div style={{marginBottom:10}}>
            <label style={{color:"#888",fontSize:10,fontFamily:"'JetBrains Mono',monospace",letterSpacing:1.5,display:"block",marginBottom:6}}>INVITE CODE</label>
            <input value={code} onChange={e=>setCode(e.target.value.toUpperCase())} placeholder="e.g. FNP2026" style={{...inp,color:"#E9B949",fontSize:20,letterSpacing:4,textAlign:"center" as const}}/>
          </div>
          </>:(
            <>
              {([["LEAGUE NAME",leagueName,setLeagueName,"Friday Night Poker"],["DESCRIPTION",description,setDescription,"Weekly home game"],["SEASON NAME",season,setSeason,"Season 1"]] as any[]).map(([label,val,setter,ph])=><div key={label} style={{marginBottom:10}}><label style={{color:"#888",fontSize:10,fontFamily:"'JetBrains Mono',monospace",letterSpacing:1.5,display:"block",marginBottom:5}}>{label}</label><input value={val} onChange={(e:any)=>setter(e.target.value)} placeholder={ph} style={inp}/></div>)}
              <div style={{display:"flex",gap:10,marginBottom:10}}><div style={{flex:1}}><label style={{color:"#888",fontSize:10,fontFamily:"'JetBrains Mono',monospace",letterSpacing:1.5,display:"block",marginBottom:5}}>BUY-IN ($)</label><input type="number" value={buyIn} onChange={e=>setBuyIn(e.target.value)} style={inp}/></div><div style={{flex:1}}><label style={{color:"#888",fontSize:10,fontFamily:"'JetBrains Mono',monospace",letterSpacing:1.5,display:"block",marginBottom:5}}>SEASON LENGTH</label><input type="number" value={seasonLength} onChange={e=>setSeasonLength(e.target.value)} placeholder="0=unlimited" style={inp}/></div></div>
              <div style={{marginBottom:10}}><label style={{color:"#888",fontSize:10,fontFamily:"'JetBrains Mono',monospace",letterSpacing:1.5,display:"block",marginBottom:5}}>MAX PLAYERS</label><div style={{display:"flex",gap:5}}>{MAX_PLAYER_OPTIONS.map(n=><button key={n} onClick={()=>setMaxPlayers(n)} style={{flex:1,padding:"8px 0",borderRadius:9,background:maxPlayers===n?"rgba(233,185,73,0.2)":"rgba(255,255,255,0.04)",border:`1px solid ${maxPlayers===n?"rgba(233,185,73,0.4)":"rgba(255,255,255,0.08)"}`,color:maxPlayers===n?"#E9B949":"#555",fontFamily:"'JetBrains Mono',monospace",fontSize:11,cursor:"pointer"}}>{n}</button>)}</div></div>
              <div style={{marginBottom:10}}><label style={{color:"#888",fontSize:10,fontFamily:"'JetBrains Mono',monospace",letterSpacing:1.5,display:"block",marginBottom:5}}>LOCATION</label><div style={{display:"flex",gap:8}}><input value={locationName} onChange={e=>setLocationName(e.target.value)} placeholder="e.g. San Francisco, CA" style={{...inp,flex:1}}/><button onClick={detectLocation} style={{padding:"0 13px",background:"rgba(233,185,73,0.1)",border:"1px solid rgba(233,185,73,0.2)",borderRadius:10,color:"#E9B949",cursor:"pointer",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>{detecting?<Spinner size={13}/>:<Icon name="pin" size={14} color="#E9B949"/>}</button></div></div>
              <Toggle value={isPublic} onChange={setIsPublic} label="Public League" sub="Anyone can find & join without a code"/>
            </>
          )}
          <button onClick={()=>canSubmit&&!loading&&onEnter({tab,code,leagueName,description,buyIn:Number(buyIn),season,seasonLength:Number(seasonLength),isPublic,locationName,maxPlayers})} style={{width:"100%",padding:"12px 0",marginTop:6,background:canSubmit&&!loading?"linear-gradient(135deg,#E9B949,#F0CA5A)":"rgba(255,255,255,0.08)",border:"none",borderRadius:11,color:canSubmit&&!loading?"#0A0A0A":"#444",fontFamily:"'JetBrains Mono',monospace",fontWeight:700,fontSize:13,letterSpacing:2,cursor:canSubmit&&!loading?"pointer":"not-allowed",display:"flex",alignItems:"center",justifyContent:"center",gap:10}}>{loading?<Spinner size={16}/>:tab==="join"?"Join League →":"Create League →"}</button>
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
      <div style={{display:"flex",gap:8,marginBottom:10}}><input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Search name or city..." style={{...inp,flex:1,padding:"9px 12px",fontSize:13}}/><button onClick={detectLocation} style={{padding:"0 13px",background:"rgba(138,180,255,0.1)",border:"1px solid rgba(138,180,255,0.3)",borderRadius:10,color:"#8AB4FF",cursor:"pointer",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>{detecting?<Spinner size={13}/>:<Icon name="pin" size={14} color="#8AB4FF"/>}</button></div>
      {userLoc&&<div style={{color:"#8AB4FF",fontSize:11,fontFamily:"'JetBrains Mono',monospace",marginBottom:10,display:"flex",alignItems:"center",gap:5}}><Icon name="pin" size={11} color="#8AB4FF"/>Near {userLoc} first</div>}
      {loading&&<div style={{display:"flex",justifyContent:"center",padding:36}}><Spinner/></div>}
      {!loading&&sorted.length===0&&<Card><div style={{textAlign:"center",padding:"22px 0",color:"#555",fontFamily:"'JetBrains Mono',monospace",fontSize:12}}>No public leagues found.</div></Card>}
      {sorted.map((lg:any)=><Card key={lg.id} style={{marginBottom:11}}><div style={{display:"flex",gap:11,marginBottom:11}}><div style={{width:44,height:44,borderRadius:11,background:"rgba(138,180,255,0.15)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><Icon name="spade" size={20} color="#8AB4FF"/></div><div style={{flex:1}}><div style={{color:"#fff",fontFamily:"'Fraunces',serif",fontSize:16}}>{lg.name}</div>{lg.description&&<div style={{color:"#666",fontSize:11,marginTop:2}}>{lg.description}</div>}<div style={{color:"#555",fontSize:10,fontFamily:"'JetBrains Mono',monospace",marginTop:3,display:"flex",alignItems:"center",gap:4}}>{lg.season} · ${lg.buy_in}{lg.location_name?<><Icon name="pin" size={9} color="#8AB4FF"/><span style={{color:"#8AB4FF"}}>{lg.location_name}</span></>:null} · {lg.max_players||12} max</div></div></div><button onClick={()=>onJoin(lg)} style={{width:"100%",padding:"10px 0",background:"rgba(138,180,255,0.15)",border:"1px solid rgba(138,180,255,0.3)",borderRadius:9,color:"#8AB4FF",fontFamily:"'JetBrains Mono',monospace",fontSize:11,letterSpacing:1.5,cursor:"pointer"}}>JOIN LEAGUE →</button></Card>)}
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
        <div style={{fontFamily:"'Fraunces',serif",fontSize:26,color:"#E9B949"}}>Season Complete!</div>
        <div style={{color:"#555",fontSize:12,fontFamily:"'JetBrains Mono',monospace",marginTop:4}}>{league.name} · {league.season}</div>
      </div>
      <div style={{display:"flex",gap:8,marginBottom:14}}>
        <StatBox label="Sessions" value={sessions.length}/>
        <StatBox label="Total Pot" value={`$${totalPot}`} accent="#4ADE80"/>
        <StatBox label="Players" value={players.length}/>
      </div>
      {sorted.length>0&&<Card style={{marginBottom:12}}>
        <div style={{color:"#888",fontSize:10,fontFamily:"'JetBrains Mono',monospace",letterSpacing:2,marginBottom:14}}>FINAL STANDINGS</div>
        {sorted.map((p:any,i:number)=>{const medalColors=["#E9B949","#888888","#A0714F"];const isTop3=i<3;return<div key={p.id} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 0",borderBottom:i<sorted.length-1?"1px solid rgba(255,255,255,0.05)":"none"}}>
          <div style={{width:24,textAlign:"center",flexShrink:0}}>{isTop3?<div style={{width:20,height:20,borderRadius:"50%",background:`${medalColors[i]}22`,border:`1px solid ${medalColors[i]}66`,display:"flex",alignItems:"center",justifyContent:"center",color:medalColors[i],fontFamily:"'JetBrains Mono',monospace",fontSize:9,fontWeight:700,margin:"0 auto"}}>{i+1}</div>:<span style={{color:"#333",fontFamily:"'JetBrains Mono',monospace",fontSize:11}}>{i+1}</span>}</div>
          <Avatar name={p.name} size={34} streak={p.streak||0}/>
          <div style={{flex:1}}><div style={{color:"#fff",fontSize:13}}>{p.name}</div><div style={{color:"#555",fontSize:10,fontFamily:"'JetBrains Mono',monospace"}}>{p.session_count} games · {p.wins}W</div></div>
          <div style={{color:p.total_profit>=0?"#4ADE80":"#F87171",fontFamily:"'JetBrains Mono',monospace",fontWeight:700,fontSize:13}}>{fmtProfit(p.total_profit)}</div>
        </div>;})}
      </Card>}
      <Card style={{marginBottom:12}}>
        <div style={{color:"#888",fontSize:10,fontFamily:"'JetBrains Mono',monospace",letterSpacing:2,marginBottom:12}}>SEASON AWARDS</div>
        {sorted[0]&&<div style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid rgba(255,255,255,0.05)"}}><span style={{color:"#555",fontFamily:"'JetBrains Mono',monospace",fontSize:11,display:"flex",alignItems:"center",gap:5}}><Icon name="star" size={11} color="#555"/>Most Profitable</span><span style={{color:"#4ADE80",fontFamily:"'JetBrains Mono',monospace",fontWeight:700}}>{sorted[0].name}</span></div>}
        {topChicken&&<div style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid rgba(255,255,255,0.05)"}}><span style={{color:"#555",fontFamily:"'JetBrains Mono',monospace",fontSize:11,display:"flex",alignItems:"center",gap:5}}><Icon name="drumstick" size={11} color="#555"/>Most Chicken Dinners</span><span style={{color:"#E9B949",fontFamily:"'JetBrains Mono',monospace",fontWeight:700}}>{topChicken[0]} ×{topChicken[1]}</span></div>}
        {mostSessions&&<div style={{display:"flex",justifyContent:"space-between",padding:"8px 0"}}><span style={{color:"#555",fontFamily:"'JetBrains Mono',monospace",fontSize:11,display:"flex",alignItems:"center",gap:5}}><Icon name="card" size={11} color="#555"/>Most Sessions</span><span style={{color:"#fff",fontFamily:"'JetBrains Mono',monospace",fontWeight:700}}>{mostSessions.name} ({mostSessions.session_count})</span></div>}
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
    if(sortBy==='profit')return{val:`${fmtProfit(p.total_profit)}`,color:p.total_profit>=0?"#4ADE80":"#F87171"};
    if(sortBy==='winpct'){const pct=p.session_count>0?((p.wins/p.session_count)*100).toFixed(0):0;return{val:`${pct}%`,color:"#8AB4FF"};}
    if(sortBy==='time')return{val:fmtSeconds(p.time_played_seconds||0)||"—",color:"#888"};
    if(sortBy==='chicken')return{val:`${p.chicken_dinners||0}`,color:"#E9B949"};
    return{val:"—",color:"#888"};
  };
  const getSubStat=(p:any)=>{
    const winPct=p.session_count>0?((p.wins/p.session_count)*100).toFixed(0):0;
    return`${p.session_count} sessions · ${winPct}% win`;
  };
  return(
    <div style={{maxWidth:500,margin:"0 auto"}}>
      <div style={{background:"linear-gradient(180deg,rgba(19,19,23,0.98) 0%,transparent 100%)",padding:"18px 16px 0"}}>
        <div style={{display:"flex",alignItems:"center",gap:11,marginBottom:12}}>
          <button onClick={onBack} style={{background:"none",border:"none",color:"#555",fontSize:22,cursor:"pointer"}}>←</button>
          <div style={{flex:1,minWidth:0}}><div style={{fontFamily:"'Fraunces',serif",fontSize:21,fontWeight:700,color:"#fff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{league.name}</div>{league.description&&<div style={{color:"#666",fontSize:11,marginTop:1}}>{league.description}</div>}</div>
          {isCommissioner&&<button onClick={onCommSettings} style={{background:"rgba(233,185,73,0.1)",border:"1px solid rgba(233,185,73,0.2)",borderRadius:20,padding:"5px 10px",color:"#E9B949",fontFamily:"'JetBrains Mono',monospace",fontSize:9,cursor:"pointer",flexShrink:0,display:"flex",alignItems:"center",gap:4}}><Icon name="crown" size={11} color="#E9B949"/> MANAGE</button>}
        </div>
        {seasonDone&&<div style={{background:"rgba(248,113,113,0.1)",border:"1px solid rgba(248,113,113,0.3)",borderRadius:10,padding:"9px 14px",marginBottom:10,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <span style={{color:"#F87171",fontFamily:"'JetBrains Mono',monospace",fontSize:11}}>🏁 Season complete — {sessions.length} sessions</span>
          <button onClick={onSeasonRecap} style={{padding:"3px 10px",background:"rgba(248,113,113,0.15)",border:"1px solid rgba(248,113,113,0.3)",borderRadius:20,color:"#F87171",fontFamily:"'JetBrains Mono',monospace",fontSize:10,cursor:"pointer"}}>VIEW RECAP</button>
        </div>}
        {sessionsLeft!==null&&sessionsLeft>0&&sessionsLeft<=3&&<div style={{background:"rgba(233,185,73,0.08)",border:"1px solid rgba(233,185,73,0.2)",borderRadius:10,padding:"9px 14px",marginBottom:10,color:"#E9B949",fontFamily:"'JetBrains Mono',monospace",fontSize:11,textAlign:"center" as const,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}><Icon name="warning" size={12} color="#E9B949"/>Only {sessionsLeft} session{sessionsLeft!==1?"s":""} left in the season!</div>}
        <div style={{display:"flex",gap:7,marginBottom:11}}>
          <StatBox label="Members" value={`${players.length}/${league.max_players||12}`}/>
          <StatBox label="Sessions" value={sessions.length}/>
          <StatBox label="Last Buy-in" value={sessions[0]?.buy_in_amount?`$${sessions[0].buy_in_amount}`:`$${league.buy_in}`} accent="#4ADE80"/>
          <StatBox label="All-Time Vol" value={`$${sessions.reduce((a:number,s:any)=>a+(s.pot||0),0).toLocaleString()}`} accent="#E9B949"/>
        </div>
        {/* Code / Location / Invite — evenly spaced */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,gap:8}}>
          <span style={{color:league.is_public?"#8AB4FF":"#E9B949",fontSize:12,fontFamily:"'JetBrains Mono',monospace",letterSpacing:3,background:league.is_public?"rgba(138,180,255,0.1)":"rgba(233,185,73,0.1)",padding:"4px 10px",borderRadius:8,flexShrink:0}}>{league.is_public?"PUBLIC":league.code}</span>
          <span style={{color:"#555",fontSize:10,fontFamily:"'JetBrains Mono',monospace",flex:1,textAlign:"center" as const,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",display:"flex",alignItems:"center",justifyContent:"center",gap:4}}>{league.location_name?<><Icon name="pin" size={10} color="#555"/>{league.location_name}</>:(league.is_public?<><Icon name="globe" size={10} color="#8AB4FF"/>Public</>:"")}</span>
          <button onClick={copyInviteLink} style={{padding:"4px 12px",background:"rgba(74,222,128,0.1)",border:"1px solid rgba(74,222,128,0.3)",borderRadius:20,color:"#4ADE80",fontFamily:"'JetBrains Mono',monospace",fontSize:10,cursor:"pointer",letterSpacing:1,flexShrink:0,display:"flex",alignItems:"center",gap:5}}><Icon name="link" size={11} color="#4ADE80"/>Invite</button>
        </div>
      </div>
      <div style={{padding:"0 16px 20px"}}>
        <SeasonCountdown league={league} isCommissioner={isCommissioner} onEndSeason={onEndSeason}/>
        {liveSession&&<div onClick={onStartSession} style={{background:"rgba(74,222,128,0.1)",border:"1px solid rgba(74,222,128,0.4)",borderRadius:13,padding:"13px 16px",marginBottom:12,cursor:"pointer",display:"flex",alignItems:"center",gap:11}}><div style={{width:9,height:9,borderRadius:"50%",background:"#4ADE80",animation:"pulse 1.5s infinite",flexShrink:0}}/><div style={{flex:1}}><div style={{color:"#4ADE80",fontFamily:"'JetBrains Mono',monospace",fontSize:11,letterSpacing:2}}>● GAME IS LIVE</div><div style={{color:"#888",fontSize:11,marginTop:1}}>Tap to enter your stats</div></div><span style={{color:"#4ADE80",fontSize:20}}>›</span></div>}
        {!liveSession&&<button onClick={onStartSession} style={{width:"100%",padding:"12px 0",marginBottom:12,background:"linear-gradient(135deg,#1a4a2a,#2a6a3a)",border:"1px solid rgba(74,222,128,0.4)",borderRadius:13,color:"#4ADE80",fontFamily:"'JetBrains Mono',monospace",fontWeight:700,fontSize:12,letterSpacing:2,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:9}}><span style={{fontSize:17}}>♠</span> START TONIGHT'S SESSION</button>}
        <div style={{marginBottom:9}}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search players..." style={{...inp,padding:"7px 11px",fontSize:12}}/>
        </div>
        {/* Sort bar */}
        <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:11}}>
          <div style={{display:"flex",gap:5,overflowX:"auto",flex:1,scrollbarWidth:"none",msOverflowStyle:"none",WebkitOverflowScrolling:"touch"} as any}>
            <style>{`.sort-bar::-webkit-scrollbar{display:none}`}</style>
            <div className="sort-bar" style={{display:"flex",gap:5,minWidth:"max-content"}}>
              {([['profit','$ P/L'],['winpct','WIN %'],['time','TIME PLAYED'],['chicken','DINNERS']] as any[]).map(([k,l])=><button key={k} onClick={()=>setSortBy(k)} style={{padding:"4px 11px",borderRadius:20,background:sortBy===k?"rgba(233,185,73,0.2)":"rgba(255,255,255,0.04)",border:`1px solid ${sortBy===k?"rgba(233,185,73,0.4)":"rgba(255,255,255,0.08)"}`,color:sortBy===k?"#E9B949":"#555",fontFamily:"'JetBrains Mono',monospace",fontSize:10,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0,display:"flex",alignItems:"center",gap:4}}>{k==='chicken'&&<Icon name="drumstick" size={10} color={sortBy===k?"#E9B949":"#555"}/>}{l}</button>)}
            </div>
          </div>
        </div>
        <Card style={{padding:0,overflow:"hidden",marginBottom:12}}>
          {getSorted().length===0&&<div style={{color:"#555",fontFamily:"'JetBrains Mono',monospace",fontSize:12,textAlign:"center",padding:"22px 0"}}>{search?"No players match your search":"No members yet"}</div>}
          {getSorted().map((p:any,i:number)=>{
            const isComm=p.name.toLowerCase()===league.commissioner_name?.toLowerCase();
            const medals=["1","2","3"];const isTop3=i<3&&!search;
            const medalColors=["#E9B949","#888888","#A0714F"];
            const{val,color}=getPrimaryStatValue(p);
            return<div key={p.id} onClick={()=>onViewPlayer(p)} style={{display:"flex",alignItems:"center",gap:11,padding:"12px 16px",borderBottom:"1px solid rgba(255,255,255,0.05)",cursor:"pointer",background:i===0&&!search?"rgba(233,185,73,0.03)":"transparent"}}>
              <div style={{width:22,textAlign:"center",flexShrink:0}}>{isTop3?<div style={{width:20,height:20,borderRadius:"50%",background:`${medalColors[i]}22`,border:`1px solid ${medalColors[i]}66`,display:"flex",alignItems:"center",justifyContent:"center",color:medalColors[i],fontFamily:"'JetBrains Mono',monospace",fontSize:9,fontWeight:700,margin:"0 auto"}}>{medals[i]}</div>:<span style={{color:"#333",fontFamily:"'JetBrains Mono',monospace",fontSize:11}}>{i+1}</span>}</div>
              <Avatar name={p.name} size={38}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{color:"#fff",fontSize:13,display:"flex",alignItems:"center",gap:4}}>{p.name.length>13?p.name.slice(0,13)+"…":p.name} {isComm&&<Icon name="crown" size={12} color="#E9B949"/>}</div>
                <div style={{color:"#555",fontSize:10,fontFamily:"'JetBrains Mono',monospace",marginTop:1}}>{getSubStat(p)}</div>
              </div>
              <div style={{textAlign:"right",flexShrink:0}}>
                <div style={{color,fontFamily:"'JetBrains Mono',monospace",fontWeight:700,fontSize:15}}>{val}</div>
              </div>
            </div>;
          })}
        </Card>
        {sessions.length>0&&<Card style={{marginBottom:12}}>
          <div style={{color:"#888",fontSize:10,fontFamily:"'JetBrains Mono',monospace",letterSpacing:2,marginBottom:11}}>PAST SESSIONS</div>
          {sessions.slice(0,6).map((s:any,i:number)=>{
            const d=new Date(s.created_at);
            const title=s.notes||`${d.toLocaleDateString('en-US',{month:'short',day:'numeric'})} · $${s.pot} pot`;
            return<div key={s.id} onClick={()=>onViewSession(s)} style={{display:"flex",alignItems:"center",gap:9,padding:"10px 0",borderBottom:i<Math.min(sessions.length,6)-1?"1px solid rgba(255,255,255,0.05)":"none",cursor:"pointer"}}>
              <div style={{width:32,textAlign:"center",flexShrink:0}}>
                <div style={{color:"#E9B949",fontSize:13,fontFamily:"'JetBrains Mono',monospace",fontWeight:700}}>{d.getDate()}</div>
                <div style={{color:"#555",fontSize:9,fontFamily:"'JetBrains Mono',monospace"}}>{d.toLocaleDateString('en-US',{month:'short'})}</div>
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
                  <div style={{color:"#fff",fontSize:13,display:"flex",alignItems:"center",gap:5,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{title.length>28?title.slice(0,28)+"…":title}{s.locked&&<Icon name="lock" size={11} color="#666"/>}{s.edit_alert&&<Icon name="warning" size={11} color="#F87171"/>}</div>
                  {s.chicken_dinner_name&&<div style={{color:"#E9B949",fontFamily:"'Fraunces',serif",fontSize:14,fontWeight:700,flexShrink:0,whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:4}}><Icon name="drumstick" size={13} color="#E9B949"/>{s.chicken_dinner_name}</div>}
                </div>
                <div style={{color:"#555",fontSize:10,fontFamily:"'JetBrains Mono',monospace",marginTop:2}}>${s.pot} pot{s.buy_in_amount?` · $${s.buy_in_amount} buy-in`:""}</div>
              </div>
              <span style={{color:"#555",fontSize:16,flexShrink:0}}>›</span>
            </div>;
          })}
        </Card>}
        <button onClick={onViewSeasonArchive} style={{width:"100%",padding:"9px 0",marginBottom:9,background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:11,color:"#555",fontFamily:"'JetBrains Mono',monospace",fontSize:10,letterSpacing:1.5,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}><Icon name="trophy" size={11} color="#555"/>SEASON ARCHIVE</button>
        <button onClick={onLeaveLeague} style={{width:"100%",padding:"10px 0",background:"rgba(248,113,113,0.05)",border:"1px solid rgba(248,113,113,0.12)",borderRadius:11,color:"#F87171",fontFamily:"'JetBrains Mono',monospace",fontSize:10,letterSpacing:1.5,cursor:"pointer"}}>LEAVE LEAGUE</button>
      </div>
    </div>
  );
}

// ─── SEASON COUNTDOWN ───────────────────────────────────
function SeasonCountdown({league,isCommissioner,onEndSeason}:any){
  const [now,setNow]=useState(new Date());
  useEffect(()=>{const t=setInterval(()=>setNow(new Date()),60000);return()=>clearInterval(t);},[]);

  // Global quarterly calendar — seasons are fixed Jan/Apr/Jul/Oct
  const SEASON_DAYS=91;
  const seasonNum=league.season_number||1;

  // Determine which global quarter we're in based on today's date
  const getGlobalSeasonBounds=(d:Date)=>{
    const y=d.getFullYear();const m=d.getMonth();
    let start:Date,name:string;
    if(m<3){start=new Date(y,0,1);name=`Winter ${y}`;}
    else if(m<6){start=new Date(y,3,1);name=`Spring ${y}`;}
    else if(m<9){start=new Date(y,6,1);name=`Summer ${y}`;}
    else{start=new Date(y,9,1);name=`Fall ${y}`;}
    const end=new Date(start.getTime()+SEASON_DAYS*24*60*60*1000);
    return{start,end,name};
  };

  const{start,end,name}=getGlobalSeasonBounds(now);
  const msLeft=end.getTime()-now.getTime();
  const daysLeft=Math.max(0,Math.ceil(msLeft/(1000*60*60*24)));
  const pct=Math.min(100,Math.max(0,((now.getTime()-start.getTime())/SEASON_DAYS/86400000)*100));
  const seasonOver=msLeft<=0;

  return(
    <div style={{marginBottom:12,background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:13,padding:"11px 14px"}}>
      {/* Single row: season name left, days right */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        <div style={{color:"#888",fontSize:10,fontFamily:"'JetBrains Mono',monospace",letterSpacing:1.5}}>
          SEASON {seasonNum} · <span style={{color:"#aaa"}}>{name}</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          {seasonOver
            ?<span style={{color:"#F87171",fontSize:11,fontFamily:"'JetBrains Mono',monospace"}}>COMPLETE</span>
            :<span style={{color:"#E9B949",fontSize:15,fontFamily:"'Fraunces',serif",fontWeight:700}}>{daysLeft}<span style={{color:"#666",fontSize:10,fontFamily:"'JetBrains Mono',monospace",marginLeft:4}}>days left</span></span>
          }
          {isCommissioner&&seasonOver&&<button onClick={onEndSeason} style={{padding:"3px 10px",background:"rgba(233,185,73,0.15)",border:"1px solid rgba(233,185,73,0.3)",borderRadius:20,color:"#E9B949",fontFamily:"'JetBrains Mono',monospace",fontSize:9,cursor:"pointer"}}>END SEASON →</button>}
        </div>
      </div>
      {/* Progress bar with fish-of-month markers */}
      <div style={{position:"relative" as const,height:3,background:"rgba(255,255,255,0.05)",borderRadius:2,marginTop:4}}>
        <div style={{height:"100%",width:`${pct}%`,background:seasonOver?"#F87171":"linear-gradient(90deg,rgba(233,185,73,0.6),#E9B949)",borderRadius:2,transition:"width 0.5s",position:"relative" as const}}/>
        {/* Fish of month dots at ~33% and ~66% */}
        <div style={{position:"absolute" as const,top:"50%",left:"33.3%",transform:"translate(-50%,-50%)",width:7,height:7,borderRadius:"50%",background:pct>=33?"#4ADE80":"#1a3a2a",border:`1px solid ${pct>=33?"#4ADE80":"#2a4a3a"}`,zIndex:2,transition:"background 0.5s"}}/>
        <div style={{position:"absolute" as const,top:"50%",left:"66.6%",transform:"translate(-50%,-50%)",width:7,height:7,borderRadius:"50%",background:pct>=67?"#4ADE80":"#1a3a2a",border:`1px solid ${pct>=67?"#4ADE80":"#2a4a3a"}`,zIndex:2,transition:"background 0.5s"}}/>
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
      {!loading&&archives.length===0&&<Card><div style={{textAlign:"center" as const,padding:"20px 0",color:"#555",fontFamily:"'JetBrains Mono',monospace",fontSize:11}}>No completed seasons yet.</div></Card>}
      {archives.map((a:any)=>(
        <Card key={a.id} style={{marginBottom:10,cursor:"pointer"}} onClick={()=>onViewArchive(a)}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{width:36,height:36,borderRadius:9,background:"rgba(233,185,73,0.1)",border:"1px solid rgba(233,185,73,0.2)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              <span style={{color:"#E9B949",fontFamily:"'JetBrains Mono',monospace",fontSize:11,fontWeight:700}}>S{a.season_number}</span>
            </div>
            <div style={{flex:1}}>
              <div style={{color:"#fff",fontSize:13,fontFamily:"'Fraunces',serif"}}>{a.season_name||`Season ${a.season_number}`}</div>
              <div style={{color:"#555",fontSize:10,fontFamily:"'JetBrains Mono',monospace",marginTop:2}}>
                {a.ended_at?new Date(a.ended_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}):""}
                {a.winner_name&&<span style={{color:"#E9B949",marginLeft:8}}>🏆 {a.winner_name}</span>}
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
        <div style={{color:"#888",fontSize:9,fontFamily:"'JetBrains Mono',monospace",letterSpacing:2,marginBottom:4}}>{league.name}</div>
        <div style={{fontFamily:"'Fraunces',serif",fontSize:22,color:"#E9B949"}}>{archive.season_name||`Season ${archive.season_number}`}</div>
        {archive.winner_name&&<div style={{color:"#4ADE80",fontSize:12,fontFamily:"'JetBrains Mono',monospace",marginTop:4}}>🏆 {archive.winner_name}</div>}
        <div style={{color:"#555",fontSize:10,fontFamily:"'JetBrains Mono',monospace",marginTop:4}}>{sessions.length} sessions played</div>
      </div>
      {players.length>0&&<Card style={{marginBottom:12}}>
        <div style={{color:"#888",fontSize:10,fontFamily:"'JetBrains Mono',monospace",letterSpacing:2,marginBottom:11}}>FINAL STANDINGS</div>
        {players.map((p:any,i:number)=>{
          const medal=["#E9B949","#888888","#A0714F"][i];
          return<div key={p.id||i} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:i<players.length-1?"1px solid rgba(255,255,255,0.05)":"none"}}>
            <div style={{width:22,flexShrink:0,textAlign:"center" as const}}>
              {i<3?<div style={{width:18,height:18,borderRadius:"50%",background:`${medal}22`,border:`1px solid ${medal}66`,display:"flex",alignItems:"center",justifyContent:"center",color:medal,fontSize:8,fontFamily:"'JetBrains Mono',monospace",fontWeight:700,margin:"0 auto"}}>{i+1}</div>
              :<span style={{color:"#333",fontSize:10,fontFamily:"'JetBrains Mono',monospace"}}>{i+1}</span>}
            </div>
            <Avatar name={p.name} size={30}/>
            <div style={{flex:1}}><div style={{color:"#fff",fontSize:12}}>{p.name}</div><div style={{color:"#555",fontSize:9,fontFamily:"'JetBrains Mono',monospace"}}>{p.session_count}G · {p.wins}W</div></div>
            <div style={{color:p.total_profit>=0?"#4ADE80":"#F87171",fontFamily:"'JetBrains Mono',monospace",fontWeight:700,fontSize:12}}>{fmtProfit(p.total_profit)}</div>
          </div>;
        })}
      </Card>}
      {sessions.length>0&&<Card style={{marginBottom:12}}>
        <div style={{color:"#888",fontSize:10,fontFamily:"'JetBrains Mono',monospace",letterSpacing:2,marginBottom:11}}>SESSIONS</div>
        {sessions.map((s:any,i:number)=>{
          const d=new Date(s.created_at);
          return<div key={s.id||i} style={{display:"flex",alignItems:"center",gap:9,padding:"9px 0",borderBottom:i<sessions.length-1?"1px solid rgba(255,255,255,0.05)":"none"}}>
            <div style={{width:32,textAlign:"center" as const,flexShrink:0}}>
              <div style={{color:"#E9B949",fontSize:12,fontFamily:"'JetBrains Mono',monospace",fontWeight:700}}>{d.getDate()}</div>
              <div style={{color:"#555",fontSize:9,fontFamily:"'JetBrains Mono',monospace"}}>{d.toLocaleDateString('en-US',{month:'short'})}</div>
            </div>
            <div style={{flex:1}}>
              <div style={{color:"#fff",fontSize:12}}>{s.notes||`$${s.pot} pot`}</div>
              {s.chicken_dinner_name&&<div style={{color:"#E9B949",fontSize:10,fontFamily:"'JetBrains Mono',monospace"}}><Icon name="drumstick" size={9} color="#E9B949"/> {s.chicken_dinner_name}</div>}
            </div>
            <div style={{color:"#555",fontSize:10,fontFamily:"'JetBrains Mono',monospace"}}>${s.pot}</div>
          </div>;
        })}
      </Card>}
    </div>
  );
}
function SessionDetailView({session,league,players,profile,isCommissioner,onBack,onSaved,onBadgeCheck,showToast,showError}:any){
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
      const newPot=entries.reduce((a:number,e:any)=>a+(e.buy_in||0)*(1+(e.rebuys||0)),0)||Number(editedPot)||entries.reduce((a,e)=>{
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
      const newPot=Math.max(0,(session.pot||0)-(entry.buy_in||0)*(1+(entry.rebuys||0)));
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

      const realPot=(freshEntries||[]).reduce((a:number,e:any)=>a+(e.buy_in||0)*(1+(e.rebuys||0)),0);
      await db.from("sessions").update({locked:true,locked_at:new Date().toISOString(),edit_alert:null,stats_committed:true,pot:realPot}).eq("id",session.id);

      // Compute session achievements for each player and post to feed
      const sessionAchievements:string[]=[];
      for(const e of (freshEntries||[])){
        if(!e.players?.name)continue;
        const pName=e.players.name;
        const profit=e.profit||0;const bi=e.buy_in||0;const rb=e.rebuys||0;const elapsed=sessionRow?.duration_seconds||0;
        const isWinner=(sessionRow?.chicken_dinner_name||"").toLowerCase()===pName.toLowerCase();
        const earned:string[]=[];
        if(isWinner&&rb===0)earned.push("Carnivore");
        if(realPot>0&&profit>=realPot*0.8)earned.push("Get Wrecked");
        if(rb>=4&&profit<0)earned.push("The Whale");
        if(elapsed>0&&elapsed<2700&&profit>=bi&&bi>0)earned.push("Flash Fortune");
        if(profit===0)earned.push("Ice Cold");
        if(profit>=bi*2&&bi>0)earned.push("Robbery");
        if(earned.length>0)sessionAchievements.push(`${pName} earned ${earned.map(a=>`'${a}'`).join(" & ")}`);
      }
      if(sessionAchievements.length>0){
        const content=`🏆 Session achievements: ${sessionAchievements.join(" · ")}`;
        await db.from("posts").insert({league_id:session.league_id,author_name:"HomeGame",content,session_id:session.id});
      }

      setIsLocked(true);
      showToast("Session locked — stats committed to profiles");if(onBadgeCheck)setTimeout(onBadgeCheck,1500);
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
      {isCommissioner&&session.edit_alert&&<div style={{background:"rgba(248,113,113,0.1)",border:"1px solid rgba(248,113,113,0.35)",borderRadius:11,padding:"10px 14px",marginBottom:12,display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
        <div><div style={{color:"#F87171",fontFamily:"'JetBrains Mono',monospace",fontSize:10,letterSpacing:1,marginBottom:2,display:"flex",alignItems:"center",gap:5}}><Icon name="warning" size={12} color="#F87171"/> STATS WERE EDITED</div><div style={{color:"#aaa",fontSize:11}}>{session.edit_alert.summary||`Updated by ${session.edit_alert.editor}`}</div></div>
        <button onClick={handleDismissAlert} style={{padding:"3px 9px",background:"rgba(248,113,113,0.15)",border:"1px solid rgba(248,113,113,0.3)",borderRadius:20,color:"#F87171",fontFamily:"'JetBrains Mono',monospace",fontSize:9,cursor:"pointer",flexShrink:0}}>DISMISS</button>
      </div>}

      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
        <div style={{flex:1,minWidth:0,marginRight:10}}>
          {renamingTitle
            ?<div style={{display:"flex",gap:7,alignItems:"center"}}>
              <input value={titleInput} onChange={e=>setTitleInput(e.target.value)} placeholder="Name this session..." style={{...inp,fontSize:14,flex:1,padding:"7px 11px"}} autoFocus/>
              <button onClick={handleSaveTitle} disabled={saving} style={{padding:"7px 12px",background:"rgba(233,185,73,0.15)",border:"1px solid rgba(233,185,73,0.3)",borderRadius:9,color:"#E9B949",fontFamily:"'JetBrains Mono',monospace",fontSize:10,cursor:"pointer",flexShrink:0}}>{saving?"...":"✓"}</button>
              <button onClick={()=>setRenamingTitle(false)} style={{padding:"7px 10px",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:9,color:"#555",fontFamily:"'JetBrains Mono',monospace",fontSize:10,cursor:"pointer",flexShrink:0}}>✕</button>
            </div>
            :<div style={{display:"flex",alignItems:"baseline",gap:9,flexWrap:"wrap"}}>
              <div style={{color:"#555",fontSize:10,fontFamily:"'JetBrains Mono',monospace",letterSpacing:1,flexShrink:0}}>{d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}{showLockCountdown&&<span style={{color:"#333",marginLeft:7}}>{hoursUntilLock===0?"locks soon":`locks in ${hoursUntilLock}h`}</span>}</div>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <div style={{fontFamily:"'Fraunces',serif",fontSize:20,color:"#fff"}}>{session.notes||"Session Results"}</div>
                <button onClick={()=>{setTitleInput(session.notes||"");setRenamingTitle(true);}} style={{background:"none",border:"none",color:"#333",fontSize:11,cursor:"pointer",padding:"2px 4px",fontFamily:"'JetBrains Mono',monospace"}}>✏</button>
              </div>
            </div>}
        </div>
        <div style={{display:"flex",gap:7,flexShrink:0}}>
          {isCommissioner&&<button onClick={handleToggleLock} style={{padding:"6px 11px",background:isLocked?"rgba(233,185,73,0.1)":"rgba(255,255,255,0.05)",border:`1px solid ${isLocked?"rgba(233,185,73,0.3)":"rgba(255,255,255,0.1)"}`,borderRadius:20,color:isLocked?"#E9B949":"#666",fontFamily:"'JetBrains Mono',monospace",fontSize:9,cursor:"pointer",display:"flex",alignItems:"center",gap:5}}><Icon name={isLocked?"unlock":"lock"} size={12} color={isLocked?"#E9B949":"#666"}/>{isLocked?"UNLOCK":"LOCK"}</button>}
          {canEdit&&<button onClick={()=>setEditing(!editing)} style={{padding:"6px 13px",background:editing?"rgba(233,185,73,0.15)":"rgba(255,255,255,0.06)",border:`1px solid ${editing?"rgba(233,185,73,0.3)":"rgba(255,255,255,0.1)"}`,borderRadius:20,color:editing?"#E9B949":"#888",fontFamily:"'JetBrains Mono',monospace",fontSize:10,cursor:"pointer"}}>{editing?"CANCEL":"EDIT"}</button>}
        </div>
      </div>

      <Card style={{marginBottom:12}}>
        <div style={{display:"flex",gap:12}}>
          <div style={{flex:1,textAlign:"center"}}>
            <div style={{color:"#555",fontSize:9,fontFamily:"'JetBrains Mono',monospace",letterSpacing:2}}>POT</div>
            <div style={{color:"#E9B949",fontSize:24,fontFamily:"'JetBrains Mono',monospace",fontWeight:700,marginTop:2}}>
                ${entries.length>0
                  ? entries.reduce((a:number,e:any)=>(a+(e.buy_in||0)*(1+(e.rebuys||0))),0)
                  : (session.pot||0)}
              </div>
          </div>
          <div style={{flex:1,textAlign:"center"}}>
            <div style={{color:"#555",fontSize:9,fontFamily:"'JetBrains Mono',monospace",letterSpacing:2}}>BUY-IN</div>
            {editing?<input type="number" value={buyInAmount} onChange={e=>setBuyInAmount(e.target.value)} style={{...inp,textAlign:"center" as const,fontSize:20,marginTop:4}}/>:<div style={{color:"#888",fontSize:24,fontFamily:"'JetBrains Mono',monospace",fontWeight:700,marginTop:2}}>${session.buy_in_amount||league.buy_in}</div>}
          </div>
        </div>
        {session.notes&&!editing&&<div style={{marginTop:10,paddingTop:10,borderTop:"1px solid rgba(255,255,255,0.05)",color:"#666",fontSize:12,fontStyle:"italic"}}>"{session.notes}"</div>}
        {editing&&<div style={{marginTop:10}}><label style={{color:"#888",fontSize:10,fontFamily:"'JetBrains Mono',monospace",marginBottom:5,display:"block"}}>SESSION NOTES</label><input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="e.g. Played at Nick's — wild night" style={inp}/></div>}
      </Card>

      <Card style={{marginBottom:12}}>
        <div style={{color:"#888",fontSize:10,fontFamily:"'JetBrains Mono',monospace",letterSpacing:2,marginBottom:11}}>RESULTS</div>
        {loading&&<div style={{display:"flex",justifyContent:"center",padding:16}}><Spinner/></div>}
        {[...entries].sort((a:any,b:any)=>(editing?getProfit(b.id)-getProfit(a.id):(b.profit||0)-(a.profit||0))).map((e:any,i:number)=>{
          const guestNote=!e.players&&e.notes?.startsWith('guest:')?e.notes.slice(6):null;
          const name=e.players?.name||(guestNote?`${guestNote} (guest)`:(!e.players?'Guest':'Unknown'));
          const profit=editing?getProfit(e.id):(e.profit||0);
          const ee=editedEntries[e.id]||{buy_in:String(e.buy_in||0),rebuys:String(e.rebuys||0),cash_out:String(e.cash_out||0)};
          // Compute session achievements for display
          const sessionPot=entries.reduce((a:number,en:any)=>a+(en.buy_in||0)*(1+(en.rebuys||0)),0);
          const sessionAchs:string[]=[];
          if(isLocked&&e.players?.name){
            const isW=(session.chicken_dinner_name||"").toLowerCase()===e.players.name.toLowerCase();
            if(isW&&(e.rebuys||0)===0)sessionAchs.push("Carnivore");
            if(sessionPot>0&&profit>=sessionPot*0.8)sessionAchs.push("Get Wrecked");
            if((e.rebuys||0)>=4&&profit<0)sessionAchs.push("The Whale");
            const dur=session.duration_seconds||0;if(dur>0&&dur<2700&&profit>=(e.buy_in||0)&&(e.buy_in||0)>0)sessionAchs.push("Flash Fortune");
            if(profit===0)sessionAchs.push("Ice Cold");
            if(profit>=(e.buy_in||0)*2&&(e.buy_in||0)>0)sessionAchs.push("Robbery");
          }
          return<div key={e.id} style={{padding:"9px 0",borderBottom:i<entries.length-1?"1px solid rgba(255,255,255,0.05)":"none"}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:editing?7:0}}>
              <Avatar name={name} size={34} streak={e.players?.streak||0}/>
              <div style={{flex:1}}>
                <div style={{color:"#fff",fontSize:13}}>{name}</div>
                {!editing&&<div style={{color:"#555",fontSize:10,fontFamily:"'JetBrains Mono',monospace"}}>in: ${(e.buy_in||0)*(1+(e.rebuys||0))} · rebuys: {e.rebuys||0} · out: ${e.cash_out||0}</div>}
                {!editing&&sessionAchs.length>0&&<div style={{display:"flex",flexWrap:"wrap" as const,gap:3,marginTop:4}}>{sessionAchs.map((a:string)=><span key={a} style={{background:"rgba(233,185,73,0.12)",border:"1px solid rgba(233,185,73,0.25)",borderRadius:10,color:"#E9B949",fontSize:8,fontFamily:"'JetBrains Mono',monospace",padding:"2px 6px",letterSpacing:0.5}}>🏆 {a}</span>)}</div>}
              </div>
              <div style={{color:profit>=0?"#4ADE80":"#F87171",fontFamily:"'JetBrains Mono',monospace",fontWeight:700,fontSize:13}}>{fmtProfit(profit)}</div>
              {editing&&isCommissioner&&<button onClick={()=>handleRemovePlayer(e)} style={{marginLeft:4,padding:"3px 7px",background:"rgba(248,113,113,0.1)",border:"1px solid rgba(248,113,113,0.25)",borderRadius:20,color:"#F87171",fontFamily:"'JetBrains Mono',monospace",fontSize:9,cursor:"pointer",flexShrink:0}}>✕</button>}
            </div>
            {editing&&<div style={{display:"flex",gap:6,marginLeft:44}}>
              <div style={{flex:1}}><div style={{color:"#666",fontSize:9,fontFamily:"'JetBrains Mono',monospace",marginBottom:3}}>BUY-IN ($)</div><input type="number" value={ee.buy_in} onChange={ev=>setEditedEntries(p=>({...p,[e.id]:{...ee,buy_in:ev.target.value}}))} style={{...inp,padding:"6px 8px",fontSize:12,textAlign:"center" as const}}/></div>
              <div style={{flex:1}}><div style={{color:"#666",fontSize:9,fontFamily:"'JetBrains Mono',monospace",marginBottom:3}}>REBUYS (#)</div><input type="number" value={ee.rebuys} onChange={ev=>setEditedEntries(p=>({...p,[e.id]:{...ee,rebuys:ev.target.value}}))} style={{...inp,padding:"6px 8px",fontSize:12,textAlign:"center" as const}}/></div>
              <div style={{flex:1}}><div style={{color:"#666",fontSize:9,fontFamily:"'JetBrains Mono',monospace",marginBottom:3}}>CASH-OUT ($)</div><input type="number" value={ee.cash_out} onChange={ev=>setEditedEntries(p=>({...p,[e.id]:{...ee,cash_out:ev.target.value}}))} style={{...inp,padding:"6px 8px",fontSize:12,textAlign:"center" as const}}/></div>
            </div>}
          </div>;
        })}

        {guestNames.map((g,i)=>(
          <div key={`guest-${i}`} style={{padding:"9px 0",borderTop:"1px solid rgba(255,255,255,0.05)",display:"flex",alignItems:"center",gap:10}}>
            <Avatar name={g} size={34}/>
            <div style={{flex:1}}>
              <div style={{color:"#777",fontSize:13}}>{g} <span style={{color:"#8AB4FF",fontSize:10,fontFamily:"'JetBrains Mono',monospace"}}>(guest)</span></div>
              <div style={{color:"#444",fontSize:9,fontFamily:"'JetBrains Mono',monospace"}}>not tracked in standings</div>
            </div>
          </div>
        ))}

        {/* Balance calculator */}
        {entries.length>0&&<div style={{marginTop:9,paddingTop:9,borderTop:"1px solid rgba(255,255,255,0.05)",display:"flex",justifyContent:"flex-end",alignItems:"center",gap:6}}>
          <span style={{color:"#444",fontFamily:"'JetBrains Mono',monospace",fontSize:9}}>BALANCE:</span>
          {balance===0
            ?<span style={{color:"#4ADE80",fontFamily:"'JetBrains Mono',monospace",fontSize:10}}>✓ balanced</span>
            :<span style={{color:balance>0?"#F0CA5A":"#F87171",fontFamily:"'JetBrains Mono',monospace",fontSize:10}}>off by {balance>0?"+":""}${balance}</span>}
        </div>}

        {/* Add missing player */}
        {isCommissioner&&!addingPlayer&&<div style={{display:"flex",gap:7,marginTop:11}}>
          <button onClick={()=>setAddingPlayer(true)} style={{flex:1,padding:"8px 0",background:"rgba(138,180,255,0.1)",border:"1px solid rgba(138,180,255,0.25)",borderRadius:9,color:"#8AB4FF",fontFamily:"'JetBrains Mono',monospace",fontSize:10,letterSpacing:1.5,cursor:"pointer"}}>+ ADD PLAYER</button>
          <button onClick={()=>{setNewPlayerName("(guest)");setAddingPlayer(true);}} style={{flex:1,padding:"8px 0",background:"rgba(138,180,255,0.05)",border:"1px dashed rgba(138,180,255,0.2)",borderRadius:9,color:"#8AB4FF",fontFamily:"'JetBrains Mono',monospace",fontSize:10,letterSpacing:1.5,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:5}}><Icon name="person" size={11} color="#8AB4FF"/>+ GUEST</button>
        </div>}
        {isCommissioner&&!isLocked&&addingPlayer&&<div style={{marginTop:11,paddingTop:11,borderTop:"1px solid rgba(255,255,255,0.05)"}}>
          <div style={{color:"#8AB4FF",fontSize:10,fontFamily:"'JetBrains Mono',monospace",letterSpacing:2,marginBottom:10}}>ADD PLAYER TO THIS SESSION</div>
          <div style={{marginBottom:8}}>
            <label style={{color:"#888",fontSize:10,fontFamily:"'JetBrains Mono',monospace",marginBottom:5,display:"block"}}>PLAYER NAME</label>
            {missingPlayers.length>0&&<select value={newPlayerName} onChange={e=>setNewPlayerName(e.target.value)} style={{...inp,fontSize:13,marginBottom:6}}><option value="">-- select league member --</option>{missingPlayers.map((p:any)=><option key={p.id} value={p.name}>{p.name}</option>)}</select>}
            <input value={newPlayerName} onChange={e=>setNewPlayerName(e.target.value)} placeholder="Or type a name manually" style={{...inp,fontSize:13}}/>
          </div>
          <div style={{display:"flex",gap:8,marginBottom:10}}>
            <div style={{flex:1}}><label style={{color:"#888",fontSize:9,fontFamily:"'JetBrains Mono',monospace",marginBottom:4,display:"block"}}>BUY-IN ($)</label><input type="number" value={newPlayerBuyIn} onChange={e=>setNewPlayerBuyIn(e.target.value)} style={{...inp,padding:"8px 10px",fontSize:13}}/></div>
            <div style={{flex:1}}><label style={{color:"#888",fontSize:9,fontFamily:"'JetBrains Mono',monospace",marginBottom:4,display:"block"}}>REBUYS ($)</label><input type="number" value={newPlayerRebuys} onChange={e=>setNewPlayerRebuys(e.target.value)} style={{...inp,padding:"8px 10px",fontSize:13}}/></div>
            <div style={{flex:1}}><label style={{color:"#888",fontSize:9,fontFamily:"'JetBrains Mono',monospace",marginBottom:4,display:"block"}}>CASH-OUT ($)</label><input type="number" value={newPlayerCashOut} onChange={e=>setNewPlayerCashOut(e.target.value)} style={{...inp,padding:"8px 10px",fontSize:13}}/></div>
          </div>
          <div style={{color:"#555",fontSize:10,fontFamily:"'JetBrains Mono',monospace",marginBottom:10}}>Profit: <span style={{color:Number(newPlayerCashOut)-(Number(newPlayerBuyIn)*(1+Number(newPlayerRebuys)))>=0?"#4ADE80":"#F87171",fontWeight:700}}>{fmtProfit(Number(newPlayerCashOut)-(Number(newPlayerBuyIn)*(1+Number(newPlayerRebuys))))}</span></div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>{setAddingPlayer(false);setNewPlayerName("");}} style={{flex:1,padding:"9px 0",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:9,color:"#888",fontFamily:"'JetBrains Mono',monospace",fontSize:11,cursor:"pointer"}}>CANCEL</button>
            <button onClick={handleAddPlayer} disabled={saving||!newPlayerName.trim()} style={{flex:2,padding:"9px 0",background:newPlayerName.trim()&&!saving?"rgba(138,180,255,0.2)":"rgba(255,255,255,0.05)",border:`1px solid ${newPlayerName.trim()?"rgba(138,180,255,0.4)":"rgba(255,255,255,0.1)"}`,borderRadius:9,color:newPlayerName.trim()?"#8AB4FF":"#555",fontFamily:"'JetBrains Mono',monospace",fontWeight:700,fontSize:11,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:7}}>{saving?<Spinner size={13}/>:"ADD TO SESSION →"}</button>
          </div>
        </div>}
      </Card>

      {/* Awards */}
      <Card style={{marginBottom:12,textAlign:"center" as const}}>
        <div style={{color:"#888",fontSize:9,fontFamily:"'JetBrains Mono',monospace",letterSpacing:3,marginBottom:6,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}><Icon name="drumstick" size={11} color="#888"/> WINNER WINNER CHICKEN DINNER</div>
        <div style={{color:"#E9B949",fontSize:22,fontFamily:"'Fraunces',serif",fontWeight:700}}>{session.chicken_dinner_name||"—"}</div>
        {editing&&<div style={{color:"#444",fontSize:9,marginTop:4,fontFamily:"'JetBrains Mono',monospace"}}>Auto-assigned to highest profit on save</div>}
      </Card>

      {isLocked
        ?<div style={{background:"rgba(74,222,128,0.06)",border:"1px solid rgba(74,222,128,0.2)",borderRadius:11,padding:"9px 14px",marginBottom:12,display:"flex",alignItems:"center",gap:8}}>
          <Icon name="lock" size={13} color="#4ADE80"/>
          <span style={{color:"#4ADE80",fontFamily:"'JetBrains Mono',monospace",fontSize:10}}>Stats locked and committed to player profiles</span>
        </div>
        :<div style={{background:"rgba(233,185,73,0.04)",border:"1px solid rgba(233,185,73,0.12)",borderRadius:11,padding:"9px 14px",marginBottom:12,display:"flex",alignItems:"center",gap:8}}>
          <Icon name="hourglass" size={13} color="#666"/>
          <span style={{color:"#666",fontFamily:"'JetBrains Mono',monospace",fontSize:10}}>{isCommissioner?"Lock this session to commit stats to player profiles":"Pending — commissioner must lock to commit stats"}</span>
        </div>}

      {editing&&canEdit&&<button onClick={handleSave} disabled={saving} style={{width:"100%",padding:"12px 0",background:saving?"rgba(255,255,255,0.08)":"linear-gradient(135deg,#E9B949,#F0CA5A)",border:"none",borderRadius:11,color:saving?"#444":"#0A0A0A",fontFamily:"'JetBrains Mono',monospace",fontWeight:700,fontSize:13,letterSpacing:2,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:10,marginBottom:12}}>{saving?<><Spinner size={14}/> SAVING...</>:"SAVE CHANGES ✓"}</button>}

      {/* Session posts */}
      {sessionPosts.length>0&&<Card>
        <div style={{color:"#888",fontSize:10,fontFamily:"'JetBrains Mono',monospace",letterSpacing:2,marginBottom:11}}>FROM THIS NIGHT</div>
        {sessionPosts.map((post:any,i:number)=><div key={post.id} style={{paddingBottom:i<sessionPosts.length-1?11:0,marginBottom:i<sessionPosts.length-1?11:0,borderBottom:i<sessionPosts.length-1?"1px solid rgba(255,255,255,0.05)":"none"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}><Avatar name={post.author_name} size={24}/><span style={{color:"#fff",fontSize:12}}>{post.author_name}</span><span style={{color:"#555",fontSize:9,fontFamily:"'JetBrains Mono',monospace",marginLeft:"auto"}}>{new Date(post.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric'})}</span></div>
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
      <Card style={{marginBottom:14}}>{others.length===0&&<div style={{color:"#555",textAlign:"center",padding:"14px 0",fontFamily:"'JetBrains Mono',monospace",fontSize:12}}>No other players.</div>}{others.map((p:any)=><div key={p.id} onClick={()=>setSelected(p.name)} style={{display:"flex",alignItems:"center",gap:11,padding:"10px 0",borderBottom:"1px solid rgba(255,255,255,0.05)",cursor:"pointer"}}><div style={{width:20,height:20,borderRadius:5,border:`2px solid ${selected===p.name?"#E9B949":"#333"}`,background:selected===p.name?"#E9B949":"transparent",display:"flex",alignItems:"center",justifyContent:"center",color:"#000",fontSize:12,flexShrink:0}}>{selected===p.name?"✓":""}</div><Avatar name={p.name} size={32}/><div style={{color:"#fff"}}>{p.name}</div></div>)}</Card>
      <button onClick={handleTransfer} disabled={!selected||loading} style={{width:"100%",padding:"12px 0",background:selected&&!loading?"linear-gradient(135deg,#E9B949,#F0CA5A)":"rgba(255,255,255,0.08)",border:"none",borderRadius:11,color:selected&&!loading?"#0A0A0A":"#444",fontFamily:"'JetBrains Mono',monospace",fontWeight:700,fontSize:13,letterSpacing:2,cursor:selected&&!loading?"pointer":"not-allowed",display:"flex",alignItems:"center",justifyContent:"center",gap:10}}>{loading?<Spinner size={16}/>:"TRANSFER & LEAVE →"}</button>
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
  const ni:any={background:"rgba(255,255,255,0.05)",border:"1px solid rgba(233,185,73,0.25)",borderRadius:8,padding:"7px 9px",color:"#fff",fontSize:13,fontFamily:"'JetBrains Mono',monospace",outline:"none",textAlign:"center",boxSizing:"border-box"};
  return(
    <div style={{padding:"16px 16px",maxWidth:500,margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"center",gap:11,marginBottom:12}}><button onClick={onBack} style={{background:"none",border:"none",color:"#555",fontSize:22,cursor:"pointer"}}>←</button><div style={{flex:1}}><div style={{color:"#4ADE80",fontSize:10,fontFamily:"'JetBrains Mono',monospace",letterSpacing:2}}>● GAME IS LIVE</div><div style={{fontFamily:"'Fraunces',serif",fontSize:19,color:"#fff"}}>{league.name}</div></div></div>
      <div style={{display:"flex",gap:9,marginBottom:12}}>
        <div style={{flex:1,background:"rgba(74,222,128,0.1)",border:"1px solid rgba(74,222,128,0.3)",borderRadius:13,padding:"12px 13px",textAlign:"center"}}><div style={{color:"#555",fontSize:9,fontFamily:"'JetBrains Mono',monospace",letterSpacing:2}}>TIME</div><div style={{color:"#4ADE80",fontSize:24,fontFamily:"'JetBrains Mono',monospace",fontWeight:700,marginTop:2}}>{fmt(elapsed)}</div></div>
        <div style={{flex:1,background:"rgba(233,185,73,0.08)",border:"1px solid rgba(233,185,73,0.2)",borderRadius:13,padding:"12px 13px",textAlign:"center"}}><div style={{color:"#555",fontSize:9,fontFamily:"'JetBrains Mono',monospace",letterSpacing:2}}>POT</div><div style={{color:"#E9B949",fontSize:24,fontFamily:"'JetBrains Mono',monospace",fontWeight:700,marginTop:2}}>${totalPot}</div></div>
      </div>
      {myPlayer&&<Card style={{marginBottom:12,border:"1px solid rgba(233,185,73,0.3)",background:"rgba(233,185,73,0.04)"}}>
        <div style={{color:"#E9B949",fontSize:10,fontFamily:"'JetBrains Mono',monospace",letterSpacing:2,marginBottom:11}}>YOUR STATS {inSession&&<span style={{color:"#4ADE80",fontSize:9}}>✓ submitted</span>}</div>
        <div style={{display:"flex",gap:9,marginBottom:11}}>
          <div style={{flex:1}}><div style={{color:"#888",fontSize:9,fontFamily:"'JetBrains Mono',monospace",marginBottom:4}}>BUY-IN ($)</div><input type="number" value={myBuyIn||""} onChange={e=>setMyBuyIn(Number(e.target.value))} style={{...ni,width:"100%"}}/></div>
          <div style={{flex:1}}><div style={{color:"#888",fontSize:9,fontFamily:"'JetBrains Mono',monospace",marginBottom:4}}>REBUYS ($)</div><input type="number" value={myRebuys||""} onChange={e=>setMyRebuys(Number(e.target.value))} style={{...ni,width:"100%"}}/></div>
          <div style={{flex:1}}><div style={{color:"#888",fontSize:9,fontFamily:"'JetBrains Mono',monospace",marginBottom:4}}>CASH-OUT ($)</div><input type="number" value={myCashOut||""} onChange={e=>setMyCashOut(Number(e.target.value))} style={{...ni,width:"100%"}}/></div>
        </div>
        <div style={{color:"#555",fontSize:10,fontFamily:"'JetBrains Mono',monospace",marginBottom:9}}>Profit: <span style={{color:myCashOut-myBuyIn-(myRebuys*myBuyIn)>=0?"#4ADE80":"#F87171",fontWeight:700}}>{fmtProfit(myCashOut-myBuyIn-(myRebuys*myBuyIn))}</span></div>
        <button onClick={handleSubmit} disabled={saving} style={{width:"100%",padding:"9px 0",background:"rgba(233,185,73,0.15)",border:"1px solid rgba(233,185,73,0.3)",borderRadius:9,color:"#E9B949",fontFamily:"'JetBrains Mono',monospace",fontSize:11,letterSpacing:1.5,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:7}}>{saving?<Spinner size={13}/>:inSession?"UPDATE MY STATS ✓":"JOIN & SUBMIT STATS →"}</button>
      </Card>}
      <Card style={{marginBottom:12}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:11}}>
          <div style={{color:"#888",fontSize:10,fontFamily:"'JetBrains Mono',monospace",letterSpacing:2}}>IN SESSION ({liveEntries.length})</div>
          {isCommissioner&&notInSession.length>0&&<button onClick={()=>setAddingPlayer(!addingPlayer)} style={{padding:"3px 9px",background:"rgba(74,222,128,0.1)",border:"1px solid rgba(74,222,128,0.3)",borderRadius:20,color:"#4ADE80",fontFamily:"'JetBrains Mono',monospace",fontSize:9,cursor:"pointer"}}>+ ADD PLAYER</button>}
        </div>
        {addingPlayer&&isCommissioner&&<div style={{marginBottom:11,paddingBottom:11,borderBottom:"1px solid rgba(255,255,255,0.05)"}}>
          <div style={{color:"#555",fontSize:10,fontFamily:"'JetBrains Mono',monospace",marginBottom:7}}>Select player to add:</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {notInSession.map((p:any)=><button key={p.id} onClick={async()=>{if(!db||!session)return;await db.from("live_entries").insert({session_id:session.id,player_id:p.id,player_name:p.name,buy_in:session.buy_in_amount||league.buy_in,rebuys:0,cash_out:0});setAddingPlayer(false);}} style={{padding:"5px 10px",borderRadius:20,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",color:"#fff",fontFamily:"'JetBrains Mono',monospace",fontSize:11,cursor:"pointer"}}>{p.name}</button>)}
          </div>
        </div>}
        {liveEntries.length===0&&<div style={{color:"#555",fontSize:11,fontFamily:"'JetBrains Mono',monospace",textAlign:"center",padding:"10px 0"}}>Waiting for players...</div>}
        {liveEntries.map((e:any,i:number)=>{const total=(e.buy_in||0)+(e.rebuys||0);const isMe=e.player_name.toLowerCase()===profile.display_name.toLowerCase();return<div key={e.id||i} style={{display:"flex",alignItems:"center",gap:9,padding:"7px 0",borderBottom:i<liveEntries.length-1?"1px solid rgba(255,255,255,0.05)":"none"}}><Avatar name={e.player_name} size={30}/><div style={{flex:1}}><div style={{color:"#fff",fontSize:12}}>{e.player_name}{isMe&&<span style={{color:"#E9B949",fontSize:9,fontFamily:"'JetBrains Mono',monospace"}}> (you)</span>}</div><div style={{color:"#555",fontSize:9,fontFamily:"'JetBrains Mono',monospace"}}>in: ${e.buy_in||0} · rebuys: ${e.rebuys||0} · out: ${e.cash_out||0}</div></div><div style={{color:"#4ADE80",fontFamily:"'JetBrains Mono',monospace",fontWeight:700,fontSize:12}}>${total}</div></div>;})}
      </Card>
      {isCommissioner&&<>{!showCashout&&<button onClick={()=>setShowCashout(true)} style={{width:"100%",padding:"12px 0",background:"linear-gradient(135deg,#5a0000,#8B1A1A)",border:"1px solid rgba(248,113,113,0.4)",borderRadius:11,color:"#F87171",fontFamily:"'JetBrains Mono',monospace",fontWeight:700,fontSize:12,letterSpacing:2,cursor:"pointer"}}>END GAME & FINALIZE →</button>}{showCashout&&<Card>
        <div style={{color:"#888",fontSize:10,fontFamily:"'JetBrains Mono',monospace",letterSpacing:2,marginBottom:11}}>VERIFY / OVERRIDE CASH-OUTS</div>
        {liveEntries.map((e:any)=><div key={e.player_id} style={{display:"flex",alignItems:"center",gap:9,marginBottom:9}}><Avatar name={e.player_name} size={26}/><div style={{flex:1}}><div style={{color:"#fff",fontSize:12}}>{e.player_name}</div><div style={{color:"#555",fontSize:9,fontFamily:"'JetBrains Mono',monospace"}}>submitted: ${e.cash_out||0}</div></div><input type="number" value={cashOuts[e.player_id]!==undefined?cashOuts[e.player_id]:(e.cash_out||"")} onChange={ev=>setCashOuts((c:any)=>({...c,[e.player_id]:Number(ev.target.value)}))} style={{...ni,width:"72px"}}/></div>)}
        <div style={{marginTop:9,padding:"9px 12px",background:"rgba(233,185,73,0.06)",border:"1px solid rgba(233,185,73,0.15)",borderRadius:9}}>
          <div style={{color:"#666",fontFamily:"'JetBrains Mono',monospace",fontSize:9,display:"flex",alignItems:"center",gap:4}}><Icon name="drumstick" size={10} color="#666"/>Chicken dinner auto-assigned to highest profit on save</div>
        </div>
        <button onClick={handleEnd} disabled={saving} style={{width:"100%",marginTop:13,padding:"11px 0",background:saving?"rgba(255,255,255,0.08)":"linear-gradient(135deg,#E9B949,#F0CA5A)",border:"none",borderRadius:9,color:saving?"#444":"#0A0A0A",fontFamily:"'JetBrains Mono',monospace",fontWeight:700,fontSize:12,letterSpacing:2,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:9}}>{saving?<><Spinner size={14}/> SAVING...</>:"APPROVE & SAVE SESSION ✓"}</button>
      </Card>}</>}
      {!isCommissioner&&<div style={{padding:"11px 13px",background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.05)",borderRadius:11,color:"#444",fontFamily:"'JetBrains Mono',monospace",fontSize:10,textAlign:"center" as const,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}><Icon name="crown" size={12} color="#444"/>Commissioner will finalize the session</div>}
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
          <div style={{color:"#888",fontSize:10,fontFamily:"'JetBrains Mono',monospace",letterSpacing:2}}>BUY-IN FOR TONIGHT</div>
          {lastSession&&lastPlayerIds.length>0&&<button onClick={handleRematch} style={{padding:"3px 10px",background:"rgba(233,185,73,0.1)",border:"1px solid rgba(233,185,73,0.25)",borderRadius:20,color:"#E9B949",fontFamily:"'JetBrains Mono',monospace",fontSize:9,cursor:"pointer",letterSpacing:1}}>↺ REMATCH</button>}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:11,marginBottom:9}}><button onClick={()=>setSessionBuyIn(Math.max(1,sessionBuyIn-5))} style={{width:38,height:38,borderRadius:9,background:"rgba(248,113,113,0.15)",border:"1px solid rgba(248,113,113,0.3)",color:"#F87171",fontSize:20,cursor:"pointer"}}>−</button><div style={{flex:1,textAlign:"center"}}><div style={{color:"#E9B949",fontSize:30,fontFamily:"'JetBrains Mono',monospace",fontWeight:700}}>${sessionBuyIn}</div></div><button onClick={()=>setSessionBuyIn(sessionBuyIn+5)} style={{width:38,height:38,borderRadius:9,background:"rgba(74,222,128,0.15)",border:"1px solid rgba(74,222,128,0.3)",color:"#4ADE80",fontSize:20,cursor:"pointer"}}>+</button></div>
        <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:12}}>{[10,20,25,50,100].map(amt=><button key={amt} onClick={()=>setSessionBuyIn(amt)} style={{padding:"4px 10px",borderRadius:20,background:sessionBuyIn===amt?"rgba(233,185,73,0.2)":"rgba(255,255,255,0.04)",border:`1px solid ${sessionBuyIn===amt?"rgba(233,185,73,0.4)":"rgba(255,255,255,0.08)"}`,color:sessionBuyIn===amt?"#E9B949":"#555",fontFamily:"'JetBrains Mono',monospace",fontSize:11,cursor:"pointer"}}>${amt}</button>)}</div>
        <label style={{color:"#888",fontSize:10,fontFamily:"'JetBrains Mono',monospace",letterSpacing:1.5,display:"block",marginBottom:5}}>SESSION NOTES (optional)</label>
        <input value={sessionNotes} onChange={e=>setSessionNotes(e.target.value)} placeholder="e.g. Played at Nick's house" style={{...inp,fontSize:12}}/>
      </Card>
      <div style={{color:"#888",fontSize:10,fontFamily:"'JetBrains Mono',monospace",letterSpacing:2,marginBottom:9}}>WHO'S PLAYING</div>
      <Card style={{marginBottom:10}}>
        {players.map((p:any)=>{const sel=selectedIds.includes(p.id);return<div key={p.id} onClick={()=>setSelectedIds(sel?selectedIds.filter(x=>x!==p.id):[...selectedIds,p.id])} style={{display:"flex",alignItems:"center",gap:11,padding:"10px 0",borderBottom:"1px solid rgba(255,255,255,0.05)",cursor:"pointer",opacity:sel?1:0.5}}><div style={{width:20,height:20,borderRadius:5,border:`2px solid ${sel?"#E9B949":"#333"}`,background:sel?"#E9B949":"transparent",display:"flex",alignItems:"center",justifyContent:"center",color:"#000",fontSize:12,flexShrink:0}}>{sel?"✓":""}</div><Avatar name={p.name} size={32}/><div style={{flex:1}}><div style={{color:"#fff"}}>{p.name}</div><div style={{color:"#555",fontSize:10,fontFamily:"'JetBrains Mono',monospace"}}>{p.wins}W · {fmtProfit(p.total_profit)}</div></div></div>;})}
      </Card>

      {/* GUESTS */}
      <div style={{marginBottom:14}}>
        <div style={{color:"#888",fontSize:10,fontFamily:"'JetBrains Mono',monospace",letterSpacing:2,marginBottom:9,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <span>GUESTS (optional)</span>
          <span style={{color:"#444",fontSize:9}}>stats used for pot only · no profile</span>
        </div>
        {guestNames.map((g,i)=>(
          <div key={i} style={{display:"flex",alignItems:"center",gap:9,padding:"8px 11px",marginBottom:6,background:"rgba(138,180,255,0.06)",border:"1px solid rgba(138,180,255,0.15)",borderRadius:10}}>
            <Icon name="person" size={13} color="#8AB4FF"/>
            <span style={{flex:1,color:"#aaa",fontSize:13}}>{g} <span style={{color:"#8AB4FF",fontSize:9,fontFamily:"'JetBrains Mono',monospace"}}>(guest)</span></span>
            <button onClick={()=>setGuestNames(guestNames.filter((_,j)=>j!==i))} style={{background:"none",border:"none",color:"#F87171",fontSize:14,cursor:"pointer",padding:"0 3px"}}>✕</button>
          </div>
        ))}
        {guestNames.length<3&&!addingGuest&&<button onClick={()=>{setAddingGuest(true);setGuestInput("");}} style={{width:"100%",padding:"8px 0",background:"rgba(138,180,255,0.05)",border:"1px dashed rgba(138,180,255,0.2)",borderRadius:9,color:"#8AB4FF",fontFamily:"'JetBrains Mono',monospace",fontSize:10,letterSpacing:1.5,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
          <Icon name="person" size={11} color="#8AB4FF"/>+ ADD GUEST ({guestNames.length}/3)
        </button>}
        {addingGuest&&<div style={{display:"flex",gap:7}}>
          <input autoFocus value={guestInput} onChange={e=>setGuestInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&guestInput.trim()){setGuestNames([...guestNames,guestInput.trim()]);setAddingGuest(false);}}} placeholder="Guest name..." style={{...inp,flex:1,fontSize:13}}/>
          <button onClick={()=>{if(guestInput.trim())setGuestNames([...guestNames,guestInput.trim()]);setAddingGuest(false);setGuestInput("");}} disabled={!guestInput.trim()} style={{padding:"0 13px",background:guestInput.trim()?"rgba(138,180,255,0.2)":"rgba(255,255,255,0.05)",border:`1px solid ${guestInput.trim()?"rgba(138,180,255,0.4)":"rgba(255,255,255,0.1)"}`,borderRadius:9,color:guestInput.trim()?"#8AB4FF":"#444",fontFamily:"'JetBrains Mono',monospace",fontSize:11,cursor:"pointer"}}>ADD</button>
          <button onClick={()=>{setAddingGuest(false);setGuestInput("");}} style={{padding:"0 10px",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:9,color:"#555",fontFamily:"'JetBrains Mono',monospace",fontSize:11,cursor:"pointer"}}>✕</button>
        </div>}
      </div>

      <button disabled={totalPlaying<2||loading} onClick={async()=>{setLoading(true);await onStart({selectedIds,sessionBuyIn,sessionNotes,guestNames});setLoading(false);}} style={{width:"100%",padding:"13px 0",background:totalPlaying>=2&&!loading?"linear-gradient(135deg,#E9B949,#F0CA5A)":"rgba(255,255,255,0.08)",border:"none",borderRadius:11,color:totalPlaying>=2&&!loading?"#0A0A0A":"#444",fontFamily:"'JetBrains Mono',monospace",fontWeight:700,fontSize:13,letterSpacing:2,cursor:totalPlaying>=2&&!loading?"pointer":"not-allowed",display:"flex",alignItems:"center",justifyContent:"center",gap:10}}>{loading?<Spinner size={16}/>:`START WITH ${totalPlaying} PLAYERS →`}</button>
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
    if(card.includes('♥'))return{s:'♥',c:'#F87171'};
    if(card.includes('♦'))return{s:'♦',c:'#F87171'};
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
            border:`1px solid ${h.rank<=2?"rgba(233,185,73,0.25)":"rgba(255,255,255,0.07)"}`,
            overflow:"hidden",
            background:isFlipped?"rgba(10,10,10,0.98)":"rgba(255,255,255,0.03)",
            transition:"background 0.2s",
          }}>
            {/* Front row — always visible */}
            <div style={{display:"flex",alignItems:"center",gap:13,padding:"11px 14px"}}>
              <div style={{width:28,height:28,borderRadius:8,background:`${h.color}22`,border:`1px solid ${h.color}44`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'JetBrains Mono',monospace",fontWeight:700,color:h.color,fontSize:11,flexShrink:0}}>{h.rank}</div>
              <div style={{flex:1}}>
                <div style={{color:h.color,fontFamily:"'Fraunces',serif",fontSize:14,fontWeight:700}}>{h.name}</div>
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
                        <div style={{color:c,fontFamily:"'Fraunces',serif",fontWeight:700,fontSize:15,lineHeight:1}}>{val}</div>
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
        {([["DESCRIPTION","text",description,setDescription,"League description"],["SEASON NAME","text",season,setSeason,"Season 1"],["LOCATION","text",locationName,setLocationName,"e.g. San Francisco, CA"]] as any[]).map(([label,type,val,setter,ph])=><div key={label} style={{marginBottom:9}}><label style={{color:"#888",fontSize:10,fontFamily:"'JetBrains Mono',monospace",letterSpacing:1.5,display:"block",marginBottom:5}}>{label}</label><input type={type} value={val} onChange={(e:any)=>setter(e.target.value)} placeholder={ph} style={inp}/></div>)}
        <div style={{display:"flex",gap:9,marginBottom:9}}><div style={{flex:1}}><label style={{color:"#888",fontSize:10,fontFamily:"'JetBrains Mono',monospace",letterSpacing:1.5,display:"block",marginBottom:5}}>DEFAULT BUY-IN ($)</label><input type="number" value={buyIn} onChange={e=>setBuyIn(e.target.value)} style={inp}/></div><div style={{flex:1}}><label style={{color:"#888",fontSize:10,fontFamily:"'JetBrains Mono',monospace",letterSpacing:1.5,display:"block",marginBottom:5}}>SEASON LENGTH</label><input type="number" value={seasonLength} onChange={e=>setSeasonLength(e.target.value)} style={inp}/></div></div>
        <div style={{marginBottom:11}}><label style={{color:"#888",fontSize:10,fontFamily:"'JetBrains Mono',monospace",letterSpacing:1.5,display:"block",marginBottom:5}}>MAX PLAYERS</label><div style={{display:"flex",gap:5}}>{MAX_PLAYER_OPTIONS.map(n=><button key={n} onClick={()=>setMaxPlayers(n)} style={{flex:1,padding:"7px 0",borderRadius:9,background:maxPlayers===n?"rgba(233,185,73,0.2)":"rgba(255,255,255,0.04)",border:`1px solid ${maxPlayers===n?"rgba(233,185,73,0.4)":"rgba(255,255,255,0.08)"}`,color:maxPlayers===n?"#E9B949":"#555",fontFamily:"'JetBrains Mono',monospace",fontSize:11,cursor:"pointer"}}>{n}</button>)}</div></div>
        <Toggle value={isPublic} onChange={setIsPublic} label="Public League" sub="Anyone can find & join without a code"/>
        <button onClick={save} disabled={saving} style={{width:"100%",padding:"11px 0",background:"linear-gradient(135deg,#E9B949,#F0CA5A)",border:"none",borderRadius:9,color:"#0A0A0A",fontFamily:"'JetBrains Mono',monospace",fontWeight:700,fontSize:12,letterSpacing:2,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:9}}>{saving?<Spinner size={14}/>:"SAVE ✓"}</button>
      </Card>

      <Card style={{marginBottom:11}}>
        <div style={{color:"#888",fontSize:10,fontFamily:"'JetBrains Mono',monospace",letterSpacing:2,marginBottom:9}}>LEAGUE CODE</div>
        <div style={{color:"#555",fontSize:11,marginBottom:9}}>Set a custom code (6-7 characters). Letters and numbers only.</div>
        <div style={{display:"flex",gap:8}}>
          <input value={customCode} onChange={e=>setCustomCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,7))} placeholder="e.g. FRIDAY" style={{...inp,flex:1,color:"#E9B949",letterSpacing:3,fontSize:16,textAlign:"center" as const}}/>
          <button onClick={saveCode} disabled={savingCode||customCode.trim().length<6} style={{padding:"0 14px",background:customCode.trim().length>=6?"rgba(233,185,73,0.15)":"rgba(255,255,255,0.04)",border:`1px solid ${customCode.trim().length>=6?"rgba(233,185,73,0.3)":"rgba(255,255,255,0.08)"}`,borderRadius:9,color:customCode.trim().length>=6?"#E9B949":"#444",fontFamily:"'JetBrains Mono',monospace",fontSize:11,cursor:"pointer",flexShrink:0}}>{savingCode?<Spinner size={13}/>:"SAVE"}</button>
        </div>
      </Card>

      <Card style={{marginBottom:11}}><div style={{color:"#888",fontSize:10,fontFamily:"'JetBrains Mono',monospace",letterSpacing:2,marginBottom:11}}>PLAYERS ({players.length}/{maxPlayers})</div>{players.map((p:any,i:number)=>{const isComm=p.name.toLowerCase()===league.commissioner_name?.toLowerCase();return<div key={p.id} style={{display:"flex",alignItems:"center",gap:9,padding:"8px 0",borderBottom:i<players.length-1?"1px solid rgba(255,255,255,0.05)":"none"}}><Avatar name={p.name} size={30}/><div style={{flex:1}}><div style={{color:"#fff",display:"flex",alignItems:"center",gap:4,fontSize:13}}>{p.name} {isComm&&<Icon name="crown" size={11} color="#E9B949"/>}</div><div style={{color:"#555",fontSize:9,fontFamily:"'JetBrains Mono',monospace"}}>{p.session_count} sessions</div></div>{!isComm&&<button onClick={()=>kick(p.id,p.name)} style={{padding:"3px 9px",background:"rgba(248,113,113,0.1)",border:"1px solid rgba(248,113,113,0.25)",borderRadius:20,color:"#F87171",fontFamily:"'JetBrains Mono',monospace",fontSize:10,cursor:"pointer"}}>KICK</button>}</div>;})}
      </Card>
      <Card><div style={{color:"#F87171",fontSize:10,fontFamily:"'JetBrains Mono',monospace",letterSpacing:2,marginBottom:9}}>DANGER ZONE</div>{!confirmDelete?<button onClick={()=>setConfirmDelete(true)} style={{width:"100%",padding:"11px 0",background:"rgba(248,113,113,0.06)",border:"1px solid rgba(248,113,113,0.2)",borderRadius:9,color:"#F87171",fontFamily:"'JetBrains Mono',monospace",fontSize:11,letterSpacing:1.5,cursor:"pointer"}}>DELETE THIS LEAGUE</button>:<div><div style={{color:"#F87171",fontSize:12,marginBottom:11,textAlign:"center",lineHeight:1.6}}>Permanently delete all data? Career stats will be preserved. Cannot be undone.</div><div style={{display:"flex",gap:9}}><button onClick={()=>setConfirmDelete(false)} style={{flex:1,padding:"10px 0",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:9,color:"#888",fontFamily:"'JetBrains Mono',monospace",fontSize:11,cursor:"pointer"}}>CANCEL</button><button onClick={del} style={{flex:1,padding:"10px 0",background:"rgba(248,113,113,0.2)",border:"1px solid rgba(248,113,113,0.4)",borderRadius:9,color:"#F87171",fontFamily:"'JetBrains Mono',monospace",fontWeight:700,fontSize:11,cursor:"pointer"}}>DELETE</button></div></div>}</Card>
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
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}><div style={{fontFamily:"'Fraunces',serif",fontSize:22,color:"#fff"}}>Feed</div><div style={{color:"#555",fontSize:10,fontFamily:"'JetBrains Mono',monospace"}}>you + friends</div></div>
      {myLeagues.length>0&&<Card style={{marginBottom:14}}>
        <div style={{display:"flex",gap:9,marginBottom:9}}><Avatar name={profile.display_name} url={profile.avatar_url} size={30}/><textarea value={newPost} onChange={e=>setNewPost(e.target.value)} placeholder="Share a moment..." style={{flex:1,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(233,185,73,0.2)",borderRadius:9,padding:9,color:"#fff",fontFamily:"'JetBrains Mono',monospace",fontSize:11,resize:"none",height:58,outline:"none"}}/></div>
        {myLeagues.length>1&&<div style={{marginBottom:9}}><div style={{display:"flex",gap:5,flexWrap:"wrap"}}>{myLeagues.map((lg:any)=><button key={lg.id} onClick={()=>setSelectedLeagueId(lg.id)} style={{padding:"2px 8px",borderRadius:20,background:selectedLeagueId===lg.id?"rgba(233,185,73,0.2)":"rgba(255,255,255,0.04)",border:`1px solid ${selectedLeagueId===lg.id?"rgba(233,185,73,0.4)":"rgba(255,255,255,0.08)"}`,color:selectedLeagueId===lg.id?"#E9B949":"#555",fontFamily:"'JetBrains Mono',monospace",fontSize:9,cursor:"pointer"}}>{lg.name}</button>)}</div></div>}
        {recentSessions.length>0&&<div style={{marginBottom:9}}>
          <select value={attachSessionId} onChange={e=>setAttachSessionId(e.target.value)} style={{...inp,fontSize:11,color:attachSessionId?"#E9B949":"#555"}}>
            <option value="">📎 Attach to a session (optional)</option>
            {recentSessions.map((s:any)=><option key={s.id} value={s.id}>{fmtSessionLabel(s)}</option>)}
          </select>
        </div>}
        {mediaPreview&&<div style={{position:"relative",marginBottom:9}}>{mediaFile?.type.startsWith("video")?<video src={mediaPreview} controls style={{width:"100%",borderRadius:9,maxHeight:240}}/>:<img src={mediaPreview} style={{width:"100%",borderRadius:9,maxHeight:240,objectFit:"cover"}}/>}<button onClick={()=>{setMediaFile(null);setMediaPreview(null);}} style={{position:"absolute",top:5,right:5,background:"rgba(0,0,0,0.7)",border:"none",borderRadius:"50%",color:"#fff",width:24,height:24,cursor:"pointer",fontSize:12}}>×</button></div>}
        <div style={{display:"flex",gap:7,alignItems:"center"}}><button onClick={()=>fileRef.current?.click()} style={{padding:"5px 10px",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:20,color:"#888",cursor:"pointer",display:"flex",alignItems:"center",gap:4}}><Icon name="camera" size={12} color="#888"/></button><input ref={fileRef} type="file" accept="image/*,video/*" onChange={e=>{const f=e.target.files?.[0];if(f){setMediaFile(f);setMediaPreview(URL.createObjectURL(f));}}} style={{display:"none"}}/><button onClick={handlePost} disabled={uploading||(!newPost.trim()&&!mediaFile)} style={{marginLeft:"auto",padding:"5px 14px",background:(!newPost.trim()&&!mediaFile)||uploading?"rgba(255,255,255,0.06)":"linear-gradient(135deg,#E9B949,#F0CA5A)",border:"none",borderRadius:20,color:(!newPost.trim()&&!mediaFile)||uploading?"#444":"#0A0A0A",fontFamily:"'JetBrains Mono',monospace",fontWeight:700,fontSize:10,cursor:"pointer",display:"flex",alignItems:"center",gap:5}}>{uploading?<Spinner size={11}/>:"POST"}</button></div>
      </Card>}
      {loading&&<div style={{display:"flex",justifyContent:"center",padding:36}}><Spinner/></div>}
      {!loading&&posts.length===0&&<Card><div style={{textAlign:"center",padding:"24px 0",color:"#555",fontFamily:"'JetBrains Mono',monospace",fontSize:11}}>No posts yet.<br/>Add friends from league standings!</div></Card>}
      {posts.map((post:any)=>{
        const isMine=post.author_name.toLowerCase()===profile.display_name.toLowerCase();const canEdit=isMine||isCommForLeague(post.league_id);
        return<Card key={post.id} style={{marginBottom:11}}>
          <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:9}}><Avatar name={post.author_name} size={30}/><div style={{flex:1}}><div style={{color:"#fff",fontSize:13,fontWeight:600}}>{post.author_name}</div><div style={{display:"flex",gap:7,alignItems:"center",marginTop:1}}><span style={{color:"#E9B949",fontSize:9,fontFamily:"'JetBrains Mono',monospace",background:"rgba(233,185,73,0.1)",padding:"1px 6px",borderRadius:9}}>{getLeagueName(post.league_id)}</span>{post.session_id&&<span style={{color:"#8AB4FF",fontSize:9,fontFamily:"'JetBrains Mono',monospace",background:"rgba(138,180,255,0.1)",padding:"1px 6px",borderRadius:9}}>📎 session</span>}<span style={{color:"#555",fontSize:9,fontFamily:"'JetBrains Mono',monospace"}}>{timeAgo(post.created_at)}</span></div></div>{canEdit&&<div style={{display:"flex",gap:5}}>{isMine&&<button onClick={()=>{setEditingPost(post.id);setEditContent(post.content||"");}} style={{background:"none",border:"none",color:"#555",fontSize:10,cursor:"pointer",fontFamily:"'JetBrains Mono',monospace"}}>EDIT</button>}<button onClick={async()=>{if(!db)return;await db.from("posts").delete().eq("id",post.id);await loadPosts();}} style={{background:"none",border:"none",color:"#F87171",fontSize:10,cursor:"pointer",fontFamily:"'JetBrains Mono',monospace"}}>DEL</button></div>}</div>
          {editingPost===post.id?<div><textarea value={editContent} onChange={e=>setEditContent(e.target.value)} style={{width:"100%",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(233,185,73,0.2)",borderRadius:9,padding:9,color:"#fff",fontFamily:"'JetBrains Mono',monospace",fontSize:11,resize:"none",height:58,outline:"none",marginBottom:7}}/><div style={{display:"flex",gap:7}}><button onClick={()=>setEditingPost(null)} style={{padding:"5px 12px",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:20,color:"#888",fontFamily:"'JetBrains Mono',monospace",fontSize:10,cursor:"pointer"}}>Cancel</button><button onClick={async()=>{if(!db)return;await db.from("posts").update({content:editContent}).eq("id",post.id);setEditingPost(null);await loadPosts();}} style={{padding:"5px 12px",background:"rgba(233,185,73,0.15)",border:"1px solid rgba(233,185,73,0.3)",borderRadius:20,color:"#E9B949",fontFamily:"'JetBrains Mono',monospace",fontSize:10,cursor:"pointer"}}>Save</button></div></div>
          :<>{post.content&&<div style={{color:"#ccc",fontSize:12,lineHeight:1.6,marginBottom:post.media_url?9:0}}>{post.content}</div>}{post.media_url&&(post.media_type==="video"?<video src={post.media_url} controls style={{width:"100%",borderRadius:9,maxHeight:320}}/>:<img src={post.media_url} style={{width:"100%",borderRadius:9,maxHeight:320,objectFit:"cover"}}/>)}</>}
        </Card>;
      })}
    </div>
  );
}

// ─── WIPE STATS BUTTON ─────────────────────────────────
// WipeStatsButton removed

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

// ═══════════════════════════════════════════════════════════════════
// VAULT PROFILE SYSTEM · Phase 1
// Paste this entire block into App.tsx, replacing the old ProfileTabView.
// Installation instructions at the bottom of this file.
// ═══════════════════════════════════════════════════════════════════

// ─── VAULT THEME TOKENS ──────────────────────────────────────────
const vault = {
  bg: '#0B0B0D',
  bgElev: '#131317',
  bgElev2: '#1A1A20',
  line: 'rgba(255,255,255,0.06)',
  line2: 'rgba(255,255,255,0.10)',
  text: '#F2F2F3',
  textDim: '#9AA0A6',
  textMuted: '#5C616B',
  gold: '#E9B949',
  goldDim: '#8E6F24',
  green: '#4ADE80',
  red: '#F87171',
  blue: '#8AB4FF',
  fontSerif: "'Fraunces','Playfair Display',Georgia,serif",
  fontSans: "'Inter Tight','Inter',system-ui,sans-serif",
  fontMono: "'JetBrains Mono','Space Mono',ui-monospace,monospace",
  easeOut: 'cubic-bezier(0.22,1,0.36,1)',
  durFast: '140ms',
  durMed: '240ms',
  durSlow: '420ms',
};

const vaultCard: React.CSSProperties = {
  background: vault.bgElev,
  border: `1px solid ${vault.line}`,
  borderRadius: 16,
  padding: 20,
};

// Inject Vault keyframes once on mount
function VaultStyles() {
  return (
    <style>{`
      @keyframes vault_fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
      @keyframes vault_slideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
      @keyframes vault_pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
      @keyframes vault_shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
      @keyframes vault_drawIn { from { stroke-dashoffset: var(--len); } to { stroke-dashoffset: 0; } }
      @keyframes vault_growUp { from { transform: scaleY(0); } to { transform: scaleY(1); } }
      @keyframes vault_cellPop { from { opacity: 0; transform: scale(0.5); } to { opacity: 1; transform: scale(1); } }
      .vault-fade-in { animation: vault_fadeIn ${vault.durMed} ${vault.easeOut} both; }
      .vault-slide-up { animation: vault_slideUp ${vault.durSlow} ${vault.easeOut} both; }
      .vault-shimmer {
        background: linear-gradient(90deg, ${vault.bgElev} 0%, ${vault.bgElev2} 50%, ${vault.bgElev} 100%);
        background-size: 200% 100%;
        animation: vault_shimmer 1.6s infinite;
      }
      @media (prefers-reduced-motion: reduce) {
        .vault-fade-in, .vault-slide-up { animation: none !important; }
      }
    `}</style>
  );
}

// ─── SVG VISUALIZATIONS ──────────────────────────────────────────

// Cumulative P/L area chart with draw-in animation
function BankrollChart({ data, color, width = 320, height = 90 }: { data: number[]; color: string; width?: number; height?: number; }) {
  const pathRef = useRef<SVGPathElement>(null);
  const areaRef = useRef<SVGPathElement>(null);
  useEffect(() => {
    if (!pathRef.current) return;
    const len = pathRef.current.getTotalLength();
    pathRef.current.style.setProperty('--len', String(len));
    pathRef.current.style.strokeDasharray = `${len}`;
    pathRef.current.style.strokeDashoffset = `${len}`;
    // Force reflow
    void pathRef.current.getBoundingClientRect();
    pathRef.current.style.transition = `stroke-dashoffset 900ms ${vault.easeOut}`;
    pathRef.current.style.strokeDashoffset = '0';
    if (areaRef.current) {
      areaRef.current.style.opacity = '0';
      void areaRef.current.getBoundingClientRect();
      areaRef.current.style.transition = `opacity 900ms ${vault.easeOut}`;
      areaRef.current.style.opacity = '1';
    }
  }, [data]);

  if (!data || data.length < 2) {
    return <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: vault.textMuted, fontFamily: vault.fontMono, fontSize: 11 }}>Not enough games yet — play one tonight</div>;
  }
  const min = Math.min(0, ...data);
  const max = Math.max(0, ...data);
  const range = (max - min) || 1;
  const pts = data.map((v, i) => [(i / (data.length - 1)) * width, height - ((v - min) / range) * (height - 8) - 4]);
  const zeroY = height - ((0 - min) / range) * (height - 8) - 4;
  const pathLine = pts.map(([x, y], i) => (i === 0 ? `M${x},${y}` : `L${x},${y}`)).join(' ');
  const pathArea = `${pathLine} L${width},${zeroY} L0,${zeroY} Z`;
  const gradId = `vaultBankroll_${color.replace('#', '')}`;
  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ maxWidth: width, display: 'block', margin: '0 auto' }}>
      <defs>
        <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.45" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <line x1="0" x2={width} y1={zeroY} y2={zeroY} stroke={vault.line2} strokeDasharray="3 3" />
      <path ref={areaRef} d={pathArea} fill={`url(#${gradId})`} />
      <path ref={pathRef} d={pathLine} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="5" fill={color} stroke={vault.bg} strokeWidth="2" />
    </svg>
  );
}

// Win/loss bar chart with grow-up animation
function SessionBars({ data }: { data: number[]; }) {
  const max = Math.max(1, ...data.map(Math.abs));
  const height = 90;
  if (!data.length) {
    return <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: vault.textMuted, fontFamily: vault.fontMono, fontSize: 11 }}>No sessions in this window</div>;
  }
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center', height, justifyContent: 'space-between' }}>
      {data.map((v, i) => {
        const h = (Math.abs(v) / max) * (height / 2 - 6);
        const isPos = v >= 0;
        const delay = `${i * 35}ms`;
        return (
          <div key={i} title={fmtProfit(v)} style={{ flex: 1, height, display: 'flex', flexDirection: 'column', position: 'relative' }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
              {isPos && (
                <div style={{
                  width: '100%', maxWidth: 20, height: h,
                  background: `linear-gradient(to top, ${vault.green}, ${vault.green}88)`,
                  borderRadius: '3px 3px 0 0',
                  transformOrigin: 'bottom',
                  animation: `vault_growUp 500ms ${vault.easeOut} ${delay} both`,
                }} />
              )}
            </div>
            <div style={{ height: 1, background: vault.line2 }} />
            <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
              {!isPos && v < 0 && (
                <div style={{
                  width: '100%', maxWidth: 20, height: h,
                  background: `linear-gradient(to bottom, ${vault.red}, ${vault.red}88)`,
                  borderRadius: '0 0 3px 3px',
                  transformOrigin: 'top',
                  animation: `vault_growUp 500ms ${vault.easeOut} ${delay} both`,
                }} />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Radar chart for Play Style
function RadarChart({ data, color, size = 220 }: { data: { label: string; value: number; }[]; color: string; size?: number; }) {
  const cx = size / 2, cy = size / 2, r = size / 2 - 26;
  const n = data.length;
  const angle = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2;
  const point = (val: number, i: number) => [cx + Math.cos(angle(i)) * (r * val / 100), cy + Math.sin(angle(i)) * (r * val / 100)];
  const poly = data.map((d, i) => point(d.value, i).join(',')).join(' ');
  return (
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {[25, 50, 75, 100].map(p => (
          <polygon key={p} points={data.map((_, i) => [cx + Math.cos(angle(i)) * (r * p / 100), cy + Math.sin(angle(i)) * (r * p / 100)].join(',')).join(' ')}
            fill="none" stroke={vault.line} strokeWidth="1" />
        ))}
        {data.map((_, i) => {
          const [x, y] = [cx + Math.cos(angle(i)) * r, cy + Math.sin(angle(i)) * r];
          return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke={vault.line} strokeWidth="1" />;
        })}
        <polygon points={poly} fill={color} fillOpacity="0.15" stroke={color} strokeWidth="2" strokeLinejoin="round"
          style={{ animation: `vault_fadeIn 600ms ${vault.easeOut} 150ms both` }} />
        {data.map((d, i) => {
          const [x, y] = point(d.value, i);
          return <circle key={i} cx={x} cy={y} r="3" fill={color} style={{ animation: `vault_cellPop 400ms ${vault.easeOut} ${300 + i * 60}ms both` }} />;
        })}
        {data.map((d, i) => {
          const [lx, ly] = [cx + Math.cos(angle(i)) * (r + 14), cy + Math.sin(angle(i)) * (r + 14)];
          return <text key={i} x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fontSize="10" fill={vault.textDim} fontFamily={vault.fontMono} style={{ letterSpacing: 1 }}>{d.label.toUpperCase()}</text>;
        })}
      </svg>
    </div>
  );
}

// GitHub-style activity heatmap with dual metric toggle
function ActivityHeatmap({ cells, metric, onMetricChange }: { cells: { hours: number[]; money: number[]; rawHours: number[]; rawMoney: number[]; }; metric: 'hours' | 'money'; onMetricChange: (m: 'hours' | 'money') => void; }) {
  const weeks = 12;
  const levels = metric === 'hours' ? cells.hours : cells.money;
  const raws = metric === 'hours' ? cells.rawHours : cells.rawMoney;
  const palette = ['transparent', 'rgba(233,185,73,0.15)', 'rgba(233,185,73,0.35)', 'rgba(233,185,73,0.6)', 'rgba(233,185,73,0.9)'];
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ color: vault.textMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.4, fontWeight: 600 }}>Activity heatmap</div>
        <div style={{ display: 'flex', gap: 2, padding: 2, background: vault.bgElev2, border: `1px solid ${vault.line}`, borderRadius: 999 }}>
          {(['hours', 'money'] as const).map(k => (
            <button key={k} onClick={() => onMetricChange(k)}
              style={{
                padding: '4px 10px', borderRadius: 999, border: 'none',
                background: metric === k ? vault.gold : 'transparent',
                color: metric === k ? '#0A0A0A' : vault.textDim,
                fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase',
                fontFamily: vault.fontSans, cursor: 'pointer',
                transition: `all ${vault.durFast} ${vault.easeOut}`,
              }}>
              {k === 'hours' ? 'Hours' : 'Won'}
            </button>
          ))}
        </div>
      </div>
      <div key={metric} style={{ display: 'grid', gridTemplateColumns: `20px repeat(${weeks}, 1fr)`, gap: 3 }}>
        <div />
        {Array.from({ length: weeks }).map((_, w) => (
          <div key={w} style={{ color: vault.textMuted, fontSize: 9, textAlign: 'center', fontFamily: vault.fontMono }}>{w % 3 === 0 ? `w${w + 1}` : ''}</div>
        ))}
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, di) => (
          <React.Fragment key={di}>
            <div style={{ color: vault.textMuted, fontSize: 9, fontFamily: vault.fontMono, textAlign: 'right', paddingRight: 4, lineHeight: '14px' }}>{d}</div>
            {Array.from({ length: weeks }).map((_, w) => {
              const cellIdx = di * weeks + w;
              const v = levels[cellIdx] || 0;
              const raw = raws[cellIdx] || 0;
              const title = v === 0 ? 'No game'
                : metric === 'hours' ? `${raw.toFixed(1)}h played`
                : `+$${raw.toFixed(0)} won`;
              return (
                <div
                  key={w}
                  title={title}
                  style={{
                    aspectRatio: '1',
                    background: palette[v],
                    border: `1px solid ${vault.line}`,
                    borderRadius: 2,
                    animation: `vault_cellPop 400ms ${vault.easeOut} ${(w * 20) + (di * 8)}ms both`,
                  }}
                />
              );
            })}
          </React.Fragment>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, justifyContent: 'flex-end', color: vault.textMuted, fontSize: 10, fontFamily: vault.fontMono }}>
        <span>less</span>
        {palette.map((c, i) => <div key={i} style={{ width: 10, height: 10, background: c, border: `1px solid ${vault.line}`, borderRadius: 2 }} />)}
        <span>more</span>
      </div>
    </div>
  );
}

// Profit bar (horizontal) for head-to-head rows
function ProfitBar({ value, max, width = 100 }: { value: number; max: number; width?: number; }) {
  const pct = Math.min(1, Math.abs(value) / (max || 1));
  const isPos = value >= 0;
  return (
    <div style={{ width, height: 6, position: 'relative', background: vault.bgElev2, borderRadius: 3, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: vault.line2 }} />
      <div style={{
        position: 'absolute', height: '100%',
        background: isPos ? vault.green : vault.red,
        left: isPos ? '50%' : `${50 - pct * 50}%`,
        width: `${pct * 50}%`,
        borderRadius: 2, opacity: 0.85,
        transition: `width 600ms ${vault.easeOut}, left 600ms ${vault.easeOut}`,
      }} />
    </div>
  );
}

// Mini stat tile (one of 4 in primary tile row)
function MiniStat({ label, value, unit, sub, color, animKey }: { label: string; value: string | number; unit?: string; sub?: string; color?: string; animKey?: string | number; }) {
  return (
    <div key={animKey} style={{ ...vaultCard, padding: '12px 10px', textAlign: 'center', animation: `vault_fadeIn 400ms ${vault.easeOut} both` }}>
      <div style={{ color: vault.textMuted, fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: 600 }}>{label}</div>
      <div style={{ color: color || vault.text, fontFamily: vault.fontSerif, fontSize: 26, fontWeight: 500, marginTop: 4, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
        {value}{unit && <span style={{ fontSize: 14, color: vault.textMuted }}>{unit}</span>}
      </div>
      {sub && <div style={{ color: vault.textMuted, fontSize: 10, marginTop: 3, fontFamily: vault.fontMono }}>{sub}</div>}
    </div>
  );
}

// Timeframe pill selector (Week / Month / Season / All)
function TimeframePills({ value, onChange }: { value: string; onChange: (v: any) => void; }) {
  const opts = [['week', 'Week'], ['month', 'Month'], ['season', 'Season'], ['all', 'All']];
  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: 4 }}>
      {opts.map(([k, l]) => (
        <button key={k} onClick={() => onChange(k)}
          style={{
            padding: '4px 10px',
            background: value === k ? vault.bgElev2 : 'transparent',
            color: value === k ? vault.text : vault.textMuted,
            border: `1px solid ${value === k ? vault.line2 : 'transparent'}`,
            borderRadius: 999, fontSize: 11, fontWeight: 600,
            fontFamily: vault.fontSans, cursor: 'pointer',
            transition: `all ${vault.durFast} ${vault.easeOut}`,
          }}>{l}</button>
      ))}
    </div>
  );
}

// League filter pills (All leagues + each league you're in)
function LeaguePills({ leagues, selectedId, onSelect }: { leagues: any[]; selectedId: string | null; onSelect: (id: string | null) => void; }) {
  return (
    <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 6, marginBottom: 12, WebkitOverflowScrolling: 'touch' }}>
      <button onClick={() => onSelect(null)}
        style={{
          padding: '6px 12px', borderRadius: 999, whiteSpace: 'nowrap',
          background: selectedId === null ? 'rgba(233,185,73,0.12)' : vault.bgElev,
          color: selectedId === null ? vault.gold : vault.textDim,
          border: `1px solid ${selectedId === null ? 'rgba(233,185,73,0.3)' : vault.line}`,
          fontSize: 12, fontWeight: 600, fontFamily: vault.fontSans, cursor: 'pointer',
          transition: `all ${vault.durFast} ${vault.easeOut}`,
        }}>All leagues</button>
      {leagues.map(lg => (
        <button key={lg.id} onClick={() => onSelect(lg.id)}
          style={{
            padding: '6px 12px', borderRadius: 999, whiteSpace: 'nowrap',
            background: selectedId === lg.id ? 'rgba(233,185,73,0.12)' : vault.bgElev,
            color: selectedId === lg.id ? vault.gold : vault.textDim,
            border: `1px solid ${selectedId === lg.id ? 'rgba(233,185,73,0.3)' : vault.line}`,
            fontSize: 12, fontWeight: 600, fontFamily: vault.fontSans, cursor: 'pointer',
            transition: `all ${vault.durFast} ${vault.easeOut}`,
          }}>{lg.name}</button>
      ))}
    </div>
  );
}

// Achievement grid — 8 tiles, earned = gold, unearned = dimmed+grayscaled
function AchievementGrid({ items }: { items: { id: string; icon: string; label: string; earned: boolean; detail: string; }[]; }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
      {items.map((a, i) => (
        <div key={a.id} style={{
          padding: 10,
          background: a.earned ? 'rgba(233,185,73,0.08)' : vault.bgElev2,
          border: `1px solid ${a.earned ? 'rgba(233,185,73,0.2)' : vault.line}`,
          borderRadius: 10, textAlign: 'center',
          opacity: a.earned ? 1 : 0.45,
          animation: `vault_fadeIn 400ms ${vault.easeOut} ${i * 40}ms both`,
          transition: `transform ${vault.durFast} ${vault.easeOut}, opacity ${vault.durFast} ${vault.easeOut}`,
        }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}>
          <div style={{ fontSize: 22, filter: a.earned ? 'none' : 'grayscale(1)' }}>{a.icon}</div>
          <div style={{ fontSize: 10, fontWeight: 600, marginTop: 4, color: a.earned ? vault.gold : vault.textMuted, letterSpacing: 0.5 }}>{a.label}</div>
          <div style={{ fontSize: 9, color: vault.textMuted, fontFamily: vault.fontMono, marginTop: 2 }}>{a.detail}</div>
        </div>
      ))}
    </div>
  );
}

// Player archetype label derived from stats
function vaultArchetype(p: { profit: number; dinners: number; streak: number; sessions: number; winPct: number; }) {
  if (p.profit > 200 && p.winPct >= 40) return { label: 'The Shark', emoji: '🦈' };
  if (p.dinners >= 3) return { label: 'The Closer', emoji: '🎯' };
  if (p.streak >= 3) return { label: 'On a Heater', emoji: '🔥' };
  if (p.profit < -100) return { label: 'The Donor', emoji: '🐟' };
  if (p.winPct >= 50) return { label: 'The Grinder', emoji: '⚙️' };
  if (p.sessions >= 10 && Math.abs(p.profit) < 50) return { label: 'Break-Even Bob', emoji: '🎲' };
  return { label: 'The Regular', emoji: '🎲' };
}

// ─── ANALYTICS ENGINE ──────────────────────────────────────────

type VaultTimeframe = 'week' | 'month' | 'season' | 'all';

function usePlayerAnalytics(displayName: string, leagueFilter: string | null, timeframe: VaultTimeframe, myLeagues: any[]) {
  const [state, setState] = useState<any>({ loading: true });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!db || !displayName) {
        setState({ loading: false, empty: true });
        return;
      }
      setState((s: any) => ({ ...s, loading: true }));

      // 1. Player rows (per-league)
      const { data: playerRows = [] } = await db.from("players")
        .select("id,league_id,total_profit,session_count,wins,best_night,worst_night,time_played_seconds,chicken_dinners,is_commissioner")
        .ilike("name", displayName);

      // 2. Profile (archived stats, privacy)
      const { data: profRow } = await db.from("profiles")
        .select("archived_profit,archived_sessions,archived_wins,archived_best_night,archived_worst_night,archived_time_seconds,archived_chicken_dinners,archived_rebuys,total_rebuys,privacy_settings")
        .ilike("display_name", displayName).single();

      // 3. Friends count
      const { data: fd = [] } = await db.from("friends")
        .select("id,requester_name,recipient_name")
        .or(`requester_name.ilike.${displayName},recipient_name.ilike.${displayName}`)
        .eq("status", "accepted");

      // 4. Session entries joined with sessions
      const playerIds = (playerRows || []).map((p: any) => p.id);
      let entries: any[] = [];
      if (playerIds.length) {
        const { data: seData = [] } = await db.from("session_entries")
          .select("profit,rebuys,buy_in,cash_out,sessions!inner(id,notes,created_at,chicken_dinner_name,pot,duration_seconds,league_id,stats_committed)")
          .eq("sessions.stats_committed", true)
          .in("player_id", playerIds);
        entries = seData || [];
      }

      if (cancelled) return;

      // Filter by league
      let filtered = entries;
      if (leagueFilter) filtered = filtered.filter((e: any) => e.sessions?.league_id === leagueFilter);

      // Filter by timeframe
      const now = new Date();
      const cutoff = new Date(now);
      if (timeframe === 'week') cutoff.setDate(now.getDate() - 7);
      else if (timeframe === 'month') cutoff.setDate(now.getDate() - 30);
      else if (timeframe === 'season') cutoff.setDate(now.getDate() - 90);
      else cutoff.setFullYear(1970);

      const inframe = filtered.filter((e: any) => new Date(e.sessions?.created_at || 0) >= cutoff);

      // Sort oldest → newest
      const sorted = [...inframe].sort((a, b) => new Date(a.sessions?.created_at || 0).getTime() - new Date(b.sessions?.created_at || 0).getTime());
      const reversed = [...sorted].reverse();

      // Basic aggregates
      const totalProfit = sorted.reduce((a, e: any) => a + (e.profit || 0), 0);
      const games = sorted.length;
      const wins = sorted.filter((e: any) => (e.profit || 0) > 0).length;
      const winPct = games > 0 ? Math.round(wins / games * 100) : 0;
      const lowerName = displayName.toLowerCase();
      const dinners = sorted.filter((e: any) => (e.sessions?.chicken_dinner_name || "").toLowerCase() === lowerName).length;
      const hoursPlayed = sorted.reduce((a, e: any) => a + ((e.sessions?.duration_seconds || 0) / 3600), 0);
      const bestNight = sorted.length ? Math.max(0, ...sorted.map((e: any) => e.profit || 0)) : 0;
      const worstNight = sorted.length ? Math.min(0, ...sorted.map((e: any) => e.profit || 0)) : 0;
      const avgPerSesh = games > 0 ? totalProfit / games : 0;
      const totalBuyIn = sorted.reduce((a, e: any) => a + (e.buy_in || 0) + (e.rebuys || 0) * (e.buy_in || 0), 0);
      const roi = totalBuyIn > 0 ? (totalProfit / totalBuyIn) * 100 : 0;

      // Current streak: walk backwards from most recent, count consecutive wins
      let streak = 0;
      for (const e of reversed) {
        if ((e.profit || 0) > 0) streak++;
        else break;
      }

      // Cumulative trend (running sum over sorted entries)
      const trend: number[] = [];
      let running = 0;
      for (const e of sorted) {
        running += (e.profit || 0);
        trend.push(running);
      }

      // Per-session bars: most recent 12
      const perSession = reversed.slice(0, 12).reverse().map((e: any) => e.profit || 0);

      // Heatmap: last 12 weeks × 7 days (84 cells), day index = row, week index = col
      // Cells are laid out row-major: cellIdx = day * 12 + week
      const hmHoursRaw = new Array(84).fill(0);
      const hmMoneyRaw = new Array(84).fill(0);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dayOfWeek = today.getDay(); // 0=Sun..6=Sat
      const mondayOffset = (dayOfWeek + 6) % 7; // 0 if Monday, 6 if Sunday
      const thisMonday = new Date(today);
      thisMonday.setDate(today.getDate() - mondayOffset);
      const oldestMonday = new Date(thisMonday);
      oldestMonday.setDate(thisMonday.getDate() - 11 * 7);

      for (const e of inframe) {
        const raw = e.sessions?.created_at;
        if (!raw) continue;
        const d = new Date(raw);
        d.setHours(0, 0, 0, 0);
        const msPerDay = 1000 * 60 * 60 * 24;
        const daysFromOldest = Math.floor((d.getTime() - oldestMonday.getTime()) / msPerDay);
        if (daysFromOldest < 0 || daysFromOldest >= 84) continue;
        const weekIdx = Math.floor(daysFromOldest / 7);
        const dayIdx = daysFromOldest % 7;
        if (weekIdx < 0 || weekIdx >= 12 || dayIdx < 0 || dayIdx >= 7) continue;
        const cellIdx = dayIdx * 12 + weekIdx;
        hmHoursRaw[cellIdx] += (e.sessions?.duration_seconds || 0) / 3600;
        hmMoneyRaw[cellIdx] += Math.max(0, e.profit || 0);
      }
      const maxHours = Math.max(0.0001, ...hmHoursRaw);
      const maxMoney = Math.max(0.0001, ...hmMoneyRaw);
      const hoursLevels = hmHoursRaw.map(v => v === 0 ? 0 : Math.min(4, Math.ceil((v / maxHours) * 4)));
      const moneyLevels = hmMoneyRaw.map(v => v === 0 ? 0 : Math.min(4, Math.ceil((v / maxMoney) * 4)));

      // Is user a commissioner anywhere?
      const isCommishSomewhere = (myLeagues || []).some((lg: any) => lg.commissioner_id === lg._myUserId);

      // Achievements
      const achievements = [
        { id: 'dinners', icon: '🍗', label: 'Dinners', earned: dinners > 0, detail: `×${dinners}` },
        { id: 'heater', icon: '🔥', label: 'Heater', earned: streak >= 3, detail: streak > 0 ? `${streak}W` : 'cold' },
        { id: 'commish', icon: '👑', label: 'Commish', earned: isCommishSomewhere, detail: 'Host' },
        { id: 'bignite', icon: '💰', label: 'Big nite', earned: bestNight >= 100, detail: bestNight > 0 ? `+$${Math.round(bestNight)}` : '—' },
        { id: 'win50', icon: '🎯', label: '50%+', earned: winPct >= 50 && games >= 3, detail: games > 0 ? `${winPct}%` : '—' },
        { id: 'fish', icon: '🐟', label: 'The fish', earned: totalProfit < -100, detail: 'Donor' },
        { id: 'grinder', icon: '📈', label: 'Grinder', earned: games >= 10, detail: `${games}G` },
        { id: 'shark', icon: '🦈', label: 'Shark', earned: totalProfit > 200, detail: totalProfit > 0 ? `+$${Math.round(totalProfit)}` : '—' },
      ];

      // Recent sessions (most recent 6)
      const recent = reversed.slice(0, 6).map((e: any) => ({
        id: e.sessions?.id,
        date: e.sessions?.created_at,
        notes: e.sessions?.notes || "Session",
        profit: e.profit || 0,
      }));

      // Leagues you play in (for filter pills)
      const leagueIds = Array.from(new Set((playerRows || []).map((p: any) => p.league_id)));
      const leagues = leagueIds
        .map((id: any) => (myLeagues || []).find((lg: any) => lg.id === id))
        .filter(Boolean);

      // Head-to-head rivals (only meaningful when a specific league is selected)
      let rivals: any[] = [];
      if (leagueFilter) {
        const { data: rivalRows = [] } = await db.from("players")
          .select("id,name,total_profit,session_count,wins")
          .eq("league_id", leagueFilter)
          .neq("name", displayName);
        const myProfitInLeague = (playerRows || []).find((p: any) => p.league_id === leagueFilter)?.total_profit || 0;
        rivals = (rivalRows || [])
          .map((r: any) => ({
            id: r.id, name: r.name,
            sessions: r.session_count || 0,
            delta: myProfitInLeague - (r.total_profit || 0),
          }))
          .sort((a: any, b: any) => Math.abs(b.delta) - Math.abs(a.delta))
          .slice(0, 4);
      }

      // Radar: derived from this window's stats (not archived)
      const radarData = [
        { label: 'Aggression', value: Math.min(100, 40 + streak * 10 + dinners * 5) },
        { label: 'Patience', value: Math.min(100, 30 + Math.max(0, games - wins) * 5) },
        { label: 'Profit', value: Math.min(100, Math.max(10, 50 + totalProfit * 0.1)) },
        { label: 'Volume', value: Math.min(100, games * 7) },
        { label: 'Clutch', value: Math.min(100, 30 + winPct) },
        { label: 'Swagger', value: Math.min(100, 20 + dinners * 15 + streak * 8) },
      ].map(r => ({ ...r, value: Math.max(10, r.value) }));

      const archetype = vaultArchetype({ profit: totalProfit, dinners, streak, sessions: games, winPct });

      // Preserve all committed entries (unfiltered) so the existing BadgeRow
      // can still compute its detailed badges from the raw stream.
      const allEntriesSorted = [...entries].sort((a: any, b: any) =>
        new Date(a.sessions?.created_at || 0).getTime() - new Date(b.sessions?.created_at || 0).getTime()
      );

      if (cancelled) return;
      setState({
        loading: false,
        empty: games === 0,
        totalProfit, games, wins, winPct, dinners, streak, hoursPlayed,
        bestNight, worstNight, avgPerSesh, roi,
        trend, perSession,
        heatmap: { hours: hoursLevels, money: moneyLevels, rawHours: hmHoursRaw, rawMoney: hmMoneyRaw },
        achievements, recent, rivals, radarData, archetype,
        leagues, friendCount: (fd || []).length,
        privacy: profRow?.privacy_settings || {},
        allEntriesSorted,
      });
    })();
    return () => { cancelled = true; };
  }, [displayName, leagueFilter, timeframe]);

  return state;
}

// ─── VAULT PROFILE VIEW ──────────────────────────────────────────

function ProfileTabView({ profile, myLeagues, isSelf, externalName, onFriends, onLogout, onSendFriendRequest, onBack }: any) {
  // Profile editing state
  const [editing, setEditing] = useState(false);
  const [newName, setNewName] = useState(profile?.display_name || "");
  const [savingName, setSavingName] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [msg, setMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Analytics state
  const displayName = isSelf ? profile.display_name : (externalName || profile.display_name);
  const [timeframe, setTimeframe] = useState<VaultTimeframe>('season');
  const [leagueFilter, setLeagueFilter] = useState<string | null>(null);
  const [heatmapMetric, setHeatmapMetric] = useState<'hours' | 'money'>('hours');
  const [isFriend, setIsFriend] = useState(false);

  const a = usePlayerAnalytics(displayName, leagueFilter, timeframe, myLeagues);

  // Lookup friend status (small side query to preserve existing behavior)
  useEffect(() => {
    if (isSelf || !db) return;
    (async () => {
      const { data: fd = [] } = await db.from("friends")
        .select("id,requester_name,recipient_name")
        .or(`requester_name.ilike.${displayName},recipient_name.ilike.${displayName}`)
        .eq("status", "accepted");
      const myName = profile.display_name.toLowerCase();
      setIsFriend((fd || []).some((f: any) => f.requester_name.toLowerCase() === myName || f.recipient_name.toLowerCase() === myName));
    })();
  }, [isSelf, displayName]);

  const handleSaveName = async () => {
    if (!db || !newName.trim() || newName.trim() === profile.display_name) return;
    setSavingName(true);
    const { error } = await db.from("profiles").update({ display_name: newName.trim() }).eq("id", profile.id);
    if (!error) {
      bustAvatarCache(profile.display_name, profile.avatar_url);
      bustAvatarCache(newName.trim(), profile.avatar_url);
      profile.display_name = newName.trim();
      setMsg("Name updated!"); setTimeout(() => setMsg(""), 3000);
    }
    setSavingName(false);
  };
  const handleAvatar = async (e: any) => {
    const f = e.target.files?.[0]; if (!f || !db) return;
    setUploadingAvatar(true);
    try {
      const ext = f.name.split('.').pop();
      const path = `${profile.id}/avatar.${ext}`;
      await db.storage.from("avatars").upload(path, f, { upsert: true });
      const { data: ud } = db.storage.from("avatars").getPublicUrl(path);
      const url = ud.publicUrl + "?t=" + Date.now();
      await db.from("profiles").update({ avatar_url: url }).eq("id", profile.id);
      bustAvatarCache(profile.display_name, url);
      profile.avatar_url = url;
      setMsg("Photo updated!"); setTimeout(() => setMsg(""), 3000);
    } finally { setUploadingAvatar(false); }
  };

  // Count-up animations for stat tiles (hooks must always run)
  const cuPL = useCountUp(Math.abs(Math.round(a.totalProfit || 0)), 1150, !a.loading);
  const cuGames = useCountUp(a.games || 0, 900, !a.loading);
  const cuWinPct = useCountUp(a.winPct || 0, 1000, !a.loading);
  const cuDinners = useCountUp(a.dinners || 0, 900, !a.loading);
  const cuStreak = useCountUp(a.streak || 0, 900, !a.loading);

  const isProfit = (a.totalProfit || 0) >= 0;
  const trendColor = isProfit ? vault.green : vault.red;
  const biggestWin = a.perSession ? Math.max(0, ...a.perSession) : 0;
  const biggestLoss = a.perSession ? Math.min(0, ...a.perSession) : 0;
  const dispPL = a.totalProfit >= 0 ? `+$${cuPL}` : `−$${cuPL}`;
  const selectedLeague = leagueFilter ? (myLeagues || []).find((lg: any) => lg.id === leagueFilter) : null;
  const subtitle = selectedLeague
    ? (selectedLeague.commissioner_id === selectedLeague._myUserId ? `Commissioner · ${selectedLeague.name}` : selectedLeague.name)
    : `${(a.leagues || []).length || 0} leagues · ${a.friendCount || 0} friends`;

  const isOtherAndHidden = !isSelf && a.privacy?.hide_stats;

  return (
    <div style={{
      background: vault.bg, minHeight: '100vh', color: vault.text,
      fontFamily: vault.fontSans, paddingBottom: 88,
    }}>
      <VaultStyles />
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '16px 20px 32px' }}>
        {/* Header */}
        <div className="vault-fade-in" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, minHeight: 44 }}>
          {!isSelf && onBack && (
            <button onClick={onBack} aria-label="Back"
              style={{ background: vault.bgElev, border: `1px solid ${vault.line}`, color: vault.text, borderRadius: 10, padding: '6px 10px', cursor: 'pointer', fontSize: 16 }}>←</button>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            {isSelf && editing ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input value={newName} onChange={e => setNewName(e.target.value)}
                  style={{ flex: 1, padding: '8px 12px', background: vault.bgElev, border: `1px solid ${vault.line2}`, borderRadius: 10, color: vault.text, fontSize: 20, fontFamily: vault.fontSerif }} />
                <button onClick={handleSaveName} disabled={savingName || !newName.trim() || newName.trim() === profile.display_name}
                  style={{ padding: '8px 12px', background: 'rgba(233,185,73,0.15)', border: '1px solid rgba(233,185,73,0.3)', borderRadius: 9, color: vault.gold, fontFamily: vault.fontMono, fontSize: 12, cursor: 'pointer' }}>
                  {savingName ? "…" : "✓"}
                </button>
              </div>
            ) : (
              <>
                <div style={{ fontFamily: vault.fontSerif, fontSize: 28, fontWeight: 500, letterSpacing: -0.5, lineHeight: 1.1 }}>{displayName}</div>
                <div style={{ color: vault.textDim, fontSize: 13, marginTop: 4 }}>{subtitle}</div>
              </>
            )}
            {msg && <div style={{ color: vault.green, fontSize: 10, fontFamily: vault.fontMono, marginTop: 4 }}>✓ {msg}</div>}
          </div>
          <div style={{ position: 'relative' }}>
            <Avatar name={displayName} url={isSelf ? profile.avatar_url : null} size={56} />
            {isSelf && editing && (
              <button onClick={() => fileRef.current?.click()}
                style={{ position: 'absolute', bottom: -4, right: -4, width: 26, height: 26, borderRadius: '50%', background: vault.gold, border: `2px solid ${vault.bg}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                {uploadingAvatar ? <Spinner size={11} /> : <Icon name="camera" size={13} color="#0A0A0A" />}
              </button>
            )}
            {isSelf && <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatar} style={{ display: 'none' }} />}
          </div>
        </div>

        {/* Action row: friends / edit / add-friend */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, justifyContent: 'flex-end' }}>
          {isSelf && (
            <>
              <button onClick={onFriends}
                style={{ padding: '6px 12px', background: vault.bgElev, border: `1px solid ${vault.line}`, borderRadius: 999, color: vault.textDim, fontFamily: vault.fontMono, fontSize: 10, letterSpacing: 1, cursor: 'pointer' }}>
                FRIENDS · {a.friendCount || 0}
              </button>
              <button onClick={() => setEditing(!editing)}
                style={{ padding: '6px 12px', background: editing ? 'rgba(233,185,73,0.15)' : vault.bgElev, border: `1px solid ${editing ? 'rgba(233,185,73,0.3)' : vault.line}`, borderRadius: 999, color: editing ? vault.gold : vault.textDim, fontFamily: vault.fontMono, fontSize: 10, letterSpacing: 1, cursor: 'pointer' }}>
                {editing ? 'DONE' : 'EDIT'}
              </button>
            </>
          )}
          {!isSelf && !isFriend && (
            <button onClick={() => onSendFriendRequest && onSendFriendRequest(displayName)}
              style={{ padding: '6px 14px', background: 'rgba(233,185,73,0.1)', border: '1px solid rgba(233,185,73,0.3)', borderRadius: 999, color: vault.gold, fontFamily: vault.fontMono, fontSize: 10, cursor: 'pointer', letterSpacing: 1 }}>+ ADD FRIEND</button>
          )}
          {!isSelf && isFriend && (
            <span style={{ padding: '6px 14px', background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: 999, color: vault.green, fontFamily: vault.fontMono, fontSize: 10 }}>● Friends</span>
          )}
        </div>

        {/* League filter pills */}
        {(a.leagues || []).length > 1 && (
          <LeaguePills leagues={a.leagues || []} selectedId={leagueFilter} onSelect={setLeagueFilter} />
        )}

        {/* Privacy gate */}
        {isOtherAndHidden ? (
          <div style={{ ...vaultCard, textAlign: 'center', padding: 28 }}>
            <div style={{ color: vault.textDim, fontFamily: vault.fontMono, fontSize: 11, letterSpacing: 1.5 }}>🔒 THIS PLAYER'S STATS ARE PRIVATE</div>
          </div>
        ) : a.loading ? (
          <div style={{ display: 'grid', gap: 12 }}>
            <div className="vault-shimmer" style={{ height: 230, borderRadius: 16, border: `1px solid ${vault.line}` }} />
            <div className="vault-shimmer" style={{ height: 90, borderRadius: 16, border: `1px solid ${vault.line}` }} />
            <div className="vault-shimmer" style={{ height: 180, borderRadius: 16, border: `1px solid ${vault.line}` }} />
          </div>
        ) : (
          <>
            {/* HERO — Season P/L with timeframe pills + area chart */}
            <div className="vault-slide-up" style={{ ...vaultCard, marginBottom: 12, textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(circle at 50% 0%, ${trendColor}15, transparent 60%)`, pointerEvents: 'none' }} />
              <div style={{ position: 'relative' }}>
                <TimeframePills value={timeframe} onChange={setTimeframe} />
                <div style={{ color: vault.textMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.4, fontWeight: 600, marginTop: 14 }}>
                  {timeframe === 'week' ? 'Week' : timeframe === 'month' ? 'Month' : timeframe === 'season' ? 'Season' : 'All-time'} P/L
                </div>
                <div key={`pl-${timeframe}-${leagueFilter}`} style={{ fontFamily: vault.fontSerif, fontSize: 56, fontWeight: 500, color: trendColor, marginTop: 2, fontVariantNumeric: 'tabular-nums', lineHeight: 1, animation: `vault_fadeIn 500ms ${vault.easeOut}` }}>
                  {dispPL}
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 14, marginTop: 6, color: vault.textDim, fontSize: 12, fontFamily: vault.fontMono }}>
                  <span>ROI {Math.round(a.roi || 0)}%</span>
                  <span style={{ color: vault.line2 }}>│</span>
                  <span style={{ color: isProfit ? vault.green : vault.red }}>
                    {isProfit ? '▲' : '▼'} ${Math.abs(Math.round(a.avgPerSesh || 0))}/sesh
                  </span>
                </div>
                <div style={{ marginTop: 14 }} key={`chart-${timeframe}-${leagueFilter}`}>
                  <BankrollChart data={a.trend || []} color={trendColor} width={320} height={90} />
                </div>
              </div>
            </div>

            {/* PRIMARY STAT TILES */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 }}>
              <MiniStat label="Games" value={cuGames} sub="played" />
              <MiniStat label="Win %" value={cuWinPct} unit="%" color={a.winPct >= 50 ? vault.green : vault.textDim} sub={`${a.wins || 0}W`} />
              <MiniStat label="🍗" value={cuDinners} sub="dinners" color={vault.gold} />
              <MiniStat label="Streak" value={a.streak > 0 ? cuStreak : '—'} sub={a.streak > 0 ? 'wins' : 'cold'} color={a.streak >= 3 ? '#FF6B35' : vault.text} />
            </div>

            {/* PER-SESSION P/L BARS */}
            <div className="vault-fade-in" style={{ ...vaultCard, marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div>
                  <div style={{ color: vault.textMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.4, fontWeight: 600 }}>Per-session P/L</div>
                  <div style={{ color: vault.textDim, fontSize: 12, marginTop: 2 }}>Last {(a.perSession || []).length} sessions</div>
                </div>
                <div style={{ display: 'flex', gap: 12, fontSize: 11, fontFamily: vault.fontMono }}>
                  <div><span style={{ color: vault.green }}>▲</span> <span style={{ color: vault.textDim }}>best </span><span style={{ color: vault.green }}>${Math.round(biggestWin)}</span></div>
                  <div><span style={{ color: vault.red }}>▼</span> <span style={{ color: vault.textDim }}>worst </span><span style={{ color: vault.red }}>−${Math.abs(Math.round(biggestLoss))}</span></div>
                </div>
              </div>
              <div key={`bars-${timeframe}-${leagueFilter}`}>
                <SessionBars data={a.perSession || []} />
              </div>
            </div>

            {/* PLAY STYLE RADAR */}
            {a.games >= 3 && (
              <div className="vault-fade-in" style={{ ...vaultCard, marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
                  <div>
                    <div style={{ color: vault.textMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.4, fontWeight: 600 }}>Play style</div>
                    <div style={{ fontFamily: vault.fontSerif, fontSize: 18, marginTop: 2 }}>{a.archetype?.label}</div>
                  </div>
                  <div style={{ fontSize: 26 }}>{a.archetype?.emoji}</div>
                </div>
                <RadarChart data={a.radarData || []} color={vault.gold} size={220} />
              </div>
            )}

            {/* HEAD-TO-HEAD (only when a league is selected) */}
            {leagueFilter && (a.rivals || []).length > 0 && (
              <div className="vault-fade-in" style={{ ...vaultCard, marginBottom: 12 }}>
                <div style={{ color: vault.textMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.4, fontWeight: 600, marginBottom: 12 }}>Head-to-head</div>
                <div style={{ display: 'grid', gap: 10 }}>
                  {(a.rivals || []).map((r: any) => {
                    const max = Math.max(1, ...(a.rivals || []).map((x: any) => Math.abs(x.delta)));
                    return (
                      <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <Avatar name={r.name} size={32} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>vs {r.name}</div>
                          <div style={{ color: vault.textMuted, fontSize: 11, fontFamily: vault.fontMono }}>{r.sessions}G</div>
                        </div>
                        <ProfitBar value={r.delta} max={max} width={100} />
                        <div style={{ color: r.delta >= 0 ? vault.green : vault.red, fontFamily: vault.fontMono, fontWeight: 600, fontSize: 13, minWidth: 56, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                          {fmtProfit(r.delta)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ACTIVITY HEATMAP */}
            <div className="vault-fade-in" style={{ ...vaultCard, marginBottom: 12 }}>
              <ActivityHeatmap cells={a.heatmap || { hours: [], money: [], rawHours: [], rawMoney: [] }} metric={heatmapMetric} onMetricChange={setHeatmapMetric} />
            </div>

            {/* ACHIEVEMENTS */}
            <div className="vault-fade-in" style={{ ...vaultCard, marginBottom: 12 }}>
              <div style={{ color: vault.textMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.4, fontWeight: 600, marginBottom: 12 }}>Achievements</div>
              <AchievementGrid items={a.achievements || []} />
            </div>

            {/* RECENT SESSIONS */}
            <div className="vault-fade-in" style={{ ...vaultCard, padding: 0, overflow: 'hidden', marginBottom: 12 }}>
              <div style={{ padding: '12px 16px', color: vault.textMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.4, borderBottom: `1px solid ${vault.line}`, fontWeight: 600 }}>Recent sessions</div>
              {(a.recent || []).length === 0 ? (
                <div style={{ padding: 20, textAlign: 'center', color: vault.textMuted, fontFamily: vault.fontMono, fontSize: 12 }}>No sessions in this window</div>
              ) : (
                (a.recent || []).map((s: any, i: number) => (
                  <div key={s.id || i} style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: i < (a.recent.length - 1) ? `1px solid ${vault.line}` : 'none' }}>
                    <div style={{ width: 4, height: 36, background: s.profit >= 0 ? vault.green : vault.red, borderRadius: 2 }} />
                    <div style={{ color: vault.textDim, fontSize: 12, minWidth: 52, fontFamily: vault.fontMono }}>
                      {new Date(s.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                    <div style={{ flex: 1, fontSize: 13, color: vault.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.notes}</div>
                    <div style={{ color: s.profit >= 0 ? vault.green : vault.red, fontFamily: vault.fontMono, fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                      {fmtProfit(s.profit)}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Full badges / achievements section from existing system — preserved below */}
            {!a.loading && (
              <BadgeRow
                allStats={{
                  total_profit: a.totalProfit, sessions: a.games, wins: a.wins,
                  best_night: a.bestNight, worst_night: a.worstNight,
                  chicken_dinners: a.dinners, rebuys: 0,
                  time_seconds: (a.hoursPlayed || 0) * 3600,
                  avg: a.avgPerSesh, leagues: (a.leagues || []).length,
                  privacy: a.privacy,
                }}
                sessionEntries={a.allEntriesSorted || []}
                friendCount={a.friendCount}
                displayName={displayName}
              />
            )}

            {/* Leagues list — only for self view */}
            {isSelf && (myLeagues || []).length > 0 && (
              <div className="vault-fade-in" style={{ ...vaultCard, marginBottom: 12 }}>
                <div style={{ color: vault.textMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.4, fontWeight: 600, marginBottom: 12 }}>My leagues</div>
                {myLeagues.map((lg: any, i: number) => (
                  <div key={lg.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: i < myLeagues.length - 1 ? `1px solid ${vault.line}` : 'none' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: lg.is_public ? 'rgba(138,180,255,0.1)' : 'rgba(233,185,73,0.1)', border: `1px solid ${lg.is_public ? 'rgba(138,180,255,0.2)' : 'rgba(233,185,73,0.2)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: lg.is_public ? vault.blue : vault.gold }}>
                      {lg.is_public ? '◎' : '♠'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: vault.text, fontSize: 13, fontWeight: 500 }}>{lg.name}</div>
                      <div style={{ color: vault.textMuted, fontSize: 11, fontFamily: vault.fontMono }}>{lg.season || 'Season'}</div>
                    </div>
                    {lg.commissioner_id === lg._myUserId && (
                      <span style={{ color: vault.gold, fontSize: 16 }}>♛</span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Edit panel — only when editing */}
            {isSelf && editing && (
              <>
                <div style={{ ...vaultCard, marginBottom: 10 }}>
                  <div style={{ color: vault.textMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.4, fontWeight: 600, marginBottom: 10 }}>Account</div>
                  <div style={{ color: vault.textDim, fontSize: 12, fontFamily: vault.fontMono, marginBottom: 6 }}>{profile.email}</div>
                  <div style={{ color: vault.textMuted, fontSize: 11, lineHeight: 1.6 }}>To change your password, sign out and use "Forgot password?"</div>
                </div>
                <button onClick={onLogout}
                  style={{ width: '100%', padding: '13px 0', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: 11, color: vault.red, fontFamily: vault.fontMono, fontWeight: 700, fontSize: 12, letterSpacing: 2, cursor: 'pointer' }}>SIGN OUT</button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// INSTALLATION INSTRUCTIONS
// ═══════════════════════════════════════════════════════════════════
//
// 1. index.html — add the Vault fonts. In the <head>, REPLACE your
//    existing Google Fonts <link> with:
//
//    <link rel="preconnect" href="https://fonts.googleapis.com">
//    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
//    <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Inter+Tight:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&family=Playfair+Display:wght@400;500;600;700&family=Space+Mono&display=swap" rel="stylesheet">
//
//    (Playfair Display and Space Mono are kept as fallbacks during the
//    transition so nothing else in the app breaks.)
//
// 2. App.tsx — find the line that starts:
//
//       function ProfileTabView({profile,myLeagues,isSelf, ...
//
//    It's currently around line 1787. Select from that line all the way
//    down through its closing `}` (the one that ends the function, around
//    line 1909 — right before `// ─── FRIENDS ─────`). Delete that entire
//    block and paste this entire file in its place.
//
// 3. Build + deploy:
//       npm run build
//       git add .
//       git commit -m "Vault profile redesign + analytics engine (phase 1)"
//       git push
//
//    Netlify auto-deploys in ~60s.
//
// ═══════════════════════════════════════════════════════════════════

// ─── FRIENDS ───────────────────────────────────────────
function FriendsView({profile,onBack,onViewFriendProfile}:any){
  const [friends,setFriends]=useState<any[]>([]);const [pending,setPending]=useState<any[]>([]);const [loading,setLoading]=useState(true);const [editMode,setEditMode]=useState(false);
  const reload=async()=>{
    if(!db)return;
    const name=profile.display_name;
    const{data}=await db.from("friends").select("*").or(`requester_name.ilike.${name},recipient_name.ilike.${name}`);
    const all=data||[];
    setFriends(all.filter((f:any)=>f.status==="accepted"));
    setPending(all.filter((f:any)=>f.status==="pending"&&f.recipient_name.toLowerCase()===name.toLowerCase()));
  };
  useEffect(()=>{reload().then(()=>setLoading(false));},[]);
  const accept=async(id:string)=>{if(!db)return;await db.from("friends").update({status:"accepted"}).eq("id",id);reload();};
  const decline=async(id:string)=>{if(!db)return;await db.from("friends").delete().eq("id",id);setPending(p=>p.filter(f=>f.id!==id));};
  const removeFriend=async(id:string,name:string)=>{
    if(!db||!window.confirm(`Remove ${name} as a friend?`))return;
    await db.from("friends").delete().eq("id",id);
    setFriends(f=>f.filter(fr=>fr.id!==id));
  };
  const getN=(f:any)=>f.requester_name.toLowerCase()===profile.display_name.toLowerCase()?f.recipient_name:f.requester_name;
  return(
    <div style={{padding:"20px 16px",maxWidth:500,margin:"0 auto"}}>
      <BackButton onBack={onBack}/><SectionTitle text="Friends"/>
      <div style={{color:"#555",fontSize:10,fontFamily:"'JetBrains Mono',monospace",marginBottom:12}}>Add friends from league standings. Mutual friends appear in your feed.</div>
      {loading&&<div style={{display:"flex",justifyContent:"center",padding:32}}><Spinner/></div>}
      {!loading&&pending.length>0&&<div style={{marginBottom:18}}>
        <div style={{color:"#888",fontSize:10,fontFamily:"'JetBrains Mono',monospace",letterSpacing:2,marginBottom:9}}>PENDING ({pending.length})</div>
        {pending.map((f:any)=><Card key={f.id} style={{marginBottom:9,display:"flex",alignItems:"center",gap:11}}>
          <Avatar name={f.requester_name} size={38}/>
          <div style={{flex:1}}><div style={{color:"#fff",fontSize:13}}>{f.requester_name}</div><div style={{color:"#555",fontSize:10,fontFamily:"'JetBrains Mono',monospace"}}>wants to be friends</div></div>
          <div style={{display:"flex",gap:7}}>
            <button onClick={()=>accept(f.id)} style={{padding:"4px 10px",background:"rgba(74,222,128,0.2)",border:"1px solid rgba(74,222,128,0.4)",borderRadius:20,color:"#4ADE80",fontFamily:"'JetBrains Mono',monospace",fontSize:10,cursor:"pointer"}}>Accept</button>
            <button onClick={()=>decline(f.id)} style={{padding:"4px 10px",background:"rgba(248,113,113,0.1)",border:"1px solid rgba(248,113,113,0.3)",borderRadius:20,color:"#F87171",fontFamily:"'JetBrains Mono',monospace",fontSize:10,cursor:"pointer"}}>Decline</button>
          </div>
        </Card>)}
      </div>}
      <div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:9}}><div style={{color:"#888",fontSize:10,fontFamily:"'JetBrains Mono',monospace",letterSpacing:2}}>FRIENDS ({friends.length})</div>{friends.length>0&&<button onClick={()=>setEditMode(e=>!e)} style={{background:"none",border:"none",color:editMode?"#E9B949":"#555",fontFamily:"'JetBrains Mono',monospace",fontSize:10,cursor:"pointer",letterSpacing:1}}>{editMode?"DONE":"EDIT"}</button>}</div>
        {!loading&&friends.length===0&&<Card><div style={{textAlign:"center",padding:"20px 0",color:"#555",fontFamily:"'JetBrains Mono',monospace",fontSize:11}}>No friends yet — tap players in league standings!</div></Card>}
        {friends.map((f:any)=>{const n=getN(f);return(
          <Card key={f.id} style={{marginBottom:9,display:"flex",alignItems:"center",gap:11}}>
            <div style={{display:"flex",alignItems:"center",gap:11,flex:1,cursor:"pointer",minWidth:0}} onClick={()=>onViewFriendProfile(n)}>
              <Avatar name={n} size={38}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{color:"#fff",fontSize:13}}>{n}</div>
                <div style={{color:"#4ADE80",fontSize:10,fontFamily:"'JetBrains Mono',monospace"}}>● Friends · tap to view</div>
              </div>
            </div>
            {editMode&&<button onClick={()=>removeFriend(f.id,n)} style={{padding:"4px 10px",background:"rgba(248,113,113,0.05)",border:"1px solid rgba(248,113,113,0.2)",borderRadius:20,color:"#F87171",fontFamily:"'JetBrains Mono',monospace",fontSize:9,cursor:"pointer",flexShrink:0}}>Remove</button>}
          </Card>
        );})}
      </div>
    </div>
  );
}

// ─── BADGES ────────────────────────────────────────────

// Road Warrior progression tiers
const RW_TIERS=[
  {sessions:10,  name:"Punt Artist",    color:"#A0714F", glow:"rgba(160,113,79,0.4)",  label:"BRONZE"},
  {sessions:50,  name:"Table Regular",  color:"#888",    glow:"rgba(160,160,160,0.4)", label:"SILVER"},
  {sessions:100, name:"Full-Time",       color:"#E9B949", glow:"rgba(233,185,73,0.4)",  label:"GOLD"},
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
  {dinners:10,  name:"Regular",   color:"#888888", glow:"rgba(160,160,160,0.4)", label:"SILVER"},
  {dinners:50,  name:"Chef",      color:"#E9B949", glow:"rgba(233,185,73,0.4)",  label:"GOLD"},
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
        <ellipse cx="24" cy="38" rx="16" ry="4" fill={earned?"#E9B949":"#333"} opacity="0.25"/>
        <path d="M24 8 C16 8 11 14 11 22 C11 28 15 32 18 34 L30 34 C33 32 37 28 37 22 C37 14 32 8 24 8Z" fill={earned?"#E9B949":"#3a3a3a"}/>
        <path d="M24 8 C24 8 28 11 28 17 C28 21 26 24 24 24 C22 24 20 21 20 17 C20 11 24 8 24 8Z" fill={earned?"rgba(232,197,106,0.4)":"rgba(255,255,255,0.06)"}/>
        <rect x="21" y="3" width="6" height="7" rx="3" fill={earned?"#F0CA5A":"#555"}/>
        <rect x="10" y="34" width="28" height="3" rx="1.5" fill={earned?"#F0CA5A":"#444"}/>
        <path d="M16 22 Q20 18 24 22 Q28 26 32 22" stroke={earned?"rgba(0,0,0,0.5)":"rgba(0,0,0,0.3)"} strokeWidth="1.5" fill="none" strokeLinecap="round"/>
        {earned&&<ellipse cx="24" cy="8" rx="3" ry="2" fill="#F0CA5A" opacity="0.6"/>}
      </svg>
    ),
  },
  {
    id:"high_roller", name:"High Roller", repeatable:false,
    desc:"Cash out +$100 profit in a single session. Earned again each time you do it.",
    icon:(earned:boolean,size=36)=>(
      <svg viewBox="0 0 48 48" width={size} height={size} fill="none">
        <rect x="6" y="17" width="36" height="22" rx="4" fill={earned?"#2a1f0a":"#222"}/>
        <rect x="6" y="17" width="36" height="22" rx="4" stroke={earned?"#E9B949":"#444"} strokeWidth="1.5"/>
        <circle cx="24" cy="28" r="7" fill={earned?"rgba(233,185,73,0.15)":"rgba(255,255,255,0.04)"} stroke={earned?"#E9B949":"#444"} strokeWidth="1.5"/>
        <text x="24" y="32" textAnchor="middle" fill={earned?"#E9B949":"#444"} fontSize="9" fontFamily="monospace" fontWeight="bold">$</text>
        <circle cx="10" cy="21" r="2" fill={earned?"#F0CA5A":"#333"}/>
        <circle cx="38" cy="35" r="2" fill={earned?"#F0CA5A":"#333"}/>
        <rect x="8" y="11" width="32" height="8" rx="3" fill={earned?"#E9B949":"#3a3a3a"} stroke={earned?"#F0CA5A":"#444"} strokeWidth="1"/>
        <path d="M16 9 L24 12 L32 9" stroke={earned?"#E9B949":"#444"} strokeWidth="1.5" strokeLinecap="round" fill="none"/>
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
        <path d="M24 40 C13 40 6 32 6 24 C6 16 13 8 21 8" stroke={earned?"#E9B949":"#3a3a3a"} strokeWidth="3" strokeLinecap="round" fill="none"/>
        <path d="M27 8 C35 8 42 16 42 24 C42 32 35 40 27 40" stroke={earned?"#F0CA5A":"#444"} strokeWidth="3" strokeLinecap="round" fill="none" strokeDasharray="5 3"/>
        <path d="M19 5 L24 11 L19 17" stroke={earned?"#E9B949":"#444"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        <path d="M20 24 L24 20 L28 24 L24 28 Z" fill={earned?"#E9B949":"#555"} stroke={earned?"#F0CA5A":"none"} strokeWidth="1"/>
        {earned&&<circle cx="24" cy="24" r="10" fill="none" stroke="#E9B949" strokeWidth="0.5" opacity="0.3"/>}
      </svg>
    ),
  },
  {
    id:"shark", name:"Shark", repeatable:true,
    desc:"Win 5 sessions in a row. The counter increases each time you hit a new streak of 5.",
    icon:(earned:boolean,size=36)=>(
      <svg viewBox="0 0 48 48" width={size} height={size} fill="none">
        <path d="M5 26 C5 26 12 17 24 17 C36 17 43 26 43 26 C43 26 36 35 24 35 C12 35 5 26 5 26Z" fill={earned?"rgba(233,185,73,0.12)":"rgba(255,255,255,0.03)"} stroke={earned?"#E9B949":"#3a3a3a"} strokeWidth="1.5"/>
        <path d="M24 17 L28 7 L33 17" fill={earned?"#E9B949":"#3a3a3a"}/>
        <circle cx="17" cy="25" r="2.5" fill={earned?"#F0CA5A":"#444"}/>
        <circle cx="17" cy="25" r="1" fill={earned?"#0A0A0A":"#222"}/>
        <path d="M30 23 L33 26 L30 29" stroke={earned?"#E9B949":"#3a3a3a"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        <path d="M34 23 L37 26 L34 29" stroke={earned?"#E9B949":"#3a3a3a"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.5"/>
        <path d="M11 30 C11 30 14 32 17 31" stroke={earned?"#E9B949":"#3a3a3a"} strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.6"/>
      </svg>
    ),
  },
  {
    id:"degenerate", name:"Degenerate", repeatable:false,
    desc:"Log 1,000 hours at the table. You didn't choose this life. This life chose you.",
    icon:(earned:boolean,size=36)=>(
      <svg viewBox="0 0 48 48" width={size} height={size} fill="none">
        <circle cx="24" cy="24" r="18" fill={earned?"rgba(233,185,73,0.08)":"#111"} stroke={earned?"#E9B949":"#333"} strokeWidth="1.5"/>
        <path d="M24 10 L24 24 L32 30" stroke={earned?"#E9B949":"#444"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="24" cy="24" r="2" fill={earned?"#F0CA5A":"#444"}/>
        {[0,30,60,90,120,150,180,210,240,270,300,330].map((deg,i)=>{
          const r=14;const rad=((deg-90)*Math.PI)/180;
          const x=24+r*Math.cos(rad);const y=24+r*Math.sin(rad);
          return<circle key={i} cx={x} cy={y} r={i%3===0?1.5:0.8} fill={earned?"#E9B949":"#333"}/>;
        })}
        {earned&&<>
          <path d="M6 38 Q12 34 18 38 Q24 42 30 38 Q36 34 42 38" stroke="#E9B949" strokeWidth="1" fill="none" opacity="0.4" strokeLinecap="round"/>
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
        <ellipse cx="23" cy="11" rx="6" ry="5" fill={earned?tierColor:"#2a2a2a"} stroke={earned?"#F0CA5A":"#333"} strokeWidth="1"/>
        {/* Bone knob at bottom */}
        <circle cx="28" cy="25" r="4" fill={earned?"#0A0A0A":"#111"} stroke={earned?tierColor:"#333"} strokeWidth="1.5"/>
        <circle cx="28" cy="25" r="2" fill={earned?tierColor:"#2a2a2a"}/>
        {earned&&<circle cx="23" cy="11" r="2" fill="#F0CA5A" opacity="0.7"/>}
      </svg>
    ),
  },
  // ─── 6 NEW ACHIEVEMENTS ───────────────────────────────
  {
    id:"bring_a_friend", name:"Bring a Friend", repeatable:false,
    desc:"Add at least one friend on Home Game. The table's better with people you know.",
    icon:(earned:boolean,size=36)=>(
      <svg viewBox="0 0 48 48" width={size} height={size} fill="none">
        <circle cx="17" cy="16" r="7" fill={earned?"rgba(138,180,255,0.3)":"#1a1a1a"} stroke={earned?"#8AB4FF":"#333"} strokeWidth="1.5"/>
        <path d="M5 36 C5 28 10 24 17 24 C24 24 29 28 29 36" stroke={earned?"#8AB4FF":"#333"} strokeWidth="2" strokeLinecap="round" fill="none"/>
        <circle cx="33" cy="16" r="6" fill={earned?"rgba(233,185,73,0.3)":"#1a1a1a"} stroke={earned?"#E9B949":"#333"} strokeWidth="1.5"/>
        <path d="M27 36 C27 29 31 25 37 25 C42 25 44 28 44 34" stroke={earned?"#E9B949":"#333"} strokeWidth="2" strokeLinecap="round" fill="none"/>
        <path d="M24 20 L28 20" stroke={earned?"#4ADE80":"#333"} strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id:"last_man_standing", name:"Carnivore", repeatable:true,
    desc:"Take the chicken dinner without a single rebuy. You came, you saw, you conquered.",
    icon:(earned:boolean,size=36)=>(
      <svg viewBox="0 0 48 48" width={size} height={size} fill="none">
        {/* Podium */}
        <rect x="18" y="28" width="12" height="14" rx="2" fill={earned?"rgba(233,185,73,0.2)":"#1a1a1a"} stroke={earned?"#E9B949":"#333"} strokeWidth="1.5"/>
        {/* Person */}
        <circle cx="24" cy="15" r="6" fill={earned?"rgba(233,185,73,0.3)":"#1a1a1a"} stroke={earned?"#E9B949":"#333"} strokeWidth="1.5"/>
        <path d="M16 26 C16 20 19 18 24 18 C29 18 32 20 32 26" stroke={earned?"#E9B949":"#333"} strokeWidth="1.5" fill="none" strokeLinecap="round"/>
        {/* Arms up */}
        <path d="M16 22 L10 18 M32 22 L38 18" stroke={earned?"#E9B949":"#333"} strokeWidth="2" strokeLinecap="round"/>
        {/* Crown */}
        <path d="M18 12 L20 8 L24 11 L28 8 L30 12" stroke={earned?"#F0CA5A":"#444"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      </svg>
    ),
  },
  {
    id:"the_whale", name:"The Whale", repeatable:true,
    desc:"Buy in 5 or more times in a single session and still lose it all. The truest degenerate move.",
    icon:(earned:boolean,size=36)=>(
      <svg viewBox="0 0 48 48" width={size} height={size} fill="none">
        {/* Whale body */}
        <path d="M6 26 C6 18 12 12 22 12 C34 12 44 18 44 26 C44 32 38 36 28 36 L8 36 Z" fill={earned?"rgba(138,180,255,0.25)":"#1a1a1a"} stroke={earned?"#8AB4FF":"#333"} strokeWidth="1.5"/>
        {/* Tail */}
        <path d="M8 36 C6 38 4 42 8 42 C10 42 10 38 12 38 C14 38 14 42 16 42 C20 42 18 38 8 36Z" fill={earned?"#8AB4FF":"#333"} opacity={earned?0.8:0.5}/>
        {/* Eye */}
        <circle cx="34" cy="22" r="2.5" fill={earned?"#8AB4FF":"#333"}/>
        <circle cx="35" cy="21" r="1" fill={earned?"#fff":"#444"}/>
        {/* Spout */}
        <path d="M28 12 C28 8 26 4 24 6 C22 4 20 8 20 12" stroke={earned?"#8AB4FF":"#333"} strokeWidth="1.5" fill="none" strokeLinecap="round"/>
        {/* Dollar */}
        <text x="18" y="30" fill={earned?"#F0CA5A":"#444"} fontSize="10" fontFamily="monospace" fontWeight="bold">$</text>
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
        <path d="M16 20 C16 14 19 10 24 10 C29 10 32 14 32 20 L34 36 C34 38 32 40 30 40 L18 40 C16 40 14 38 14 36 Z" fill={earned?"rgba(233,185,73,0.2)":"#1a1a1a"} stroke={earned?"#E9B949":"#333"} strokeWidth="1.5"/>
        {/* Bag tie */}
        <path d="M20 10 C20 6 28 6 28 10" stroke={earned?"#E9B949":"#333"} strokeWidth="2" fill="none" strokeLinecap="round"/>
        {/* Dollar sign */}
        <text x="19" y="32" fill={earned?"#F0CA5A":"#444"} fontSize="14" fontFamily="monospace" fontWeight="bold">$</text>
        {/* Speed lines */}
        <path d="M35 18 L42 16 M35 24 L43 24 M35 30 L41 32" stroke={earned?"#E9B949":"#333"} strokeWidth="1.5" strokeLinecap="round" opacity={earned?0.6:0.3}/>
      </svg>
    ),
  },
  {
    id:"bounce_back", name:"Bounce Back", repeatable:true,
    desc:"Win a session immediately after a loss. You took the hit and came back swinging.",
    icon:(earned:boolean,size=36)=>(
      <svg viewBox="0 0 48 48" width={size} height={size} fill="none">
        <path d="M14 10 L14 28" stroke={earned?"#F87171":"#333"} strokeWidth="2.5" strokeLinecap="round"/>
        <path d="M8 22 L14 30 L20 22" stroke={earned?"#F87171":"#333"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        <path d="M34 38 L34 20" stroke={earned?"#4ADE80":"#333"} strokeWidth="2.5" strokeLinecap="round"/>
        <path d="M28 26 L34 18 L40 26" stroke={earned?"#4ADE80":"#333"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
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
          fill={earned?"rgba(233,185,73,0.2)":"#1a1a1a"} stroke={earned?"#E9B949":"#333"} strokeWidth="1.5" strokeLinejoin="round"/>
        <circle cx="24" cy="24" r="5" fill={earned?"#E9B949":"#2a2a2a"}/>
        <text x="21.5" y="28" fill={earned?"#0A0A0A":"#444"} fontSize="7" fontFamily="monospace" fontWeight="bold">80</text>
        {earned&&<circle cx="24" cy="24" r="9" fill="none" stroke="#F0CA5A" strokeWidth="0.8" opacity="0.5"/>}
      </svg>
    ),
  },
  {
    id:"flash_fortune", name:"Flash Fortune", repeatable:true,
    desc:"Double your money in a session that lasts under 45 minutes. In and out before they knew what hit them.",
    icon:(earned:boolean,size=36)=>(
      <svg viewBox="0 0 48 48" width={size} height={size} fill="none">
        {/* Lightning bolt */}
        <path d="M28 6 L16 26 L23 26 L20 42 L32 22 L25 22 Z"
          fill={earned?"rgba(233,185,73,0.3)":"#1a1a1a"} stroke={earned?"#F0CA5A":"#333"} strokeWidth="1.5" strokeLinejoin="round"/>
        {/* Dollar circle */}
        <circle cx="36" cy="12" r="7" fill={earned?"rgba(74,222,128,0.2)":"#1a1a1a"} stroke={earned?"#4ADE80":"#333"} strokeWidth="1.5"/>
        <text x="33" y="16" fill={earned?"#4ADE80":"#444"} fontSize="8" fontFamily="monospace" fontWeight="bold">$</text>
        {earned&&<path d="M24 6 L28 6" stroke="#F0CA5A" strokeWidth="1" opacity="0.5" strokeLinecap="round"/>}
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
  const tierColor=activeTier?.color||"#E9B949";
  const tierGlow=activeTier?.glow||"rgba(233,185,73,0.3)";
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
            <div style={{position:"absolute",top:5,right:5,background:"#E9B949",borderRadius:8,minWidth:18,height:18,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 4px",border:"2px solid #0A0A0A"}}>
              <span style={{color:"#0A0A0A",fontSize:9,fontFamily:"'JetBrains Mono',monospace",fontWeight:700}}>{count}x</span>
            </div>
          )}
          {b.id==='road_warrior'&&rwTier&&earned&&(
            <div style={{position:"absolute",top:5,left:5,background:isFire?"#FF6B35":tierColor,borderRadius:5,padding:"1px 4px"}}>
              <span style={{color:"#0A0A0A",fontSize:7,fontFamily:"'JetBrains Mono',monospace",fontWeight:700}}>{isFire?"🔥":rwTier.label}</span>
            </div>
          )}
          <div style={{color:earned?tierColor:"#444",fontSize:8,fontFamily:"'JetBrains Mono',monospace",textAlign:"center",letterSpacing:0.5,lineHeight:1.3,fontWeight:700,paddingBottom:2}}>{displayName}</div>
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
                <div style={{color:earned?tierColor:"#555",fontFamily:"'Fraunces',serif",fontSize:20,fontWeight:700}}>{displayName}</div>
                <div style={{color:earned?"#888":"#333",fontSize:10,fontFamily:"'JetBrains Mono',monospace",letterSpacing:1,marginTop:3}}>
                  {earned?"✓ EARNED"+(b.repeatable&&count>1?` · ${count}×`:""):"LOCKED"}
                </div>
              </div>
            </div>

            {/* Description */}
            <div style={{color:"#aaa",fontSize:13,lineHeight:1.7,marginBottom:b.id==='road_warrior'?16:0}}>{b.desc}</div>

            {/* Progression — road_warrior or collector */}
            {(isRW||isCollector)&&activeTiers&&(
              <div style={{borderTop:"1px solid rgba(255,255,255,0.07)",paddingTop:16}}>
                <div style={{color:"#555",fontSize:10,fontFamily:"'JetBrains Mono',monospace",letterSpacing:1.5,marginBottom:14}}>PROGRESSION</div>
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
                          fontFamily:current?"'Fraunces',serif":"'JetBrains Mono',monospace",
                          fontWeight:current?700:400,
                          animation:isFireTier&&done?"fireFlicker 2s ease-in-out infinite":undefined,
                        }}>
                          {(!isFireTier||done)?t.name:"????"}
                          {current&&<span style={{color:t.color,fontSize:9,fontFamily:"'JetBrains Mono',monospace",marginLeft:8,background:`${t.color}22`,padding:"1px 6px",borderRadius:4}}>CURRENT</span>}
                        </div>
                        <div style={{color:done?t.color+"66":"#222",fontSize:9,fontFamily:"'JetBrains Mono',monospace",marginTop:1}}>
                          {tVal} {activeKey} · {isFireTier&&!done?"????":t.label}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {activeNext&&<div style={{color:"#555",fontSize:10,fontFamily:"'JetBrains Mono',monospace",marginTop:8,textAlign:"center" as const}}>{(activeNext as any)[activeKey]-activeVal} to go until {(activeNext as any).hidden&&!earned?"????":activeNext.name}</div>}
              </div>
            )}
            <div style={{marginTop:16,textAlign:"center" as const}}>
              <button onClick={onFlip} style={{background:"none",border:"1px solid rgba(255,255,255,0.08)",borderRadius:20,color:"#444",fontFamily:"'JetBrains Mono',monospace",fontSize:10,padding:"6px 18px",cursor:"pointer"}}>CLOSE</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function BadgeRow({allStats,sessionEntries,friendCount,displayName}:any){
  const [flipped,setFlipped]=useState<string|null>(null);
  if(!allStats)return null;
  const sessions=allStats.sessions||0;
  const dinners=allStats.chicken_dinners||0;
  const hoursPlayed=Math.floor((allStats.time_seconds||0)/3600);

  // Existing achievement counts
  const highRollerCount=(sessionEntries||[]).some((e:any)=>(e.profit||0)>=100)?1:0;
  const comebackCount=(sessionEntries||[]).filter((e:any)=>(e.rebuys||0)>=3&&(e.profit||0)>0).length;
  const sharkCount=Math.floor((allStats.wins||0)/5);

  // New achievement counts
  const whaleCount=(sessionEntries||[]).filter((e:any)=>(e.rebuys||0)>=4&&(e.profit||0)<0).length;
  const iceColdCount=(sessionEntries||[]).filter((e:any)=>(e.profit||0)===0).length;
  const robberyCount=(sessionEntries||[]).filter((e:any)=>(e.profit||0)>=(e.buy_in||0)*2&&(e.buy_in||0)>0).length;
  // Flash Fortune: doubled money (profit >= buy_in) in session < 45 min (2700s)
  const flashFortuneCount=(sessionEntries||[]).filter((e:any)=>{
    const dur=e.sessions?.duration_seconds||0;
    return dur>0&&dur<2700&&(e.profit||0)>=(e.buy_in||0)&&(e.buy_in||0)>0;
  }).length;
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
    collector:dinners>=5?1:0,
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
    flash_fortune:flashFortuneCount,
  };

  const BADGE_IDS=['road_warrior','collector'];
  const ACHIEVEMENT_IDS=['dinner_bell','high_roller','comeback_kid','shark','degenerate','bring_a_friend','last_man_standing','the_whale','ice_cold','robbery','bounce_back','get_wrecked','flash_fortune'];
  const badgeDefs=BADGE_DEFS.filter(b=>BADGE_IDS.includes(b.id));
  const achievementDefs=BADGE_DEFS.filter(b=>ACHIEVEMENT_IDS.includes(b.id));

  // Swipe pagination — 12 per page (4 rows × 3 cols)
  const PAGE_SIZE=12;
  const totalPages=Math.ceil(achievementDefs.length/PAGE_SIZE);
  const [achPage,setAchPage]=useState(0);
  const [swipeX,setSwipeX]=useState(0);
  // Use refs for real-time touch state (state is async, causes jumpy behavior)
  const touchStartX=useRef(0);const touchStartY=useRef(0);
  const isSwiping=useRef(false);const swipeResolved=useRef(false);

  const handleTouchStart=(e:any)=>{
    touchStartX.current=e.touches[0].clientX;
    touchStartY.current=e.touches[0].clientY;
    isSwiping.current=false;swipeResolved.current=false;
    setSwipeX(0);
  };
  const handleTouchMove=(e:any)=>{
    const dx=e.touches[0].clientX-touchStartX.current;
    const dy=e.touches[0].clientY-touchStartY.current;
    if(!swipeResolved.current){
      if(Math.abs(dx)<6&&Math.abs(dy)<6)return; // not moved enough yet
      swipeResolved.current=true;
      // If more vertical than horizontal → scroll, not swipe
      if(Math.abs(dy)>=Math.abs(dx)*0.8){isSwiping.current=false;return;}
      isSwiping.current=true;
    }
    if(!isSwiping.current)return;
    e.preventDefault();setSwipeX(dx);
  };
  const handleTouchEnd=()=>{
    if(isSwiping.current){
      const dx=swipeX;
      if(Math.abs(dx)>60){
        if(dx<0&&achPage<totalPages-1)setAchPage(p=>p+1);
        if(dx>0&&achPage>0)setAchPage(p=>p-1);
      }
    }
    setSwipeX(0);isSwiping.current=false;swipeResolved.current=false;
  };

  const pageAchs=achievementDefs.slice(achPage*PAGE_SIZE,(achPage+1)*PAGE_SIZE);
  // Pad to full grid
  const padded=[...pageAchs,...Array(Math.max(0,PAGE_SIZE-pageAchs.length)).fill(null)];
  const pageRows:any[][]=[];
  for(let i=0;i<padded.length;i+=3)pageRows.push(padded.slice(i,i+3));

  return(
    <>
      {/* BADGES — progressive */}
      <Card style={{marginBottom:12}}>
        <div style={{color:"#888",fontSize:10,fontFamily:"'JetBrains Mono',monospace",letterSpacing:2,marginBottom:14}}>BADGES</div>
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

      {/* ACHIEVEMENTS — swipeable pages */}
      <Card style={{marginBottom:12,overflow:"hidden" as const}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <div style={{color:"#888",fontSize:10,fontFamily:"'JetBrains Mono',monospace",letterSpacing:2}}>ACHIEVEMENTS</div>
          {totalPages>1&&<div style={{display:"flex",gap:5,alignItems:"center"}}>
            {Array(totalPages).fill(0).map((_,i)=>(
              <div key={i} onClick={()=>setAchPage(i)} style={{width:i===achPage?16:6,height:6,borderRadius:3,background:i===achPage?"#E9B949":"rgba(255,255,255,0.12)",transition:"all 0.25s",cursor:"pointer"}}/>
            ))}
          </div>}
        </div>
        {/* Swipe container */}
        <div
          style={{overflow:"hidden"}}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div style={{
            transform:`translateX(${swipeX}px)`,
            transition:isSwiping.current?"none":"transform 0.28s cubic-bezier(0.4,0,0.2,1)",
            willChange:"transform",
          }}>
            {pageRows.map((row,ri)=>(
              <div key={ri} style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:ri<pageRows.length-1?10:0}}>
                {row.map((b:any,ci:number)=>b?(
                  <BadgeCard key={b.id} b={b} count={counts[b.id]||0} sessions={sessions} dinners={dinners}
                    flipped={flipped===b.id}
                    onFlip={()=>setFlipped(flipped===b.id?null:b.id)}
                  />
                ):(
                  <div key={ci} style={{borderRadius:16,paddingBottom:"115%",background:"rgba(255,255,255,0.01)",border:"1px dashed rgba(255,255,255,0.03)"}}/>
                ))}
              </div>
            ))}
          </div>
        </div>
        {totalPages>1&&<div style={{textAlign:"center" as const,marginTop:12,color:"#444",fontSize:9,fontFamily:"'JetBrains Mono',monospace",letterSpacing:1}}>SWIPE TO SEE MORE</div>}
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
      <div style={{textAlign:"center",marginBottom:18}}><Avatar name={player.name} size={68}/><div style={{fontFamily:"'Fraunces',serif",fontSize:22,color:"#fff",marginTop:9}}>{player.name}</div><div style={{color:isUp?"#4ADE80":"#F87171",fontSize:26,fontFamily:"'JetBrains Mono',monospace",fontWeight:700,marginTop:3}}>{isUp?"+":""}${player.total_profit}</div><div style={{color:"#555",fontSize:10,fontFamily:"'JetBrains Mono',monospace"}}>in this league</div>{!isSelf&&<button onClick={()=>onSendFriendRequest(player.name)} style={{marginTop:10,padding:"6px 18px",background:"rgba(233,185,73,0.1)",border:"1px solid rgba(233,185,73,0.3)",borderRadius:20,color:"#E9B949",fontFamily:"'JetBrains Mono',monospace",fontSize:10,cursor:"pointer",letterSpacing:1}}>+ ADD FRIEND</button>}</div>
      <div style={{display:"flex",gap:7,marginBottom:12}}><StatBox label="Sessions" value={player.session_count}/><StatBox label="Wins" value={player.wins} accent="#4ADE80"/><StatBox label="Win %" value={`${winRate}%`} accent="#8AB4FF"/><StatBox label="Best" value={`$${player.best_night}`}/></div>
      {badges.length>0&&<Card style={{marginBottom:11}}><div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{badges.map((b:any,i:number)=><div key={i} style={{background:"rgba(233,185,73,0.1)",border:"1px solid rgba(233,185,73,0.25)",borderRadius:9,padding:"5px 10px",display:"flex",alignItems:"center",gap:5}}><Icon name={b.icon} size={12} color="#E9B949"/><span style={{color:"#E9B949",fontSize:10,fontFamily:"'JetBrains Mono',monospace"}}>{b.label}</span></div>)}</div></Card>}
      <Card>{([["Avg/session",fmtProfit(player.session_count>0?Math.round(player.total_profit/player.session_count):0),isUp?"#4ADE80":"#F87171"],["Biggest win",`$${player.best_night}`,"#E9B949"],["Time in league",fmtSeconds(player.time_played_seconds||0),"#888"],["Win streak",`${player.streak}`,"#4ADE80"]] as any[]).map(([label,val,col]:any,i:number,arr:any[])=><div key={label} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:i<arr.length-1?"1px solid rgba(255,255,255,0.05)":"none"}}><span style={{color:"#555",fontFamily:"'JetBrains Mono',monospace",fontSize:11}}>{label}</span><span style={{color:col,fontFamily:"'JetBrains Mono',monospace"}}>{val}</span></div>)}</Card>
    </div>
  );
}


// ─── BOTTOM NAV ────────────────────────────────────────
function BottomNav({activeTab,onTab,profile}:{activeTab:Tab;onTab:(t:Tab)=>void;profile:any}){
  const tabs=[
    {key:'league' as Tab,icon:'♠',label:'Leagues'},
    {key:'feed'   as Tab,icon:'◈',label:'Feed'},
    {key:'profile'as Tab,icon:'○',label:'Profile'},
  ];
  return(
    <div style={{position:"fixed",bottom:16,left:"50%",transform:"translateX(-50%)",display:"flex",gap:4,padding:6,background:"rgba(19,19,23,0.92)",backdropFilter:"blur(20px) saturate(160%)",WebkitBackdropFilter:"blur(20px) saturate(160%)",border:"1px solid rgba(255,255,255,0.10)",borderRadius:999,zIndex:100,boxShadow:"0 16px 48px rgba(0,0,0,0.6)"}}>
      {tabs.map(t=>(
        <button key={t.key} onClick={()=>onTab(t.key)}
          style={{background:activeTab===t.key?"#E9B949":"transparent",color:activeTab===t.key?"#0A0A0A":"#5C616B",border:"none",padding:"10px 18px",borderRadius:999,fontWeight:600,fontSize:13,transition:"all 0.2s",minWidth:44,display:"flex",alignItems:"center",gap:6,cursor:"pointer",fontFamily:"'Inter Tight',system-ui,sans-serif",whiteSpace:"nowrap"}}>
          <span>{t.icon}</span>{t.label}
        </button>
      ))}
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
      if(event==='PASSWORD_RECOVERY'){setBootstrapping(false);return;}
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
      const{data:seData}=await db.from("session_entries").select("profit,rebuys,buy_in,cash_out,sessions!inner(stats_committed,created_at,chicken_dinner_name,pot,duration_seconds)").eq("sessions.stats_committed",true).in("player_id",playerIds);
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
      if(ses.filter((e:any)=>(e.rebuys||0)>=4&&(e.profit||0)<0).length>0)earned.add('the_whale');
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
      // Insert session_entries: members first, guests separately (null player_id was previously rejecting entire batch)
      const guestLiveEntries=entries.filter((e:any)=>e.player_id==null);
      if(memberEntries.length>0){
        await db.from("session_entries").insert(memberEntries.map((e:any)=>({session_id:liveSession.id,player_id:e.player_id,buy_in:e.buy_in,rebuys:e.rebuys,cash_out:e.cash_out,profit:e.profit})));
      }
      if(guestLiveEntries.length>0){
        await db.from("session_entries").insert(guestLiveEntries.map((e:any)=>({session_id:liveSession.id,player_id:null,buy_in:e.buy_in,rebuys:e.rebuys,cash_out:e.cash_out,profit:e.profit,notes:`guest:${(e.player_name||'Guest').replace(' (guest)','')}` })));
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

    if(lsv==='handRankings')return<HandRankingsView onBack={()=>setLsv(currentLeague?'leagueDetail':'home')}/>;
    if(lsv==='seasonRecap'&&currentLeague)return<SeasonRecapView league={currentLeague} players={players} sessions={sessions} onBack={()=>setLsv('leagueDetail')}/>;
    if(lsv==='seasonArchive'&&currentLeague)return<SeasonArchiveView league={currentLeague} onBack={()=>setLsv('leagueDetail')} onViewArchive={(a:any)=>{setSelectedArchive(a);setLsv('archivedSeason');}}/>;
    if(lsv==='archivedSeason'&&currentLeague&&selectedArchive)return<ArchivedSeasonView archive={selectedArchive} league={currentLeague} onBack={()=>setLsv('seasonArchive')}/>;
    if(lsv==='leagueDetail'&&currentLeague)return<LeagueDetailView league={currentLeague} players={players} sessions={sessions} profile={profile} isCommissioner={isComm} onViewPlayer={(p:any)=>{setSelectedPlayer(p);setLsv('playerProfile');}} onStartSession={()=>liveSession?setLsv('liveSession'):setLsv('newSession')} onBack={()=>{setCurrentLeague(null);setLsv('home');}} onCommSettings={()=>setLsv('commSettings')} liveSession={liveSession} onLeaveLeague={handleLeave} onViewHandRankings={()=>setLsv('handRankings')} onViewSession={(s:any)=>{setSelectedSession(s);setLsv('sessionDetail');}} onSeasonRecap={()=>setLsv('seasonRecap')} onEndSeason={handleEndSeason} onViewSeasonArchive={()=>setLsv('seasonArchive')} showToast={showToast}/>;
    if(lsv==='sessionDetail'&&selectedSession&&currentLeague)return<SessionDetailView session={selectedSession} league={currentLeague} players={players} profile={profile} isCommissioner={isComm} onBack={()=>setLsv('leagueDetail')} onSaved={()=>loadLeagueData(currentLeague.id)} onBadgeCheck={()=>checkNewBadges(profile.display_name,authUser.id)} showToast={showToast} showError={showError}/>;
    if(lsv==='playerProfile'&&selectedPlayer)return<PlayerProfileView player={selectedPlayer} profile={profile} onBack={()=>setLsv('leagueDetail')} onSendFriendRequest={sendFriendRequest}/>;
    if(lsv==='newSession'&&currentLeague)return<NewSessionView league={currentLeague} players={players} sessions={sessions} onStart={handleStartSession} onBack={()=>setLsv('leagueDetail')}/>;
    if(lsv==='liveSession'&&currentLeague&&liveSession)return<LiveSessionView session={liveSession} liveEntries={liveEntries} players={players} profile={profile} isCommissioner={isComm} league={currentLeague} onBack={()=>setLsv('leagueDetail')} onSubmitEntry={handleSubmitEntry} onEndSession={handleEndSession}/>;
    if(lsv==='commSettings'&&currentLeague&&isComm)return<CommSettingsView league={currentLeague} players={players} onBack={()=>setLsv('leagueDetail')} onLeagueUpdated={(lg:any)=>{setCurrentLeague({...lg,_myUserId:authUser?.id});loadLeagueData(lg.id);}} onLeagueDeleted={()=>{setCurrentLeague(null);loadMyLeagues(profile.display_name,authUser.id);setLsv('home');}} showToast={showToast} showError={showError}/>;
    if(lsv==='transferComm'&&currentLeague)return<TransferCommView league={currentLeague} players={players} profile={profile} onBack={()=>setLsv('leagueDetail')} onTransferred={handleTransferAndLeave}/>;
    return<LeagueHomeView profile={profile} myLeagues={myLeagues} loading={loadingLeagues} onSelectLeague={(lg:any)=>{setCurrentLeague(lg);loadLeagueData(lg.id);setLsv('leagueDetail');}} onJoinCreate={()=>setLsv('joinCreate')} onViewPublicLeagues={()=>setLsv('publicLeagues')} onViewHandRankings={()=>setLsv('handRankings')} onViewFriends={()=>{setActiveTab('profile');setPsv('friends');}} onViewNotification={async(n:any)=>{
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
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,500;0,9..144,700;1,9..144,300&family=Inter+Tight:wght@400;500;600&family=JetBrains+Mono:wght@400;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        body,html{background:#0B0B0D;color:#F2F2F3;font-family:'Inter Tight',system-ui,sans-serif;-webkit-font-smoothing:antialiased;overscroll-behavior-y:none;touch-action:pan-x pan-y;}
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
      <div style={{background:"#0B0B0D",minHeight:"100vh",paddingBottom:96}}>
        {toast&&<div style={{position:"fixed",top:20,left:"50%",transform:"translateX(-50%)",background:"rgba(74,222,128,0.95)",color:"#fff",padding:"10px 20px",borderRadius:30,fontFamily:"'JetBrains Mono',monospace",fontSize:12,zIndex:999,maxWidth:"88vw",textAlign:"center"}}>{toast}</div>}
        {error&&<div style={{position:"fixed",top:20,left:"50%",transform:"translateX(-50%)",background:"rgba(248,113,113,0.95)",color:"#fff",padding:"10px 20px",borderRadius:30,fontFamily:"'JetBrains Mono',monospace",fontSize:12,zIndex:999,maxWidth:"88vw",textAlign:"center"}}>{error}</div>}
        {/* Badge unlock popup */}
        {badgePopup.length>0&&(()=>{
          const b=badgePopup[0];
          const isBadge=b.progression;
          return(
            <div onClick={()=>setBadgePopup(p=>p.slice(1))} style={{position:"fixed",inset:0,zIndex:1100,background:"rgba(0,0,0,0.85)",display:"flex",alignItems:"center",justifyContent:"center",padding:24,animation:"fadeIn 0.2s ease"}}>
              <div onClick={e=>e.stopPropagation()} style={{width:"100%",maxWidth:320,background:"linear-gradient(145deg,rgba(15,10,3,0.99),rgba(0,0,0,0.99))",border:"2px solid #E9B949",borderRadius:20,padding:28,boxShadow:"0 0 40px rgba(233,185,73,0.3)",animation:"slideUp 0.3s cubic-bezier(0.34,1.56,0.64,1)"}}>
                <div style={{textAlign:"center" as const,marginBottom:16}}>
                  <div style={{color:"#E9B949",fontSize:9,fontFamily:"'JetBrains Mono',monospace",letterSpacing:3,marginBottom:8}}>{isBadge?"BADGE LEVEL UP":"ACHIEVEMENT UNLOCKED"}</div>
                  <div style={{display:"flex",justifyContent:"center",marginBottom:12}}>{b.icon(true,56,"#E9B949")}</div>
                  <div style={{fontFamily:"'Fraunces',serif",fontSize:22,color:"#E9B949",fontWeight:700,marginBottom:6}}>{b.name}</div>
                  <div style={{color:"#888",fontSize:12,lineHeight:1.7,marginBottom:4}}>🎉 Congratulations!</div>
                  <div style={{color:"#666",fontSize:11,lineHeight:1.6}}>{b.desc}</div>
                </div>
                <button onClick={()=>setBadgePopup(p=>p.slice(1))} style={{width:"100%",padding:"11px 0",background:"linear-gradient(135deg,#E9B949,#F0CA5A)",border:"none",borderRadius:11,color:"#0A0A0A",fontFamily:"'JetBrains Mono',monospace",fontWeight:700,fontSize:12,letterSpacing:2,cursor:"pointer"}}>
                  {badgePopup.length>1?`NEXT (${badgePopup.length-1} more)`:"LET'S GO →"}
                </button>
              </div>
            </div>
          );
        })()}
        {activeTab==='league'&&renderLeague()}
        {activeTab==='feed'&&<FeedView profile={profile} myLeagues={myLeagues} isActive={activeTab==='feed'}/>}
        {activeTab==='profile'&&renderProfile()}
        <BottomNav activeTab={activeTab} onTab={t=>{if(t==='league'&&activeTab==='league'){setLsv('home');setCurrentLeague(null);setPlayers([]);setSessions([]);}setActiveTab(t);if(t==='profile')setPsv('self');}} profile={profile}/>
      </div>
    </>
  );
}