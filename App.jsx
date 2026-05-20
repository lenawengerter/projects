import { useState, useEffect, useCallback } from "react";

// ── BMI Brand Tokens (Brand Guidelines 2023) ──────────────────────────────────
const C = {
  cyan:      "#009fdf",
  cyanLight: "#e6f6fc",
  cyanMid:   "#b3e2f5",
  white:     "#ffffff",
  grey:      "#70706f",
  greyLight: "#f4f4f4",
  greyMid:   "#d9d9d9",
  black:     "#000000",
  orange:    "#e63b11",
  aqua:      "#41b6a5",
  yellow:    "#ffc72c",
  darkBlue:  "#34384f",
  teal:      "#20778e",
};

const SENTIMENT_COLORS = { "Positiv": C.aqua, "Neutral": C.yellow, "Negativ": C.orange };
const BMI_BRANDS  = ["Braas", "Vedag", "Icopal", "Wolfin"];
const PLATFORMS   = ["Instagram", "TikTok", "Google", "Reddit", "Twitter/X", "YouTube", "Forums", "News"];
const SENTIMENTS  = ["Positiv", "Neutral", "Negativ"];
const PLATFORM_BG = {
  "Instagram": "#e1306c", "TikTok": "#010101", "Google": C.darkBlue,
  "Reddit": "#ff4500", "Twitter/X": "#1a1a2e", "YouTube": "#cc0000",
  "Forums": C.teal, "News": C.grey,
};

// ── Storage (localStorage for standalone deployment) ──────────────────────────
function loadResults() {
  try { return JSON.parse(localStorage.getItem("bmi-results") || "[]"); } catch { return []; }
}
function saveResults(d) {
  try { localStorage.setItem("bmi-results", JSON.stringify(d)); } catch {}
}
function loadMeta() {
  try { return JSON.parse(localStorage.getItem("bmi-meta") || "null") || { lastRun: null }; } catch { return { lastRun: null }; }
}
function saveMeta(m) {
  try { localStorage.setItem("bmi-meta", JSON.stringify(m)); } catch {}
}

// ── API Key storage ───────────────────────────────────────────────────────────
function loadApiKey() {
  return localStorage.getItem("bmi-anthropic-key") || "";
}
function saveApiKey(k) {
  localStorage.setItem("bmi-anthropic-key", k);
}

// ── Date range ────────────────────────────────────────────────────────────────
function getDateRange() {
  const now = new Date();
  const from = new Date(now);
  from.setMonth(from.getMonth() - 1);
  const fmt = d => d.toISOString().slice(0, 10);
  return { from: fmt(from), to: fmt(now) };
}

// ── Agent ─────────────────────────────────────────────────────────────────────
async function runAgent(brands, apiKey, onProgress) {
  const all = [];
  const { from, to } = getDateRange();
  for (let i = 0; i < brands.length; i++) {
    const brand = brands[i];
    onProgress({ brand, progress: Math.round((i / brands.length) * 85) });
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          tools: [{ type: "web_search_20250305", name: "web_search" }],
          system: `Du bist ein Social Listening Agent für BMI Group Marken (Dachziegel/Baustoffe: Braas, Vedag, Icopal, Wolfin).
Suche nach öffentlichen Posts, Kommentaren und Rezensionen aus dem Zeitraum ${from} bis ${to} (letzter Monat).
Wichtig: Nur Einträge aus diesem Zeitraum — ältere ignorieren.
Priorisiere: Reddit (r/Hausbau, r/dach, r/handwerk, r/bauen), Instagram, TikTok, Google Reviews, Twitter/X, YouTube, Fachforen.
Antworte NUR mit einem validen JSON-Array ohne Markdown:
[{"platform":"Instagram|TikTok|Google|Reddit|Twitter/X|YouTube|Forums|News","author":"name","content":"Inhalt auf Deutsch max 220 Zeichen","sentiment":"Positiv|Neutral|Negativ","url":"https://...","date":"YYYY-MM-DD","topic":"Stichwort","stars":null}]
Für Google-Rezensionen: stars (1-5). Finde 4-6 Ergebnisse, davon mind. 1-2 Reddit.`,
          messages: [{ role: "user", content: `Mentions und Rezensionen für "${brand}" (BMI Dachziegel) vom ${from} bis ${to}. Schwerpunkt: Reddit, Instagram, TikTok, Google Reviews. Nur JSON.` }]
        })
      });
      const data = await res.json();
      const text = data.content.filter(b => b.type === "text").map(b => b.text).join("");
      const clean = text.replace(/```json|```/g, "").trim();
      const s = clean.indexOf("["), e = clean.lastIndexOf("]");
      if (s !== -1 && e !== -1) {
        JSON.parse(clean.slice(s, e + 1)).forEach(item => {
          all.push({ ...item, brand, id: `${brand}-${Date.now()}-${Math.random().toString(36).slice(2,6)}`, fetchedAt: new Date().toISOString() });
        });
      }
    } catch (err) { console.warn(brand, err); }
    await new Promise(r => setTimeout(r, 350));
  }
  onProgress({ brand: null, progress: 100 });
  return all;
}

