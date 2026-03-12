import { useState, useEffect } from "react";
import { createClient } from '@supabase/supabase-js';

// ════════════════════════════════════════════════════
//  STEP 1: PASTE YOUR SUPABASE CREDENTIALS HERE
// ════════════════════════════════════════════════════
const SUPABASE_URL      = 'https://vnzoipdzdaanucdhjknj.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_-xqlUFFrz1cKu8tPWPpiXQ_mObB5wcL';
// ════════════════════════════════════════════════════

const db = (SUPABASE_URL !== 'YOUR_SUPABASE_URL')
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

const VIEWS = { setup:'setup', home:'home', league:'league', newSession:'newSession', standings:'standings', profile:'profile' };

// ─── SHARED UI ────────────────────────────────────────

function Avatar({ name, size = 40 }) {
  const colors = ["#C9A84C","#4CAF8C","#E05555","#5577CC","#CC55AA"];
  const bg = colors[name.charCodeAt(0) % colors.length];
  return (
    <div style={{ width:size, height:size, borderRadius:"50%", background:bg,
      display:"flex", alignItems:"center", justifyContent:"center",
      fontFamily:"'Playfair Display',serif", fontWeight:700,
      fontSize:size*0.4, color:"#0D0D0D", flexShrink:0 }}>
      {name[0].toUpperCase()}
    </div>
  );
}

function Card({ children, style={} }) {
  return (
    <div style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(201,168,76,0.2)",
      borderRadius:16, padding:20, ...style }}>
      {children}
    </div>
  );
}

function Badge({ text, color="#C9A84C" }) {
  return (
    <span style={{ background:`${color}22`, color, border:`1px solid ${color}44`,
      borderRadius:20, padding:"2px 10px", fontSize:11,
      fontFamily:"'Space Mono',monospace", letterSpacing:1 }}>{text}</span>
  );
}

function StatBox({ label, value, accent="#C9A84C" }) {
  return (
    <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.08)",
      borderRadius:12, padding:"14px 16px", flex:1, minWidth:70 }}>
      <div style={{ color:"#666", fontSize:10, fontFamily:"'Space Mono',monospace", letterSpacing:1.5, textTransform:"uppercase", marginBottom:6 }}>{label}</div>
      <div style={{ color:accent, fontSize:20, fontWeight:700, fontFamily:"'Playfair Display',serif" }}>{value}</div>
    </div>
  );
}

function Spinner({ size=24 }) {
  return (
    <div style={{ width:size, height:size, border:`2px solid rgba(201,168,76,0.2)`,
      borderTopColor:"#C9A84C", borderRadius:"50%", animation:"spin 0.8s linear infinite" }} />
  );
}

// ─── SETUP SCREEN (shown when credentials not added) ──

function SetupView() {
  return (
    <div style={{ minHeight:"100vh", background:"#0A0A0A", display:"flex", flexDirection:"column",
      alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ maxWidth:420, width:"100%" }}>
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <div style={{ fontSize:40, marginBottom:12, color:"#C9A84C" }}>♠</div>
          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:36, color:"#C9A84C" }}>Home Game</div>
          <div style={{ color:"#555", fontSize:12, fontFamily:"'Space Mono',monospace", letterSpacing:2, marginTop:6 }}>SETUP REQUIRED</div>
        </div>
        <Card>
          <div style={{ color:"#E05555", fontFamily:"'Space Mono',monospace", fontSize:11, letterSpacing:1.5, marginBottom:12 }}>⚠ DATABASE NOT CONNECTED</div>
          <div style={{ color:"#aaa", fontSize:13, lineHeight:1.8, marginBottom:16 }}>
            Open <span style={{ color:"#C9A84C" }}>HomeGame.jsx</span> and replace the two placeholder values at the very top of the file with your Supabase project URL and anon key.
          </div>
          <div style={{ background:"rgba(0,0,0,0.3)", borderRadius:10, padding:14, fontFamily:"'Space Mono',monospace", fontSize:11, color:"#888", lineHeight:2 }}>
            const SUPABASE_URL = <span style={{ color:"#4CAF8C" }}>'https://xxx.supabase.co'</span><br/>
            const SUPABASE_ANON_KEY = <span style={{ color:"#4CAF8C" }}>'eyJhbGci...'</span>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ─── HOME / LOGIN ──────────────────────────────────────

