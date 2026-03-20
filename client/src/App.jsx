import { useState, useRef, useEffect } from "react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

/* ─── THEME ─── */
const DARK = {
  bg:"#0e1117", bg2:"#13171f", surface:"rgba(255,255,255,.045)",
  border:"rgba(255,255,255,.08)", text:"#f9fafb", sub:"#9ca3af",
  muted:"#4b5563", accent:"#34d399", accentBg:"rgba(52,211,153,.12)",
  accentBorder:"rgba(52,211,153,.25)", blue:"#60a5fa", yellow:"#fbbf24",
  red:"#f87171", navBg:"rgba(14,17,23,.96)", input:"rgba(255,255,255,.06)",
  inputBorder:"rgba(255,255,255,.1)", placeholder:"#4b5563",
  tooltipBg:"#161b25", tooltipBorder:"#2d3748", tagBg:"rgba(255,255,255,.07)",
};
const LIGHT = {
  bg:"#f8f7f4", bg2:"#ffffff", surface:"rgba(0,0,0,.04)",
  border:"rgba(0,0,0,.08)", text:"#111827", sub:"#6b7280",
  muted:"#9ca3af", accent:"#059669", accentBg:"rgba(5,150,105,.1)",
  accentBorder:"rgba(5,150,105,.3)", blue:"#2563eb", yellow:"#d97706",
  red:"#dc2626", navBg:"rgba(248,247,244,.96)", input:"rgba(0,0,0,.05)",
  inputBorder:"rgba(0,0,0,.12)", placeholder:"#9ca3af",
  tooltipBg:"#ffffff", tooltipBorder:"#e5e7eb", tagBg:"rgba(0,0,0,.06)",
};

/* ─── HELPERS ─── */
const fmt  = n => n >= 1e6 ? `$${(n/1e6).toFixed(2)}M` : `$${(n/1e3).toFixed(0)}k`;
const fmtK = n => `$${(n/1e3).toFixed(0)}k`;
const scoreCol = (s,T) => s>=90?T.accent:s>=85?T.blue:s>=80?T.yellow:T.red;

/* ─── DATA FETCHING HOOK ─── */
function useApi(url) {
  const [data, setData]     = useState(null);
  const [loading, setLoad]  = useState(true);
  const [error, setError]   = useState(null);
  useEffect(() => {
    if (!url) return;
    setLoad(true);
    fetch(url)
      .then(r => { if (!r.ok) throw new Error(r.statusText); return r.json(); })
      .then(d => { setData(d); setLoad(false); })
      .catch(e => { setError(e.message); setLoad(false); });
  }, [url]);
  return { data, loading, error };
}

/* ─── MICRO COMPONENTS ─── */
function Pill({ val, suffix="%", T }) {
  const pos = val >= 0;
  return (
    <span style={{ background:pos?`${T.accent}22`:`${T.red}22`, color:pos?T.accent:T.red, borderRadius:99, padding:"2px 8px", fontSize:11, fontWeight:700 }}>
      {pos?"↑":"↓"} {Math.abs(val).toFixed(1)}{suffix}
    </span>
  );
}
function Card({ children, style={}, T }) {
  return <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:18, padding:"16px 14px", ...style }}>{children}</div>;
}
function SLabel({ text, T }) {
  return <div style={{ fontSize:10, letterSpacing:2.5, textTransform:"uppercase", color:T.muted, marginBottom:10 }}>{text}</div>;
}
function Spinner({ T }) {
  return <div style={{ textAlign:"center", padding:"60px 20px", color:T.muted, fontSize:13 }}>Loading…</div>;
}
function ErrMsg({ msg, T }) {
  return <div style={{ textAlign:"center", padding:"40px 20px", color:T.red, fontSize:13 }}>⚠️ {msg}</div>;
}