// ── UI Helpers ────────────────────────────────────────────────────────────────
function BmiLogo({ size = 40 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <rect width="100" height="100" fill={C.cyan} />
      <text x="50" y="71" textAnchor="middle" fontFamily="'Lato',sans-serif"
        fontWeight="900" fontSize="50" fill="white" letterSpacing="-1">BMI</text>
    </svg>
  );
}

function HorizonLine() {
  return (
    <svg viewBox="0 0 800 10" preserveAspectRatio="none" style={{ display:"block", width:"100%", height:10 }}>
      <polygon points="0,10 680,10 800,0 800,3 680,13 0,13" fill={C.cyan} />
    </svg>
  );
}

function Stars({ n }) {
  if (!n) return null;
  return <span style={{ color: C.yellow, fontSize: 13 }}>{"★".repeat(Math.round(n))}{"☆".repeat(5-Math.round(n))}</span>;
}

function PlatformBadge({ p }) {
  return (
    <span style={{ background: PLATFORM_BG[p]||C.grey, color:"#fff", padding:"2px 8px", fontSize:10, fontWeight:700, letterSpacing:0.5, textTransform:"uppercase" }}>
      {p}
    </span>
  );
}

function SentimentPill({ s }) {
  const c = SENTIMENT_COLORS[s] || C.grey;
  return (
    <span style={{ border:`1.5px solid ${c}`, color:c, background:`${c}18`, padding:"2px 8px", fontSize:10, fontWeight:700, letterSpacing:0.5, textTransform:"uppercase" }}>
      {s}
    </span>
  );
}

function ResultCard({ item }) {
  const sc = SENTIMENT_COLORS[item.sentiment] || C.grey;
  const [hov, setHov] = useState(false);
  return (
    <div onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)} style={{
      background:C.white, borderLeft:`4px solid ${sc}`,
      border:`1px solid ${hov?C.cyanMid:C.greyMid}`, borderLeft:`4px solid ${sc}`,
      boxShadow: hov?"0 2px 16px rgba(0,159,223,0.1)":"none",
      padding:"14px 18px", marginBottom:8, transition:"all 0.15s"
    }}>
      <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:8, flexWrap:"wrap" }}>
        <PlatformBadge p={item.platform} />
        <SentimentPill s={item.sentiment} />
        <span style={{ fontSize:10, fontWeight:800, letterSpacing:1, textTransform:"uppercase", color:C.cyan, borderBottom:`2px solid ${C.cyan}`, paddingBottom:1 }}>{item.brand}</span>
        {item.topic && <span style={{ fontSize:11, color:C.grey, fontStyle:"italic" }}>#{item.topic}</span>}
        <Stars n={item.stars} />
      </div>
      <div style={{ color:C.black, fontSize:14, lineHeight:1.65, marginBottom:8 }}>{item.content}</div>
      <div style={{ display:"flex", gap:14, fontSize:11, color:C.grey }}>
        {item.author && <span style={{ fontWeight:700 }}>@{item.author}</span>}
        <span>{item.date}</span>
        {item.url && item.url !== "https://..." &&
          <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ color:C.cyan, textDecoration:"none", fontWeight:700 }}>Link →</a>}
      </div>
    </div>
  );
}