function HomeView({ onEnter, loading }) {
  const [name, setName] = useState("");
  const [tab, setTab] = useState("join");
  const [code, setCode] = useState("");
  const [leagueName, setLeagueName] = useState("");
  const [buyIn, setBuyIn] = useState("20");
  const [season, setSeason] = useState("Season 1");

  const canSubmit = name.trim() && (tab==="join" ? code.trim() : leagueName.trim());
  const inputStyle = { width:"100%", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(201,168,76,0.25)",
    borderRadius:10, padding:"12px 16px", color:"#fff", fontSize:15,
    fontFamily:"'Space Mono',monospace", outline:"none", boxSizing:"border-box" };

  return (
    <div style={{ minHeight:"100vh", background:"#0A0A0A", display:"flex", flexDirection:"column",
      alignItems:"center", justifyContent:"center", padding:24, position:"relative", overflow:"hidden" }}>
      <div style={{ position:"absolute", inset:0,
        background:"radial-gradient(ellipse 80% 60% at 50% 50%, rgba(20,60,30,0.4) 0%, transparent 70%)", pointerEvents:"none" }} />
      {["♠","♥","♦","♣"].map((s,i) => (
        <div key={i} style={{ position:"absolute", fontSize:120, opacity:0.03,
          color:i%2===0?"#fff":"#C9A84C", top:["10%","70%","15%","65%"][i], left:["5%","5%","80%","82%"][i],
          pointerEvents:"none", userSelect:"none" }}>{s}</div>
      ))}
      <div style={{ width:"100%", maxWidth:400, position:"relative", zIndex:1 }}>
        <div style={{ textAlign:"center", marginBottom:40 }}>
          <div style={{ display:"flex", justifyContent:"center", gap:8, marginBottom:12 }}>
            <span style={{ fontSize:28, color:"#C9A84C" }}>♠</span>
            <span style={{ fontSize:28, color:"#E05555" }}>♥</span>
          </div>
          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:44, fontWeight:900, color:"#C9A84C", letterSpacing:-1, lineHeight:1 }}>Home Game</div>
          <div style={{ color:"#555", fontSize:12, fontFamily:"'Space Mono',monospace", letterSpacing:2, marginTop:8 }}>YOUR LEAGUE. YOUR RULES.</div>
        </div>

        <Card style={{ padding:0, overflow:"hidden" }}>
          <div style={{ display:"flex", borderBottom:"1px solid rgba(201,168,76,0.15)" }}>
            {["join","create"].map(t => (
              <button key={t} onClick={() => setTab(t)} style={{ flex:1, padding:"16px 0", background:"none", border:"none",
                color:tab===t?"#C9A84C":"#555", fontFamily:"'Space Mono',monospace", fontSize:12, letterSpacing:1.5,
                textTransform:"uppercase", cursor:"pointer",
                borderBottom:tab===t?"2px solid #C9A84C":"2px solid transparent", transition:"all 0.2s" }}>
                {t==="join"?"Join League":"Create League"}
              </button>
            ))}
          </div>

          <div style={{ padding:28 }}>
            <div style={{ marginBottom:16 }}>
              <label style={{ color:"#888", fontSize:11, fontFamily:"'Space Mono',monospace", letterSpacing:1.5, display:"block", marginBottom:8 }}>YOUR NAME</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Enter your name" style={inputStyle} />
            </div>

            {tab==="join" ? (
              <div style={{ marginBottom:20 }}>
                <label style={{ color:"#888", fontSize:11, fontFamily:"'Space Mono',monospace", letterSpacing:1.5, display:"block", marginBottom:8 }}>INVITE CODE</label>
                <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="e.g. FNP2026"
                  style={{ ...inputStyle, color:"#C9A84C", fontSize:20, letterSpacing:4, textAlign:"center" }} />
              </div>
            ) : (
              <>
                <div style={{ marginBottom:12 }}>
                  <label style={{ color:"#888", fontSize:11, fontFamily:"'Space Mono',monospace", letterSpacing:1.5, display:"block", marginBottom:8 }}>LEAGUE NAME</label>
                  <input value={leagueName} onChange={e => setLeagueName(e.target.value)} placeholder="Friday Night Poker" style={inputStyle} />
                </div>
                <div style={{ marginBottom:12 }}>
                  <label style={{ color:"#888", fontSize:11, fontFamily:"'Space Mono',monospace", letterSpacing:1.5, display:"block", marginBottom:8 }}>SEASON NAME</label>
                  <input value={season} onChange={e => setSeason(e.target.value)} placeholder="Season 1" style={inputStyle} />
                </div>
                <div style={{ marginBottom:20 }}>
                  <label style={{ color:"#888", fontSize:11, fontFamily:"'Space Mono',monospace", letterSpacing:1.5, display:"block", marginBottom:8 }}>DEFAULT BUY-IN ($)</label>
                  <input value={buyIn} onChange={e => setBuyIn(e.target.value)} type="number" min="1" style={inputStyle} />
                </div>
              </>
            )}

            <button onClick={() => canSubmit && !loading && onEnter({ name:name.trim(), tab, code, leagueName, buyIn:Number(buyIn), season })}
              style={{ width:"100%", padding:"15px 0",
                background:canSubmit&&!loading?"linear-gradient(135deg,#C9A84C,#E8C56A)":"rgba(255,255,255,0.08)",
                border:"none", borderRadius:12, color:canSubmit&&!loading?"#0A0A0A":"#444",
                fontFamily:"'Space Mono',monospace", fontWeight:700, fontSize:14, letterSpacing:2,
                cursor:canSubmit&&!loading?"pointer":"not-allowed", textTransform:"uppercase",
                display:"flex", alignItems:"center", justifyContent:"center", gap:10, transition:"all 0.2s" }}>
              {loading ? <Spinner size={18}/> : (tab==="join"?"Join League →":"Create League →")}
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ─── LEAGUE DASHBOARD ─────────────────────────────────