/* ─── LISTING CARD ─── */
function ListingCard({ listing, T }) {
  const [open, setOpen] = useState(false);
  const lastSale = listing.history?.[0];
  const gain     = lastSale ? listing.price - lastSale.price : null;
  const gainPct  = lastSale ? (gain / lastSale.price) * 100  : null;
  const years    = lastSale ? 2025 - parseInt(lastSale.date.split(" ")[1]) : 1;
  const annRet   = lastSale ? (Math.pow(listing.price/lastSale.price, 1/Math.max(years,1))-1)*100 : null;

  return (
    <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:16, overflow:"hidden", marginBottom:10 }}>
      <div style={{ padding:"14px 14px" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
          <div style={{ flex:1 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:3 }}>
              <span style={{ fontSize:20 }}>{listing.type==="Apartment"?"🏢":listing.type==="Townhouse"?"🏘":"🏠"}</span>
              <div>
                <div style={{ fontSize:14, fontWeight:700, color:T.text }}>{listing.address}</div>
                <div style={{ fontSize:11, color:T.sub }}>{listing.type} · {listing.beds} bed</div>
              </div>
            </div>
            {listing.desc && <div style={{ fontSize:11, color:T.sub, marginTop:4, lineHeight:1.5 }}>{listing.desc}</div>}
          </div>
          <div style={{ textAlign:"right", flexShrink:0, marginLeft:10 }}>
            <div style={{ fontFamily:"'Playfair Display',serif", fontSize:17, color:T.text, fontWeight:700 }}>{fmt(listing.price)}</div>
            <div style={{ fontSize:10, color:T.sub, marginTop:2 }}>For Sale</div>
          </div>
        </div>

        {lastSale && (
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <span style={{ fontSize:11, color:T.sub }}>Last sold {lastSale.date} · {fmtK(lastSale.price)}</span>
            {gainPct !== null && <Pill val={gainPct} T={T}/>}
          </div>
        )}

        {listing.history?.length > 0 && (
          <button onClick={()=>setOpen(o=>!o)} style={{ all:"unset", cursor:"pointer", marginTop:10, fontSize:11, color:T.accent, fontWeight:600 }}>
            {open?"▲ Hide history":"▼ Full sale history"}
          </button>
        )}
      </div>

      {open && (
        <div style={{ borderTop:`1px solid ${T.border}`, padding:"14px 14px" }}>
          <SLabel text="Sale History" T={T}/>
          {/* Current listing price */}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 12px", background:T.accentBg, border:`1px solid ${T.accentBorder}`, borderRadius:10, marginBottom:8 }}>
            <div>
              <div style={{ fontSize:11, color:T.accent, fontWeight:700 }}>Listed · 2025</div>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:16, color:T.text }}>{fmt(listing.price)}</div>
            </div>
            {annRet !== null && (
              <div style={{ textAlign:"right" }}>
                <div style={{ fontSize:13, fontWeight:800, color:T.accent }}>+{fmtK(gain)}</div>
                <div style={{ fontSize:10, color:T.sub }}>{annRet.toFixed(1)}% p.a.</div>
              </div>
            )}
          </div>
          {/* Past sales */}
          {listing.history.map((h,i) => {
            const prev = listing.history[i+1];
            const hGain = prev ? h.price - prev.price : null;
            const hYrs  = prev ? parseInt(h.date.split(" ")[1]) - parseInt(prev.date.split(" ")[1]) : null;
            const hAnn  = hGain && hYrs ? (Math.pow(h.price/prev.price,1/Math.max(hYrs,1))-1)*100 : null;
            return (
              <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 12px", background:T.surface, border:`1px solid ${T.border}`, borderRadius:10, marginBottom:6 }}>
                <div>
                  <div style={{ fontSize:11, color:T.sub }}>Sold · {h.date}</div>
                  <div style={{ fontFamily:"'Playfair Display',serif", fontSize:16, color:T.text }}>{fmtK(h.price)}</div>
                </div>
                {hGain !== null && (
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontSize:13, fontWeight:700, color:hGain>=0?T.accent:T.red }}>{hGain>=0?"+":""}{fmtK(hGain)}</div>
                    <div style={{ fontSize:10, color:T.sub }}>{hAnn?.toFixed(1)}% p.a.</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── HOME ─── */
function Home({ onSuburb, T }) {
  const { data:overview, loading:ol } = useApi("/api/overview");
  const { data:topSuburbs, loading:sl } = useApi("/api/suburbs/leaderboard?limit=5");
  const { data:auctions, loading:al }  = useApi("/api/auctions/recent?limit=5");
  const { data:trend, loading:tl }     = useApi("/api/trend");

  if (ol||sl||al||tl) return <Spinner T={T}/>;

  return (
    <div style={{ padding:"0 16px 100px" }}>
      <div style={{ marginBottom:22 }}>
        <div style={{ fontSize:11, letterSpacing:3, color:T.accent, textTransform:"uppercase", marginBottom:4 }}>Melbourne · Live Data</div>
        <h1 style={{ fontFamily:"'Playfair Display',serif", fontSize:28, lineHeight:1.15, color:T.text, margin:0 }}>Property<br/>Intelligence</h1>
      </div>

      {/* Quick stats */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:18 }}>
        {[
          { label:"Metro Median", val:fmt(overview?.metro_median||0), sub:`↑ ${overview?.metro_growth||0}% YoY`, c:T.text },
          { label:"Clearance Rate", val:`${overview?.clearance_rate||0}%`, sub:"Last 4 weeks", c:T.yellow },
          { label:"Best Suburb", val:overview?.best_suburb||"-", sub:`+${overview?.best_growth||0}% growth`, c:T.accent },
          { label:"Avg Yield", val:`${overview?.avg_yield||0}%`, sub:"Inner suburbs", c:T.blue },
        ].map(s=>(
          <Card key={s.label} T={T} style={{ padding:"13px 13px" }}>
            <div style={{ fontSize:10, color:T.muted, letterSpacing:1.5, textTransform:"uppercase", marginBottom:5 }}>{s.label}</div>
            <div style={{ fontFamily:"'Playfair Display',serif", fontSize:21, color:s.c, lineHeight:1 }}>{s.val}</div>
            <div style={{ fontSize:11, color:T.sub, marginTop:4 }}>{s.sub}</div>
          </Card>
        ))}
      </div>

      {/* Trend chart */}
      {trend && (
        <Card T={T} style={{ marginBottom:18 }}>
          <SLabel text="Melbourne Median Trend ($k)" T={T}/>
          <ResponsiveContainer width="100%" height={130}>
            <AreaChart data={trend} margin={{ top:4, right:4, left:-20, bottom:0 }}>
              <defs>
                <linearGradient id="tg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={T.accent} stopOpacity={0.3}/>
                  <stop offset="100%" stopColor={T.accent} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="quarter" tick={{ fill:T.muted, fontSize:10 }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fill:T.muted, fontSize:10 }} axisLine={false} tickLine={false} domain={["auto","auto"]}/>
              <Tooltip contentStyle={{ background:T.tooltipBg, border:`1px solid ${T.tooltipBorder}`, borderRadius:10, fontSize:12, color:T.text }} formatter={v=>[`$${v}k`]}/>
              <Area type="monotone" dataKey="median_k" stroke={T.accent} strokeWidth={2} fill="url(#tg)" dot={false}/>
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Top suburbs */}
      <SLabel text="🏆 Top Suburbs" T={T}/>
      <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:20 }}>
        {(topSuburbs||[]).map((s,i)=>(
          <button key={s.suburb} onClick={()=>onSuburb(s)} style={{ all:"unset", cursor:"pointer", display:"flex", alignItems:"center", gap:12, background:T.surface, border:`1px solid ${T.border}`, borderRadius:14, padding:"12px 13px" }}>
            <div style={{ width:30, height:30, borderRadius:9, background:`${T.accent}28`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:800, color:T.accent, flexShrink:0 }}>{i+1}</div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:14, fontWeight:700, color:T.text }}>{s.suburb}</div>
              <div style={{ fontSize:11, color:T.sub, marginTop:1 }}>{fmt(s.median_price)} · {s.sales_count} sales</div>
            </div>
            <div style={{ textAlign:"right", flexShrink:0 }}>
              <Pill val={s.growth_pct} T={T}/>
              <div style={{ fontSize:10, color:T.sub, marginTop:3 }}>{s.gross_yield}% yield</div>
            </div>
          </button>
        ))}
      </div>

      {/* Auctions */}
      <SLabel text="🔨 Recent Auctions" T={T}/>
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {(auctions||[]).map((a,i)=>(
          <Card key={i} T={T} style={{ padding:"12px 13px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
              <div style={{ flex:1, marginRight:10 }}>
                <div style={{ fontSize:13, fontWeight:600, color:T.text, lineHeight:1.3 }}>{a.address}</div>
                <div style={{ fontSize:12, color:T.sub, marginTop:2 }}>{fmtK(a.price)}</div>
              </div>
              <div style={{ textAlign:"right", flexShrink:0 }}>
                <span style={{ fontSize:11, fontWeight:700, color:a.result==="Sold"?T.accent:T.red }}>{a.result}</span>
                <div style={{ marginTop:3 }}><Pill val={a.above_reserve_pct} suffix="% reserve" T={T}/></div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ─── SUBURBS ─── */
function Suburbs({ onSuburb, T }) {
  const [query, setQuery] = useState("");
  const [sort, setSort]   = useState("score");
  const { data:suburbs, loading, error } = useApi("/api/suburbs");

  const filtered = (suburbs||[])
    .filter(s => s.suburb.toLowerCase().includes(query.toLowerCase()))
    .sort((a,b) => {
      if (sort==="score")  return b.score - a.score;
      if (sort==="growth") return b.growth_pct - a.growth_pct;
      if (sort==="yield")  return b.gross_yield - a.gross_yield;
      if (sort==="median") return b.median_price - a.median_price;
      return 0;
    });

  if (loading) return <Spinner T={T}/>;
  if (error)   return <ErrMsg msg={error} T={T}/>;

  return (
    <div style={{ padding:"0 16px 100px" }}>
      <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:26, color:T.text, margin:"0 0 4px" }}>Suburbs</h2>
      <p style={{ fontSize:12, color:T.sub, marginBottom:14 }}>Search & tap for full analysis</p>

      <div style={{ position:"relative", marginBottom:14 }}>
        <span style={{ position:"absolute", left:13, top:"50%", transform:"translateY(-50%)", fontSize:15, color:T.muted, pointerEvents:"none" }}>🔍</span>
        <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search Melbourne suburbs…"
          style={{ width:"100%", boxSizing:"border-box", background:T.input, border:`1.5px solid ${query?T.accentBorder:T.inputBorder}`, borderRadius:14, padding:"12px 14px 12px 40px", fontSize:14, color:T.text, outline:"none", fontFamily:"'DM Sans',sans-serif" }}/>
        {query && <button onClick={()=>setQuery("")} style={{ all:"unset", cursor:"pointer", position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", color:T.muted, fontSize:16 }}>✕</button>}
      </div>

      <div style={{ display:"flex", gap:6, marginBottom:16, overflowX:"auto", paddingBottom:2 }}>
        {["score","growth","yield","median"].map(k=>(
          <button key={k} onClick={()=>setSort(k)} style={{ padding:"5px 13px", borderRadius:99, border:`1px solid ${sort===k?T.accent:T.border}`, background:sort===k?T.accentBg:"transparent", color:sort===k?T.accent:T.sub, fontSize:12, cursor:"pointer", whiteSpace:"nowrap", fontFamily:"'DM Sans',sans-serif", textTransform:"capitalize" }}>
            {sort===k?"✓ ":""}{k}
          </button>
        ))}
      </div>

      {query && <div style={{ fontSize:12, color:T.muted, marginBottom:10 }}>{filtered.length} suburb{filtered.length!==1?"s":""} found for "{query}"</div>}

      {filtered.length===0 ? (
        <div style={{ textAlign:"center", padding:"40px 20px", color:T.muted }}>
          <div style={{ fontSize:32, marginBottom:10 }}>🔍</div>
          <div style={{ fontSize:14 }}>No suburbs found for "{query}"</div>
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {filtered.map((s,i)=>(
            <button key={s.suburb} onClick={()=>onSuburb(s)} style={{ all:"unset", cursor:"pointer", background:T.surface, border:`1px solid ${T.border}`, borderRadius:16, padding:"14px 14px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                <div>
                  <span style={{ fontSize:15, fontWeight:700, color:T.text }}>{s.suburb}</span>
                  <span style={{ fontSize:11, color:T.muted, marginLeft:8 }}>#{i+1}</span>
                </div>
                <div style={{ fontSize:18, fontWeight:800, color:scoreCol(s.score,T) }}>{s.score}<span style={{ fontSize:10, color:T.muted, fontWeight:400 }}>/100</span></div>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:6, marginBottom:10 }}>
                {[{l:"Median",v:fmt(s.median_price),c:T.text},{l:"Growth",v:`+${s.growth_pct}%`,c:T.accent},{l:"Yield",v:`${s.gross_yield}%`,c:T.blue}].map(m=>(
                  <div key={m.l} style={{ background:T.tagBg, borderRadius:10, padding:"7px 8px" }}>
                    <div style={{ fontSize:9, color:T.muted, letterSpacing:1.5, textTransform:"uppercase", marginBottom:3 }}>{m.l}</div>
                    <div style={{ fontSize:13, fontWeight:700, color:m.c }}>{m.v}</div>
                  </div>
                ))}
              </div>
              <div style={{ background:T.border, borderRadius:99, height:4, overflow:"hidden" }}>
                <div style={{ width:`${s.score}%`, height:"100%", background:scoreCol(s.score,T), borderRadius:99 }}/>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── SUBURB DETAIL ─── */
function SuburbDetail({ suburb, onBack, T }) {
  const name = suburb.suburb || suburb.name;
  const { data:detail, loading:dl }   = useApi(`/api/suburbs/${encodeURIComponent(name)}`);
  const { data:trend, loading:tl }    = useApi(`/api/suburbs/${encodeURIComponent(name)}/trend`);
  const { data:listings, loading:ll } = useApi(`/api/suburbs/${encodeURIComponent(name)}/listings`);

  if (dl||tl) return <div style={{ padding:"0 16px" }}><button onClick={onBack} style={{ all:"unset", cursor:"pointer", color:T.accent, fontSize:13, margin:"16px 0", display:"block" }}>← Back</button><Spinner T={T}/></div>;

  const d = detail || suburb;

  return (
    <div style={{ padding:"0 16px 100px" }}>
      <button onClick={onBack} style={{ all:"unset", cursor:"pointer", color:T.accent, fontSize:13, marginBottom:16, display:"flex", alignItems:"center", gap:5 }}>← Back</button>
      <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:26, color:T.text, margin:"0 0 3px" }}>{name}</h2>
      <div style={{ fontSize:12, color:T.sub, marginBottom:18 }}>{d.sales_count||d.volume} sales · Latest quarter</div>

      <Card T={T} style={{ marginBottom:14, background:T.accentBg, border:`1px solid ${T.accentBorder}` }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <div style={{ fontSize:10, color:T.accent, letterSpacing:2, textTransform:"uppercase" }}>Investment Score</div>
            <div style={{ fontFamily:"'Playfair Display',serif", fontSize:42, color:T.accent, lineHeight:1 }}>{d.score}</div>
          </div>
          <div style={{ textAlign:"right" }}>
            <Pill val={d.growth_pct||d.growth} T={T}/>
            <div style={{ fontSize:11, color:T.sub, marginTop:4 }}>Annual growth</div>
          </div>
        </div>
      </Card>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginBottom:14 }}>
        {[
          { l:"Median", v:fmt(d.median_price||d.median), c:T.text },
          { l:"Yield",  v:`${d.gross_yield||d.yield}%`, c:T.blue },
          { l:"Rent/wk",v:`$${d.median_rent||d.rent}`, c:T.yellow },
        ].map(m=>(
          <Card key={m.l} T={T} style={{ padding:"11px 10px", textAlign:"center" }}>
            <div style={{ fontSize:9, color:T.muted, letterSpacing:1.5, textTransform:"uppercase", marginBottom:5 }}>{m.l}</div>
            <div style={{ fontSize:15, fontWeight:800, color:m.c }}>{m.v}</div>
          </Card>
        ))}
      </div>

      {trend && (
        <Card T={T} style={{ marginBottom:14 }}>
          <SLabel text="Median Price Trend ($k)" T={T}/>
          <ResponsiveContainer width="100%" height={130}>
            <AreaChart data={trend} margin={{ top:4, right:4, left:-20, bottom:0 }}>
              <defs>
                <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={T.blue} stopOpacity={0.3}/>
                  <stop offset="100%" stopColor={T.blue} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="quarter" tick={{ fill:T.muted, fontSize:10 }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fill:T.muted, fontSize:10 }} axisLine={false} tickLine={false} domain={["auto","auto"]}/>
              <Tooltip contentStyle={{ background:T.tooltipBg, border:`1px solid ${T.tooltipBorder}`, borderRadius:10, fontSize:12, color:T.text }} formatter={v=>[`$${v}k`]}/>
              <Area type="monotone" dataKey="median_k" stroke={T.blue} strokeWidth={2.5} fill="url(#sg)" dot={false}/>
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      )}

      <Card T={T} style={{ marginBottom:18 }}>
        <SLabel text="Investment Snapshot" T={T}/>
        {[
          { l:"Buy at median",     v:fmt(d.median_price||d.median) },
          { l:"Est. weekly rent",  v:`$${d.median_rent||d.rent}/wk` },
          { l:"Annual rental income", v:`$${(((d.median_rent||d.rent)*52)/1000).toFixed(0)}k` },
          { l:"Gross yield",       v:`${d.gross_yield||d.yield}%` },
          { l:"5yr projected value", v:fmt(Math.round((d.median_price||d.median)*Math.pow(1+(d.growth_pct||d.growth)/100,5)/10000)*10000) },
        ].map(r=>(
          <div key={r.l} style={{ display:"flex", justifyContent:"space-between", padding:"9px 0", borderBottom:`1px solid ${T.border}` }}>
            <span style={{ fontSize:13, color:T.sub }}>{r.l}</span>
            <span style={{ fontSize:13, fontWeight:700, color:T.text }}>{r.v}</span>
          </div>
        ))}
      </Card>

      <SLabel text={`🏡 Properties for Sale in ${name}`} T={T}/>
      {ll ? <Spinner T={T}/> : (listings||[]).map((l,i)=><ListingCard key={i} listing={l} T={T}/>)}
      {!ll && (!listings||listings.length===0) && (
        <div style={{ textAlign:"center", padding:"30px 20px", color:T.muted, fontSize:13 }}>No listings data available yet.<br/>Connect to Domain API for live listings.</div>
      )}
    </div>
  );
}

/* ─── PROPERTIES ─── */
function Properties({ T }) {
  const { data:history, loading } = useApi("/api/properties/sample");
  if (loading) return <Spinner T={T}/>;
  const ph = history?.sales || [];
  const profits = ph.map((p,i) => {
    if (i===0) return { ...p, profit:null, ann:null, years:null };
    const prev = ph[i-1];
    const profit = p.price - prev.price;
    const years  = parseInt(p.date.split(" ")[1]) - parseInt(prev.date.split(" ")[1]);
    const ann    = (Math.pow(p.price/prev.price,1/Math.max(years,1))-1)*100;
    return { ...p, profit, ann, years };
  });
  const chartData = ph.map(p=>({ label:p.date.split(" ")[1], price:p.price/1000 }));
  const totalGain = ph.length > 1 ? ph[ph.length-1].price - ph[0].price : 0;
  const totalPct  = ph.length > 1 ? (totalGain/ph[0].price)*100 : 0;

  return (
    <div style={{ padding:"0 16px 100px" }}>
      <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:26, color:T.text, margin:"0 0 3px" }}>Property History</h2>
      <p style={{ fontSize:12, color:T.sub, marginBottom:18 }}>{history?.address || "Sample Property"}</p>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:16 }}>
        <Card T={T} style={{ background:T.accentBg, border:`1px solid ${T.accentBorder}` }}>
          <div style={{ fontSize:9, color:T.accent, letterSpacing:2, textTransform:"uppercase", marginBottom:3 }}>Total Gain</div>
          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:22, color:T.accent }}>+{fmtK(totalGain)}</div>
          <div style={{ fontSize:11, color:T.sub, marginTop:2 }}>{fmtK(ph[0]?.price||0)} → {fmtK(ph[ph.length-1]?.price||0)}</div>
        </Card>
        <Card T={T}>
          <div style={{ fontSize:9, color:T.muted, letterSpacing:2, textTransform:"uppercase", marginBottom:3 }}>Total Return</div>
          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:22, color:T.yellow }}>+{totalPct.toFixed(0)}%</div>
          <div style={{ fontSize:11, color:T.sub, marginTop:2 }}>Over {ph.length>1?parseInt(ph[ph.length-1].date.split(" ")[1])-parseInt(ph[0].date.split(" ")[1]):0} years</div>
        </Card>
      </div>

      {chartData.length > 0 && (
        <Card T={T} style={{ marginBottom:16 }}>
          <SLabel text="Sale Price History ($k)" T={T}/>
          <ResponsiveContainer width="100%" height={130}>
            <BarChart data={chartData} margin={{ top:4, right:4, left:-20, bottom:0 }}>
              <XAxis dataKey="label" tick={{ fill:T.muted, fontSize:11 }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fill:T.muted, fontSize:11 }} axisLine={false} tickLine={false}/>
              <Tooltip contentStyle={{ background:T.tooltipBg, border:`1px solid ${T.tooltipBorder}`, borderRadius:10, fontSize:12, color:T.text }} formatter={v=>[`$${v}k`]}/>
              <Bar dataKey="price" fill={T.blue} radius={[6,6,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      <SLabel text="Sale Timeline" T={T}/>
      <div style={{ position:"relative", paddingLeft:22 }}>
        <div style={{ position:"absolute", left:8, top:0, bottom:0, width:2, background:T.border, borderRadius:2 }}/>
        {profits.map((p,i)=>(
          <div key={i} style={{ position:"relative", marginBottom:12 }}>
            <div style={{ position:"absolute", left:-18, top:13, width:11, height:11, borderRadius:"50%", background:p.profit>0?T.accent:p.profit===null?T.muted:T.red, border:`2px solid ${T.bg}` }}/>
            <Card T={T} style={{ padding:"13px 13px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                <div>
                  <div style={{ fontSize:11, color:T.sub }}>{p.date}</div>
                  <div style={{ fontFamily:"'Playfair Display',serif", fontSize:19, color:T.text, marginTop:1 }}>{fmtK(p.price)}</div>
                </div>
                {p.profit!==null && (
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontSize:15, fontWeight:800, color:T.accent }}>+{fmtK(p.profit)}</div>
                    <div style={{ fontSize:10, color:T.sub, marginTop:1 }}>{p.ann?.toFixed(1)}% p.a. · {p.years}yr</div>
                  </div>
                )}
              </div>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── YIELD ─── */
function RentalYield({ T }) {
  const { data:suburbs, loading } = useApi("/api/suburbs?sort=yield");
  if (loading) return <Spinner T={T}/>;
  const sorted = [...(suburbs||[])].sort((a,b)=>b.gross_yield-a.gross_yield);
  const maxY   = Math.max(...sorted.map(s=>s.gross_yield));
  const best   = sorted[0];

  return (
    <div style={{ padding:"0 16px 100px" }}>
      <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:26, color:T.text, margin:"0 0 3px" }}>Rental Yield</h2>
      <p style={{ fontSize:12, color:T.sub, marginBottom:18 }}>Gross yield by suburb · Latest data</p>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:18 }}>
        <Card T={T} style={{ background:`${T.blue}18`, border:`1px solid ${T.blue}44` }}>
          <div style={{ fontSize:9, color:T.blue, letterSpacing:2, textTransform:"uppercase", marginBottom:3 }}>Best Yield</div>
          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:20, color:T.blue }}>{best?.suburb||"-"}</div>
          <div style={{ fontSize:11, color:T.sub, marginTop:2 }}>{best?.gross_yield}% gross</div>
        </Card>
        <Card T={T}>
          <div style={{ fontSize:9, color:T.muted, letterSpacing:2, textTransform:"uppercase", marginBottom:3 }}>Avg Yield</div>
          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:20, color:T.yellow }}>
            {sorted.length ? (sorted.reduce((a,s)=>a+s.gross_yield,0)/sorted.length).toFixed(1) : 0}%
          </div>
          <div style={{ fontSize:11, color:T.sub, marginTop:2 }}>Across all suburbs</div>
        </Card>
      </div>

      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {sorted.map((s,i)=>(
          <Card key={s.suburb} T={T} style={{ padding:"13px 13px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
              <div>
                <span style={{ fontSize:14, fontWeight:700, color:T.text }}>{s.suburb}</span>
                <span style={{ fontSize:11, color:T.muted, marginLeft:7 }}>#{i+1}</span>
              </div>
              <div style={{ textAlign:"right" }}>
                <span style={{ fontSize:19, fontWeight:800, color:T.blue }}>{s.gross_yield}%</span>
                <div style={{ fontSize:10, color:T.sub }}>${s.median_rent}/wk</div>
              </div>
            </div>
            <div style={{ background:T.border, borderRadius:99, height:5, overflow:"hidden", marginBottom:8 }}>
              <div style={{ width:`${(s.gross_yield/maxY)*100}%`, height:"100%", background:T.blue, borderRadius:99 }}/>
            </div>
            <div style={{ display:"flex", justifyContent:"space-between" }}>
              <span style={{ fontSize:11, color:T.sub }}>Median: {fmt(s.median_price)}</span>
              <span style={{ fontSize:11, color:T.sub }}>Annual: ${((s.median_rent*52)/1000).toFixed(0)}k</span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ─── APP SHELL ─── */
const NAV = [
  { id:"home",       label:"Home",    icon:"⌂" },
  { id:"suburbs",    label:"Suburbs", icon:"◉" },
  { id:"properties", label:"Property",icon:"⊞" },
  { id:"yield",      label:"Yield",   icon:"%" },
];

export default function App() {
  const [tab, setTab]                   = useState("home");
  const [selectedSuburb, setSelected]   = useState(null);
  const [dark, setDark]                 = useState(true);
  const T = dark ? DARK : LIGHT;

  const handleSuburb = s => { setSelected(s); setTab("suburb-detail"); };
  const handleBack   = () => { setSelected(null); setTab("suburbs"); };

  const renderPage = () => {
    if (tab==="suburb-detail" && selectedSuburb) return <SuburbDetail suburb={selectedSuburb} onBack={handleBack} T={T}/>;
    if (tab==="home")        return <Home onSuburb={handleSuburb} T={T}/>;
    if (tab==="suburbs")     return <Suburbs onSuburb={handleSuburb} T={T}/>;
    if (tab==="properties")  return <Properties T={T}/>;
    if (tab==="yield")       return <RentalYield T={T}/>;
  };

  return (
    <div style={{ fontFamily:"'DM Sans',sans-serif", background:T.bg, minHeight:"100vh", maxWidth:430, margin:"0 auto", position:"relative", color:T.text, transition:"background .3s, color .3s" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=DM+Sans:wght@400;500;600;700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        input::placeholder{color:${T.placeholder};}
        ::-webkit-scrollbar{display:none;}
        button{font-family:'DM Sans',sans-serif;}
      `}</style>

      {/* Top bar */}
      <div style={{ height:50, background:T.navBg, backdropFilter:"blur(20px)", position:"sticky", top:0, zIndex:20, display:"flex", alignItems:"center", padding:"0 16px", borderBottom:`1px solid ${T.border}` }}>
        <div style={{ flex:1 }}>
          <span style={{ fontSize:13, fontWeight:800, color:T.accent, letterSpacing:1 }}>PropIQ</span>
          <span style={{ fontSize:11, color:T.muted, marginLeft:8 }}>Melbourne</span>
        </div>
        <button onClick={()=>setDark(d=>!d)} style={{ all:"unset", cursor:"pointer", display:"flex", alignItems:"center", gap:6, background:T.tagBg, border:`1px solid ${T.border}`, borderRadius:99, padding:"5px 12px" }}>
          <span style={{ fontSize:14 }}>{dark?"🌙":"☀️"}</span>
          <span style={{ fontSize:11, color:T.sub, fontWeight:600 }}>{dark?"Night":"Day"}</span>
        </button>
      </div>

      {/* Content */}
      <div style={{ paddingTop:20, overflowY:"auto", minHeight:"calc(100vh - 50px - 72px)" }}>
        {renderPage()}
      </div>

      {/* Bottom nav */}
      <div style={{ position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)", width:"100%", maxWidth:430, background:T.navBg, backdropFilter:"blur(20px)", borderTop:`1px solid ${T.border}`, display:"grid", gridTemplateColumns:"repeat(4,1fr)", padding:"8px 0 20px", zIndex:100 }}>
        {NAV.map(n=>{
          const active = tab===n.id || (tab==="suburb-detail" && n.id==="suburbs");
          return (
            <button key={n.id} onClick={()=>{setTab(n.id);setSelected(null);}} style={{ all:"unset", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:3, padding:"5px 0" }}>
              <span style={{ fontSize:19, lineHeight:1, filter:active?"none":"grayscale(1) opacity(.35)" }}>{n.icon}</span>
              <span style={{ fontSize:10, color:active?T.accent:T.muted, fontWeight:active?700:400, letterSpacing:.5 }}>{n.label}</span>
              {active && <div style={{ width:16, height:2, background:T.accent, borderRadius:99 }}/>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