function ProgressOverlay({ prog }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(255,255,255,0.94)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:300 }}>
      <div style={{ textAlign:"center", width:320 }}>
        <BmiLogo size={52} />
        <div style={{ fontWeight:800, fontSize:20, color:C.darkBlue, marginTop:20, marginBottom:4 }}>
          {prog.progress===100 ? "Scan abgeschlossen" : `Analysiere ${prog.brand||"…"}`}
        </div>
        <div style={{ color:C.grey, fontSize:13, marginBottom:24 }}>Social Listening Agent läuft</div>
        <div style={{ background:C.greyLight, height:4, width:"100%", marginBottom:6 }}>
          <div style={{ height:"100%", background:C.cyan, width:`${prog.progress||0}%`, transition:"width 0.4s ease" }} />
        </div>
        <div style={{ fontSize:11, color:C.grey, marginBottom:16 }}>{prog.progress||0}%</div>
        <HorizonLine />
      </div>
    </div>
  );
}

function BrandRow({ brand, count, isActive, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <div onClick={onClick} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)} style={{
      display:"flex", justifyContent:"space-between", alignItems:"center",
      padding:"7px 14px", cursor:"pointer", marginBottom:1,
      background: isActive?C.cyanLight:hov?C.greyLight:"transparent",
      borderLeft:`3px solid ${isActive?C.cyan:"transparent"}`,
      transition:"all 0.12s"
    }}>
      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
        <div style={{ width:6, height:6, background: isActive?C.cyan:C.grey }} />
        <span style={{ fontSize:13, fontWeight:700, color: isActive?C.cyan:C.darkBlue }}>{brand}</span>
      </div>
      <span style={{ fontSize:11, fontWeight:700, padding:"1px 7px", color:isActive?C.cyan:C.grey, background:isActive?`${C.cyan}20`:C.greyLight }}>{count}</span>
    </div>
  );
}