function LeagueView({ league, players, sessions, user, onNav, onStartSession }) {
  const isCommissioner = user.name.toLowerCase() === league.commissioner_name.toLowerCase();
  const sorted = [...players].sort((a,b) => b.total_profit - a.total_profit);

  return (
    <div style={{ padding:"20px 16px", maxWidth:500, margin:"0 auto" }}>
      <div style={{ marginBottom:24 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
          <div>
            <div style={{ color:"#555", fontSize:11, fontFamily:"'Space Mono',monospace", letterSpacing:2, marginBottom:4 }}>CURRENT LEAGUE</div>
            <div style={{ fontFamily:"'Playfair Display',serif", fontSize:26, fontWeight:700, color:"#fff" }}>{league.name}</div>
          </div>
          <Badge text={league.season} />
        </div>
        <div style={{ marginTop:8, display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
          <span style={{ color:"#555", fontSize:12, fontFamily:"'Space Mono',monospace" }}>Code:</span>
          <span style={{ color:"#C9A84C", fontSize:13, fontFamily:"'Space Mono',monospace", letterSpacing:3,
            background:"rgba(201,168,76,0.1)", padding:"3px 10px", borderRadius:6 }}>{league.code}</span>
          {isCommissioner && <Badge text="COMMISSIONER" color="#4CAF8C" />}
        </div>
      </div>

      <div style={{ display:"flex", gap:10, marginBottom:20 }}>
        <StatBox label="Players" value={players.length} />
        <StatBox label="Sessions" value={sessions.length} />
        <StatBox label="Buy-in" value={`$${league.buy_in}`} accent="#4CAF8C" />
      </div>

      {isCommissioner && (
        <button onClick={onStartSession} style={{ width:"100%", padding:"16px 0", marginBottom:20,
          background:"linear-gradient(135deg,#1a4a2a,#2a6a3a)", border:"1px solid rgba(76,175,140,0.4)",
          borderRadius:14, color:"#4CAF8C", fontFamily:"'Space Mono',monospace", fontWeight:700,
          fontSize:13, letterSpacing:2, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:10 }}>
          <span style={{ fontSize:18 }}>♠</span> START TONIGHT'S SESSION
        </button>
      )}

      <Card style={{ marginBottom:20 }}>
        <div style={{ color:"#888", fontSize:11, fontFamily:"'Space Mono',monospace", letterSpacing:2, marginBottom:16 }}>SEASON LEADERS</div>
        {sorted.length===0 && (
          <div style={{ color:"#555", fontFamily:"'Space Mono',monospace", fontSize:12, textAlign:"center", padding:"20px 0" }}>
            No sessions played yet
          </div>
        )}
        {sorted.slice(0,3).map((p,i) => (
          <div key={p.id} onClick={() => onNav(VIEWS.profile,p)} style={{ display:"flex", alignItems:"center", gap:14,
            padding:"10px 0", borderBottom:i<2?"1px solid rgba(255,255,255,0.06)":"none", cursor:"pointer" }}>
            <div style={{ width:26, height:26, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center",
              background:["rgba(201,168,76,0.2)","rgba(180,180,180,0.15)","rgba(140,80,40,0.2)"][i],
              color:["#C9A84C","#aaa","#8B5E3C"][i], fontSize:12, fontFamily:"'Space Mono',monospace", fontWeight:700 }}>{i+1}</div>
            <Avatar name={p.name} size={36} />
            <div style={{ flex:1 }}>
              <div style={{ color:"#fff", fontWeight:600 }}>{p.name}</div>
              <div style={{ color:"#555", fontSize:11, fontFamily:"'Space Mono',monospace" }}>{p.session_count} sessions · {p.wins}W</div>
            </div>
            <div style={{ color:p.total_profit>=0?"#4CAF8C":"#E05555", fontFamily:"'Space Mono',monospace", fontWeight:700 }}>
              {p.total_profit>=0?"+":""}${p.total_profit}
            </div>
          </div>
        ))}
        {players.length>0 && (
          <button onClick={() => onNav(VIEWS.standings)} style={{ width:"100%", padding:"10px 0", marginTop:12,
            background:"none", border:"1px solid rgba(201,168,76,0.2)", borderRadius:8, color:"#C9A84C",
            fontFamily:"'Space Mono',monospace", fontSize:11, letterSpacing:1.5, cursor:"pointer" }}>
            VIEW FULL STANDINGS →
          </button>
        )}
      </Card>

      <Card>
        <div style={{ color:"#888", fontSize:11, fontFamily:"'Space Mono',monospace", letterSpacing:2, marginBottom:16 }}>RECENT SESSIONS</div>
        {sessions.length===0 && (
          <div style={{ color:"#555", fontFamily:"'Space Mono',monospace", fontSize:12, textAlign:"center", padding:"20px 0" }}>
            No sessions yet — start one above!
          </div>
        )}
        {sessions.slice(0,5).map((s,i) => {
          const d = new Date(s.created_at);
          const mo = d.toLocaleDateString('en-US',{month:'short'});
          const day = d.getDate();
          return (
            <div key={s.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 0",
              borderBottom:i<Math.min(sessions.length,5)-1?"1px solid rgba(255,255,255,0.06)":"none" }}>
              <div style={{ width:40, textAlign:"center" }}>
                <div style={{ color:"#C9A84C", fontSize:12, fontFamily:"'Space Mono',monospace" }}>{day}</div>
                <div style={{ color:"#555", fontSize:10 }}>{mo}</div>
              </div>
              <div style={{ flex:1 }}>
                <div style={{ color:"#fff", fontSize:14 }}>${s.pot} pot</div>
                <div style={{ color:"#555", fontSize:11, fontFamily:"'Space Mono',monospace" }}>Winner: {s.winner_name||"TBD"}</div>
              </div>
              <Badge text="APPROVED" color="#4CAF8C" />
            </div>
          );
        })}
      </Card>
    </div>
  );
}

// ─── NEW SESSION FLOW ──────────────────────────────────

function NewSessionView({ league, players, onFinish, onBack }) {
  const [step, setStep] = useState(1);
  const [selectedIds, setSelectedIds] = useState([]);
  const [buyIns, setBuyIns] = useState({});
  const [rebuys, setRebuys] = useState({});
  const [cashOuts, setCashOuts] = useState({});
  const [startTime] = useState(Date.now());
  const [elapsed, setElapsed] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (step===2) {
      const t = setInterval(() => setElapsed(Math.floor((Date.now()-startTime)/1000)), 1000);
      return () => clearInterval(t);
    }
  }, [step]);

  const fmt = s => {
    const h=Math.floor(s/3600), m=Math.floor((s%3600)/60), sec=s%60;
    return `${h}:${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;
  };

  const totalIn = id => (buyIns[id]||0)+(rebuys[id]||0);
  const totalPot = selectedIds.reduce((a,id) => a+totalIn(id), 0);
  const totalOut = selectedIds.reduce((a,id) => a+(cashOuts[id]||0), 0);
  const getP = id => players.find(p => p.id===id);

  const inputStyle = { background:"rgba(255,255,255,0.05)", border:"1px solid rgba(201,168,76,0.25)",
    borderRadius:8, padding:"8px 10px", color:"#fff", fontSize:14,
    fontFamily:"'Space Mono',monospace", outline:"none", width:65, textAlign:"center", boxSizing:"border-box" };

  const handleApprove = async () => {
    setSaving(true);
    try {
      const entries = selectedIds.map(id => ({
        player_id:id, buy_in:buyIns[id]||0,
        rebuys:rebuys[id]||0, cash_out:cashOuts[id]||0,
        profit:(cashOuts[id]||0)-totalIn(id)
      }));
      const topEntry = [...entries].sort((a,b)=>b.profit-a.profit)[0];
      await onFinish({ entries, pot:totalPot, durationSeconds:elapsed, winnerName:getP(topEntry.player_id)?.name });
    } finally { setSaving(false); }
  };

  // STEP 1 – Pick players
  if (step===1) return (
    <div style={{ padding:"20px 16px", maxWidth:500, margin:"0 auto" }}>
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:24 }}>
        <button onClick={onBack} style={{ background:"none", border:"none", color:"#555", fontSize:22, cursor:"pointer" }}>←</button>
        <div>
          <div style={{ color:"#555", fontSize:11, fontFamily:"'Space Mono',monospace", letterSpacing:2 }}>NEW SESSION</div>
          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:22, color:"#fff" }}>Who's playing tonight?</div>
        </div>
      </div>
      <Card style={{ marginBottom:20 }}>
        {players.map(p => {
          const sel = selectedIds.includes(p.id);
          return (
            <div key={p.id} onClick={() => {
              setSelectedIds(sel?selectedIds.filter(x=>x!==p.id):[...selectedIds,p.id]);
              if (!sel) setBuyIns(b=>({...b,[p.id]:league.buy_in}));
            }} style={{ display:"flex", alignItems:"center", gap:14, padding:"12px 0",
              borderBottom:"1px solid rgba(255,255,255,0.06)", cursor:"pointer", opacity:sel?1:0.5, transition:"opacity 0.2s" }}>
              <div style={{ width:22, height:22, borderRadius:6, border:`2px solid ${sel?"#C9A84C":"#333"}`,
                background:sel?"#C9A84C":"transparent", display:"flex", alignItems:"center", justifyContent:"center",
                color:"#000", fontSize:13, flexShrink:0 }}>{sel?"✓":""}</div>
              <Avatar name={p.name} size={38} />
              <div style={{ flex:1 }}>
                <div style={{ color:"#fff" }}>{p.name}</div>
                <div style={{ color:"#555", fontSize:11, fontFamily:"'Space Mono',monospace" }}>
                  {p.wins}W · {p.total_profit>=0?"+":""}${p.total_profit} lifetime
                </div>
              </div>
            </div>
          );
        })}
      </Card>
      <button disabled={selectedIds.length<2} onClick={() => setStep(2)} style={{ width:"100%", padding:"15px 0",
        background:selectedIds.length>=2?"linear-gradient(135deg,#C9A84C,#E8C56A)":"rgba(255,255,255,0.08)",
        border:"none", borderRadius:12, color:selectedIds.length>=2?"#0A0A0A":"#444",
        fontFamily:"'Space Mono',monospace", fontWeight:700, fontSize:13, letterSpacing:2,
        cursor:selectedIds.length>=2?"pointer":"not-allowed" }}>
        START WITH {selectedIds.length} PLAYERS →
      </button>
    </div>
  );

  // STEP 2 – Live tracking
  if (step===2) return (
    <div style={{ padding:"20px 16px", maxWidth:500, margin:"0 auto" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20,
        background:"rgba(76,175,140,0.1)", border:"1px solid rgba(76,175,140,0.3)", borderRadius:14, padding:"14px 18px" }}>
        <div>
          <div style={{ color:"#4CAF8C", fontSize:11, fontFamily:"'Space Mono',monospace", letterSpacing:2 }}>● LIVE SESSION</div>
          <div style={{ color:"#fff", fontSize:24, fontFamily:"'Space Mono',monospace", marginTop:4 }}>{fmt(elapsed)}</div>
        </div>
        <div style={{ textAlign:"right" }}>
          <div style={{ color:"#888", fontSize:11, fontFamily:"'Space Mono',monospace" }}>TOTAL POT</div>
          <div style={{ color:"#C9A84C", fontSize:24, fontFamily:"'Space Mono',monospace" }}>${totalPot}</div>
        </div>
      </div>
      <Card style={{ marginBottom:20 }}>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 65px 90px", gap:8, marginBottom:12, paddingBottom:8, borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ color:"#555", fontSize:10, fontFamily:"'Space Mono',monospace" }}>PLAYER</div>
          <div style={{ color:"#555", fontSize:10, fontFamily:"'Space Mono',monospace", textAlign:"center" }}>BUY-IN</div>
          <div style={{ color:"#555", fontSize:10, fontFamily:"'Space Mono',monospace", textAlign:"center" }}>REBUYS</div>
        </div>
        {selectedIds.map(id => {
          const p = getP(id);
          return (
            <div key={id} style={{ display:"grid", gridTemplateColumns:"1fr 65px 90px", gap:8, alignItems:"center", marginBottom:14 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <Avatar name={p.name} size={32} />
                <div>
                  <div style={{ color:"#fff", fontSize:13 }}>{p.name}</div>
                  <div style={{ color:"#4CAF8C", fontSize:11, fontFamily:"'Space Mono',monospace" }}>In: ${totalIn(id)}</div>
                </div>
              </div>
              <input type="number" value={buyIns[id]||""} onChange={e => setBuyIns(b=>({...b,[id]:Number(e.target.value)}))} style={inputStyle} />
              <div style={{ display:"flex", alignItems:"center", gap:4, justifyContent:"center" }}>
                <button onClick={() => setRebuys(r=>({...r,[id]:Math.max(0,(r[id]||0)-league.buy_in)}))}
                  style={{ background:"rgba(224,85,85,0.2)", border:"1px solid rgba(224,85,85,0.3)", borderRadius:6, color:"#E05555", width:26, height:26, cursor:"pointer", fontSize:14 }}>−</button>
                <span style={{ color:"#C9A84C", fontFamily:"'Space Mono',monospace", minWidth:16, textAlign:"center", fontSize:13 }}>{(rebuys[id]||0)/league.buy_in}</span>
                <button onClick={() => setRebuys(r=>({...r,[id]:(r[id]||0)+league.buy_in}))}
                  style={{ background:"rgba(76,175,140,0.2)", border:"1px solid rgba(76,175,140,0.3)", borderRadius:6, color:"#4CAF8C", width:26, height:26, cursor:"pointer", fontSize:14 }}>+</button>
              </div>
            </div>
          );
        })}
      </Card>
      <button onClick={() => setStep(3)} style={{ width:"100%", padding:"15px 0",
        background:"linear-gradient(135deg,#5a0000,#8B1A1A)", border:"1px solid rgba(224,85,85,0.4)",
        borderRadius:12, color:"#E05555", fontFamily:"'Space Mono',monospace", fontWeight:700,
        fontSize:13, letterSpacing:2, cursor:"pointer" }}>
        END GAME & CASH OUT →
      </button>
    </div>
  );

  // STEP 3 – Cash outs & approve
  const results = selectedIds.map(id => ({
    player:getP(id), in:totalIn(id), out:cashOuts[id]||0, profit:(cashOuts[id]||0)-totalIn(id)
  })).sort((a,b)=>b.profit-a.profit);

  return (
    <div style={{ padding:"20px 16px", maxWidth:500, margin:"0 auto" }}>
      <div style={{ marginBottom:20 }}>
        <div style={{ color:"#888", fontSize:11, fontFamily:"'Space Mono',monospace", letterSpacing:2 }}>SESSION SUMMARY</div>
        <div style={{ fontFamily:"'Playfair Display',serif", fontSize:26, color:"#fff" }}>Enter Cash-Outs</div>
      </div>
      <Card style={{ marginBottom:16 }}>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 60px 80px", gap:8, marginBottom:12, borderBottom:"1px solid rgba(255,255,255,0.06)", paddingBottom:8 }}>
          <div style={{ color:"#555", fontSize:10, fontFamily:"'Space Mono',monospace" }}>PLAYER</div>
          <div style={{ color:"#555", fontSize:10, fontFamily:"'Space Mono',monospace", textAlign:"center" }}>IN</div>
          <div style={{ color:"#555", fontSize:10, fontFamily:"'Space Mono',monospace", textAlign:"center" }}>CASH OUT</div>
        </div>
        {selectedIds.map(id => {
          const p=getP(id); const profit=(cashOuts[id]||0)-totalIn(id);
          return (
            <div key={id} style={{ display:"grid", gridTemplateColumns:"1fr 60px 80px", gap:8, alignItems:"center", marginBottom:12 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <Avatar name={p.name} size={28} />
                <div>
                  <div style={{ color:"#fff", fontSize:13 }}>{p.name}</div>
                  {cashOuts[id]>0 && <div style={{ color:profit>=0?"#4CAF8C":"#E05555", fontSize:11, fontFamily:"'Space Mono',monospace" }}>{profit>=0?"+":""}${profit}</div>}
                </div>
              </div>
              <div style={{ color:"#888", fontFamily:"'Space Mono',monospace", textAlign:"center", fontSize:13 }}>${totalIn(id)}</div>
              <input type="number" value={cashOuts[id]||""} onChange={e => setCashOuts(c=>({...c,[id]:Number(e.target.value)}))}
                placeholder="$0" style={{...inputStyle,width:"100%"}} />
            </div>
          );
        })}
        <div style={{ display:"flex", justifyContent:"space-between", paddingTop:12, borderTop:"1px solid rgba(255,255,255,0.06)" }}>
          <span style={{ color:"#555", fontFamily:"'Space Mono',monospace", fontSize:12 }}>Pot: ${totalPot}</span>
          <span style={{ color:totalOut===totalPot?"#4CAF8C":"#E05555", fontFamily:"'Space Mono',monospace", fontSize:12 }}>
            Out: ${totalOut} {totalOut!==totalPot?"⚠ doesn't match":"✓ balanced"}
          </span>
        </div>
      </Card>

      {results.some(r=>r.out>0) && (
        <Card style={{ marginBottom:16 }}>
          <div style={{ color:"#888", fontSize:11, fontFamily:"'Space Mono',monospace", letterSpacing:2, marginBottom:12 }}>RESULTS</div>
          {results.map((r,i) => (
            <div key={r.player.id} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
              <div style={{ color:i===0?"#C9A84C":"#555", fontFamily:"'Space Mono',monospace", fontSize:13, width:20 }}>{i+1}</div>
              <Avatar name={r.player.name} size={28} />
              <div style={{ flex:1, color:"#fff", fontSize:14 }}>{r.player.name}</div>
              <div style={{ color:r.profit>=0?"#4CAF8C":"#E05555", fontFamily:"'Space Mono',monospace", fontWeight:700 }}>
                {r.profit>=0?"+":""}${r.profit}
              </div>
            </div>
          ))}
        </Card>
      )}

      <button onClick={handleApprove} disabled={saving} style={{ width:"100%", padding:"15px 0",
        background:saving?"rgba(255,255,255,0.08)":"linear-gradient(135deg,#C9A84C,#E8C56A)",
        border:"none", borderRadius:12, color:saving?"#444":"#0A0A0A",
        fontFamily:"'Space Mono',monospace", fontWeight:700, fontSize:13, letterSpacing:2,
        cursor:saving?"not-allowed":"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:10 }}>
        {saving ? <><Spinner size={18}/> SAVING...</> : "APPROVE & SAVE SESSION ✓"}
      </button>
    </div>
  );
}

// ─── STANDINGS ─────────────────────────────────────────

function StandingsView({ players, league, onNav, onBack }) {
  const [sortBy, setSortBy] = useState("profit");
  const getSorted = () => {
    const c=[...players];
    if (sortBy==="profit") return c.sort((a,b)=>b.total_profit-a.total_profit);
    if (sortBy==="wins") return c.sort((a,b)=>b.wins-a.wins);
    if (sortBy==="sessions") return c.sort((a,b)=>b.session_count-a.session_count);
    if (sortBy==="best") return c.sort((a,b)=>b.best_night-a.best_night);
    return c;
  };
  const sorted = getSorted();
  const top3 = [...players].sort((a,b)=>b.total_profit-a.total_profit).slice(0,3);
  const medals = ["🥇","🥈","🥉"];

  return (
    <div style={{ padding:"20px 16px", maxWidth:500, margin:"0 auto" }}>
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20 }}>
        <button onClick={onBack} style={{ background:"none", border:"none", color:"#555", fontSize:22, cursor:"pointer" }}>←</button>
        <div>
          <div style={{ color:"#555", fontSize:11, fontFamily:"'Space Mono',monospace", letterSpacing:2 }}>{league.season}</div>
          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:24, color:"#fff" }}>Standings</div>
        </div>
      </div>

      {top3.length>=2 && (
        <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"center", gap:12, marginBottom:28, height:130 }}>
          {[top3[1],top3[0],top3[2]].map((p,i) => {
            const h=[80,120,60][i]; const rank=[2,1,3][i];
            return p ? (
              <div key={p.id} onClick={() => onNav(VIEWS.profile,p)} style={{ display:"flex", flexDirection:"column", alignItems:"center", cursor:"pointer" }}>
                <Avatar name={p.name} size={rank===1?46:34} />
                <div style={{ fontSize:rank===1?18:14, marginTop:4 }}>{medals[rank-1]}</div>
                <div style={{ width:rank===1?76:58, height:h,
                  background:`rgba(201,168,76,${[0.12,0.28,0.08][i]})`,
                  border:`1px solid rgba(201,168,76,${[0.2,0.45,0.12][i]})`,
                  borderRadius:"6px 6px 0 0", marginTop:4,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  color:"#C9A84C", fontFamily:"'Space Mono',monospace", fontSize:14, fontWeight:700 }}>{rank}</div>
              </div>
            ) : <div key={i} style={{ width:58 }} />;
          })}
        </div>
      )}

      <div style={{ display:"flex", gap:6, marginBottom:16, flexWrap:"wrap" }}>
        {[["profit","Profit"],["wins","Wins"],["sessions","Sessions"],["best","Best Night"]].map(([key,label]) => (
          <button key={key} onClick={() => setSortBy(key)} style={{ padding:"6px 14px", borderRadius:20,
            background:sortBy===key?"rgba(201,168,76,0.2)":"rgba(255,255,255,0.04)",
            border:`1px solid ${sortBy===key?"rgba(201,168,76,0.4)":"rgba(255,255,255,0.08)"}`,
            color:sortBy===key?"#C9A84C":"#555", fontSize:11,
            fontFamily:"'Space Mono',monospace", cursor:"pointer", letterSpacing:1 }}>{label}</button>
        ))}
      </div>

      <Card>
        {sorted.length===0 && (
          <div style={{ color:"#555", fontFamily:"'Space Mono',monospace", fontSize:12, textAlign:"center", padding:"20px 0" }}>No data yet</div>
        )}
        {sorted.map((p,i) => (
          <div key={p.id} onClick={() => onNav(VIEWS.profile,p)} style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 0",
            borderBottom:i<sorted.length-1?"1px solid rgba(255,255,255,0.06)":"none", cursor:"pointer" }}>
            <div style={{ color:i<3?"#C9A84C":"#444", fontFamily:"'Space Mono',monospace", fontSize:14, width:20, textAlign:"center" }}>{i+1}</div>
            <Avatar name={p.name} size={38} />
            <div style={{ flex:1 }}>
              <div style={{ color:"#fff" }}>{p.name} {p.streak>1?"🔥":""}</div>
              <div style={{ color:"#555", fontSize:11, fontFamily:"'Space Mono',monospace" }}>
                {p.session_count} sessions · {p.wins}W · Best: ${p.best_night}
              </div>
            </div>
            <div style={{ textAlign:"right" }}>
              <div style={{ color:p.total_profit>=0?"#4CAF8C":"#E05555", fontFamily:"'Space Mono',monospace", fontWeight:700 }}>
                {p.total_profit>=0?"+":""}${p.total_profit}
              </div>
              {p.session_count>0 && (
                <div style={{ color:"#444", fontSize:11 }}>{((p.wins/p.session_count)*100).toFixed(0)}% win</div>
              )}
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}

// ─── PLAYER PROFILE ────────────────────────────────────

function ProfileView({ player, onBack }) {
  if (!player) return null;
  const isUp = player.total_profit >= 0;
  const winRate = player.session_count>0 ? ((player.wins/player.session_count)*100).toFixed(0) : 0;
  const badges = [
    player.session_count>=10 && { icon:"🃏", label:"10 Sessions" },
    player.wins>=3 && { icon:"🏆", label:"3x Winner" },
    player.total_profit>200 && { icon:"💰", label:"High Roller" },
    player.streak>1 && { icon:"🔥", label:`${player.streak} Streak` },
  ].filter(Boolean);

  return (
    <div style={{ padding:"20px 16px", maxWidth:500, margin:"0 auto" }}>
      <button onClick={onBack} style={{ background:"none", border:"none", color:"#555", fontSize:22, cursor:"pointer", marginBottom:20 }}>←</button>
      <div style={{ textAlign:"center", marginBottom:28 }}>
        <Avatar name={player.name} size={78} />
        <div style={{ fontFamily:"'Playfair Display',serif", fontSize:28, color:"#fff", marginTop:12 }}>{player.name}</div>
        <div style={{ color:isUp?"#4CAF8C":"#E05555", fontSize:34, fontFamily:"'Space Mono',monospace", fontWeight:700, marginTop:4 }}>
          {isUp?"+":""}${player.total_profit}
        </div>
        <div style={{ color:"#555", fontSize:12, fontFamily:"'Space Mono',monospace" }}>lifetime profit</div>
      </div>

      <div style={{ display:"flex", gap:8, marginBottom:20 }}>
        <StatBox label="Sessions" value={player.session_count} />
        <StatBox label="Wins" value={player.wins} accent="#4CAF8C" />
        <StatBox label="Win %" value={`${winRate}%`} accent="#5577CC" />
        <StatBox label="Best" value={`$${player.best_night}`} />
      </div>

      {badges.length>0 && (
        <Card style={{ marginBottom:16 }}>
          <div style={{ color:"#888", fontSize:11, fontFamily:"'Space Mono',monospace", letterSpacing:2, marginBottom:12 }}>BADGES</div>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            {badges.map((b,i) => (
              <div key={i} style={{ background:"rgba(201,168,76,0.1)", border:"1px solid rgba(201,168,76,0.25)",
                borderRadius:10, padding:"8px 14px", display:"flex", alignItems:"center", gap:6 }}>
                <span style={{ fontSize:16 }}>{b.icon}</span>
                <span style={{ color:"#C9A84C", fontSize:11, fontFamily:"'Space Mono',monospace" }}>{b.label}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <div style={{ color:"#888", fontSize:11, fontFamily:"'Space Mono',monospace", letterSpacing:2, marginBottom:12 }}>PERFORMANCE</div>
        {[
          ["Avg profit / session", `${isUp?"+":""}$${player.session_count>0?(player.total_profit/player.session_count).toFixed(0):0}`, isUp?"#4CAF8C":"#E05555"],
          ["Biggest win", `$${player.best_night}`, "#C9A84C"],
          ["Win streak", `${player.streak}${player.streak>1?" 🔥":""}`, "#fff"],
        ].map(([label,val,col],i,arr) => (
          <div key={label} style={{ display:"flex", justifyContent:"space-between", padding:"10px 0",
            borderBottom:i<arr.length-1?"1px solid rgba(255,255,255,0.06)":"none" }}>
            <span style={{ color:"#555", fontFamily:"'Space Mono',monospace", fontSize:12 }}>{label}</span>
            <span style={{ color:col, fontFamily:"'Space Mono',monospace" }}>{val}</span>
          </div>
        ))}
      </Card>
    </div>
  );
}

// ─── NAV BAR ───────────────────────────────────────────

function NavBar({ view, onNav }) {
  if (view===VIEWS.home || view===VIEWS.setup) return null;
  return (
    <div style={{ position:"fixed", bottom:0, left:0, right:0,
      background:"rgba(10,10,10,0.97)", borderTop:"1px solid rgba(201,168,76,0.15)",
      display:"flex", justifyContent:"space-around", padding:"10px 0 20px", zIndex:100 }}>
      {[{key:VIEWS.league,icon:"⬡",label:"League"},{key:VIEWS.standings,icon:"▲",label:"Standings"}].map(t => (
        <button key={t.key} onClick={() => onNav(t.key)} style={{ background:"none", border:"none",
          display:"flex", flexDirection:"column", alignItems:"center", gap:4, cursor:"pointer",
          color:view===t.key?"#C9A84C":"#444", transition:"color 0.2s" }}>
          <span style={{ fontSize:18 }}>{t.icon}</span>
          <span style={{ fontFamily:"'Space Mono',monospace", fontSize:10, letterSpacing:1 }}>{t.label}</span>
        </button>
      ))}
    </div>
  );
}

// ─── MAIN APP + DATA LAYER ─────────────────────────────

export default function HomeGameApp() {
  const [view, setView] = useState(db ? VIEWS.home : VIEWS.setup);
  const [user, setUser] = useState(null);
  const [league, setLeague] = useState(null);
  const [players, setPlayers] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(""), 3000); };
  const showError = msg => { setError(msg); setTimeout(() => setError(""), 4000); };

  const loadLeagueData = async (leagueId) => {
    const [{ data:pData }, { data:sData }] = await Promise.all([
      db.from("players").select("*").eq("league_id",leagueId).order("total_profit",{ascending:false}),
      db.from("sessions").select("*").eq("league_id",leagueId).order("created_at",{ascending:false})
    ]);
    setPlayers(pData||[]);
    setSessions(sData||[]);
  };

  const handleEnter = async ({ name, tab, code, leagueName, buyIn, season }) => {
    setLoading(true); setError("");
    try {
      if (tab==="join") {
        const { data:leagues } = await db.from("leagues").select("*").eq("code",code.trim()).limit(1);
        if (!leagues||leagues.length===0) { showError("League not found. Check your invite code."); return; }
        const lg = leagues[0];
        const { data:existing } = await db.from("players").select("*").eq("league_id",lg.id).ilike("name",name).limit(1);
        if (!existing||existing.length===0) {
          await db.from("players").insert({ league_id:lg.id, name, total_profit:0, session_count:0, wins:0, best_night:0, streak:0 });
        }
        setLeague(lg);
        setUser({ name, isCommissioner:name.toLowerCase()===lg.commissioner_name.toLowerCase() });
        await loadLeagueData(lg.id);
        setView(VIEWS.league);
      } else {
        const genCode = name.toUpperCase().replace(/\s/g,"").slice(0,3)+Math.floor(1000+Math.random()*9000);
        const { data:lg, error:lgErr } = await db.from("leagues")
          .insert({ name:leagueName, code:genCode, commissioner_name:name, buy_in:buyIn, season })
          .select().single();
        if (lgErr) throw lgErr;
        await db.from("players").insert({ league_id:lg.id, name, total_profit:0, session_count:0, wins:0, best_night:0, streak:0 });
        setLeague(lg);
        setUser({ name, isCommissioner:true });
        await loadLeagueData(lg.id);
        setView(VIEWS.league);
      }
    } catch(e) {
      showError(e.message||"Something went wrong. Try again.");
    } finally { setLoading(false); }
  };

  const handleSessionComplete = async ({ entries, pot, durationSeconds, winnerName }) => {
    try {
      const { data:session, error:sErr } = await db.from("sessions")
        .insert({ league_id:league.id, pot, winner_name:winnerName, duration_seconds:durationSeconds, status:"approved" })
        .select().single();
      if (sErr) throw sErr;

      await db.from("session_entries").insert(entries.map(e => ({ session_id:session.id, ...e })));

      for (const e of entries) {
        const p = players.find(pl => pl.id===e.player_id);
        if (!p) continue;
        const won = e.profit>0?1:0;
        await db.from("players").update({
          total_profit:(p.total_profit||0)+e.profit,
          session_count:(p.session_count||0)+1,
          wins:(p.wins||0)+won,
          best_night:e.profit>(p.best_night||0)?e.profit:(p.best_night||0),
          streak:won?(p.streak||0)+1:0
        }).eq("id",e.player_id);
      }

      await loadLeagueData(league.id);
      showToast("Session saved! Standings updated ✓");
      setView(VIEWS.league);
    } catch(e) {
      showError(e.message||"Failed to save session.");
    }
  };

  const handleNav = (newView, data=null) => {
    if (newView===VIEWS.profile && data) setSelectedPlayer(data);
    setView(newView);
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Space+Mono:wght@400;700&display=swap');
        * { box-sizing:border-box; margin:0; padding:0; }
        body, html { background:#0A0A0A; color:#fff; -webkit-font-smoothing:antialiased; }
        input[type=number] { -moz-appearance:textfield; }
        input[type=number]::-webkit-inner-spin-button, input[type=number]::-webkit-outer-spin-button { -webkit-appearance:none; }
        input::placeholder { color:#333 !important; }
        @keyframes spin { to { transform:rotate(360deg); } }
        ::-webkit-scrollbar { width:3px; } ::-webkit-scrollbar-thumb { background:#2a2a2a; border-radius:4px; }
      `}</style>

      <div style={{ background:"#0A0A0A", minHeight:"100vh", paddingBottom:view!==VIEWS.home&&view!==VIEWS.setup?80:0 }}>
        {toast && (
          <div style={{ position:"fixed", top:20, left:"50%", transform:"translateX(-50%)",
            background:"rgba(76,175,140,0.95)", color:"#fff", padding:"12px 24px",
            borderRadius:30, fontFamily:"'Space Mono',monospace", fontSize:13,
            zIndex:999, whiteSpace:"nowrap", boxShadow:"0 4px 20px rgba(76,175,140,0.4)" }}>{toast}</div>
        )}
        {error && (
          <div style={{ position:"fixed", top:20, left:"50%", transform:"translateX(-50%)",
            background:"rgba(224,85,85,0.95)", color:"#fff", padding:"12px 24px",
            borderRadius:30, fontFamily:"'Space Mono',monospace", fontSize:13,
            zIndex:999, maxWidth:"90vw", textAlign:"center" }}>{error}</div>
        )}

        {view===VIEWS.setup    && <SetupView />}
        {view===VIEWS.home     && <HomeView onEnter={handleEnter} loading={loading} />}
        {view===VIEWS.league   && league && <LeagueView league={league} players={players} sessions={sessions} user={user||{name:""}} onNav={handleNav} onStartSession={() => setView(VIEWS.newSession)} />}
        {view===VIEWS.newSession && league && <NewSessionView league={league} players={players} onFinish={handleSessionComplete} onBack={() => setView(VIEWS.league)} />}
        {view===VIEWS.standings && league && <StandingsView players={players} league={league} onNav={handleNav} onBack={() => setView(VIEWS.league)} />}
        {view===VIEWS.profile  && <ProfileView player={selectedPlayer} onBack={() => setView(VIEWS.standings)} />}

        <NavBar view={view} onNav={handleNav} />
      </div>
    </>
  );
}