// ── API Key Setup Screen ──────────────────────────────────────────────────────
function SetupScreen({ onSave }) {
  const [key, setKey] = useState("");
  return (
    <div style={{ minHeight:"100vh", background:C.greyLight, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Lato',sans-serif" }}>
      <div style={{ background:C.white, padding:"48px 40px", width:420, borderTop:`4px solid ${C.cyan}` }}>
        <BmiLogo size={44} />
        <div style={{ fontWeight:800, fontSize:20, color:C.darkBlue, marginTop:20, marginBottom:6 }}>API-Key einrichten</div>
        <div style={{ color:C.grey, fontSize:13, lineHeight:1.6, marginBottom:28 }}>
          Gib deinen Anthropic API-Key ein, um den Social Listening Agenten zu nutzen.<br/>
          Den Key findest du unter <a href="https://console.anthropic.com" target="_blank" rel="noopener noreferrer" style={{ color:C.cyan }}>console.anthropic.com</a>.
          <br/><br/>
          Der Key wird nur lokal in deinem Browser gespeichert und nie übertragen.
        </div>
        <input
          type="password"
          placeholder="sk-ant-..."
          value={key}
          onChange={e => setKey(e.target.value)}
          style={{ width:"100%", padding:"10px 14px", border:`1px solid ${C.greyMid}`, fontSize:14, outline:"none", marginBottom:16, fontFamily:"'Lato',sans-serif", color:C.black }}
        />
        <button onClick={() => { if(key.trim()) { saveApiKey(key.trim()); onSave(key.trim()); }}}
          disabled={!key.trim()}
          style={{ width:"100%", background:key.trim()?C.cyan:C.greyMid, border:"none", padding:"11px", color:C.white, fontSize:13, fontWeight:800, cursor:key.trim()?"pointer":"not-allowed", textTransform:"uppercase", letterSpacing:1, fontFamily:"'Lato',sans-serif" }}>
          Speichern & starten
        </button>
        <HorizonLine />
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [apiKey, setApiKey]                   = useState(() => loadApiKey());
  const [results, setResults]                 = useState(() => loadResults());
  const [meta, setMeta]                       = useState(() => loadMeta());
  const [loading, setLoading]                 = useState(false);
  const [prog, setProg]                       = useState({});
  const [filterBrand, setFilterBrand]         = useState("Alle");
  const [filterSentiment, setFilterSentiment] = useState("Alle");
  const [filterPlatform, setFilterPlatform]   = useState("Alle");
  const [search, setSearch]                   = useState("");
  const [showKeyInput, setShowKeyInput]       = useState(false);

  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Lato:wght@300;400;700;900&display=swap";
    document.head.appendChild(link);
  }, []);

  const handleRun = useCallback(async () => {
    if (loading || !apiKey) return;
    setLoading(true);
    setProg({ brand: BMI_BRANDS[0], progress: 0 });
    const fresh = await runAgent(BMI_BRANDS, apiKey, setProg);
    const merged = [...fresh, ...results].slice(0, 250);
    setResults(merged);
    saveResults(merged);
    const m = { lastRun: new Date().toISOString() };
    setMeta(m); saveMeta(m);
    setLoading(false); setProg({});
  }, [loading, results, apiKey]);

  const filtered = results.filter(r =>
    (filterBrand === "Alle" || r.brand === filterBrand) &&
    (filterSentiment === "Alle" || r.sentiment === filterSentiment) &&
    (filterPlatform === "Alle" || r.platform === filterPlatform) &&
    (!search || r.content?.toLowerCase().includes(search.toLowerCase()) || r.brand?.toLowerCase().includes(search.toLowerCase()))
  );

  const brandCounts = BMI_BRANDS.map(b => ({ brand:b, count: results.filter(r=>r.brand===b).length }));
  const posC = results.filter(r=>r.sentiment==="Positiv").length;
  const neuC = results.filter(r=>r.sentiment==="Neutral").length;
  const negC = results.filter(r=>r.sentiment==="Negativ").length;
  const lastStr = meta.lastRun ? new Date(meta.lastRun).toLocaleString("de-DE") : "Noch nie";
  const nextStr = meta.lastRun ? (() => { const d=new Date(meta.lastRun); d.setDate(d.getDate()+7); return d.toLocaleDateString("de-DE"); })() : "—";

  if (!apiKey) return <SetupScreen onSave={setApiKey} />;

  return (
    <div style={{ minHeight:"100vh", background:C.greyLight, fontFamily:"'Lato',sans-serif", color:C.black }}>
      {loading && <ProgressOverlay prog={prog} />}

      {/* Header */}
      <div style={{ background:C.white, borderBottom:`1px solid ${C.greyMid}` }}>
        <div style={{ background:C.cyan, height:4 }} />
        <div style={{ padding:"0 28px", display:"flex", alignItems:"center", justifyContent:"space-between", height:60 }}>
          <div style={{ display:"flex", alignItems:"center", gap:14 }}>
            <BmiLogo size={38} />
            <div>
              <div style={{ fontWeight:900, fontSize:15, color:C.darkBlue }}>Social Listening</div>
              <div style={{ fontSize:10, color:C.grey, fontWeight:700, letterSpacing:1.5, textTransform:"uppercase" }}>Brand Monitoring Dashboard</div>
            </div>
          </div>
          <div style={{ display:"flex", gap:16, alignItems:"center" }}>
            <div style={{ textAlign:"right" }}>
              <div style={{ fontSize:10, color:C.grey, letterSpacing:1, textTransform:"uppercase" }}>Letzter Scan</div>
              <div style={{ fontSize:12, fontWeight:700, color:C.darkBlue }}>{lastStr}</div>
            </div>
            <button onClick={() => setShowKeyInput(v=>!v)} title="API-Key ändern" style={{
              background:"none", border:`1px solid ${C.greyMid}`, padding:"6px 10px",
              color:C.grey, fontSize:11, cursor:"pointer", fontFamily:"'Lato',sans-serif"
            }}>⚙ Key</button>
            <button onClick={handleRun} disabled={loading} style={{
              background: loading?C.grey:C.cyan, border:"none", padding:"9px 22px", color:C.white,
              fontSize:12, fontWeight:900, cursor:loading?"not-allowed":"pointer",
              letterSpacing:1, textTransform:"uppercase", fontFamily:"'Lato',sans-serif"
            }}>{loading?"Scanning…":"▶ Agent starten"}</button>
          </div>
        </div>
        {showKeyInput && (
          <div style={{ padding:"12px 28px", background:C.cyanLight, borderTop:`1px solid ${C.cyanMid}`, display:"flex", gap:10, alignItems:"center" }}>
            <span style={{ fontSize:12, color:C.darkBlue, fontWeight:700 }}>Anthropic API-Key:</span>
            <input type="password" defaultValue={apiKey} id="keyfield"
              style={{ flex:1, padding:"6px 10px", border:`1px solid ${C.greyMid}`, fontSize:13, fontFamily:"'Lato',sans-serif", outline:"none" }} />
            <button onClick={() => { const v=document.getElementById("keyfield").value.trim(); if(v){ saveApiKey(v); setApiKey(v); setShowKeyInput(false); }}}
              style={{ background:C.cyan, border:"none", padding:"6px 16px", color:C.white, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"'Lato',sans-serif" }}>
              Speichern
            </button>
          </div>
        )}
        <HorizonLine />
      </div>

      <div style={{ display:"flex", height:"calc(100vh - 70px)" }}>
        {/* Sidebar */}
        <div style={{ width:210, background:C.white, borderRight:`1px solid ${C.greyMid}`, display:"flex", flexDirection:"column", flexShrink:0, overflowY:"auto" }}>
          <div style={{ padding:"18px 14px", borderBottom:`1px solid ${C.greyMid}` }}>
            <div style={{ fontSize:9, fontWeight:700, color:C.grey, letterSpacing:2, textTransform:"uppercase", marginBottom:8 }}>Gesamt</div>
            <div style={{ fontSize:48, fontWeight:900, color:C.cyan, lineHeight:1 }}>{results.length}</div>
            <div style={{ fontSize:11, color:C.grey, marginBottom:12 }}>Mentions</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:4 }}>
              {[["Pos",posC,C.aqua],["Neu",neuC,C.yellow],["Neg",negC,C.orange]].map(([l,v,c])=>(
                <div key={l} style={{ textAlign:"center", padding:"6px 2px", borderTop:`3px solid ${c}`, background:`${c}12` }}>
                  <div style={{ fontSize:20, fontWeight:900, color:c }}>{v}</div>
                  <div style={{ fontSize:9, fontWeight:700, color:C.grey, letterSpacing:1 }}>{l}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ paddingTop:12 }}>
            <div style={{ fontSize:9, fontWeight:700, color:C.grey, letterSpacing:2, textTransform:"uppercase", padding:"0 14px 6px" }}>Marken</div>
            {brandCounts.map(({brand,count})=>(
              <BrandRow key={brand} brand={brand} count={count} isActive={filterBrand===brand}
                onClick={()=>setFilterBrand(filterBrand===brand?"Alle":brand)} />
            ))}
          </div>
          <div style={{ marginTop:"auto", padding:"12px 14px", borderTop:`1px solid ${C.greyMid}`, background:C.cyanLight }}>
            <div style={{ fontSize:9, fontWeight:700, color:C.cyan, letterSpacing:2, textTransform:"uppercase" }}>Nächster Scan</div>
            <div style={{ fontSize:15, fontWeight:900, color:C.darkBlue, marginTop:2 }}>{nextStr}</div>
            <div style={{ fontSize:10, color:C.grey }}>Wöchentlicher Rhythmus</div>
          </div>
        </div>

        {/* Main */}
        <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
          <div style={{ background:C.white, borderBottom:`1px solid ${C.greyMid}`, padding:"10px 20px", display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
            <input placeholder="Suchen…" value={search} onChange={e=>setSearch(e.target.value)} style={{
              background:C.greyLight, border:`1px solid ${C.greyMid}`, padding:"6px 12px",
              fontSize:13, outline:"none", width:170, fontFamily:"'Lato',sans-serif", color:C.black
            }} />
            {[["Sentiment",SENTIMENTS,filterSentiment,setFilterSentiment],["Plattform",PLATFORMS,filterPlatform,setFilterPlatform]].map(([label,opts,val,setter])=>(
              <select key={label} value={val} onChange={e=>setter(e.target.value)} style={{
                background:C.white, border:`1px solid ${C.greyMid}`, padding:"6px 10px",
                fontSize:12, outline:"none", cursor:"pointer", fontFamily:"'Lato',sans-serif", fontWeight:700, color:C.darkBlue
              }}>
                <option value="Alle">Alle {label}</option>
                {opts.map(o=><option key={o} value={o}>{o}</option>)}
              </select>
            ))}
            {(filterBrand!=="Alle"||filterSentiment!=="Alle"||filterPlatform!=="Alle"||search) && (
              <button onClick={()=>{setFilterBrand("Alle");setFilterSentiment("Alle");setFilterPlatform("Alle");setSearch("");}}
                style={{ background:"none", border:`1px solid ${C.greyMid}`, padding:"6px 10px", color:C.grey, fontSize:11, cursor:"pointer", fontFamily:"'Lato',sans-serif" }}>
                ✕ Zurücksetzen
              </button>
            )}
            <span style={{ fontSize:11, color:C.grey, background:C.cyanLight, border:`1px solid ${C.cyanMid}`, padding:"4px 10px", fontWeight:700 }}>
              📅 Letzter Monat
            </span>
            <span style={{ fontSize:12, color:C.grey, marginLeft:"auto", fontWeight:700 }}>{filtered.length} Ergebnisse</span>
          </div>

          <div style={{ flex:1, overflowY:"auto", padding:"16px 20px" }}>
            {results.length===0 && !loading && (
              <div style={{ textAlign:"center", padding:"70px 0" }}>
                <BmiLogo size={60} />
                <div style={{ fontWeight:900, fontSize:22, color:C.darkBlue, marginTop:20, marginBottom:8 }}>Noch keine Daten</div>
                <div style={{ color:C.grey, fontSize:14, marginBottom:24 }}>Starte den Agenten, um BMI Marken zu überwachen.</div>
                <button onClick={handleRun} style={{ background:C.cyan, border:"none", padding:"11px 30px", color:C.white, fontSize:13, fontWeight:900, cursor:"pointer", textTransform:"uppercase", letterSpacing:1, fontFamily:"'Lato',sans-serif" }}>
                  ▶ Jetzt starten
                </button>
                <div style={{ marginTop:28, maxWidth:280, margin:"28px auto 0" }}><HorizonLine /></div>
              </div>
            )}
            {filtered.length===0 && results.length>0 && (
              <div style={{ textAlign:"center", padding:"60px 0", color:C.grey, fontSize:14 }}>Keine Ergebnisse für die aktuellen Filter.</div>
            )}
            {filtered.map(item=><ResultCard key={item.id} item={item} />)}
          </div>
        </div>

        {/* Right Panel */}
        <div style={{ width:190, background:C.white, borderLeft:`1px solid ${C.greyMid}`, padding:"18px 14px", flexShrink:0, overflowY:"auto" }}>
          <div style={{ fontSize:9, fontWeight:700, color:C.grey, letterSpacing:2, textTransform:"uppercase", marginBottom:14 }}>Sentiment</div>
          {SENTIMENTS.map(s=>{
            const cnt=results.filter(r=>r.sentiment===s).length;
            const pct=results.length?Math.round((cnt/results.length)*100):0;
            const c=SENTIMENT_COLORS[s];
            return (
              <div key={s} style={{ marginBottom:14 }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                  <span style={{ fontSize:12, fontWeight:700, color:C.darkBlue }}>{s}</span>
                  <span style={{ fontSize:12, fontWeight:900, color:c }}>{pct}%</span>
                </div>
                <div style={{ background:C.greyLight, height:3 }}>
                  <div style={{ height:"100%", background:c, width:`${pct}%`, transition:"width 0.6s ease" }} />
                </div>
              </div>
            );
          })}

          <div style={{ marginTop:20, borderTop:`1px solid ${C.greyMid}`, paddingTop:14 }}>
            <div style={{ fontSize:9, fontWeight:700, color:C.grey, letterSpacing:2, textTransform:"uppercase", marginBottom:10 }}>Quellen</div>
            {PLATFORMS.map(p=>{
              const cnt=results.filter(r=>r.platform===p).length;
              const isAct=filterPlatform===p;
              return (
                <div key={p} onClick={()=>setFilterPlatform(isAct?"Alle":p)} style={{
                  display:"flex", justifyContent:"space-between", padding:"4px 6px", marginBottom:4, cursor:"pointer",
                  background:isAct?C.cyanLight:"transparent",
                  borderLeft:`2px solid ${isAct?C.cyan:"transparent"}`, transition:"all 0.12s"
                }}>
                  <span style={{ fontSize:12, color:isAct?C.cyan:C.grey, fontWeight:isAct?700:400 }}>{p}</span>
                  <span style={{ fontSize:11, fontWeight:700, color:isAct?C.cyan:C.grey }}>{cnt}</span>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop:20, borderTop:`1px solid ${C.greyMid}`, paddingTop:14 }}>
            <div style={{ fontSize:9, fontWeight:700, color:C.grey, letterSpacing:2, textTransform:"uppercase", marginBottom:10 }}>API-Status</div>
            {[["Anthropic",true],["Instagram",false],["TikTok",false],["Google",false]].map(([name,on])=>(
              <div key={name} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                <span style={{ fontSize:12, fontWeight:700, color:C.darkBlue }}>{name}</span>
                <span style={{ fontSize:9, fontWeight:700, padding:"2px 6px", color:on?C.aqua:C.orange, background:on?`${C.aqua}15`:`${C.orange}12`, border:`1px solid ${on?C.aqua:C.orange}`, letterSpacing:0.5 }}>
                  {on?"AKTIV":"SETUP"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
