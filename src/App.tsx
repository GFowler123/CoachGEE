import React, { useState, useEffect, useCallback } from 'react'

// ─── SUPABASE CONFIG ──────────────────────────────────────────────────────────
const SUPABASE_URL      = 'https://yrrtcnpsofirlkszrwbq.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlycnRjbnBzb2Zpcmxrc3pyd2JxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzMzE4OTAsImV4cCI6MjA5NDkwNzg5MH0.BOqJYEP231yFdiBdQu4_jRvSeTvY_E1uFTyntfoZCFE'

// ─── SUPABASE REST HELPERS ────────────────────────────────────────────────────
const hdrs = (token) => ({
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${token || SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
})

const stripNaN = (obj) =>
  JSON.parse(JSON.stringify(obj, (_, v) =>
    typeof v === 'number' && isNaN(v) ? undefined : v))

const sb = {
  get: async (table, q = '', token) => {
    const order = ['clients','programs','sessions'].includes(table) ? '&order=created_at.asc' : ''
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${q}${order}`, { headers: hdrs(token) })
    if (!r.ok) throw new Error(await r.text())
    return r.json()
  },
  post: async (table, body, token) => {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: 'POST', headers: hdrs(token), body: JSON.stringify(stripNaN(body)),
    })
    if (!r.ok) throw new Error(await r.text())
    const d = await r.json(); return Array.isArray(d) ? d[0] : d
  },
  patch: async (table, id, body, token) => {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
      method: 'PATCH', headers: hdrs(token), body: JSON.stringify(stripNaN(body)),
    })
    if (!r.ok) throw new Error(await r.text())
    const d = await r.json(); return Array.isArray(d) ? d[0] : d
  },
  del: async (table, id, token) => {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
      method: 'DELETE', headers: hdrs(token),
    })
    return r.ok
  },
  signIn: async (email, pw) => {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: pw }),
    })
    return r.json()
  },
  signUp: async (email, pw) => {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: pw }),
    })
    return r.json()
  },
  signOut: async (token) =>
    fetch(`${SUPABASE_URL}/auth/v1/logout`, { method: 'POST', headers: hdrs(token) }),
}

// ─── APP SETTINGS CACHE (read from localStorage at module load) ─────────────
const _SC = (() => { try { return JSON.parse(localStorage.getItem('cgee_settings') || '{}') } catch { return {} } })()
const _densityPad = { compact:'8px 12px', standard:'14px 16px', spacious:'22px 24px' }

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────
// Three surface levels create depth without heavy borders.
// Slight blue undertone (cool, premium) instead of pure neutral black.
const C = {
  bg:'#040814', ink:'#080D1C', card:'#0F1525', lift:'#1A2236',
  white:'#FFFFFF', c1:'#2563EB', c2:'#3B82F6', c3:'#93C5FD',
  amber:_SC.accentColor||'#FFA500', gold:'#FACC15', red:'#EF4444', orange:'#F97316',
  green:'#22C55E', purple:'#8B5CF6',
  muted:'rgba(255,255,255,0.55)', dim:'rgba(255,255,255,0.30)',
  faint:'rgba(255,255,255,0.14)', border:'rgba(255,255,255,0.05)',
  surface:'rgba(255,255,255,0.04)',
}
const uid = () => crypto.randomUUID()

// ─── GROUPS: single source of truth helpers ─────────────────────────────────
const getGroups = (clients) => [...new Set((clients||[]).filter(c=>c.group_label).map(c=>c.group_label))].sort()
function GroupFilter({ clients, value, onChange, style }){
  const groups = getGroups(clients)
  if(groups.length===0) return null
  const pill = (active) => ({ background: active?C.amber:'transparent', color: active?C.bg:C.muted, border:`1px solid ${active?C.amber:C.border}`, borderRadius:20, padding:'4px 11px', fontSize:11, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' })
  return (
    <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center',marginBottom:14,...style}}>
      <span style={{fontSize:9,color:C.faint,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em',marginRight:2}}>Group</span>
      <button onClick={()=>onChange('')} style={pill(!value)}>All</button>
      {groups.map(g=><button key={g} onClick={()=>onChange(value===g?'':g)} style={pill(value===g)}>{g}</button>)}
    </div>
  )
}

const PHASES     = ['Acclimatisation','Accumulation','Intensification','Realisation','Deload','General Prep','Return to Train']
const SESS_TYPES = ['Strength','Power','Hypertrophy','Conditioning','Mixed','Rehab','Recovery','Upper','Lower','Full Body']
const BLK        = ['A1','A2','A3','B1','B2','B3','C1','C2','D1','D2','Warm-up','Conditioning','Finisher','Rehab']
const PATTERNS   = ['Squat','Hinge','Lunge','Push','Pull','Carry','Jump','Core','Sprint','Conditioning','Rehab']
const QUALITIES  = ['Strength','Hypertrophy','Power','Speed','Conditioning','Stability','Prehab','Mobility']
const PC = { Squat:C.c1, Hinge:C.c2, Lunge:C.c3, Push:C.amber, Pull:C.orange, Core:C.green, Carry:C.muted, Jump:C.gold }

// ─── UI ATOMS (all at module level — never define components inside components) ─
const iS = { background:C.ink, border:`1px solid ${C.border}`, borderRadius:8, padding:'8px 11px', color:C.white, fontSize:13, width:'100%', boxSizing:'border-box', outline:'none' }
const lS = { fontSize:10, color:C.muted, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:4 }

const Tag = ({ v, color=C.amber, small }) =>
  v ? <span style={{ display:'inline-block', padding:small?'1px 6px':'2px 9px', borderRadius:20, fontSize:small?9:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.04em', color, background:`${color}20`, border:`1px solid ${color}30`, whiteSpace:'nowrap' }}>{v}</span> : null

const Spin = () =>
  <div style={{ width:16, height:16, borderRadius:'50%', border:`2px solid ${C.amber}`, borderTopColor:'transparent', animation:'spin 0.7s linear infinite', display:'inline-block', flexShrink:0 }} />


// ─── ICON SYSTEM (minimal inline SVGs, single source of truth) ───────────────
const ICONS = {
  dashboard:   <><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></>,
  trophy:      <><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></>,
  users:       <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>,
  user:        <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>,
  fileText:    <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></>,
  dumbbell:    <><line x1="2" y1="12" x2="22" y2="12"/><rect x="3" y="8" width="3" height="8" rx="1"/><rect x="18" y="8" width="3" height="8" rx="1"/></>,
  layers:      <><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></>,
  calendar:    <><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>,
  megaphone:   <><path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></>,
  message:     <><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></>,
  grid:        <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></>,
  settings:    <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></>,
  clock:       <><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></>,
  repeat:      <><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></>,
  trendingDown:<><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></>,
  trendingUp:  <><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></>,
  play:        <><path d="M7 4v16l13-8z"/></>,
  check:       <><polyline points="20 6 9 17 4 12"/></>,
  circle:      <><circle cx="12" cy="12" r="9"/></>,
  alert:       <><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>,
  palette:     <><circle cx="13.5" cy="6.5" r=".6" fill="currentColor" stroke="none"/><circle cx="17.5" cy="10.5" r=".6" fill="currentColor" stroke="none"/><circle cx="8.5" cy="7.5" r=".6" fill="currentColor" stroke="none"/><circle cx="6.5" cy="12.5" r=".6" fill="currentColor" stroke="none"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.9 0 1.65-.75 1.65-1.69 0-.44-.18-.83-.44-1.12-.29-.29-.44-.65-.44-1.13a1.64 1.64 0 0 1 1.67-1.67h1.99c3.05 0 5.56-2.5 5.56-5.55C21.97 6.01 17.46 2 12 2z"/></>,
  bell:        <><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></>,
  sliders:     <><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></>,
  wrench:      <><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></>,
  watch:       <><circle cx="12" cy="12" r="6"/><polyline points="12 9 12 12 13.5 13.5"/><path d="M16.51 17.35l-.35 3.83a2 2 0 0 1-2 1.82H9.83a2 2 0 0 1-2-1.82l-.35-3.83m.01-10.7l.35-3.83A2 2 0 0 1 9.83 1h4.35a2 2 0 0 1 2 1.82l.35 3.83"/></>,
  activity:    <><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></>,
  link:        <><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></>,
  pin:         <><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/></>,
  rocket:      <><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></>,
}
const Icon = ({ name, size=16, color='currentColor', strokeWidth=2, fill='none', style }) => {
  const path = ICONS[name]
  if(!path) return null
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0, display:'block', ...style}}>{path}</svg>)
}

const Btn = ({ label, onClick, variant='primary', small, disabled, full, loading, style }) => {
  const m = { primary:{bg:C.amber,c:C.bg,bd:'none'}, secondary:{bg:'transparent',c:C.white,bd:`1px solid ${C.border}`}, danger:{bg:'transparent',c:C.red,bd:`1px solid ${C.red}50`}, ghost:{bg:'transparent',c:C.muted,bd:'none'}, success:{bg:C.green,c:C.white,bd:'none'} }[variant] || {}
  return (
    <button onClick={onClick} disabled={disabled||loading}
      style={{ background:m.bg, color:m.c, border:m.bd, borderRadius:8, padding:small?'5px 12px':'8px 18px', fontSize:small?11:13, fontWeight:700, cursor:disabled||loading?'not-allowed':'pointer', opacity:disabled?0.4:1, width:full?'100%':undefined, display:'inline-flex', alignItems:'center', gap:6, flexShrink:0, ...style }}>
      {loading && <Spin/>}{label}
    </button>
  )
}

const Card     = ({ children, style, onClick }) => <div onClick={onClick} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:_densityPad[_SC.density]||'14px 16px', cursor:onClick?'pointer':'default', ...style }}>{children}</div>
const Panel    = ({ children, style }) => <div style={{ background:`${C.c1}0d`, border:`1px solid ${C.c1}35`, borderRadius:12, padding:16, ...style }}>{children}</div>
const OkPanel  = ({ children, style }) => <div style={{ background:`${C.green}0d`, border:`1px solid ${C.green}35`, borderRadius:12, padding:16, ...style }}>{children}</div>
const Row      = ({ children, style }) => <div style={{ display:'flex', alignItems:'flex-start', gap:8, ...style }}>{children}</div>
const G2       = ({ children, style }) => <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, ...style }}>{children}</div>
const G3       = ({ children, style }) => <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, ...style }}>{children}</div>
const G4       = ({ children, style }) => <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, ...style }}>{children}</div>
const HR       = ({ style }) => <div style={{ height:1, background:C.border, margin:'12px 0', ...style }} />
const SL       = ({ children, right, small }) => (
  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
    <span style={{ fontSize:small?9:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.14em', color:C.amber }}>{children}</span>
    {right}
  </div>
)

const TI = ({ label, value, onChange, placeholder, type='text', style }) => (
  <div style={{ display:'flex', flexDirection:'column', gap:4, ...style }}>
    {label && <label style={lS}>{label}</label>}
    <input type={type} value={value||''} placeholder={placeholder} onChange={e => onChange(e.target.value)} style={iS} />
  </div>
)
const SI = ({ label, value, onChange, options, style }) => (
  <div style={{ display:'flex', flexDirection:'column', gap:4, ...style }}>
    {label && <label style={lS}>{label}</label>}
    <select value={value||''} onChange={e => onChange(e.target.value)} style={{ ...iS, cursor:'pointer' }}>
      {options.map(o => <option key={o.v??o} value={o.v??o}>{o.l??o}</option>)}
    </select>
  </div>
)
const TA = ({ label, value, onChange, placeholder, rows=3 }) => (
  <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
    {label && <label style={lS}>{label}</label>}
    <textarea value={value||''} placeholder={placeholder} onChange={e => onChange(e.target.value)} rows={rows} style={{ ...iS, resize:'vertical' }}></textarea>
  </div>
)

const ErrBox = ({ msg }) => msg
  ? <div style={{ background:`${C.red}18`, border:`1px solid ${C.red}45`, borderRadius:8, padding:'10px 14px', fontSize:13, color:C.red, marginBottom:12 }}>{msg}</div>
  : null

const Breadcrumb = ({ items }) => (
  <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:18, flexWrap:'wrap' }}>
    {items.map((item, i) => (
      <span key={i} style={{ display:'flex', alignItems:'center', gap:6 }}>
        {i > 0 && <span style={{ color:C.faint, fontSize:12 }}>›</span>}
        {item.onClick
          ? <button onClick={item.onClick} style={{ background:'none', border:'none', color:C.amber, cursor:'pointer', fontSize:13, padding:0, fontWeight:500 }}>{item.label}</button>
          : <span style={{ color:C.muted, fontSize:13 }}>{item.label}</span>
        }
      </span>
    ))}
  </div>
)

// Smooth ombre traffic light: 0% = red → 50% = amber → 100% = green
const trafficColor = (pct) => {
  const p = Math.max(0, Math.min(100, pct||0))
  const lerp = (a,b,t) => Math.round(a+(b-a)*t)
  if(p <= 50){ const t=p/50; return `rgb(${lerp(239,255,t)},${lerp(68,165,t)},${lerp(68,0,t)})` }
  const t=(p-50)/50; return `rgb(${lerp(255,34,t)},${lerp(165,197,t)},${lerp(0,94,t)})`
}
const ProgressBar = ({ value, color }) => {
  const bc = color !== undefined ? color : trafficColor(value)
  return(
    <div style={{height:5,background:C.surface,borderRadius:3,overflow:'hidden',marginTop:5}}>
      <div style={{height:'100%',width:`${Math.min(100,value||0)}%`,background:bc,borderRadius:3,transition:'width 0.5s'}}/>
    </div>
  )
}

// Error boundary
class ErrorBoundary extends React.Component {
  constructor(p){ super(p); this.state = { err:null } }
  static getDerivedStateFromError(e){ return { err:e } }
  render(){
    if(this.state.err) return (
      <div style={{ padding:30 }}>
        <div style={{ background:`${C.red}18`, border:`1px solid ${C.red}45`, borderRadius:12, padding:24 }}>
          <div style={{ color:C.red, fontWeight:700, fontSize:15, marginBottom:10 }}>Something went wrong:</div>
          <pre style={{ color:'#FCA5A5', fontSize:12, whiteSpace:'pre-wrap', wordBreak:'break-all' }}>{this.state.err.message}</pre>
          <button onClick={() => this.setState({err:null})} style={{ marginTop:14, background:C.red, color:C.white, border:'none', borderRadius:8, padding:'7px 16px', fontWeight:700, cursor:'pointer' }}>Dismiss</button>
        </div>
      </div>
    )
    return this.props.children
  }
}

// ─── CSV PARSER ───────────────────────────────────────────────────────────────
function parseLine(line, sep){ if(sep==='\t') return line.split('\t').map(v=>v.trim().replace(/^"|"$/g,'')); const out=[];let cur='',q=false; for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){if(q&&line[i+1]==='"'){cur+='"';i++;}else q=!q;}else if(c===','&&!q){out.push(cur.trim());cur='';}else cur+=c;} out.push(cur.trim()); return out; }
function normH(h){ return h.trim().replace(/^\uFEFF/,'').replace(/['"]/g,'').toLowerCase().replace(/[\s\-\/\(\)\.]+/g,'_').replace(/_+/g,'_').replace(/^_|_$/g,'') }
function fc(hdrs,...pats){ for(const p of pats){const i=hdrs.findIndex(h=>h.includes(p));if(i>=0)return i;} return -1; }

function parseCSV(text){
  const lines = text.replace(/^\uFEFF/,'').replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n').filter(l=>l.trim())
  if(lines.length < 2) return { error:'File appears empty.' }
  const sep = lines[0].includes('\t') ? '\t' : ','
  const hdrs = parseLine(lines[0],sep).map(normH)
  const cx = {
    client:fc(hdrs,'client_name','client'), program:fc(hdrs,'program_name','program'),
    week:fc(hdrs,'week_number','week_num','week'), phase:fc(hdrs,'phase'),
    session:fc(hdrs,'session_name','session'), block:fc(hdrs,'block_label','block'),
    seqGrp:fc(hdrs,'sequence_group'), seqOrd:fc(hdrs,'sequence_order'), seqType:fc(hdrs,'sequence_type'),
    exRaw:fc(hdrs,'exercise_name_raw','exercise_raw'),
    exCanon:fc(hdrs,'exercise_name_canonical','canonical','exercise_name','exercise'),
    warmup:fc(hdrs,'is_warmup','warmup'), setCount:fc(hdrs,'set_count','sets'),
    t1:fc(hdrs,'set_1_target','set1_target'), t2:fc(hdrs,'set_2_target','set2_target'),
    t3:fc(hdrs,'set_3_target','set3_target'), t4:fc(hdrs,'set_4_target','set4_target'),
    l1:fc(hdrs,'set_1_load_raw','set_1_load'), l2:fc(hdrs,'set_2_load_raw','set_2_load'),
    l3:fc(hdrs,'set_3_load_raw','set_3_load'), l4:fc(hdrs,'set_4_load_raw','set_4_load'),
    tempo:fc(hdrs,'tempo'), notes:fc(hdrs,'notes'),
  }
  const missing = ['week_number','session_name'].filter((_,i)=>[cx.week,cx.session][i]<0)
  if(cx.exCanon<0 && cx.exRaw<0) missing.push('exercise_name')
  if(missing.length) return { error:`Missing columns: ${missing.join(', ')}\nFound: ${hdrs.slice(0,12).join(', ')}` }
  const g = (row,i) => i>=0 ? (row[i]||'').trim() : ''
  const rows = lines.slice(1).map(l=>parseLine(l,sep)).filter(row=>g(row,cx.exCanon)||g(row,cx.exRaw))
  if(!rows.length) return { error:'No exercise rows found.' }
  const clientMap={}, programMap={}, weekMap={}, sessionMap={}
  let detProg='', detClient=''
  for(const row of rows){
    const weekNum   = parseInt(g(row,cx.week))||1
    const phase     = g(row,cx.phase)
    const sessName  = g(row,cx.session)||'Session'
    const progName  = g(row,cx.program)||'Imported Program'
    const clientName= g(row,cx.client)||'Unknown Client'
    if(!detProg) detProg=progName; if(!detClient) detClient=clientName
    if(!clientMap[clientName]) clientMap[clientName]={id:uid(),name:clientName}
    const clientId = clientMap[clientName].id
    const pKey = `${clientName}::${progName}`
    if(!programMap[pKey]) programMap[pKey]={id:uid(),client_id:clientId,name:progName,status:'complete',goal:'',phase:'',notes:''}
    const programId = programMap[pKey].id
    const wKey = `${pKey}::W${weekNum}`
    if(!weekMap[wKey]) weekMap[wKey]={id:uid(),program_id:programId,week_number:weekNum,phase:phase||`Week ${weekNum}`,notes:'',sort_order:weekNum}
    const weekId = weekMap[wKey].id
    const sKey = `${wKey}::${sessName}`
    if(!sessionMap[sKey]) sessionMap[sKey]={id:uid(),week_id:weekId,program_id:programId,client_id:clientId,name:sessName,session_type:'Strength',date_label:'',notes:'',status:'complete',exercises:[]}
    const sess = sessionMap[sKey]
    const rawName = g(row,cx.exCanon)||g(row,cx.exRaw); if(!rawName) continue
    const name = resolveExName(rawName) // Apply canonical registry on import
    const targets   = [g(row,cx.t1),g(row,cx.t2),g(row,cx.t3),g(row,cx.t4)]
    const rawLoads  = [g(row,cx.l1),g(row,cx.l2),g(row,cx.l3),g(row,cx.l4)]
    // Parse each set according to load rules:
    //   empty cell   → skipped / not performed
    //   * - 0 bw     → completed, no added weight
    //   any value    → completed with that load (preserve raw)
    const NO_WEIGHT = new Set(['*','-','0','bw','bodyweight','b/w'])
    const loggedSets = targets.map((target,i)=>{
      const t    = (target||'').trim()
      const load = (rawLoads[i]||'').trim()
      if(!t && !load) return null   // set position not prescribed — skip entirely
      const isSkipped  = !load
      const isNoWeight = NO_WEIGHT.has(load.toLowerCase())
      return {
        id:uid(), setNumber:i+1,
        targetReps:    t,
        completedLoad: isSkipped||isNoWeight ? '' : load,
        completedReps: isSkipped ? '' : t,
        rpe:   '',
        notes: isNoWeight ? 'No added weight' : '',
        skipped: isSkipped,
      }
    }).filter(Boolean)
    const isWarmup = ['true','1','yes'].includes((g(row,cx.warmup)||'').toLowerCase())
    sess.exercises.push({id:uid(),name,blockLabel:g(row,cx.block),sequenceGroup:g(row,cx.seqGrp),sequenceType:g(row,cx.seqType)||'single',sequenceOrder:parseInt(g(row,cx.seqOrd))||0,isWarmup,sets:g(row,cx.setCount)||String(targets.filter(v=>v).length||3),reps:targets.filter(v=>v).join(' / '),load:'',rpe:'',tempo:g(row,cx.tempo),rest:'',notes:g(row,cx.notes),collect:isWarmup?['reps']:['reps','load'],sectionName:'',time:'',distance:'',rir:'',loggedSets})
  }
  return { clients:Object.values(clientMap), programs:Object.values(programMap), weeks:Object.values(weekMap), sessions:Object.values(sessionMap), detectedProgram:detProg, detectedClient:detClient }
}

// ─── SAFE SESSION HELPER ──────────────────────────────────────────────────────
const safeExercises = (sess) => {
  if(!sess) return []
  const e = sess.exercises
  if(Array.isArray(e)) return e
  if(typeof e === 'string'){ try{ return JSON.parse(e)||[] }catch{ return [] } }
  return []
}

// ─── SESSION STATUS HELPERS ──────────────────────────────────────────────────
// Derives status from actual logged data — no manual toggle needed
// Exercises in R/R1/R2/R3 resilience blocks, or with no prescribed load,
// count as done without requiring weight entry


const setIsDone = ls => ls && (ls.skipped || !!(ls.completedLoad || ls.completedReps || ls.rpe || ls.notes))

function computeSessionStatus(sess) {
  // Manual overrides take priority over computed status
  if(sess?.status === 'skipped')           return 'skipped'
  if(sess?.status === 'manual_complete')   return 'complete'
  if(sess?.status === 'manual_incomplete') return 'not_started'
  const exs = safeExercises(sess).filter(e => !e.isWarmup)
  if(!exs.length) return sess?.status || 'not_started'
  let totalPrescribed = 0, totalDone = 0
  for(const ex of exs){
    const prescribed = parseInt(ex.sets) || 1
    // force_complete on an exercise counts all its sets as done
    const done = ex.force_complete
      ? prescribed
      : (ex.loggedSets||[]).filter(setIsDone).length
    totalPrescribed += prescribed
    totalDone       += done
  }
  if(totalDone === 0)              return 'not_started'
  if(totalDone >= totalPrescribed) return 'complete'
  return 'in_progress'
}

const STATUS = {
  not_started: { label:'Future',      color:'rgba(255,255,255,0.25)' },
  in_progress: { label:'In Progress', color:'#F97316' },
  complete:    { label:'Complete',    color:'#22C55E' },
  skipped:     { label:'Skipped',     color:'#64748B' },
}
function getSessionPct(sess) {
  const exs = safeExercises(sess).filter(e=>!e.isWarmup)
  const prescribed = exs.reduce((a,e)=>a+(parseInt(e.sets)||1),0)
  const done = exs.reduce((a,e)=>{
    const noLoad=!e.load||e.load===''
    return a+(e.force_complete?(parseInt(e.sets)||1):(e.loggedSets||[]).filter(setIsDone).length)
  },0)
  return prescribed>0?Math.round(done/prescribed*100):0
}
function StatusBadge({ sess, small }) {
  const key = computeSessionStatus(sess)
  if(key==='in_progress'){
    const pct=getSessionPct(sess)
    return <Tag v={`${pct}% done`} color={STATUS.in_progress.color} small={small}/>
  }
  const { label, color } = STATUS[key] || STATUS.not_started
  return <Tag v={label} color={color} small={small}/>
}
function StatusDot({ sess }) {
  const key = computeSessionStatus(sess)
  const { color } = STATUS[key] || STATUS.not_started
  return <span style={{display:'inline-block',width:8,height:8,borderRadius:'50%',background:color,flexShrink:0}}/>
}

// ─── CALENDAR DATE HELPER ────────────────────────────────────────────────────
// Assigns each session a date: programStart + (weekNum-1)*7 + sessionIndexInWeek
// Sessions within a week are placed on consecutive days from the week start
function getSessionDate(sess, allSessions, weeks, programs) {
  const prog = programs.find(p => p.id === sess.program_id)
  if(!prog?.start_date) return null
  const week = weeks.find(w => w.id === sess.week_id)
  if(!week) return null
  const weekSessions = allSessions
    .filter(s => s.week_id === week.id)
    .sort((a,b) => (a.sort_order||0) - (b.sort_order||0))
  const idx = weekSessions.findIndex(s => s.id === sess.id)
  if(idx < 0) return null
  const base = new Date(prog.start_date + 'T00:00:00')
  const d = new Date(base)
  d.setDate(d.getDate() + (week.week_number - 1) * 7 + idx)
  return d
}
function toDateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

// ─── GROUP COLOURS ────────────────────────────────────────────────────────────
const GC = { A:C.amber, B:'#3B82F6', C:'#22C55E', D:'#A855F7', E:'#EC4899', F:'#06B6D4', R:'#14B8A6', G:'#14B8A6' }
function groupColor(blockLabel) {
  const l = (blockLabel||'').replace(/\d+/g,'').toUpperCase()
  return GC[l] || C.muted
}
const fmtRep = (v) => { const s=String(v==null?'':v).trim(); const m=/^(\d+)\.0+$/.exec(s); return m?m[1]:s }
const collapseReps = (v) => {
  const parts = String(v==null?'':v).split(/[\/,]/).map(x=>fmtRep(x)).filter(x=>x!=='')
  if(!parts.length) return ''
  const uniq=[...new Set(parts)]
  return uniq.length===1 ? uniq[0] : parts.join('/')
}
function getPrescription(ex) {
  const p = []
  if(ex.sets&&ex.reps) p.push(`${ex.sets}×${collapseReps(ex.reps)}`)
  else if(ex.sets) p.push(`${ex.sets} sets`)
  else if(ex.reps) p.push(collapseReps(ex.reps))
  if(ex.load)  p.push(`@ ${ex.load}`)
  if(ex.rpe)   p.push(`RPE ${ex.rpe}`)
  if(ex.tempo) p.push(ex.tempo)
  if(ex.rest)  p.push(ex.rest)
  return p.join('  ')
}

// ─── DEFAULT EXERCISE LIBRARY ─────────────────────────────────────────────────
const DEFAULT_LIB = [
  {id:'l1',name:'Back Squat',pattern:'Squat',quality:'Strength',equip:'Barbell',limb:'Bilateral',muscles:'Quads, Glutes'},
  {id:'l2',name:'Trap Bar Deadlift',pattern:'Hinge',quality:'Strength',equip:'Trap bar',limb:'Bilateral',muscles:'Glutes, Hamstrings'},
  {id:'l3',name:'Romanian Deadlift',pattern:'Hinge',quality:'Strength',equip:'Barbell',limb:'Bilateral',muscles:'Hamstrings, Glutes'},
  {id:'l4',name:'RFESS',pattern:'Lunge',quality:'Strength',equip:'Dumbbell',limb:'Unilateral',muscles:'Quads, Glutes'},
  {id:'l5',name:'Bench Press',pattern:'Push',quality:'Strength',equip:'Barbell',limb:'Bilateral',muscles:'Chest, Triceps'},
  {id:'l6',name:'DB Row',pattern:'Pull',quality:'Strength',equip:'Dumbbell',limb:'Unilateral',muscles:'Lats, Biceps'},
  {id:'l7',name:'Chin-Up',pattern:'Pull',quality:'Strength',equip:'Bodyweight',limb:'Bilateral',muscles:'Lats, Biceps'},
  {id:'l8',name:'Hip Thrust',pattern:'Hinge',quality:'Hypertrophy',equip:'Barbell',limb:'Bilateral',muscles:'Glutes'},
  {id:'l9',name:'Goblet Squat',pattern:'Squat',quality:'Hypertrophy',equip:'Dumbbell',limb:'Bilateral',muscles:'Quads, Glutes'},
  {id:'l10',name:'DB Shoulder Press',pattern:'Push',quality:'Strength',equip:'Dumbbell',limb:'Bilateral',muscles:'Shoulders'},
  {id:'l11',name:'Pallof Press',pattern:'Core',quality:'Stability',equip:'Cable',limb:'Bilateral',muscles:'Core, Obliques'},
  {id:'l12',name:'Box Jump',pattern:'Jump',quality:'Power',equip:'Bodyweight',limb:'Bilateral',muscles:'Quads, Glutes'},
  {id:'l13',name:'Farmer Carry',pattern:'Carry',quality:'Strength',equip:'Dumbbell',limb:'Bilateral',muscles:'Core, Forearms'},
  {id:'l14',name:'Nordic Curl',pattern:'Hinge',quality:'Strength',equip:'Bodyweight',limb:'Bilateral',muscles:'Hamstrings'},
  {id:'l15',name:'Standing OHP',pattern:'Push',quality:'Strength',equip:'Barbell',limb:'Bilateral',muscles:'Shoulders'},
  {id:'l16',name:'Lat Pulldown',pattern:'Pull',quality:'Strength',equip:'Cable',limb:'Bilateral',muscles:'Lats'},
  {id:'l17',name:'Face Pull',pattern:'Pull',quality:'Prehab',equip:'Cable',limb:'Bilateral',muscles:'Rear Delts'},
  {id:'l18',name:'Split Squat',pattern:'Lunge',quality:'Strength',equip:'Dumbbell',limb:'Unilateral',muscles:'Quads, Glutes'},
  {id:'l19',name:'Sled Push',pattern:'Carry',quality:'Conditioning',equip:'Sled',limb:'Bilateral',muscles:'Quads, Glutes'},
  {id:'l20',name:'Push Up',pattern:'Push',quality:'Strength',equip:'Bodyweight',limb:'Bilateral',muscles:'Chest, Triceps'},
  {id:'l21',name:'Cable Bicep Curl',pattern:'Pull',quality:'Hypertrophy',equip:'Cable',limb:'Bilateral',muscles:'Biceps'},
  {id:'l22',name:'Tricep Extension',pattern:'Push',quality:'Hypertrophy',equip:'Cable',limb:'Bilateral',muscles:'Triceps'},
  {id:'l23',name:'Z Press',pattern:'Push',quality:'Strength',equip:'Dumbbell',limb:'Bilateral',muscles:'Shoulders, Core'},
  {id:'l24',name:'BB Inverted Row',pattern:'Pull',quality:'Strength',equip:'Barbell',limb:'Bilateral',muscles:'Lats, Rhomboids'},
  {id:'l25',name:'Smith Machine Bench',pattern:'Push',quality:'Strength',equip:'Smith',limb:'Bilateral',muscles:'Chest, Triceps'},
]


// ═══════════════════════════════════════════════════════════════════════════════
// EXERCISE NAME REGISTRY — canonical name resolution (persists via localStorage)
// ═══════════════════════════════════════════════════════════════════════════════
const EX_REG_KEY = 'cgee_ex_registry'
let CGEE_TOKEN = null
let _EX_REG = (() => {
  try { return JSON.parse(localStorage.getItem(EX_REG_KEY)||'{"aliases":{},"history":[]}') }
  catch { return {aliases:{},history:[]} }
})()

function loadExReg() {
  const r = (_EX_REG && _EX_REG.aliases) ? _EX_REG : {aliases:{},history:[]}
  if(!r.terms) r.terms = {impl:{},move:{}}
  if(!r.terms.impl) r.terms.impl = {}
  if(!r.terms.move) r.terms.move = {}
  if(!r.terms.word) r.terms.word = {}
  if(!r.terms.accepted) r.terms.accepted = {}
  if(!r.terms.ignored) r.terms.ignored = {}
  if(!r.terms.exMode) r.terms.exMode = {}
  return r
}
function saveExReg(reg) {
  _EX_REG = reg
  try { localStorage.setItem(EX_REG_KEY, JSON.stringify(reg)) } catch {}
  // Durable persistence to Supabase (survives refresh / other devices). Best-effort.
  try {
    fetch(`${SUPABASE_URL}/rest/v1/exercise_registry?id=eq.global`, {
      method:'PATCH',
      headers:{ ...hdrs(CGEE_TOKEN), Prefer:'return=minimal' },
      body: JSON.stringify({ aliases: reg.aliases||{}, history: (reg.history||[]).slice(0,200), terms: reg.terms||{impl:{},move:{}}, updated_at: new Date().toISOString() })
    }).catch(()=>{})
  } catch {}
  // Notify React components that registry changed — triggers analyticsVersion bump in MainApp
  window.dispatchEvent(new CustomEvent('cgee-reg-changed'))
}
// Pull the registry from Supabase at startup; migrate any local-only data up.
async function hydrateExReg(token) {
  CGEE_TOKEN = token || CGEE_TOKEN
  try {
    const r = await sb.get('exercise_registry','select=*&id=eq.global',token)
    const row = (Array.isArray(r) && r[0]) ? r[0] : null
    const remoteEmpty = !row || (Object.keys(row.aliases||{}).length===0 && (row.history||[]).length===0)
    if (row && !remoteEmpty) {
      _EX_REG = { aliases: row.aliases||{}, history: row.history||[], terms: row.terms||{impl:{},move:{}} }
      try { localStorage.setItem(EX_REG_KEY, JSON.stringify(_EX_REG)) } catch {}
    } else if (_EX_REG && (Object.keys(_EX_REG.aliases||{}).length || (_EX_REG.history||[]).length)) {
      // Remote empty but we have local registry data → migrate it up
      saveExReg(_EX_REG)
    }
    window.dispatchEvent(new CustomEvent('cgee-reg-changed'))
  } catch {}
  return _EX_REG
}
// Resolve ANY exercise name to its canonical form
function resolveExName(name) {
  if(!name) return name
  const reg = loadExReg()
  return reg.aliases[(name||'').toLowerCase().trim()] || name
}
// Register a merge: multiple aliases → one canonical name
function regMerge(aliases, canonical) {
  const reg = loadExReg()
  if(!reg.aliases) reg.aliases = {}
  if(!reg.history) reg.history = []
  aliases.forEach(a => { reg.aliases[(a||'').toLowerCase().trim()] = canonical })
  // Also make the canonical resolve to itself (idempotent)
  reg.aliases[(canonical||'').toLowerCase().trim()] = canonical
  reg.history.unshift({type:'merge', canonical, aliases, ts: new Date().toISOString()})
  saveExReg(reg)
}
// Register a rename: old → new (keeps old as alias)
function regRename(oldName, newName) {
  const reg = loadExReg()
  if(!reg.aliases) reg.aliases = {}
  if(!reg.history) reg.history = []
  reg.aliases[(oldName||'').toLowerCase().trim()] = newName
  reg.aliases[(newName||'').toLowerCase().trim()] = newName
  // Update any existing aliases that pointed to oldName
  Object.keys(reg.aliases).forEach(k => {
    if(reg.aliases[k] === oldName) reg.aliases[k] = newName
  })
  reg.history.unshift({type:'rename', from:oldName, to:newName, ts: new Date().toISOString()})
  saveExReg(reg)
}
// Undo a specific merge/rename: remove aliases, optionally restore
function undoRegEntry(ts) {
  const reg = loadExReg()
  const entry = (reg.history||[]).find(h=>h.ts===ts)
  if(!entry) return
  if(entry.type==='merge') {
    entry.aliases.forEach(a => { delete reg.aliases[(a||'').toLowerCase().trim()] })
    delete reg.aliases[(entry.canonical||'').toLowerCase().trim()]
  } else if(entry.type==='rename') {
    delete reg.aliases[(entry.from||'').toLowerCase().trim()]
    delete reg.aliases[(entry.to||'').toLowerCase().trim()]
  }
  reg.history = reg.history.filter(h=>h.ts!==ts)
  saveExReg(reg)
}
// Get all registry entries for display
function getRegHistory() { return (loadExReg().history||[]).slice(0,50) }
function getRegAliases() { return loadExReg().aliases||{} }

// ─── LEARNED NAMING RULES — derive convention rules from how the coach renames ──
function getLearnedTerms(){ const r=loadExReg(); return r.terms||{impl:{},move:{}} }
function _ntoks(str){ return (str||'').toLowerCase().replace(/[()]/g,' ').replace(/-/g,' ').split(/\s+/).filter(Boolean) }
function learnFromRename(original, finalName){
  try{
    if(!original || !finalName || original===finalName) return
    const op = autoParseExercise(original)
    const fp = autoParseExercise(finalName)
    const reg = loadExReg()
    if(!reg.terms) reg.terms = {impl:{},move:{}}
    if(!reg.terms.impl) reg.terms.impl = {}
    if(!reg.terms.move) reg.terms.move = {}
    if(!reg.terms.word) reg.terms.word = {}
    let changed = false
    // Equipment vocabulary: source words that should map to an implement abbreviation
    if(fp.implement && fp.implement !== op.implement){
      const used = new Set([..._ntoks(fp.movement), ..._ntoks(fp.modifier), ..._ntoks(fp.variation)])
      const src = _ntoks(original).filter(t=>!used.has(t)).join(' ').trim()
      if(src && src.length<=24 && reg.terms.impl[src] !== fp.implement){ reg.terms.impl[src] = fp.implement; changed = true }
    }
    // Movement synonyms: you relabelled the movement (equipment may also have changed)
    if(fp.movement && op.movement && fp.movement.toLowerCase() !== op.movement.toLowerCase() && op.movement.length>2){
      const k = op.movement.toLowerCase().trim()
      if(k && reg.terms.move[k] !== fp.movement){ reg.terms.move[k] = fp.movement; changed = true }
    }
    // Generic single-word swaps (case-preserving), e.g. single -> 1, dumbbell -> DB
    const oTokL = _ntoks(original)
    const fRaw = (finalName||'').replace(/[()]/g,' ').replace(/-/g,' ').split(/\s+/).filter(Boolean)
    const fTokL = fRaw.map(t=>t.toLowerCase())
    const removed = oTokL.filter(t=>!fTokL.includes(t))
    const addedI = fTokL.map((t,i)=>oTokL.includes(t)?-1:i).filter(i=>i>=0)
    if(removed.length===1 && addedI.length===1){
      const src = removed[0], dest = fRaw[addedI[0]]
      if(src && dest && src!==dest.toLowerCase() && src.length>1 && reg.terms.word[src] !== dest){
        reg.terms.word[src] = dest; changed = true
      }
    }
    if(changed) saveExReg(reg)
  }catch{}
}
function removeLearnedTerm(kind, key){
  const reg = loadExReg()
  if(reg.terms && reg.terms[kind]){ delete reg.terms[kind][key]; saveExReg(reg) }
}
// Names the coach has explicitly accepted as-is — never suggest changes to these again
function isAcceptedName(name){ const a=getLearnedTerms().accepted||{}; return !!a[(name||'').toLowerCase().trim()] }
function acceptName(name){ const reg=loadExReg(); if(!reg.terms.accepted) reg.terms.accepted={}; reg.terms.accepted[(name||'').toLowerCase().trim()]=true; saveExReg(reg) }
function unacceptName(name){ const reg=loadExReg(); if(reg.terms&&reg.terms.accepted) delete reg.terms.accepted[(name||'').toLowerCase().trim()]; saveExReg(reg) }
// Duplicate groups the coach has chosen to ignore (persisted across refresh / devices)
function getIgnoredGroups(){ return getLearnedTerms().ignored||{} }
function ignoreGroup(key){ const reg=loadExReg(); if(!reg.terms.ignored) reg.terms.ignored={}; reg.terms.ignored[key]=true; saveExReg(reg) }
function unignoreGroup(key){ const reg=loadExReg(); if(reg.terms&&reg.terms.ignored) delete reg.terms.ignored[key]; saveExReg(reg) }
// Per-exercise measurement mode: normal | isometric | assisted | band (persisted, app-wide)
function detectExMode(name){
  const n = ' ' + String(name||'').toLowerCase() + ' '
  const has = (...ws) => ws.some(w => n.includes(w))
  if(has('band assist','assisted band','band chin','band pull','band dip','band-assist')) return 'band'
  if(has('assist','machine chin','machine pull','machine dip')) return 'assisted'
  if(has('isometric',' iso ','plank','wall sit','dead hang','l-sit','l sit','hollow','static hold',' hold ')) return 'isometric'
  return 'normal'
}
function getExMode(name){ const k=resolveExName(name||'').toLowerCase().trim(); const m=getLearnedTerms().exMode||{}; return m[k] || detectExMode(name) }
function setExMode(name, mode){ const reg=loadExReg(); if(!reg.terms.exMode) reg.terms.exMode={}; const k=resolveExName(name||'').toLowerCase().trim(); if(mode==='auto'||!mode) delete reg.terms.exMode[k]; else reg.terms.exMode[k]=mode; saveExReg(reg) }

// ═══════════════════════════════════════════════════════════════════════════════
// SCREENS
// ═══════════════════════════════════════════════════════════════════════════════

// ─── NOT CONFIGURED ───────────────────────────────────────────────────────────
function NotConfigured() {
  return (
    <div style={{ background:C.bg, minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{ maxWidth:460, width:'100%' }}>
        <div style={{ textAlign:'center', marginBottom:28 }}>
          <div style={{display:'flex',justifyContent:'center',marginBottom:12}}><Icon name="dumbbell" size={34} color={C.amber}/></div>
          <h1 style={{ fontSize:24, fontWeight:700, color:C.white, marginBottom:6 }}><span style={{color:C.amber}}>Coach</span>'d By Gee</h1>
          <p style={{ fontSize:14, color:C.muted }}>Open <code style={{color:C.amber}}>src/App.jsx</code> and update the two config lines at the top.</p>
        </div>
        <Card style={{padding:24}}>
          <SL>Setup</SL>
          {[['1','Go to supabase.com → create a free account'],['2','Create a project → SQL Editor → run the schema SQL'],['3','Settings → API → copy Project URL and anon key'],['4','Paste both into the top of App.jsx']].map(([n,t])=>(
            <div key={n} style={{display:'flex',gap:12,marginBottom:10,alignItems:'flex-start'}}>
              <div style={{width:22,height:22,borderRadius:'50%',background:`${C.amber}20`,color:C.amber,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,flexShrink:0}}>{n}</div>
              <span style={{fontSize:13,color:C.muted,lineHeight:1.6}}>{t}</span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  )
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  const submit = async () => {
    if(!email||!pw){ setErr('Enter email and password.'); return }
    setLoading(true); setErr('')
    try {
      const data = mode==='login' ? await sb.signIn(email,pw) : await sb.signUp(email,pw)
      if(data.error_description||data.error){ setErr(data.error_description||data.error); return }
      if(data.access_token){
        localStorage.setItem('cgee_session', JSON.stringify({access_token:data.access_token,user:data.user}))
        onLogin({access_token:data.access_token,user:data.user})
      } else if(mode==='signup'){
        setErr('Account created! Check your email to confirm, then sign in.'); setMode('login')
      }
    } catch(e){ setErr(e.message) }
    finally{ setLoading(false) }
  }

  return (
    <div style={{ background:C.bg, minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{ maxWidth:380, width:'100%' }}>
        <div style={{ textAlign:'center', marginBottom:28 }}>
          <h1 style={{ fontSize:28, fontWeight:700, color:C.white, letterSpacing:'-0.02em', marginBottom:6 }}>
            <span style={{color:C.amber}}>Coach</span>'d By Gee
          </h1>
          <p style={{ fontSize:14, color:C.muted }}>{mode==='login'?'Sign in to your dashboard':'Create your coach account'}</p>
        </div>
        <Card style={{padding:24}}>
          <ErrBox msg={err}/>
          <div style={{marginBottom:12}}><TI label="Email" value={email} onChange={setEmail} placeholder="you@example.com" type="email"/></div>
          <div style={{marginBottom:20}}><TI label="Password" value={pw} onChange={setPw} placeholder="••••••••" type="password"/></div>
          <Btn label={mode==='login'?'Sign In':'Create Account'} onClick={submit} loading={loading} full style={{marginBottom:10}}/>
          <button onClick={()=>{setMode(m=>m==='login'?'signup':'login');setErr('')}} style={{background:'none',border:'none',color:C.muted,cursor:'pointer',fontSize:13,width:'100%',textAlign:'center',padding:'4px 0'}}>
            {mode==='login'?'No account? Sign up':'Already have an account? Sign in'}
          </button>
        </Card>
      </div>
    </div>
  )
}

// ─── DASHBOARD HELPERS ────────────────────────────────────────────────────────
function getNextIncompleteSession(clientId, programs, sessions, weeks) {
  const progs = programs.filter(p=>p.client_id===clientId&&p.status==='current')
    .sort((a,b)=>{
      if(a.start_date&&b.start_date) return new Date(b.start_date)-new Date(a.start_date)
      const na=parseInt((a.name||'').match(/\d+/)?.[0]||0), nb=parseInt((b.name||'').match(/\d+/)?.[0]||0)
      if(na!==nb) return nb-na
      return new Date(b.created_at||0)-new Date(a.created_at||0)
    })
  for(const prog of progs){
    const progWeeks = weeks.filter(w=>w.program_id===prog.id).sort((a,b)=>a.week_number-b.week_number)
    for(const wk of progWeeks){
      const wkSess = sessions.filter(s=>s.week_id===wk.id)
        .sort((a,b)=>(a.sort_order||0)-(b.sort_order||0))
      const next = wkSess.find(s=>computeSessionStatus(s)!=='complete')
      if(next) return {session:next, program:prog, week:wk}
    }
  }
  return null
}

function getProgramsDue(clients, programs, sessions, weeks) {
  const due = []
  const today = new Date()
  today.setHours(0,0,0,0)

  clients.filter(c=>c.status==='active').forEach(client=>{
    const cp = programs.filter(p=>p.client_id===client.id&&p.status==='current')
    const hasDraft = programs.some(p=>p.client_id===client.id&&p.status==='draft')
    if(hasDraft) return // already being written — not due
    if(cp.length===0){
      // urgencyScore 0 = most urgent (overdue/no program)
      due.push({client,program:null,pct:0,reason:'No program',daysLabel:'Overdue',urgency:0})
      return
    }
    cp.forEach(prog=>{
      const ps = sessions.filter(s=>s.program_id===prog.id)
      if(!ps.length) return
      const done = ps.filter(s=>computeSessionStatus(s)==='complete').length
      const pct  = Math.round(done/ps.length*100)
      const sessLeft = ps.length - done // sessions remaining

      // Calculate days until program ends (if start_date set)
      let daysLeft = null
      if(prog.start_date){
        const progWeeks = (weeks||[]).filter(w=>w.program_id===prog.id)
        const totalWeeks = progWeeks.length>0 ? Math.max(...progWeeks.map(w=>w.week_number)) : 4
        const endDate = new Date(prog.start_date+'T00:00:00')
        endDate.setDate(endDate.getDate()+totalWeeks*7)
        daysLeft = Math.round((endDate-today)/(1000*60*60*24))
      }

      // Urgency score: lower = more urgent
      // 0 = no program, 1 = ends today/overdue, 2 = ends in 1-3 days, 3 = 4-7 days, 4 = 75-89%, 5 = 90%+
      let urgency = 999, daysLabel = null, flag = false

      if(pct>=90){
        urgency = 5; flag = true
        daysLabel = sessLeft===1 ? '1 session left' : `${sessLeft} sessions left`
      } else if(pct>=75){
        urgency = 4; flag = true
        daysLabel = sessLeft===1 ? '1 session left' : `${sessLeft} sessions left`
      }
      if(daysLeft!==null){
        if(daysLeft<=0){urgency=Math.min(urgency,1);flag=true;daysLabel='Ended'}
        else if(daysLeft===1){urgency=Math.min(urgency,2);flag=true;daysLabel='1 day left'}
        else if(daysLeft<=3){urgency=Math.min(urgency,2);flag=true;daysLabel=`${daysLeft} days left`}
        else if(daysLeft<=7){urgency=Math.min(urgency,3);flag=true;daysLabel=`${daysLeft} days left`}
      }

      if(flag) due.push({client,program:prog,pct,daysLabel,urgency})
    })
  })

  // Sort by urgency ascending (most urgent first), then by pct descending
  return due.sort((a,b)=>a.urgency!==b.urgency?a.urgency-b.urgency:b.pct-a.pct)
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD HELPERS — greeting, recent activity, week stats
// ═══════════════════════════════════════════════════════════════════════════════
function getGreeting(firstName) {
  const h = new Date().getHours()
  const tod = h < 5 ? 'evening' : h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening'
  return firstName ? `Good ${tod}, ${firstName}` : `Good ${tod}`
}

function getCoachFirstName() {
  try {
    const s = JSON.parse(localStorage.getItem('cgee_settings')||'{}')
    return (s.coachName||'').trim().split(' ')[0] || ''
  } catch { return '' }
}

// Returns ISO date string for start of current ISO week (Monday)
function startOfWeek(d=new Date()) {
  const out = new Date(d); out.setHours(0,0,0,0)
  const day = out.getDay() || 7
  if(day !== 1) out.setDate(out.getDate() - (day-1))
  return out
}

// Recent PBs across clients — walks history, finds running-max breakthroughs
function getRecentPBsAcross(activeClients, sessions, weeks, programs, days=14) {
  const cutoff = Date.now() - days*86400000
  const pbs = []
  activeClients.forEach(client => {
    const clientPBs = getClientPBs(client.id, sessions, sessions, weeks, programs)
    clientPBs.forEach(pb => {
      let runningMax = 0
      pb.history.forEach(h => {
        if(h.e1rm > runningMax) {
          const isNew = runningMax > 0  // only count PBs where there was prior data to beat
          if(isNew && h.date && h.date.getTime() > cutoff) {
            pbs.push({
              type:'pb', clientId:client.id, clientName:client.name,
              exercise:pb.name, e1rm:h.e1rm,
              date:h.date, sessId:h.sessId,
              ts: h.date.getTime()
            })
          }
          runningMax = h.e1rm
        }
      })
    })
  })
  return pbs.sort((a,b)=>b.ts-a.ts)
}

// Activity feed items: PBs + completed sessions + missed sessions
function buildActivityFeed(activeClients, sessions, programs, weeks, days=14) {
  const cutoff = Date.now() - days*86400000
  const items = []
  // Recent PBs
  items.push(...getRecentPBsAcross(activeClients, sessions, weeks, programs, days))
  // Completed sessions
  sessions.filter(s => s.status==='completed' && s.completed_at).forEach(sess => {
    const t = new Date(sess.completed_at).getTime()
    if(t > cutoff) {
      const client = activeClients.find(c=>c.id===sess.client_id)
      if(client) items.push({
        type:'completed', clientId:client.id, clientName:client.name,
        sessName:sess.name, sessId:sess.id, programId:sess.program_id,
        ts:t, date:new Date(sess.completed_at)
      })
    }
  })
  // Missed sessions: planned date in past, status not completed
  const now = Date.now()
  sessions.filter(s => s.status !== 'completed' && s.status !== 'skipped').forEach(sess => {
    const d = getSessionDate(sess, sessions, weeks, programs)
    if(d && d.getTime() < now && d.getTime() > cutoff) {
      const client = activeClients.find(c=>c.id===sess.client_id)
      if(client) items.push({
        type:'missed', clientId:client.id, clientName:client.name,
        sessName:sess.name, sessId:sess.id, programId:sess.program_id,
        ts:d.getTime(), date:d
      })
    }
  })
  // Skipped sessions — client actively skipped; surfaced to coach, never counted as missed
  sessions.filter(s => s.status === 'skipped').forEach(sess => {
    const d = getSessionDate(sess, sessions, weeks, programs)
    if(d && d.getTime() < now && d.getTime() > cutoff) {
      const client = activeClients.find(c=>c.id===sess.client_id)
      if(client) items.push({
        type:'skipped', clientId:client.id, clientName:client.name,
        sessName:sess.name, sessId:sess.id, programId:sess.program_id,
        ts:d.getTime(), date:d
      })
    }
  })
  return items.sort((a,b)=>b.ts-a.ts).slice(0, 12)
}

// Stats for the week: counts completed/scheduled, PBs, adherence over 4 weeks
function getWeekStats(activeClients, sessions, programs, weeks) {
  const wkStart = startOfWeek()
  const wkEnd = new Date(wkStart); wkEnd.setDate(wkEnd.getDate()+7)
  const fourWkAgo = new Date(wkStart); fourWkAgo.setDate(fourWkAgo.getDate()-21)
  let thisWeekScheduled = 0, thisWeekCompleted = 0
  let fourWkScheduled = 0, fourWkCompleted = 0
  sessions.forEach(sess => {
    if(!activeClients.find(c=>c.id===sess.client_id)) return
    const d = getSessionDate(sess, sessions, weeks, programs)
    if(!d) return
    if(sess.status==='skipped') return
    const t = d.getTime()
    if(t >= wkStart.getTime() && t < wkEnd.getTime()) {
      thisWeekScheduled++
      if(sess.status==='completed') thisWeekCompleted++
    }
    if(t >= fourWkAgo.getTime() && t < wkEnd.getTime()) {
      fourWkScheduled++
      if(sess.status==='completed') fourWkCompleted++
    }
  })
  const recentPBs = getRecentPBsAcross(activeClients, sessions, weeks, programs, 7).length
  const compliance = fourWkScheduled > 0 ? Math.round((fourWkCompleted/fourWkScheduled)*100) : null
  return { thisWeekScheduled, thisWeekCompleted, recentPBs, compliance }
}

// Friendly relative time
function relTime(date) {
  if(!date) return ''
  const d = (date instanceof Date) ? date : new Date(date)
  const diff = (Date.now() - d.getTime()) / 1000
  if(diff < 60) return 'just now'
  if(diff < 3600) return `${Math.floor(diff/60)}m ago`
  if(diff < 86400) return `${Math.floor(diff/3600)}h ago`
  const days = Math.floor(diff/86400)
  if(days < 7) return `${days}d ago`
  return d.toLocaleDateString('en-AU',{day:'numeric',month:'short'})
}

function Dashboard({ clients, programs, weeks, sessions, go, messages, subs, markMsgRead, markMsgActioned, replyMessage, reviewSub, av=0 }) {
  const [groupFilter, setGroupFilter] = useState('')
  const activeClients = clients.filter(c=>c.status==='active' && (!groupFilter||c.group_label===groupFilter))
  const due = getProgramsDue(activeClients, programs, sessions, weeks)
  const [showMsgReply, setShowMsgReply] = useState(null)
  const [replyTxt, setReplyTxt] = useState('')
  const [showSubId, setShowSubId] = useState(null)
  const [subNote, setSubNote] = useState('')

  const unreadMsgs = (messages||[]).filter(m=>!m.read_at).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at))
  const pendingSubs = (subs||[]).filter(s=>s.coach_review_status==='pending').sort((a,b)=>new Date(b.created_at)-new Date(a.created_at))

  // Sessions due today and tomorrow only
  const todayStart = new Date(); todayStart.setHours(0,0,0,0)
  const tomorrowEnd = new Date(todayStart); tomorrowEnd.setDate(tomorrowEnd.getDate()+2)
  const upcoming = activeClients
    .map(c=>({client:c, next:getNextIncompleteSession(c.id,programs,sessions,weeks)}))
    .filter(x=>x.next)
    .map(x=>({...x, date:getSessionDate(x.next.session, sessions, weeks, programs)}))
    .filter(x=>x.date && x.date >= todayStart && x.date < tomorrowEnd)
    .sort((a,b)=>a.date-b.date)

  // Stalling exercise count for Priorities — dashboard threshold (declining only, not plain stalling)
  const stallingCount = (()=>{
    let n = 0
    activeClients.forEach(client => {
      const pbs = getClientPBs(client.id, sessions, sessions, weeks, programs)
      pbs.forEach(pb => {
        const a = analyzeExerciseProgress(pb.history)
        if(['declining','strong_decline'].includes(a.status)) n++
      })
    })
    return n
  })()

  const stats = getWeekStats(activeClients, sessions, programs, weeks)
  const activity = buildActivityFeed(activeClients, sessions, programs, weeks, 14)

  const firstName = getCoachFirstName()
  const greeting = getGreeting(firstName)
  const todayStr = new Date().toLocaleDateString('en-AU',{weekday:'long',day:'numeric',month:'long'}).toUpperCase()

  // Contextual line — pick the most interesting fact for the moment
  const ctxLine = (()=>{
    if(stats.recentPBs > 0) return `${stats.recentPBs} new PB${stats.recentPBs!==1?'s':''} this week — keep the momentum.`
    if(stats.thisWeekCompleted > 0) return `${stats.thisWeekCompleted} session${stats.thisWeekCompleted!==1?'s':''} completed this week across your roster.`
    if(activeClients.length > 0) return `${activeClients.length} active client${activeClients.length!==1?'s':''} in your practice.`
    return 'Ready to coach.'
  })()

  // Priorities — top items needing attention today
  const priorities = []
  if(due.length > 0) {
    due.slice(0,2).forEach(d=>{
      priorities.push({
        kind:'program', icon:'clock',
        title: d.daysUntil <= 0 ? `${d.client.name} needs a new program` : `${d.client.name}'s program ends in ${d.daysUntil}d`,
        meta: d.program ? d.program.name : 'No active program',
        color: d.daysUntil <= 0 ? C.red : C.orange,
        onClick: () => go('client', {clientId:d.client.id})
      })
    })
  }
  if(unreadMsgs.length > 0) {
    priorities.push({
      kind:'msg', icon:'message',
      title: `${unreadMsgs.length} unread message${unreadMsgs.length!==1?'s':''}`,
      meta: unreadMsgs[0] ? `Latest: ${(clients.find(c=>c.id===unreadMsgs[0].client_id)?.name)||'Client'}` : '',
      color: C.amber,
      onClick: null  // scroll to messages section below
    })
  }
  if(pendingSubs.length > 0) {
    priorities.push({
      kind:'sub', icon:'repeat',
      title: `${pendingSubs.length} substitution request${pendingSubs.length!==1?'s':''} awaiting review`,
      meta: pendingSubs[0] ? (clients.find(c=>c.id===pendingSubs[0].client_id)?.name)||'' : '',
      color: C.purple,
      onClick: null
    })
  }
  if(stallingCount > 0) {
    priorities.push({
      kind:'stall', icon:'trendingDown',
      title: `${stallingCount} exercise${stallingCount!==1?'s':''} declining`,
      meta: 'Review the Coach Insights section below',
      color: C.orange,
      onClick: null
    })
  }
  if(upcoming.length > 0) {
    const todayCount = upcoming.filter(u=>{
      const d = u.date; const ts = todayStart.getTime()
      return d.getTime() >= ts && d.getTime() < ts + 86400000
    }).length
    if(todayCount > 0) priorities.push({
      kind:'today', icon:'play',
      title: `${todayCount} session${todayCount!==1?'s':''} scheduled for today`,
      meta: upcoming.slice(0,2).map(u=>u.client.name).join(', '),
      color: C.c2,
      onClick: null
    })
  }

  return (
    <div style={{padding:'24px 20px',maxWidth:1120,margin:'0 auto'}}>

      {/* ── HERO GREETING ─────────────────────────────────────────────── */}
      <div style={{marginBottom:32}}>
        <h1 style={{fontSize:28,fontWeight:600,color:C.white,letterSpacing:'-0.01em',marginBottom:6}}>{greeting}</h1>
        <div style={{display:'flex',alignItems:'baseline',gap:14,flexWrap:'wrap'}}>
          <span style={{fontSize:11,fontWeight:700,color:C.amber,fontFamily:'Space Grotesk,sans-serif',letterSpacing:'0.12em'}}>{todayStr}</span>
          <span style={{fontSize:13,color:C.muted,fontStyle:'italic'}}>{ctxLine}</span>
        </div>
      </div>

      <GroupFilter clients={clients} value={groupFilter} onChange={setGroupFilter}/>

      {/* ── TODAY'S PRIORITIES (hero card) ────────────────────────────── */}
      <div style={{marginBottom:32}}>
        <div style={{display:'flex',alignItems:'baseline',justifyContent:'space-between',marginBottom:10}}>
          <h2 style={{fontSize:11,fontWeight:700,color:C.amber,fontFamily:'Space Grotesk,sans-serif',textTransform:'uppercase',letterSpacing:'0.14em',margin:0}}>Today's Priorities</h2>
          {priorities.length>0&&<span style={{fontSize:11,color:C.faint}}>{priorities.length} item{priorities.length!==1?'s':''}</span>}
        </div>
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderLeft:`3px solid ${C.amber}`,borderRadius:12,padding:'20px 22px'}}>
          {priorities.length===0
            ? <div style={{display:'flex',alignItems:'center',gap:12,padding:'4px 0'}}>
                <Icon name="check" size={22} color={C.green}/>
                <div>
                  <div style={{fontSize:14,fontWeight:600,color:C.green}}>All clear</div>
                  <div style={{fontSize:12,color:C.muted,marginTop:2}}>No urgent items right now. Good time to plan ahead.</div>
                </div>
              </div>
            : <div style={{display:'flex',flexDirection:'column',gap:2}}>
                {priorities.map((p,i)=>(
                  <div key={i} onClick={p.onClick||undefined}
                    style={{display:'flex',alignItems:'center',gap:14,padding:'10px 4px',cursor:p.onClick?'pointer':'default',borderBottom: i<priorities.length-1 ? `1px solid ${C.border}40` : 'none',transition:'background 0.1s'}}
                    onMouseEnter={e=>{if(p.onClick) e.currentTarget.style.background=`${C.amber}05`}}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    <div style={{width:32,height:32,borderRadius:8,background:`${p.color}15`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,color:p.color,flexShrink:0}}><Icon name={p.icon} size={15} color={p.color}/></div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:13,fontWeight:600,color:C.white}}>{p.title}</div>
                      {p.meta&&<div style={{fontSize:11,color:C.faint,marginTop:2}}>{p.meta}</div>}
                    </div>
                    {p.onClick&&<span style={{color:C.faint,fontSize:14}}>›</span>}
                  </div>
                ))}
              </div>
          }
        </div>
      </div>

      {/* ── AT-A-GLANCE STATS ROW ─────────────────────────────────────── */}
      <div style={{marginBottom:32}}>
        <h2 style={{fontSize:11,fontWeight:700,color:C.c3,fontFamily:'Space Grotesk,sans-serif',textTransform:'uppercase',letterSpacing:'0.14em',marginBottom:10}}>Roster Pulse</h2>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))',gap:12}}>
          {/* Active clients */}
          <div onClick={()=>go('clients')} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:'18px 20px',cursor:'pointer',transition:'border-color 0.15s'}}
            onMouseEnter={e=>e.currentTarget.style.borderColor=`${C.c2}50`}
            onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}>
            <div style={{fontSize:32,fontWeight:700,color:C.white,fontFamily:'Space Grotesk,sans-serif',lineHeight:1}}>{activeClients.length}</div>
            <div style={{fontSize:10,fontWeight:700,color:C.c3,textTransform:'uppercase',letterSpacing:'0.08em',marginTop:8}}>Active Clients</div>
            <div style={{fontSize:11,color:C.faint,marginTop:3}}>{programs.filter(p=>p.status==='current').length} programs running</div>
          </div>
          {/* Sessions this week */}
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:'18px 20px'}}>
            <div style={{display:'flex',alignItems:'baseline',gap:6}}>
              <span style={{fontSize:32,fontWeight:700,color:C.white,fontFamily:'Space Grotesk,sans-serif',lineHeight:1}}>{stats.thisWeekCompleted}</span>
              <span style={{fontSize:14,color:C.faint,fontWeight:600}}>/ {stats.thisWeekScheduled||'—'}</span>
            </div>
            <div style={{fontSize:10,fontWeight:700,color:C.c3,textTransform:'uppercase',letterSpacing:'0.08em',marginTop:8}}>Sessions This Week</div>
            {stats.thisWeekScheduled > 0 && (()=>{
              const pct = Math.round((stats.thisWeekCompleted/stats.thisWeekScheduled)*100)
              const col = trafficColor(pct)
              return <div style={{marginTop:6,height:3,background:C.border,borderRadius:2,overflow:'hidden'}}>
                <div style={{height:'100%',width:`${pct}%`,background:col}}/>
              </div>
            })()}
          </div>
          {/* PBs this week */}
          <div style={{background:C.card,border:`1px solid ${stats.recentPBs>0?`${C.gold}50`:C.border}`,borderRadius:10,padding:'18px 20px',position:'relative'}}>
            <div style={{fontSize:32,fontWeight:700,color:stats.recentPBs>0?C.gold:C.white,fontFamily:'Space Grotesk,sans-serif',lineHeight:1}}>{stats.recentPBs}</div>
            <div style={{fontSize:10,fontWeight:700,color:C.gold,textTransform:'uppercase',letterSpacing:'0.08em',marginTop:8}}>{stats.recentPBs===1?'New PB':'New PBs'} This Week</div>
            <div style={{fontSize:11,color:C.faint,marginTop:3}}>{stats.recentPBs===0?'Keep pushing':'Celebrate the wins'}</div>
          </div>
          {/* Compliance */}
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:'18px 20px'}}>
            <div style={{display:'flex',alignItems:'baseline',gap:3}}>
              <span style={{fontSize:32,fontWeight:700,color:stats.compliance!==null?trafficColor(stats.compliance):C.faint,fontFamily:'Space Grotesk,sans-serif',lineHeight:1}}>{stats.compliance!==null?stats.compliance:'—'}</span>
              {stats.compliance!==null&&<span style={{fontSize:18,color:C.faint,fontWeight:600}}>%</span>}
            </div>
            <div style={{fontSize:10,fontWeight:700,color:C.c3,textTransform:'uppercase',letterSpacing:'0.08em',marginTop:8}}>Compliance (4 wk)</div>
            <div style={{fontSize:11,color:C.faint,marginTop:3}}>Completed vs scheduled</div>
          </div>
        </div>
      </div>

      {/* ── COACH INSIGHTS (stalling / progressing) ───────────────────── */}
      {(()=>{
        const stallItems = [], progItems = []
        activeClients.forEach(client => {
          const pbs = getClientPBs(client.id, sessions, sessions, weeks, programs)
          pbs.forEach(pb => {
            const a = analyzeExerciseProgress(pb.history)
            const row = {clientId:client.id, clientName:client.name, exercise:pb.name, ...a}
            // Dashboard only surfaces high-confidence signals — declining and strong_decline.
            // Plain "stalling" is shown on the per-client Progress tab.
            if(['declining','strong_decline'].includes(a.status)) stallItems.push(row)
            else if(['progressing','strong_progression'].includes(a.status)) progItems.push(row)
          })
        })
        const severity = {strong_decline:0, declining:1}
        stallItems.sort((a,b) => (severity[a.status]-severity[b.status]) || (b.exposures-a.exposures))
        progItems.sort((a,b) => b.pctChange - a.pctChange)
        const topStall = stallItems.slice(0, 5)
        const topProg  = progItems.slice(0, 4)
        if(topStall.length===0 && topProg.length===0) return null
        return(
          <div style={{marginBottom:32}}>
            <h2 style={{fontSize:11,fontWeight:700,color:C.c3,fontFamily:'Space Grotesk,sans-serif',textTransform:'uppercase',letterSpacing:'0.14em',marginBottom:10}}>Coach Insights</h2>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(280px, 1fr))',gap:14}}>
              {topStall.length>0&&(
                <Card style={{borderLeft:`3px solid ${C.orange}`}}>
                  <Row style={{alignItems:'center',gap:8,marginBottom:10}}>
                    <span style={{display:'inline-flex',alignItems:'center',gap:6,fontSize:11,fontWeight:700,color:C.orange,textTransform:'uppercase',letterSpacing:'0.08em'}}><Icon name="alert" size={13} color={C.orange}/>Needs Attention</span>
                    <span style={{fontSize:11,color:C.faint}}>{stallItems.length} total</span>
                  </Row>
                  <div style={{display:'flex',flexDirection:'column',gap:6}}>
                    {topStall.map((it,i)=>{
                      const m = stallStatusMeta(it.status)
                      return(
                        <div key={i} onClick={()=>go('client', {clientId:it.clientId})}
                          style={{display:'flex',alignItems:'center',gap:10,padding:'8px 10px',background:C.ink,border:`1px solid ${C.border}`,borderRadius:7,cursor:'pointer'}}
                          onMouseEnter={e=>e.currentTarget.style.background=`${C.amber}08`}
                          onMouseLeave={e=>e.currentTarget.style.background=C.ink}>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:12,fontWeight:600,color:C.white,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{it.exercise}</div>
                            <div style={{fontSize:10,color:C.faint,marginTop:1}}>{it.clientName} · {it.rationale}</div>
                          </div>
                          <span style={{fontSize:10,fontWeight:700,color:m.color,background:m.bg,padding:'3px 8px',borderRadius:5,whiteSpace:'nowrap'}}>{m.short}</span>
                        </div>
                      )
                    })}
                  </div>
                  {stallItems.length>6&&<p style={{fontSize:11,color:C.faint,marginTop:8,marginBottom:0}}>+{stallItems.length-6} more</p>}
                </Card>
              )}
              {topProg.length>0&&(
                <Card style={{borderLeft:`3px solid ${C.c2}`}}>
                  <Row style={{alignItems:'center',gap:8,marginBottom:10}}>
                    <span style={{display:'inline-flex',alignItems:'center',gap:6,fontSize:11,fontWeight:700,color:C.c2,textTransform:'uppercase',letterSpacing:'0.08em'}}><Icon name="trendingUp" size={13} color={C.c2}/>Progressing Well</span>
                    <span style={{fontSize:11,color:C.faint}}>{progItems.length} total</span>
                  </Row>
                  <div style={{display:'flex',flexDirection:'column',gap:6}}>
                    {topProg.map((it,i)=>(
                      <div key={i} onClick={()=>go('client', {clientId:it.clientId})}
                        style={{display:'flex',alignItems:'center',gap:10,padding:'8px 10px',background:C.ink,border:`1px solid ${C.border}`,borderRadius:7,cursor:'pointer'}}>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:12,fontWeight:600,color:C.white,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{it.exercise}</div>
                          <div style={{fontSize:10,color:C.faint,marginTop:1}}>{it.clientName}</div>
                        </div>
                        <span style={{fontSize:11,fontWeight:700,color:C.c2,whiteSpace:'nowrap'}}>+{it.pctChange}%</span>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          </div>
        )
      })()}

      {/* ── ACTIVITY FEED ─────────────────────────────────────────────── */}
      {activity.length>0&&(
        <div style={{marginBottom:32}}>
          <h2 style={{fontSize:11,fontWeight:700,color:C.c3,fontFamily:'Space Grotesk,sans-serif',textTransform:'uppercase',letterSpacing:'0.14em',marginBottom:10}}>Recent Activity</h2>
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,overflow:'hidden'}}>
            {activity.map((a,i)=>{
              const onClick = a.sessId
                ? ()=>go('session',{sessionId:a.sessId, programId:a.programId, clientId:a.clientId})
                : ()=>go('client', {clientId:a.clientId})
              const icon = a.type==='pb' ? 'trophy' : a.type==='completed' ? 'check' : 'circle'
              const iconColor = a.type==='pb' ? C.gold : a.type==='completed' ? C.c3 : a.type==='skipped' ? '#94A3B8' : C.faint
              return(
                <div key={i} onClick={onClick}
                  style={{display:'flex',alignItems:'center',gap:14,padding:'12px 18px',borderBottom: i<activity.length-1 ? `1px solid ${C.border}50` : 'none',cursor:'pointer',transition:'background 0.1s'}}
                  onMouseEnter={e=>e.currentTarget.style.background=`${C.lift}50`}
                  onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  <div style={{display:'flex',justifyContent:'center',width:20,flexShrink:0}}><Icon name={icon} size={15} color={iconColor}/></div>
                  <div style={{flex:1,minWidth:0}}>
                    {a.type==='pb' && <>
                      <div style={{fontSize:13,color:C.white}}>
                        <span style={{fontWeight:600}}>{a.clientName}</span>
                        <span style={{color:C.muted,fontStyle:'italic'}}> logged a new PB on </span>
                        <span style={{fontWeight:600,color:C.gold}}>{a.exercise}</span>
                      </div>
                      <div style={{fontSize:11,color:C.faint,marginTop:2,fontFamily:'monospace'}}>{Math.round(a.e1rm*10)/10}kg estimated 1RM</div>
                    </>}
                    {a.type==='completed' && <>
                      <div style={{fontSize:13,color:C.white}}>
                        <span style={{fontWeight:600}}>{a.clientName}</span>
                        <span style={{color:C.muted,fontStyle:'italic'}}> completed </span>
                        <span style={{fontWeight:600}}>{a.sessName}</span>
                      </div>
                    </>}
                    {a.type==='missed' && <>
                      <div style={{fontSize:13,color:C.white}}>
                        <span style={{fontWeight:600}}>{a.clientName}</span>
                        <span style={{color:C.muted,fontStyle:'italic'}}> missed </span>
                        <span style={{fontWeight:600,color:C.orange}}>{a.sessName}</span>
                      </div>
                    </>}
                    {a.type==='skipped' && <>
                      <div style={{fontSize:13,color:C.white}}>
                        <span style={{fontWeight:600}}>{a.clientName}</span>
                        <span style={{color:C.muted,fontStyle:'italic'}}> skipped </span>
                        <span style={{fontWeight:600,color:'#94A3B8'}}>{a.sessName}</span>
                      </div>
                    </>}
                  </div>
                  <div style={{fontSize:11,color:C.faint,whiteSpace:'nowrap',flexShrink:0}}>{relTime(a.date)}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── UPCOMING TODAY & TOMORROW ─────────────────────────────────── */}
      {upcoming.length>0&&(
        <div style={{marginBottom:32}}>
          <h2 style={{fontSize:11,fontWeight:700,color:C.amber,fontFamily:'Space Grotesk,sans-serif',textTransform:'uppercase',letterSpacing:'0.14em',marginBottom:10}}>Up Next</h2>
          <div style={{display:'flex',flexDirection:'column',gap:6}}>
            {upcoming.slice(0,5).map((u,i)=>{
              const sess = u.next.session, prog = u.next.program
              const isToday = u.date.toDateString() === new Date().toDateString()
              const dayLabel = isToday ? 'Today' : u.date.toLocaleDateString('en-AU',{weekday:'long'})
              return(
                <div key={i} onClick={()=>go('session',{sessionId:sess.id,programId:prog?.id,clientId:u.client.id})}
                  style={{display:'flex',alignItems:'center',gap:14,background:C.card,border:`1px solid ${C.border}`,borderLeft:`3px solid ${isToday?C.amber:C.c2}`,borderRadius:8,padding:'12px 16px',cursor:'pointer'}}>
                  <div style={{minWidth:62,flexShrink:0}}>
                    <div style={{fontSize:10,fontWeight:700,color:isToday?C.amber:C.c3,textTransform:'uppercase',letterSpacing:'0.08em'}}>{dayLabel}</div>
                    <div style={{fontSize:11,color:C.faint,marginTop:1}}>{u.date.toLocaleDateString('en-AU',{day:'numeric',month:'short'})}</div>
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:600,color:C.white}}>{u.client.name}</div>
                    <div style={{fontSize:12,color:C.muted,marginTop:1}}>{sess.name}{prog&&<span style={{color:C.faint}}> · {prog.name}</span>}</div>
                  </div>
                  <span style={{color:C.faint,fontSize:14}}>›</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── MESSAGES (condensed) ──────────────────────────────────────── */}
      {unreadMsgs.length>0&&(
        <div style={{marginBottom:32}}>
          <div style={{display:'flex',alignItems:'baseline',justifyContent:'space-between',marginBottom:10}}>
            <h2 style={{fontSize:11,fontWeight:700,color:C.orange,fontFamily:'Space Grotesk,sans-serif',textTransform:'uppercase',letterSpacing:'0.14em',margin:0}}>Client Messages</h2>
            <span style={{fontSize:11,color:C.orange,fontWeight:700}}>{unreadMsgs.length} unread</span>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {unreadMsgs.slice(0,4).map(m=>{
              const client=clients.find(c=>c.id===m.client_id)
              const sess=sessions.find(s=>s.id===m.session_id)
              return(
                <div key={m.id} style={{background:C.card,border:`1px solid ${C.border}`,borderLeft:`3px solid ${C.orange}`,borderRadius:8,padding:'12px 14px'}}>
                  <div style={{display:'flex',alignItems:'baseline',gap:8,marginBottom:5,flexWrap:'wrap'}}>
                    <span style={{fontWeight:700,color:C.white,fontSize:13}}>{client?.name||'Client'}</span>
                    {sess&&<span style={{fontSize:11,color:C.muted}}>· {sess.name}</span>}
                    <span style={{fontSize:11,color:C.faint,marginLeft:'auto'}}>{relTime(m.created_at)}</span>
                  </div>
                  <p style={{fontSize:13,color:C.white,margin:'0 0 8px',lineHeight:1.5}}>{m.message}</p>
                  <div style={{display:'flex',gap:5,flexWrap:'wrap',alignItems:'flex-start'}}>
                    <button onClick={()=>markMsgRead(m.id)} style={{background:'none',border:`1px solid ${C.border}`,borderRadius:5,padding:'3px 9px',color:C.faint,fontSize:10,cursor:'pointer'}}>Mark read</button>
                    <button onClick={()=>markMsgActioned(m.id)} style={{background:'none',border:`1px solid ${C.green}40`,borderRadius:5,padding:'3px 9px',color:C.green,fontSize:10,cursor:'pointer',fontWeight:600}}>Actioned</button>
                    {m.session_id&&<button onClick={()=>go('session',{sessionId:m.session_id,programId:m.program_id,clientId:m.client_id})} style={{background:'none',border:`1px solid ${C.c2}40`,borderRadius:5,padding:'3px 9px',color:C.c3,fontSize:10,cursor:'pointer'}}>Open session →</button>}
                    {showMsgReply===m.id
                      ?<div style={{display:'flex',gap:6,flex:1,minWidth:200,marginTop:4}}>
                        <textarea value={replyTxt} onChange={e=>setReplyTxt(e.target.value)} placeholder="Reply…" rows={2} style={{...iS,flex:1,resize:'none',fontSize:12}}></textarea>
                        <div style={{display:'flex',flexDirection:'column',gap:4}}>
                          <Btn label="Send" small onClick={()=>{replyMessage(m.id,replyTxt);setShowMsgReply(null);setReplyTxt('')}} disabled={!replyTxt.trim()}/>
                          <Btn label="✕" small variant="ghost" onClick={()=>{setShowMsgReply(null);setReplyTxt('')}}/>
                        </div>
                      </div>
                      :<button onClick={()=>setShowMsgReply(m.id)} style={{background:'none',border:`1px solid ${C.c2}40`,borderRadius:5,padding:'3px 9px',color:C.c3,fontSize:10,cursor:'pointer',fontWeight:600}}>↩ Reply</button>
                    }
                  </div>
                </div>
              )
            })}
            {unreadMsgs.length>4&&<p style={{fontSize:11,color:C.faint,textAlign:'center',margin:0}}>+{unreadMsgs.length-4} more</p>}
          </div>
        </div>
      )}

      {/* ── SUBSTITUTION REQUESTS (condensed) ─────────────────────────── */}
      {pendingSubs.length>0&&(
        <div style={{marginBottom:32}}>
          <div style={{display:'flex',alignItems:'baseline',justifyContent:'space-between',marginBottom:10}}>
            <h2 style={{fontSize:11,fontWeight:700,color:C.c3,fontFamily:'Space Grotesk,sans-serif',textTransform:'uppercase',letterSpacing:'0.14em',margin:0}}>Substitution Requests</h2>
            <span style={{fontSize:11,color:C.c3,fontWeight:700}}>{pendingSubs.length} pending</span>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {pendingSubs.slice(0,4).map(s=>{
              const client = clients.find(c=>c.id===s.client_id)
              return(
                <div key={s.id} style={{background:C.card,border:`1px solid ${C.border}`,borderLeft:`3px solid ${C.c2}`,borderRadius:8,padding:'12px 14px'}}>
                  <div style={{display:'flex',alignItems:'baseline',gap:8,marginBottom:6,flexWrap:'wrap'}}>
                    <span style={{fontWeight:700,color:C.white,fontSize:13}}>{client?.name||'Client'}</span>
                    <span style={{fontSize:11,color:C.faint,marginLeft:'auto'}}>{relTime(s.created_at)}</span>
                  </div>
                  <div style={{fontSize:12,color:C.muted,marginBottom:8}}>
                    Wants to swap <span style={{color:C.white,fontWeight:600}}>{s.original_name}</span> → <span style={{color:C.amber,fontWeight:600}}>{s.requested_name}</span>
                  </div>
                  {s.client_reason&&<div style={{fontSize:11,color:C.faint,fontStyle:'italic',marginBottom:8}}>"{s.client_reason}"</div>}
                  <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                    <button onClick={()=>{reviewSub(s.id,'approved',subNote);setShowSubId(null);setSubNote('')}} style={{background:`${C.green}20`,border:`1px solid ${C.green}50`,borderRadius:5,padding:'4px 10px',color:C.green,fontSize:11,cursor:'pointer',fontWeight:600}}>Approve</button>
                    <button onClick={()=>{reviewSub(s.id,'rejected',subNote);setShowSubId(null);setSubNote('')}} style={{background:`${C.red}15`,border:`1px solid ${C.red}50`,borderRadius:5,padding:'4px 10px',color:C.red,fontSize:11,cursor:'pointer',fontWeight:600}}>Reject</button>
                    {showSubId===s.id
                      ?<input value={subNote} onChange={e=>setSubNote(e.target.value)} placeholder="Coach note (optional)…" style={{...iS,flex:1,minWidth:160,fontSize:11,padding:'3px 8px'}}/>
                      :<button onClick={()=>setShowSubId(s.id)} style={{background:'none',border:`1px solid ${C.border}`,borderRadius:5,padding:'4px 10px',color:C.faint,fontSize:11,cursor:'pointer'}}>+ Note</button>
                    }
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Empty state — show only if literally no roster activity */}
      {activeClients.length===0&&(
        <div style={{textAlign:'center',padding:'40px 20px'}}>
          <div style={{display:'flex',justifyContent:'center',marginBottom:12,opacity:0.5}}><Icon name="users" size={42} color={C.faint}/></div>
          <h3 style={{fontSize:16,fontWeight:600,color:C.white,marginBottom:6}}>No active clients yet</h3>
          <p style={{fontSize:13,color:C.muted,marginBottom:16,fontStyle:'italic'}}>Add your first client to start coaching.</p>
          <Btn label="+ Add Client" onClick={()=>go('clients')}/>
        </div>
      )}

    </div>
  )
}


// ─── CLIENTS ──────────────────────────────────────────────────────────────────
const BLANK_CLIENT = { name:'', email:'', goal:'', train_days:'3', status:'active', pain_flag:false, notes:'' }

function ClientsView({ clients, programs, addClient, updateClient, deleteClient, saving, go }) {
  const [adding, setAdding] = useState(false)
  const [editId, setEditId] = useState(null)
  const [f, setF] = useState(BLANK_CLIENT)
  const [search, setSearch] = useState('')
  const [groupFilter, setGroupFilter] = useState('')
  const ff = k => v => setF(p=>({...p,[k]:v}))

  const save = async () => {
    if(!f.name.trim()) return
    if(editId) await updateClient(editId, f)
    else       await addClient(f)
    setAdding(false); setEditId(null); setF(BLANK_CLIENT)
  }
  const cancel = () => { setAdding(false); setEditId(null); setF(BLANK_CLIENT) }
  const filtered = clients.filter(c=>`${c.name} ${c.email||''} ${c.goal||''}`.toLowerCase().includes(search.toLowerCase()) && (!groupFilter||c.group_label===groupFilter))

  return (
    <div style={{padding:20,maxWidth:800,margin:'0 auto'}}>
      <Row style={{alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
        <h1 style={{fontSize:22,fontWeight:700,color:C.white,fontFamily:'Space Grotesk, sans-serif'}}>CLIENTS</h1>
        {!adding&&!editId&&<Btn label="+ Add Client" onClick={()=>{setF(BLANK_CLIENT);setAdding(true)}}/>}
      </Row>

      {(adding||editId) && (
        <Panel style={{marginBottom:16}}>
          <h3 style={{color:C.white,marginBottom:14}}>{editId?'Edit Client':'New Client'}</h3>
          <G2 style={{marginBottom:10}}>
            <TI label="Full Name *" value={f.name} onChange={ff('name')} placeholder="Alex Smith"/>
            <TI label="Email" value={f.email} onChange={ff('email')} placeholder="email@example.com"/>
          </G2>
          <div style={{marginBottom:10}}><TI label="Primary Goal" value={f.goal} onChange={ff('goal')} placeholder="Build lower body strength"/></div>
          <G2 style={{marginBottom:10}}>
            <SI label="Sessions / Week" value={f.train_days} onChange={ff('train_days')} options={['1','2','3','4','5','6']}/>
            <SI label="Status" value={f.status} onChange={ff('status')} options={['active','inactive']}/>
          </G2>
          <div style={{marginBottom:12}}><TA label="Notes" value={f.notes} onChange={ff('notes')} placeholder="Injury history, preferences…" rows={2}/></div>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:14}}>
            <input type="checkbox" id="pain_flag" checked={!!f.pain_flag} onChange={e=>setF(p=>({...p,pain_flag:e.target.checked}))} style={{width:14,height:14,accentColor:C.amber,cursor:'pointer'}}/>
            <label htmlFor="pain_flag" style={{fontSize:13,color:C.muted,cursor:'pointer'}}>Flag as pain / injury concern</label>
          </div>
          <Row><Btn label={editId?'Save Changes':'Add Client'} onClick={save} loading={saving} disabled={!f.name.trim()}/><Btn label="Cancel" variant="secondary" onClick={cancel}/></Row>
        </Panel>
      )}

      <GroupFilter clients={clients} value={groupFilter} onChange={setGroupFilter}/>
      <div style={{display:'flex',flexDirection:'column',gap:4,marginBottom:12}}>
        <label style={lS}>Search</label>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search clients…" style={iS}/>
      </div>

      {filtered.length===0 && !adding
        ? <Card style={{textAlign:'center',padding:40}}><p style={{color:C.muted}}>No clients yet. Click "+ Add Client" to get started.</p></Card>
        : <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {filtered.map(c=>{
              const cp = programs.filter(p=>p.client_id===c.id)
              const curr = cp.filter(p=>p.status==='current').length
              const done = cp.filter(p=>p.status==='complete').length
              return (
                <Card key={c.id} style={{padding:'13px 16px'}} onClick={()=>go('client',{clientId:c.id})}>
                  <Row style={{alignItems:'center'}}>
                    <div style={{width:40,height:40,borderRadius:'50%',background:`${C.c1}30`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,fontWeight:700,color:C.c3,flexShrink:0}}>
                      {(c.name||'?')[0].toUpperCase()}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <Row style={{alignItems:'center',gap:8,marginBottom:3,flexWrap:'wrap'}}>
                        <span style={{fontWeight:700,fontSize:15,color:C.white}}>{c.name}</span>
                        {c.status!=='active'&&<Tag v={c.status} color={C.muted}/>}
                        {c.pain_flag&&<Tag v="Pain" color={C.red}/>}
                      </Row>
                      <span style={{fontSize:12,color:C.muted}}>
                        {c.email||'No email'}{c.goal?` · ${c.goal}`:''}
                        {curr>0?` · ${curr} current`:''}
                        {done>0?` · ${done} complete`:''}
                      </span>
                    </div>
                    <div onClick={e=>e.stopPropagation()}>
                    <Row style={{gap:6}}>
                      <Btn label="Open"   variant="secondary" small onClick={()=>go('client',{clientId:c.id})}/>
                      <Btn label="Edit"   variant="secondary" small onClick={()=>{setF({...c,pain_flag:!!c.pain_flag});setEditId(c.id);setAdding(false)}}/>
                      <Btn label="✕"      variant="danger"    small onClick={()=>deleteClient(c.id)}/>
                    </Row>
                    </div>
                  </Row>
                </Card>
              )
            })}
          </div>
      }
    </div>
  )
}

// ─── CLIENT DETAIL ────────────────────────────────────────────────────────────
const BLANK_PROG = { name:'', goal:'', phase:'', status:'current', notes:'' }

const makeTempPw = (c) => {
  const parts = (c.name||'').toLowerCase().replace(/[^a-z\\s]/g,'').split(/\\s+/).filter(Boolean)
  let pw = parts.join('.') || 'client'
  while(pw.length<8) pw += Math.floor(Math.random()*10)
  return pw
}
function ClientAccessPanel({ client, updateClient }) {
  const [email, setEmail] = useState(client.email||'')
  const [busy, setBusy] = useState(false)
  const [ok, setOk] = useState(false)
  const [msg, setMsg] = useState('')
  const hasLogin = !!client.auth_user_id
  const createLogin = async () => {
    if(busy) return
    const e = (email||'').trim().toLowerCase()
    if(!e || !e.includes('@')){ setOk(false); setMsg('Enter a valid email address.'); return }
    setBusy(true); setMsg('')
    try {
      const tempPw = makeTempPw(client)
      const data = await sb.signUp(e, tempPw)
      const newId = (data && data.user && data.user.id) || (data && data.id)
      if(newId){
        updateClient(client.id,{auth_user_id:newId, email:e})
        setOk(true); setMsg('Login created. Email: '+e+'  -  Temporary password: '+tempPw+'  (give these to your client)')
      } else {
        setOk(false); setMsg((data && (data.msg||data.error_description||data.error)) || 'Could not create - this email may already be registered.')
      }
    } catch(err){ setOk(false); setMsg('Error: '+((err && err.message)||'failed')) }
    finally{ setBusy(false) }
  }
  return (
    <Card style={{marginBottom:16,borderColor:C.amber+'30'}}>
      <Row style={{alignItems:'center',gap:8}}>
        <Icon name="user" size={15} color={C.amber}/>
        <span style={{fontSize:12,fontWeight:700,color:C.white,fontFamily:'Space Grotesk,sans-serif',letterSpacing:'0.04em'}}>CLIENT APP ACCESS</span>
        {hasLogin && <span style={{fontSize:10,fontWeight:700,color:C.green,background:C.green+'1A',borderRadius:4,padding:'2px 7px'}}>ACTIVE</span>}
      </Row>
      {hasLogin ? (
        <p style={{fontSize:12,color:C.muted,margin:'8px 0 0'}}>This client can log in with <strong style={{color:C.white}}>{client.email}</strong> on their own phone and will see only their own training.</p>
      ) : (
        <div style={{marginTop:10}}>
          <p style={{fontSize:12,color:C.muted,margin:'0 0 8px'}}>Create a login so this client can use the app on their own phone.</p>
          <Row style={{gap:8,flexWrap:'wrap',alignItems:'center'}}>
            <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="client@email.com" style={{flex:1,minWidth:160,background:C.midnight,border:'1px solid '+C.border,borderRadius:7,padding:'9px 11px',color:C.white,fontSize:13,outline:'none'}}/>
            <Btn label={busy?'Creating...':'Create login'} small onClick={createLogin}/>
          </Row>
        </div>
      )}
      {msg && <p style={{fontSize:12,color:ok?C.green:C.orange,margin:'10px 0 0',fontWeight:600,wordBreak:'break-word'}}>{msg}</p>}
    </Card>
  )
}
function ClientDetail({ clientId, clients, programs, weeks, sessions, addProgram, updateProgram, deleteProgram, saving, go }) {
  const client = clients.find(c=>c.id===clientId)
  const clientProgs = [...programs.filter(p=>p.client_id===clientId)]
    .sort((a,b)=>{
      // 1. Most recent start_date first
      if(a.start_date&&b.start_date) return new Date(b.start_date)-new Date(a.start_date)
      if(a.start_date) return -1
      if(b.start_date) return 1
      // 2. Extract number from program name (e.g. "Program 14" → 14)
      const na=parseInt((a.name||'').match(/\d+/)?.[0]||0)
      const nb=parseInt((b.name||'').match(/\d+/)?.[0]||0)
      if(na!==nb) return nb-na
      // 3. Fallback to created_at
      return new Date(b.created_at||0)-new Date(a.created_at||0)
    })
  const current  = clientProgs.filter(p=>p.status==='current'||p.status==='draft')
  const previous = clientProgs.filter(p=>p.status==='complete'||p.status==='archived')
  const [adding, setAdding] = useState(false)
  const [showPrev, setShowPrev] = useState(false)
  const [prevFilter, setPrevFilter] = useState('all')
  const [prevSort, setPrevSort] = useState('recent')
  const [f, setF] = useState(BLANK_PROG)
  const ff = k => v => setF(p=>({...p,[k]:v}))

  const save = async () => {
    if(!f.name.trim()) return
    await addProgram({client_id:clientId,...f})
    setF(BLANK_PROG); setAdding(false)
  }

  if(!client) return <div style={{padding:20,color:C.muted}}>Client not found.</div>

  const PCard = ({ prog }) => {
    const ps   = sessions.filter(s=>s.program_id===prog.id)
    const done = ps.filter(s=>s.status==='complete').length
    const pct  = ps.length>0?Math.round(done/ps.length*100):0
    return (
      <Card style={{padding:'13px 16px',opacity:prog.status==='complete'?0.85:1}}>
        <Row style={{alignItems:'center'}}>
          <div style={{flex:1,cursor:'pointer',minWidth:0}} onClick={()=>go('program',{programId:prog.id,clientId})}>
            <Row style={{alignItems:'center',gap:8,marginBottom:3,flexWrap:'wrap'}}>
              <span style={{fontWeight:700,fontSize:14,color:C.white}}>{prog.name}</span>
              <Tag v={prog.status==='current'?'Current':'Complete'} color={prog.status==='current'?C.amber:C.green}/>
              {prog.phase&&<Tag v={prog.phase} color={C.c2} small/>}
            </Row>
            <span style={{fontSize:12,color:C.muted}}>{prog.goal||'No goal'} · {ps.length} sessions · {done} done</span>
            {ps.length>0&&<ProgressBar value={pct}/>}
          </div>
          <Row style={{gap:5}}>
            <Btn label="Open" variant="secondary" small onClick={()=>go('program',{programId:prog.id,clientId})}/>
            <Btn label={prog.status==='current'?'✓ Done':'↺'} variant="secondary" small onClick={()=>updateProgram(prog.id,{status:prog.status==='current'?'complete':'current',auto_completed:false})}/>
            <Btn label="✕" variant="danger" small onClick={()=>deleteProgram(prog.id)}/>
          </Row>
        </Row>
      </Card>
    )
  }

  return (
    <div style={{padding:20,maxWidth:860,margin:'0 auto'}}>
      <Breadcrumb items={[{label:'Clients',onClick:()=>go('clients')},{label:client.name}]}/>
      <Row style={{alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
        <div>
          <h1 style={{fontSize:22,fontWeight:700,color:C.white,marginBottom:2}}>{client.name}</h1>
          <span style={{fontSize:13,color:C.muted}}>{client.goal||'No goal'} · {client.train_days}×/week</span>
        </div>
        {!adding&&<Btn label="+ New Program" onClick={()=>{setF(BLANK_PROG);setAdding(true)}}/>}
      </Row>

      {adding && (
        <Panel style={{marginBottom:16}}>
          <h3 style={{color:C.white,marginBottom:12}}>New Program</h3>
          <div style={{marginBottom:10}}><TI label="Program Name *" value={f.name} onChange={ff('name')} placeholder="Program 1 — Upper Split"/></div>
          <G2 style={{marginBottom:10}}>
            <SI label="Phase" value={f.phase} onChange={ff('phase')} options={[{v:'',l:'— Phase —'},...PHASES]}/>
            <SI label="Status" value={f.status} onChange={ff('status')} options={[{v:'current',l:'Current'},{v:'complete',l:'Complete'}]}/>
          </G2>
          <div style={{marginBottom:12}}><TI label="Goal" value={f.goal} onChange={ff('goal')} placeholder="Build upper body strength"/></div>
          <Row><Btn label="Create Program" onClick={save} loading={saving} disabled={!f.name.trim()}/><Btn label="Cancel" variant="secondary" onClick={()=>setAdding(false)}/></Row>
        </Panel>
      )}

      {current.length>0&&(<><SL>Current Programs ({current.length})</SL><div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:18}}>{current.map(p=><PCard key={p.id} prog={p}/>)}</div></>)}
      {clientProgs.length===0&&!adding&&<Card style={{textAlign:'center',padding:32}}><p style={{color:C.muted,marginBottom:12}}>No programs yet.</p><Btn label="+ New Program" onClick={()=>setAdding(true)}/></Card>}
      {previous.length>0&&(
        <div style={{marginTop:8}}>
          <button onClick={()=>setShowPrev(p=>!p)}
            style={{width:'100%',background:showPrev?`${C.amber}10`:C.ink,border:`1px solid ${showPrev?`${C.amber}40`:C.border}`,borderRadius:10,padding:'11px 16px',display:'flex',alignItems:'center',gap:10,cursor:'pointer',transition:'all 0.15s'}}>
            <span style={{fontSize:13,fontWeight:700,color:showPrev?C.amber:C.muted,flex:1,textAlign:'left'}}>Previous Programs ({previous.length})</span>
            <span style={{fontSize:11,color:C.faint,transform:showPrev?'rotate(90deg)':'none',transition:'transform 0.2s'}}>›</span>
          </button>
          {showPrev&&(
            <div style={{background:C.ink,border:`1px solid ${C.border}`,borderTop:'none',borderRadius:'0 0 10px 10px',padding:'12px 14px'}}>
              <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:12}}>
                {[['all','All'],['complete','Completed'],['archived','Archived']].map(([v,l])=>(
                  <button key={v} onClick={()=>setPrevFilter(v)} style={{padding:'3px 10px',borderRadius:20,border:`1.5px solid ${prevFilter===v?C.amber:C.border}`,background:prevFilter===v?`${C.amber}18`:'transparent',color:prevFilter===v?C.amber:C.faint,fontSize:11,fontWeight:600,cursor:'pointer'}}>{l}</button>
                ))}
                <div style={{marginLeft:'auto',display:'flex',gap:5}}>
                  {[['recent','Recent'],['oldest','Oldest'],['number','Number']].map(([v,l])=>(
                    <button key={v} onClick={()=>setPrevSort(v)} style={{padding:'3px 10px',borderRadius:20,border:`1.5px solid ${prevSort===v?C.c2:C.border}`,background:prevSort===v?`${C.c2}18`:'transparent',color:prevSort===v?C.c3:C.faint,fontSize:11,fontWeight:600,cursor:'pointer'}}>{l}</button>
                  ))}
                </div>
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                {[...previous]
                  .filter(p=>prevFilter==='all'||p.status===prevFilter)
                  .sort((a,b)=>{
                    if(prevSort==='oldest') return new Date(a.start_date||a.created_at||0)-new Date(b.start_date||b.created_at||0)
                    if(prevSort==='number'){const na=parseInt((a.name||'').match(/\d+/)?.[0]||0),nb=parseInt((b.name||'').match(/\d+/)?.[0]||0);return nb-na}
                    return new Date(b.start_date||b.created_at||0)-new Date(a.start_date||a.created_at||0)
                  })
                  .map(p=><PCard key={p.id} prog={p}/>)
                }
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── PROGRAM DETAIL ───────────────────────────────────────────────────────────
function ProgramDetail({ programId, clientId, clients, programs, updateProgram, weeks, addWeek, deleteWeek, sessions, addSession, updateSession, deleteSession, saving, go }) {
  const prog       = programs.find(p=>p.id===programId)
  const client     = clients.find(c=>c.id===clientId)
  const progWeeks  = [...weeks.filter(w=>w.program_id===programId)].sort((a,b)=>a.week_number-b.week_number)
  const [editProg, setEditProg] = useState(false)
  const [pF, setPF] = useState({})
  const [addingWeek, setAddingWeek] = useState(false)
  const [wF, setWF] = useState({week_number:'',phase:'',notes:''})
  const [addingSessFor, setAddingSessFor] = useState(null)
  const [sF, setSF] = useState({name:'',session_type:'Strength',date_label:'',notes:''})
  const [collapsed, setCollapsed] = useState({})
  const [activeWeekId, setActiveWeekId] = useState(null)
  const [clip, setClip] = useState({session:null,week:null}) // clipboard for copy/paste

  const copySession = (sess) => {
    setClip(p=>({...p,session:{...sess,exercises:safeExercises(sess)}}))
  }
  const pasteSession = async (weekId) => {
    if(!clip.session) return
    const {id:_,week_id:__,completed_at:___,status:____,...rest} = clip.session
    await addSession({...rest,week_id:weekId,program_id:programId,client_id:clientId,status:'pending',exercises:rest.exercises||[]})
  }
  const copyWeek = (wk) => {
    const wkSess = sessions.filter(s=>s.week_id===wk.id).map(s=>({...s,exercises:safeExercises(s)}))
    setClip(p=>({...p,week:{...wk,sessions:wkSess}}))
  }
  const pasteWeek = async (targetWk) => {
    if(!clip.week) return
    for(const sess of clip.week.sessions){
      const {id:_,week_id:__,completed_at:___,status:____,...rest} = sess
      await addSession({...rest,week_id:targetWk.id,program_id:programId,client_id:clientId,status:'pending',exercises:rest.exercises||[]})
    }
  }
  const fillBlock = async (sourceWkId) => {
    const others = progWeeks.filter(w=>w.id!==sourceWkId)
    if(!others.length) return
    if(!window.confirm(`Copy sessions from this week to all ${others.length} other week${others.length!==1?'s':''}? Existing sessions are kept.`)) return
    const sourceSess = sessions.filter(s=>s.week_id===sourceWkId).map(s=>({...s,exercises:safeExercises(s)}))
    for(const wk of others){
      for(const sess of sourceSess){
        const {id:_,week_id:__,completed_at:___,status:____,...rest} = sess
        await addSession({...rest,week_id:wk.id,program_id:programId,client_id:clientId,status:'pending',exercises:rest.exercises||[]})
      }
    }
  }

  // Auto-complete logic
  useEffect(()=>{
    if(!prog) return
    const ps = sessions.filter(s=>s.program_id===programId)
    if(ps.length>0 && ps.every(s=>s.status==='complete') && prog.status!=='complete'){
      updateProgram(programId,{status:'complete',auto_completed:true})
    } else if(ps.some(s=>s.status!=='complete') && prog.status==='complete' && prog.auto_completed){
      updateProgram(programId,{status:'current',auto_completed:false})
    }
  },[sessions.map(s=>s.status).join()])

  if(!prog) return <div style={{padding:20,color:C.muted}}>Program not found.</div>

  const doAddWeek = async () => {
    const n = parseInt(wF.week_number)||1
    await addWeek({program_id:programId,week_number:n,phase:wF.phase,notes:wF.notes,sort_order:n})
    setWF({week_number:'',phase:'',notes:''}); setAddingWeek(false)
  }
  const doAddSess = async () => {
    if(!sF.name.trim()) return
    await addSession({week_id:addingSessFor,program_id:programId,client_id:clientId,...sF,status:'pending',exercises:[]})
    setSF({name:'',session_type:'Strength',date_label:'',notes:''}); setAddingSessFor(null)
  }
  const toggleSess = async (sId,cur) => {
    const ns = cur==='complete'?'pending':'complete'
    await updateSession(sId,{status:ns,completed_at:ns==='complete'?new Date().toISOString():null})
  }

  return (
    <div style={{padding:20,maxWidth:920,margin:'0 auto'}}>
      <Breadcrumb items={[{label:'Clients',onClick:()=>go('clients')},{label:client?.name||'Client',onClick:()=>go('client',{clientId})},{label:prog.name}]}/>

      {editProg ? (
        <Panel style={{marginBottom:18}}>
          <h3 style={{color:C.white,marginBottom:12}}>Edit Program</h3>
          <G2 style={{marginBottom:10}}>
            <TI label="Name" value={pF.name||''} onChange={v=>setPF(p=>({...p,name:v}))}/>
            <SI label="Status" value={pF.status||'current'} onChange={v=>setPF(p=>({...p,status:v}))} options={[{v:'current',l:'Current'},{v:'complete',l:'Complete'},{v:'archived',l:'Archived'}]}/>
          </G2>
          <G2 style={{marginBottom:10}}>
            <SI label="Phase" value={pF.phase||''} onChange={v=>setPF(p=>({...p,phase:v}))} options={[{v:'',l:'— Phase —'},...PHASES]}/>
            <TI label="Goal" value={pF.goal||''} onChange={v=>setPF(p=>({...p,goal:v}))} placeholder="Goal"/>
          </G2>
          <div style={{marginBottom:10}}>
            <TI label="Program Start Date" value={pF.start_date||''} onChange={v=>setPF(p=>({...p,start_date:v}))} placeholder="YYYY-MM-DD (e.g. 2024-10-24)" type="date"/>
            <p style={{fontSize:11,color:C.muted,marginTop:4}}>Used to place sessions on the calendar. Week 1 starts on this date.</p>
          </div>
          <div style={{marginBottom:12}}><TA label="Notes" value={pF.notes||''} onChange={v=>setPF(p=>({...p,notes:v}))} rows={2}/></div>
          <Row><Btn label="Save" onClick={()=>{updateProgram(programId,pF);setEditProg(false)}}/><Btn label="Cancel" variant="secondary" onClick={()=>setEditProg(false)}/></Row>
        </Panel>
      ) : (
        <Row style={{alignItems:'flex-start',marginBottom:18,gap:12}}>
          <div style={{flex:1}}>
            <Row style={{alignItems:'center',gap:10,marginBottom:4,flexWrap:'wrap'}}>
              <h1 style={{fontSize:20,fontWeight:700,color:C.white}}>{prog.name}</h1>
              <Tag v={prog.status==='current'?'Current':'Complete'} color={prog.status==='current'?C.amber:C.green}/>
              {prog.phase&&<Tag v={prog.phase} color={C.c2}/>}
              {progWeeks.length>0&&sessions.filter(s=>s.program_id===programId).some(s=>computeSessionStatus(s)!=='complete')&&(
                <button
                  title="Mark every session in this program as complete"
                  onClick={async()=>{
                    if(!window.confirm('Mark ALL sessions in this program as complete?')) return
                    const toMark=sessions.filter(s=>s.program_id===programId&&computeSessionStatus(s)!=='complete')
                    for(const s of toMark) await updateSession(s.id,{status:'manual_complete',completed_at:new Date().toISOString()})
                  }}
                  style={{fontSize:10,fontWeight:700,color:C.green,background:`${C.green}15`,border:`1px solid ${C.green}40`,borderRadius:6,padding:'3px 10px',cursor:'pointer',whiteSpace:'nowrap'}}>
                  ✓ Mark All Complete
                </button>
              )}
            </Row>
            <span style={{fontSize:13,color:C.muted}}>{client?.name}{prog.goal?` · ${prog.goal}`:''}{prog.start_date?` · Started ${new Date(prog.start_date+'T00:00:00').toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'numeric'})}`:''}</span>
            {prog.notes&&<div style={{fontSize:12,color:C.dim,fontStyle:'italic',marginTop:4}}>{prog.notes}</div>}
          </div>
          <Row style={{gap:6}}>
            <Btn label={prog.status==='current'?'Mark Complete':'Mark Current'} variant="secondary" small onClick={()=>updateProgram(programId,{status:prog.status==='current'?'complete':'current',auto_completed:false})}/>
            <Btn label="Edit" variant="secondary" small onClick={()=>{setEditProg(true);setPF({name:prog.name,goal:prog.goal||'',phase:prog.phase||'',status:prog.status,notes:prog.notes||'',start_date:prog.start_date||''})}}/>
            <Btn label="⊡ Save Template" variant="secondary" small onClick={()=>{
              const { templates: ts, addTemplate } = (() => {
                try{ return {templates:JSON.parse(localStorage.getItem('cgee_templates')||'[]'), addTemplate:(t)=>{const next=[...JSON.parse(localStorage.getItem('cgee_templates')||'[]'),{...t,id:Math.random().toString(36).slice(2),created_at:new Date().toISOString()}];localStorage.setItem('cgee_templates',JSON.stringify(next))}} }
                catch{ return {templates:[], addTemplate:()=>{}} }
              })()
              const progWeeks2 = weeks.filter(w=>w.program_id===programId).sort((a,b)=>a.week_number-b.week_number)
              const tData = {
                phase:prog.phase, goal:prog.goal,
                weeks: progWeeks2.map(wk=>({
                  week_number:wk.week_number, phase:wk.phase||'',
                  sessions: sessions.filter(s=>s.week_id===wk.id).map(s=>({
                    name:s.name, session_type:s.session_type||'',
                    sort_order:s.sort_order||0,
                    exercises:(safeExercises(s)||[]).map(e=>({...e,loggedSets:[],force_complete:false}))
                  }))
                }))
              }
              const name = window.prompt('Template name:', prog.name+' (Template)')
              if(name){addTemplate({type:'program',name,description:`${progWeeks2.length} weeks`,tags:prog.phase||'',data:tData});alert('Template saved! View under Strength → Templates')}
            }}/>
          </Row>
        </Row>
      )}

      {/* No start date banner */}
      {!prog.start_date&&!editProg&&(
        <div style={{background:`${C.orange}12`,border:`1px solid ${C.orange}35`,borderRadius:10,padding:'14px 16px',marginBottom:18}}>
          <Row style={{alignItems:'flex-start',gap:12,flexWrap:'wrap'}}>
            <div style={{flex:1,minWidth:200}}>
              <div style={{fontWeight:700,color:C.orange,fontSize:13,marginBottom:3}}>No start date assigned</div>
              <p style={{fontSize:12,color:C.muted}}>Add a start date to place sessions on the calendar.</p>
            </div>
            <Row style={{gap:6,flexWrap:'wrap',alignItems:'center'}}>
              <button onClick={()=>updateProgram(programId,{start_date:new Date().toISOString().split('T')[0]})}
                style={{background:`${C.orange}20`,border:`1px solid ${C.orange}50`,borderRadius:6,padding:'5px 10px',color:C.orange,fontSize:11,fontWeight:700,cursor:'pointer'}}>Today</button>
              <button onClick={()=>{const d=new Date();d.setDate(d.getDate()+((8-d.getDay())%7||7));updateProgram(programId,{start_date:d.toISOString().split('T')[0]})}}
                style={{background:`${C.orange}20`,border:`1px solid ${C.orange}50`,borderRadius:6,padding:'5px 10px',color:C.orange,fontSize:11,fontWeight:700,cursor:'pointer'}}>Next Monday</button>
              <input type="date" onChange={e=>e.target.value&&updateProgram(programId,{start_date:e.target.value})}
                style={{...iS,width:'auto',padding:'4px 8px',fontSize:11,color:C.white,cursor:'pointer'}} placeholder="Custom date"/>
            </Row>
          </Row>
        </div>
      )}

      <SL right={!addingWeek&&<Btn label="+ Add Week" small onClick={()=>setAddingWeek(true)}/>}>
        Weeks
      </SL>
      {progWeeks.length>0&&(
        <div style={{display:'flex',gap:4,flexWrap:'wrap',marginBottom:14}}>
          {progWeeks.map(wk=>{
            const wSess=sessions.filter(s=>s.week_id===wk.id)
            const wDone=wSess.filter(s=>computeSessionStatus(s)==='complete').length
            const wPct=wSess.length>0?Math.round(wDone/wSess.length*100):0
            const isActive=(activeWeekId||progWeeks[0]?.id)===wk.id
            const wColor=wPct===100?C.green:wPct>0?C.orange:C.muted
            return(
              <button key={wk.id} onClick={()=>setActiveWeekId(wk.id)}
                style={{padding:'6px 16px',borderRadius:7,border:`2px solid ${isActive?C.amber:C.border}`,
                  background:isActive?`${C.amber}15`:'transparent',
                  color:isActive?C.amber:C.muted,cursor:'pointer',fontSize:12,fontWeight:isActive?700:500,
                  display:'flex',flexDirection:'column',alignItems:'center',gap:2,minWidth:60}}>
                <span>Wk {wk.week_number}</span>
                <span style={{fontSize:9,color:wColor,fontWeight:700}}>{wPct===100?'✓':wPct>0?`${wPct}%`:`${wSess.length}s`}</span>
              </button>
            )
          })}
        </div>
      )}

      {addingWeek && (
        <Panel style={{marginBottom:14}}>
          <h4 style={{color:C.white,marginBottom:10}}>New Week</h4>
          <G3 style={{marginBottom:10}}>
            <TI label="Week Number *" value={wF.week_number} onChange={v=>setWF(p=>({...p,week_number:v}))} placeholder="1"/>
            <SI label="Phase" value={wF.phase} onChange={v=>setWF(p=>({...p,phase:v}))} options={[{v:'',l:'— Phase —'},...PHASES]}/>
            <TI label="Label" value={wF.notes} onChange={v=>setWF(p=>({...p,notes:v}))} placeholder="Optional"/>
          </G3>
          <Row><Btn label="Add Week" loading={saving} onClick={doAddWeek} disabled={!wF.week_number}/><Btn label="Cancel" variant="secondary" onClick={()=>setAddingWeek(false)}/></Row>
        </Panel>
      )}

      {progWeeks.length===0&&!addingWeek && (
        <Card style={{textAlign:'center',padding:28}}>
          <p style={{color:C.muted,marginBottom:10}}>No weeks yet.</p>
          <Btn label="+ Add Week" small onClick={()=>setAddingWeek(true)}/>
        </Card>
      )}

      {(()=>{
        const wk = progWeeks.find(w=>w.id===(activeWeekId||progWeeks[0]?.id))
        if(!wk) return null
        const weekSess = sessions.filter(s=>s.week_id===wk.id)
        const done = weekSess.filter(s=>computeSessionStatus(s)==='complete').length
        return(
          <div>
            <Row style={{alignItems:'center',marginBottom:10}}>
              <Row style={{alignItems:'center',gap:8,flex:1}}>
                <span style={{fontWeight:700,color:C.white}}>Week {wk.week_number}</span>
                {wk.phase&&<Tag v={wk.phase} color={C.c2}/>}
                <span style={{fontSize:12,color:C.muted}}>{done}/{weekSess.length} done</span>
              </Row>
              <Row style={{gap:5}}>
                {addingSessFor!==wk.id&&<Btn label="+ Session" small onClick={()=>{setAddingSessFor(wk.id);setSF({name:'',session_type:'Strength',date_label:'',notes:''})}}/>}
                {clip.session&&<Btn label={`⎘ Paste "${clip.session.name}"`} variant="secondary" small onClick={()=>pasteSession(wk.id)}/>}
                {progWeeks.length>1&&<Btn label="⬡ Fill Block" variant="ghost" small onClick={()=>fillBlock(wk.id)} title="Copy this week's sessions to all other weeks"/>}
                <Btn label="⎘ Copy Week" variant="ghost" small onClick={()=>{copyWeek(wk);alert(`Week ${wk.week_number} copied — navigate to another week and click Paste Week`)}}/>
                <Btn label="✕ Week" variant="danger" small onClick={()=>deleteWeek(wk.id)}/>
              </Row>
            </Row>
            {addingSessFor===wk.id&&(
              <Panel style={{marginBottom:10}}>
                <h4 style={{color:C.white,marginBottom:10}}>New Session</h4>
                <div style={{marginBottom:8}}><TI label="Session Name *" value={sF.name} onChange={v=>setSF(p=>({...p,name:v}))} placeholder="Horizontal Push"/></div>
                <G2 style={{marginBottom:8}}>
                  <SI label="Type" value={sF.session_type} onChange={v=>setSF(p=>({...p,session_type:v}))} options={SESS_TYPES}/>
                  <div>
                    <label style={lS}>Day</label>
                    <div style={{display:'flex',gap:4,flexWrap:'wrap',marginTop:3}}>
                      {['Mon','Tue','Wed','Thu','Fri','Sat','Sun','Rest'].map(d=>(
                        <button key={d} onClick={()=>setSF(p=>({...p,date_label:p.date_label===d?'':d}))}
                          style={{padding:'4px 8px',borderRadius:5,border:`1.5px solid ${sF.date_label===d?(d==='Rest'?C.faint:C.amber):C.border}`,
                            background:sF.date_label===d?(d==='Rest'?`${C.faint}18`:`${C.amber}18`):'transparent',
                            color:sF.date_label===d?(d==='Rest'?C.muted:C.amber):C.faint,
                            fontSize:11,fontWeight:600,cursor:'pointer'}}>
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>
                </G2>
                <div style={{marginBottom:10}}><TI label="Coach Note" value={sF.notes} onChange={v=>setSF(p=>({...p,notes:v}))} placeholder="Focus cues…"/></div>
                <Row><Btn label="Add Session" loading={saving} onClick={doAddSess} disabled={!sF.name.trim()}/><Btn label="Cancel" variant="secondary" onClick={()=>setAddingSessFor(null)}/></Row>
              </Panel>
            )}
            {weekSess.length===0&&!addingSessFor&&(
              <div style={{padding:'16px 0',fontSize:13,color:C.faint,textAlign:'center'}}>No sessions in Week {wk.week_number} — click "+ Session" to add one.</div>
            )}
            <div style={{display:'flex',flexDirection:'column',gap:6}}>
              {weekSess.map(sess=>{
                const exs=safeExercises(sess)
                const mainEx=exs.filter(e=>!e.isWarmup)
                const sessStatus=computeSessionStatus(sess)
                const sessColor=STATUS[sessStatus]?.color||C.muted
                const sessDate=getSessionDate(sess,sessions,weeks,programs)
                return(
                  <div key={sess.id} style={{background:C.ink,borderRadius:10,border:`1px solid ${sessColor}40`,overflow:'hidden'}}>
                    {/* Session header */}
                    <div style={{padding:'10px 14px',borderBottom:`1px solid ${C.border}`}}>
                      <Row style={{alignItems:'center',gap:8}}>
                        <span style={{color:C.faint,fontSize:14,cursor:'grab',flexShrink:0}}>⠿</span>
                        <div style={{flex:1,minWidth:0,cursor:'pointer'}} onClick={()=>go('session',{sessionId:sess.id,programId,clientId})}>
                          <Row style={{alignItems:'center',gap:6,flexWrap:'wrap'}}>
                            <span style={{width:8,height:8,borderRadius:'50%',background:sessColor,display:'inline-block',flexShrink:0}}/>
                            <span style={{fontWeight:700,color:sessStatus==='complete'?C.muted:C.white,fontSize:13}}>{sess.name}</span>
                            <Tag v={sess.session_type} color={C.c2} small/>
                            {sess.date_label&&<span style={{fontSize:11,color:C.muted}}>{sess.date_label}</span>}
                            {sessDate&&<span style={{fontSize:10,color:C.c3}}>{sessDate.toLocaleDateString('en-AU',{weekday:'short',day:'numeric',month:'short'})}</span>}
                          </Row>
                          {(()=>{
                            const p2=mainEx.reduce((a,e)=>a+(parseInt(e.sets)||1),0)
                            const d2=mainEx.reduce((a,e)=>a+(e.loggedSets||[]).filter(setIsDone).length,0)
                            if(sessStatus==='complete') return <span style={{fontSize:11,color:C.green,fontWeight:600}}>✓ Complete</span>
                            if(sessStatus==='in_progress'){const pct2=p2>0?Math.round(d2/p2*100):0;return <span style={{fontSize:11,color:C.orange}}>{pct2}% · {d2}/{p2} sets</span>}
                            return <span style={{fontSize:11,color:C.faint}}>{mainEx.length} exercises</span>
                          })()}
                        </div>
                        <Row style={{gap:4,flexShrink:0}}>
                          {sessStatus!=='complete'
                            ?<button onClick={()=>updateSession(sess.id,{status:'manual_complete',completed_at:new Date().toISOString()})} style={{background:`${C.green}18`,border:`1px solid ${C.green}40`,borderRadius:5,padding:'4px 10px',color:C.green,fontSize:11,fontWeight:700,cursor:'pointer'}}>✓ Done</button>
                            :<button onClick={()=>updateSession(sess.id,{status:null,completed_at:null})} style={{background:'transparent',border:`1px solid ${C.border}`,borderRadius:5,padding:'4px 10px',color:C.muted,fontSize:11,cursor:'pointer'}}>↺ Reopen</button>
                          }
                          <Btn label="⎘" variant="ghost" small onClick={()=>copySession(sess)} title="Copy session"/>
                          {clip.week&&<Btn label={`⎘ Paste Week ${clip.week.week_number}`} variant="secondary" small onClick={()=>pasteWeek(wk)}/>}
                          <Btn label="Open" variant="secondary" small onClick={()=>go('session',{sessionId:sess.id,programId,clientId})}/>
                          <Btn label="✕" variant="danger" small onClick={()=>deleteSession(sess.id)}/>
                        </Row>
                      </Row>
                    </div>
                    {/* Compact exercise preview */}
                    {mainEx.slice(0,6).map((ex,xi)=>(
                      <div key={ex.id} style={{display:'flex',alignItems:'center',gap:8,padding:'5px 14px',borderBottom:xi<Math.min(mainEx.length-1,5)?`1px solid ${C.border}40`:'none',background:xi%2===0?'transparent':`${C.white}02`}}>
                        {ex.blockLabel&&<span style={{minWidth:24,height:18,borderRadius:3,background:`${groupColor(ex.blockLabel)}20`,color:groupColor(ex.blockLabel),fontSize:9,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{ex.blockLabel}</span>}
                        <span style={{flex:1,fontSize:11,color:C.dim,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{ex.name}</span>
                        <span style={{fontSize:10,color:C.faint,whiteSpace:'nowrap'}}>{getPrescription(ex)}</span>
                      </div>
                    ))}
                    {mainEx.length>6&&<div style={{padding:'4px 14px',fontSize:10,color:C.faint}}>+{mainEx.length-6} more exercises</div>}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}
    </div>
  )
}

// ─── SESSION DETAIL ───────────────────────────────────────────────────────────
const BLANK_EX = { name:'', blockLabel:'A1', sequenceGroup:'', sets:'3', reps:'8', load:'', rpe:'', tempo:'', rest:'90s', notes:'', isWarmup:false, collect:['reps','load'], sectionName:'', time:'', distance:'', rir:'', perSide:'default', targets:[{reps:'8'},{reps:'8'},{reps:'8'}], targetCols:['reps'] }

const TARGET_OPTS = [['reps','Reps'],['load','Weight'],['rpe','RPE'],['rir','RIR'],['time','Time'],['distance','Distance']]
const TARGET_PH = { reps:'8', load:'80kg', rpe:'7', rir:'2', time:'0:30', distance:'20m' }
const TARGET_KEYS = ['reps','load','rpe','rir','time','distance']
const REP_SCHEMES = [
  {name:'5 × 5',         sets:5, reps:[5,5,5,5,5]},
  {name:'3 × 5',         sets:3, reps:[5,5,5]},
  {name:'3 × 8',         sets:3, reps:[8,8,8]},
  {name:'4 × 6',         sets:4, reps:[6,6,6,6]},
  {name:'4 × 8',         sets:4, reps:[8,8,8,8]},
  {name:'3 × 10',        sets:3, reps:[10,10,10]},
  {name:'3 × 12',        sets:3, reps:[12,12,12]},
  {name:'5 × 3',         sets:5, reps:[3,3,3,3,3]},
  {name:'Pyramid 12/10/8',  sets:3, reps:[12,10,8]},
  {name:'Pyramid 10/8/6',   sets:3, reps:[10,8,6]},
  {name:'Ramp 8/6/4',       sets:3, reps:[8,6,4]},
  {name:'Ramp 5/5/3/3/1',   sets:5, reps:[5,5,3,3,1]},
  {name:'Wave 5/3/1',       sets:3, reps:[5,3,1]},
  {name:'Wave 6/4/2',       sets:3, reps:[6,4,2]},
  {name:'Triples 3/2/1',    sets:3, reps:[3,2,1]},
]
const deriveTargets = (form) => {
  const cols = (form.targetCols&&form.targetCols.length)?form.targetCols:['reps']
  const n = Math.max(1, parseInt(form.sets)||1)
  const t = Array.from({length:n},(_,i)=>(form.targets&&form.targets[i])||{})
  const out = {}
  TARGET_KEYS.forEach(k=>{
    if(cols.includes(k)){
      const vals = t.map(r=> (r&&r[k]!=null) ? fmtRep(r[k]) : '')
      const uniq = [...new Set(vals)]
      out[k] = (uniq.length===1) ? uniq[0] : vals.join(' / ')
    } else out[k] = ''
  })
  return out
}
function TargetTable({ form, setForm }) {
  const cols = (form.targetCols&&form.targetCols.length)?form.targetCols:['reps']
  const n = Math.max(1, parseInt(form.sets)||1)
  const rows = Array.from({length:n},(_,i)=>(form.targets&&form.targets[i])||{})
  const [addingCol,setAddingCol]=useState(false)
  const setCell=(i,key,val)=>setForm(p=>{ const t=Array.from({length:n},(_,k)=>({...((p.targets&&p.targets[k])||{})})); t[i]={...t[i],[key]:val}; return {...p,targets:t} })
  const addSet=()=>setForm(p=>{ const t=Array.from({length:n},(_,k)=>({...((p.targets&&p.targets[k])||{})})); t.push({...(t[t.length-1]||{})}); return {...p,sets:String(n+1),targets:t} })
  const removeSet=(i)=>setForm(p=>{ if(n<=1) return p; const t=Array.from({length:n},(_,k)=>({...((p.targets&&p.targets[k])||{})})); t.splice(i,1); return {...p,sets:String(n-1),targets:t} })
  const addCol=(k)=>{ setForm(p=>({...p,targetCols:[...((p.targetCols&&p.targetCols.length)?p.targetCols:['reps']),k]})); setAddingCol(false) }
  const removeCol=(k)=>setForm(p=>({...p,targetCols:((p.targetCols&&p.targetCols.length)?p.targetCols:['reps']).filter(c=>c!==k)}))
  const applyScheme=(sc)=>setForm(p=>{
    const m=sc.sets
    const c=(p.targetCols&&p.targetCols.length)?[...p.targetCols]:['reps']
    if(!c.includes('reps')) c.unshift('reps')
    if(sc.rpe&&!c.includes('rpe')) c.push('rpe')
    const old=p.targets||[]
    const t=Array.from({length:m},(_,i)=>{
      const base={...(old[i]||old[old.length-1]||{})}
      base.reps=String(sc.reps[i]!=null?sc.reps[i]:sc.reps[sc.reps.length-1])
      if(sc.rpe) base.rpe=String(sc.rpe[i]!=null?sc.rpe[i]:sc.rpe[sc.rpe.length-1])
      return base
    })
    return {...p,sets:String(m),targets:t,targetCols:c}
  })
  const avail=TARGET_OPTS.filter(([k])=>!cols.includes(k))
  const lbl=(k)=>(TARGET_OPTS.find(o=>o[0]===k)||[k,k])[1]
  return (
    <div style={{marginBottom:10,border:`1px solid ${C.border}`,borderRadius:10,overflow:'visible'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'7px 11px',background:C.midnight,borderRadius:'10px 10px 0 0'}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <span style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:'uppercase',letterSpacing:'0.06em'}}>Targets</span>
          <select value="" onChange={e=>{ if(e.target.value==='') return; applyScheme(REP_SCHEMES[+e.target.value]); e.target.value='' }} style={{background:C.ink,border:`1px solid ${C.border}`,borderRadius:6,color:C.c3,fontSize:11,fontWeight:600,padding:'3px 8px',cursor:'pointer',outline:'none'}}>
            <option value="">Rep scheme…</option>
            {REP_SCHEMES.map((sc,i)=><option key={i} value={i}>{sc.name}</option>)}
          </select>
        </div>
        <div style={{display:'flex',gap:6,position:'relative'}}>
          <button type="button" onClick={addSet} style={{background:'none',border:`1px solid ${C.border}`,borderRadius:6,color:C.c3,fontSize:11,fontWeight:600,cursor:'pointer',padding:'3px 9px'}}>+ Set</button>
          <button type="button" onClick={()=>setAddingCol(v=>!v)} disabled={!avail.length} style={{background:'none',border:`1px solid ${C.border}`,borderRadius:6,color:avail.length?C.c3:C.faint,fontSize:11,fontWeight:600,cursor:avail.length?'pointer':'default',padding:'3px 9px'}}>+ Target</button>
          {addingCol&&avail.length>0&&(
            <div style={{position:'absolute',top:'112%',right:0,zIndex:50,background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:4,minWidth:130,boxShadow:'0 8px 24px rgba(0,0,0,0.45)'}}>
              {avail.map(([k,la])=><div key={k} onClick={()=>addCol(k)} style={{padding:'7px 10px',fontSize:12.5,color:C.white,borderRadius:6,cursor:'pointer'}} onMouseEnter={e=>e.currentTarget.style.background=C.lift} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>{la}</div>)}
            </div>
          )}
        </div>
      </div>
      <div style={{display:'flex',alignItems:'center',gap:6,padding:'6px 11px',borderTop:`1px solid ${C.border}`,borderBottom:`1px solid ${C.border}`}}>
        <span style={{width:46,flexShrink:0,fontSize:9,fontWeight:700,color:C.faint,textTransform:'uppercase'}}>Set</span>
        {cols.map(k=>(
          <div key={k} style={{flex:1,display:'flex',alignItems:'center',gap:3,minWidth:0}}>
            <span style={{fontSize:9,fontWeight:700,color:C.faint,textTransform:'uppercase'}}>{lbl(k)}</span>
            {cols.length>1&&<button type="button" onClick={()=>removeCol(k)} title="Remove target" style={{background:'none',border:'none',color:C.faint,cursor:'pointer',fontSize:12,padding:0,lineHeight:1}}>×</button>}
          </div>
        ))}
        <span style={{width:18,flexShrink:0}}/>
      </div>
      {rows.map((r,i)=>(
        <div key={i} style={{display:'flex',alignItems:'center',gap:6,padding:'5px 11px',borderBottom:i<rows.length-1?`1px solid ${C.border}40`:'none'}}>
          <span style={{width:46,flexShrink:0,fontSize:11,fontWeight:600,color:C.dim}}>Set {i+1}</span>
          {cols.map(k=>(
            <input key={k} value={(r&&r[k])||''} onChange={e=>setCell(i,k,e.target.value)} placeholder={TARGET_PH[k]||''} style={{flex:1,minWidth:0,width:'100%',background:C.ink,border:`1px solid ${C.border}`,borderRadius:6,padding:'7px 8px',color:C.white,fontSize:13,outline:'none',boxSizing:'border-box'}}/>
          ))}
          <button type="button" onClick={()=>removeSet(i)} disabled={n<=1} title="Remove set" style={{width:18,flexShrink:0,background:'none',border:'none',color:n<=1?C.faint:C.muted,cursor:n<=1?'default':'pointer',fontSize:14,padding:0}}>×</button>
        </div>
      ))}
    </div>
  )
}
const BLANK_SET = { completedLoad:'', completedReps:'', rpe:'', notes:'', skipped:false, bandColour:'' }

function SessionDetail({ sessionId, programId, clientId, clients, programs, weeks, sessions, updateSession, saving, go, messages, addMessage, replyMessage, markMsgRead, markMsgActioned, editMessage, subs=[], clientMode=false }) {
  const sess   = sessions.find(s=>s.id===sessionId)
  const prog   = programs.find(p=>p.id===programId)
  const client = clients.find(c=>c.id===clientId)
  const week   = weeks.find(w=>w.id===sess?.week_id)

  const [editSess,  setEditSess]  = useState(false)
  const [sF,        setSF]        = useState({})
  const [addingEx,  setAddingEx]  = useState(false)
  const [eF,        setEF]        = useState(BLANK_EX)
  const [editExId,  setEditExId]  = useState(null)
  const [editExF,   setEditExF]   = useState({})
  const [addSetFor, setAddSetFor] = useState(null)
  const [setF,      setSetF]      = useState(BLANK_SET)
  const [exSearch,  setExSearch]  = useState('')
  const [draggingId, setDraggingId] = useState(null)
  const [dragOverId, setDragOverId] = useState(null)
  const [collapsedGroups, setCollapsedGroups] = useState({})
  const [colorPickerGroup, setColorPickerGroup] = useState(null)
  const [historyEx, setHistoryEx] = useState(null)
  const [noteOpenId, setNoteOpenId] = useState(null)
  const [athleteNoteEx, setAthleteNoteEx] = useState(null)
  const [athleteNoteDraft, setAthleteNoteDraft] = useState('')
  const [editSectionKey, setEditSectionKey] = useState(null)
  const [sectionDraft, setSectionDraft] = useState('')

  if(!sess) return <div style={{padding:20,color:C.muted}}>Session not found.</div>

  const exs    = safeExercises(sess)
  const warmups= exs.filter(e=>e.isWarmup)
  const mainEx = exs.filter(e=>!e.isWarmup)
  const logged = mainEx.reduce((a,e)=>a+(e.loggedSets||[]).filter(setIsDone).length,0)
  const total  = mainEx.reduce((a,e)=>a+(parseInt(e.sets)||1),0)
  const isManuallyComplete = sess.status==='manual_complete'
  const pct    = isManuallyComplete ? 100 : (total>0?Math.min(100,Math.round(logged/total*100)):0)

  const saveExs = (newExs) => {
    const newStatus = computeSessionStatus({...sess, exercises:newExs})
    const completedAt = newStatus==='complete' ? (sess.completed_at||new Date().toISOString()) : null
    updateSession(sess.id, {exercises:newExs, status:newStatus, completed_at:completedAt})
  }
  const addEx     = () => { if(!eF.name.trim()) return; const d=deriveTargets(eF); saveExs([...exs,{id:uid(),...eF,...d,load:normalizeLbs(d.load),loggedSets:[]}]); setEF({...BLANK_EX,targets:[{reps:'8'},{reps:'8'},{reps:'8'}],targetCols:['reps']}); setAddingEx(false) }
  const saveExEdit= () => { const d=deriveTargets(editExF); saveExs(exs.map(e=>e.id===editExId?{...editExF,...d,id:editExId,load:normalizeLbs(d.load),loggedSets:e.loggedSets}:e)); setEditExId(null) }
  const delEx     = (id) => { if(!window.confirm('Delete exercise?')) return; saveExs(exs.filter(e=>e.id!==id)) }
  const dupEx     = (ex) => saveExs([...exs,{...ex,id:uid(),loggedSets:[]}])
  const moveEx    = (id,dir) => { const a=[...exs]; const i=a.findIndex(e=>e.id===id); if(i<0||(dir<0&&i===0)||(dir>0&&i===a.length-1)) return; [a[i],a[i+dir]]=[a[i+dir],a[i]]; saveExs(a) }
  const groupTypeName = (n) => n===1?'Single':n===2?'Superset':n===3?'Tri-set':'Circuit'
  const applyGroupColor = (ids,color) => { saveExs(exs.map(e=>ids.has(e.id)?{...e,labelColor:color||''}:e)); setColorPickerGroup(null) }
  const renameSection = (letter, name) => {
    sessions.filter(s=>s.program_id===programId).forEach(s=>{
      const arr = safeExercises(s); let changed=false
      const next = arr.map(e=>{
        const L=(e.blockLabel||'').replace(/\d+/g,'').toUpperCase()||(e.isWarmup?'P':'—')
        if(L===letter){ changed=true; return {...e, sectionName:name} }
        return e
      })
      if(changed) updateSession(s.id, {exercises:next})
    })
  }

  const onDragStart = (e, id) => { setDraggingId(id); e.dataTransfer.effectAllowed='move'; e.dataTransfer.setData('text/plain',id) }
  const onDragOver  = (e, id) => { e.preventDefault(); e.dataTransfer.dropEffect='move'; if(id!==draggingId) setDragOverId(id) }
  const onDragLeave = ()      => setDragOverId(null)
  const onDragEnd   = ()      => { setDraggingId(null); setDragOverId(null) }
  const onDrop      = (e, targetId) => {
    e.preventDefault()
    const fromId = e.dataTransfer.getData('text/plain') || draggingId
    setDraggingId(null); setDragOverId(null)
    if(!fromId || fromId===targetId) return
    const arr=[...exs]
    const fi=arr.findIndex(x=>x.id===fromId), ti=arr.findIndex(x=>x.id===targetId)
    if(fi<0||ti<0) return
    const [m]=arr.splice(fi,1); arr.splice(ti,0,m)
    saveExs(arr)
  }

  const filtLib = DEFAULT_LIB.filter(e=>!exSearch||e.name.toLowerCase().includes(exSearch.toLowerCase())||e.pattern.toLowerCase().includes(exSearch.toLowerCase()))

  // ── Compact exercise row with click-to-expand inline editor ──────────────
  const ExRow = ({ ex }) => {
    const gc = ex.labelColor || groupColor(ex.blockLabel)
    const isExpanded = editExId === ex.id
    const doneSets = (ex.loggedSets||[]).filter(setIsDone).length
    const totalSets = parseInt(ex.sets)||1
    const allDone = !ex.isWarmup && doneSets >= totalSets && totalSets > 0
    const prescription = getPrescription(ex)

    const openEdit = () => {
      setEditExId(ex.id)
      const sp=(v)=>String(v||'').split(/[\/,]/).map(x=>x.trim())
      const recCols=['reps','load','rpe','rir','time','distance'].filter(k=> k==='reps' || (ex[k]&&String(ex[k]).trim()!==''))
      const nS=Math.max(1,parseInt(ex.sets)||1)
      const recT=(ex.targets&&ex.targets.length)?ex.targets:Array.from({length:nS},(_,i)=>{const r={};recCols.forEach(k=>{const a=sp(ex[k]);r[k]=a.length?(a[i]!==undefined?a[i]:a[a.length-1]):''});return r})
      setEditExF({name:ex.name,blockLabel:ex.blockLabel||'',labelColor:ex.labelColor||'',sets:ex.sets||'',reps:ex.reps||'',load:ex.load||'',rpe:ex.rpe||'',tempo:ex.tempo||'',rest:ex.rest||'',notes:ex.notes||'',isWarmup:!!ex.isWarmup,sequenceGroup:ex.sequenceGroup||'',force_complete:!!ex.force_complete,videoUrl:ex.videoUrl||'',collect:ex.collect||(ex.isWarmup?['reps']:['reps','load']),sectionName:ex.sectionName||'',time:ex.time||'',distance:ex.distance||'',rir:ex.rir||'',perSide:ex.perSide||'default',targets:recT,targetCols:(ex.targetCols&&ex.targetCols.length)?ex.targetCols:(recCols.length?recCols:['reps'])})
    }

    return (
      <div
        draggable
        onDragStart={e=>onDragStart(e,ex.id)}
        onDragOver={e=>onDragOver(e,ex.id)}
        onDragLeave={onDragLeave}
        onDragEnd={onDragEnd}
        onDrop={e=>onDrop(e,ex.id)}
        style={{
          background:C.ink,
          borderLeft:`3px solid ${isExpanded?gc:allDone?C.green+'50':dragOverId===ex.id?C.c2:'transparent'}`,
          opacity:draggingId===ex.id?0.35:1,
          transform:dragOverId===ex.id?'translateY(-2px)':'none',
          transition:'border-color 0.12s,opacity 0.12s,transform 0.12s',
          overflow:'hidden',
        }}>

        {/* Compact header — click to expand */}
        <div
          onClick={()=>{ isExpanded ? setEditExId(null) : openEdit() }}
          style={{display:'flex',alignItems:'center',gap:8,padding:'8px 12px',cursor:'pointer',userSelect:'none',background:'transparent',transition:'background 0.1s'}}
          onMouseEnter={e=>{if(!isExpanded)e.currentTarget.style.background=`${C.white}05`}}
          onMouseLeave={e=>{if(!isExpanded)e.currentTarget.style.background='transparent'}}>

          <span style={{color:C.faint,fontSize:12,cursor:'grab',flexShrink:0}} onClick={e=>e.stopPropagation()}>⠿</span>

          {ex.blockLabel
            ? <span style={{minWidth:26,height:18,borderRadius:4,background:`${gc}22`,color:gc,fontSize:9,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,border:`1px solid ${gc}40`}}>{ex.blockLabel}</span>
            : <span style={{minWidth:26,flexShrink:0}}/>}

          <span style={{flex:1,fontSize:13,fontWeight:500,color:C.white,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
            {ex.name}
          </span>
          {(()=>{const sv=(subs||[]).find(sv=>sv.exercise_id===ex.id&&sv.session_id===sessionId);return sv?<span style={{fontSize:9,background:`${C.purple}20`,color:C.purple,borderRadius:4,padding:'1px 6px',fontWeight:700,flexShrink:0,whiteSpace:'nowrap'}}>⇄ {sv.substituted_exercise_name}</span>:null})()}

          {prescription&&(
            <span style={{fontSize:11,color:C.muted,whiteSpace:'nowrap',flexShrink:0,marginRight:4}}>{prescription}</span>
          )}

          {!ex.isWarmup&&doneSets>0&&(
            <span style={{fontSize:9,fontWeight:700,color:allDone?C.green:C.orange,background:allDone?`${C.green}18`:`${C.orange}18`,border:`1px solid ${allDone?C.green:C.orange}35`,borderRadius:4,padding:'1px 6px',flexShrink:0,whiteSpace:'nowrap'}}>
              {allDone?'✓ ':''}{doneSets}/{totalSets}
            </span>
          )}

          {!ex.isWarmup&&<button onClick={e=>{e.stopPropagation(); setHistoryEx(ex.name)}} title="History" style={{background:'none',border:'none',cursor:'pointer',padding:2,display:'flex',flexShrink:0}}><Icon name="clock" size={13} color={C.faint}/></button>}
          <span style={{color:C.faint,fontSize:11,transition:'transform 0.15s',transform:isExpanded?'rotate(90deg)':'none',flexShrink:0}}>›</span>
        </div>

        {ex.notes && !isExpanded && (
          <div style={{padding:'0 12px 9px 34px',marginTop:-2}}>
            <div style={{fontSize:11.5,color:C.dim,fontStyle:'italic',lineHeight:1.45,borderLeft:`2px solid ${gc}55`,paddingLeft:9}}>{ex.notes}</div>
          </div>
        )}

        {/* Expanded inline editor */}
        {isExpanded&&(
          <div style={{borderTop:`1px solid ${C.border}40`,padding:'10px 12px',background:'transparent'}}>
            <G2 style={{marginBottom:8}}>
              <TI label="Exercise Name" value={editExF.name||''} onChange={v=>setEditExF(p=>({...p,name:v}))} placeholder="Exercise name"/>
              <TI label="Block Label" value={editExF.blockLabel||''} onChange={v=>setEditExF(p=>({...p,blockLabel:v}))} placeholder="A1, B2, R1…"/>
              <div style={{marginBottom:8}}>
                <label style={lS}>Block Colour</label>
                <div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:4}}>
                  {['#FFA500','#3B82F6','#22C55E','#8B5CF6','#EC4899','#EF4444','#14B8A6','#F97316','#FACC15','#06B6D4'].map(col=>(
                    <div key={col} onClick={()=>setEditExF(p=>({...p,labelColor:p.labelColor===col?'':col}))}
                      style={{width:22,height:22,borderRadius:'50%',background:col,cursor:'pointer',
                        border:`2px solid ${editExF.labelColor===col?C.white:'transparent'}`,
                        transition:'border-color 0.1s',flexShrink:0}}/>
                  ))}
                  {editExF.labelColor&&<button onClick={()=>setEditExF(p=>({...p,labelColor:''}))}
                    style={{background:'none',border:`1px solid ${C.border}`,borderRadius:4,color:C.faint,fontSize:10,cursor:'pointer',padding:'2px 6px'}}>reset</button>}
                </div>
              </div>
            </G2>
            <TargetTable form={editExF} setForm={setEditExF}/>
            <G3 style={{marginBottom:8}}>
              <TI label="Tempo" value={editExF.tempo||''} onChange={v=>setEditExF(p=>({...p,tempo:v}))} placeholder="3010"/>
              <TI label="Rest"  value={editExF.rest||''}  onChange={v=>setEditExF(p=>({...p,rest:v}))}  placeholder="90s"/>
              <TI label="Video" value={editExF.videoUrl||''} onChange={v=>setEditExF(p=>({...p,videoUrl:v}))} placeholder="https://…"/>
            </G3>
            <div style={{marginBottom:8}}>
              <label style={lS}>Collect from athlete</label>
              <div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:4}}>
                {[['reps','Reps Completed'],['rir','Reps In Reserve'],['load','Weight Completed'],['rpe','RPE'],['time','Time'],['speed','Speed'],['rpm','RPM'],['distance','Distance Completed'],['power','Power'],['energy','Energy'],['hr','Heart Rate'],['vas','VAS Pain Score'],['band','Band Colour']].map(([k,lab])=>{
                  const on=(editExF.collect||[]).includes(k)
                  return <button key={k} type="button" onClick={()=>setEditExF(p=>{const c=new Set(p.collect||[]); c.has(k)?c.delete(k):c.add(k); return {...p,collect:[...c]}})} style={{fontSize:11,fontWeight:600,padding:'5px 11px',borderRadius:20,cursor:'pointer',border:`1px solid ${on?C.amber:C.border}`,background:on?`${C.amber}1A`:'transparent',color:on?C.amber:C.muted}}>{on?'\u2713 ':''}{lab}</button>
                })}
              </div>
              <div style={{fontSize:10,color:C.faint,marginTop:5,lineHeight:1.4}}>Selected = athlete logs it (a box per set). Unselected targets show read-only.</div>
            </div>
            <div style={{marginBottom:8}}>
              <label style={lS}>Measure reps on each side? (L + R)</label>
              <select value={editExF.perSide||'default'} onChange={e=>setEditExF(p=>({...p,perSide:e.target.value}))} style={{...iS,cursor:'pointer'}}>
                <option value="default">Auto — detect from exercise name</option>
                <option value="yes">Yes — show as (L + R)</option>
                <option value="no">No — single side</option>
              </select>
            </div>
            <div style={{marginBottom:8}}><TA label="Coach Note" value={editExF.notes||''} onChange={v=>setEditExF(p=>({...p,notes:v}))} rows={2} placeholder="Cues, tempo focus, modifications…"/></div>
            <div style={{display:'flex',gap:16,flexWrap:'wrap',marginBottom:10}}>
              <label style={{display:'flex',alignItems:'center',gap:5,cursor:'pointer',fontSize:12,color:C.muted}}>
                <input type="checkbox" checked={!!editExF.isWarmup} onChange={e=>setEditExF(p=>({...p,isWarmup:e.target.checked}))} style={{accentColor:C.c2}}/>
                Warm-up / prep
              </label>
              <label style={{display:'flex',alignItems:'center',gap:5,cursor:'pointer',fontSize:12,color:C.green}}>
                <input type="checkbox" checked={!!editExF.force_complete} onChange={e=>setEditExF(p=>({...p,force_complete:e.target.checked}))} style={{accentColor:C.green}}/>
                Force complete
              </label>
            </div>
            <Row style={{gap:6,flexWrap:'wrap',marginBottom:12}}>
              <Btn label="Save" onClick={saveExEdit}/>
              <Btn label="Cancel" variant="secondary" onClick={()=>setEditExId(null)}/>
              {!ex.isWarmup&&<Btn label="+ Set" variant="secondary" small onClick={()=>{const _lb=(ex.loggedSets||[]).filter(s=>s.bandColour).slice(-1)[0];setAddSetFor(ex.id);setSetF({...BLANK_SET, bandColour:_lb?_lb.bandColour:''})}}/>}
              {!ex.isWarmup&&<Btn label="Dup" variant="ghost" small onClick={()=>dupEx(ex)}/>}
              <Btn label="Delete" variant="danger" small onClick={()=>{delEx(ex.id);setEditExId(null)}}/>
            </Row>

            {/* Logged sets */}
            {!ex.isWarmup&&(ex.loggedSets||[]).length>0&&(
              <div style={{borderTop:`1px solid ${C.border}`,paddingTop:8,marginBottom:8}}>
                <div style={{fontSize:10,color:C.faint,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:5}}>Logged Sets — click to edit</div>
                <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
                  {(ex.loggedSets||[]).map(ls=>{
                    const isNoWeight = !ls.completedLoad && !ls.skipped
                    const color = ls.skipped ? C.orange : isNoWeight ? C.c3 : C.green
                    const label = ls.skipped
                      ? `S${ls.setNumber} skip`
                      : isNoWeight
                        ? `S${ls.setNumber} BW${ls.completedReps?` ×${ls.completedReps}`:''}`
                        : [ls.completedLoad,ls.completedReps?`×${ls.completedReps}`:'',ls.rpe?`@${ls.rpe}`:''].filter(Boolean).join(' ')||'—'
                    return(
                      <span key={ls.id}
                        onClick={()=>{setAddSetFor(ex.id);setSetF({completedLoad:ls.completedLoad||'',completedReps:ls.completedReps||'',rpe:ls.rpe||'',notes:ls.notes||'',skipped:!!ls.skipped,bandColour:ls.bandColour||'',_editId:ls.id})}}
                        style={{fontSize:11,background:`${color}18`,border:`1px solid ${color}40`,borderRadius:5,padding:'2px 8px',color,fontWeight:600,whiteSpace:'nowrap',cursor:'pointer'}}>
                        {label}
                      </span>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Add/edit set form */}
            {!ex.isWarmup&&addSetFor===ex.id&&(
              <div style={{background:`${C.amber}06`,borderRadius:8,padding:'10px 12px',border:`1px solid ${C.border}`,marginTop:4}}>
                <div style={{fontSize:10,fontWeight:700,color:C.amber,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:8}}>
                  {setF._editId?'Edit Set':'Log Set '+((ex.loggedSets||[]).length+1)}
                </div>
                <G4 style={{marginBottom:6}}>
                  <TI label="Load" value={setF.completedLoad} onChange={v=>setSetF(p=>({...p,completedLoad:v}))} placeholder={ex.load||'kg'}/>
                  <TI label="Reps" value={setF.completedReps} onChange={v=>setSetF(p=>({...p,completedReps:v}))} placeholder={ex.reps||'reps'}/>
                  <TI label="RPE"  value={setF.rpe}           onChange={v=>setSetF(p=>({...p,rpe:v}))}           placeholder={ex.rpe||'—'}/>
                  <TI label="Note" value={setF.notes}         onChange={v=>setSetF(p=>({...p,notes:v}))}         placeholder=""/>
                </G4>
                {getExMode(ex.name)==='band'&&(
                  <div style={{marginBottom:6}}>
                    <TI label="Band colour" value={setF.bandColour} onChange={v=>setSetF(p=>({...p,bandColour:v}))} placeholder="e.g. green"/>
                    <div style={{fontSize:10,color:C.faint,marginTop:3}}>Carries forward to your next sets until you change it.</div>
                  </div>
                )}
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
                  <input type="checkbox" checked={!!setF.skipped} onChange={e=>setSetF(p=>({...p,skipped:e.target.checked}))} style={{accentColor:C.orange,cursor:'pointer'}}/>
                  <span style={{fontSize:12,color:C.muted}}>Mark as skipped</span>
                </div>
                <Row style={{gap:6}}>
                  <Btn label={setF._editId?'Update Set':'Log Set'} small onClick={()=>{
                    const existNum = setF._editId?(ex.loggedSets||[]).find(s=>s.id===setF._editId)?.setNumber||1:((ex.loggedSets||[]).length+1)
                    const newSet={id:setF._editId||uid(),setNumber:existNum,...setF,skipped:!setF.completedLoad&&!setF.completedReps&&!setF.rpe&&!setF.notes&&!setF.bandColour,_editId:undefined}
                    const newSets = setF._editId
                      ? (ex.loggedSets||[]).map(s=>s.id===setF._editId?newSet:s)
                      : [...(ex.loggedSets||[]),newSet]
                    saveExs(exs.map(e=>e.id===ex.id?{...e,loggedSets:newSets}:e))
                    setSetF(BLANK_SET); setAddSetFor(null)
                  }}/>
                  <Btn label="Cancel" variant="secondary" small onClick={()=>setAddSetFor(null)}/>
                </Row>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // ── Athlete client-mode logging helpers ──────────────────────────────────
  const isUnilateral = (ex) => ex.perSide==='yes' ? true : ex.perSide==='no' ? false : /alternating|each side|per side|\(l\s*\+\s*r\)|unilateral|\beach\b/i.test(ex.name||'')
  const splitTargets = (v) => String(v||'').split(/[\/,]/).map(x=>x.trim()).filter(Boolean)
  const perSetTarget = (v,i) => { const a=splitTargets(v); return fmtRep(a.length?(a[i]!==undefined?a[i]:a[a.length-1]):'') }
  const CFIELD = { reps:'completedReps', time:'completedTime', load:'completedLoad', rpe:'rpe', rir:'rir', distance:'completedDistance', speed:'speed', rpm:'rpm', power:'power', energy:'energy', hr:'hr', vas:'vas', band:'bandColour' }
  const commitSet = (exId,setNum,field,value) => {
    const e=exs.find(x=>x.id===exId); if(!e) return
    const ls=[...(e.loggedSets||[])]
    const idx=ls.findIndex(s=>s.setNumber===setNum)
    if(idx>=0) ls[idx]={...ls[idx],[field]:value}
    else ls.push({id:uid(),setNumber:setNum,[field]:value})
    saveExs(exs.map(x=>x.id===exId?{...x,loggedSets:ls}:x))
  }
  const ClientBox = ({ ex, setNum, metric, target, color, hint }) => {
    const field=CFIELD[metric]
    const ls=(ex.loggedSets||[]).find(s=>s.setNumber===setNum)
    const val=ls&&ls[field]!=null?ls[field]:''
    const isPrimary=(metric==='reps'||metric==='time')
    const logged=(val!==''&&val!=null)
    let shown, col
    if(logged){ shown=val; col='#0F1115' }
    else if(isPrimary){ shown=(target||''); col='#0F1115' }
    else if(hint){ shown=String(hint); col='#B4BCC8' }
    else { shown=''; col='#8A92A0' }
    return (
      <input
        key={ex.id+'-'+setNum+'-'+metric+'-'+String(val)+'-'+(logged?'c':'g')+'-'+String(hint||'')}
        defaultValue={shown}
        placeholder={target||''}
        inputMode={(metric==='time'||metric==='band')?'text':'decimal'}
        onFocus={e=>e.target.select()}
        onBlur={e=>{ const v=e.target.value; if(v!==String(shown)) commitSet(ex.id,setNum,field,v) }}
        style={{flex:1,minWidth:0,width:'100%',background:'#FFFFFF',border:'none',borderRadius:9,padding:'12px 4px',color:col,fontSize:16,fontWeight:700,textAlign:'center',outline:'none',boxSizing:'border-box',WebkitTextFillColor:col,caretColor:'#0F1115'}}
      />
    )
  }
  const ClientExRow = ({ ex, sectionCol }) => {
    const N = Math.max(1, parseInt(ex.sets)||1)
    const sets = Array.from({length:N},(_,i)=>i+1)
    const _setLogged = (sn)=>{ const ls=(ex.loggedSets||[]).find(z=>z.setNumber===sn); if(!ls) return false; if(ls.skipped) return true; const r=ls.completedReps,l=ls.completedLoad; return (r!=null&&String(r).trim()!=='')||(l!=null&&String(l).trim()!=='') }
    const _exDone = sets.length>0 && sets.every(_setLogged)
    const collect = ex.collect || (ex.isWarmup?['reps']:['reps','load'])
    const primary = (collect.includes('time')||(ex.time&&!ex.reps)) ? 'time' : 'reps'
    const primaryLabel = (primary==='time'?'Time':'Reps') + (isUnilateral(ex)?' (L + R)':'')
    const MET={load:{label:'Weight',color:C.c2},rpe:{label:'RPE'},rir:{label:'RIR'},time:{label:'Time'},speed:{label:'Speed'},rpm:{label:'RPM'},distance:{label:'Distance'},power:{label:'Power'},energy:{label:'Energy'},hr:{label:'Heart Rate'},vas:{label:'Pain (VAS)'},band:{label:'Band',color:C.purple}}
    const ORDER=['load','rpe','rir','time','speed','rpm','distance','power','energy','hr','vas','band']
    const extra = ORDER.filter(k=>k!==primary && collect.includes(k) && MET[k] && !(k==='load'&&ex.isWarmup)).map(k=>[k,MET[k].label])
    const _numFrom=(z)=>{ const mm=String(z==null?'':z).match(/-?\d+(?:\.\d+)?/); return mm?parseFloat(mm[0]):null }
    let lastWeightHint=null
    if(!ex.isWarmup && collect.includes('load')){
      const nm=(x)=>String(x||'').trim().toLowerCase()
      const names=[nm(ex.name),nm(ex._originalName)].filter(Boolean)
      const cand=[]
      ;(sessions||[]).forEach(ss=>{ if(ss.id===sessionId) return
        ;(safeExercises(ss)||[]).forEach(e2=>{ const en=[nm(e2.name),nm(e2._originalName)].filter(Boolean)
          if(en.some(x=>names.includes(x))){ (e2.loggedSets||[]).forEach(ls2=>{ const raw=String(ls2.completedLoad||'').trim(); if(/^x/i.test(raw)) return; const L=_numFrom(raw); if(L!=null&&L>0) cand.push({d:getSessionDate(ss,sessions,weeks,programs)||new Date(0),L,R:_numFrom(ls2.completedReps)}) }) }
        })
      })
      if(cand.length){ cand.sort((a,b)=>b.d-a.d); const d0=cand[0].d; const recent=cand.filter(c=>Math.abs(c.d-d0)<86400000); const top=recent.reduce((m,c)=>c.L>m.L?c:m,recent[0])
        const Rnew=_numFrom(String(ex.reps||'').split('/')[0]); let w=top.L
        if(top.R&&Rnew&&top.R!==Rnew){ const e1=top.L*(1+top.R/30); w=Math.round((e1/(1+Rnew/30))/2.5)*2.5 }
        lastWeightHint=(w%1===0?String(w):String(Number(w.toFixed(1))))
      }
    }
    const chips=[]
    if(ex.tempo) chips.push(['Tempo',ex.tempo])
    if(ex.rest)  chips.push(['Rest',ex.rest])
    if(ex.rpe && !collect.includes('rpe'))  chips.push(['RPE',ex.rpe])
    if(ex.rir && !collect.includes('rir'))  chips.push(['RIR',ex.rir])
    if(ex.load && !collect.includes('load') && !ex.isWarmup) chips.push(['Load',ex.load])
    const noteOpen = noteOpenId===ex.id
    const srcFor = (m) => m==='reps'?ex.reps : m==='time'?(ex.time||ex.reps) : m==='load'?ex.load : m==='rpe'?ex.rpe : m==='rir'?ex.rir : m==='distance'?ex.distance : ''
    const metricRow = (label, metric) => (
      <div key={'r-'+metric} style={{display:'flex',alignItems:'center',gap:6,marginBottom:6}}>
        <span style={{width:58,flexShrink:0,fontSize:10,color:C.faint,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.04em'}}>{label}</span>
        <div style={{flex:1,display:'flex',gap:6}}>
          {sets.map(sn=><ClientBox key={metric+sn} ex={ex} setNum={sn} metric={metric} target={perSetTarget(srcFor(metric),sn-1)} color={(MET[metric]&&MET[metric].color)||sectionCol} hint={(metric==='load'&&sn===1)?lastWeightHint:null}/>) }
        </div>
      </div>
    )
    return (
      <div style={{background:_exDone?`${C.green}0F`:C.ink,borderTop:`1px solid ${C.border}`,padding:'12px 14px',transition:'background .3s'}}>
        <div style={{display:'flex',alignItems:'flex-start',gap:8,marginBottom:10}}>
          <span style={{flex:1,fontSize:14.5,fontWeight:600,color:C.white,lineHeight:1.3}}>{ex.name}</span>
          {_exDone&&<span style={{flexShrink:0,display:'flex',alignItems:'center'}} title="All sets logged"><Icon name="check" size={16} color={C.green}/></span>}
          {ex.videoUrl&&<a href={ex.videoUrl} target="_blank" rel="noreferrer" style={{flexShrink:0,marginTop:1}}><Icon name="play" size={16} color={C.c3}/></a>}
          {ex.notes&&<button onClick={()=>setNoteOpenId(noteOpen?null:ex.id)} style={{flexShrink:0,display:'flex',alignItems:'center',gap:4,background:noteOpen?`${C.amber}1A`:C.card,border:`1px solid ${noteOpen?C.amber:C.border}`,borderRadius:7,padding:'4px 9px',cursor:'pointer',color:noteOpen?C.amber:C.muted,fontSize:11,fontWeight:600}}><Icon name="fileText" size={12} color={noteOpen?C.amber:C.muted}/>Note</button>}
          <button onClick={()=>{setAthleteNoteEx(athleteNoteEx===ex.id?null:ex.id);setAthleteNoteDraft('')}} title="Leave your coach a note" style={{flexShrink:0,display:'flex',alignItems:'center',gap:4,background:athleteNoteEx===ex.id?`${C.c1}22`:C.card,border:`1px solid ${athleteNoteEx===ex.id?C.c2:C.border}`,borderRadius:7,padding:'4px 9px',cursor:'pointer',color:athleteNoteEx===ex.id?C.c3:C.muted,fontSize:11,fontWeight:600}}><Icon name="message" size={12} color={athleteNoteEx===ex.id?C.c3:C.muted}/></button>
        </div>
        {noteOpen&&ex.notes&&<div style={{background:`${C.amber}0D`,border:`1px solid ${C.amber}33`,borderRadius:9,padding:'10px 12px',marginBottom:10,fontSize:13,color:C.white,lineHeight:1.5,fontStyle:'italic'}}>{ex.notes}</div>}
        {athleteNoteEx===ex.id&&(
          <div style={{background:`${C.c1}10`,border:`1px solid ${C.c1}40`,borderRadius:9,padding:'10px 12px',marginBottom:10}}>
            <div style={{fontSize:10,fontWeight:700,color:C.c3,textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:6}}>Note to coach · {ex.name}</div>
            <textarea value={athleteNoteDraft} onChange={e=>setAthleteNoteDraft(e.target.value)} rows={2} placeholder="e.g. felt sharp on left knee, dropped to 60kg…" style={{...iS,resize:'vertical',marginBottom:8}}/>
            <div style={{display:'flex',gap:6}}>
              <Btn label="Send to coach" small onClick={()=>{ if(!athleteNoteDraft.trim())return; addMessage&&addMessage({session_id:sessionId,client_id:clientId,program_id:programId,week_id:sess?.week_id,message:`[${ex.name}] ${athleteNoteDraft.trim()}`}); setAthleteNoteEx(null); setAthleteNoteDraft('') }}/>
              <Btn label="Cancel" variant="secondary" small onClick={()=>{setAthleteNoteEx(null);setAthleteNoteDraft('')}}/>
            </div>
          </div>
        )}
        {metricRow(primaryLabel, primary)}
        {extra.map(([m,lab])=>metricRow(lab, m))}
        {chips.length>0&&(
          <div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:8}}>
            {chips.map(([k,v])=><span key={k} style={{fontSize:10.5,color:C.muted,background:C.card,border:`1px solid ${C.border}`,borderRadius:6,padding:'3px 9px'}}><span style={{color:C.faint}}>{k}</span> {v}</span>)}
          </div>
        )}
      </div>
    )
  }

  if(clientMode){
    const done = computeSessionStatus(sess)==='complete' || sess.status==='completed'
    const cg=[]; let cur=null
    exs.forEach(ex=>{
      const letter=(ex.blockLabel||'').replace(/\d+/g,'').toUpperCase()||(ex.isWarmup?'P':'—')
      if(!cur||cur.letter!==letter){ cur={letter,exs:[]}; cg.push(cur) }
      cur.exs.push(ex)
    })
    return (
      <div style={{padding:'16px 14px 40px',maxWidth:640,margin:'0 auto'}}>
        <div style={{marginBottom:16}}>
          <h1 style={{fontSize:22,fontWeight:700,color:C.white,fontFamily:'Space Grotesk,sans-serif',letterSpacing:'-0.01em'}}>{sess.name}</h1>
          <div style={{display:'flex',alignItems:'center',gap:8,marginTop:5,flexWrap:'wrap'}}>
            {sess.session_type&&<Tag v={sess.session_type} color={C.c2}/>}
            {sess.date_label&&<span style={{fontSize:12,color:C.muted}}>{sess.date_label}</span>}
          </div>
          {sess.notes&&<p style={{fontSize:13,color:C.dim,fontStyle:'italic',marginTop:8,lineHeight:1.45}}>{sess.notes}</p>}
          <div style={{marginTop:12}}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
              <span style={{fontSize:10,color:C.muted,textTransform:'uppercase',letterSpacing:'0.05em'}}>Progress</span>
              <span style={{fontSize:11,fontWeight:700,color:trafficColor(pct)}}>{pct}%</span>
            </div>
            <ProgressBar value={pct}/>
          </div>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:14}}>
          {cg.map((g,gi)=>{
            const col=g.exs[0].labelColor||groupColor(g.exs[0].blockLabel)||C.amber
            const isMulti=g.exs.length>1
            const sectionName=g.exs[0].sectionName||(g.exs[0].isWarmup?'Movement Prep':groupTypeName(g.exs.length))
            return (
              <div key={g.letter+'_'+gi} style={{borderRadius:13,overflow:'hidden',border:`1px solid ${C.border}`,borderLeft:`4px solid ${col}`}}>
                <div style={{display:'flex',alignItems:'center',gap:10,padding:'11px 13px',background:`${col}1A`}}>
                  <span style={{minWidth:30,height:30,borderRadius:8,background:col,color:C.bg,fontWeight:800,fontSize:14,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontFamily:'Space Grotesk,sans-serif'}}>{g.letter}</span>
                  {isMulti&&<Icon name="repeat" size={15} color={col}/>}
                  <span style={{fontSize:14,fontWeight:700,color:C.white,fontFamily:'Space Grotesk,sans-serif',textTransform:'uppercase',letterSpacing:'0.03em'}}>{sectionName}</span>
                </div>
                <div>{g.exs.map(ex=><React.Fragment key={ex.id}>{ClientExRow({ex, sectionCol:col})}</React.Fragment>)}</div>
              </div>
            )
          })}
        </div>
        <button onClick={()=>{ updateSession(sess.id,{status:'completed',completed_at:new Date().toISOString()}); go&&go('client') }}
          style={{marginTop:18,width:'100%',background:done?C.card:C.amber,color:done?C.green:C.bg,border:done?`1px solid ${C.green}55`:'none',padding:'15px 16px',borderRadius:11,fontWeight:700,fontSize:14.5,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8,fontFamily:'Space Grotesk,sans-serif',letterSpacing:'0.03em'}}>
          <Icon name="check" size={17} color={done?C.green:C.bg}/>Finish session
        </button>
        <div style={{marginTop:16}}>
          <SessionMessageBox sessionId={sessionId} clientId={clientId} programId={programId} weekId={sess?.week_id} messages={messages||[]} addMessage={addMessage} replyMessage={replyMessage} markRead={markMsgRead} markActioned={markMsgActioned} editMessage={editMessage} clientMode={true}/>
        </div>
        {historyEx && <ExerciseHistoryModal exerciseName={historyEx} clientId={clientId} sessions={sessions} weeks={weeks} programs={programs} onClose={()=>setHistoryEx(null)}/>}
      </div>
    )
  }

  return (
    <div style={{padding:20,maxWidth:860,margin:'0 auto'}}>
      <Breadcrumb items={[{label:'Clients',onClick:()=>go('clients')},{label:client?.name||'Client',onClick:()=>go('client',{clientId})},{label:prog?.name||'Program',onClick:()=>go('program',{programId,clientId})},{label:week?`Week ${week.week_number}`:''},{label:sess.name}]}/>

      {editSess ? (
        <Panel style={{marginBottom:18}}>
          <h3 style={{color:C.white,marginBottom:12}}>Edit Session</h3>
          <div style={{marginBottom:8}}><TI label="Name" value={sF.name||''} onChange={v=>setSF(p=>({...p,name:v}))}/></div>
          <G2 style={{marginBottom:8}}>
            <SI label="Type" value={sF.session_type||'Strength'} onChange={v=>setSF(p=>({...p,session_type:v}))} options={SESS_TYPES}/>
            <TI label="Date / Label" value={sF.date_label||''} onChange={v=>setSF(p=>({...p,date_label:v}))}/>
          </G2>
          <div style={{marginBottom:12}}><TA label="Coach Note" value={sF.notes||''} onChange={v=>setSF(p=>({...p,notes:v}))} rows={2}/></div>
          <Row><Btn label="Save" loading={saving} onClick={()=>{updateSession(sess.id,sF);setEditSess(false)}}/><Btn label="Cancel" variant="secondary" onClick={()=>setEditSess(false)}/></Row>
        </Panel>
      ) : (
        <Row style={{alignItems:'flex-start',marginBottom:18}}>
          <div style={{flex:1}}>
            <Row style={{alignItems:'center',gap:10,marginBottom:4,flexWrap:'wrap'}}>
              <h1 style={{fontSize:20,fontWeight:700,color:C.white}}>{sess.name}</h1>
              <Tag v={sess.session_type} color={C.c2}/>
              {sess.date_label&&<span style={{fontSize:13,color:C.muted}}>{sess.date_label}</span>}
            </Row>
            {sess.notes&&<p style={{fontSize:13,color:C.dim,fontStyle:'italic'}}>{sess.notes}</p>}
            <div style={{marginTop:8}}>
              <Row style={{justifyContent:'space-between',marginBottom:4}}>
                <span style={{fontSize:11,color:C.muted,textTransform:'uppercase',letterSpacing:'0.05em'}}>Session progress</span>
                <span style={{fontWeight:700,fontSize:11,color:trafficColor(pct)}}>{pct}%</span>
              </Row>
              <ProgressBar value={pct}/>
            </div>
          </div>
          <Row style={{gap:6,alignItems:'center',flexWrap:'wrap'}}>
            <StatusBadge sess={sess}/>
            {computeSessionStatus(sess)!=='complete' && (
              <Btn label="✓ Force Complete" variant="secondary" small
                onClick={()=>updateSession(sess.id,{status:'manual_complete',completed_at:new Date().toISOString()})}/>
            )}
            {computeSessionStatus(sess)==='complete' && (
              <Btn label="↺ Reopen" variant="secondary" small
                onClick={()=>updateSession(sess.id,{status:null,completed_at:null})}/>
            )}
            <Btn label="Edit Session" variant="secondary" small onClick={()=>{setEditSess(true);setSF({name:sess.name,session_type:sess.session_type,date_label:sess.date_label||'',notes:sess.notes||''})}}/>
            <Btn label="⊡ Save Template" variant="ghost" small onClick={()=>{
              const addT=(t)=>{const ts=JSON.parse(localStorage.getItem('cgee_templates')||'[]');ts.push({...t,id:Math.random().toString(36).slice(2),created_at:new Date().toISOString()});localStorage.setItem('cgee_templates',JSON.stringify(ts))}
              const exClean=(safeExercises(sess)||[]).map(e=>({...e,loggedSets:[],force_complete:false}))
              const name=window.prompt('Session template name:',sess.name+' (Template)')
              if(name){addT({type:'session',name,description:sess.session_type||'',tags:'',data:{name:sess.name,session_type:sess.session_type||'',exercises:exClean}});alert('✓ Session template saved — view it under Templates in the sidebar')}
            }}/>
          </Row>
        </Row>
      )}

      {warmups.length>0 && (
        <div style={{marginBottom:16}}>
          <SL small>
            Warm-up / Prep · {warmups.length} exercises
            <span style={{fontSize:9,color:C.faint,fontWeight:400,textTransform:'none',letterSpacing:0,marginLeft:8}}>— reference only</span>
          </SL>
          {warmups.map(ex=>{
            const isEditingWu = editExId===ex.id
            if(isEditingWu) return <React.Fragment key={ex.id}>{ExRow({ex})}</React.Fragment>
            return(
              <div key={ex.id} style={{background:`${C.white}05`,borderRadius:7,padding:'7px 12px',marginBottom:4,border:`1px solid ${C.border}`}}>
                <Row style={{alignItems:'center',gap:8,flexWrap:'wrap'}}>
                  {ex.blockLabel&&<Tag v={ex.blockLabel} color={C.c2} small/>}
                  <span style={{fontSize:12,color:C.white,fontWeight:500}}>{ex.name}</span>
                  {ex.sets&&ex.reps&&<span style={{fontSize:11,color:C.muted}}>{ex.sets}×{ex.reps}</span>}
                  {ex.tempo&&<Tag v={ex.tempo} color={C.muted} small/>}
                  {ex.rest&&<span style={{fontSize:11,color:C.muted}}>{ex.rest}</span>}
                  {ex.notes&&<span style={{fontSize:11,color:C.muted,fontStyle:'italic',flex:1}}>{ex.notes}</span>}
                  <button
                    onClick={()=>{setEditExId(ex.id);setEditExF({name:ex.name,blockLabel:ex.blockLabel||'',sets:ex.sets||'',reps:ex.reps||'',load:ex.load||'',rpe:ex.rpe||'',tempo:ex.tempo||'',rest:ex.rest||'',notes:ex.notes||'',isWarmup:true,sequenceGroup:ex.sequenceGroup||''})}}
                    style={{background:'none',border:`1px solid ${C.border}`,borderRadius:4,padding:'2px 8px',color:C.muted,cursor:'pointer',fontSize:10,marginLeft:'auto',flexShrink:0}}>
                    edit
                  </button>
                </Row>
              </div>
            )
          })}
        </div>
      )}

      <SL right={!addingEx&&<Btn label="+ Add Exercise" small onClick={()=>{setAddingEx(true);setEF(BLANK_EX);setExSearch('')}}/>}>
        Exercises ({mainEx.length})
      </SL>

      {addingEx && (
        <Panel style={{marginBottom:14}}>
          <h4 style={{color:C.white,marginBottom:10}}>Add Exercise</h4>
          <div style={{marginBottom:8}}><TI label="Search Library" value={exSearch} onChange={setExSearch} placeholder="Search by name or pattern…"/></div>
          {exSearch && (
            <div style={{background:C.ink,borderRadius:8,border:`1px solid ${C.border}`,maxHeight:130,overflowY:'auto',marginBottom:8}}>
              {filtLib.slice(0,8).map(e=>(
                <div key={e.id} onClick={()=>{setEF(p=>({...p,name:e.name}));setExSearch(e.name)}} style={{padding:'7px 12px',cursor:'pointer',borderBottom:`1px solid ${C.border}`,display:'flex',alignItems:'center',gap:8,background:eF.name===e.name?`${C.amber}18`:'transparent'}}>
                  <span style={{flex:1,fontSize:12,color:eF.name===e.name?C.amber:C.white}}>{e.name}</span>
                  <Tag v={e.pattern} color={PC[e.pattern]||C.c2} small/>
                </div>
              ))}
              {filtLib.length===0&&<div style={{padding:10,fontSize:12,color:C.muted}}>No results</div>}
            </div>
          )}
          <G2 style={{marginBottom:8}}>
            <TI label="Exercise Name *" value={eF.name} onChange={v=>setEF(p=>({...p,name:v}))} placeholder="Exercise name"/>
            <TI label="Block Label" value={eF.blockLabel} onChange={v=>setEF(p=>({...p,blockLabel:v}))} placeholder="A1, B2, F3…"/>
          </G2>
          <TargetTable form={eF} setForm={setEF}/>
          <G2 style={{marginBottom:8}}>
            <TI label="Rest"  value={eF.rest}  onChange={v=>setEF(p=>({...p,rest:v}))}  placeholder="90s"/>
            <TI label="Tempo" value={eF.tempo} onChange={v=>setEF(p=>({...p,tempo:v}))} placeholder="3010"/>
          </G2>
          <div style={{marginBottom:8}}>
            <label style={lS}>Collect from athlete</label>
            <div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:4}}>
              {[['reps','Reps Completed'],['rir','Reps In Reserve'],['load','Weight Completed'],['rpe','RPE'],['time','Time'],['speed','Speed'],['rpm','RPM'],['distance','Distance Completed'],['power','Power'],['energy','Energy'],['hr','Heart Rate'],['vas','VAS Pain Score'],['band','Band Colour']].map(([k,lab])=>{
                const on=(eF.collect||[]).includes(k)
                return <button key={k} type="button" onClick={()=>setEF(p=>{const c=new Set(p.collect||[]); c.has(k)?c.delete(k):c.add(k); return {...p,collect:[...c]}})} style={{fontSize:11,fontWeight:600,padding:'5px 11px',borderRadius:20,cursor:'pointer',border:`1px solid ${on?C.amber:C.border}`,background:on?`${C.amber}1A`:'transparent',color:on?C.amber:C.muted}}>{on?'\u2713 ':''}{lab}</button>
              })}
            </div>
            <div style={{fontSize:10,color:C.faint,marginTop:5,lineHeight:1.4}}>Selected = athlete logs it (a box per set). Unselected targets show read-only.</div>
          </div>
          <div style={{marginBottom:8}}>
            <label style={lS}>Measure reps on each side? (L + R)</label>
            <select value={eF.perSide||'default'} onChange={e=>setEF(p=>({...p,perSide:e.target.value}))} style={{...iS,cursor:'pointer'}}>
              <option value="default">Auto — detect from exercise name</option>
              <option value="yes">Yes — show as (L + R)</option>
              <option value="no">No — single side</option>
            </select>
          </div>
          <div style={{marginBottom:8}}><TA label="Coach Note" value={eF.notes} onChange={v=>setEF(p=>({...p,notes:v}))} rows={2}/></div>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
            <input type="checkbox" id="wu_new" checked={eF.isWarmup} onChange={e=>setEF(p=>({...p,isWarmup:e.target.checked}))} style={{accentColor:C.amber,cursor:'pointer'}}/>
            <label htmlFor="wu_new" style={{fontSize:12,color:C.muted,cursor:'pointer'}}>Warm-up / prep exercise</label>
          </div>
          <Row><Btn label="Add Exercise" onClick={addEx} disabled={!eF.name.trim()}/><Btn label="Cancel" variant="secondary" onClick={()=>setAddingEx(false)}/></Row>
        </Panel>
      )}

      {mainEx.length===0&&!addingEx && (
        <Card style={{textAlign:'center',padding:24}}><p style={{color:C.muted,marginBottom:10}}>No exercises yet.</p><Btn label="+ Add Exercise" small onClick={()=>setAddingEx(true)}/></Card>
      )}

      {/* Exercise list — collapsible colour-coded groups */}
      {mainEx.length>0&&(()=>{
        const groups = []; let cur = null
        mainEx.forEach(ex=>{
          const letter = (ex.blockLabel||'').replace(/\d+/g,'').toUpperCase() || '—'
          if(!cur||cur.letter!==letter){ cur={letter,exs:[]}; groups.push(cur) }
          cur.exs.push(ex)
        })
        const PALETTE = ['#FFA500','#3B82F6','#22C55E','#A855F7','#EC4899','#EF4444','#06B6D4','#F97316','#FACC15','#14B8A6']
        return (
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {groups.map((g,gi)=>{
              const key = g.letter+'_'+gi
              const col = g.exs[0].labelColor || groupColor(g.exs[0].blockLabel)
              const collapsed = !!collapsedGroups[key]
              const ids = new Set(g.exs.map(e=>e.id))
              return (
                <div key={key} style={{borderRadius:12,overflow:'hidden',border:`1px solid ${C.border}`}}>
                  <div style={{display:'flex',alignItems:'center',gap:9,padding:'9px 12px',background:C.midnight}}>
                    <span style={{minWidth:24,height:24,borderRadius:7,background:`${col}22`,border:`1px solid ${col}`,color:col,fontWeight:700,fontSize:12,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{g.letter}</span>
                    {editSectionKey===key ? (
                      <div style={{display:'flex',alignItems:'center',gap:5,flex:1}}>
                        <input autoFocus value={sectionDraft} onChange={e=>setSectionDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){renameSection(g.letter,sectionDraft.trim());setEditSectionKey(null)} if(e.key==='Escape')setEditSectionKey(null)}} placeholder={groupTypeName(g.exs.length)} style={{...iS,padding:'4px 8px',fontSize:13,maxWidth:220}}/>
                        <button onClick={()=>{renameSection(g.letter,sectionDraft.trim());setEditSectionKey(null)}} style={{background:C.amber,border:'none',borderRadius:5,color:C.bg,fontSize:11,fontWeight:700,cursor:'pointer',padding:'4px 10px',flexShrink:0}}>Save</button>
                        <button onClick={()=>setEditSectionKey(null)} style={{background:'none',border:`1px solid ${C.border}`,borderRadius:5,color:C.faint,fontSize:11,cursor:'pointer',padding:'4px 8px',flexShrink:0}}>✕</button>
                      </div>
                    ) : (
                      <span onClick={()=>{setEditSectionKey(key);setSectionDraft(g.exs[0].sectionName||'')}} title="Rename section (applies across the program)" style={{fontSize:13,fontWeight:700,color:C.white,fontFamily:'Space Grotesk,sans-serif',cursor:'pointer',display:'flex',alignItems:'center',gap:6}}>
                        {g.exs[0].sectionName||groupTypeName(g.exs.length)}
                        <span style={{fontSize:9,color:C.faint,fontWeight:400}}>edit</span>
                      </span>
                    )}
                    <span style={{fontSize:10,color:C.faint,border:`1px solid ${C.border}`,borderRadius:20,padding:'1px 8px'}}>{g.exs.length} item{g.exs.length!==1?'s':''}</span>
                    <div style={{flex:1}}/>
                    <button onClick={()=>setColorPickerGroup(colorPickerGroup===key?null:key)} title="Group colour" style={{width:18,height:18,borderRadius:'50%',background:col,border:`2px solid ${colorPickerGroup===key?C.white:'transparent'}`,cursor:'pointer',flexShrink:0,padding:0}}/>
                    <button onClick={()=>setCollapsedGroups(p=>({...p,[key]:!p[key]}))} style={{background:'none',border:'none',color:C.faint,cursor:'pointer',fontSize:13,padding:'2px 4px',transform:collapsed?'none':'rotate(180deg)',transition:'transform 0.15s'}}>⌄</button>
                  </div>
                  {colorPickerGroup===key&&(
                    <div style={{display:'flex',gap:7,flexWrap:'wrap',alignItems:'center',padding:'10px 12px',background:C.ink,borderTop:`1px solid ${C.border}`}}>
                      <span style={{fontSize:10,color:C.faint,marginRight:2}}>Group colour (applies to all of {g.letter})</span>
                      {PALETTE.map(c=>(
                        <div key={c} onClick={()=>applyGroupColor(ids,c)} style={{width:20,height:20,borderRadius:'50%',background:c,cursor:'pointer',border:`2px solid ${col===c?C.white:'transparent'}`,flexShrink:0}}/>
                      ))}
                      <button onClick={()=>applyGroupColor(ids,'')} style={{background:'none',border:`1px solid ${C.border}`,borderRadius:4,color:C.faint,fontSize:10,cursor:'pointer',padding:'2px 7px'}}>reset</button>
                    </div>
                  )}
                  {!collapsed&&<div>{g.exs.map(ex=><React.Fragment key={ex.id}>{ExRow({ex})}</React.Fragment>)}</div>}
                </div>
              )
            })}
          </div>
        )
      })()}
      <SessionMessageBox sessionId={sessionId} clientId={clientId} programId={programId} weekId={sess?.week_id} messages={messages||[]} addMessage={addMessage} replyMessage={replyMessage} markRead={markMsgRead} markActioned={markMsgActioned}/>
      {historyEx && <ExerciseHistoryModal exerciseName={historyEx} clientId={clientId} sessions={sessions} weeks={weeks} programs={programs} onClose={()=>setHistoryEx(null)}/>}
    </div>
  )
}


// ─── TEMPLATES (localStorage) ────────────────────────────────────────────────
function useTemplates() {
  const KEY = 'cgee_templates'
  const [templates, setTemplates] = React.useState(()=>{
    try{ return JSON.parse(localStorage.getItem(KEY)||'[]') } catch{ return [] }
  })
  const persist = ts => { localStorage.setItem(KEY, JSON.stringify(ts)); setTemplates(ts) }
  const addTemplate    = t  => persist([...templates, {...t, id:uid(), created_at:new Date().toISOString()}])
  const deleteTemplate = id => persist(templates.filter(t=>t.id!==id))
  const updateTemplate = (id,d) => persist(templates.map(t=>t.id===id?{...t,...d}:t))
  return { templates, addTemplate, deleteTemplate, updateTemplate }
}

const TEMPLATE_TYPES = [
  {id:'program',   label:'Program Templates', icon:'▦', desc:'Full program structures with weeks, sessions, and exercise prescriptions'},
  {id:'session',   label:'Session Templates',  icon:'◈', desc:'Reusable session layouts with exercise blocks and set/rep schemes'},
  {id:'rep_scheme',label:'Rep Schemes',        icon:'◆', desc:'Named set/rep schemes — quick-apply to any exercise prescription'},
  {id:'label',     label:'Session Labels',     icon:'◧', desc:'Custom session categories and labels (Upper Body, Lower Body, Speed, etc.)'},
]
const LABEL_COLORS = ['#FFA500','#2563EB','#22C55E','#8B5CF6','#EC4899','#EF4444','#14B8A6','#F97316','#FACC15']

function TemplatesView({ sessions, programs, weeks, clients, addProgram, addWeek, addSession, go, initialTab }) {
  const { templates, addTemplate, deleteTemplate, updateTemplate } = useTemplates()
  const [tab,    setTab]    = useState(initialTab||'program')
  const [useT,   setUseT]   = useState(null)     // program template being applied
  const [addingScheme, setAddingScheme] = useState(false)
  const [addingLabel,  setAddingLabel]  = useState(false)
  const [applyF, setApplyF] = useState({clientId:'',name:''})
  const [schemeF,setSchemeF]= useState({name:'',sets:'4',reps:'6-8',rpe:'7-8',rir:'',rest:'90s',tempo:'',notes:''})
  const [labelF, setLabelF] = useState({name:'',color:LABEL_COLORS[0],description:''})
  const [saving, setSaving] = useState(false)
  const [expandedId, setExpandedId] = useState(null)
  const filtered = templates.filter(t=>t.type===tab)
  const TYPE_INFO = {
    program:   {icon:'▦', color:C.amber},
    session:   {icon:'◈', color:C.c2},
    rep_scheme:{icon:'◆', color:C.c3},
    label:     {icon:'◧', color:C.purple},
  }

  const applyProgramTemplate = async () => {
    if(!applyF.clientId||!applyF.name.trim()||!useT) return
    setSaving(true)
    const prog = await addProgram({client_id:applyF.clientId,name:applyF.name,phase:useT.data.phase||'',goal:useT.data.goal||'',status:'draft',notes:useT.data.goal||''})
    if(prog?.id){
      for(const wk of useT.data.weeks||[]){
        const w = await addWeek({program_id:prog.id,week_number:wk.week_number,phase:wk.phase||'',notes:wk.notes||''})
        if(w?.id) for(const sess of wk.sessions||[]) await addSession({program_id:prog.id,week_id:w.id,name:sess.name,session_type:sess.session_type||'',exercises:sess.exercises||[],sort_order:sess.sort_order||0})
      }
      setUseT(null); setApplyF({clientId:'',name:''}); go('program',{programId:prog.id,clientId:applyF.clientId})
    }
    setSaving(false)
  }

  const saveScheme = () => {
    if(!schemeF.name.trim()) return
    addTemplate({type:'rep_scheme', name:schemeF.name, data:{...schemeF}})
    setAddingScheme(false); setSchemeF({name:'',sets:'4',reps:'6-8',rpe:'7-8',rir:'',rest:'90s',tempo:'',notes:''})
  }

  const saveLabel = () => {
    if(!labelF.name.trim()) return
    addTemplate({type:'label', name:labelF.name, data:{color:labelF.color,description:labelF.description}})
    setAddingLabel(false); setLabelF({name:'',color:LABEL_COLORS[0],description:''})
  }

  return(
    <div style={{padding:20,maxWidth:960,margin:'0 auto'}}>
      <h1 style={{fontSize:22,fontWeight:700,color:C.white,fontFamily:'Space Grotesk,sans-serif',marginBottom:4}}>TEMPLATES</h1>
      <p style={{fontSize:13,color:C.muted,marginBottom:20}}>Save and reuse program structures, sessions, rep schemes, and labels.</p>

      {/* Apply program template modal */}
      {useT&&(
        <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(4,7,15,0.88)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:50,padding:20}}>
          <Card style={{maxWidth:500,width:'100%',padding:24}}>
            <h3 style={{color:C.white,marginBottom:2}}>Apply: {useT.name}</h3>
            <p style={{fontSize:12,color:C.muted,marginBottom:14}}>
              {useT.data?.weeks?.length||0} weeks · {useT.data?.weeks?.flatMap(w=>w.sessions||[]).length||0} sessions · {useT.data?.weeks?.flatMap(w=>w.sessions||[]).flatMap(s=>(s.exercises||[]).filter(e=>!e.isWarmup)).length||0} exercises
            </p>
            <div style={{marginBottom:10}}><SI label="Athlete *" value={applyF.clientId} onChange={v=>setApplyF(p=>({...p,clientId:v}))} options={[{v:'',l:'— Select Athlete —'},...clients.filter(c=>c.status==='active').map(c=>({v:c.id,l:c.name}))]}/></div>
            <div style={{marginBottom:16}}><TI label="Program Name *" value={applyF.name} onChange={v=>setApplyF(p=>({...p,name:v}))} placeholder={useT.name}/></div>
            {useT.data?.goal&&<div style={{fontSize:12,color:C.muted,marginBottom:14}}>Goal: {useT.data.goal}</div>}
            <Row><Btn label="Create Program" onClick={applyProgramTemplate} loading={saving} disabled={!applyF.clientId||!applyF.name.trim()}/><Btn label="Cancel" variant="secondary" onClick={()=>{setUseT(null);setApplyF({clientId:'',name:''})}}/></Row>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <div style={{display:'flex',gap:0,marginBottom:20,borderBottom:`1px solid ${C.border}`,overflowX:'auto'}}>
        {TEMPLATE_TYPES.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            style={{padding:'8px 18px',border:'none',borderBottom:`2px solid ${tab===t.id?C.amber:'transparent'}`,background:'transparent',color:tab===t.id?C.amber:C.muted,fontSize:13,fontWeight:600,cursor:'pointer',whiteSpace:'nowrap',flexShrink:0}}>
            {t.icon} {t.label}
            <span style={{fontSize:10,color:C.faint,marginLeft:5}}>({templates.filter(x=>x.type===t.id).length})</span>
          </button>
        ))}
      </div>

      {/* ── PROGRAM TEMPLATES ───────────────────────── */}
      {tab==='program'&&(<>
        <div style={{background:`${C.c1}0d`,border:`1px solid ${C.c1}30`,borderRadius:8,padding:'10px 14px',marginBottom:16}}>
          <span style={{fontSize:12,color:C.c3}}>Open any program and use the <strong>Save as Template</strong> button to save its structure here.</span>
        </div>
        {filtered.length===0
          ?<Card style={{textAlign:'center',padding:40}}>
            <div style={{fontSize:32,marginBottom:8}}>▦</div>
            <p style={{color:C.muted,marginBottom:4}}>No program templates yet.</p>
            <p style={{fontSize:12,color:C.faint}}>Open a program and click "Save as Template" to get started.</p>
          </Card>
          :<div style={{display:'flex',flexDirection:'column',gap:8}}>
            {filtered.map(t=>{
              const wks=t.data?.weeks||[], sessAll=wks.flatMap(w=>w.sessions||[]), exAll=sessAll.flatMap(s=>(s.exercises||[]).filter(e=>!e.isWarmup))
              const isExpanded = expandedId===t.id
              return(
                <Card key={t.id} style={{padding:'14px 16px'}}>
                  <Row style={{alignItems:'flex-start',gap:12}}>
                    <div style={{width:36,height:36,borderRadius:8,background:`${C.amber}20`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,color:C.amber,flexShrink:0}}>▦</div>
                    <div style={{flex:1,minWidth:0}}>
                      <Row style={{alignItems:'center',gap:8,marginBottom:3,flexWrap:'wrap'}}>
                        <span style={{fontWeight:700,color:C.white,fontSize:14}}>{t.name}</span>
                        {t.data?.phase&&<Tag v={t.data.phase} color={C.amber} small/>}
                      </Row>
                      {t.description&&<p style={{fontSize:12,color:C.muted,marginBottom:4}}>{t.description}</p>}
                      <Row style={{gap:10,flexWrap:'wrap',marginBottom:4}}>
                        <span style={{fontSize:11,color:C.faint}}>{wks.length} week{wks.length!==1?'s':''}</span>
                        <span style={{fontSize:11,color:C.faint}}>{sessAll.length} sessions</span>
                        <span style={{fontSize:11,color:C.faint}}>{exAll.length} exercises</span>
                        <span style={{fontSize:10,color:C.faint}}>Saved {new Date(t.created_at).toLocaleDateString('en-AU',{day:'numeric',month:'short'})}</span>
                      </Row>
                      {/* Expandable week/session breakdown */}
                      <button onClick={()=>setExpandedId(isExpanded?null:t.id)}
                        style={{background:'none',border:'none',color:C.faint,fontSize:11,cursor:'pointer',padding:0}}>
                        {isExpanded?'▲ Hide structure':'▼ Show structure'}
                      </button>
                      {isExpanded&&(
                        <div style={{marginTop:8,display:'flex',flexDirection:'column',gap:4}}>
                          {wks.map((wk,wi)=>(
                            <div key={wi} style={{background:C.ink,borderRadius:6,padding:'6px 10px'}}>
                              <div style={{fontSize:11,fontWeight:700,color:C.amber,marginBottom:3}}>Week {wk.week_number}{wk.phase?` · ${wk.phase}`:''}</div>
                              {(wk.sessions||[]).map((sess,si)=>(
                                <div key={si} style={{fontSize:11,color:C.muted,marginLeft:8,marginBottom:1}}>
                                  <span style={{color:C.white}}>{sess.name}</span>
                                  {sess.session_type&&<span style={{color:C.faint}}> · {sess.session_type}</span>}
                                  <span style={{color:C.faint}}> · {(sess.exercises||[]).filter(e=>!e.isWarmup).length} ex</span>
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <Row style={{gap:5,flexShrink:0}}>
                      <Btn label="Use Template" small onClick={()=>{setUseT(t);setApplyF({clientId:'',name:t.name})}}/>
                      <Btn label="✕" variant="danger" small onClick={()=>{if(window.confirm('Delete template?'))deleteTemplate(t.id)}}/>
                    </Row>
                  </Row>
                </Card>
              )
            })}
          </div>
        }
      </>)}

      {/* ── SESSION TEMPLATES ───────────────────────── */}
      {tab==='session'&&(<>
        <div style={{background:`${C.c1}0d`,border:`1px solid ${C.c1}30`,borderRadius:8,padding:'10px 14px',marginBottom:16}}>
          <span style={{fontSize:12,color:C.c3}}>Open any session and use <strong>Save as Session Template</strong> to save its exercise structure here.</span>
        </div>
        {filtered.length===0
          ?<Card style={{textAlign:'center',padding:40}}>
            <div style={{fontSize:32,marginBottom:8}}>◈</div>
            <p style={{color:C.muted,marginBottom:4}}>No session templates yet.</p>
            <p style={{fontSize:12,color:C.faint}}>Open a session and click "Save as Session Template".</p>
          </Card>
          :<div style={{display:'flex',flexDirection:'column',gap:8}}>
            {filtered.map(t=>{
              const exs=(t.data?.exercises||[]).filter(e=>!e.isWarmup)
              const isExpanded=expandedId===t.id
              return(
                <Card key={t.id} style={{padding:'14px 16px'}}>
                  <Row style={{alignItems:'flex-start',gap:12}}>
                    <div style={{width:36,height:36,borderRadius:8,background:`${C.c2}20`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,color:C.c2,flexShrink:0}}>◈</div>
                    <div style={{flex:1,minWidth:0}}>
                      <Row style={{alignItems:'center',gap:8,marginBottom:3,flexWrap:'wrap'}}>
                        <span style={{fontWeight:700,color:C.white,fontSize:14}}>{t.name}</span>
                        {t.data?.session_type&&<Tag v={t.data.session_type} color={C.c2} small/>}
                        {t.data?.focus&&<Tag v={t.data.focus} color={C.c3} small/>}
                      </Row>
                      {t.description&&<p style={{fontSize:12,color:C.muted,marginBottom:4}}>{t.description}</p>}
                      <Row style={{gap:10,flexWrap:'wrap',marginBottom:4}}>
                        <span style={{fontSize:11,color:C.faint}}>{exs.length} exercise{exs.length!==1?'s':''}</span>
                        <span style={{fontSize:10,color:C.faint}}>Saved {new Date(t.created_at).toLocaleDateString('en-AU',{day:'numeric',month:'short'})}</span>
                      </Row>
                      <button onClick={()=>setExpandedId(isExpanded?null:t.id)}
                        style={{background:'none',border:'none',color:C.faint,fontSize:11,cursor:'pointer',padding:0}}>
                        {isExpanded?'▲ Hide exercises':'▼ Show exercises'}
                      </button>
                      {isExpanded&&(
                        <div style={{marginTop:8,display:'flex',flexDirection:'column',gap:3}}>
                          {exs.map((ex,i)=>(
                            <div key={i} style={{background:C.ink,borderRadius:6,padding:'5px 10px',display:'flex',alignItems:'center',gap:8}}>
                              <span style={{fontSize:10,color:C.amber,fontWeight:700,minWidth:20}}>{ex.blockLabel||String.fromCharCode(65+i)}</span>
                              <span style={{fontSize:12,color:C.white,fontWeight:500,flex:1}}>{ex.name}</span>
                              <span style={{fontSize:11,color:C.muted}}>{ex.targetSets&&ex.targetReps?`${ex.targetSets}×${ex.targetReps}`:''}</span>
                              {ex.targetRpe&&<span style={{fontSize:10,color:C.faint}}>RPE {ex.targetRpe}</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <Btn label="✕" variant="danger" small onClick={()=>{if(window.confirm('Delete template?'))deleteTemplate(t.id)}}/>
                  </Row>
                </Card>
              )
            })}
          </div>
        }
      </>)}

      {/* ── REP SCHEMES ─────────────────────────────── */}
      {tab==='rep_scheme'&&(<>
        <Row style={{justifyContent:'flex-end',marginBottom:12}}>
          {!addingScheme&&<Btn label="+ New Rep Scheme" onClick={()=>setAddingScheme(true)}/>}
        </Row>
        {addingScheme&&(
          <Panel style={{marginBottom:16}}>
            <h3 style={{color:C.white,marginBottom:12}}>New Rep Scheme</h3>
            <div style={{marginBottom:10}}><TI label="Name *" value={schemeF.name} onChange={v=>setSchemeF(p=>({...p,name:v}))} placeholder="e.g. Strength Block, Hypertrophy A"/></div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:10}}>
              <TI label="Sets" value={schemeF.sets} onChange={v=>setSchemeF(p=>({...p,sets:v}))} placeholder="4"/>
              <TI label="Reps / Rep Range" value={schemeF.reps} onChange={v=>setSchemeF(p=>({...p,reps:v}))} placeholder="6-8"/>
              <TI label="RPE Target" value={schemeF.rpe} onChange={v=>setSchemeF(p=>({...p,rpe:v}))} placeholder="7-8"/>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:10}}>
              <TI label="RIR" value={schemeF.rir} onChange={v=>setSchemeF(p=>({...p,rir:v}))} placeholder="2-3"/>
              <TI label="Rest" value={schemeF.rest} onChange={v=>setSchemeF(p=>({...p,rest:v}))} placeholder="90s"/>
              <TI label="Tempo" value={schemeF.tempo} onChange={v=>setSchemeF(p=>({...p,tempo:v}))} placeholder="3-1-1-0"/>
            </div>
            <div style={{marginBottom:12}}><TA label="Progression Notes" value={schemeF.notes} onChange={v=>setSchemeF(p=>({...p,notes:v}))} rows={2} placeholder={'e.g. Add 2.5kg when RPE <8 on all sets'}/></div>
            <Row><Btn label="Save Scheme" onClick={saveScheme} disabled={!schemeF.name.trim()}/><Btn label="Cancel" variant="secondary" onClick={()=>setAddingScheme(false)}/></Row>
          </Panel>
        )}
        {/* Preset schemes for quick start */}
        {filtered.length===0&&!addingScheme&&(
          <div style={{marginBottom:16}}>
            <div style={{fontSize:11,color:C.faint,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:8}}>Quick-add presets</div>
            <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
              {[
                {name:'Linear Strength',    sets:'5',reps:'3-5',rpe:'8-9',rest:'3 min',notes:'Add 2.5kg each session when RPE <8'},
                {name:'Hypertrophy',        sets:'4',reps:'8-12',rpe:'7-8',rest:'90s',notes:'Increase load when top of rep range at target RPE'},
                {name:'Wave Loading',       sets:'6',reps:'6,4,2,6,4,2',rpe:'7,8,9,8,9,10',rest:'3 min',notes:'Wave 1 lighter, wave 2 heavier'},
                {name:'AMRAP Top Set',      sets:'1',reps:'AMRAP',rpe:'9+',rest:'5 min',notes:'Record reps, aim to beat next session'},
                {name:'Back-off Sets',      sets:'3',reps:'8',rpe:'6-7',rest:'2 min',notes:'Reduce load 10-15% from top set'},
              ].map(preset=>(
                <button key={preset.name} onClick={()=>{addTemplate({type:'rep_scheme',name:preset.name,data:preset})}}
                  style={{background:`${C.c3}12`,border:`1px solid ${C.c3}30`,borderRadius:20,padding:'5px 14px',color:C.c3,fontSize:11,cursor:'pointer',fontWeight:600}}>
                  + {preset.name}
                </button>
              ))}
            </div>
          </div>
        )}
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {filtered.map(t=>(
            <Card key={t.id} style={{padding:'12px 16px'}}>
              <Row style={{alignItems:'flex-start',gap:12}}>
                <div style={{width:36,height:36,borderRadius:8,background:`${C.c3}20`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,color:C.c3,flexShrink:0}}>◆</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:700,color:C.white,fontSize:14,marginBottom:6}}>{t.name}</div>
                  <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:t.data?.notes?6:0}}>
                    {t.data?.sets&&<span style={{fontSize:11,background:`${C.white}08`,border:`1px solid ${C.border}`,borderRadius:5,padding:'2px 8px',color:C.white}}>{t.data.sets} sets</span>}
                    {t.data?.reps&&<span style={{fontSize:11,background:`${C.white}08`,border:`1px solid ${C.border}`,borderRadius:5,padding:'2px 8px',color:C.white}}>{t.data.reps} reps</span>}
                    {t.data?.rpe&&<span style={{fontSize:11,background:`${C.amber}12`,border:`1px solid ${C.amber}30`,borderRadius:5,padding:'2px 8px',color:C.amber}}>RPE {t.data.rpe}</span>}
                    {t.data?.rir&&<span style={{fontSize:11,background:`${C.white}08`,border:`1px solid ${C.border}`,borderRadius:5,padding:'2px 8px',color:C.muted}}>RIR {t.data.rir}</span>}
                    {t.data?.rest&&<span style={{fontSize:11,background:`${C.white}08`,border:`1px solid ${C.border}`,borderRadius:5,padding:'2px 8px',color:C.muted}}>Rest {t.data.rest}</span>}
                    {t.data?.tempo&&<span style={{fontSize:11,background:`${C.white}08`,border:`1px solid ${C.border}`,borderRadius:5,padding:'2px 8px',color:C.muted}}>{t.data.tempo}</span>}
                  </div>
                  {t.data?.notes&&<div style={{fontSize:11,color:C.muted,fontStyle:'italic'}}>{t.data.notes}</div>}
                </div>
                <Btn label="✕" variant="danger" small onClick={()=>{if(window.confirm('Delete?'))deleteTemplate(t.id)}}/>
              </Row>
            </Card>
          ))}
        </div>
        {filtered.length===0&&!addingScheme&&<Card style={{textAlign:'center',padding:32}}><p style={{color:C.muted}}>No rep schemes saved yet. Use the presets above or create your own.</p></Card>}
      </>)}

      {/* ── SESSION LABELS ───────────────────────────── */}
      {tab==='label'&&(<>
        <Row style={{justifyContent:'flex-end',marginBottom:12}}>
          {!addingLabel&&<Btn label="+ New Label" onClick={()=>setAddingLabel(true)}/>}
        </Row>
        {addingLabel&&(
          <Panel style={{marginBottom:16}}>
            <h3 style={{color:C.white,marginBottom:12}}>New Session Label</h3>
            <G2 style={{marginBottom:10}}>
              <TI label="Label Name *" value={labelF.name} onChange={v=>setLabelF(p=>({...p,name:v}))} placeholder="e.g. Upper Push, Lower Hinge, Speed"/>
              <TI label="Description" value={labelF.description} onChange={v=>setLabelF(p=>({...p,description:v}))} placeholder="Optional description"/>
            </G2>
            <div style={{marginBottom:14}}>
              <label style={lS}>Colour</label>
              <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:4}}>
                {LABEL_COLORS.map(col=>(
                  <button key={col} onClick={()=>setLabelF(p=>({...p,color:col}))}
                    style={{width:28,height:28,borderRadius:'50%',background:col,border:`2px solid ${labelF.color===col?C.white:'transparent'}`,cursor:'pointer',transition:'border-color 0.1s'}}/>
                ))}
              </div>
            </div>
            <Row><Btn label="Save Label" onClick={saveLabel} disabled={!labelF.name.trim()}/><Btn label="Cancel" variant="secondary" onClick={()=>setAddingLabel(false)}/></Row>
          </Panel>
        )}
        {/* Presets */}
        {filtered.length===0&&!addingLabel&&(
          <div style={{marginBottom:16}}>
            <div style={{fontSize:11,color:C.faint,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:8}}>Quick-add common labels</div>
            <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
              {[
                {name:'Upper Push',     color:'#2563EB',description:'Horizontal and vertical push'},
                {name:'Upper Pull',     color:'#3B82F6',description:'Horizontal and vertical pull'},
                {name:'Lower — Knee',   color:'#FFA500',description:'Knee dominant lower body'},
                {name:'Lower — Hip',    color:'#F97316',description:'Hip dominant lower body'},
                {name:'Full Body',      color:'#22C55E',description:''},
                {name:'Conditioning',   color:'#EF4444',description:''},
                {name:'Power / Speed',  color:'#FACC15',description:''},
                {name:'Rehab',          color:'#8B5CF6',description:''},
              ].map(preset=>(
                <button key={preset.name} onClick={()=>addTemplate({type:'label',name:preset.name,data:{color:preset.color,description:preset.description}})}
                  style={{background:`${preset.color}15`,border:`1px solid ${preset.color}40`,borderRadius:20,padding:'5px 14px',color:preset.color,fontSize:11,cursor:'pointer',fontWeight:600}}>
                  + {preset.name}
                </button>
              ))}
            </div>
          </div>
        )}
        <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
          {filtered.map(t=>(
            <div key={t.id} style={{background:`${t.data?.color||C.amber}15`,border:`1px solid ${t.data?.color||C.amber}40`,borderRadius:10,padding:'10px 14px',display:'flex',alignItems:'center',gap:10,minWidth:140}}>
              <div style={{width:10,height:10,borderRadius:'50%',background:t.data?.color||C.amber,flexShrink:0}}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:700,color:C.white,fontSize:13}}>{t.name}</div>
                {t.data?.description&&<div style={{fontSize:10,color:C.faint}}>{t.data.description}</div>}
              </div>
              <button onClick={()=>{if(window.confirm('Delete?'))deleteTemplate(t.id)}} style={{background:'none',border:'none',color:C.faint,cursor:'pointer',fontSize:12}}>✕</button>
            </div>
          ))}
          {filtered.length===0&&!addingLabel&&<div style={{width:'100%'}}><Card style={{textAlign:'center',padding:32}}><p style={{color:C.muted}}>No labels yet. Use the presets above to get started quickly.</p></Card></div>}
        </div>
      </>)}
    </div>
  )
}

// ─── CALENDAR ─────────────────────────────────────────────────────────────────
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const WDAYS  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

// Client colour palette — consistent per client index
const CPAL = ['#FFA500','#3B82F6','#22C55E','#8B5CF6','#EC4899','#EF4444','#14B8A6','#F97316','#FACC15','#06B6D4','#A855F7','#84CC16']
const clientPalette = (clients, clientId) => {
  const idx = clients.findIndex(c => c.id === clientId)
  return CPAL[Math.abs(idx < 0 ? 0 : idx) % CPAL.length]
}

const EV_COLORS = {testing:C.amber,competition:C.gold,assessment:C.c2,team_meeting:C.green,camp:C.purple,other:C.muted}

function CalendarView({ sessions, weeks, programs, clients, go, token, isClientView=false }) {
  const [yr,  setYr]  = useState(()=>new Date().getFullYear())
  const [mon, setMon] = useState(()=>new Date().getMonth())
  const [clientFilter, setClientFilter] = useState('')
  const [clientSearch, setClientSearch] = useState('')
  const [showPicker,   setShowPicker]   = useState(false)
  const [coachEvents,  setCoachEvents]  = useState([])

  // Load coach events (coach view only)
  useEffect(()=>{
    if(isClientView||!token) return
    sb.get('coach_events','select=*&order=event_date.asc',token)
      .then(r=>setCoachEvents(Array.isArray(r)?r:[]))
      .catch(()=>{})
  },[])

  const prevMonth = ()=>{ if(mon===0){setMon(11);setYr(y=>y-1)}else setMon(m=>m-1) }
  const nextMonth = ()=>{ if(mon===11){setMon(0);setYr(y=>y+1)}else setMon(m=>m+1) }
  const goToday   = ()=>{ const n=new Date(); setYr(n.getFullYear()); setMon(n.getMonth()) }

  // Which sessions to show
  const displaySess = isClientView ? sessions : (clientFilter ? sessions.filter(s=>s.client_id===clientFilter) : [])

  // Date → sessions map
  const dateMap = {}
  displaySess.forEach(sess=>{
    const d=getSessionDate(sess,sessions,weeks,programs); if(!d) return
    const k=toDateKey(d); if(!dateMap[k]) dateMap[k]=[]
    dateMap[k].push(sess)
  })

  // Date → programs-due map (coach view only)
  const dueMap = {}
  if(!isClientView){
    const today = new Date(); today.setHours(0,0,0,0)
    const todayStr = toDateKey(today)
    const src = clientFilter ? clients.filter(c=>c.id===clientFilter) : clients.filter(c=>c.status==='active')
    src.forEach(client=>{
      const currProgs = programs.filter(p=>p.client_id===client.id&&p.status==='current')
      const hasDraft  = programs.some(p=>p.client_id===client.id&&p.status==='draft')
      // No current program at all → show on today
      if(!currProgs.length && !hasDraft){
        if(!dueMap[todayStr]) dueMap[todayStr]=[]
        dueMap[todayStr].push({client,program:null,kind:'no_program'})
      }
      currProgs.forEach(prog=>{
        if(!prog.start_date) return
        const pw = weeks.filter(w=>w.program_id===prog.id)
        if(!pw.length) return
        const totalW = Math.max(...pw.map(w=>w.week_number))
        const endDate = new Date(prog.start_date+'T00:00:00')
        endDate.setDate(endDate.getDate()+totalW*7)
        // 7-day pre-warning
        const warnDate = new Date(endDate); warnDate.setDate(warnDate.getDate()-7)
        if(warnDate>=today){
          const wk=toDateKey(warnDate)
          if(!dueMap[wk]) dueMap[wk]=[]
          dueMap[wk].push({client,program:prog,kind:'warning'})
        }
        // End date marker
        const k=toDateKey(endDate)
        if(!dueMap[k]) dueMap[k]=[]
        dueMap[k].push({client,program:prog,kind:'due'})
      })
    })
  }

  // Date → coach events map
  const evMap = {}
  coachEvents.forEach(ev=>{
    if(!evMap[ev.event_date]) evMap[ev.event_date]=[]
    evMap[ev.event_date].push(ev)
  })

  // Grid
  const firstOfMonth = new Date(yr,mon,1)
  const daysInMonth  = new Date(yr,mon+1,0).getDate()
  const startDow     = firstOfMonth.getDay()
  const todayKey     = toDateKey(new Date())
  const cells = []
  for(let i=0;i<startDow;i++) cells.push(null)
  for(let d=1;d<=daysInMonth;d++) cells.push(d)
  while(cells.length%7!==0) cells.push(null)

  const monthSess = displaySess.filter(s=>{
    const d=getSessionDate(s,sessions,weeks,programs)
    return d&&d.getFullYear()===yr&&d.getMonth()===mon
  })
  const done = monthSess.filter(s=>computeSessionStatus(s)==='complete').length
  const selectedClient = clientFilter ? clients.find(c=>c.id===clientFilter) : null
  const searchedClients = clients.filter(c=>c.status==='active'&&(!clientSearch||c.name.toLowerCase().includes(clientSearch.toLowerCase())))

  return(
    <div style={{padding:20,maxWidth:1020,margin:'0 auto'}}>
      {/* Header */}
      <Row style={{alignItems:'flex-start',justifyContent:'space-between',marginBottom:14,flexWrap:'wrap',gap:10}}>
        <div>
          <h1 style={{fontSize:22,fontWeight:700,color:C.white,fontFamily:'Space Grotesk,sans-serif',marginBottom:2}}>
            {isClientView?'MY CALENDAR':'CALENDAR'}
          </h1>
          <p style={{fontSize:12,color:C.muted}}>
            {monthSess.length} sessions · {done} complete
            {selectedClient&&<> · <span style={{color:clientPalette(clients,clientFilter)}}>{selectedClient.name}</span></>}
          </p>
        </div>
        <Row style={{gap:8,flexWrap:'wrap',alignItems:'center'}}>
          {/* Client picker — coach view only */}
          {!isClientView&&(
            <div style={{position:'relative'}}>
              <button onClick={()=>setShowPicker(p=>!p)}
                style={{display:'flex',alignItems:'center',gap:7,padding:'6px 12px',borderRadius:8,
                  border:`1.5px solid ${clientFilter?C.amber:C.border}`,
                  background:clientFilter?`${C.amber}12`:'transparent',
                  color:clientFilter?C.amber:C.muted,fontSize:12,fontWeight:600,cursor:'pointer'}}>
                {selectedClient
                  ? <><span style={{width:8,height:8,borderRadius:'50%',background:clientPalette(clients,clientFilter),flexShrink:0,display:'inline-block'}}/>{selectedClient.name.split(' ')[0]}</>
                  : 'My Calendar'
                }
                {clientFilter&&<span onClick={e=>{e.stopPropagation();setClientFilter('');setClientSearch('');setShowPicker(false)}} style={{marginLeft:4,color:C.faint}}>✕</span>}
              </button>
              {showPicker&&(
                <div style={{position:'absolute',top:'calc(100% + 4px)',right:0,zIndex:30,background:'#0D1117',
                  border:`1px solid ${C.border}`,borderRadius:8,minWidth:200,
                  boxShadow:'0 8px 32px rgba(0,0,0,0.6)',overflow:'hidden'}}>
                  <div style={{padding:'8px 8px',borderBottom:`1px solid ${C.border}`}}>
                    <input value={clientSearch} onChange={e=>setClientSearch(e.target.value)}
                      placeholder="Search athletes…" autoFocus
                      style={{...iS,padding:'5px 8px',fontSize:12}}/>
                  </div>
                  <div style={{maxHeight:220,overflowY:'auto'}}>
                    {[{id:'',name:'My Calendar (athletes hidden)'},...searchedClients].map(c=>{
                      const isAll = c.id===''
                      const isSel = clientFilter===(isAll?'':c.id)
                      const col   = isAll ? C.amber : clientPalette(clients,c.id)
                      return(
                        <div key={c.id||'all'}
                          onClick={()=>{setClientFilter(isAll?'':c.id);setClientSearch('');setShowPicker(false)}}
                          style={{padding:'8px 12px',cursor:'pointer',fontSize:12,color:isSel?col:C.muted,
                            background:isSel?`${col}15`:'transparent',
                            fontWeight:isSel?700:400,display:'flex',alignItems:'center',gap:8,transition:'background 0.1s'}}
                          onMouseEnter={e=>e.currentTarget.style.background=`${col}18`}
                          onMouseLeave={e=>e.currentTarget.style.background=isSel?`${col}15`:'transparent'}>
                          <span style={{width:8,height:8,borderRadius:'50%',background:col,flexShrink:0}}/>
                          {c.name}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
          <button onClick={goToday} style={{padding:'6px 12px',borderRadius:8,border:`1px solid ${C.border}`,background:'transparent',color:C.muted,fontSize:12,cursor:'pointer'}}>Today</button>
          <Row style={{gap:3}}>
            <button onClick={prevMonth} style={{padding:'5px 10px',borderRadius:7,border:`1px solid ${C.border}`,background:'transparent',color:C.muted,fontSize:14,cursor:'pointer',fontWeight:700}}>‹</button>
            <span style={{padding:'5px 12px',fontSize:13,fontWeight:700,color:C.white,fontFamily:'Space Grotesk,sans-serif',minWidth:130,textAlign:'center',display:'inline-block'}}>{MONTHS[mon]} {yr}</span>
            <button onClick={nextMonth} style={{padding:'5px 10px',borderRadius:7,border:`1px solid ${C.border}`,background:'transparent',color:C.muted,fontSize:14,cursor:'pointer',fontWeight:700}}>›</button>
          </Row>
        </Row>
      </Row>

      {/* No start date warning */}
      {!programs.some(p=>p.start_date)&&(
        <div style={{background:`${C.orange}12`,border:`1px solid ${C.orange}30`,borderRadius:8,padding:'8px 14px',fontSize:12,color:C.orange,marginBottom:12}}>
          No programs have a start date — open any program → Edit → set Start Date to place sessions on the calendar.
        </div>
      )}

      {/* Day headers */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:2,marginBottom:2}}>
        {WDAYS.map(d=>(
          <div key={d} style={{textAlign:'center',fontSize:10,fontWeight:700,color:C.faint,textTransform:'uppercase',letterSpacing:'0.06em',padding:'4px 0'}}>{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:2}}>
        {cells.map((day,i)=>{
          if(!day) return <div key={i} style={{minHeight:88}}/>
          const dateKey=`${yr}-${String(mon+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
          const daySess  = dateMap[dateKey]||[]
          const dueProg  = dueMap[dateKey]||[]
          const dayEvs   = evMap[dateKey]||[]
          const isToday  = dateKey===todayKey
          const hasSomething = daySess.length>0||dueProg.length>0||dayEvs.length>0
          return(
            <div key={i} style={{
              minHeight:88,borderRadius:7,padding:'5px 5px 4px',overflow:'hidden',
              background:isToday?`${C.amber}14`:hasSomething?`${C.white}03`:'transparent',
              border:`1px solid ${isToday?`${C.amber}70`:hasSomething?`${C.white}07`:'transparent'}`,
            }}>
              <div style={{fontSize:11,fontWeight:isToday?700:400,color:isToday?C.amber:C.faint,marginBottom:3,textAlign:'right'}}>{day}</div>

              {/* Sessions */}
              {daySess.map(sess=>{
                const prog   = programs.find(p=>p.id===sess.program_id)
                const client = clients.find(c=>c.id===prog?.client_id)
                const status = computeSessionStatus(sess)
                const statusColor = STATUS[status]?.color||C.muted
                // Use client colour when showing all, status colour when filtered
                const col = (isClientView||clientFilter) ? statusColor : clientPalette(clients,client?.id||'')
                return(
                  <div key={sess.id}
                    onClick={()=>go('session',{sessionId:sess.id,programId:sess.program_id,clientId:prog?.client_id})}
                    title={`${client?.name||''} — ${sess.name} (${STATUS[status]?.label})`}
                    style={{background:`${col}22`,border:`1px solid ${col}55`,borderRadius:3,padding:'2px 5px',
                      fontSize:10,fontWeight:600,color:col,cursor:'pointer',marginBottom:2,
                      display:'flex',alignItems:'center',gap:3,overflow:'hidden'}}>
                    {!isClientView&&!clientFilter&&<span style={{width:5,height:5,borderRadius:'50%',background:col,flexShrink:0}}/>}
                    <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',textDecoration:status==='skipped'?'line-through':'none'}}>
                      {(isClientView||clientFilter) ? sess.name : `${client?.name?.split(' ')[0]||'?'} · ${sess.name}`}
                    </span>
                  </div>
                )
              })}

              {/* Programs due */}
              {dueProg.map(({client,program,kind},pi)=>{
                const isNone=kind==='no_program', isWarn=kind==='warning', isDue=kind==='due'
                const col=isNone?C.red:isWarn?C.orange:C.orange
                const icon=isNone?'':isWarn?'⏰':'⏱'
                const label=isNone
                  ? `${client.name.split(' ')[0]} — no program`
                  : isWarn
                  ? `${client.name.split(' ')[0]} — ending soon`
                  : `${client.name.split(' ')[0]} — write next`
                const title=isNone
                  ? `${client.name} has no current program`
                  : isWarn
                  ? `${client.name}'s program ends in ~7 days — start writing the next one`
                  : `${client.name}'s program ends today — write their next program`
                return(
                  <div key={pi}
                    onClick={()=>program?go('program',{programId:program.id,clientId:client.id}):go('client',{clientId:client.id})}
                    title={title}
                    style={{background:`${col}20`,border:`1px solid ${col}55`,borderRadius:3,padding:'2px 5px',
                      fontSize:10,fontWeight:700,color:col,cursor:'pointer',marginBottom:2,
                      display:'flex',alignItems:'center',gap:3,overflow:'hidden'}}>
                    <span style={{flexShrink:0}}>{icon}</span>
                    <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{label}</span>
                  </div>
                )
              })}

              {/* Coach events */}
              {dayEvs.map((ev,ei)=>{
                const col=EV_COLORS[ev.event_type]||C.muted
                return(
                  <div key={ei} title={ev.title}
                    style={{background:`${col}20`,border:`1px solid ${col}55`,borderRadius:3,padding:'2px 5px',
                      fontSize:10,fontWeight:600,color:col,marginBottom:2,
                      overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                    ◆ {ev.title}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      {/* Client colour legend — coach view, all athletes */}
      {!isClientView&&!clientFilter&&clients.filter(c=>c.status==='active').length>1&&(
        <div style={{marginTop:14,marginBottom:8}}>
          <div style={{fontSize:9,color:C.faint,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:6}}>Athletes — click to filter</div>
          <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
            {clients.filter(c=>c.status==='active').map(c=>{
              const col=clientPalette(clients,c.id)
              return(
                <button key={c.id} onClick={()=>setClientFilter(c.id)}
                  style={{display:'flex',alignItems:'center',gap:5,padding:'3px 10px',borderRadius:20,
                    border:`1px solid ${col}50`,background:`${col}12`,color:col,
                    fontSize:11,fontWeight:600,cursor:'pointer'}}>
                  <span style={{width:6,height:6,borderRadius:'50%',background:col,flexShrink:0}}/>
                  {c.name}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Status legend */}
      <div style={{display:'flex',gap:12,flexWrap:'wrap',marginTop:10}}>
        {Object.entries(STATUS).map(([k,{label,color}])=>(
          <div key={k} style={{display:'flex',alignItems:'center',gap:4,fontSize:10,color:C.faint}}>
            <span style={{width:8,height:8,borderRadius:2,background:`${color}40`,border:`1px solid ${color}70`}}/>
            {label}
          </div>
        ))}
        {!isClientView&&(
          <div style={{display:'flex',alignItems:'center',gap:4,fontSize:10,color:C.faint}}>
            <span style={{width:8,height:8,borderRadius:2,background:`${C.orange}40`,border:`1px solid ${C.orange}70`}}/>
            Program Due
          </div>
        )}
      </div>
    </div>
  )
}

// ─── PB + TREND HELPERS ──────────────────────────────────────────────────────
// Module-level settings (updated immediately by Settings page)
let _e1rmFormula = _SC.e1rmFormula || 'Epley'
let _e1rmMaxReps = parseInt(_SC.e1rmMaxReps || '15')

const E1RM_FORMULAS = ['Epley','Brzycki','Lander','Lombardi','Mayhew','OConner','Wathan']

const calcE1RM = (load, reps) => {
  const w = parseFloat(load), r = parseInt(reps)
  const maxR = (_e1rmMaxReps>0&&_e1rmMaxReps<=50)?_e1rmMaxReps:50
  if(isNaN(w)||isNaN(r)||w<1||r<=0||r>maxR) return null
  if(r===1) return Math.round(w*10)/10
  switch(_e1rmFormula){
    case 'Brzycki':  return Math.round(w*(36/(37-r))*10)/10
    case 'Lander':   return Math.round(100*w/(101.3-2.67123*r)*10)/10
    case 'Lombardi': return Math.round(w*Math.pow(r,0.1)*10)/10
    case 'Mayhew':   return Math.round(100*w/(52.2+41.9*Math.exp(-0.055*r))*10)/10
    case 'OConner':  return Math.round(w*(1+r/40)*10)/10
    case 'Wathan':   return Math.round(100*w/(48.8+53.8*Math.exp(-0.075*r))*10)/10
    default:         return Math.round(w*(1+r/30)*10)/10
  }
}

// Parse a logged load string into individual efforts {load(kg), reps}.
// Plain "85" -> one effort (reps from the reps field). "85x6" -> 85kg x6.
// Rest-pause "85x6, x2" -> 85x6 then 85x2 (weight carries over). Drop set "85x6, 80x4" -> 85x6 then 80x4.
function parseEfforts(completedLoad, completedReps) {
  const raw = String(completedLoad==null?'':completedLoad).trim()
  if(!raw) return []
  const toKg = tok => { const lb = parseLbsLoad(tok); return lb !== null ? lbsToKg(lb) : parseFloat(tok) }
  if(!/[x\u00d7]\s*\d/i.test(raw)) {
    return [{ load: toKg(raw), reps: parseInt(completedReps)||1 }]
  }
  const out = []
  let lastWeight = null
  raw.split(/[,;]+/).forEach(part => {
    const c = part.trim(); if(!c) return
    const m = c.match(/^(.*?)\s*[x\u00d7]\s*(\d+(?:\.\d+)?)\s*$/i)
    if(m){
      const wTok = (m[1]||'').trim()
      let w = wTok==='' ? lastWeight : toKg(wTok)
      if(w!=null && !isNaN(w)) lastWeight = w
      out.push({ load: (w==null?NaN:w), reps: parseInt(m[2])||0 })
    } else {
      const w = toKg(c)
      if(!isNaN(w)){ lastWeight = w; out.push({ load:w, reps: parseInt(completedReps)||1 }) }
    }
  })
  return out.length ? out : [{ load: toKg(raw), reps: parseInt(completedReps)||1 }]
}

const PATTERN_KW = {
  squat:  ['squat','goblet','leg press','hack squat','leg ext'],
  hinge:  ['deadlift','rdl','romanian','hip thrust','nordic','ghr','hinge'],
  pull:   ['row','pull','chin','lat','face pull','inverted'],
  push:   ['press','push-up','pushup','dip','fly','overhead'],
  lunge:  ['lunge','step-up','rfess','bulgarian','split squat'],
  carry:  ['carry','farmer','suitcase','yoke'],
  power:  ['jump','hop','bound','sprint','plyom','box jump'],
  core:   ['plank','pallof','core','ab','oblique','crunch','hollow'],
}
function detectPattern(name) {
  const n = (name||'').toLowerCase()
  for(const [pat, kws] of Object.entries(PATTERN_KW)){ if(kws.some(k=>n.includes(k))) return pat }
  return 'other'
}

function getClientPBs(clientId, sessions, allSessions, weeks, programs) {
  const map = {}, sessData = {}
  const ensure = (cname, sessId, d) => {
    if(!map[cname]) map[cname]={name:cname,maxLoad:0,maxE1RM:0,bestReps:0,history:[],aliases:new Set()}
    if(!sessData[cname]) sessData[cname]={}
    if(!sessData[cname][sessId]) sessData[cname][sessId]={date:d,sessId,dateStr:d?d.toLocaleDateString('en-AU',{day:'numeric',month:'short'}):'?',bestE1RM:0,volumeLoad:0,bestLoad:0,bestReps:0}
  }
  sessions.filter(s=>s.client_id===clientId).forEach(sess=>{
    const d = getSessionDate(sess, allSessions, weeks, programs)
    safeExercises(sess).filter(ex=>!ex.isWarmup).forEach(ex=>{
      const exCanon = resolveExName(ex.name)
      ;(ex.loggedSets||[]).filter(ls=>!ls.skipped&&!ls.excluded&&ls.completedLoad).forEach(ls=>{
        // Effective canonical name = reassignedTo override, else parent exercise canonical
        const cname = ls.reassignedTo ? resolveExName(ls.reassignedTo) : exCanon
        ensure(cname, sess.id, d)
        map[cname].aliases.add(ex.name)
        const sh = sessData[cname][sess.id], pb = map[cname]
        const _mode = getExMode(cname)
        parseEfforts(ls.completedLoad, ls.completedReps).forEach(({load,reps})=>{
          const e1rm = (_mode==='isometric'||_mode==='assisted'||_mode==='band') ? null : calcE1RM(load, reps)
          if(!isNaN(load)&&load>pb.maxLoad) pb.maxLoad=load
          if(e1rm&&e1rm>pb.maxE1RM) pb.maxE1RM=e1rm
          if(!isNaN(reps)&&reps>pb.bestReps&&reps<=50) pb.bestReps=reps
          if(e1rm&&e1rm>sh.bestE1RM){sh.bestE1RM=e1rm;sh.bestLoad=load;sh.bestReps=reps}
          if(!isNaN(load)&&load>0&&reps>0&&reps<=50) sh.volumeLoad+=Math.round(load*reps)
        })
      })
    })
  })
  Object.keys(sessData).forEach(cname=>{
    if(!map[cname]) return
    map[cname].history = Object.values(sessData[cname])
      .filter(h=>h.bestE1RM>0||h.volumeLoad>0)
      .sort((a,b)=>(a.date?.getTime()||0)-(b.date?.getTime()||0))
      .map(h=>({...h,e1rm:Math.round(h.bestE1RM*10)/10}))
    map[cname].aliases = [...map[cname].aliases].filter(a=>a!==cname)
  })
  return Object.values(map).filter(pb=>pb.maxLoad>0).sort((a,b)=>b.maxE1RM-a.maxE1RM)
}

function generateAutoFlags(client, sessions, allSessions, programs, weeks) {
  const flags = [], cs = sessions.filter(s=>s.client_id===client.id)
  if(cs.length<3) return flags
  const recent8 = cs.slice(-8)
  const notDone = recent8.filter(s=>computeSessionStatus(s)==='not_started').length
  if(notDone>=3) flags.push({id:`af_comp_${client.id}`,flag_type:'warning',title:`Low compliance — ${notDone}/${recent8.length} recent sessions not started`,is_auto:true,is_resolved:false})
  const last6 = cs.slice(-6), pCounts={}
  last6.forEach(sess=>safeExercises(sess).filter(e=>!e.isWarmup).forEach(ex=>{const p=detectPattern(ex.name);pCounts[p]=(pCounts[p]||0)+1}))
  ;['hinge','pull','push','squat'].forEach(p=>{
    if(!pCounts[p]||pCounts[p]<2) flags.push({id:`af_pat_${p}_${client.id}`,flag_type:'imbalance',title:`Low ${p} volume in recent sessions`,body:`Only ${pCounts[p]||0} ${p} exercise${pCounts[p]===1?'':'s'} in last 6 sessions`,is_auto:true,is_resolved:false})
  })
  const pbs = getClientPBs(client.id, cs, allSessions, weeks, programs)
  pbs.slice(0,10).forEach(pb=>{
    if(pb.history.length>=3){
      const last3=pb.history.slice(-3), e1rms=last3.map(h=>h.e1rm).filter(Boolean), vols=last3.map(h=>h.volumeLoad||0)
      const e1rmStalled=e1rms.length>=3&&(Math.max(...e1rms)-Math.min(...e1rms))<2.5
      const volMax=Math.max(...vols),volMin=Math.min(...vols), volStalled=volMax>0&&(volMax-volMin)/volMax<0.05
      if(e1rmStalled&&volStalled) flags.push({id:`af_stall_${pb.name}_${client.id}`,flag_type:'stall',title:`${pb.name} — both strength and volume have stalled`,body:`e1RM ~${Math.round(e1rms[e1rms.length-1])}kg across last 3 sessions`,is_auto:true,is_resolved:false})
    }
  })
  const recentSkipped = cs.filter(s=>s.status==='skipped').filter(s=>{ const d=getSessionDate(s, allSessions, weeks, programs); return d && (Date.now()-d.getTime()) < 14*86400000 })
  if(recentSkipped.length>0) flags.push({id:`af_skip_${client.id}`,flag_type:'warning',title:`Skipped ${recentSkipped.length} session${recentSkipped.length!==1?'s':''} recently`,body:recentSkipped.slice(0,3).map(s=>s.name).join(', '),is_auto:true,is_resolved:false})
  return flags
}

// ─── PURE SVG LINE CHART ─────────────────────────────────────────────────────
// Linear regression helper — returns {slope, intercept, r2} for an array of y values
function calcRegression(ys) {
  const n = ys.length
  if(n < 3) return null
  const xi = ys.map((_,i) => i)
  const sx = xi.reduce((a,v)=>a+v,0), sy = ys.reduce((a,v)=>a+v,0)
  const sxy = xi.reduce((a,v,i)=>a+v*ys[i],0), sx2 = xi.reduce((a,v)=>a+v*v,0)
  const slope = (n*sxy - sx*sy) / (n*sx2 - sx*sx)
  const intercept = (sy - slope*sx) / n
  // R² — how well the line fits (0–1)
  const yMean = sy/n
  const ssTot = ys.reduce((a,v)=>a+(v-yMean)**2, 0)
  const ssRes = ys.reduce((a,v,i)=>a+(v-(slope*i+intercept))**2, 0)
  const r2 = ssTot > 0 ? Math.max(0, 1 - ssRes/ssTot) : 0
  return { slope, intercept, r2 }
}

// ═══════════════════════════════════════════════════════════════════════════════
// STALLING / PROGRESSING DETECTION — exposure-based, program-gap aware
// ═══════════════════════════════════════════════════════════════════════════════
const STALL_DEFAULTS = {
  windowSize:   6,      // last N exposures to analyze
  minExposures: 5,      // tightened: need 5+ for confident stall classification
  gapWeeks:     6,      // gap (weeks) since prior exposure → "Returning"
  stallBand:    0.3,    // tightened: ±%/exposure considered flat (was 0.5)
  declineBand:  -1.5,   // tightened: <%/exposure considered strong decline (was -2)
  progressBand: 2.0,    // >%/exposure considered strong progression
  recencyDays:  30,     // only flag exercises with a logged set in last N days
}

// Build a human-readable rationale based on the analysis
function buildStallRationale(status, data) {
  const { exposures, pctChange, perExposure, recentTrend } = data
  switch(status) {
    case 'strong_progression': return `+${pctChange}% over ${exposures} exposures · ~${perExposure}%/session · last 3 ${recentTrend==='up'?'climbing':recentTrend==='flat'?'holding':'mixed'}`
    case 'progressing':        return `+${pctChange}% over ${exposures} exposures · steady gains`
    case 'stalling':           return `${pctChange>=0?'+':''}${pctChange}% over ${exposures} exposures · flat`
    case 'declining':          return `${pctChange}% over ${exposures} exposures · slipping`
    case 'strong_decline':     return `${pctChange}% over ${exposures} exposures · significant drop`
    case 'returning':          return data.rationale  // set inline
    case 'insufficient':       return data.rationale
    default: return ''
  }
}

// Action suggestion per status
function buildStallRecommendation(status) {
  switch(status) {
    case 'strong_progression': return 'Progress load next exposure'
    case 'progressing':        return 'Keep current trajectory'
    case 'stalling':           return 'Hold load, improve quality — or vary stimulus'
    case 'declining':          return 'Investigate — reduce load or check recovery'
    case 'strong_decline':     return 'Deload or swap variation'
    case 'returning':          return 'Establish baseline before assessing'
    case 'insufficient':       return 'Need more exposures to classify'
    default: return ''
  }
}

// Core analyzer — takes the history array from getClientPBs and classifies progress
function analyzeExerciseProgress(history, options) {
  const opts = {...STALL_DEFAULTS, ...(options||{})}
  if(!history || history.length < opts.minExposures) {
    return {
      status: 'insufficient',
      exposures: history?.length || 0,
      pctChange: 0,
      perExposure: 0,
      rationale: `${history?.length||0} exposure${history?.length===1?'':'s'} logged — need ≥${opts.minExposures}`,
      recommendation: buildStallRecommendation('insufficient'),
    }
  }

  // Filter to entries with valid e1RM
  const valid = history.filter(h => h.e1rm > 0 && h.date)
  if(valid.length < opts.minExposures) {
    return {
      status: 'insufficient',
      exposures: valid.length,
      pctChange: 0, perExposure: 0,
      rationale: `Only ${valid.length} valid exposures — need ≥${opts.minExposures}`,
      recommendation: buildStallRecommendation('insufficient'),
    }
  }

  // Recency gate — if the last exposure was a long time ago, don't flag it. Mark as dormant.
  const last = valid[valid.length-1]
  const daysSinceLast = (Date.now() - last.date.getTime()) / 86400000
  if(daysSinceLast > opts.recencyDays) {
    return {
      status: 'dormant',
      exposures: valid.length,
      pctChange: 0, perExposure: 0,
      daysSinceLast: Math.round(daysSinceLast),
      rationale: `Not done in ${Math.round(daysSinceLast)} days`,
      recommendation: 'Reintroduce when relevant',
    }
  }

  // Check for "Returning" — gap since prior exposure exceeds threshold
  // Apply only if we have very few NEW exposures since the gap
  const lastTwo = valid.slice(-2)
  if(lastTwo.length === 2) {
    const gapDays = (lastTwo[1].date - lastTwo[0].date) / 86400000
    const gapWeeks = gapDays / 7
    // If gap is large AND the post-gap data is just 1-2 sessions, treat as returning
    // Count post-gap sessions
    const postGapCount = valid.filter(h => h.date >= lastTwo[1].date - 7*86400000).length
    if(gapWeeks >= opts.gapWeeks && postGapCount <= 2) {
      return {
        status: 'returning',
        exposures: valid.length,
        pctChange: 0, perExposure: 0,
        gapWeeks: Math.round(gapWeeks*10)/10,
        rationale: `${Math.round(gapWeeks)}wk gap since last exposure — establishing baseline`,
        recommendation: buildStallRecommendation('returning'),
      }
    }
  }

  // Take last N exposures
  const window = valid.slice(-opts.windowSize)
  const first = window[0]
  const pctChange = ((last.e1rm - first.e1rm) / first.e1rm) * 100
  const perExposure = pctChange / (window.length - 1)

  // Recent 3 vs prior 3 (if we have at least 5 in window)
  let recentTrend = null
  if(window.length >= 5) {
    const half = Math.floor(window.length / 2)
    const recent = window.slice(-Math.min(3, half))
    const prior  = window.slice(0, Math.min(3, half))
    const recentAvg = recent.reduce((s,h)=>s+h.e1rm,0)/recent.length
    const priorAvg  = prior.reduce((s,h)=>s+h.e1rm,0)/prior.length
    const diff = recentAvg - priorAvg
    recentTrend = Math.abs(diff)/priorAvg < 0.01 ? 'flat' : (diff > 0 ? 'up' : 'down')
  }

  // Classify
  let status
  if(perExposure > opts.progressBand) {
    status = recentTrend === 'down' ? 'progressing' : 'strong_progression'
  } else if(perExposure > opts.stallBand) {
    status = 'progressing'
  } else if(perExposure >= -opts.stallBand) {
    status = 'stalling'
  } else if(perExposure >= opts.declineBand) {
    status = 'declining'
  } else {
    status = 'strong_decline'
  }

  const data = {
    exposures: window.length,
    pctChange: Math.round(pctChange*10)/10,
    perExposure: Math.round(perExposure*10)/10,
    recentTrend,
    firstE1rm: first.e1rm,
    lastE1rm: last.e1rm,
  }
  return {
    status,
    ...data,
    rationale: buildStallRationale(status, data),
    recommendation: buildStallRecommendation(status),
  }
}

// Status pill metadata for UI
function stallStatusMeta(status) {
  const C2 = typeof C !== 'undefined' ? C : {}
  switch(status) {
    case 'strong_progression': return {label:'↑↑ Strong gains',  color:'#3B82F6', bg:'#3B82F618', short:'Strong ↑'}
    case 'progressing':        return {label:'↑ Progressing',    color:'#93C5FD', bg:'#93C5FD18', short:'Progressing'}
    case 'stalling':           return {label:'→ Stalling',       color:'#F97316', bg:'#F9731618', short:'Stalling'}
    case 'declining':          return {label:'↓ Declining',      color:'#EF4444', bg:'#EF444415', short:'Declining'}
    case 'strong_decline':     return {label:'↓↓ Strong drop',   color:'#EF4444', bg:'#EF444425', short:'Strong ↓'}
    case 'returning':          return {label:'↺ Returning',      color:'#93C5FD', bg:'#93C5FD18', short:'Returning'}
    case 'dormant':            return {label:'· Dormant',        color:'#64748B', bg:'#64748B15', short:'Dormant'}
    case 'insufficient':       return {label:'· New',            color:'#94A3B8', bg:'#94A3B815', short:'New'}
    default:                   return {label:status,             color:'#94A3B8', bg:'#94A3B815', short:status}
  }
}

function SvgLineChart({ data, xKey, yKey, color=C.amber, height=200, label='' }) {
  const [hovered,   setHovered]   = useState(null)
  const [showTrend, setShowTrend] = useState(false)
  if(!data||data.length<2) return <div style={{height,display:'flex',alignItems:'center',justifyContent:'center',color:C.faint,fontSize:12}}>Not enough data yet</div>
  const W=560, H=height, PAD={t:16,r:16,b:32,l:44}
  const xs=data.map(d=>d[xKey]), ys=data.map(d=>parseFloat(d[yKey])||0)
  const minY=Math.min(...ys), maxY=Math.max(...ys), rangeY=maxY-minY||1
  const px=(i)=>PAD.l+(i/(data.length-1))*(W-PAD.l-PAD.r)
  const py=(v)=>PAD.t+(1-(v-minY)/rangeY)*(H-PAD.t-PAD.b)
  const pts=data.map((_,i)=>`${px(i)},${py(ys[i])}`).join(' ')
  const fillPts=`${PAD.l},${H-PAD.b} ${pts} ${W-PAD.r},${H-PAD.b}`
  const yTicks=[minY, minY+rangeY/2, maxY].map(v=>Math.round(v*10)/10)
  const xIdxs=[0, Math.floor((data.length-1)/2), data.length-1]
  const reg = showTrend ? calcRegression(ys) : null
  const trendPts = reg ? `${px(0)},${py(reg.intercept)} ${px(data.length-1)},${py(reg.slope*(data.length-1)+reg.intercept)}` : null
  const slopeLabel = reg ? (reg.slope>=0?'+':'')+Math.round(reg.slope*10)/10+label+'/session' : null
  return(
    <div style={{position:'relative',userSelect:'none'}}>
      {/* Trend toggle */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'flex-end',gap:8,marginBottom:6}}>
        {reg&&<span style={{fontSize:11,color:reg.slope>=0?C.green:C.red,fontWeight:600}}>{slopeLabel} <span style={{color:C.faint,fontWeight:400}}>· R²={Math.round(reg.r2*100)}%</span></span>}
        <button onClick={()=>setShowTrend(p=>!p)} style={{padding:'3px 10px',borderRadius:20,border:`1.5px solid ${showTrend?color:C.border}`,background:showTrend?`${color}15`:'transparent',color:showTrend?color:C.faint,fontSize:10,fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',gap:5}}>
          <svg width="14" height="8" viewBox="0 0 14 8"><line x1="0" y1="7" x2="14" y2="1" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2"/></svg>
          Trend line
        </button>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{width:'100%',height,display:'block'}} onMouseLeave={()=>setHovered(null)}>
        <defs>
          <linearGradient id={`g_${yKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25"/><stop offset="100%" stopColor={color} stopOpacity="0.02"/>
          </linearGradient>
        </defs>
        {yTicks.map((v,i)=>(<g key={i}><line x1={PAD.l} y1={py(v)} x2={W-PAD.r} y2={py(v)} stroke="rgba(255,255,255,0.06)" strokeDasharray="4 4"/><text x={PAD.l-6} y={py(v)+4} textAnchor="end" fill="rgba(255,255,255,0.35)" fontSize={10}>{v}</text></g>))}
        {xIdxs.map(i=>(<text key={i} x={px(i)} y={H-PAD.b+16} textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize={10}>{xs[i]}</text>))}
        <polygon points={fillPts} fill={`url(#g_${yKey})`}/>
        <polyline points={pts} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"/>
        {trendPts&&<polyline points={trendPts} fill="none" stroke={color} strokeWidth="1.5" strokeDasharray="6 3" opacity="0.7"/>}
        {data.map((_,i)=>(<circle key={i} cx={px(i)} cy={py(ys[i])} r={hovered===i?6:4} fill={hovered===i?color:'#0D1117'} stroke={color} strokeWidth="2" style={{cursor:'pointer',transition:'r 0.1s'}} onMouseEnter={()=>setHovered(i)}/>))}
        {hovered!=null&&(()=>{const tx=px(hovered),ty=py(ys[hovered]),bx=Math.min(tx+8,W-120),by=Math.max(ty-36,PAD.t);return(<g><rect x={bx} y={by} width={110} height={28} rx={6} fill="#0D1117" stroke="rgba(255,255,255,0.15)" strokeWidth="1"/><text x={bx+8} y={by+11} fill={color} fontSize={10} fontWeight="700">{xs[hovered]}</text><text x={bx+8} y={by+23} fill="white" fontSize={11} fontWeight="700">{ys[hovered]}{label}</text></g>)})()}
      </svg>
    </div>
  )
}

function DualLineChart({ data, height=230, metricLabel='Est. 1RM', metricUnit='kg', invertE1rm=false }) {
  const [show,    setShow]    = useState({e1rm:true, volume:true, trend:false})
  const [hovered, setHovered] = useState(null)
  if(!data||data.length<2) return(<div style={{height,display:'flex',alignItems:'center',justifyContent:'center',color:C.faint,fontSize:12}}>Not enough data yet — log sets in at least 2 sessions</div>)
  const W=560, H=height, lPad=show.e1rm?48:12, rPad=show.volume?52:12, PAD={t:16,r:rPad,b:36,l:lPad}, iW=W-PAD.l-PAD.r, iH=H-PAD.t-PAD.b
  const eVals=data.map(d=>d.e1rm).filter(v=>v>0), eMin=eVals.length?Math.min(...eVals)*0.92:0, eMax=eVals.length?Math.max(...eVals)*1.08:100
  const vVals=data.map(d=>d.volume).filter(v=>v>0), vMin=vVals.length?Math.min(...vVals)*0.85:0, vMax=vVals.length?Math.max(...vVals)*1.08:100
  const px=i=>PAD.l+(i/(data.length-1))*iW, pyE=v=>PAD.t+(invertE1rm?((v-eMin)/((eMax-eMin)||1)):(1-(v-eMin)/((eMax-eMin)||1)))*iH, pyV=v=>PAD.t+(1-(v-vMin)/((vMax-vMin)||1))*iH
  const ticks=[0,0.33,0.66,1].map(t=>({y:Math.round(PAD.t+(1-t)*iH),eV:Math.round((eMin+t*(eMax-eMin))*10)/10,vV:Math.round(vMin+t*(vMax-vMin))}))
  const ePts=data.map((d,i)=>d.e1rm>0?{x:px(i),y:pyE(d.e1rm),v:d.e1rm,i}:null).filter(Boolean)
  const vPts=data.map((d,i)=>d.volume>0?{x:px(i),y:pyV(d.volume),i}:null).filter(Boolean)
  const toPath=pts=>pts.map((p,j)=>`${j===0?'M':'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const toArea=(pts,pyFn,minVal)=>{if(!pts.length)return '';const base=pyFn(minVal);return toPath(pts)+` L${pts[pts.length-1].x.toFixed(1)},${base} L${pts[0].x.toFixed(1)},${base} Z`}
  const ePath=toPath(ePts),vPath=toPath(vPts),eArea=toArea(ePts,pyE,eMin),vArea=toArea(vPts,pyV,vMin)
  const xIdxs=data.length<=5?data.map((_,i)=>i):[0,1,2,3,4].map(t=>Math.round(t*(data.length-1)/4))
  const uid_e='gE'+data.length, uid_v='gV'+data.length

  // Linear regression on e1RM values
  const eReg = show.trend&&ePts.length>=3 ? calcRegression(ePts.map(p=>p.v)) : null
  const trendPath = eReg ? (()=>{
    const x0=px(0), x1=px(data.length-1)
    const y0=pyE(eReg.intercept), y1=pyE(eReg.slope*(data.length-1)+eReg.intercept)
    return `M${x0.toFixed(1)},${y0.toFixed(1)} L${x1.toFixed(1)},${y1.toFixed(1)}`
  })() : null
  const slopeKg = eReg ? (eReg.slope>=0?'+':'')+Math.round(eReg.slope*10)/10+'kg/session' : null
  const r2pct   = eReg ? Math.round(eReg.r2*100) : null

  return(
    <div>
      {/* Toggle row */}
      <div style={{display:'flex',gap:6,marginBottom:10,flexWrap:'wrap',alignItems:'center'}}>
        {[
          {k:'e1rm',   label:metricLabel,    color:C.amber, side:'Left',  dash:false},
          {k:'volume', label:'Volume Load', color:C.c2,   side:'Right', dash:false},
          {k:'trend',  label:'Trend Line',  color:'rgba(255,200,80,0.7)', side:null, dash:true},
        ].map(({k,label,color,side,dash})=>(
          <button key={k} onClick={()=>setShow(p=>({...p,[k]:!p[k]}))}
            style={{padding:'5px 14px',borderRadius:20,border:`1.5px solid ${show[k]?color:C.border}`,background:show[k]?`${color}18`:'transparent',color:show[k]?color:C.faint,fontSize:11,fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',gap:6}}>
            {dash
              ? <svg width="12" height="8" viewBox="0 0 12 8" style={{flexShrink:0}}><line x1="0" y1="6" x2="12" y2="2" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2"/></svg>
              : <span style={{width:8,height:8,borderRadius:'50%',background:show[k]?color:'transparent',border:`2px solid ${show[k]?color:C.faint}`,display:'inline-block',flexShrink:0}}/>
            }
            {label}
            {side&&<span style={{fontSize:9,color:show[k]?color+'88':C.faint,fontWeight:400}}>({side})</span>}
          </button>
        ))}
        {/* Slope label — only visible when trend is on */}
        {show.trend&&eReg&&(
          <span style={{fontSize:11,marginLeft:4,color:eReg.slope>=0?C.green:C.red,fontWeight:600}}>
            {slopeKg}
            <span style={{color:C.faint,fontWeight:400,marginLeft:6}}>R²={r2pct}%</span>
          </span>
        )}
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} style={{width:'100%',height,display:'block'}} onMouseLeave={()=>setHovered(null)}>
        <defs>
          <linearGradient id={uid_e} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.amber} stopOpacity="0.22"/><stop offset="100%" stopColor={C.amber} stopOpacity="0.01"/></linearGradient>
          <linearGradient id={uid_v} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.c2} stopOpacity="0.18"/><stop offset="100%" stopColor={C.c2} stopOpacity="0.01"/></linearGradient>
        </defs>
        {ticks.map((t,i)=>(<g key={i}><line x1={PAD.l} y1={t.y} x2={W-PAD.r} y2={t.y} stroke="rgba(255,255,255,0.05)" strokeDasharray="3 4"/>{show.e1rm&&(<text x={PAD.l-5} y={t.y+3.5} textAnchor="end" fill={C.amber} fillOpacity="0.65" fontSize={9}>{t.eV}</text>)}{show.volume&&(<text x={W-PAD.r+5} y={t.y+3.5} textAnchor="start" fill={C.c2} fillOpacity="0.65" fontSize={9}>{t.vV}</text>)}</g>))}
        {xIdxs.map(i=>(<text key={i} x={px(i)} y={H-4} textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize={9}>{data[i]?.date}</text>))}
        {show.volume&&vArea&&<path d={vArea} fill={`url(#${uid_v})`}/>}
        {show.volume&&vPath&&<path d={vPath} fill="none" stroke={C.c2} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>}
        {show.e1rm&&eArea&&<path d={eArea} fill={`url(#${uid_e})`}/>}
        {show.e1rm&&ePath&&<path d={ePath} fill="none" stroke={C.amber} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"/>}
        {/* Trend line — dashed, drawn on top */}
        {show.trend&&trendPath&&<path d={trendPath} fill="none" stroke="rgba(255,200,80,0.75)" strokeWidth="1.5" strokeDasharray="7 4"/>}
        {data.map((_,i)=>{const slotW=data.length>1?iW/(data.length-1):iW;return(<rect key={i} x={i===0?PAD.l:px(i)-slotW/2} y={PAD.t} width={i===0?slotW/2:slotW} height={iH} fill="transparent" style={{cursor:'crosshair'}} onMouseEnter={()=>setHovered(i)}/>)})}
        {show.volume&&vPts.map(p=>(<circle key={p.i} cx={p.x} cy={p.y} r={hovered===p.i?5:3} fill={hovered===p.i?C.c2:'#0D1117'} stroke={C.c2} strokeWidth="2" style={{transition:'r 0.1s'}}/>))}
        {show.e1rm&&ePts.map(p=>(<circle key={p.i} cx={p.x} cy={p.y} r={hovered===p.i?5:3} fill={hovered===p.i?C.amber:'#0D1117'} stroke={C.amber} strokeWidth="2" style={{transition:'r 0.1s'}}/>))}
        {hovered!==null&&(()=>{const d=data[hovered],tx=px(hovered),rows=[{l:'Date',v:d.date,c:C.muted},show.e1rm&&d.e1rm>0&&{l:metricLabel,v:`${d.e1rm}${metricUnit}`,c:C.amber},show.volume&&d.volume>0&&{l:'Volume',v:`${d.volume}kg`,c:C.c2},show.trend&&eReg&&{l:'Trend',v:`${((eReg.slope>=0?'+':'')+Math.round((eReg.slope*hovered+eReg.intercept)*10)/10)}kg`,c:'rgba(255,200,80,0.9)'}].filter(Boolean),tw=130,th=10+rows.length*17,bx=Math.min(Math.max(tx-tw/2,4),W-tw-4),by=PAD.t+2;return(<g><rect x={bx} y={by} width={tw} height={th} rx={6} fill="#0A0E18" stroke="rgba(255,255,255,0.18)" strokeWidth="1"/>{rows.map((r,j)=>(<g key={j}><text x={bx+7} y={by+13+j*17} fill={r.c} fontSize={9} fontWeight="700">{r.l}</text><text x={bx+tw-7} y={by+13+j*17} fill={C.white} fontSize={10} fontWeight="700" textAnchor="end">{r.v}</text></g>))}</g>)})()}
      </svg>
    </div>
  )
}

// ─── GOAL TYPE OPTIONS ────────────────────────────────────────────────────────
const GOAL_TYPES = ['strength','body_comp','performance','habit','health','return_to_play','other']
const FLAG_TYPES = {
  focus:{label:'Focus',color:C.amber}, injury:{label:'Injury',color:C.red},
  imbalance:{label:'Imbalance',color:C.orange}, stall:{label:'Stalled',color:C.c3},
  warning:{label:'Warning',color:C.orange}, positive:{label:'Positive',color:C.green},
}

const BLANK_GOAL = {title:'',goal_type:'strength',metric:'',unit:'kg',current_value:'',target_value:'',deadline:'',notes:''}

function GoalsSection({clientId,goals,addGoal,updateGoal,deleteGoal,saving}){
  const cGoals = goals.filter(g=>g.client_id===clientId&&g.status!=='archived')
  const [adding,setAdding]=useState(false)
  const [editId,setEditId]=useState(null)
  const [f,setF]=useState(BLANK_GOAL)
  const ff=k=>v=>setF(p=>({...p,[k]:v}))
  const save=async()=>{
    if(!f.title.trim())return
    const d={...f,client_id:clientId,current_value:f.current_value?parseFloat(f.current_value):null,target_value:f.target_value?parseFloat(f.target_value):null}
    if(editId)await updateGoal(editId,d); else await addGoal(d)
    setF(BLANK_GOAL);setAdding(false);setEditId(null)
  }
  const pct=(g)=>{ if(!g.current_value||!g.target_value)return null; return Math.min(100,Math.round((parseFloat(g.current_value)/parseFloat(g.target_value))*100)) }
  const pctColor=(p)=>p>=100?C.green:p>=70?C.amber:p>=40?C.orange:C.red
  return(
    <div>
      <SL right={<Btn label="+ Goal" small onClick={()=>{setF(BLANK_GOAL);setAdding(true);setEditId(null)}}/>}>Goals</SL>
      {(adding||editId)&&(
        <Panel style={{marginBottom:10}}>
          <h4 style={{color:C.white,marginBottom:10}}>{editId?'Edit Goal':'New Goal'}</h4>
          <div style={{marginBottom:8}}><TI label="Goal Title *" value={f.title} onChange={ff('title')} placeholder="Get to 100kg back squat"/></div>
          <G3 style={{marginBottom:8}}><SI label="Type" value={f.goal_type} onChange={ff('goal_type')} options={GOAL_TYPES}/><TI label="Metric" value={f.metric} onChange={ff('metric')} placeholder="Back Squat e1RM"/><TI label="Unit" value={f.unit} onChange={ff('unit')} placeholder="kg"/></G3>
          <G3 style={{marginBottom:8}}><TI label="Current" value={f.current_value} onChange={ff('current_value')} placeholder="80" type="number"/><TI label="Target" value={f.target_value} onChange={ff('target_value')} placeholder="100" type="number"/><TI label="Deadline" value={f.deadline} onChange={ff('deadline')} type="date"/></G3>
          <div style={{marginBottom:10}}><TA label="Notes" value={f.notes} onChange={ff('notes')} rows={2}/></div>
          <Row><Btn label={editId?'Save':'Add Goal'} onClick={save} loading={saving} disabled={!f.title.trim()}/><Btn label="Cancel" variant="secondary" onClick={()=>{setAdding(false);setEditId(null);setF(BLANK_GOAL)}}/></Row>
        </Panel>
      )}
      {cGoals.length===0&&!adding&&<p style={{fontSize:13,color:C.faint}}>No goals set yet.</p>}
      <div style={{display:'flex',flexDirection:'column',gap:8}}>
        {cGoals.map(g=>{
          const p=pct(g)
          return(
            <Card key={g.id} style={{padding:'12px 14px'}}>
              <Row style={{alignItems:'flex-start'}}>
                <div style={{flex:1,minWidth:0}}>
                  <Row style={{alignItems:'center',gap:6,marginBottom:3,flexWrap:'wrap'}}>
                    <span style={{fontWeight:600,fontSize:13,color:C.white}}>{g.title}</span>
                    <Tag v={g.goal_type} color={C.c2} small/>
                    {g.status==='achieved'&&<Tag v="Achieved" color={C.green} small/>}
                  </Row>
                  {g.metric&&<div style={{fontSize:12,color:C.muted,marginBottom:5}}>{g.metric}{g.deadline?` · Due ${new Date(g.deadline+'T00:00:00').toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'numeric'})}`:''}</div>}
                  {(g.current_value!=null&&g.target_value!=null)&&(
                    <div>
                      <Row style={{justifyContent:'space-between',marginBottom:3}}><span style={{fontSize:11,color:C.muted}}>Current: <strong style={{color:C.white}}>{g.current_value}{g.unit?` ${g.unit}`:''}</strong></span><span style={{fontSize:11,color:C.muted}}>Target: <strong style={{color:C.amber}}>{g.target_value}{g.unit?` ${g.unit}`:''}</strong></span>{p!=null&&<span style={{fontSize:11,fontWeight:700,color:pctColor(p)}}>{p}%</span>}</Row>
                      {p!=null&&<div style={{height:5,background:C.surface,borderRadius:3,overflow:'hidden'}}><div style={{height:'100%',width:`${p}%`,background:pctColor(p),borderRadius:3,transition:'width 0.4s'}}/></div>}
                    </div>
                  )}
                  {g.notes&&<div style={{fontSize:11,color:C.dim,fontStyle:'italic',marginTop:4}}>{g.notes}</div>}
                </div>
                <Row style={{gap:4,flexShrink:0}}>
                  {g.status!=='achieved'&&<Btn label="✓" variant="secondary" small title="Mark achieved" onClick={()=>updateGoal(g.id,{status:'achieved'})}/>}
                  <Btn label="Edit" variant="secondary" small onClick={()=>{setEditId(g.id);setF({...g,current_value:g.current_value??'',target_value:g.target_value??'',deadline:g.deadline||''});setAdding(false)}}/>
                  <Btn label="✕" variant="danger" small onClick={()=>{if(window.confirm('Delete goal?'))deleteGoal(g.id)}}/>
                </Row>
              </Row>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

const BLANK_FLAG={title:'',flag_type:'focus',body:''}

function FlagsSection({clientId,sessions,programs,weeks,flags,addFlag,updateFlag,deleteFlag,saving}){
  const clientSess = sessions.filter(s=>s.client_id===clientId)
  const client = {id:clientId}
  const autoFlags  = generateAutoFlags(client,clientSess,sessions,programs,weeks)
  const manualFlags= flags.filter(f=>f.client_id===clientId&&!f.is_auto&&!f.is_resolved)
  const allActive  = [...autoFlags,...manualFlags]
  const resolved   = flags.filter(f=>f.client_id===clientId&&!f.is_auto&&f.is_resolved)
  const [adding,setAdding]=useState(false)
  const [f,setF]=useState(BLANK_FLAG)
  const ff=k=>v=>setF(p=>({...p,[k]:v}))
  const save=async()=>{if(!f.title.trim())return;await addFlag({...f,client_id:clientId});setF(BLANK_FLAG);setAdding(false)}
  return(
    <div>
      <SL right={<Btn label="+ Flag" small onClick={()=>setAdding(true)}/>}>Flags & Focus</SL>
      {adding&&(
        <Panel style={{marginBottom:10}}>
          <G2 style={{marginBottom:8}}><SI label="Type" value={f.flag_type} onChange={ff('flag_type')} options={Object.entries(FLAG_TYPES).map(([v,{label}])=>({v,l:label}))}/><TI label="Title *" value={f.title} onChange={ff('title')} placeholder="e.g. Left knee discomfort on squats"/></G2>
          <div style={{marginBottom:10}}><TA label="Details" value={f.body} onChange={ff('body')} rows={2} placeholder="More detail…"/></div>
          <Row><Btn label="Add Flag" onClick={save} loading={saving} disabled={!f.title.trim()}/><Btn label="Cancel" variant="secondary" onClick={()=>setAdding(false)}/></Row>
        </Panel>
      )}
      {allActive.length===0&&!adding&&<p style={{fontSize:13,color:C.green}}>✓ No active flags — all looks good.</p>}
      <div style={{display:'flex',flexDirection:'column',gap:6}}>
        {allActive.map(flag=>{
          const ft=FLAG_TYPES[flag.flag_type]||FLAG_TYPES.focus
          return(
            <div key={flag.id} style={{background:`${ft.color}10`,border:`1px solid ${ft.color}40`,borderRadius:8,padding:'10px 12px'}}>
              <Row style={{alignItems:'flex-start'}}>
                <div style={{flex:1}}>
                  <Row style={{alignItems:'center',gap:6,marginBottom:flag.body?3:0,flexWrap:'wrap'}}>
                    <Tag v={ft.label} color={ft.color} small/>{flag.is_auto&&<Tag v="Auto" color={C.faint} small/>}
                    <span style={{fontSize:13,color:C.white,fontWeight:600}}>{flag.title}</span>
                  </Row>
                  {flag.body&&<div style={{fontSize:12,color:C.muted,marginTop:2}}>{flag.body}</div>}
                </div>
                {!flag.is_auto&&(<Row style={{gap:4}}><Btn label="Resolve" variant="secondary" small onClick={()=>updateFlag(flag.id,{is_resolved:true})}/><Btn label="✕" variant="danger" small onClick={()=>deleteFlag(flag.id)}/></Row>)}
              </Row>
            </div>
          )
        })}
      </div>
      {resolved.length>0&&(
        <div style={{marginTop:12}}>
          <div style={{fontSize:10,color:C.faint,textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:6}}>Resolved ({resolved.length})</div>
          {resolved.map(f=>(<div key={f.id} style={{display:'flex',alignItems:'center',gap:8,padding:'5px 0',borderBottom:`1px solid ${C.border}`,opacity:0.5}}><Tag v="Resolved" color={C.green} small/><span style={{fontSize:12,color:C.muted,flex:1}}>{f.title}</span><Btn label="Reopen" variant="ghost" small onClick={()=>updateFlag(f.id,{is_resolved:false})}/></div>))}
        </div>
      )}
    </div>
  )
}

// ─── EXERCISE LOG COLLECTOR ───────────────────────────────────────────────────
function collectExerciseLogs(exerciseName, clientId, sessions, weeks, programs) {
  const logs = []
  const targetName = resolveExName(exerciseName).toLowerCase()
  sessions.filter(s=>s.client_id===clientId).forEach(sess=>{
    const date = getSessionDate(sess, sessions, weeks, programs)
    const prog = programs.find(p=>p.id===sess.program_id)
    safeExercises(sess).filter(ex=>!ex.isWarmup).forEach(ex=>{
      const exCanon = resolveExName(ex.name).toLowerCase()
      ;(ex.loggedSets||[]).forEach(ls=>{
        if(ls.skipped) return
        // Effective exercise = reassignedTo if user moved it, else parent exercise's canonical name
        const effectiveCanon = ls.reassignedTo
          ? resolveExName(ls.reassignedTo).toLowerCase()
          : exCanon
        if(effectiveCanon !== targetName) return
        // Normalize lbs → kg at calculation time
        const rawStr = ls.completedLoad || ''
        const efforts = parseEfforts(rawStr, ls.completedReps)
        let best = efforts[0] || {load:NaN, reps:0}
        efforts.forEach(ef=>{ if((calcE1RM(ef.load,ef.reps)||0) > (calcE1RM(best.load,best.reps)||0)) best = ef })
        const load = best.load, reps = best.reps
        const _mode = getExMode(effectiveCanon)
        const e1rm = (_mode==='isometric'||_mode==='assisted'||_mode==='band') ? null : calcE1RM(load, reps)
        const lbsVal = parseLbsLoad(rawStr)
        const displayLoad = (lbsVal !== null && !/[x\u00d7,;]/i.test(rawStr)) ? String(lbsToKg(lbsVal)) : rawStr
        const repsDisplay = efforts.length>1 ? efforts.map(e=>e.reps).join(' + ') : (ls.completedReps||String(reps||''))
        const volume = efforts.reduce((a,e)=>a+((!isNaN(e.load)&&e.load>0&&e.reps>0&&e.reps<=50)?e.load*e.reps:0),0)
        logs.push({
          id:ls.id, date, sessId:sess.id, exId:ex.id, parentExName:ex.name,
          dateStr:date?date.toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'2-digit'}):'—',
          sessName:sess.name, progName:prog?.name||'',
          setNumber:ls.setNumber, load, reps, e1rm, volume, mode:_mode, bandColour:ls.bandColour||null,
          rawLoad:displayLoad, rawReps:repsDisplay, notes:ls.notes||'',
          excluded: !!ls.excluded,
          reassignedTo: ls.reassignedTo || null,
          invalid:(!load||load<1||!reps||reps<=0||reps>50)
        })
      })
    })
  })
  return logs.sort((a,b)=>(a.date?.getTime()||0)-(b.date?.getTime()||0))
}

function ExerciseDetail({ exerciseName, clientId, sessions, allSessions, weeks, programs, updateSession, onBack }) {
  const allLogs = collectExerciseLogs(exerciseName, clientId, sessions, weeks, programs)
  const [reassignFor, setReassignFor] = useState(null) // logId currently being reassigned
  const [reassignSearch, setReassignSearch] = useState('')
  const [bulkMode, setBulkMode] = useState(false)
  const [bulkSel, setBulkSel] = useState(()=>new Set())
  const [bulkPickerOpen, setBulkPickerOpen] = useState(false)
  const [bulkSearch, setBulkSearch] = useState('')
  const [bulkStatus, setBulkStatus] = useState(null)
  const [modeTick, setModeTick] = useState(0)

  // Build canonical exercise list for the Move dropdown — from this client's data
  const canonicalExs = React.useMemo(()=>{
    const set = new Set()
    sessions.forEach(s=>safeExercises(s).filter(e=>!e.isWarmup).forEach(ex=>{
      const c = resolveExName(ex.name)
      if(c && c !== exerciseName) set.add(c)
    }))
    return [...set].sort()
  }, [sessions, exerciseName])

  // Persistent toggle: writes excluded flag back to the set log via updateSession
  const persistFlag = async (log, patch) => {
    const sess = (allSessions||sessions).find(s=>s.id===log.sessId)
    if(!sess || !updateSession) return
    const newExs = safeExercises(sess).map(ex=>{
      if(ex.id !== log.exId) return ex
      return {...ex, loggedSets:(ex.loggedSets||[]).map(ls=>
        ls.id===log.id ? {...ls, ...patch} : ls
      )}
    })
    await updateSession(sess.id, {exercises:newExs})
  }
  const toggleExclude = log => persistFlag(log, {excluded: !log.excluded})
  const reassign     = (log, newCanonical) => {
    persistFlag(log, {reassignedTo: newCanonical || undefined})
    setReassignFor(null); setReassignSearch('')
  }
  const clearReassign = log => persistFlag(log, {reassignedTo: undefined})
  // Bulk: apply a patch to many logged sets at once, grouped into one write per session
  const persistFlagBulk = async (logIds, patch) => {
    const logs = allLogs.filter(l=>logIds.has(l.id))
    const bySession = {}
    logs.forEach(l=>{ (bySession[l.sessId] = bySession[l.sessId]||[]).push(l) })
    for(const sessId of Object.keys(bySession)){
      const sess = (allSessions||sessions).find(s=>s.id===sessId)
      if(!sess || !updateSession) continue
      const ids   = new Set(bySession[sessId].map(l=>l.id))
      const exIds = new Set(bySession[sessId].map(l=>l.exId))
      const newExs = safeExercises(sess).map(ex=>{
        if(!exIds.has(ex.id)) return ex
        return {...ex, loggedSets:(ex.loggedSets||[]).map(ls=> ids.has(ls.id) ? {...ls, ...patch} : ls)}
      })
      await updateSession(sess.id, {exercises:newExs})
    }
  }
  const bulkMove = async (target) => {
    if(!target || bulkSel.size===0) return
    const count = bulkSel.size
    setBulkPickerOpen(false)
    setBulkStatus(`Saving ${count} set${count!==1?'s':''} to cloud\u2026`)
    await persistFlagBulk(bulkSel, {reassignedTo: target})
    setBulkStatus(`\u2713 Moved ${count} set${count!==1?'s':''} to "${target}" \u2014 saved to cloud`)
    setBulkMode(false); setBulkSel(new Set()); setBulkSearch('')
    setTimeout(()=>setBulkStatus(null), 4000)
  }

  const exMode = getExMode(exerciseName)
  const isAssisted = exMode==='assisted', isIso = exMode==='isometric', isBand = exMode==='band'
  const metricOf = l => exMode==='normal' ? l.e1rm : l.load
  const better = (a,b)=> isAssisted ? a<b : a>b
  const validLogs = allLogs.filter(l=>!l.invalid&&!l.excluded&&(isBand?true:metricOf(l)>0))
  const pb = isBand ? null : validLogs.reduce((best,l)=>(!best||better(metricOf(l),metricOf(best)))?l:best, null)
  const sessMap = {}
  validLogs.forEach(l=>{
    const k = l.sessId
    if(!sessMap[k]) sessMap[k]={...l,volumeLoad:0,totalReps:0,totalSets:0,_m:metricOf(l)}
    else if(better(metricOf(l),sessMap[k]._m)) Object.assign(sessMap[k],l,{_m:metricOf(l)})
  })
  validLogs.forEach(l=>{ if(sessMap[l.sessId]){sessMap[l.sessId].volumeLoad+=(l.volume||(l.load||0)*(l.reps||0));sessMap[l.sessId].totalReps+=(l.reps||0);sessMap[l.sessId].totalSets+=1} })
  const sessArr = Object.values(sessMap).sort((a,b)=>(a.date?.getTime()||0)-(b.date?.getTime()||0))
  const chartData = sessArr.map(l=>({date:l.dateStr,e1rm:Math.round((metricOf(l)||0)*10)/10,volume:Math.round(l.volumeLoad||0)}))
  const metricLabel = isAssisted?'Assistance':isIso?'Load / Hold':'Est. 1RM'
  const bandLogs = allLogs.filter(l=>!l.excluded&&l.bandColour)
  const bandTimeline = []
  bandLogs.forEach(l=>{ const prev=bandTimeline[bandTimeline.length-1]; if(!prev||prev.bandColour!==l.bandColour) bandTimeline.push(l) })
  const invalidCount  = allLogs.filter(l=>l.invalid).length
  const excludedCount = allLogs.filter(l=>l.excluded).length

  return(
    <div style={{display:'flex',flexDirection:'column',gap:18}}>
      <Row style={{alignItems:'center',gap:10}}>
        <button onClick={onBack} style={{background:'none',border:'none',color:C.amber,cursor:'pointer',fontSize:13,fontWeight:600,padding:0}}>← Back to Progress</button>
      </Row>
      <div>
        <h2 style={{fontSize:18,fontWeight:700,color:C.white,marginBottom:4}}>{exerciseName}</h2>
        <p style={{fontSize:12,color:C.muted}}>
          {allLogs.length} total sets logged · {validLogs.length} valid{exMode==='normal'?' for e1RM':' for tracking'}
          {excludedCount>0&&<span style={{color:C.orange}}> · {excludedCount} excluded</span>}
        </p>
        <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center',marginTop:8}}>
          <span style={{fontSize:9,color:C.faint,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em',marginRight:2}}>Measure as</span>
          {[['normal','Standard'],['isometric','Isometric'],['assisted','Assisted'],['band','Band-assisted']].map(([m,lbl])=>(
            <button key={m} onClick={()=>{setExMode(exerciseName, m); setModeTick(t=>t+1)}}
              style={{padding:'4px 11px',borderRadius:20,fontSize:11,fontWeight:700,cursor:'pointer',border:`1px solid ${exMode===m?C.amber:C.border}`,background:exMode===m?C.amber:'transparent',color:exMode===m?C.bg:C.muted}}>{lbl}</button>
          ))}
          <button onClick={()=>{setExMode(exerciseName,'auto'); setModeTick(t=>t+1)}} title="Reset to auto-detected" style={{padding:'4px 9px',borderRadius:20,fontSize:11,fontWeight:700,cursor:'pointer',border:`1px solid ${C.border}`,background:'transparent',color:C.faint}}>Auto</button>
        </div>
      </div>
      {pb ? (
        <Card style={{borderColor:`${C.gold}40`,background:`${C.gold}08`}}>
          <div style={{fontSize:10,fontWeight:700,color:C.gold,textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:8}}>Personal Best</div>
          <Row style={{alignItems:'flex-end',gap:16,flexWrap:'wrap'}}>
            <div><div style={{fontSize:32,fontWeight:700,color:C.white}}>{(isAssisted||isIso)?`${pb.load}kg`:`${pb.e1rm}kg`}</div><div style={{fontSize:12,color:C.muted}}>{isAssisted?'Least Assistance':isIso?'Heaviest Load':'Estimated 1RM'}</div></div>
            <div style={{flex:1}}>
              <Row style={{gap:12,flexWrap:'wrap',marginBottom:6}}><span style={{fontSize:13,color:C.amber,fontWeight:600}}>{pb.rawLoad}{!isNaN(parseFloat(pb.rawLoad))?'kg':''} × {pb.reps} reps</span><span style={{fontSize:12,color:C.muted}}>{pb.dateStr} · {pb.sessName}</span></Row>
              {exMode==='normal'
                ? <div style={{fontSize:12,color:C.dim,background:`${C.faint}`,borderRadius:6,padding:'6px 10px',fontFamily:'monospace'}}>e1RM = {pb.rawLoad} × (1 + {pb.reps}/30) = <strong style={{color:C.gold}}>{pb.e1rm}kg</strong></div>
                : <div style={{fontSize:11,color:C.dim,background:`${C.faint}`,borderRadius:6,padding:'6px 10px'}}>{isAssisted?'Assisted lift — less assistance is better, so your lowest load is the best result.':'Isometric — no rep-based 1RM; tracking heaviest load / longest hold instead.'}</div>}
            </div>
          </Row>
        </Card>
      ) : (<Card style={{textAlign:'center',padding:20}}><p style={{color:C.muted}}>{isBand?'Band-assisted — see band history below.':'No valid sets found yet.'}</p></Card>)}
      {invalidCount>0&&<div style={{background:`${C.orange}12`,border:`1px solid ${C.orange}40`,borderRadius:8,padding:'10px 14px'}}><div style={{fontSize:13,color:C.orange,fontWeight:600,marginBottom:4}}>⚠ {invalidCount} set{invalidCount!==1?'s':''} excluded (unrealistic values)</div><div style={{fontSize:12,color:C.muted}}>Sets with reps &gt; 50 or load &lt; 1kg are excluded.</div></div>}
      {chartData.length>=2&&!isBand&&(
        <div>
          <SL>Progress Trend</SL>
          {isAssisted&&<p style={{fontSize:11,color:C.faint,margin:'-4px 0 8px'}}>Assistance shown inverted — the line rises as assistance drops (improvement).</p>}
          {isIso&&<p style={{fontSize:11,color:C.faint,margin:'-4px 0 8px'}}>Showing load / hold — isometrics don't use a rep-based 1RM.</p>}
          <DualLineChart data={chartData} height={230} metricLabel={metricLabel} invertE1rm={isAssisted}/>
        </div>
      )}
      {isBand&&bandTimeline.length>0&&(
        <div>
          <SL>Band History</SL>
          <div style={{display:'flex',flexDirection:'column',gap:6}}>
            {bandTimeline.map((l,i)=>(
              <Row key={l.id} style={{alignItems:'center',gap:10}}>
                <span style={{width:10,height:10,borderRadius:'50%',background:C.amber,flexShrink:0,display:'inline-block'}}/>
                <span style={{fontSize:13,color:C.white,fontWeight:600,textTransform:'capitalize'}}>{l.bandColour}</span>
                <span style={{fontSize:11,color:C.muted}}>from {l.dateStr}</span>
                {i>0&&<Tag v="Band change" color={C.c2} small/>}
              </Row>
            ))}
          </div>
        </div>
      )}
      <div>
        <SL>All Logged Sets</SL>
        <p style={{fontSize:11,color:C.faint,margin:'-4px 0 8px'}}>
          Excluded sets are removed from PB calculations and all global trends. Move sends a set's data to a different canonical exercise.
        </p>
        <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',marginBottom:8}}>
          {!bulkMode
            ? <Btn label="Move multiple\u2026" variant="secondary" small onClick={()=>{setBulkMode(true);setBulkSel(new Set());setBulkPickerOpen(false)}}/>
            : <>
                <span style={{fontSize:11,color:C.amber,fontWeight:700}}>{bulkSel.size} selected</span>
                <Btn label="Select all" variant="ghost" small onClick={()=>setBulkSel(new Set(allLogs.filter(l=>!l.invalid).map(l=>l.id)))}/>
                <Btn label="Clear" variant="ghost" small onClick={()=>setBulkSel(new Set())}/>
                <Btn label={`Move ${bulkSel.size} to\u2026`} small disabled={bulkSel.size===0} onClick={()=>setBulkPickerOpen(o=>!o)}/>
                <Btn label="Cancel" variant="ghost" small onClick={()=>{setBulkMode(false);setBulkSel(new Set());setBulkPickerOpen(false)}}/>
              </>
          }
        </div>
        {bulkStatus&&<div style={{fontSize:11,color:C.green,fontWeight:600,marginBottom:8}}>{bulkStatus}</div>}
        {bulkMode&&bulkPickerOpen&&(
          <div style={{background:`${C.amber}06`,border:`1px solid ${C.amber}30`,borderRadius:8,padding:'10px 14px',marginBottom:10}}>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8,flexWrap:'wrap'}}>
              <span style={{fontSize:11,fontWeight:600,color:C.amber,textTransform:'uppercase',letterSpacing:'0.05em'}}>Move {bulkSel.size} set{bulkSel.size!==1?'s':''} to:</span>
              <input value={bulkSearch} onChange={e=>setBulkSearch(e.target.value)} placeholder="Search exercises\u2026" autoFocus style={{...iS,flex:1,maxWidth:260,fontSize:12,padding:'4px 8px'}}/>
            </div>
            <div style={{display:'flex',flexWrap:'wrap',gap:5,maxHeight:160,overflowY:'auto'}}>
              {canonicalExs.filter(n=>!bulkSearch||n.toLowerCase().includes(bulkSearch.toLowerCase())).slice(0,40).map(n=>(
                <button key={n} onClick={()=>bulkMove(n)} style={{background:'transparent',border:`1px solid ${C.border}`,borderRadius:4,padding:'4px 10px',color:C.white,fontSize:11,cursor:'pointer'}}
                  onMouseEnter={e=>e.currentTarget.style.background=`${C.amber}15`} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>{n}</button>
              ))}
              {canonicalExs.filter(n=>!bulkSearch||n.toLowerCase().includes(bulkSearch.toLowerCase())).length===0&&<span style={{fontSize:11,color:C.faint,padding:'4px 8px'}}>No matches.</span>}
            </div>
          </div>
        )}
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
            <thead><tr style={{borderBottom:`1px solid ${C.border}`}}>{[...(bulkMode?['\u2713']:[]),'Date','Session','Set','Load','Reps','e1RM','Actions'].map(h=>(<th key={h} style={{textAlign:'left',padding:'6px 8px',fontSize:9,color:C.amber,textTransform:'uppercase',letterSpacing:'0.06em',fontWeight:700,whiteSpace:'nowrap'}}>{h}</th>))}</tr></thead>
            <tbody>
              {allLogs.map(log=>{
                const isExcluded = log.excluded
                const isReassigned = !!log.reassignedTo
                const isBest = pb && log.id===pb.id
                const bgColor = isBest?`${C.gold}10`:isExcluded?`${C.faint}`:isReassigned?`${C.c2}08`:log.invalid?`${C.red}08`:'transparent'
                const isReassigning = reassignFor===log.id
                const filteredExs = canonicalExs.filter(n=>!reassignSearch||n.toLowerCase().includes(reassignSearch.toLowerCase()))
                return(
                  <React.Fragment key={log.id}>
                    <tr style={{borderBottom:isReassigning?'none':`1px solid ${C.border}`,background:bgColor,opacity:isExcluded?0.45:1}}>
                      {bulkMode&&<td style={{padding:'7px 8px',textAlign:'center'}}>{!log.invalid&&<input type="checkbox" checked={bulkSel.has(log.id)} onChange={()=>setBulkSel(p=>{const n=new Set(p);n.has(log.id)?n.delete(log.id):n.add(log.id);return n})} style={{cursor:'pointer',width:15,height:15,accentColor:C.amber}}/>}</td>}
                      <td style={{padding:'7px 8px',color:C.muted,whiteSpace:'nowrap'}}>{log.dateStr}</td>
                      <td style={{padding:'7px 8px',color:C.white,maxWidth:140,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                        {log.sessName}
                        {isReassigned&&<div style={{fontSize:9,color:C.c2,marginTop:1}}>↪ moved from {log.parentExName}</div>}
                      </td>
                      <td style={{padding:'7px 8px',color:C.muted,textAlign:'center'}}>Set {log.setNumber}</td>
                      <td style={{padding:'7px 8px',color:C.amber,fontWeight:600,fontFamily:'monospace'}}>
                        {log.bandColour
                          ? <span style={{textTransform:'capitalize',color:C.c3}}>{log.bandColour} band</span>
                          : <>{log.rawLoad}{log.rawLoad&&!isNaN(parseFloat(log.rawLoad))&&<span style={{color:C.faint,fontSize:10,fontWeight:400}}> kg</span>}</>}
                      </td>
                      <td style={{padding:'7px 8px',color:log.reps>50?C.red:C.white,fontFamily:'monospace'}}>{log.rawReps}{log.reps>50&&<span style={{color:C.red,fontSize:10,marginLeft:4}}></span>}</td>
                      <td style={{padding:'7px 8px',fontWeight:700,color:isBest?C.gold:log.e1rm?C.green:C.faint}}>{isBest&&'🏆 '}{log.e1rm?`${log.e1rm}kg`:'—'}</td>
                      <td style={{padding:'7px 8px',textAlign:'left'}}>
                        {!log.invalid&&(
                          <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                            <button onClick={()=>toggleExclude(log)} style={{background:isExcluded?`${C.green}20`:`${C.red}15`,border:`1px solid ${isExcluded?C.green:C.red}40`,borderRadius:4,padding:'2px 7px',color:isExcluded?C.green:C.red,fontSize:10,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap'}}>{isExcluded?'Include':'Exclude'}</button>
                            {isReassigned
                              ? <button onClick={()=>clearReassign(log)} style={{background:`${C.c2}20`,border:`1px solid ${C.c2}40`,borderRadius:4,padding:'2px 7px',color:C.c2,fontSize:10,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap'}}>Restore</button>
                              : <button onClick={()=>{setReassignFor(isReassigning?null:log.id);setReassignSearch('')}} style={{background:isReassigning?`${C.amber}20`:'transparent',border:`1px solid ${C.border}`,borderRadius:4,padding:'2px 7px',color:isReassigning?C.amber:C.muted,fontSize:10,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap'}}>{isReassigning?'Cancel':'Move…'}</button>
                            }
                          </div>
                        )}
                      </td>
                    </tr>
                    {isReassigning&&(
                      <tr style={{background:`${C.amber}06`,borderBottom:`1px solid ${C.border}`}}>
                        <td colSpan={bulkMode?8:7} style={{padding:'10px 14px'}}>
                          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
                            <span style={{fontSize:11,fontWeight:600,color:C.amber,textTransform:'uppercase',letterSpacing:'0.05em'}}>Move this set's data to:</span>
                            <input
                              value={reassignSearch}
                              onChange={e=>setReassignSearch(e.target.value)}
                              placeholder="Search exercises…"
                              autoFocus
                              style={{...iS,flex:1,maxWidth:260,fontSize:12,padding:'4px 8px'}}
                            />
                          </div>
                          <div style={{display:'flex',flexWrap:'wrap',gap:5,maxHeight:140,overflowY:'auto'}}>
                            {filteredExs.length===0
                              ? <span style={{fontSize:11,color:C.faint,padding:'4px 8px'}}>No matches.</span>
                              : filteredExs.slice(0,40).map(n=>(
                                  <button key={n} onClick={()=>reassign(log, n)}
                                    style={{background:'transparent',border:`1px solid ${C.border}`,borderRadius:4,padding:'4px 10px',color:C.white,fontSize:11,cursor:'pointer',transition:'background 0.1s'}}
                                    onMouseEnter={e=>e.currentTarget.style.background=`${C.amber}15`}
                                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                                    {n}
                                  </button>
                                ))
                            }
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
          {allLogs.length===0&&<p style={{color:C.faint,fontSize:13,padding:'14px 8px'}}>No sets logged yet.</p>}
        </div>
      </div>
    </div>
  )
}

const PROGRESS_PERIODS = [
  {id:'2w',  label:'2 Weeks',  days:14},
  {id:'30d', label:'30 Days',  days:30},
  {id:'60d', label:'60 Days',  days:60},
  {id:'90d', label:'90 Days',  days:90},
  {id:'all', label:'All Time', days:null},
  {id:'custom', label:'Custom', days:null},
]

function ProgressTab({clientId,sessions,allSessions,weeks,programs,av=0,updateSession,focusEx,onFocusHandled}){  // av = analyticsVersion; changes trigger full recompute
  const _allSess = allSessions||sessions  // allSessions for date calc; fallback to sessions if not provided
  const allPBs = getClientPBs(clientId,sessions,_allSess,weeks,programs)
  const [detailEx, setDetailEx]   = useState(null)
  useEffect(()=>{ if(focusEx){ setDetailEx(focusEx); onFocusHandled && onFocusHandled() } }, [focusEx])
  const [period,   setPeriod]     = useState('all')
  const [fromDate, setFromDate]   = useState('')
  const [toDate,   setToDate]     = useState('')
  const [exSearch, setExSearch]   = useState('')

  // Derive cutoff dates from selected period
  const cutoff = (() => {
    if(period==='custom') return fromDate ? new Date(fromDate+'T00:00:00') : null
    const p = PROGRESS_PERIODS.find(p=>p.id===period)
    if(!p?.days) return null
    const d = new Date(); d.setDate(d.getDate()-p.days); return d
  })()
  const ceiling = period==='custom'&&toDate ? new Date(toDate+'T23:59:59') : new Date()
  const periodLabel = PROGRESS_PERIODS.find(p=>p.id===period)?.label || 'Custom'

  // Annotate each PB with period-filtered history + lifetime % change + recent-5-exposures trend
  const pbs = allPBs.map(pb => {
    const ph = pb.history.filter(h => h.date && (!cutoff||h.date>=cutoff) && h.date<=ceiling)
    const first = ph[0], last = ph[ph.length-1]
    const pct = (first&&last&&first!==last&&first.e1rm>0)
      ? Math.round(((last.e1rm-first.e1rm)/first.e1rm)*1000)/10  // lifetime % change in selected period
      : null
    // Recent trend — last 5 valid exposures from full history (program-gap agnostic)
    const recent = pb.history.filter(h => h.e1rm > 0).slice(-5)
    let recentPct = null, recentCount = recent.length
    if(recent.length >= 2 && recent[0].e1rm > 0) {
      recentPct = Math.round(((recent[recent.length-1].e1rm - recent[0].e1rm) / recent[0].e1rm) * 1000) / 10
    }
    return {...pb, ph, first, last, pct, recentPct, recentCount}
  }).filter(pb => period==='all' ? pb.history.length>0 : pb.ph.length>0)
    .filter(pb => !exSearch.trim() || pb.name.toLowerCase().includes(exSearch.toLowerCase().trim()))

  if(detailEx) return(
    <ExerciseDetail exerciseName={detailEx} clientId={clientId} sessions={sessions} allSessions={allSessions} weeks={weeks} programs={programs} updateSession={updateSession} onBack={()=>setDetailEx(null)}/>
  )

  const pctColor = p => p===null?C.faint : p>5?C.green : p>0?'#86EFAC' : p===0?C.muted : p>-5?C.orange : C.red

  return(
    <div style={{display:'flex',flexDirection:'column',gap:16}}>

      {/* ── Period selector ───────────────────────────────────── */}
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:'12px 14px'}}>
        <div style={{fontSize:10,color:C.amber,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:8}}>Time Period</div>
        <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
          {PROGRESS_PERIODS.map(({id,label})=>(
            <button key={id} onClick={()=>setPeriod(id)} style={{
              padding:'5px 14px', borderRadius:20, fontSize:12, fontWeight:600, cursor:'pointer',
              border:`1.5px solid ${period===id?C.amber:C.border}`,
              background: period===id?`${C.amber}20`:'transparent',
              color: period===id?C.amber:C.muted,
              transition:'all 0.1s',
            }}>{label}</button>
          ))}
        </div>
        {period==='custom'&&(
          <div style={{display:'flex',gap:12,marginTop:10,flexWrap:'wrap',alignItems:'flex-end'}}>
            <div>
              <label style={{fontSize:10,color:C.faint,display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.06em'}}>From</label>
              <input type="date" value={fromDate} onChange={e=>setFromDate(e.target.value)} style={{...iS,width:140}}/>
            </div>
            <div>
              <label style={{fontSize:10,color:C.faint,display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.06em'}}>To</label>
              <input type="date" value={toDate} onChange={e=>setToDate(e.target.value)} style={{...iS,width:140}}/>
            </div>
            {fromDate&&<div style={{fontSize:11,color:C.muted,paddingBottom:8}}>
              {Math.round((ceiling-cutoff)/(1000*60*60*24))} day window
            </div>}
          </div>
        )}
      </div>

      {/* ── Summary strip ─────────────────────────────────────── */}
      {pbs.length>0&&(()=>{
        const improving = pbs.filter(p=>p.pct!==null&&p.pct>0).length
        const flat      = pbs.filter(p=>p.pct!==null&&p.pct===0).length
        const declining = pbs.filter(p=>p.pct!==null&&p.pct<0).length
        const noData    = pbs.filter(p=>p.pct===null).length
        const avgPct    = pbs.filter(p=>p.pct!==null&&p.pct>0).reduce((a,p)=>a+p.pct,0) / (improving||1)
        return(
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            {[
              {v:improving, l:'Improving',  c:C.green},
              {v:flat,      l:'Flat',        c:C.muted},
              {v:declining, l:'Declining',   c:C.red},
              {v:noData,    l:'1 session',   c:C.faint},
              improving>0&&{v:`+${Math.round(avgPct*10)/10}%`, l:'Avg gain', c:C.amber},
            ].filter(Boolean).map(({v,l,c})=>(
              <div key={l} style={{flex:1,minWidth:80,background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:'8px 12px',textAlign:'center'}}>
                <div style={{fontSize:18,fontWeight:700,color:c}}>{v}</div>
                <div style={{fontSize:10,color:C.faint,textTransform:'uppercase',letterSpacing:'0.06em',marginTop:2}}>{l}</div>
              </div>
            ))}
          </div>
        )
      })()}

      {/* ── Main table ────────────────────────────────────────── */}
      <div>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10,flexWrap:'wrap'}}>
          <SL style={{margin:0,flex:1}}>
            e1RM Progress — {periodLabel}
            <span style={{fontSize:10,color:C.muted,fontWeight:400,textTransform:'none',letterSpacing:0}}> · click any row for full history</span>
          </SL>
          <div style={{position:'relative',flexShrink:0}}>
            <input
              value={exSearch}
              onChange={e=>setExSearch(e.target.value)}
              placeholder="Search exercise…"
              style={{...iS,width:200,paddingLeft:28,fontSize:12,padding:'6px 10px 6px 28px'}}
            />
            <span style={{position:'absolute',left:9,top:'50%',transform:'translateY(-50%)',color:C.faint,fontSize:13,pointerEvents:'none'}}>⌕</span>
            {exSearch&&<button onClick={()=>setExSearch('')} style={{position:'absolute',right:7,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',color:C.faint,cursor:'pointer',fontSize:12,lineHeight:1,padding:0}}>✕</button>}
          </div>
        </div>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
            <thead>
              <tr style={{borderBottom:`1px solid ${C.border}`}}>
                {['Exercise','Current e1RM',`Last 5 Exposures`,`All Time`,``].map(h=>(
                  <th key={h} style={{textAlign:'left',padding:'7px 10px',fontSize:10,color:C.amber,textTransform:'uppercase',letterSpacing:'0.06em',fontWeight:700,whiteSpace:'nowrap'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pbs.map(pb=>{
                const pct = pb.pct
                const pc  = pctColor(pct)
                return(
                  <tr key={pb.name}
                    style={{borderBottom:`1px solid ${C.border}`,cursor:'pointer',transition:'background 0.1s'}}
                    onMouseEnter={e=>e.currentTarget.style.background=`${C.c1}10`}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}
                    onClick={()=>setDetailEx(pb.name)}>

                    {/* Exercise name */}
                    <td style={{padding:'9px 10px',color:C.white,fontWeight:600}}>{pb.name}</td>

                    {/* Current e1RM */}
                    <td style={{padding:'9px 10px'}}>
                      {pb.last
                        ? <><div style={{color:C.amber,fontWeight:700}}>{Math.round(pb.last.e1rm*10)/10}kg</div>
                            <div style={{fontSize:10,color:C.faint,marginTop:1}}>{pb.last.dateStr}</div></>
                        : <span style={{color:C.faint}}>—</span>}
                    </td>

                    {/* Recent trend — last 5 exposures, gap-agnostic */}
                    <td style={{padding:'9px 10px',minWidth:120}}>
                      {pb.recentPct === null ? (
                        <span style={{fontSize:11,color:C.faint}}>Need 2+ logs</span>
                      ) : (()=>{
                        const arrow = pb.recentPct > 0.5 ? '↑' : pb.recentPct < -0.5 ? '↓' : '→'
                        // Map % to traffic-light gradient: -10% → red, 0 → amber, +10% → green
                        const tcPos = Math.max(0, Math.min(100, 50 + pb.recentPct * 5))
                        const col = trafficColor(tcPos)
                        return (
                          <div style={{display:'inline-flex',flexDirection:'column',gap:1}}>
                            <span style={{fontSize:13,fontWeight:700,color:col,fontFamily:'monospace',whiteSpace:'nowrap'}}>
                              {arrow} {pb.recentPct >= 0 ? '+' : ''}{pb.recentPct}%
                            </span>
                            <span style={{fontSize:10,color:C.faint,whiteSpace:'nowrap'}}>across {pb.recentCount} session{pb.recentCount!==1?'s':''}</span>
                          </div>
                        )
                      })()}
                    </td>

                    {/* All Time % change — within selected period */}
                    <td style={{padding:'9px 10px',minWidth:90}}>
                      {pct===null
                        ? <span style={{fontSize:11,color:C.faint}}>{pb.ph.length===1?'1 session only':'—'}</span>
                        : <div style={{display:'inline-flex',alignItems:'center',gap:5,background:`${pc}15`,border:`1px solid ${pc}40`,borderRadius:6,padding:'3px 9px'}}>
                            <span style={{fontSize:14,fontWeight:700,color:pc}}>{pct>0?'+':''}{pct}%</span>
                          </div>
                      }
                    </td>

                    <td style={{padding:'9px 10px',color:C.faint,fontSize:12}}>View →</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {pbs.length===0&&(
            <div style={{padding:'24px 10px',textAlign:'center'}}>
              {exSearch
                ? <><p style={{color:C.muted,marginBottom:6}}>No exercises matching <span style={{color:C.amber,fontWeight:600}}>"{exSearch}"</span>.</p><button onClick={()=>setExSearch('')} style={{background:'none',border:'none',color:C.amber,fontSize:12,cursor:'pointer',fontWeight:700}}>Clear search</button></>
                : <><p style={{color:C.muted,marginBottom:4}}>No logged sets in this period.</p><p style={{fontSize:12,color:C.faint}}>Try a longer window or select All Time.</p></>
              }
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── BODY TAB ─────────────────────────────────────────────────────────────────
const MEAS_FIELDS = [
  {key:'body_weight_kg',label:'Body Weight',unit:'kg'},{key:'body_fat_pct',label:'Body Fat',unit:'%'},
  {key:'waist_cm',label:'Waist',unit:'cm'},{key:'hips_cm',label:'Hips',unit:'cm'},
  {key:'chest_cm',label:'Chest',unit:'cm'},{key:'left_arm_cm',label:'Left Arm',unit:'cm'},
  {key:'right_arm_cm',label:'Right Arm',unit:'cm'},{key:'left_thigh_cm',label:'Left Thigh',unit:'cm'},
  {key:'right_thigh_cm',label:'Right Thigh',unit:'cm'},{key:'left_calf_cm',label:'Left Calf',unit:'cm'},
  {key:'right_calf_cm',label:'Right Calf',unit:'cm'},
]
const BLANK_MEAS = {measured_at:new Date().toISOString().split('T')[0],body_weight_kg:'',body_fat_pct:'',waist_cm:'',hips_cm:'',chest_cm:'',left_arm_cm:'',right_arm_cm:'',left_thigh_cm:'',right_thigh_cm:'',left_calf_cm:'',right_calf_cm:'',notes:''}

function BodyTab({clientId,measurements,addMeasurement,deleteMeasurement,saving}){
  const cMeas=[...measurements.filter(m=>m.client_id===clientId)].sort((a,b)=>new Date(b.measured_at)-new Date(a.measured_at))
  const [adding,setAdding]=useState(false)
  const [f,setF]=useState(BLANK_MEAS)
  const ff=k=>v=>setF(p=>({...p,[k]:v}))
  const save=async()=>{
    const d={...f,client_id:clientId}
    MEAS_FIELDS.forEach(({key})=>{if(d[key]==='')d[key]=null;else if(d[key])d[key]=parseFloat(d[key])})
    await addMeasurement(d);setF(BLANK_MEAS);setAdding(false)
  }
  const latest=cMeas[0]
  const weightData=[...cMeas].reverse().filter(m=>m.body_weight_kg).map(m=>({date:new Date(m.measured_at+'T00:00:00').toLocaleDateString('en-AU',{day:'numeric',month:'short'}),weight:parseFloat(m.body_weight_kg)}))
  return(
    <div style={{display:'flex',flexDirection:'column',gap:20}}>
      {latest&&(
        <div>
          <SL>Latest ({new Date(latest.measured_at+'T00:00:00').toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'numeric'})})</SL>
          <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
            {MEAS_FIELDS.filter(({key})=>latest[key]!=null).map(({key,label,unit})=>(<div key={key} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:'10px 14px',minWidth:90,textAlign:'center'}}><div style={{fontSize:18,fontWeight:700,color:C.white}}>{latest[key]}</div><div style={{fontSize:10,color:C.muted,textTransform:'uppercase',letterSpacing:'0.05em',marginTop:2}}>{label}</div><div style={{fontSize:10,color:C.faint}}>{unit}</div></div>))}
          </div>
        </div>
      )}
      {weightData.length>=2&&(<div><SL>Weight Trend (kg)</SL><SvgLineChart data={weightData} xKey="date" yKey="weight" color={C.c2} height={180} label="kg"/></div>)}
      <div>
        <SL right={!adding&&<Btn label="+ Add Measurement" small onClick={()=>{setF(BLANK_MEAS);setAdding(true)}}/>}>Measurement History</SL>
        {adding&&(
          <Panel style={{marginBottom:12}}>
            <h4 style={{color:C.white,marginBottom:10}}>New Measurement</h4>
            <div style={{marginBottom:10}}><TI label="Date" value={f.measured_at} onChange={ff('measured_at')} type="date"/></div>
            <G3 style={{marginBottom:8}}>{MEAS_FIELDS.slice(0,3).map(({key,label,unit})=>(<TI key={key} label={`${label} (${unit})`} value={f[key]} onChange={ff(key)} placeholder="—" type="number"/>))}</G3>
            <G4 style={{marginBottom:8}}>{MEAS_FIELDS.slice(3,7).map(({key,label,unit})=>(<TI key={key} label={`${label} (${unit})`} value={f[key]} onChange={ff(key)} placeholder="—" type="number"/>))}</G4>
            <G4 style={{marginBottom:10}}>{MEAS_FIELDS.slice(7).map(({key,label,unit})=>(<TI key={key} label={`${label} (${unit})`} value={f[key]} onChange={ff(key)} placeholder="—" type="number"/>))}</G4>
            <div style={{marginBottom:10}}><TA label="Notes" value={f.notes} onChange={ff('notes')} rows={2}/></div>
            <Row><Btn label="Save" onClick={save} loading={saving}/><Btn label="Cancel" variant="secondary" onClick={()=>setAdding(false)}/></Row>
          </Panel>
        )}
        {cMeas.length===0&&!adding&&<p style={{fontSize:13,color:C.faint}}>No measurements logged yet.</p>}
        {cMeas.map(m=>(
          <div key={m.id} style={{borderBottom:`1px solid ${C.border}`,padding:'9px 4px',display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
            <span style={{fontSize:12,color:C.amber,fontWeight:600,minWidth:90}}>{new Date(m.measured_at+'T00:00:00').toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'numeric'})}</span>
            {MEAS_FIELDS.filter(({key})=>m[key]!=null).map(({key,label,unit})=>(<span key={key} style={{fontSize:12,color:C.muted}}>{label}: <strong style={{color:C.white}}>{m[key]}{unit}</strong></span>))}
            <button onClick={()=>{if(window.confirm('Delete measurement?'))deleteMeasurement(m.id)}} style={{background:'none',border:'none',color:C.faint,cursor:'pointer',fontSize:12,marginLeft:'auto',padding:0}}>✕</button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── CLIENT DASHBOARD ─────────────────────────────────────────────────────────
function ClientDashboard({clientId,...props}){
  const {clients,programs,weeks,sessions,measurements,goals,flags,addGoal,updateGoal,deleteGoal,addFlag,updateFlag,deleteFlag,addMeasurement,deleteMeasurement,saving,go} = props
  const client = clients.find(c=>c.id===clientId)
  const [tab,setTab] = useState('overview')
  if(!client) return <div style={{padding:20,color:C.muted}}>Client not found.</div>
  const clientProgs = [...programs.filter(p=>p.client_id===clientId)].sort((a,b)=>{
    if(a.start_date&&b.start_date) return new Date(b.start_date)-new Date(a.start_date)
    if(a.start_date) return -1; if(b.start_date) return 1
    const na=parseInt((a.name||'').match(/\d+/)?.[0]||0), nb=parseInt((b.name||'').match(/\d+/)?.[0]||0)
    if(na!==nb) return nb-na
    return new Date(b.created_at||0)-new Date(a.created_at||0)
  })
  const current=clientProgs.filter(p=>p.status==='current'), complete=clientProgs.filter(p=>p.status==='complete')
  const clientSess=sessions.filter(s=>s.client_id===clientId)
  const doneSess=clientSess.filter(s=>computeSessionStatus(s)==='complete').length
  const cGoals=goals.filter(g=>g.client_id===clientId&&g.status==='active')
  const activeFlags=generateAutoFlags(client,clientSess,sessions,programs,weeks).length+flags.filter(f=>f.client_id===clientId&&!f.is_resolved).length
  const latestMeas=[...measurements.filter(m=>m.client_id===clientId)].sort((a,b)=>new Date(b.measured_at)-new Date(a.measured_at))[0]
  const TABS = [{id:'overview',l:'Overview'},{id:'programs',l:'Programs'},{id:'progress',l:'Progress'},{id:'body',l:'Body'},{id:'calendar',l:'Calendar'}]
  return(
    <div style={{maxWidth:960,margin:'0 auto'}}>
      <div style={{background:`linear-gradient(135deg, ${C.ink} 0%, #0a0f1e 100%)`,borderBottom:`1px solid ${C.border}`,padding:'20px 20px 0'}}>
        <Breadcrumb items={[{label:'Clients',onClick:()=>go('clients')},{label:client.name}]}/>
        <Row style={{alignItems:'flex-start',marginBottom:16,gap:16}}>
          <div style={{width:64,height:64,borderRadius:'50%',background:`linear-gradient(135deg,${C.c1},${C.c2})`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:24,fontWeight:700,color:C.white,flexShrink:0}}>
            {client.name.split(' ').map(n=>n[0]).slice(0,2).join('').toUpperCase()}
          </div>
          <div style={{flex:1}}>
            <Row style={{alignItems:'center',gap:10,marginBottom:3,flexWrap:'wrap'}}>
              <h1 style={{fontSize:22,fontWeight:700,color:C.white,fontFamily:'Space Grotesk, sans-serif'}}>{client.name}</h1>
              <Tag v={client.status} color={client.status==='active'?C.green:C.muted} small/>
              {client.group_label&&<Tag v={client.group_label} color={C.c2} small/>}{client.pain_flag&&<Tag v="Pain Flag" color={C.red} small/>}
            </Row>
            <Row style={{gap:12,flexWrap:'wrap',marginBottom:6}}>
              {client.goal&&<span style={{fontSize:12,color:C.muted}}>Goal: {client.goal}</span>}
              {latestMeas?.body_weight_kg&&<span style={{fontSize:12,color:C.c3}}>{latestMeas.body_weight_kg}kg</span>}
            </Row>
            <Row style={{gap:16,flexWrap:'wrap'}}>
              {[{v:current.length,l:'Active programs'},{v:doneSess,l:'Sessions done'},{v:cGoals.length,l:'Active goals'},{v:activeFlags>0?activeFlags:null,l:'Flags',c:activeFlags>0?C.orange:C.green}].map(x=>x.v!=null&&(<div key={x.l}><span style={{fontSize:16,fontWeight:700,color:x.c||C.white}}>{x.v}</span><span style={{fontSize:11,color:C.faint,marginLeft:5}}>{x.l}</span></div>))}
            </Row>
          </div>
          <Row style={{gap:8,flexShrink:0}}>
            <Btn label="View as Client" variant="secondary" small onClick={()=>props.previewAsClient&&props.previewAsClient(clientId)}/>
            <Btn label="Edit Client" variant="secondary" small onClick={()=>go('editclient',{clientId})}/>
          </Row>
        </Row>
        <ClientAccessPanel client={client} updateClient={props.updateClient}/>
        <Row style={{gap:0,marginBottom:0}}>
          {TABS.map(t=>(<button key={t.id} onClick={()=>setTab(t.id)} style={{padding:'10px 18px',border:'none',borderBottom:`2px solid ${tab===t.id?C.amber:'transparent'}`,background:'transparent',color:tab===t.id?C.amber:C.muted,fontSize:13,fontWeight:600,cursor:'pointer',whiteSpace:'nowrap'}}>{t.l}</button>))}
        </Row>
      </div>
      <div style={{padding:'20px 20px'}}>
        {tab==='overview'&&(
          <div style={{display:'flex',flexDirection:'column',gap:24}}>
            {(current.length>0||complete.length>0)&&(()=>{
              const toShow=current.length>0?current.slice(0,2):complete.slice(0,1)
              return(<div><SL>Program Progress</SL>{toShow.map(prog=>{const ps=sessions.filter(s=>s.program_id===prog.id);const done=ps.filter(s=>computeSessionStatus(s)==='complete').length;const pct=ps.length>0?Math.round(done/ps.length*100):0;const isComplete=prog.status==='complete';return(<Card key={prog.id} onClick={()=>go('program',{programId:prog.id,clientId})} style={{cursor:'pointer',marginBottom:8,borderColor:isComplete?`${C.green}40`:undefined}}><Row style={{alignItems:'center'}}><div style={{flex:1}}><Row style={{alignItems:'center',gap:8,marginBottom:3}}><span style={{fontWeight:700,color:C.white}}>{prog.name}</span><Tag v={isComplete?'Complete':prog.phase||'Current'} color={isComplete?C.green:C.amber} small/></Row><Row style={{justifyContent:'space-between',marginBottom:3}}><span style={{fontSize:12,color:C.muted}}>{done}/{ps.length} sessions</span><span style={{fontSize:12,fontWeight:700,color:trafficColor(pct)}}>{pct}%</span></Row><ProgressBar value={pct}/></div><span style={{color:C.faint,marginLeft:12}}>›</span></Row></Card>)})}</div>)
            })()}
            <GoalsSection clientId={clientId} goals={goals} addGoal={addGoal} updateGoal={updateGoal} deleteGoal={deleteGoal} saving={saving}/>
            <FlagsSection clientId={clientId} sessions={sessions} programs={programs} weeks={weeks} flags={flags} addFlag={addFlag} updateFlag={updateFlag} deleteFlag={deleteFlag} saving={saving}/>
            <div>
              <SL>Recent Sessions</SL>
              {clientSess.slice(-5).reverse().map(sess=>{
                const prog=programs.find(p=>p.id===sess.program_id);const status=computeSessionStatus(sess);const {color}=STATUS[status]||STATUS.not_started
                return(<div key={sess.id} onClick={()=>go('session',{sessionId:sess.id,programId:sess.program_id,clientId})} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 4px',borderBottom:`1px solid ${C.border}`,cursor:'pointer'}}><span style={{width:8,height:8,borderRadius:'50%',background:color,flexShrink:0}}/><span style={{flex:1,fontSize:13,color:C.white}}>{sess.name}</span><span style={{fontSize:11,color:C.muted}}>{prog?.name}</span><Tag v={STATUS[status]?.label} color={color} small/></div>)
              })}
              {clientSess.length===0&&<p style={{fontSize:13,color:C.faint}}>No sessions yet.</p>}
            </div>
          </div>
        )}
        {tab==='programs'&&<ClientDetail {...props} clientId={clientId}/>}
        {tab==='progress'&&<ProgressTab clientId={clientId} sessions={sessions.filter(s=>s.client_id===clientId)} allSessions={sessions} weeks={weeks} programs={programs} av={props.av||0} updateSession={props.updateSession}/>}
        {tab==='body'&&<BodyTab clientId={clientId} measurements={measurements} addMeasurement={addMeasurement} deleteMeasurement={deleteMeasurement} saving={saving}/>}
        {tab==='calendar'&&<CalendarView sessions={sessions.filter(s=>s.client_id===clientId)} weeks={weeks} programs={programs} clients={clients} go={go} isClientView={true}/>}
      </div>
    </div>
  )
}

// ─── LIBRARY ──────────────────────────────────────────────────────────────────
// Highlight matching text in search results
function HL({ text, q }) {
  if(!q||!q.trim()) return <>{text}</>
  const lo = text.toLowerCase(), qi = q.toLowerCase().trim()
  const idx = lo.indexOf(qi)
  if(idx === -1) return <>{text}</>
  return <>{text.slice(0,idx)}<span style={{background:`${C.amber}50`,color:C.white,borderRadius:2,padding:'0 1px',fontWeight:700}}>{text.slice(idx,idx+qi.length)}</span>{text.slice(idx+qi.length)}</>
}

const LIMB_DETECT = (name) => {
  const n = (name||'').toLowerCase()
  if(/\b(single|unilateral|1[\s-]?arm|one[\s-]?arm|1[\s-]?leg|one[\s-]?leg|rfess|split squat|lunge|step.?up|bulgarian|pistol)\b/.test(n)) return 'Unilateral'
  return 'Bilateral'
}

function LibraryView({ sessions = [], av=0 }) {
  const [search,  setSearch]  = useState('')
  const [fp,      setFp]      = useState('')   // movement pattern
  const [fq,      setFq]      = useState('')   // quality
  const [fl,      setFl]      = useState('')   // limb
  const [fm,      setFm]      = useState('')   // muscle
  const [expand,  setExpand]  = useState(null)

  // Build combined exercise list: DEFAULT_LIB + all unique exercises from sessions
  const allExercises = React.useMemo(() => {
    const libNames = new Set(DEFAULT_LIB.map(e => e.name.toLowerCase()))
    const sessionNames = [...new Set(
      sessions.flatMap(s => safeExercises(s).filter(e => !e.isWarmup).map(e => e.name)).filter(Boolean)
    )]
    const sessionOnly = sessionNames
      .filter(n => !libNames.has(n.toLowerCase()))
      .map(name => {
        const pat = detectPattern(name)
        const patLabel = pat.charAt(0).toUpperCase() + pat.slice(1)
        const useCount = sessions.filter(s => safeExercises(s).some(e => e.name === name)).length
        return {
          id: 'sx_' + name, name,
          pattern: patLabel,
          quality: '',
          equip: 'Custom',
          limb: LIMB_DETECT(name),
          muscles: '',
          isCustom: true,
          useCount,
        }
      })
    return [
      ...DEFAULT_LIB.map(e => ({
        ...e, isCustom: false,
        useCount: sessions.filter(s => safeExercises(s).some(ex => ex.name.toLowerCase() === e.name.toLowerCase())).length,
      })),
      ...sessionOnly,
    ].sort((a,b) => {
      // Custom (session) exercises sorted by usage, library exercises alphabetically
      if(a.isCustom !== b.isCustom) return a.isCustom ? 1 : -1
      return a.name.localeCompare(b.name)
    })
  }, [sessions, av])

  // Unique filter options derived from data
  const patterns  = [...new Set(allExercises.map(e => e.pattern).filter(Boolean))].sort()
  const qualities = [...new Set(allExercises.map(e => e.quality).filter(Boolean))].sort()
  const muscles   = [...new Set(
    allExercises.flatMap(e => (e.muscles||'').split(',').map(m => m.trim())).filter(Boolean)
  )].sort()

  const filtered = allExercises.filter(e => {
    if(fp && e.pattern !== fp) return false
    if(fq && e.quality !== fq) return false
    if(fl && e.limb !== fl) return false
    if(fm && !(e.muscles||'').toLowerCase().includes(fm.toLowerCase())) return false
    if(search) {
      const s = search.toLowerCase().trim()
      return e.name.toLowerCase().includes(s) ||
             (e.muscles||'').toLowerCase().includes(s) ||
             (e.pattern||'').toLowerCase().includes(s) ||
             (e.quality||'').toLowerCase().includes(s) ||
             (e.equip||'').toLowerCase().includes(s)
    }
    return true
  })

  const libCount  = allExercises.filter(e => !e.isCustom).length
  const sessCount = allExercises.filter(e => e.isCustom).length

  const PillGroup = ({ label, value, setter, options, colorFn }) => (
    <div style={{marginBottom:10}}>
      <div style={{fontSize:9,color:C.amber,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:5}}>{label}</div>
      <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
        <button onClick={()=>setter('')} style={{padding:'3px 10px',borderRadius:20,border:`1.5px solid ${!value?C.amber:C.border}`,background:!value?`${C.amber}18`:'transparent',color:!value?C.amber:C.faint,fontSize:11,fontWeight:600,cursor:'pointer'}}>All</button>
        {options.map(o=>(
          <button key={o} onClick={()=>setter(value===o?'':o)}
            style={{padding:'3px 10px',borderRadius:20,border:`1.5px solid ${value===o?(colorFn?colorFn(o):C.amber):C.border}`,
              background:value===o?`${colorFn?colorFn(o):C.amber}18`:'transparent',
              color:value===o?(colorFn?colorFn(o):C.amber):C.faint,
              fontSize:11,fontWeight:600,cursor:'pointer'}}>
            {o}
          </button>
        ))}
      </div>
    </div>
  )

  return(
    <div style={{padding:20,maxWidth:1020,margin:'0 auto'}}>
      <Row style={{alignItems:'flex-start',justifyContent:'space-between',marginBottom:6,flexWrap:'wrap',gap:8}}>
        <div>
          <h1 style={{fontSize:22,fontWeight:700,color:C.white,fontFamily:'Space Grotesk,sans-serif',marginBottom:2}}>EXERCISE LIBRARY</h1>
          <p style={{fontSize:12,color:C.muted}}>
            {libCount} built-in · {sessCount} from your sessions · showing {filtered.length}
          </p>
        </div>
      </Row>

      {/* Search */}
      <div style={{position:'relative',marginBottom:16}}>
        <input
          value={search}
          onChange={e=>setSearch(e.target.value)}
          placeholder="Search by name, muscle, pattern, equipment…"
          style={{...iS,paddingLeft:36,fontSize:13}}
          autoComplete="off"
        />
        <span style={{position:'absolute',left:11,top:'50%',transform:'translateY(-50%)',color:C.faint,fontSize:15,pointerEvents:'none'}}>⌕</span>
        {search&&<button onClick={()=>setSearch('')} style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',color:C.faint,cursor:'pointer',fontSize:14}}>✕</button>}
      </div>

      {/* Filters */}
      <Card style={{marginBottom:16,padding:'12px 14px'}}>
        <PillGroup label="Movement Pattern" value={fp} setter={setFp} options={patterns} colorFn={p=>PC[p]||C.c2}/>
        <PillGroup label="Training Quality" value={fq} setter={setFq} options={qualities}/>
        <PillGroup label="Limb Type" value={fl} setter={setFl} options={['Bilateral','Unilateral']}/>
        {muscles.length>0&&<PillGroup label="Muscle Group" value={fm} setter={setFm} options={muscles}/>}
        {(fp||fq||fl||fm||search)&&(
          <button onClick={()=>{setFp('');setFq('');setFl('');setFm('');setSearch('')}}
            style={{marginTop:6,background:'none',border:'none',color:C.amber,fontSize:11,fontWeight:700,cursor:'pointer',padding:0}}>
            ✕ Clear all filters
          </button>
        )}
      </Card>

      {/* Results */}
      <div style={{display:'flex',flexDirection:'column',gap:4}}>
        {filtered.map(ex=>{
          const isExpanded = expand===ex.id
          const patColor = PC[ex.pattern]||C.c2
          return(
            <div key={ex.id}
              style={{background:C.card,border:`1px solid ${isExpanded?`${patColor}50`:C.border}`,borderRadius:9,overflow:'hidden',transition:'border-color 0.1s'}}
              onMouseEnter={e=>{if(!isExpanded)e.currentTarget.style.borderColor=`${patColor}40`}}
              onMouseLeave={e=>{if(!isExpanded)e.currentTarget.style.borderColor=C.border}}>

              {/* Main row */}
              <div onClick={()=>setExpand(isExpanded?null:ex.id)}
                style={{display:'flex',alignItems:'center',gap:10,padding:'9px 14px',cursor:'pointer',flexWrap:'wrap'}}>
                <span style={{fontWeight:600,color:C.white,fontSize:13,flex:'1 1 160px',minWidth:0}}>
                  <HL text={ex.name} q={search}/>
                  {ex.isCustom&&<span style={{fontSize:9,color:C.faint,fontWeight:400,marginLeft:6}}>custom</span>}
                </span>
                {ex.pattern&&<Tag v={ex.pattern} color={patColor} small/>}
                {ex.quality&&<Tag v={ex.quality} color={C.muted} small/>}
                {ex.limb&&<Tag v={ex.limb} color={ex.limb==='Unilateral'?C.purple:C.faint} small/>}
                {ex.equip&&ex.equip!=='Custom'&&<span style={{fontSize:11,color:C.dim,flexShrink:0}}>{ex.equip}</span>}
                {ex.useCount>0&&<span style={{fontSize:10,color:C.c3,flexShrink:0,fontWeight:600}}>{ex.useCount} session{ex.useCount!==1?'s':''}</span>}
                <span style={{color:C.faint,fontSize:12,marginLeft:'auto',flexShrink:0}}>{isExpanded?'▲':'▼'}</span>
              </div>

              {/* Expanded detail */}
              {isExpanded&&(
                <div style={{background:C.ink,borderTop:`1px solid ${C.border}`,padding:'10px 14px',display:'flex',flexWrap:'wrap',gap:16}}>
                  {ex.muscles&&<div><div style={{fontSize:9,color:C.amber,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:3}}>Muscles</div><div style={{fontSize:12,color:C.white}}>{ex.muscles}</div></div>}
                  {ex.equip&&<div><div style={{fontSize:9,color:C.amber,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:3}}>Equipment</div><div style={{fontSize:12,color:C.white}}>{ex.equip}</div></div>}
                  {ex.pattern&&<div><div style={{fontSize:9,color:C.amber,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:3}}>Pattern</div><div style={{fontSize:12,color:C.white}}>{ex.pattern}</div></div>}
                  {ex.quality&&<div><div style={{fontSize:9,color:C.amber,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:3}}>Quality</div><div style={{fontSize:12,color:C.white}}>{ex.quality}</div></div>}
                  {ex.limb&&<div><div style={{fontSize:9,color:C.amber,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:3}}>Limb</div><div style={{fontSize:12,color:C.white}}>{ex.limb}</div></div>}
                  {ex.isCustom&&<div style={{fontSize:11,color:C.faint,fontStyle:'italic',alignSelf:'center'}}>Detected from your session data</div>}
                </div>
              )}
            </div>
          )
        })}
        {filtered.length===0&&(
          <Card style={{textAlign:'center',padding:32}}>
            <p style={{color:C.muted,marginBottom:8}}>No exercises match your filters.</p>
            <button onClick={()=>{setFp('');setFq('');setFl('');setFm('');setSearch('')}}
              style={{background:'none',border:'none',color:C.amber,fontSize:12,cursor:'pointer',fontWeight:700}}>
              Clear filters
            </button>
          </Card>
        )}
      </div>
    </div>
  )
}

// ─── IMPORT ───────────────────────────────────────────────────────────────────
function ImportView({ clients, importData, saving }) {
  const [raw, setRaw]         = useState('')
  const [parsed, setParsed]   = useState(null)
  const [selected, setSelected]= useState({})
  const [err, setErr]         = useState('')
  const [step, setStep]       = useState(1)
  const [pName, setPName]     = useState('')
  const [pClient, setPClient] = useState('')
  const [done, setDone]       = useState(false)
  const [stats, setStats]     = useState({})

  const handleFile = e => {
    const file = e.target.files?.[0]; if(!file) return
    const reader = new FileReader()
    reader.onload = ev => { const t=ev.target.result; setRaw(t); doParse(t) }
    reader.readAsText(file,'UTF-8'); e.target.value = ''
  }
  const doParse = text => {
    setErr(''); if(!text?.trim()){ setErr('No data.'); return }
    const result = parseCSV(text)
    if(result.error){ setErr(result.error); return }
    setParsed(result)
    const sel={}; result.sessions.forEach(s=>{sel[s.id]=true}); setSelected(sel)
    if(result.detectedProgram) setPName(result.detectedProgram)
    const m = clients.find(c=>c.name.toLowerCase().includes((result.detectedClient||'').toLowerCase().split(' ')[0]))
    if(m) setPClient(m.id)
    setStep(2)
  }
  const doImport = async () => {
    if(!pName.trim()){ alert('Enter a program name.'); return }
    const selSess = parsed.sessions.filter(s=>selected[s.id])
    await importData({...parsed,sessions:selSess},pName,pClient)
    setStats({sessions:selSess.length,weeks:parsed.weeks.length}); setDone(true)
  }
  const reset = () => { setRaw(''); setParsed(null); setSelected({}); setErr(''); setStep(1); setPName(''); setPClient(''); setDone(false) }
  const sessArr  = parsed ? parsed.sessions : []
  const weekArr  = parsed ? [...parsed.weeks].sort((a,b)=>a.week_number-b.week_number) : []
  const byWeek   = sessArr.reduce((acc,s)=>{ const w=s.week_id||'?'; if(!acc[w])acc[w]=[]; acc[w].push(s); return acc },{})
  const selCount = Object.values(selected).filter(Boolean).length
  const clientOpts = [{v:'',l:'— Auto-create from CSV —'},...clients.map(c=>({v:c.id,l:c.name}))]

  if(done) return (
    <div style={{padding:20,maxWidth:700,margin:'0 auto'}}>
      <OkPanel style={{textAlign:'center',padding:40}}>
        <div style={{display:'flex',justifyContent:'center',marginBottom:12}}><Icon name="check" size={36} color={C.green}/></div>
        <h2 style={{color:C.green,marginBottom:8}}>Import Complete</h2>
        <p style={{color:C.muted,marginBottom:4}}>Program: <strong style={{color:C.white}}>{pName}</strong></p>
        <G2 style={{maxWidth:260,margin:'16px auto'}}>{[{v:stats.weeks,l:'Weeks'},{v:stats.sessions,l:'Sessions'}].map(x=>(<div key={x.l} style={{background:C.ink,borderRadius:8,padding:'10px',textAlign:'center'}}><div style={{fontSize:22,fontWeight:700,color:C.white}}>{x.v}</div><div style={{fontSize:10,color:C.muted,textTransform:'uppercase',marginTop:2}}>{x.l}</div></div>))}</G2>
        <Btn label="Import Another" variant="secondary" onClick={reset}/>
      </OkPanel>
    </div>
  )

  return (
    <div style={{padding:20,maxWidth:860,margin:'0 auto'}}>
      <h1 style={{fontSize:22,fontWeight:700,color:C.white,fontFamily:'Space Grotesk, sans-serif',marginBottom:4}}>IMPORT CSV</h1>
      <p style={{fontSize:13,color:C.muted,marginBottom:22}}>Upload the ChatGPT-processed CSV to import historical programs.</p>
      {step===1 && (
        <div>
          <Row style={{gap:10,alignItems:'center',marginBottom:16}}>
            <label style={{display:'inline-block',background:C.amber,color:C.bg,borderRadius:8,padding:'9px 18px',fontSize:13,fontWeight:700,cursor:'pointer'}}>
              Upload CSV<input type="file" accept=".csv,.tsv,.txt" onChange={handleFile} style={{display:'none'}}/>
            </label>
            <span style={{fontSize:13,color:C.muted}}>or paste below</span>
          </Row>
          {err&&<div style={{background:`${C.orange}15`,border:`1px solid ${C.orange}35`,borderRadius:8,padding:'10px 14px',marginBottom:12,fontSize:13,color:C.orange,whiteSpace:'pre-wrap'}}>{err}</div>}
          <label style={{...lS,display:'block',marginBottom:6}}>Paste CSV text</label>
          <textarea value={raw} onChange={e=>{setRaw(e.target.value);setErr('')}} placeholder="Paste CSV here…" style={{...iS,minHeight:160,resize:'vertical',fontFamily:'monospace',fontSize:11,marginBottom:12}}></textarea>
          <Btn label="Parse CSV →" onClick={()=>doParse(raw)} disabled={!raw.trim()}/>
        </div>
      )}
      {step===2 && parsed && (
        <div>
          <Row style={{alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
            <p style={{fontSize:13,color:C.muted}}><strong style={{color:C.white}}>{sessArr.length} sessions</strong> across <strong style={{color:C.white}}>{weekArr.length} weeks</strong></p>
            <Row style={{gap:8}}>
              <Btn label={Object.values(selected).every(Boolean)?'Deselect All':'Select All'} variant="secondary" small onClick={()=>{const all=Object.values(selected).every(Boolean);const n={};sessArr.forEach(s=>{n[s.id]=!all});setSelected(n)}}/>
              <Btn label={`Next: Assign ${selCount} →`} onClick={()=>setStep(3)} disabled={selCount===0}/>
            </Row>
          </Row>
          {weekArr.map(week=>(
            <div key={week.id} style={{marginBottom:14}}>
              <div style={{fontSize:10,fontWeight:700,color:C.amber,textTransform:'uppercase',letterSpacing:'0.12em',marginBottom:8,paddingBottom:6,borderBottom:`1px solid ${C.border}`}}>Week {week.week_number}{week.phase?` — ${week.phase}`:''}</div>
              <div style={{display:'flex',flexDirection:'column',gap:5}}>
                {(byWeek[week.id]||[]).map(sess=>{
                  const on=selected[sess.id];const mainEx=(sess.exercises||[]).filter(e=>!e.isWarmup);const logs=mainEx.reduce((a,e)=>a+(e.loggedSets||[]).length,0)
                  return(<Card key={sess.id} style={{padding:'10px 14px',borderColor:on?`${C.amber}45`:C.border,opacity:on?1:0.5}}><Row style={{alignItems:'center',gap:10}}><input type="checkbox" checked={!!on} onChange={e=>setSelected(p=>({...p,[sess.id]:e.target.checked}))} style={{width:14,height:14,accentColor:C.amber,cursor:'pointer',flexShrink:0}}/><span style={{fontWeight:600,color:C.white,fontSize:13,flex:1}}>{sess.name}</span><Tag v={`${mainEx.length} ex`} color={C.c2} small/>{logs>0&&<Tag v={`${logs} sets`} color={C.green} small/>}</Row></Card>)
                })}
              </div>
            </div>
          ))}
          <Row><Btn label="← Back" variant="secondary" onClick={()=>setStep(1)}/></Row>
        </div>
      )}
      {step===3 && (
        <div>
          <p style={{fontSize:13,color:C.muted,marginBottom:16}}>Assign <strong style={{color:C.white}}>{selCount} sessions</strong> to a client and program.</p>
          <div style={{marginBottom:10}}><TI label="Program Name *" value={pName} onChange={setPName} placeholder="George Perry — Program 2"/></div>
          <div style={{marginBottom:16}}><SI label="Client" value={pClient} onChange={setPClient} options={clientOpts}/></div>
          <Row><Btn label="← Back" variant="secondary" onClick={()=>setStep(2)}/><Btn label="Import Program ✓" loading={saving} onClick={doImport} disabled={!pName.trim()}/></Row>
        </div>
      )}
    </div>
  )
}

// ─── SIDEBAR NAVIGATION ───────────────────────────────────────────────────────
const SIDEBAR_CONFIG = [
  { id:'s_dash',    label:'Dashboard',    icon:'dashboard', items:[{id:'overview',label:'Overview'},{id:'readiness_dash',label:'Readiness'},{id:'compliance',label:'Compliance'},{id:'alerts',label:'Alerts'}]},
  { id:'s_lb',      label:'Leaderboards', icon:'trophy', items:[{id:'lb_strength',label:'Strength PBs'},{id:'lb_attendance',label:'Attendance'},{id:'lb_wellness',label:'Wellness'},{id:'lb_sprint',label:'Sprint Rankings'}]},
  { id:'s_athletes',label:'Athletes',     icon:'users', items:[{id:'clients',label:'All Athletes'},{id:'groups',label:'Groups'},{id:'injuries',label:'Injuries'},{id:'monitoring',label:'Monitoring'}]},
  { id:'s_reports', label:'Reports',      icon:'fileText', items:[{id:'athlete_reports',label:'Athlete Reports'},{id:'testing_reports',label:'Testing Reports'},{id:'compliance_reports',label:'Compliance Reports'},{id:'export_centre',label:'Export Centre'}]},
  { id:'s_strength',label:'Strength',     icon:'dumbbell', items:[{id:'programs_list',label:'Programs'},{id:'sessions_list',label:'All Sessions'},{id:'library',label:'Exercise Library'},{id:'cleanup',label:'Exercise Cleanup'},{id:'import',label:'CSV Import'}]},
  { id:'s_templates',label:'Templates',   icon:'layers', items:[{id:'templates',label:'Program Templates'},{id:'templates_session',label:'Session Templates'},{id:'templates_scheme',label:'Rep Schemes'},{id:'templates_labels',label:'Session Labels'}]},
  { id:'s_sched',   label:'Scheduler',    icon:'calendar', items:[{id:'calendar',label:'Calendar'},{id:'session_planner',label:'Session Planner'},{id:'sched_attendance',label:'Attendance'},{id:'events',label:'Events'}]},
  { id:'s_notice',  label:'Noticeboard',  icon:'megaphone', items:[{id:'announcements',label:'Announcements'},{id:'team_updates',label:'Team Updates'}]},
  { id:'s_chats',   label:'Chats',        icon:'message', items:[{id:'direct_messages',label:'Direct Messages'},{id:'group_chats',label:'Group Chats'}]},
  { id:'s_apps',    label:'Apps',         icon:'grid', items:[{id:'wearables',label:'Wearables'},{id:'integrations',label:'Integrations'},{id:'connected_apps',label:'Connected Apps'}]},
  { id:'s_admin',   label:'Admin',        icon:'settings', items:[{id:'coaches',label:'Coaches'},{id:'permissions',label:'Permissions'},{id:'billing',label:'Billing'},{id:'settings',label:'Settings'},{id:'lbs_convert',label:'lbs → kg'},{id:'db_tools',label:'Database Tools'}]},
]

const SECTION_VIEWS = {
  s_dash:     ['overview','dashboard','readiness_dash','compliance','alerts'],
  s_lb:       ['lb_strength','lb_attendance','lb_wellness','lb_sprint'],
  s_athletes: ['clients','client','editclient','groups','injuries','monitoring'],
  s_reports:  ['athlete_reports','testing_reports','compliance_reports','export_centre'],
  s_strength: ['programs_list','programs','program','session','library','cleanup','import','sessions_list','name_convention'],
  s_templates:['templates','templates_session','templates_scheme','templates_labels'],
  s_sched:    ['calendar','session_planner','sched_attendance','events'],
  s_notice:   ['announcements','team_updates'],
  s_chats:    ['direct_messages','group_chats'],
  s_apps:     ['wearables','integrations','connected_apps'],
  s_admin:    ['coaches','permissions','billing','settings','lbs_convert','db_tools'],
}

function SidebarNav({ nav, go, clients, onSignOut, badges={} }) {
  const activeSection = Object.entries(SECTION_VIEWS).find(([,views])=>views.includes(nav.view))?.[0]
  const [expanded, setExpanded] = useState(()=>{
    const open = new Set(['s_dash','s_athletes','s_strength','s_templates'])
    if(activeSection) open.add(activeSection)
    return open
  })
  const [mini, setMini] = useState(false)
  const toggle = id => setExpanded(p=>{const n=new Set(p);n.has(id)?n.delete(id):n.add(id);return n})
  return(
    <div style={{width:mini?44:196,background:C.ink,borderRight:`1px solid ${C.border}`,flexShrink:0,display:'flex',flexDirection:'column',height:'100%',overflowY:'auto',overflowX:'hidden',transition:'width 0.2s',userSelect:'none',position:'sticky',top:0}}>
      <div style={{padding:'12px 10px 10px',borderBottom:`1px solid ${C.border}`,display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
        {!mini&&<span style={{fontWeight:700,fontSize:13,letterSpacing:'-0.01em',fontFamily:'Space Grotesk,sans-serif',cursor:'pointer',whiteSpace:'nowrap'}} onClick={()=>go('overview')}><span style={{color:C.amber}}>Coach</span><span style={{color:C.white}}>'d By Gee</span></span>}
        <button onClick={()=>setMini(p=>!p)} title={mini?'Expand sidebar':'Collapse sidebar'} style={{background:'none',border:`1px solid ${C.border}`,borderRadius:5,padding:'3px 6px',color:C.faint,cursor:'pointer',fontSize:11,flexShrink:0,marginLeft:mini?'auto':4}}>{mini?'»':'«'}</button>
      </div>
      <div style={{flex:1,overflowY:'auto',padding:'6px 0'}}>
        {SIDEBAR_CONFIG.map(section=>{
          const isExpanded=expanded.has(section.id), isSectionActive=SECTION_VIEWS[section.id]?.includes(nav.view)
          const secBadge=section.items.reduce((n,it)=>n+(badges[it.id]||0),0)
          return(
            <div key={section.id}>
              <button onClick={()=>toggle(section.id)} style={{display:'flex',alignItems:'center',width:'100%',padding:mini?'9px 0':'7px 10px',justifyContent:mini?'center':'flex-start',border:'none',background:isSectionActive?`${C.amber}12`:'transparent',color:isSectionActive?C.amber:C.muted,cursor:'pointer',gap:7,borderLeft:`2px solid ${isSectionActive?C.amber:'transparent'}`}} title={mini?section.label:''}>
                <span style={{display:'flex',flexShrink:0,position:'relative'}}><Icon name={section.icon} size={16}/>{mini&&secBadge>0&&<span style={{position:'absolute',top:-3,right:-4,width:8,height:8,borderRadius:4,background:C.amber}}/>}</span>
                {!mini&&<><span style={{flex:1,textAlign:'left',fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em',whiteSpace:'nowrap'}}>{section.label}</span>{secBadge>0&&<span style={{minWidth:17,height:17,borderRadius:9,background:C.amber,color:C.bg,fontSize:10,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',padding:'0 5px',marginRight:4}}>{secBadge>9?'9+':secBadge}</span>}<span style={{fontSize:11,transition:'transform 0.15s',transform:isExpanded?'rotate(90deg)':'none',opacity:0.5}}>›</span></>}
              </button>
              {!mini&&isExpanded&&section.items.map(item=>{
                const isActive=nav.view===item.id||(item.id==='clients'&&['client','editclient'].includes(nav.view))||(item.id==='programs_list'&&['program','session','programs'].includes(nav.view))
                return(
                  <button key={item.id} onClick={()=>go(item.id)} style={{display:'block',width:'100%',padding:'6px 10px 6px 26px',border:'none',borderLeft:`2px solid ${isActive?C.amber:'transparent'}`,background:isActive?`${C.amber}14`:'transparent',color:isActive?C.amber:C.dim,cursor:'pointer',fontSize:12,fontWeight:isActive?600:400,textAlign:'left',whiteSpace:'nowrap',transition:'background 0.1s,color 0.1s'}}
                    onMouseEnter={e=>{if(!isActive)e.currentTarget.style.color=C.muted;e.currentTarget.style.background=isActive?`${C.amber}14`:`${C.white}06`}}
                    onMouseLeave={e=>{e.currentTarget.style.color=isActive?C.amber:C.dim;e.currentTarget.style.background=isActive?`${C.amber}14`:'transparent'}}>
                    <span style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:6}}>{item.label}{(badges[item.id]||0)>0&&<span style={{minWidth:18,height:18,borderRadius:9,background:C.amber,color:C.bg,fontSize:10,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',padding:'0 5px',flexShrink:0}}>{(badges[item.id]||0)>9?'9+':(badges[item.id]||0)}</span>}</span>
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>
      {!mini&&(
        <div style={{borderTop:`1px solid ${C.border}`,padding:'8px 0 4px'}}>
          <div style={{fontSize:9,color:C.faint,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em',padding:'2px 10px 4px'}}>Recent Athletes</div>
          {clients.filter(c=>c.status==='active').slice(0,5).map(c=>(
            <button key={c.id} onClick={()=>go('client',{clientId:c.id})} style={{display:'flex',alignItems:'center',gap:7,width:'100%',padding:'5px 10px',border:'none',background:'transparent',cursor:'pointer',textAlign:'left'}} onMouseEnter={e=>e.currentTarget.style.background=`${C.white}06`} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
              <span style={{width:20,height:20,borderRadius:'50%',background:`${C.c1}30`,color:C.c3,fontSize:10,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{c.name[0].toUpperCase()}</span>
              <span style={{fontSize:11,color:C.dim,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── COMING SOON SCAFFOLD ─────────────────────────────────────────────────────
const COMING_SOON_INFO = {
  readiness_dash:{title:'Readiness',desc:'Daily athlete wellness scores, HRV trends, and recovery monitoring.',cta:'Log Readiness',ctaView:'monitoring'},
  compliance:{title:'Compliance',desc:'Session attendance rates, program adherence, and missed session tracking.',cta:null},
  alerts:{title:'Alerts',desc:'Flagged athletes, readiness warnings, missed sessions, and injury reports.',cta:null},
  lb_strength:{title:'Strength PBs',desc:'Leaderboard of top lifts across all athletes by exercise.',cta:'View Progress',ctaView:'clients'},
  lb_attendance:{title:'Attendance',desc:'Top attendance rates and session completion rankings.',cta:null},
  lb_wellness:{title:'Wellness',desc:'Readiness and wellness score rankings across the squad.',cta:null},
  lb_sprint:{title:'Sprint Rankings',desc:'Sprint test results and speed performance rankings.',cta:null},
  groups:{title:'Groups',desc:'Organise athletes into training groups and squads.',cta:'Manage Athletes',ctaView:'clients'},
  injuries:{title:'Injuries',desc:'Track active injuries, rehabilitation status, and return-to-play timelines.',cta:null},
  monitoring:{title:'Monitoring',desc:'Long-term athlete load monitoring, readiness trends, and wellness tracking.',cta:null},
  athlete_reports:{title:'Athlete Reports',desc:'Generate and export detailed athlete progress reports.',cta:'View Athletes',ctaView:'clients'},
  testing_reports:{title:'Testing Reports',desc:'Strength, speed, and fitness test result reports.',cta:null},
  compliance_reports:{title:'Compliance Reports',desc:'Training adherence and attendance reports.',cta:null},
  export_centre:{title:'Export Centre',desc:'Export athlete data, programs, and reports to PDF or CSV.',cta:null},
  programs_list:{title:'All Programs',desc:'Browse programs across all athletes.',cta:'View Athletes',ctaView:'clients'},
  sessions_list:{title:'All Sessions',desc:'Browse sessions across all programs and athletes.',cta:'View Athletes',ctaView:'clients'},
  templates:{title:'Templates',desc:'Save and reuse program and session templates.',cta:'View Programs',ctaView:'clients'},
  session_planner:{title:'Session Planner',desc:'Plan and schedule sessions with drag-and-drop.',cta:'View Calendar',ctaView:'calendar'},
  sched_attendance:{title:'Attendance',desc:'Track session attendance and record who showed up.',cta:null},
  events:{title:'Events',desc:'Schedule testing days, competitions, and team events.',cta:null},
  announcements:{title:'Announcements',desc:'Post announcements visible to all athletes.',cta:null},
  team_updates:{title:'Team Updates',desc:'Share training updates, news, and team communications.',cta:null},
  direct_messages:{title:'Direct Messages',desc:'One-to-one messaging between coach and athletes.',cta:null},
  group_chats:{title:'Group Chats',desc:'Create group conversations for training squads.',cta:null},
  wearables:{title:'Wearables',desc:'Connect WHOOP, Garmin, Apple Health, and other wearable devices.',cta:null},
  integrations:{title:'Integrations',desc:'Connect third-party tools and services.',cta:null},
  connected_apps:{title:'Connected Apps',desc:'Manage all connected applications and OAuth permissions.',cta:null},
  coaches:{title:'Coaches',desc:'Manage coach accounts and access levels.',cta:null},
  permissions:{title:'Permissions',desc:'Role-based access control for coaches and athletes.',cta:null},
  billing:{title:'Billing',desc:'Manage subscription, invoices, and payment settings.',cta:null},
  settings:{title:'Settings',desc:'App settings, branding, notifications, and preferences.',cta:null},
  db_tools:{title:'Database Tools',desc:'Inspect, export, and manage your data.',cta:null},
}

function ComingSoon({ view, go }) {
  const info = COMING_SOON_INFO[view] || {title:view, desc:'This page is coming soon.', cta:null}
  return(
    <div style={{padding:40,maxWidth:560,margin:'0 auto',textAlign:'center'}}>
      <div style={{display:'flex',justifyContent:'center',marginBottom:16}}><Icon name="rocket" size={38} color={C.amber}/></div>
      <h1 style={{fontSize:22,fontWeight:700,color:C.white,marginBottom:8,fontFamily:'Space Grotesk,sans-serif'}}>{info.title}</h1>
      <p style={{fontSize:14,color:C.muted,lineHeight:1.7,marginBottom:24}}>{info.desc}</p>
      <div style={{background:`${C.amber}10`,border:`1px solid ${C.amber}30`,borderRadius:10,padding:'14px 20px',marginBottom:20,display:'inline-block'}}>
        <span style={{fontSize:12,color:C.amber,fontWeight:600}}>Coming in a future update</span>
      </div>
      {info.cta&&info.ctaView&&(<div><Btn label={info.cta} onClick={()=>go(info.ctaView)}/></div>)}
    </div>
  )
}

// ─── EXERCISE CLEANUP ─────────────────────────────────────────────────────────
const ABBREVS_MAP = {
  'db':'dumbbell','dbs':'dumbbell','bb':'barbell','kb':'kettlebell',
  'bw':'bodyweight','rdl':'romanian deadlift','rfess':'rear foot elevated split squat',
  'ohp':'overhead press','ohs':'overhead squat','bp':'bench press',
  'dl':'deadlift','sq':'squat','pu':'push up','cu':'chin up',
}

function normalizeForMatch(name){
  let n=(name||'').toLowerCase()
    .replace(/tempo[\s\w-]+/g,'').replace(/[()]/g,' ').replace(/[^\w\s]/g,' ')
    .replace(/x\d+/g,'').replace(/\s+/g,' ').trim()
  return n.split(' ').map(w=>ABBREVS_MAP[w]||w).join(' ')
}

function tokenSimilarity(a,b){
  const na=normalizeForMatch(a), nb=normalizeForMatch(b)
  if(na===nb) return 1
  const ta=new Set(na.split(' ').filter(t=>t.length>1)), tb=new Set(nb.split(' ').filter(t=>t.length>1))
  if(!ta.size||!tb.size) return 0
  const inter=[...ta].filter(t=>tb.has(t)).length, union=new Set([...ta,...tb]).size
  return inter/union
}

function findExerciseDuplicates(names){
  const groups=[], assigned=new Set(), uniq=[...new Set(names)]
  for(let i=0;i<uniq.length;i++){
    if(assigned.has(uniq[i])) continue
    const group=[uniq[i]]
    for(let j=i+1;j<uniq.length;j++){
      if(assigned.has(uniq[j])) continue
      if(tokenSimilarity(uniq[i],uniq[j])>=0.5){ group.push(uniq[j]); assigned.add(uniq[j]) }
    }
    if(group.length>1){ assigned.add(uniq[i]); groups.push(group) }
  }
  return groups
}

function ExerciseCleanup({ sessions, updateSession, mergeSession, saving }) {
  const allNames = [...new Set(sessions.flatMap(s=>safeExercises(s).filter(e=>!e.isWarmup).map(e=>e.name)).filter(Boolean))].sort()
  const [groups,     setGroups]     = useState(()=>findExerciseDuplicates(allNames))
  const [ignored,    setIgnored]    = useState(()=> new Set(Object.keys(getIgnoredGroups())))
  const [merging,    setMerging]    = useState(null)   // {selection:[], customName:''}
  const [merged,     setMerged]     = useState([])
  const [progress,   setProgress]   = useState(null)
  const [tab,        setTab]        = useState('flagged')
  // Per-group checkbox selections: { [groupKey]: Set<name> }
  // Re-scan duplicate groups whenever sessions change (after merges, renames, imports)
  const _ecSessKey = sessions.map(s=>s.id).sort().join(',')
  useEffect(()=>{
    const names = [...new Set(sessions.flatMap(s=>safeExercises(s).filter(e=>!e.isWarmup).map(e=>e.name)).filter(Boolean))].sort()
    setGroups(g => {
      const newGroups = findExerciseDuplicates(names)
      // Keep any groups the user has already acted on (merged/ignored) out of the new list
      return newGroups
    })
  }, [_ecSessKey])
  const [selections, setSelections] = useState({})
  // Keep the ignored set in sync with the persistent registry (e.g. once it loads from Supabase)
  useEffect(()=>{
    const sync = () => setIgnored(new Set(Object.keys(getIgnoredGroups())))
    window.addEventListener('cgee-reg-changed', sync)
    return () => window.removeEventListener('cgee-reg-changed', sync)
  }, [])

  // Registry tab state — kept at top level so hooks run every render
  const [regState, setRegState] = useState(()=>({aliases:getRegAliases(),history:getRegHistory()}))
  const refreshReg = () => setRegState({aliases:getRegAliases(),history:getRegHistory()})
  useEffect(()=>{ if(tab==='registry') setRegState({aliases:getRegAliases(),history:getRegHistory()}) }, [tab])

  const activeGroups  = groups.filter(g=>!ignored.has(g.join('|')))
  const ignoredGroups = groups.filter(g=> ignored.has(g.join('|')))
  const usageCount = name => sessions.filter(s=>safeExercises(s).some(e=>e.name===name)).length
  const getPB = name => {
    let best=0
    sessions.forEach(s=>safeExercises(s).filter(e=>e.name===name).forEach(ex=>{
      ;(ex.loggedSets||[]).forEach(ls=>{ if(ls.skipped||ls.excluded) return; const _m=getExMode(name); if(_m==='isometric'||_m==='assisted'||_m==='band') return; parseEfforts(ls.completedLoad,ls.completedReps).forEach(({load,reps})=>{ const e1=calcE1RM(load,reps); if(e1&&e1>best)best=e1 }) })
    }))
    return best>0 ? `${Math.round(best*10)/10}kg e1RM` : null
  }

  // Toggle a single exercise's checkbox within a group
  const toggleSel = (groupKey, name) => {
    setSelections(prev=>{
      const cur = new Set(prev[groupKey]||[])
      cur.has(name) ? cur.delete(name) : cur.add(name)
      return {...prev, [groupKey]: cur}
    })
  }
  // Select/deselect all in group
  const toggleAll = (groupKey, group, allChecked) => {
    setSelections(prev=>({...prev, [groupKey]: allChecked ? new Set() : new Set(group)}))
  }

  const doMerge = async () => {
    if(!merging) return
    const canonical = (merging.customName||'').trim() || merging.selection[0]
    const toRename  = merging.selection.filter(n=>n!==canonical)
    if(!toRename.length){ setMerging(null); return }

    // STEP 1: Write to registry FIRST — this is the permanent source of truth
    // Even if Supabase PATCH fails below, names will resolve correctly everywhere
    regMerge([...toRename, canonical], canonical)
    setProgress('✓ Registry updated — now saving to sessions…')

    const affected = sessions.filter(s=>safeExercises(s).some(e=>
      toRename.map(n=>n.toLowerCase()).includes(e.name.toLowerCase())
    ))

    if(!affected.length){
      setProgress('✓ Merged in registry. No sessions contained these exercise names.')
      setMerged(p=>[...p,{selection:merging.selection,canonical,sessionIds:[],timestamp:Date.now(),regTs:new Date().toISOString()}])
      setMerging(null)
      setTimeout(()=>setProgress(null), 3000)
      return
    }

    // STEP 2: Update sessions — use updateSession (handles state + Supabase)
    const sessionIds=[], errors=[]
    for(let i=0; i<affected.length; i++){
      const sess = affected[i]
      setProgress(`Saving session ${i+1} of ${affected.length}…`)
      const newExs = safeExercises(sess).map(ex=>
        toRename.map(n=>n.toLowerCase()).includes(ex.name.toLowerCase())
          ? {...ex, name:canonical, _originalName:ex._originalName||ex.name}
          : ex
      )
      try {
        await updateSession(sess.id, {exercises: newExs})
        sessionIds.push(sess.id)
      } catch(e) {
        errors.push(sess.id)
        console.warn('[doMerge] session update error', sess.id, e)
      }
    }

    const errMsg = errors.length ? ` (${errors.length} session${errors.length!==1?'s':''} could not update — registry still applies)` : ''
    setProgress(`✓ Merged "${toRename.join('", "')}" → "${canonical}" in ${sessionIds.length} sessions${errMsg}`)
    setMerged(p=>[...p,{selection:merging.selection,canonical,sessionIds,timestamp:Date.now(),regTs:new Date().toISOString()}])
    setGroups(prev=>prev.map(g=>{
      if(!merging.selection.some(n=>g.includes(n))) return g
      const remaining = g.filter(n=>!merging.selection.includes(n))
      return remaining.length>=2 ? remaining : null
    }).filter(Boolean))
    setMerging(null)
    setTimeout(()=>setProgress(null), 4000)
  }
  const doUndo = async (entry) => {
    setProgress('Undoing merge…')
    // Remove from registry
    if(entry.regTs) undoRegEntry(entry.regTs)
    else {
      const reg = loadExReg()
      entry.selection.forEach(name => {
        const lo = (name||'').toLowerCase().trim()
        if(reg.aliases[lo]===entry.canonical) delete reg.aliases[lo]
      })
      saveExReg(reg)
    }
    for(const sess of sessions.filter(s=>entry.sessionIds.includes(s.id))){
      const newExs = safeExercises(sess).map(ex=>
        ex.name===entry.canonical&&ex._originalName ? {...ex,name:ex._originalName,_originalName:undefined} : ex
      )
      await updateSession(sess.id,{exercises:newExs})
    }
    setMerged(p=>p.filter(e=>e.timestamp!==entry.timestamp))
    setGroups(findExerciseDuplicates([...new Set(sessions.flatMap(s=>safeExercises(s).filter(e=>!e.isWarmup).map(e=>e.name)).filter(Boolean))]))
    setProgress('✓ Merge undone')
    setTimeout(()=>setProgress(null), 2000)
  }

  return(
    <div style={{padding:20,maxWidth:900,margin:'0 auto'}}>
      <h1 style={{fontSize:22,fontWeight:700,color:C.white,fontFamily:'Space Grotesk,sans-serif',marginBottom:4}}>EXERCISE CLEANUP</h1>
      <p style={{fontSize:13,color:C.muted,marginBottom:4}}>Detected <strong style={{color:C.white}}>{allNames.length}</strong> unique exercise names. Flagged <strong style={{color:C.amber}}>{activeGroups.length}</strong> likely duplicate group{activeGroups.length!==1?'s':''}.</p>
      <p style={{fontSize:12,color:C.faint,marginBottom:20}}>Check the exercises you want to merge within each group, then click <strong style={{color:C.white}}>Merge Selected</strong>. Unchecked exercises stay separate.</p>

      {progress&&<div style={{background:`${C.c1}18`,border:`1px solid ${C.c1}40`,borderRadius:8,padding:'10px 14px',marginBottom:14,fontSize:13,color:C.c3}}>{progress}</div>}

      <Row style={{gap:0,marginBottom:16,borderBottom:`1px solid ${C.border}`}}>
        {[{id:'flagged',l:`Flagged (${activeGroups.length})`},{id:'ignored',l:`Ignored (${ignoredGroups.length})`},{id:'merged',l:`Merged (${merged.length})`},{id:'naming',l:'Naming Convention'},{id:'registry',l:'Registry'}].map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{padding:'8px 18px',border:'none',borderBottom:`2px solid ${tab===t.id?C.amber:'transparent'}`,background:'transparent',color:tab===t.id?C.amber:C.muted,fontSize:13,fontWeight:600,cursor:'pointer'}}>{t.l}</button>
        ))}
      </Row>

      {/* ── Merge confirm modal ─────────────────────────────── */}
      {merging&&(
        <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(4,7,15,0.88)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:50,padding:20}}>
          <Card style={{maxWidth:540,width:'100%',padding:24}}>
            <h3 style={{color:C.white,marginBottom:4}}>Name this exercise going forward</h3>
            <p style={{fontSize:13,color:C.muted,marginBottom:14}}>Every session — past and future — will use this name. Progress charts, PBs, and history will merge automatically.</p>

            {/* Custom name input */}
            <div style={{marginBottom:12}}>
              <label style={lS}>Exercise name (editable)</label>
              <input
                value={merging.customName||''}
                onChange={e=>setMerging(p=>({...p,customName:e.target.value}))}
                placeholder="Type the name you want to use…"
                style={{...iS,fontSize:14,fontWeight:600,color:C.white}}
                autoFocus
              />
            </div>

            {/* Quick-pick from selected names */}
            <div style={{marginBottom:16}}>
              <div style={{fontSize:10,color:C.faint,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:6}}>Quick pick from selected</div>
              <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                {merging.selection.map(n=>{
                  const active=(merging.customName||'').trim()===n
                  return(
                    <button key={n} onClick={()=>setMerging(p=>({...p,customName:n}))}
                      style={{padding:'5px 12px',borderRadius:20,border:`1.5px solid ${active?C.amber:C.border}`,background:active?`${C.amber}18`:`${C.white}05`,color:active?C.amber:C.muted,fontSize:12,fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',gap:6}}>
                      {n}
                      <span style={{fontSize:10,color:active?`${C.amber}88`:C.faint,fontWeight:400}}>{usageCount(n)}s</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* What will happen summary */}
            {(()=>{
              const canonical=(merging.customName||'').trim()||merging.selection[0]
              const toRename=merging.selection.filter(n=>n!==canonical)
              const affectedCount=sessions.filter(s=>safeExercises(s).some(e=>merging.selection.includes(e.name))).length
              const isNewName=!merging.selection.includes(canonical)
              return(
                <div style={{background:`${C.green}0d`,border:`1px solid ${C.green}25`,borderRadius:8,padding:'10px 14px',marginBottom:16}}>
                  <div style={{fontSize:12,color:C.green,fontWeight:700,marginBottom:4}}>What will happen</div>
                  <div style={{fontSize:12,color:C.muted,lineHeight:1.7}}>
                    {isNewName
                      ? <span>All {merging.selection.length} selected names will be renamed to <strong style={{color:C.white}}>"{canonical}"</strong></span>
                      : <span>{toRename.length} name{toRename.length!==1?'s':''} ({toRename.map(n=>`"${n}"`).join(', ')}) will be renamed to <strong style={{color:C.white}}>"{canonical}"</strong></span>
                    }
                    {' '}across <strong style={{color:C.white}}>{affectedCount} session{affectedCount!==1?'s':''}</strong>.
                    <br/>Progress charts, PBs, and exercise history will merge immediately.
                  </div>
                </div>
              )
            })()}

            <Row>
              <Btn label="Merge Now" onClick={doMerge} loading={saving} disabled={!(merging.customName||'').trim()}/>
              <Btn label="Cancel" variant="secondary" onClick={()=>setMerging(null)}/>
            </Row>
          </Card>
        </div>
      )}

      {/* ── Flagged tab ──────────────────────────────────────── */}
      {tab==='flagged'&&(
        activeGroups.length===0
          ? <Card style={{textAlign:'center',padding:40}}><div style={{fontSize:28,marginBottom:8}}>✓</div><p style={{color:C.muted}}>No duplicate exercises detected.</p></Card>
          : <div style={{display:'flex',flexDirection:'column',gap:12}}>
              {activeGroups.map(group=>{
                const key      = group.join('|')
                const sel      = selections[key] || new Set()
                const allChecked = group.every(n=>sel.has(n))
                const selCount = sel.size
                const canMerge = selCount >= 2

                return(
                  <Card key={key}>
                    {/* Group header */}
                    <Row style={{alignItems:'flex-start',justifyContent:'space-between',marginBottom:10,flexWrap:'wrap',gap:8}}>
                      <div>
                        <div style={{fontSize:10,fontWeight:700,color:C.orange,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:2}}>Likely Duplicate Group</div>
                        <div style={{fontSize:12,color:C.muted}}>{group.length} variations · {group.reduce((a,n)=>a+usageCount(n),0)} sessions total</div>
                      </div>
                      <Row style={{gap:6,flexWrap:'wrap'}}>
                        <button onClick={()=>toggleAll(key,group,allChecked)} style={{padding:'4px 12px',borderRadius:20,border:`1px solid ${C.border}`,background:'transparent',color:C.faint,fontSize:11,cursor:'pointer'}}>
                          {allChecked?'Deselect All':'Select All'}
                        </button>
                        <Btn
                          label={canMerge ? `Merge ${selCount} Selected` : 'Select 2+ to Merge'}
                          small
                          disabled={!canMerge}
                          onClick={()=>canMerge&&setMerging({selection:[...sel],customName:[...sel][0]})}
                        />
                        <Btn label="Ignore Group" variant="secondary" small onClick={()=>{ignoreGroup(key);setIgnored(p=>new Set([...p,key]))}}/>
                      </Row>
                    </Row>

                    {/* Helper text */}
                    {selCount===0&&(
                      <div style={{fontSize:11,color:C.faint,marginBottom:8,padding:'5px 0'}}>
                        ← Check the names that refer to the <em>same</em> exercise. Leave others unchecked.
                      </div>
                    )}
                    {selCount===1&&(
                      <div style={{fontSize:11,color:C.orange,marginBottom:8,padding:'5px 0'}}>
                        Select at least one more to enable merge.
                      </div>
                    )}
                    {canMerge&&(
                      <div style={{fontSize:11,color:C.green,marginBottom:8,padding:'5px 0'}}>
                        {selCount} exercises selected — click <strong>Merge {selCount} Selected</strong> to continue.
                      </div>
                    )}

                    {/* Exercise rows with checkboxes */}
                    <div style={{display:'flex',flexDirection:'column',gap:5}}>
                      {group.map(name=>{
                        const checked = sel.has(name)
                        const use = usageCount(name)
                        const pb  = getPB(name)
                        return(
                          <div key={name}
                            onClick={()=>toggleSel(key,name)}
                            style={{
                              background: checked ? `${C.amber}12` : C.ink,
                              borderRadius:8, padding:'9px 12px',
                              border:`1.5px solid ${checked?C.amber:C.border}`,
                              cursor:'pointer', transition:'all 0.1s',
                            }}>
                            <Row style={{alignItems:'center',gap:10,flexWrap:'wrap'}}>
                              {/* Checkbox */}
                              <div style={{width:18,height:18,borderRadius:4,border:`2px solid ${checked?C.amber:C.faint}`,background:checked?C.amber:'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,transition:'all 0.1s'}}>
                                {checked&&<span style={{color:C.bg,fontSize:12,fontWeight:900,lineHeight:1}}>✓</span>}
                              </div>
                              {/* Name */}
                              <span style={{fontWeight:600,color:checked?C.white:C.muted,fontSize:13,flex:1,transition:'color 0.1s'}}>{name}</span>
                              {/* Tags */}
                              <Tag v={`${use} session${use!==1?'s':''}`} color={checked?C.c2:'rgba(59,130,246,0.4)'} small/>
                              {pb&&<Tag v={pb} color={checked?C.amber:'rgba(255,165,0,0.4)'} small/>}
                              {/* Normalised match key */}
                              <span style={{fontSize:10,color:C.dim,fontFamily:'monospace',opacity:0.6}}>"{normalizeForMatch(name)}"</span>
                            </Row>
                          </div>
                        )
                      })}
                    </div>
                  </Card>
                )
              })}
            </div>
      )}

      {/* ── Ignored tab ──────────────────────────────────────── */}
      {tab==='ignored'&&(
        ignoredGroups.length===0
          ? <Card style={{textAlign:'center',padding:32}}><p style={{color:C.muted}}>No ignored groups.</p></Card>
          : <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {ignoredGroups.map(group=>{
                const key=group.join('|')
                return(
                  <Card key={key} style={{opacity:0.6}}>
                    <Row style={{alignItems:'center',justifyContent:'space-between',gap:8,flexWrap:'wrap'}}>
                      <div>
                        <div style={{fontSize:12,color:C.muted,marginBottom:2}}>{group.join(' · ')}</div>
                        <div style={{fontSize:11,color:C.faint}}>{group.reduce((a,n)=>a+usageCount(n),0)} sessions across {group.length} names</div>
                      </div>
                      <Btn label="Restore" variant="secondary" small onClick={()=>{unignoreGroup(key);setIgnored(p=>{const n=new Set(p);n.delete(key);return n})}}/>
                    </Row>
                  </Card>
                )
              })}
            </div>
      )}

      {/* ── Merged tab ───────────────────────────────────────── */}
      {tab==='naming'&&<NamingConventionTool sessions={sessions} updateSession={updateSession}/>}
      {tab==='registry'&&(()=>{
        const aliasEntries = Object.entries(regState.aliases).sort((a,b)=>a[1].localeCompare(b[1]))
        return(
          <div style={{paddingTop:16}}>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16,flexWrap:'wrap'}}>
              <p style={{fontSize:12,color:C.muted,margin:0,flex:1}}>{aliasEntries.length} alias mapping{aliasEntries.length!==1?'s':''} stored. PBs, charts, history and CSV imports all use these canonical names — even if session data has not been updated yet.</p>
              <Btn label="↻ Refresh" variant="ghost" small onClick={refreshReg}/>
              <Btn label="Clear All" variant="danger" small onClick={()=>{if(window.confirm('Clear ALL registry mappings?')){const reg=loadExReg();reg.aliases={};reg.history=[];saveExReg(reg);refreshReg()}}}/>
            </div>
            {regState.history.length>0&&(<div style={{marginBottom:20}}>
              <h4 style={{fontSize:11,fontWeight:700,color:C.amber,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:8}}>History</h4>
              {regState.history.map((h,i)=>(
                <div key={i} style={{background:C.ink,border:`1px solid ${C.border}`,borderRadius:8,padding:'8px 12px',marginBottom:5,display:'flex',alignItems:'flex-start',gap:10}}>
                  <div style={{flex:1}}>
                    {h.type==='merge'
                      ?<><span style={{color:C.white,fontWeight:600,fontSize:12}}>{h.canonical}</span><span style={{color:C.faint,fontSize:11}}> ← merged: {(h.aliases||[]).filter(a=>a!==h.canonical).join(', ')}</span></>
                      :<><span style={{color:C.white,fontWeight:600,fontSize:12}}>{h.to}</span><span style={{color:C.faint,fontSize:11}}> ← renamed from: {h.from}</span></>
                    }
                    <div style={{fontSize:10,color:C.faint,marginTop:2}}>{new Date(h.ts).toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}</div>
                  </div>
                  <Btn label="↩ Undo" variant="ghost" small onClick={()=>{undoRegEntry(h.ts);refreshReg()}}/>
                </div>
              ))}
            </div>)}
            {aliasEntries.filter(([a,c])=>a!==c.toLowerCase().trim()).length>0&&(<div>
              <h4 style={{fontSize:11,fontWeight:700,color:C.c3,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:8}}>Active Mappings</h4>
              {aliasEntries.filter(([a,can])=>a!==can.toLowerCase().trim()).map(([alias,canon])=>(
                <div key={alias} style={{display:'flex',alignItems:'center',gap:8,padding:'4px 8px',background:C.ink,borderRadius:5,fontSize:11,marginBottom:2}}>
                  <span style={{color:C.muted,flex:1,fontFamily:'monospace'}}>"{alias}"</span>
                  <span style={{color:C.faint}}>→</span>
                  <span style={{color:C.amber,fontWeight:600}}>{canon}</span>
                  <button onClick={()=>{const reg=loadExReg();delete reg.aliases[alias];saveExReg(reg);refreshReg()}} style={{background:'none',border:'none',color:C.faint,cursor:'pointer',fontSize:12,padding:'0 4px'}}>✕</button>
                </div>
              ))}
            </div>)}
            {aliasEntries.length===0&&regState.history.length===0&&<Card style={{textAlign:'center',padding:24}}><p style={{color:C.muted,margin:0}}>No registry entries yet. Merge or rename exercises to populate this.</p></Card>}
          </div>
        )
      })()}
      {tab==='merged'&&(
        merged.length===0
          ? <Card style={{textAlign:'center',padding:32}}><p style={{color:C.muted}}>No merges performed yet.</p></Card>
          : <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {[...merged].reverse().map(entry=>(
                <Card key={entry.timestamp}>
                  <Row style={{alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:8}}>
                    <div>
                      <Row style={{alignItems:'center',gap:6,marginBottom:3}}>
                        <Tag v="Merged" color={C.green} small/>
                        <span style={{fontSize:13,fontWeight:700,color:C.white}}>{entry.canonical}</span>
                      </Row>
                      <div style={{fontSize:12,color:C.muted}}>
                        From: {entry.selection.filter(n=>n!==entry.canonical).map(n=>`"${n}"`).join(', ')}
                      </div>
                      <div style={{fontSize:11,color:C.faint,marginTop:2}}>{entry.sessionIds.length} session{entry.sessionIds.length!==1?'s':''} updated</div>
                    </div>
                    <Btn label="↺ Undo" variant="secondary" small onClick={()=>doUndo(entry)}/>
                  </Row>
                </Card>
              ))}
            </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// SESSION MESSAGES + EXERCISE SUBSTITUTION SYSTEMS
// ═══════════════════════════════════════════════════════════════════════════════
const MSG_KEY  = 'cgee_messages'
const SUB_KEY  = 'cgee_substitutions'
const PREF_KEY = 'cgee_ex_prefs'

const SUB_REASONS = [
  'Pain / discomfort','No equipment','Too difficult','Too easy',
  "Don't like this exercise",'Unsure how to perform',
  'Coach suggested alternative','Other',
]
const SUB_SCOPES = [
  {v:'session',l:'This session only'},
  {v:'program',l:'All future sessions in this program'},
  {v:'client', l:'All future programs for this client'},
  {v:'avoid',  l:'Never suggest this exercise again'},
]

function getSubSuggestions(exerciseName, allSessions) {
  const pat = detectPattern(exerciseName)
  const fromLib = DEFAULT_LIB.filter(e=>e.name!==exerciseName&&detectPattern(e.name)===pat)
  const fromSess = [...new Set(
    allSessions.flatMap(s=>safeExercises(s).filter(e=>!e.isWarmup&&e.name!==exerciseName).map(e=>e.name))
  )].filter(n=>detectPattern(n)===pat&&!fromLib.some(e=>e.name===n))
    .map(n=>({name:n,pattern:detectPattern(n),muscles:'',equip:'',isLib:false}))
  return [...fromLib.map(e=>({...e,isLib:true})),...fromSess].slice(0,14)
}

function SubstitutionModal({ ex, sessionId, clientId, programId, weekId, allSessions, onSave, onClose }) {
  const [search,  setSearch]  = useState('')
  const [chosen,  setChosen]  = useState('')
  const [reason,  setReason]  = useState('')
  const [scope,   setScope]   = useState('session')
  const suggestions = React.useMemo(()=>getSubSuggestions(ex.name, allSessions),[ex.name, allSessions.length])
  const filtered = suggestions.filter(s=>!search||s.name.toLowerCase().includes(search.toLowerCase())||(s.muscles||'').toLowerCase().includes(search.toLowerCase()))
  const canSave = (chosen.trim()&&reason)
  const save = () => {
    if(!canSave) return
    onSave({original_exercise_name:ex.name,substituted_exercise_name:chosen.trim(),reason,scope,session_id:sessionId,client_id:clientId,program_id:programId,week_id:weekId,exercise_id:ex.id})
    onClose()
  }
  return(
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',zIndex:2000,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,maxWidth:540,width:'100%',maxHeight:'88vh',display:'flex',flexDirection:'column',overflow:'hidden'}}>
        <div style={{padding:'16px 20px',borderBottom:`1px solid ${C.border}`,display:'flex',alignItems:'flex-start',justifyContent:'space-between'}}>
          <div>
            <h3 style={{color:C.white,fontFamily:'Space Grotesk,sans-serif',fontWeight:700,fontSize:16,margin:'0 0 4px'}}>Substitute Exercise</h3>
            <p style={{fontSize:12,color:C.muted,margin:0}}>Replacing: <span style={{color:C.amber,fontWeight:600}}>{ex.name}</span></p>
          </div>
          <button onClick={onClose} style={{background:'none',border:'none',color:C.faint,cursor:'pointer',fontSize:20,lineHeight:1,padding:0,marginLeft:12}}>✕</button>
        </div>
        <div style={{overflow:'auto',flex:1,padding:'16px 20px'}}>
          <div style={{position:'relative',marginBottom:12}}>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search alternatives…" style={{...iS,paddingLeft:32}}/>
            <span style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:C.faint,fontSize:14,pointerEvents:'none'}}>⌕</span>
          </div>
          <label style={{...lS,marginBottom:6,display:'block'}}>Similar exercises ({detectPattern(ex.name)})</label>
          <div style={{display:'flex',flexDirection:'column',gap:4,marginBottom:14}}>
            {filtered.length===0&&<p style={{color:C.faint,fontSize:12,margin:0}}>No library matches — type any name below.</p>}
            {filtered.map(s=>(
              <div key={s.name} onClick={()=>setChosen(chosen===s.name?'':s.name)}
                style={{background:chosen===s.name?`${C.amber}18`:C.ink,border:`1.5px solid ${chosen===s.name?C.amber:C.border}`,borderRadius:8,padding:'8px 12px',cursor:'pointer',display:'flex',alignItems:'center',gap:10,transition:'all 0.1s'}}>
                <div style={{width:14,height:14,borderRadius:'50%',border:`2px solid ${chosen===s.name?C.amber:C.border}`,background:chosen===s.name?C.amber:'transparent',flexShrink:0}}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:600,color:C.white}}>{s.name}</div>
                  {s.muscles&&<div style={{fontSize:11,color:C.muted}}>{s.muscles}{s.equip?` · ${s.equip}`:''}</div>}
                </div>
                <Tag v={detectPattern(s.name).charAt(0).toUpperCase()+detectPattern(s.name).slice(1)} color={PC[detectPattern(s.name)]||C.c2} small/>
              </div>
            ))}
          </div>
          <div style={{marginBottom:14}}>
            <TI label="Or enter a custom exercise name" value={chosen} onChange={setChosen} placeholder="e.g. Leg Press"/>
          </div>
          <div style={{marginBottom:14}}>
            <label style={{...lS,marginBottom:6,display:'block'}}>Reason *</label>
            <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
              {SUB_REASONS.map(r=>(
                <button key={r} onClick={()=>setReason(r)} style={{padding:'4px 11px',borderRadius:20,border:`1.5px solid ${reason===r?C.amber:C.border}`,background:reason===r?`${C.amber}18`:'transparent',color:reason===r?C.amber:C.muted,fontSize:11,fontWeight:600,cursor:'pointer'}}>{r}</button>
              ))}
            </div>
          </div>
          <div>
            <label style={{...lS,marginBottom:6,display:'block'}}>Apply to</label>
            {SUB_SCOPES.map(s=>(
              <div key={s.v} onClick={()=>setScope(s.v)} style={{display:'flex',alignItems:'center',gap:8,padding:'5px 0',cursor:'pointer'}}>
                <div style={{width:13,height:13,borderRadius:'50%',border:`2px solid ${scope===s.v?C.amber:C.border}`,background:scope===s.v?C.amber:'transparent',flexShrink:0}}/>
                <span style={{fontSize:12,color:scope===s.v?C.white:C.muted}}>{s.l}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{padding:'12px 20px',borderTop:`1px solid ${C.border}`,display:'flex',gap:8,justifyContent:'flex-end'}}>
          <Btn label="Cancel" variant="secondary" onClick={onClose}/>
          <Btn label="Save Substitution" onClick={save} disabled={!canSave}/>
        </div>
      </div>
    </div>
  )
}

function ExerciseHistoryModal({ exerciseName, clientId, sessions, weeks, programs, onClose }) {
  const logs = collectExerciseLogs(exerciseName, clientId, sessions, weeks, programs).filter(l=>!l.excluded && !l.invalid)
  const bySession = {}
  logs.forEach(l=>{ if(!bySession[l.sessId]) bySession[l.sessId]={date:l.date,dateStr:l.dateStr,sessName:l.sessName,sets:[]}; bySession[l.sessId].sets.push(l) })
  const arr = Object.values(bySession).sort((a,b)=>(b.date?.getTime()||0)-(a.date?.getTime()||0))
  return (
    <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.72)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:16,backdropFilter:'blur(3px)'}}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,maxWidth:560,width:'100%',maxHeight:'85vh',display:'flex',flexDirection:'column',overflow:'hidden'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,padding:'15px 18px',borderBottom:`1px solid ${C.border}`}}>
          <div style={{display:'flex',alignItems:'center',gap:9,minWidth:0}}>
            <Icon name="clock" size={17} color={C.amber}/>
            <span style={{fontSize:15,fontWeight:700,color:C.white,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>History — {exerciseName}</span>
          </div>
          <button onClick={onClose} style={{background:'none',border:'none',color:C.faint,cursor:'pointer',fontSize:22,lineHeight:1,padding:'0 4px',flexShrink:0}}>×</button>
        </div>
        <div style={{overflowY:'auto',padding:'16px 18px'}}>
          {arr.length===0
            ? <p style={{color:C.muted,textAlign:'center',padding:'24px 0'}}>No history logged yet for this exercise.</p>
            : arr.map((ss,i)=>(
              <div key={i} style={{background:C.ink,border:`1px solid ${C.border}`,borderRadius:11,padding:'13px 15px',marginBottom:10}}>
                <div style={{display:'flex',alignItems:'baseline',gap:8,marginBottom:9,flexWrap:'wrap'}}>
                  <span style={{fontSize:14,fontWeight:700,color:C.amber,fontFamily:'Space Grotesk,sans-serif'}}>{ss.dateStr}</span>
                  <span style={{fontSize:11,color:C.faint,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{ss.sessName}</span>
                </div>
                <table style={{width:'100%',fontSize:13,borderCollapse:'collapse'}}>
                  <tbody>
                    <tr><td style={{color:C.faint,fontSize:10,padding:'2px 8px 4px 0',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.05em'}}>Set</td>{ss.sets.map((x,j)=><td key={j} style={{color:C.muted,fontWeight:700,textAlign:'center',padding:'2px 6px'}}>{x.setNumber||j+1}</td>)}</tr>
                    <tr><td style={{color:C.faint,fontSize:10,padding:'2px 8px 4px 0',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.05em'}}>Weight</td>{ss.sets.map((x,j)=><td key={j} style={{color:C.white,textAlign:'center',padding:'2px 6px',fontWeight:600}}>{x.rawLoad||'—'}</td>)}</tr>
                    <tr><td style={{color:C.faint,fontSize:10,padding:'2px 8px 4px 0',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.05em'}}>Reps</td>{ss.sets.map((x,j)=><td key={j} style={{color:C.white,textAlign:'center',padding:'2px 6px'}}>{x.rawReps||'—'}</td>)}</tr>
                  </tbody>
                </table>
              </div>
            ))}
        </div>
        <div style={{padding:'12px 18px',borderTop:`1px solid ${C.border}`}}>
          <button onClick={onClose} style={{width:'100%',background:C.green,color:C.bg,border:'none',borderRadius:9,padding:'13px',fontWeight:700,fontSize:13,cursor:'pointer',letterSpacing:'0.05em'}}>CLOSE</button>
        </div>
      </div>
    </div>
  )
}

function SessionMessageBox({ sessionId, clientId, programId, weekId, messages, addMessage, replyMessage, markRead, markActioned, editMessage, clientMode=false }) {
  const sessionMsgs = (messages||[]).filter(m=>m.session_id===sessionId).sort((a,b)=>new Date(a.created_at)-new Date(b.created_at))
  const [msg, setMsg] = useState('')
  const [replyId, setReplyId] = useState(null)
  const [replyTxt, setReplyTxt] = useState('')
  const [editId, setEditId] = useState(null)
  const [editTxt, setEditTxt] = useState('')
  const submit = () => { if(!msg.trim()) return; addMessage({session_id:sessionId,client_id:clientId,program_id:programId,week_id:weekId,message:msg.trim()}); setMsg('') }
  const sendReply = id => { if(!replyTxt.trim()) return; replyMessage(id,replyTxt.trim()); setReplyId(null); setReplyTxt('') }
  return(
    <div style={{marginTop:28,borderTop:`1px solid ${C.border}`,paddingTop:20}}>
      <h3 style={{fontSize:13,fontWeight:700,color:C.amber,fontFamily:'Space Grotesk,sans-serif',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:16}}>Session Notes & Messages</h3>
      {sessionMsgs.map(m=>(
        <div key={m.id} style={{background:C.ink,border:`1px solid ${m.read_at?C.border:`${C.orange}40`}`,borderRadius:10,padding:'12px 14px',marginBottom:10}}>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6,flexWrap:'wrap'}}>
            <span style={{fontSize:10,color:C.amber,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.05em'}}>Client Note</span>
            <span style={{fontSize:10,color:C.faint}}>{new Date(m.created_at).toLocaleDateString('en-AU',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</span>
            {clientMode
              ? <span style={{fontSize:9,background:m.read_at?`${C.green}20`:`${C.faint}22`,color:m.read_at?C.green:C.faint,borderRadius:4,padding:'1px 6px',fontWeight:700}}>{m.read_at?'Read':'Unread'}</span>
              : <>{!m.read_at&&<span style={{fontSize:9,background:`${C.orange}25`,color:C.orange,borderRadius:4,padding:'1px 6px',fontWeight:700}}>UNREAD</span>}{m.actioned_at&&<span style={{fontSize:9,background:`${C.green}20`,color:C.green,borderRadius:4,padding:'1px 6px',fontWeight:700}}>ACTIONED</span>}</>}
          </div>
          {clientMode && editId===m.id ? (
            <div style={{marginBottom:8}}>
              <textarea value={editTxt} onChange={e=>setEditTxt(e.target.value)} rows={3} style={{...iS,resize:'vertical',width:'100%',fontSize:13,lineHeight:1.5,marginBottom:8}}/>
              <div style={{display:'flex',gap:6}}>
                <Btn label="Save changes" small onClick={()=>{ const t=editTxt.trim(); if(t&&editMessage){ editMessage(m.id,t) } setEditId(null) }} disabled={!editTxt.trim()}/>
                <Btn label="Cancel" small variant="ghost" onClick={()=>setEditId(null)}/>
              </div>
            </div>
          ) : (
            <p style={{fontSize:13,color:C.white,margin:'0 0 8px',lineHeight:1.5}}>{m.message}</p>
          )}
          {clientMode && editId!==m.id && <button onClick={()=>{setEditId(m.id);setEditTxt(m.message||'')}} style={{background:'none',border:`1px solid ${C.border}`,borderRadius:5,padding:'2px 9px',color:C.faint,fontSize:10,cursor:'pointer',marginBottom:8}}>Edit note</button>}
          {m.reply&&(
            <div style={{background:`${C.c2}12`,border:`1px solid ${C.c2}30`,borderRadius:7,padding:'8px 10px',marginBottom:8}}>
              <div style={{fontSize:9,color:C.c3,fontWeight:700,marginBottom:3}}>COACH REPLY</div>
              <p style={{fontSize:12,color:C.white,margin:0,lineHeight:1.5}}>{m.reply}</p>
            </div>
          )}
          <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'flex-start'}}>
            {!clientMode&&!m.read_at&&<button onClick={()=>markRead(m.id)} style={{background:'none',border:`1px solid ${C.border}`,borderRadius:5,padding:'2px 8px',color:C.faint,fontSize:10,cursor:'pointer'}}>Mark read</button>}
            {!clientMode&&!m.actioned_at&&<button onClick={()=>markActioned(m.id)} style={{background:'none',border:`1px solid ${C.green}40`,borderRadius:5,padding:'2px 8px',color:C.green,fontSize:10,cursor:'pointer',fontWeight:600}}>Mark actioned</button>}
            {!clientMode&&!m.reply&&(replyId===m.id
              ?<div style={{display:'flex',gap:6,flex:1,minWidth:200}}>
                <textarea value={replyTxt} onChange={e=>setReplyTxt(e.target.value)} placeholder="Write a reply…" rows={2} style={{...iS,flex:1,resize:'none',fontSize:12}}></textarea>
                <div style={{display:'flex',flexDirection:'column',gap:4}}>
                  <Btn label="Send" small onClick={()=>sendReply(m.id)} disabled={!replyTxt.trim()}/>
                  <Btn label="Cancel" small variant="ghost" onClick={()=>{setReplyId(null);setReplyTxt('')}}/>
                </div>
              </div>
              :<button onClick={()=>setReplyId(m.id)} style={{background:'none',border:`1px solid ${C.c2}40`,borderRadius:5,padding:'2px 8px',color:C.c3,fontSize:10,cursor:'pointer',fontWeight:600}}>↩ Reply</button>
            )}
          </div>
        </div>
      ))}
      <div style={{background:C.ink,border:`1px solid ${C.border}`,borderRadius:10,padding:'14px 16px'}}>
        <label style={{fontSize:12,fontWeight:600,color:C.amber,display:'block',marginBottom:8}}>Leave a message for your coach</label>
        <textarea value={msg} onChange={e=>setMsg(e.target.value)}
          placeholder="Anything you want me to know about this session? Pain, substitutions, questions, wins, or anything that felt off?"
          rows={3} style={{...iS,resize:'vertical',marginBottom:10,fontSize:12,lineHeight:1.5}}></textarea>
        <Btn label="Send Message" onClick={submit} disabled={!msg.trim()}/>
      </div>
    </div>
  )
}



// ═══════════════════════════════════════════════════════════════════════════════
// LBS → KG CONVERTER
// ═══════════════════════════════════════════════════════════════════════════════
const LBS_RX = /^(\d+(?:\.\d+)?)\s*(?:lbs?|pounds?)\s*$/i
const LBS_INLINE_RX = /(\d+(?:\.\d+)?)\s*(?:lbs?|pounds?)/gi

function parseLbsLoad(val) {
  // Returns the lbs number if val is explicitly labelled lbs, else null
  if(!val && val !== 0) return null
  const str = String(val).trim()
  const m = str.match(LBS_RX)
  return m ? parseFloat(m[1]) : null
}

function lbsToKg(lbs) {
  return Math.round(lbs / 2.2046 * 10) / 10
}

function lbsToKgStr(lbs) {
  const kg = lbsToKg(lbs)
  return Number.isInteger(kg) ? String(kg) : String(kg)
}

// Apply to a single load string: converts "225lbs" → "102.1", leaves "100" unchanged
function normalizeLbs(val) {
  const lbs = parseLbsLoad(val)
  return lbs !== null ? lbsToKgStr(lbs) : (val || '')
}

// Apply normalizeLbs to all load fields in an exercises array. Returns {exercises, changed}
function normalizeExercisesLbs(exs) {
  let changed = false
  const result = (exs||[]).map(ex => {
    let updated = {...ex}
    const newLoad = normalizeLbs(ex.load)
    if(newLoad !== (ex.load||'')) { updated.load = newLoad; changed = true }
    const newSets = (ex.loggedSets||[]).map(ls => {
      const newCL = normalizeLbs(ls.completedLoad)
      if(newCL !== (ls.completedLoad||'')) { changed = true; return {...ls, completedLoad: newCL} }
      return ls
    })
    updated.loggedSets = newSets
    return updated
  })
  return { exercises: result, changed }
}

function scanLbsValues(sessions) {
  const hits = []
  sessions.forEach(sess => {
    safeExercises(sess).forEach(ex => {
      // Prescribed load
      const pl = parseLbsLoad(ex.load)
      if(pl !== null) hits.push({
        sessionId:sess.id, sessionName:sess.name, exerciseName:ex.name,
        exerciseId:ex.id, field:'load', setId:null,
        original:ex.load, lbs:pl, kg:lbsToKg(pl), label:'Prescribed load'
      })
      // Logged sets
      ;(ex.loggedSets||[]).forEach(ls => {
        const ll = parseLbsLoad(ls.completedLoad)
        if(ll !== null) hits.push({
          sessionId:sess.id, sessionName:sess.name, exerciseName:ex.name,
          exerciseId:ex.id, field:'completedLoad', setId:ls.id,
          original:ls.completedLoad, lbs:ll, kg:lbsToKg(ll),
          label:`Set ${ls.setNumber||'?'} logged`
        })
      })
    })
  })
  return hits
}

function LbsConverterTool({ sessions, updateSession }) {
  const [hits,      setHits]      = useState(null)   // null = not scanned yet
  const [scanning,  setScanning]  = useState(false)
  const [converting,setConverting]= useState(false)
  const [done,      setDone]      = useState(null)   // {converted, sessions} on success

  const scan = () => {
    setScanning(true)
    setTimeout(() => {
      setHits(scanLbsValues(sessions))
      setScanning(false)
      setDone(null)
    }, 10)
  }

  const convert = async () => {
    if(!hits?.length) return
    setConverting(true)

    // Group changes by session
    const bySession = {}
    hits.forEach(h => {
      if(!bySession[h.sessionId]) bySession[h.sessionId] = []
      bySession[h.sessionId].push(h)
    })

    let sessCount = 0
    for(const [sessId, changes] of Object.entries(bySession)) {
      const sess = sessions.find(s => s.id === sessId)
      if(!sess) continue
      const newExs = safeExercises(sess).map(ex => {
        let updated = {...ex}
        // Prescribed load
        const pl = parseLbsLoad(ex.load)
        if(pl !== null) updated.load = lbsToKgStr(pl)
        // Logged sets
        updated.loggedSets = (ex.loggedSets||[]).map(ls => {
          const ll = parseLbsLoad(ls.completedLoad)
          return ll !== null ? {...ls, completedLoad: lbsToKgStr(ll)} : ls
        })
        return updated
      })
      await updateSession(sessId, {exercises: newExs})
      sessCount++
    }

    setConverting(false)
    setDone({converted: hits.length, sessions: sessCount})
    setHits(null)
  }

  // Group hits by session for display
  const bySess = hits ? hits.reduce((acc, h) => {
    const key = h.sessionId
    if(!acc[key]) acc[key] = {name:h.sessionName, items:[]}
    acc[key].items.push(h)
    return acc
  }, {}) : {}

  return (
    <div style={{padding:20, maxWidth:820, margin:'0 auto'}}>
      <h1 style={{fontSize:22,fontWeight:700,color:C.white,fontFamily:'Space Grotesk,sans-serif',marginBottom:4}}>
        LBS → KG CONVERTER
      </h1>
      <p style={{fontSize:13,color:C.muted,marginBottom:20,lineHeight:1.6}}>
        Scans all sessions for logged or prescribed loads marked with <span style={{color:C.amber,fontWeight:600}}>lbs / lb / pounds</span> and converts them to kg.
        Only explicitly labelled values are converted — unlabelled numbers are left unchanged.
      </p>

      {/* Scan button */}
      {hits === null && !done && (
        <Btn label={scanning ? 'Scanning…' : 'Scan All Sessions'} loading={scanning} onClick={scan}/>
      )}

      {/* Done state */}
      {done && (
        <Card style={{background:`${C.green}12`,border:`1px solid ${C.green}40`,marginBottom:16}}>
          <p style={{color:C.green,fontWeight:700,fontSize:14,margin:'0 0 4px'}}>
            ✓ Conversion complete
          </p>
          <p style={{color:C.muted,fontSize:12,margin:0}}>
            {done.converted} value{done.converted!==1?'s':''} converted across {done.sessions} session{done.sessions!==1?'s':''}.
          </p>
          <button onClick={scan} style={{marginTop:10,background:'none',border:`1px solid ${C.border}`,borderRadius:6,padding:'5px 12px',color:C.muted,fontSize:11,cursor:'pointer'}}>
            Scan again
          </button>
        </Card>
      )}

      {/* Results */}
      {hits !== null && (
        <>
          {hits.length === 0 ? (
            <Card style={{textAlign:'center',padding:28}}>
              <p style={{color:C.green,fontWeight:700,fontSize:14,margin:'0 0 4px'}}>✓ No lbs values found</p>
              <p style={{color:C.muted,fontSize:12,margin:0}}>All logged loads appear to be in kg already.</p>
            </Card>
          ) : (
            <>
              <Card style={{background:`${C.orange}10`,border:`1px solid ${C.orange}35`,marginBottom:16,padding:'12px 16px'}}>
                <Row style={{alignItems:'center',gap:12,flexWrap:'wrap'}}>
                  <div style={{flex:1}}>
                    <p style={{color:C.orange,fontWeight:700,fontSize:14,margin:'0 0 2px'}}>
                      Found {hits.length} lbs value{hits.length!==1?'s':''} in {Object.keys(bySess).length} session{Object.keys(bySess).length!==1?'s':''}
                    </p>
                    <p style={{color:C.muted,fontSize:12,margin:0}}>Review below, then click Convert to apply.</p>
                  </div>
                  <Btn label={converting ? 'Converting…' : `Convert ${hits.length} Values`}
                    loading={converting} onClick={convert}/>
                </Row>
              </Card>

              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                {Object.entries(bySess).map(([sessId, {name, items}]) => (
                  <Card key={sessId} style={{padding:'12px 14px'}}>
                    <p style={{fontWeight:700,color:C.white,fontSize:13,margin:'0 0 8px'}}>{name}</p>
                    <div style={{display:'flex',flexDirection:'column',gap:4}}>
                      {items.map((h,i) => (
                        <div key={i} style={{display:'flex',alignItems:'center',gap:10,fontSize:12,padding:'4px 0',borderBottom:`1px solid ${C.border}30`,flexWrap:'wrap'}}>
                          <span style={{color:C.muted,minWidth:140,flexShrink:0}}>{h.exerciseName}</span>
                          <span style={{color:C.faint,fontSize:10,minWidth:90}}>{h.label}</span>
                          <span style={{color:C.orange,fontWeight:700,fontFamily:'monospace'}}>{h.original}</span>
                          <span style={{color:C.faint}}>→</span>
                          <span style={{color:C.green,fontWeight:700,fontFamily:'monospace'}}>{h.kg} kg</span>
                        </div>
                      ))}
                    </div>
                  </Card>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// CLIENT PREVIEW APP — what a client sees when they log in
// Mobile-style layout: bottom tabs, single column, focused on their data only.
// ═══════════════════════════════════════════════════════════════════════════════
// Circular progress ring (premium completion/consistency dial)
function Ring({ pct, size=76, stroke=7, color=C.amber, track=C.lift, children }) {
  const p = Math.max(0, Math.min(100, pct||0))
  const r = (size-stroke)/2, circ = 2*Math.PI*r, off = circ*(1-p/100)
  return (
    <div style={{position:'relative',width:size,height:size,flexShrink:0}}>
      <svg width={size} height={size} style={{transform:'rotate(-90deg)'}}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={track} strokeWidth={stroke}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={off} style={{transition:'stroke-dashoffset 0.7s cubic-bezier(0.4,0,0.2,1)'}}/>
      </svg>
      <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',lineHeight:1}}>{children}</div>
    </div>
  )
}
// Section label — Space Grotesk caps, optional leading icon
function CLabel({ children, color=C.amber, icon }) {
  return (
    <div style={{fontSize:10,fontWeight:700,color,fontFamily:'Space Grotesk,sans-serif',textTransform:'uppercase',letterSpacing:'0.14em',marginBottom:9,display:'flex',alignItems:'center',gap:6}}>
      {icon&&<Icon name={icon} size={13} color={color}/>}{children}
    </div>
  )
}

function ClientSessionSummary({ sess, programName, status, onResume }){
  const exs = safeExercises(sess)
  const main = exs.filter(e=>!e.isWarmup)
  const warm = exs.filter(e=>e.isWarmup)
  const tgt = (src, idx) => { if(src==null) return ''; const parts=String(src).split('/').map(z=>z.trim()).filter(Boolean); return parts.length>1?(parts[Math.min(idx,parts.length-1)]||''):(parts[0]||String(src).trim()) }
  const meta = status==='complete' ? {label:'Complete', color:C.green, icon:'check'} : status==='inprogress' ? {label:'In progress', color:C.amber, icon:'clock'} : {label:'Not started', color:C.faint, icon:'play'}
  const btnLabel = status==='notstarted' ? 'Start session' : 'Resume session'
  return (
    <div style={{padding:'4px 0 0'}}>
      <div style={{marginBottom:14}}>
        <h1 style={{fontSize:22,fontWeight:700,color:C.white,fontFamily:'Space Grotesk,sans-serif',letterSpacing:'-0.01em',marginBottom:6}}>{sess.name}</h1>
        <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
          {programName && <span style={{fontSize:12,color:C.muted}}>{programName}</span>}
          <span style={{display:'flex',alignItems:'center',gap:5,background:`${meta.color}1A`,color:meta.color,fontSize:11,fontWeight:700,padding:'4px 10px',borderRadius:999}}><Icon name={meta.icon} size={12} color={meta.color}/>{meta.label}</span>
        </div>
      </div>
      <button onClick={onResume} style={{width:'100%',background:C.amber,color:C.bg,border:'none',padding:'15px 16px',borderRadius:11,fontWeight:700,fontSize:15,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8,fontFamily:'Space Grotesk,sans-serif',letterSpacing:'0.02em',marginBottom:18}}>
        <Icon name="play" size={15} color={C.bg} fill={C.bg}/>{btnLabel}
      </button>
      <div style={{fontSize:10,fontWeight:700,color:C.faint,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:8}}>{status==='notstarted'?'Prescribed':'What you hit'}</div>
      <div style={{display:'flex',flexDirection:'column',gap:8}}>
        {main.map(ex=>{
          const N=Math.max(1,parseInt(ex.sets)||1)
          const sets=Array.from({length:N},(_,i)=>i+1)
          return (
            <div key={ex.id} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:11,padding:'12px 14px'}}>
              <div style={{fontSize:14,fontWeight:600,color:C.white,marginBottom:8}}>{ex.name}</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                {sets.map(sn=>{
                  const ls=(ex.loggedSets||[]).find(z=>z.setNumber===sn)
                  const load=ls&&ls.completedLoad!=null&&String(ls.completedLoad).trim()!==''?String(ls.completedLoad).trim():null
                  const reps=ls&&ls.completedReps!=null&&String(ls.completedReps).trim()!==''?String(ls.completedReps).trim():null
                  const logged=!!(load||reps)
                  const txt=logged?(load&&reps?`${load} × ${reps}`:(reps||load)):(tgt(ex.reps,sn-1)||'—')
                  return <span key={sn} style={{fontSize:12,fontWeight:700,color:logged?C.white:C.faint,background:logged?`${C.green}14`:C.ink,border:`1px solid ${logged?`${C.green}40`:C.border}`,borderRadius:7,padding:'5px 9px'}}>{txt}</span>
                })}
              </div>
            </div>
          )
        })}
      </div>
      {warm.length>0 && <div style={{fontSize:11,color:C.faint,marginTop:12,textAlign:'center'}}>+ {warm.length} warm-up movement{warm.length!==1?'s':''}</div>}
    </div>
  )
}
function ClientPreviewApp({ client, sessions, allSessions, programs, weeks, goals, measurements, updateSession, onExit, av=0, messages, addMessage, replyMessage, markMsgRead, markMsgActioned, editMessage, chats=[], chatMessages=[], addChatMessage, chatUnread, markChatRead, isRealClient=false }) {
  const [tab, setTab] = useState('home')
  const [chatOpenId, setChatOpenId] = useState(null)
  const [chatDraft, setChatDraft] = useState('')
  const chatsUnreadTotal = (chats||[]).reduce((n,c)=>n+(typeof chatUnread==='function'?chatUnread(c.id):0),0)
  const [openSessionId, setOpenSessionId] = useState(null)
  const [weekOffset, setWeekOffset] = useState(0)
  const [sessionFull, setSessionFull] = useState(false)
  const openSess = (id, full=false) => { setSessionFull(!!full); setOpenSessionId(id) }
  const [progressEx, setProgressEx] = useState(null)

  const sessDone = s => { try { return computeSessionStatus(s)==='complete' } catch(e){} return s.status==='completed' }
  const sessSkipped = s => s.status==='skipped'
  const skipSession = id => updateSession(id, {status:'skipped', completed_at:null})
  const unskipSession = id => updateSession(id, {status:null, completed_at:null})

  // Date anchors
  const todayStart = new Date(); todayStart.setHours(0,0,0,0)
  const tomorrowEnd = new Date(todayStart); tomorrowEnd.setDate(tomorrowEnd.getDate()+1)
  const tomorrowDayEnd = new Date(todayStart); tomorrowDayEnd.setDate(tomorrowDayEnd.getDate()+2)
  const weekStart = new Date(todayStart); weekStart.setDate(weekStart.getDate()-((weekStart.getDay()+6)%7)) // Monday
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate()+7)
  const viewWeekStart = new Date(weekStart); viewWeekStart.setDate(weekStart.getDate()+weekOffset*7)
  const viewWeekEnd = new Date(viewWeekStart); viewWeekEnd.setDate(viewWeekStart.getDate()+7)

  const currentProgram = programs.find(p=>p.status==='current')

  // Dated sessions
  const datedSessions = sessions.map(s => ({sess:s, date:getSessionDate(s, allSessions, weeks, programs)})).filter(x => x.date)
  const todaySession = datedSessions.find(x => x.date >= todayStart && x.date < tomorrowEnd && !sessDone(x.sess) && !sessSkipped(x.sess))
  const todayDoneSession = datedSessions.find(x => x.date >= todayStart && x.date < tomorrowEnd && (sessDone(x.sess) || sessSkipped(x.sess)))
  const tomorrowSession = datedSessions.find(x => x.date >= tomorrowEnd && x.date < tomorrowDayEnd && !sessDone(x.sess) && !sessSkipped(x.sess))
  const upcomingSessions = datedSessions.filter(x => x.date >= todayStart && !sessDone(x.sess) && !sessSkipped(x.sess)).sort((a,b)=>a.date-b.date)
  const recentCompletedSessions = sessions.filter(sessDone).filter(s=>s.completed_at).sort((a,b)=>new Date(b.completed_at)-new Date(a.completed_at)).slice(0,10)
  const missedSessions = datedSessions.filter(x => x.date < todayStart && !sessDone(x.sess) && !sessSkipped(x.sess)).sort((a,b)=>b.date-a.date).slice(0,10)
  const skippedSessions = datedSessions.filter(x => sessSkipped(x.sess)).sort((a,b)=>b.date-a.date).slice(0,10)

  // Week-at-a-glance
  const weekDays = Array.from({length:7}).map((_,i)=>{
    const d = new Date(viewWeekStart); d.setDate(viewWeekStart.getDate()+i)
    const dEnd = new Date(d); dEnd.setDate(d.getDate()+1)
    const daySess = datedSessions.filter(x=>x.date>=d && x.date<dEnd)
    const done = daySess.some(x=>sessDone(x.sess))
    const skipped = !done && daySess.some(x=>sessSkipped(x.sess))
    return { date:d, label:['M','T','W','T','F','S','S'][i], num:d.getDate(),
      hasSession:daySess.length>0, done, skipped, sessId: daySess[0]?daySess[0].sess.id:null,
      missed: !done && !skipped && d<todayStart && daySess.some(x=>!sessSkipped(x.sess)),
      isToday:d.getTime()===todayStart.getTime(), isPast:d<todayStart }
  })
  const weeklyScheduled = datedSessions.filter(x=>x.date>=weekStart && x.date<weekEnd).length
  const weeklyDone = datedSessions.filter(x=>x.date>=weekStart && x.date<weekEnd && sessDone(x.sess)).length
  const weekPct = weeklyScheduled>0 ? Math.round(weeklyDone/weeklyScheduled*100) : 0

  // Streak — forgiving: skips & rest days are transparent; a miss only resets after a 2-day mercy with no recovery
  const DAY = 86400000
  const dayN = dt => { const x = new Date(dt); x.setHours(0,0,0,0); return x.getTime() }
  const todayN = todayStart.getTime()
  const streakItems = datedSessions.filter(x => dayN(x.date) <= todayN).map(x => {
    const dn = dayN(x.date)
    const kind = sessDone(x.sess) ? 'done' : sessSkipped(x.sess) ? 'skip' : dn < todayN ? 'miss' : 'pending'
    return { dn, kind }
  }).sort((a,b)=>b.dn-a.dn)
  const doneDayNs = streakItems.filter(i=>i.kind==='done').map(i=>i.dn)
  let streak = 0, streakAtRisk = false
  for(const it of streakItems){
    if(it.kind==='done'){ streak++; continue }
    if(it.kind==='skip' || it.kind==='pending'){ continue }
    const forgiven = doneDayNs.some(cd => cd > it.dn && cd <= it.dn + 2*DAY)   // recovered within 2 days
    if(forgiven) continue
    if((todayN - it.dn) >= 2*DAY) break          // 2 days passed unrecovered → streak ends here
    streakAtRisk = true                           // recent miss, still inside the 2-day mercy
  }
  if(streak===0) streakAtRisk = false
  const totalDone = sessions.filter(sessDone).length

  // PBs
  const pbs = getClientPBs(client.id, sessions, allSessions, weeks, programs)
  const recentPBs = (()=>{
    const cutoff = Date.now() - 30*86400000; const found = []
    pbs.forEach(pb => { let runningMax = 0; pb.history.forEach(h => { if(h.e1rm > runningMax){ const isNew = runningMax>0; if(isNew && h.date && h.date.getTime()>cutoff) found.push({exercise:pb.name, e1rm:h.e1rm, date:h.date}); runningMax = h.e1rm } }) })
    return found.sort((a,b)=>b.date-a.date).slice(0,3)
  })()
  const topPBs = pbs.map(p=>({name:p.name, e1rm:Math.max(0,...p.history.map(h=>h.e1rm||0))})).filter(x=>x.e1rm>0).sort((a,b)=>b.e1rm-a.e1rm).slice(0,3)

  const firstName = (client.name||'').split(' ')[0]
  const todayStr = new Date().toLocaleDateString('en-AU',{weekday:'long',day:'numeric',month:'long'}).toUpperCase()
  const h = new Date().getHours()
  const greeting = `Good ${h<5?'evening':h<12?'morning':h<18?'afternoon':'evening'}, ${firstName}`

  // Session open → existing logging flow
  if(openSessionId) {
    const sess = sessions.find(s=>s.id===openSessionId)
    if(sess) {
      return (
        <div style={{background:C.bg,minHeight:'100vh',color:C.white,fontSize:14}}>
          <PreviewBanner client={client} onExit={onExit} isRealClient={isRealClient}/>
          <div style={{maxWidth:560, margin:'0 auto', padding:'16px 14px 90px'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,marginBottom:8}}>
              <button onClick={()=>setOpenSessionId(null)} style={{background:'none',border:'none',color:C.amber,cursor:'pointer',fontSize:13,fontWeight:600,padding:'6px 0',display:'flex',alignItems:'center',gap:5}}>
                <Icon name="play" size={13} color={C.amber} style={{transform:'rotate(180deg)'}}/> Back
              </button>
              {sessSkipped(sess)
                ? <button onClick={()=>unskipSession(sess.id)} style={{background:'transparent',border:`1px solid ${C.border}`,borderRadius:6,padding:'5px 11px',color:C.muted,fontSize:11,fontWeight:700,cursor:'pointer'}}>Un-skip</button>
                : !sessDone(sess) && <button onClick={()=>{skipSession(sess.id); setOpenSessionId(null); setTab('sessions')}} style={{background:'transparent',border:`1px solid ${C.border}`,borderRadius:6,padding:'5px 11px',color:C.muted,fontSize:11,fontWeight:700,cursor:'pointer'}}>Skip session</button>}
            </div>
            {(()=>{
              const _exs=safeExercises(sess)
              const _anyLogged=_exs.some(e=>(e.loggedSets||[]).some(ls=>(ls.completedLoad!=null&&String(ls.completedLoad).trim()!=='')||(ls.completedReps!=null&&String(ls.completedReps).trim()!=='')))
              const _st=sessDone(sess)?'complete':_anyLogged?'inprogress':'notstarted'
              if(!sessionFull) return <ClientSessionSummary sess={sess} programName={(programs.find(p=>p.id===sess.program_id)||{}).name||''} status={_st} onResume={()=>setSessionFull(true)}/>
              return (
            <SessionDetail sessionId={openSessionId} programId={sess.program_id} clientId={client.id} clients={[client]} programs={programs} weeks={weeks} sessions={allSessions} updateSession={updateSession} saving={false} clientMode={true}
              messages={messages} addMessage={addMessage} replyMessage={replyMessage} markMsgRead={markMsgRead} markMsgActioned={markMsgActioned} editMessage={editMessage}
              go={(view)=>{ if(view==='program'){setOpenSessionId(null);setTab('sessions')} else if(view==='client'){setOpenSessionId(null);setTab('home')} else setOpenSessionId(null) }}/>
              )
            })()}
          </div>
          <ClientBottomNav tab={tab} setTab={t=>{setOpenSessionId(null);setTab(t)}} chatsUnread={chatsUnreadTotal}/>
        </div>
      )
    }
  }

  return (
    <div style={{background:C.bg,minHeight:'100vh',color:C.white,fontSize:14}}>
      <PreviewBanner client={client} onExit={onExit} isRealClient={isRealClient}/>
      <div style={{maxWidth:560, margin:'0 auto', padding:'20px 16px 96px'}}>

        {/* ────── HOME ────── */}
        {tab==='home' && (<>
          <div style={{marginBottom:20}}>
            <h1 style={{fontSize:26,fontWeight:600,color:C.white,letterSpacing:'-0.01em',marginBottom:6}}>{greeting}</h1>
            <div style={{fontSize:11,fontWeight:700,color:C.amber,fontFamily:'Space Grotesk,sans-serif',letterSpacing:'0.12em'}}>{todayStr}</div>
          </div>

          {client.pain_flag && (
            <div style={{display:'flex',alignItems:'center',gap:9,background:`${C.orange}12`,border:`1px solid ${C.orange}40`,borderRadius:10,padding:'11px 14px',marginBottom:18}}>
              <Icon name="alert" size={16} color={C.orange}/>
              <span style={{fontSize:12.5,color:C.orange,fontWeight:600}}>Pain flagged — train within comfort and log anything that bothers you.</span>
            </div>
          )}

          {/* Stat cards: weekly ring + streak */}
          <div style={{display:'flex',gap:10,marginBottom:22}}>
            <div style={{flex:1,background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:'16px 14px',display:'flex',alignItems:'center',gap:14}}>
              <Ring pct={weekPct} color={trafficColor(weekPct)}>
                <span style={{fontSize:18,fontWeight:700,color:C.white,fontFamily:'Space Grotesk,sans-serif'}}>{weekPct}%</span>
              </Ring>
              <div style={{minWidth:0}}>
                <div style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:3}}>This Week</div>
                <div style={{fontSize:13,color:C.white,fontWeight:600}}>{weeklyDone}/{weeklyScheduled} done</div>
                <div style={{fontSize:11,color:C.faint,marginTop:1}}>{weeklyScheduled-weeklyDone>0?`${weeklyScheduled-weeklyDone} to go`:weeklyScheduled>0?'All done':'No sessions'}</div>
              </div>
            </div>
            <div style={{flex:1,background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:'16px 14px',display:'flex',flexDirection:'column',justifyContent:'center'}}>
              <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:4}}><Icon name="activity" size={14} color={C.amber}/><span style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:'uppercase',letterSpacing:'0.1em'}}>Streak</span></div>
              <div style={{fontSize:32,fontWeight:700,color:C.white,fontFamily:'Space Grotesk,sans-serif',lineHeight:1}}>{streak}</div>
              <div style={{fontSize:11,color:C.faint,marginTop:4}}>{streak===1?'session in a row':'sessions in a row'} · {totalDone} all-time</div>
            </div>
          </div>

          {/* Streak reminder */}
          {streak>0 && streakAtRisk ? (
            <div style={{display:'flex',alignItems:'center',gap:10,background:`${C.orange}15`,border:`1px solid ${C.orange}55`,borderRadius:12,padding:'13px 15px',marginBottom:22}}>
              <Icon name="alert" size={17} color={C.orange}/>
              <div style={{fontSize:12.5,color:C.white,fontWeight:600,lineHeight:1.4}}>Your {streak}-session streak is about to end. {todaySession?'Finish today’s session to keep it alive.':'Train or skip a session to keep it alive.'}</div>
            </div>
          ) : streak>0 && todaySession ? (
            <div style={{display:'flex',alignItems:'center',gap:10,background:`${C.amber}12`,border:`1px solid ${C.amber}40`,borderRadius:12,padding:'13px 15px',marginBottom:22}}>
              <Icon name="activity" size={17} color={C.amber}/>
              <div style={{fontSize:12.5,color:C.white,fontWeight:600}}>Keep your {streak}-session streak alive — today’s session is ready.</div>
            </div>
          ) : streak===0 && todaySession ? (
            <div style={{display:'flex',alignItems:'center',gap:10,background:`${C.amber}0E`,border:`1px solid ${C.border}`,borderRadius:12,padding:'13px 15px',marginBottom:22}}>
              <Icon name="rocket" size={17} color={C.amber}/>
              <div style={{fontSize:12.5,color:C.muted,fontWeight:600}}>Start a new streak today — your session is ready.</div>
            </div>
          ) : null}

          {/* Week-at-a-glance */}
          <div style={{marginBottom:22}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,marginBottom:10}}>
              <button onClick={()=>setWeekOffset(weekOffset-1)} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:9,width:32,height:32,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:C.muted,flexShrink:0,fontSize:18,lineHeight:1}}>‹</button>
              <button onClick={()=>setWeekOffset(0)} style={{background:'none',border:'none',cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',gap:1,flex:1}}>
                <span style={{fontSize:11,fontWeight:700,color:C.c3,fontFamily:'Space Grotesk,sans-serif',textTransform:'uppercase',letterSpacing:'0.1em'}}>{weekOffset===0?'This Week':weekOffset===-1?'Last Week':weekOffset===1?'Next Week':`${Math.abs(weekOffset)} Weeks ${weekOffset<0?'Ago':'Ahead'}`}</span>
                <span style={{fontSize:10,color:C.faint}}>{viewWeekStart.toLocaleDateString('en-AU',{day:'numeric',month:'short'})} – {new Date(viewWeekStart.getTime()+6*86400000).toLocaleDateString('en-AU',{day:'numeric',month:'short'})}</span>
              </button>
              <button onClick={()=>setWeekOffset(weekOffset+1)} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:9,width:32,height:32,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:C.muted,flexShrink:0,fontSize:18,lineHeight:1}}>›</button>
            </div>
            <div style={{display:'flex',gap:5,justifyContent:'space-between'}}>
              {weekDays.map((d,i)=>{
                const bg = d.done ? C.amber : d.isToday ? `${C.amber}1A` : 'transparent'
                const bd = d.isToday ? C.amber : d.missed ? `${C.red}55` : d.hasSession ? C.lift : C.border
                const numCol = d.done ? C.bg : d.isToday ? C.amber : d.skipped ? C.faint : d.hasSession ? C.white : C.faint
                const dot = d.done ? null : d.missed ? C.red : d.skipped ? C.muted : (d.hasSession && !d.isPast) ? C.c2 : null
                return (
                  <div key={i} onClick={()=>{ if(d.sessId) openSess(d.sessId,false) }} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:5,cursor:d.hasSession?'pointer':'default'}}>
                    <span style={{fontSize:10,fontWeight:700,color:d.isToday?C.amber:C.faint,letterSpacing:'0.04em'}}>{d.label}</span>
                    <div style={{width:'100%',aspectRatio:'1',maxWidth:42,borderRadius:10,background:bg,border:`1.5px solid ${bd}`,display:'flex',alignItems:'center',justifyContent:'center',position:'relative'}}>
                      {d.done ? <Icon name="check" size={16} color={C.bg}/> : d.skipped ? <span style={{fontSize:14,fontWeight:700,color:C.faint}}>–</span> : <span style={{fontSize:13,fontWeight:700,color:numCol}}>{d.num}</span>}
                      {dot && <span style={{position:'absolute',bottom:5,width:4,height:4,borderRadius:'50%',background:dot}}/>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Today's session hero */}
          {todaySession ? (
            <div style={{marginBottom:22}}>
              <CLabel icon="play">Today's Session</CLabel>
              <div onClick={()=>openSess(todaySession.sess.id,true)} style={{background:`linear-gradient(135deg, ${C.card} 0%, ${C.ink} 100%)`,border:`1px solid ${C.amber}40`,borderLeft:`3px solid ${C.amber}`,borderRadius:14,padding:'20px 22px',cursor:'pointer'}}>
                <div style={{fontSize:19,fontWeight:700,color:C.white,marginBottom:4}}>{todaySession.sess.name}</div>
                <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',marginBottom:14}}>
                  {currentProgram && <span style={{fontSize:12,color:C.muted}}>{currentProgram.name}</span>}
                  {todaySession.sess.focus && <><span style={{color:C.faint}}>·</span><span style={{fontSize:12,color:C.amber,fontWeight:600}}>{todaySession.sess.focus}</span></>}
                </div>
                <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:16,fontSize:12,color:C.faint}}>
                  <span style={{display:'flex',alignItems:'center',gap:5}}><Icon name="dumbbell" size={13} color={C.faint}/>{safeExercises(todaySession.sess).filter(e=>!e.isWarmup).length} exercises</span>
                  {todaySession.sess.estimated_duration && <span style={{display:'flex',alignItems:'center',gap:5}}><Icon name="clock" size={13} color={C.faint}/>~{todaySession.sess.estimated_duration} min</span>}
                </div>
                <div style={{background:C.amber,color:C.bg,padding:'12px 16px',borderRadius:9,fontWeight:700,fontSize:13.5,textAlign:'center',display:'flex',alignItems:'center',justifyContent:'center',gap:7}}><Icon name="play" size={15} color={C.bg} fill={C.bg}/> Start Session</div>
                <button onClick={(e)=>{e.stopPropagation(); skipSession(todaySession.sess.id)}} style={{display:'block',width:'100%',marginTop:10,background:'none',border:'none',color:C.faint,fontSize:12,fontWeight:600,cursor:'pointer',textAlign:'center'}}>Skip today's session</button>
              </div>
            </div>
          ) : todayDoneSession ? (
            <div style={{marginBottom:22}}>
              <CLabel icon="check" color={C.green}>Today's Session</CLabel>
              <div onClick={()=>openSess(todayDoneSession.sess.id,false)} style={{background:`linear-gradient(135deg, ${C.card} 0%, ${C.ink} 100%)`,border:`1px solid ${C.green}40`,borderLeft:`3px solid ${C.green}`,borderRadius:14,padding:'20px 22px',cursor:'pointer'}}>
                <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:10,marginBottom:6}}>
                  <div style={{fontSize:19,fontWeight:700,color:C.white}}>{todayDoneSession.sess.name}</div>
                  <span style={{flexShrink:0,background:`${C.green}1A`,color:C.green,fontSize:11,fontWeight:700,padding:'4px 10px',borderRadius:999,display:'flex',alignItems:'center',gap:5}}><Icon name="check" size={12} color={C.green}/>{sessSkipped(todayDoneSession.sess)?'Skipped':'Complete'}</span>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',marginBottom:14}}>
                  {currentProgram && <span style={{fontSize:12,color:C.muted}}>{currentProgram.name}</span>}
                  {todayDoneSession.sess.focus && <><span style={{color:C.faint}}>·</span><span style={{fontSize:12,color:C.amber,fontWeight:600}}>{todayDoneSession.sess.focus}</span></>}
                </div>
                <div style={{background:`${C.green}14`,color:C.green,padding:'12px 16px',borderRadius:9,fontWeight:700,fontSize:13.5,textAlign:'center'}}>Resume session</div>
              </div>
            </div>
          ) : tomorrowSession ? (
            <div style={{marginBottom:22}}>
              <CLabel icon="clock" color={C.c3}>Next Up — Tomorrow</CLabel>
              <div onClick={()=>openSess(tomorrowSession.sess.id,false)} style={{background:C.card,border:`1px solid ${C.border}`,borderLeft:`3px solid ${C.c2}`,borderRadius:12,padding:'18px 20px',cursor:'pointer'}}>
                <div style={{fontSize:16,fontWeight:700,color:C.white,marginBottom:4}}>{tomorrowSession.sess.name}</div>
                {currentProgram && <div style={{fontSize:12,color:C.muted}}>{currentProgram.name}</div>}
              </div>
            </div>
          ) : (
            <div style={{marginBottom:22,background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:'26px 20px',textAlign:'center'}}>
              <Icon name="check" size={24} color={C.green}/>
              <div style={{fontSize:14,fontWeight:600,color:C.white,margin:'10px 0 4px'}}>Nothing scheduled today</div>
              <div style={{fontSize:12,color:C.faint,fontStyle:'italic'}}>Rest up — your next session will appear here.</div>
            </div>
          )}

          {/* Recent PBs */}
          {recentPBs.length>0 && (
            <div style={{marginBottom:22}}>
              <CLabel icon="trophy" color={C.gold}>Recent PBs</CLabel>
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                {recentPBs.map((pb,i)=>(
                  <div key={i} onClick={()=>{setProgressEx(pb.exercise);setTab('progress')}} style={{background:`linear-gradient(135deg, ${C.gold}10 0%, ${C.card} 60%)`,border:`1px solid ${C.gold}33`,borderRadius:10,padding:'13px 15px',display:'flex',alignItems:'center',gap:12,cursor:'pointer'}}>
                    <div style={{width:34,height:34,borderRadius:9,background:`${C.gold}1A`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><Icon name="trophy" size={17} color={C.gold}/></div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:13,color:C.white,fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{pb.exercise}</div>
                      <div style={{fontSize:11,color:C.faint,marginTop:2}}>{pb.date?.toLocaleDateString('en-AU',{day:'numeric',month:'short'})}</div>
                    </div>
                    <div style={{fontSize:15,fontWeight:700,color:C.gold,fontFamily:'Space Grotesk,sans-serif'}}>{Math.round(pb.e1rm*10)/10}kg</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Current program */}
          {currentProgram && (
            <div style={{marginBottom:8}}>
              <CLabel icon="layers" color={C.c3}>Current Program</CLabel>
              <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:'15px 17px'}}>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8,flexWrap:'wrap'}}>
                  <span style={{fontSize:14,fontWeight:700,color:C.white}}>{currentProgram.name}</span>
                  {currentProgram.phase&&<Tag v={currentProgram.phase} color={C.amber} small/>}
                </div>
                {(()=>{ const ps = sessions.filter(s=>s.program_id===currentProgram.id); const done = ps.filter(sessDone).length; const pct = ps.length>0?Math.round(done/ps.length*100):0
                  return (<><div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:C.muted,marginBottom:6}}><span>{done}/{ps.length} sessions</span><span style={{color:trafficColor(pct),fontWeight:700}}>{pct}%</span></div><ProgressBar value={pct}/></>) })()}
              </div>
            </div>
          )}
        </>)}

        {/* ────── SESSIONS ────── */}
        {tab==='sessions' && (<>
          <div style={{marginBottom:20}}>
            <h2 style={{fontSize:22,fontWeight:600,color:C.white,marginBottom:6}}>My Training</h2>
            <div style={{fontSize:13,color:C.muted}}>{upcomingSessions.length} upcoming · {recentCompletedSessions.length} recently completed</div>
          </div>

          {upcomingSessions.length>0 && (
            <div style={{marginBottom:24}}>
              <CLabel icon="calendar">Upcoming</CLabel>
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                {upcomingSessions.slice(0,10).map(({sess,date})=>{
                  const prog = programs.find(p=>p.id===sess.program_id)
                  const isToday = date.toDateString()===todayStart.toDateString()
                  const dayLabel = isToday ? 'Today' : date.toLocaleDateString('en-AU',{weekday:'long',day:'numeric',month:'short'})
                  return (
                    <div key={sess.id} onClick={()=>openSess(sess.id,false)} style={{background:C.card,border:`1px solid ${isToday?`${C.amber}40`:C.border}`,borderLeft:`3px solid ${isToday?C.amber:C.c2}`,borderRadius:9,padding:'14px 16px',cursor:'pointer',display:'flex',justifyContent:'space-between',alignItems:'center',gap:10}}>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:14,fontWeight:700,color:C.white,marginBottom:3}}>{sess.name}</div>
                        <div style={{fontSize:11,color:C.faint}}>{dayLabel}{prog&&` · ${prog.name}`}{sess.focus?` · ${sess.focus}`:''}</div>
                      </div>
                      {isToday ? <span style={{fontSize:10,fontWeight:700,color:C.amber,textTransform:'uppercase',letterSpacing:'0.06em'}}>Today</span> : <Icon name="play" size={15} color={C.c3}/>}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {missedSessions.length>0 && (
            <div style={{marginBottom:24}}>
              <CLabel icon="alert" color={C.orange}>Missed — skip to clear</CLabel>
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                {missedSessions.map(({sess,date})=>{
                  const prog = programs.find(p=>p.id===sess.program_id)
                  return (
                    <div key={sess.id} style={{background:C.card,border:`1px solid ${C.orange}33`,borderLeft:`3px solid ${C.orange}`,borderRadius:9,padding:'12px 14px',display:'flex',alignItems:'center',gap:10}}>
                      <div onClick={()=>openSess(sess.id,false)} style={{flex:1,minWidth:0,cursor:'pointer'}}>
                        <div style={{fontSize:13.5,fontWeight:700,color:C.white,marginBottom:2}}>{sess.name}</div>
                        <div style={{fontSize:11,color:C.faint}}>{date.toLocaleDateString('en-AU',{weekday:'short',day:'numeric',month:'short'})}{prog&&` · ${prog.name}`}</div>
                      </div>
                      <button onClick={()=>skipSession(sess.id)} style={{flexShrink:0,background:'transparent',border:`1px solid ${C.border}`,borderRadius:6,padding:'5px 11px',color:C.muted,fontSize:11,fontWeight:700,cursor:'pointer'}}>Skip</button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {recentCompletedSessions.length>0 && (
            <div>
              <CLabel icon="check" color={C.c3}>Recently Completed</CLabel>
              <div style={{display:'flex',flexDirection:'column',gap:5}}>
                {recentCompletedSessions.map(sess=>{
                  const prog = programs.find(p=>p.id===sess.program_id); const d = sess.completed_at ? new Date(sess.completed_at) : null
                  return (
                    <div key={sess.id} onClick={()=>openSess(sess.id,false)} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:9,padding:'12px 14px',cursor:'pointer',display:'flex',alignItems:'center',gap:11}}>
                      <div style={{width:26,height:26,borderRadius:7,background:`${C.green}1A`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><Icon name="check" size={14} color={C.green}/></div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13,color:C.white,fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{sess.name}</div>
                        <div style={{fontSize:11,color:C.faint,marginTop:2}}>{prog?.name}{d&&` · ${d.toLocaleDateString('en-AU',{day:'numeric',month:'short'})}`}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {skippedSessions.length>0 && (
            <div style={{marginTop:24}}>
              <CLabel icon="circle" color={C.muted}>Skipped</CLabel>
              <div style={{display:'flex',flexDirection:'column',gap:5}}>
                {skippedSessions.map(({sess,date})=>{
                  const prog = programs.find(p=>p.id===sess.program_id)
                  return (
                    <div key={sess.id} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:9,padding:'11px 14px',display:'flex',alignItems:'center',gap:10,opacity:0.8}}>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13,color:C.muted,fontWeight:500}}>{sess.name}</div>
                        <div style={{fontSize:11,color:C.faint,marginTop:2}}>Skipped · {date.toLocaleDateString('en-AU',{day:'numeric',month:'short'})}{prog&&` · ${prog.name}`}</div>
                      </div>
                      <button onClick={()=>unskipSession(sess.id)} style={{flexShrink:0,background:'transparent',border:`1px solid ${C.border}`,borderRadius:6,padding:'5px 11px',color:C.muted,fontSize:11,fontWeight:700,cursor:'pointer'}}>Undo</button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {upcomingSessions.length===0 && recentCompletedSessions.length===0 && missedSessions.length===0 && skippedSessions.length===0 && (
            <div style={{textAlign:'center',padding:'40px 20px',color:C.muted}}>
              <Icon name="calendar" size={26} color={C.faint}/>
              <p style={{fontSize:14,margin:'12px 0 6px'}}>No sessions yet.</p>
              <p style={{fontSize:12,color:C.faint,fontStyle:'italic'}}>Your coach hasn't programmed any training yet.</p>
            </div>
          )}
        </>)}

        {/* ────── PROGRESS ────── */}
        {tab==='progress' && (<>
          <div style={{marginBottom:18}}>
            <h2 style={{fontSize:22,fontWeight:600,color:C.white,marginBottom:6}}>My Progress</h2>
            <div style={{fontSize:13,color:C.muted}}>{pbs.length} exercise{pbs.length!==1?'s':''} tracked</div>
          </div>
          {topPBs.length>0 && (
            <div style={{marginBottom:20}}>
              <CLabel icon="trophy" color={C.gold}>Top Lifts</CLabel>
              <div style={{display:'flex',gap:8}}>
                {topPBs.map((p,i)=>(
                  <div key={i} style={{flex:1,background:C.card,border:`1px solid ${C.border}`,borderRadius:11,padding:'13px 12px',textAlign:'center',minWidth:0}}>
                    <div style={{fontSize:20,fontWeight:700,color:C.white,fontFamily:'Space Grotesk,sans-serif',lineHeight:1}}>{Math.round(p.e1rm)}<span style={{fontSize:11,color:C.faint,fontWeight:600}}>kg</span></div>
                    <div style={{fontSize:10.5,color:C.muted,marginTop:5,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.name}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <ProgressTab clientId={client.id} sessions={sessions} allSessions={allSessions} weeks={weeks} programs={programs} av={av} updateSession={updateSession} focusEx={progressEx} onFocusHandled={()=>setProgressEx(null)}/>
        </>)}

        {/* ────── PROFILE ────── */}
        {tab==='profile' && (<>
          <div style={{marginBottom:18}}><h2 style={{fontSize:22,fontWeight:600,color:C.white}}>My Profile</h2></div>
          <div style={{background:`linear-gradient(135deg, ${C.card} 0%, ${C.ink} 100%)`,border:`1px solid ${C.border}`,borderRadius:14,padding:'22px 20px',marginBottom:16}}>
            <div style={{display:'flex',gap:14,alignItems:'center',marginBottom:client.goal?16:0}}>
              <div style={{width:56,height:56,borderRadius:'50%',background:`linear-gradient(135deg,${C.c1},${C.c2})`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:21,fontWeight:700,color:C.white,flexShrink:0,fontFamily:'Space Grotesk,sans-serif'}}>{client.name.split(' ').map(n=>n[0]).slice(0,2).join('').toUpperCase()}</div>
              <div style={{minWidth:0}}>
                <div style={{fontSize:18,fontWeight:700,color:C.white}}>{client.name}</div>
                {client.email&&<div style={{fontSize:12,color:C.faint,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{client.email}</div>}
              </div>
            </div>
            {client.goal && <div style={{borderTop:`1px solid ${C.border}`,paddingTop:14}}><div style={{fontSize:10,fontWeight:700,color:C.amber,textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:5}}>My Goal</div><div style={{fontSize:13.5,color:C.white,fontStyle:'italic',lineHeight:1.45}}>"{client.goal}"</div></div>}
          </div>

          {/* Quick stats */}
          <div style={{display:'flex',gap:8,marginBottom:18}}>
            {[{v:totalDone,l:'Sessions',ic:'dumbbell'},{v:streak,l:'Streak',ic:'activity'},{v:pbs.length,l:'Tracked',ic:'trendingUp'}].map((x,i)=>(
              <div key={i} style={{flex:1,background:C.card,border:`1px solid ${C.border}`,borderRadius:11,padding:'14px 10px',textAlign:'center'}}>
                <Icon name={x.ic} size={15} color={C.amber}/>
                <div style={{fontSize:22,fontWeight:700,color:C.white,fontFamily:'Space Grotesk,sans-serif',margin:'5px 0 2px',lineHeight:1}}>{x.v}</div>
                <div style={{fontSize:10,color:C.faint,textTransform:'uppercase',letterSpacing:'0.06em'}}>{x.l}</div>
              </div>
            ))}
          </div>

          {goals.filter(g=>g.status==='active').length>0 && (
            <div>
              <CLabel icon="check" color={C.c3}>Active Goals</CLabel>
              {goals.filter(g=>g.status==='active').map(g=>(
                <div key={g.id} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:9,padding:'13px 15px',marginBottom:6}}>
                  <div style={{fontSize:13,fontWeight:600,color:C.white}}>{g.goal_title || g.title}</div>
                  {g.goal_description&&<div style={{fontSize:11,color:C.muted,marginTop:3,lineHeight:1.4}}>{g.goal_description}</div>}
                </div>
              ))}
            </div>
          )}
        </>)}

        {tab==='chats' && (()=>{
          const myChats = (chats||[]).filter(c=>(c.member_ids||[]).includes(client.id)).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at))
          const open = myChats.find(c=>c.id===chatOpenId) || null
          if(open){
            const tmsgs = (chatMessages||[]).filter(m=>m.chat_id===open.id).sort((a,b)=>new Date(a.created_at)-new Date(b.created_at))
            const sendC = () => { if(!chatDraft.trim())return; addChatMessage({chat_id:open.id,sender:'client',sender_id:client.id,sender_name:client.name,text:chatDraft.trim()}); setChatDraft('') }
            return (
              <div style={{display:'flex',flexDirection:'column',minHeight:'calc(100vh - 190px)'}}>
                <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14}}>
                  <button onClick={()=>{setChatOpenId(null);setChatDraft('')}} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,color:C.white,cursor:'pointer',padding:'7px 12px',fontSize:13}}>‹ Back</button>
                  <div style={{minWidth:0}}>
                    <div style={{fontSize:16,fontWeight:700,color:C.white,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{open.type==='group'?open.name:'Your Coach'}</div>
                    {open.type==='group'&&<div style={{fontSize:11,color:C.faint}}>{(open.member_ids||[]).length} members</div>}
                  </div>
                </div>
                <div style={{flex:1,overflowY:'auto',display:'flex',flexDirection:'column',gap:9,paddingBottom:10}}>
                  {tmsgs.length===0&&<p style={{color:C.faint,fontSize:13,textAlign:'center',margin:'auto'}}>No messages yet.</p>}
                  {tmsgs.map(m=>{
                    const mine = m.sender==='client' && (m.sender_id===client.id || !m.sender_id)
                    return (
                      <div key={m.id} style={{alignSelf:mine?'flex-end':'flex-start',maxWidth:'82%'}}>
                        {open.type==='group'&&!mine&&<div style={{fontSize:10,color:m.sender==='coach'?C.amber:C.c3,fontWeight:700,marginBottom:2,paddingLeft:4}}>{m.sender==='coach'?'Coach':m.sender_name}</div>}
                        <div style={{background:mine?C.c1:(m.sender==='coach'?`${C.amber}1A`:C.card),color:C.white,border:mine?'none':`1px solid ${m.sender==='coach'?`${C.amber}40`:C.border}`,borderRadius:12,padding:'9px 13px',fontSize:13,lineHeight:1.45}}>{m.text}</div>
                        <div style={{fontSize:9,color:C.faint,marginTop:3,textAlign:mine?'right':'left',padding:'0 4px'}}>{new Date(m.created_at).toLocaleDateString('en-AU',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</div>
                      </div>
                    )
                  })}
                </div>
                <div style={{display:'flex',gap:8,alignItems:'flex-end',paddingTop:10,borderTop:`1px solid ${C.border}`,position:'sticky',bottom:0,background:C.bg}}>
                  <textarea value={chatDraft} onChange={e=>setChatDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendC()}}} placeholder="Message your coach…" rows={1} style={{...iS,flex:1,resize:'none',minHeight:40,maxHeight:120}}/>
                  <Btn label="Send" onClick={sendC} disabled={!chatDraft.trim()}/>
                </div>
              </div>
            )
          }
          return (<>
            <div style={{marginBottom:18}}><h2 style={{fontSize:22,fontWeight:600,color:C.white}}>Messages</h2></div>
            {myChats.length===0 && <Card style={{textAlign:'center',padding:26}}><Icon name="message" size={26} color={C.faint}/><p style={{color:C.muted,fontSize:13,marginTop:10,lineHeight:1.5}}>No conversations yet.<br/>Your coach will start one with you.</p></Card>}
            {myChats.map(c=>{
              const cm = (chatMessages||[]).filter(m=>m.chat_id===c.id).sort((a,b)=>new Date(a.created_at)-new Date(b.created_at))
              const last = cm.slice(-1)[0]
              const un = typeof chatUnread==='function'?chatUnread(c.id):0
              return (
                <Card key={c.id} onClick={()=>{setChatOpenId(c.id);setChatDraft('');markChatRead&&markChatRead(c.id)}} style={{marginBottom:8,padding:'13px 15px'}}>
                  <div style={{display:'flex',alignItems:'center',gap:11}}>
                    <span style={{width:38,height:38,borderRadius:'50%',background:c.type==='group'?`${C.c1}30`:`${C.amber}22`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                      <Icon name={c.type==='group'?'users':'user'} size={17} color={c.type==='group'?C.c3:C.amber}/>
                    </span>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:14.5,fontWeight:600,color:C.white}}>{c.type==='group'?c.name:'Your Coach'}</div>
                      <div style={{fontSize:12,color:C.faint,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{last?`${last.sender==='client'?'You: ':''}${last.text}`:(c.type==='group'?`${(c.member_ids||[]).length} members`:'Direct message')}</div>
                    </div>
                    {un>0 && <span style={{minWidth:20,height:20,borderRadius:10,background:C.amber,color:C.bg,fontSize:11,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',padding:'0 6px',flexShrink:0}}>{un>9?'9+':un}</span>}
                  </div>
                </Card>
              )
            })}
          </>)
        })()}

      </div>
      <ClientBottomNav tab={tab} setTab={setTab} chatsUnread={chatsUnreadTotal}/>
    </div>
  )
}

// Preview banner — fixed at top
function PreviewBanner({ client, onExit, isRealClient=false }) {
  return (
    <div style={{background:`linear-gradient(180deg, ${C.amber}25 0%, ${C.amber}10 100%)`,borderBottom:`1px solid ${C.amber}40`,padding:'10px 16px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,position:'sticky',top:0,zIndex:50,backdropFilter:'blur(8px)'}}>
      <div style={{display:'flex',alignItems:'center',gap:8,minWidth:0}}>
        {isRealClient
          ? <span style={{fontSize:13,color:C.white,fontWeight:700,fontFamily:'Space Grotesk,sans-serif',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>Hi {(client.name||'').split(' ')[0]}</span>
          : <>
            <span style={{fontSize:9,fontWeight:700,color:C.amber,textTransform:'uppercase',letterSpacing:'0.1em',background:`${C.amber}20`,padding:'3px 7px',borderRadius:4,flexShrink:0}}>Preview</span>
            <span style={{fontSize:12,color:C.white,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>Viewing as <strong>{client.name}</strong></span>
          </>}
      </div>
      <button onClick={onExit} style={{background:C.amber,color:C.bg,border:'none',borderRadius:6,padding:'6px 12px',fontSize:11,fontWeight:700,cursor:'pointer',flexShrink:0}}>{isRealClient?'Sign Out':'Exit Preview'}</button>
    </div>
  )
}

// Bottom tab bar — iconified mobile navigation
function ClientBottomNav({ tab, setTab, chatsUnread=0 }) {
  const tabs = [
    {id:'home',     label:'Home',     icon:'dashboard'},
    {id:'sessions', label:'Sessions', icon:'dumbbell'},
    {id:'progress', label:'Progress', icon:'trendingUp'},
    {id:'chats',    label:'Chats',    icon:'message'},
    {id:'profile',  label:'Profile',  icon:'user'},
  ]
  return (
    <div style={{position:'fixed',bottom:0,left:0,right:0,background:`${C.ink}F2`,borderTop:`1px solid ${C.border}`,padding:'8px 0 max(8px, env(safe-area-inset-bottom))',display:'flex',justifyContent:'center',zIndex:40,backdropFilter:'blur(12px)'}}>
      <div style={{display:'flex',maxWidth:560,width:'100%',justifyContent:'space-around'}}>
        {tabs.map(t=>{
          const active = tab===t.id
          return (
            <button key={t.id} onClick={()=>setTab(t.id)} style={{flex:1,background:'none',border:'none',padding:'5px 4px',cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',gap:4,position:'relative'}}>
              {t.id==='chats'&&chatsUnread>0&&<span style={{position:'absolute',top:-2,right:'calc(50% - 22px)',minWidth:16,height:16,borderRadius:8,background:C.amber,color:C.bg,fontSize:9.5,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',padding:'0 4px'}}>{chatsUnread>9?'9+':chatsUnread}</span>}
              <Icon name={t.icon} size={21} color={active?C.amber:C.muted} strokeWidth={active?2.4:2}/>
              <span style={{fontSize:10.5,fontWeight:active?700:500,color:active?C.amber:C.muted,letterSpacing:'0.02em'}}>{t.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── CHATS — direct messages + group chats ───────────────────────────────────
function ChatsPage({ mode, chats, chatMessages, clients, addChat, addChatMessage, deleteChat, unreadFor, markChatRead }) {
  const isGroup = mode==='group'
  const list = (chats||[]).filter(c=>c.type===mode).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at))
  const [activeId, setActiveId] = useState(null)
  const [creating, setCreating] = useState(false)
  const [draft, setDraft]   = useState('')
  const [gName, setGName]   = useState('')
  const [gMembers, setGMembers] = useState([])
  const [gFromGroup, setGFromGroup] = useState('')
  const active = list.find(c=>c.id===activeId) || null
  const msgs = (chatMessages||[]).filter(m=>m.chat_id===activeId).sort((a,b)=>new Date(a.created_at)-new Date(b.created_at))
  const groupLabels = [...new Set((clients||[]).map(c=>c.group_label).filter(Boolean))]
  const nameOf = id => (clients.find(c=>c.id===id)||{}).name || '?'

  const startDM = async (cid) => {
    const existing = list.find(c=>(c.member_ids||[]).length===1 && c.member_ids[0]===cid)
    if(existing){ setActiveId(existing.id); setCreating(false); return }
    const r = await addChat({type:'dm', name:nameOf(cid), member_ids:[cid], group_label:''})
    if(r) setActiveId(r.id)
    setCreating(false)
  }
  const startGroup = async () => {
    let members = [...gMembers], name = gName.trim()
    if(gFromGroup){ members = clients.filter(c=>c.group_label===gFromGroup).map(c=>c.id); if(!name) name = gFromGroup }
    if(!name || !members.length) return
    const r = await addChat({type:'group', name, member_ids:members, group_label:gFromGroup||''})
    if(r) setActiveId(r.id)
    setCreating(false); setGName(''); setGMembers([]); setGFromGroup('')
  }
  const send = () => { if(!draft.trim()||!active) return; addChatMessage({chat_id:active.id, sender:'coach', sender_id:'coach', sender_name:'Coach', text:draft.trim()}); setDraft('') }
  const toggleMember = id => setGMembers(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id])

  return (
    <div style={{padding:'20px 24px',maxWidth:1100,margin:'0 auto'}}>
      <h1 style={{fontSize:22,fontWeight:700,color:C.white,fontFamily:'Space Grotesk,sans-serif',marginBottom:4}}>{isGroup?'Group Chats':'Direct Messages'}</h1>
      <p style={{fontSize:13,color:C.muted,marginBottom:18}}>{isGroup?'Create a chat for a whole squad or a custom set of athletes.':'One-to-one conversations with your athletes.'}</p>

      <div style={{display:'flex',gap:16,alignItems:'flex-start',flexWrap:'wrap'}}>
        {/* LEFT — conversation list */}
        <div style={{width:280,flexShrink:0,display:'flex',flexDirection:'column',gap:8}}>
          <Btn label={isGroup?'+ New Group Chat':'+ New Message'} onClick={()=>setCreating(c=>!c)}/>

          {creating && !isGroup && (
            <Card style={{padding:'10px 12px',maxHeight:280,overflowY:'auto'}}>
              <div style={{fontSize:10,fontWeight:700,color:C.amber,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:8}}>Pick an athlete</div>
              {clients.filter(c=>c.status==='active').map(c=>(
                <div key={c.id} onClick={()=>startDM(c.id)} style={{padding:'8px 6px',borderRadius:7,cursor:'pointer',fontSize:13,color:C.white,display:'flex',alignItems:'center',gap:8}}
                  onMouseEnter={e=>e.currentTarget.style.background=`${C.lift}60`} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  <span style={{width:24,height:24,borderRadius:'50%',background:`${C.c1}30`,color:C.c3,fontSize:11,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{(c.name||'?')[0].toUpperCase()}</span>
                  {c.name}
                </div>
              ))}
            </Card>
          )}

          {creating && isGroup && (
            <Card style={{padding:'12px 14px'}}>
              <label style={lS}>Group name</label>
              <input value={gName} onChange={e=>setGName(e.target.value)} placeholder="e.g. Firebirds Squad" style={{...iS,marginBottom:10}}/>
              {groupLabels.length>0 && (
                <div style={{marginBottom:10}}>
                  <label style={lS}>Create from an existing group</label>
                  <select value={gFromGroup} onChange={e=>setGFromGroup(e.target.value)} style={{...iS,cursor:'pointer'}}>
                    <option value="">— Pick members manually —</option>
                    {groupLabels.map(g=><option key={g} value={g}>{g} ({clients.filter(c=>c.group_label===g).length})</option>)}
                  </select>
                </div>
              )}
              {!gFromGroup && (
                <div style={{marginBottom:10,maxHeight:200,overflowY:'auto'}}>
                  <label style={lS}>Members</label>
                  {clients.filter(c=>c.status==='active').map(c=>(
                    <div key={c.id} onClick={()=>toggleMember(c.id)} style={{display:'flex',alignItems:'center',gap:8,padding:'5px 4px',cursor:'pointer'}}>
                      <div style={{width:15,height:15,borderRadius:4,border:`2px solid ${gMembers.includes(c.id)?C.amber:C.border}`,background:gMembers.includes(c.id)?C.amber:'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{gMembers.includes(c.id)&&<Icon name="check" size={10} color={C.bg}/>}</div>
                      <span style={{fontSize:13,color:C.white}}>{c.name}</span>
                    </div>
                  ))}
                </div>
              )}
              <div style={{display:'flex',gap:6}}>
                <Btn label="Create" small onClick={startGroup} disabled={!gName.trim() && !gFromGroup}/>
                <Btn label="Cancel" small variant="secondary" onClick={()=>{setCreating(false);setGName('');setGMembers([]);setGFromGroup('')}}/>
              </div>
            </Card>
          )}

          {list.length===0 && !creating && <Card style={{textAlign:'center',padding:20}}><p style={{color:C.muted,fontSize:13}}>No {isGroup?'group chats':'conversations'} yet.</p></Card>}
          {list.map(c=>{
            const cmsgs = (chatMessages||[]).filter(m=>m.chat_id===c.id)
            const last = cmsgs.sort((a,b)=>new Date(a.created_at)-new Date(b.created_at)).slice(-1)[0]
            const un = unreadFor?unreadFor(c.id):0
            return (
              <div key={c.id} onClick={()=>{setActiveId(c.id);markChatRead&&markChatRead(c.id)}} style={{background:activeId===c.id?C.lift:C.card,border:`1px solid ${activeId===c.id?`${C.amber}55`:C.border}`,borderRadius:10,padding:'11px 13px',cursor:'pointer'}}>
                <div style={{display:'flex',alignItems:'center',gap:9}}>
                  <span style={{width:30,height:30,borderRadius:'50%',background:isGroup?`${C.c1}30`:`${C.amber}25`,color:isGroup?C.c3:C.amber,fontSize:13,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                    {isGroup?<Icon name="users" size={15} color={C.c3}/>:(c.name||'?')[0].toUpperCase()}
                  </span>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13.5,fontWeight:600,color:C.white,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.name}</div>
                    <div style={{fontSize:11,color:C.faint,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{isGroup?`${(c.member_ids||[]).length} members`:'Direct message'}{last?` · ${last.text}`:''}</div>
                  </div>
                  {un>0 && <span style={{minWidth:20,height:20,borderRadius:10,background:C.amber,color:C.bg,fontSize:11,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',padding:'0 6px',flexShrink:0}}>{un>9?'9+':un}</span>}
                </div>
              </div>
            )
          })}
        </div>

        {/* RIGHT — thread */}
        <div style={{flex:1,minWidth:300,background:C.card,border:`1px solid ${C.border}`,borderRadius:14,display:'flex',flexDirection:'column',height:560}}>
          {active ? (<>
            <div style={{padding:'13px 16px',borderBottom:`1px solid ${C.border}`,display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}>
              <div style={{minWidth:0}}>
                <div style={{fontSize:15,fontWeight:700,color:C.white}}>{active.name}</div>
                {isGroup&&<div style={{fontSize:11,color:C.faint,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{(active.member_ids||[]).map(nameOf).join(', ')}</div>}
              </div>
              <button onClick={()=>{if(window.confirm('Delete this chat?')){deleteChat(active.id);setActiveId(null)}}} title="Delete chat" style={{background:'none',border:`1px solid ${C.border}`,borderRadius:6,color:C.faint,fontSize:11,cursor:'pointer',padding:'4px 9px',flexShrink:0}}>Delete</button>
            </div>
            <div style={{flex:1,overflowY:'auto',padding:'16px',display:'flex',flexDirection:'column',gap:10}}>
              {msgs.length===0 && <p style={{color:C.faint,fontSize:13,textAlign:'center',margin:'auto'}}>No messages yet — say hello.</p>}
              {msgs.map(m=>{
                const mine = m.sender==='coach'
                return (
                  <div key={m.id} style={{alignSelf:mine?'flex-end':'flex-start',maxWidth:'78%'}}>
                    {isGroup&&!mine&&<div style={{fontSize:10,color:C.c3,fontWeight:700,marginBottom:2,paddingLeft:4}}>{m.sender_name}</div>}
                    <div style={{background:mine?C.amber:C.ink,color:mine?C.bg:C.white,borderRadius:12,padding:'9px 13px',fontSize:13,lineHeight:1.45,border:mine?'none':`1px solid ${C.border}`}}>{m.text}</div>
                    <div style={{fontSize:9,color:C.faint,marginTop:3,textAlign:mine?'right':'left',padding:'0 4px'}}>{new Date(m.created_at).toLocaleDateString('en-AU',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</div>
                  </div>
                )
              })}
            </div>
            <div style={{padding:'12px 14px',borderTop:`1px solid ${C.border}`,display:'flex',gap:8,alignItems:'flex-end'}}>
              <textarea value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}}} placeholder="Type a message…" rows={1} style={{...iS,flex:1,resize:'none',minHeight:38,maxHeight:120}}/>
              <Btn label="Send" onClick={send} disabled={!draft.trim()}/>
            </div>
          </>) : (
            <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',color:C.faint,gap:10}}>
              <Icon name="message" size={28} color={C.faint}/>
              <p style={{fontSize:13}}>Select a conversation{list.length===0?` or start a new one`:''}.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


// ═══════════════════════════════════════════════════════════════════════════════
// MAIN APP (authenticated)
// ═══════════════════════════════════════════════════════════════════════════════
function MainApp({ session, onSignOut }) {
  const token = session.access_token
  const [clients,      setClients]      = useState([])
  const [programs,     setPrograms]     = useState([])
  const [weeks,        setWeeks]        = useState([])
  const [sessions,     setSessions]     = useState([])
  const [measurements, setMeasurements] = useState([])
  const [goals,        setGoals]        = useState([])
  const [flags,        setFlags]        = useState([])
  const [announcements,setAnnouncements]= useState([])
  const [messages,     setMessages]     = useState([])
  const [chats,        setChats]        = useState([])
  const [chatMessages, setChatMessages] = useState([])
  const [chatReads,    setChatReads]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')
  const [nav, setNav] = useState({view:'dashboard',clientId:null,programId:null,sessionId:null})
  // analyticsVersion increments whenever registry, e1rm formula, or any derived-data dependency changes.
  // Pass as prop to any component that uses resolved exercise names or formula-dependent calculations.
  const [analyticsVersion, setAnalyticsVersion] = useState(0)
  const bumpAnalytics = React.useCallback(() => setAnalyticsVersion(v=>v+1), [])
  useEffect(()=>{
    window.addEventListener('cgee-reg-changed', bumpAnalytics)
    return () => window.removeEventListener('cgee-reg-changed', bumpAnalytics)
  }, [bumpAnalytics])

  // Client preview mode — coach can view the app as a specific client would see it
  const [previewClientId, setPreviewClientId] = useState(null)
  const previewAsClient = (id) => setPreviewClientId(id)
  const go = (view, extra={}) => setNav({view,clientId:null,programId:null,sessionId:null,...extra})
  useEffect(()=>{ const h=e=>go(e.detail); window.addEventListener('cgee-nav',h); return ()=>window.removeEventListener('cgee-nav',h) },[])

  useEffect(()=>{
    ;(async()=>{
      setLoading(true)
      try{
        CGEE_TOKEN = token
        await hydrateExReg(token)
        const [c,p,w,s,m,g,fl,ann,msgs,chts,chmsgs,chrd] = await Promise.all([
          sb.get('clients','select=*',token), sb.get('programs','select=*',token),
          sb.get('program_weeks','select=*',token), sb.get('sessions','select=*',token),
          sb.get('body_measurements','select=*',token), sb.get('client_goals','select=*',token),
          sb.get('client_flags','select=*',token),
          sb.get('announcements','select=*&order=is_pinned.desc,created_at.desc',token).catch(()=>[]),
          sb.get('session_messages','select=*',token).catch(()=>[]),
          sb.get('chats','select=*',token).catch(()=>[]),
          sb.get('chat_messages','select=*',token).catch(()=>[]),
          sb.get('chat_reads','select=*',token).catch(()=>[]),
        ])
        if(!Array.isArray(c)) throw new Error(JSON.stringify(c))
        setClients(c); setPrograms(p); setWeeks(w); setMeasurements(m||[]); setGoals(g||[]); setFlags(fl||[]); setAnnouncements(Array.isArray(ann)?ann:[]); setMessages(Array.isArray(msgs)?msgs:[]); setChats(Array.isArray(chts)?chts:[]); setChatMessages(Array.isArray(chmsgs)?chmsgs:[]); setChatReads(Array.isArray(chrd)?chrd:[])
        // Parse exercises JSON and auto-convert any lbs values
        const loadedSessions = (s||[]).map(sess=>({
          ...sess,
          exercises: Array.isArray(sess.exercises) ? sess.exercises
            : typeof sess.exercises==='string'
              ? (()=>{try{return JSON.parse(sess.exercises||'[]')}catch{return[]}})()
              : []
        }))
        // Normalize lbs → kg in memory immediately
        const cleanedSessions = loadedSessions.map(sess=>{
          const {exercises, changed} = normalizeExercisesLbs(sess.exercises)
          if(changed) sess._needsLbsSave = true
          // Apply persistent canonical naming (merges/renames) so they reflect everywhere
          const canon = exercises.map(ex => (ex && ex.name) ? {...ex, name: resolveExName(ex.name)} : ex)
          return {...sess, exercises:canon}
        })
        setSessions(cleanedSessions)
        // Persist any changed sessions back to Supabase (authenticated)
        cleanedSessions.filter(s=>s._needsLbsSave).forEach(sess=>{
          sb.patch('sessions', sess.id, {exercises:JSON.stringify(sess.exercises)}, token)
            .catch(()=>{}) // best-effort — in-memory data is already correct
        })
      } catch(e){ setError('Failed to load: '+e.message) }
      setLoading(false)
    })()
  },[])

  useEffect(()=>{
    programs.forEach(prog=>{
      const ps=sessions.filter(s=>s.program_id===prog.id)
      const allDone=ps.length>0&&ps.every(s=>computeSessionStatus(s)==='complete')
      const anyNotDone=ps.some(s=>computeSessionStatus(s)!=='complete')
      if(allDone&&prog.status!=='complete'){
        setPrograms(p=>p.map(pr=>pr.id===prog.id?{...pr,status:'complete',auto_completed:true}:pr))
        sb.patch('programs',prog.id,{status:'complete',auto_completed:true},token).catch(()=>{})
      } else if(anyNotDone&&prog.status==='complete'&&prog.auto_completed){
        setPrograms(p=>p.map(pr=>pr.id===prog.id?{...pr,status:'current',auto_completed:false}:pr))
        sb.patch('programs',prog.id,{status:'current',auto_completed:false},token).catch(()=>{})
      }
    })
  },[sessions.map(s=>s.id+s.status).join()])

  const wrap = async (fn) => { setSaving(true); try{ return await fn() }catch(e){ setError(e.message) }finally{ setSaving(false) } }
  const addMessage     = (d)        => wrap(async()=>{ const r=await sb.post('session_messages',{...d,created_at:new Date().toISOString()},token); setMessages(p=>[...p,r]); return r })
  const replyMessage   = (id,reply) => { setMessages(p=>p.map(m=>m.id===id?{...m,reply}:m)); sb.patch('session_messages',id,{reply},token).catch(e=>setError(e.message)) }
  const markMsgRead    = (id)       => { const at=new Date().toISOString(); setMessages(p=>p.map(m=>m.id===id?{...m,read_at:at}:m)); sb.patch('session_messages',id,{read_at:at},token).catch(e=>setError(e.message)) }
  const markMsgActioned= (id)       => { const at=new Date().toISOString(); setMessages(p=>p.map(m=>m.id===id?{...m,actioned_at:at}:m)); sb.patch('session_messages',id,{actioned_at:at},token).catch(e=>setError(e.message)) }
  const editMessage    = (id,message)=> { setMessages(p=>p.map(m=>m.id===id?{...m,message,read_at:null}:m)); sb.patch('session_messages',id,{message,read_at:null},token).catch(e=>setError(e.message)) }
  const addChat        = (d) => wrap(async()=>{ const r=await sb.post('chats',{...d,created_at:new Date().toISOString()},token); setChats(p=>[...p,r]); return r })
  const addChatMessage = (d) => wrap(async()=>{ const r=await sb.post('chat_messages',{...d,created_at:new Date().toISOString()},token); setChatMessages(p=>[...p,r]); return r })
  const deleteChat     = (id)=> { setChats(p=>p.filter(c=>c.id!==id)); setChatMessages(p=>p.filter(m=>m.chat_id!==id)); sb.del('chats',id,token).catch(e=>setError(e.message)) }
  const lastReadOf = (chatId,viewerId)=>{ const r=chatReads.find(x=>x.chat_id===chatId&&x.viewer_id===viewerId); return r?new Date(r.last_read_at).getTime():0 }
  const chatUnread = (chatId,viewerId)=>(chatMessages||[]).filter(m=>m.chat_id===chatId && !(viewerId==='coach'?m.sender==='coach':m.sender_id===viewerId) && new Date(m.created_at).getTime()>lastReadOf(chatId,viewerId)).length
  const markChatRead = (chatId,viewerId)=>{ const at=new Date().toISOString(); const tmp='tmp-'+chatId+'-'+viewerId; const ex=chatReads.find(x=>x.chat_id===chatId&&x.viewer_id===viewerId); if(ex){ setChatReads(p=>p.map(r=>r.id===ex.id?{...r,last_read_at:at}:r)); if(!String(ex.id).startsWith('tmp-')) sb.patch('chat_reads',ex.id,{last_read_at:at},token).catch(e=>setError(e.message)) } else { setChatReads(p=>[...p,{id:tmp,chat_id:chatId,viewer_id:viewerId,last_read_at:at}]); sb.post('chat_reads',{chat_id:chatId,viewer_id:viewerId,last_read_at:at,created_at:at},token).then(r=>{ if(r) setChatReads(p=>p.map(x=>x.id===tmp?r:x)) }).catch(e=>setError(e.message)) } }

  const addClient    = (d) => wrap(async()=>{ const r=await sb.post('clients',d,token); setClients(p=>[...p,r]); return r })
  const updateClient = (id,d) => { setClients(p=>p.map(c=>c.id===id?{...c,...d}:c)); sb.patch('clients',id,d,token).catch(e=>setError(e.message)) }
  const deleteClient = (id) => { if(!window.confirm('Delete this client and all their data?')) return; setClients(p=>p.filter(c=>c.id!==id)); sb.del('clients',id,token).catch(e=>setError(e.message)) }

  const addProgram    = (d) => wrap(async()=>{ const r=await sb.post('programs',d,token); setPrograms(p=>[...p,r]); return r })
  const updateProgram = (id,d) => { setPrograms(p=>p.map(pr=>pr.id===id?{...pr,...d}:pr)); sb.patch('programs',id,d,token).catch(e=>setError(e.message)) }
  const deleteProgram = (id) => {
    if(!window.confirm('Delete this program and all its data?')) return
    setPrograms(p=>p.filter(pr=>pr.id!==id)); setWeeks(p=>p.filter(w=>w.program_id!==id)); setSessions(p=>p.filter(s=>s.program_id!==id))
    sb.del('programs',id,token).catch(e=>setError(e.message))
  }

  const addWeek    = (d) => wrap(async()=>{ const r=await sb.post('program_weeks',d,token); setWeeks(p=>[...p,r]); return r })
  const deleteWeek = (id) => {
    if(!window.confirm('Delete this week and all its sessions?')) return
    setWeeks(p=>p.filter(w=>w.id!==id)); setSessions(p=>p.filter(s=>s.week_id!==id))
    sb.del('program_weeks',id,token).catch(e=>setError(e.message))
  }

  const addSession = (d) => wrap(async()=>{
    const r=await sb.post('sessions',{...d,exercises:JSON.stringify(d.exercises||[])},token)
    setSessions(p=>[...p,{...r,exercises:d.exercises||[]}]); return r
  })
  const updateSession = (id,d) => {
    const payload={...d}; if(payload.exercises) payload.exercises=JSON.stringify(payload.exercises)
    setSessions(p=>p.map(s=>s.id===id?{...s,...d}:s))
    return sb.patch('sessions',id,payload,token).catch(e=>setError(e.message))
  }
  const deleteSession = (id) => {
    if(!window.confirm('Delete this session?')) return
    setSessions(p=>p.filter(s=>s.id!==id)); sb.del('sessions',id,token).catch(e=>setError(e.message))
  }

  // mergeSession: direct PATCH with proper error detection — used by ExerciseCleanup doMerge
  // (updateSession swallows errors silently; this one returns {ok,error} so callers know what happened)
  const mergeSession = async (id, exercises) => {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/sessions?id=eq.${id}`, {
        method:'PATCH',
        headers:hdrs(token),
        body:JSON.stringify(stripNaN({exercises:JSON.stringify(exercises)}))
      })
      if(!r.ok){
        const msg = await r.text().catch(()=>`HTTP ${r.status}`)
        console.error('[mergeSession] PATCH failed', id, r.status, msg)
        return {ok:false, error:msg}
      }
      setSessions(p=>p.map(s=>s.id===id?{...s,exercises}:s))
      return {ok:true}
    } catch(e){
      console.error('[mergeSession] network error', id, e.message)
      return {ok:false, error:e.message}
    }
  }

  const addMeasurement    = (d) => wrap(async()=>{ const r=await sb.post('body_measurements',d,token); setMeasurements(p=>[...p,r]); return r })
  const deleteMeasurement = (id) => { setMeasurements(p=>p.filter(m=>m.id!==id)); sb.del('body_measurements',id,token).catch(e=>setError(e.message)) }

  const addGoal    = (d) => wrap(async()=>{ const r=await sb.post('client_goals',d,token); setGoals(p=>[...p,r]); return r })
  const updateGoal = (id,d) => { setGoals(p=>p.map(g=>g.id===id?{...g,...d}:g)); sb.patch('client_goals',id,d,token).catch(e=>setError(e.message)) }
  const deleteGoal = (id) => { if(!window.confirm('Delete goal?'))return; setGoals(p=>p.filter(g=>g.id!==id)); sb.del('client_goals',id,token).catch(e=>setError(e.message)) }

  const addFlag    = (d) => wrap(async()=>{ const r=await sb.post('client_flags',d,token); setFlags(p=>[...p,r]); return r })
  const updateFlag = (id,d) => { setFlags(p=>p.map(f=>f.id===id?{...f,...d}:f)); sb.patch('client_flags',id,d,token).catch(e=>setError(e.message)) }
  const deleteFlag = (id) => { setFlags(p=>p.filter(f=>f.id!==id)); sb.del('client_flags',id,token).catch(e=>setError(e.message)) }

  const importData = async (result, programName, clientId) => {
    setSaving(true)
    try{
      let cId = clientId
      if(!cId && result.clients?.length>0){
        const existing=clients.find(c=>c.name===result.clients[0].name)
        if(existing){ cId=existing.id }
        else{ const nc=await sb.post('clients',{name:result.clients[0].name,status:'active'},token); setClients(p=>[...p,nc]); cId=nc.id }
      }
      if(!cId) throw new Error('No client')
      const prog=await sb.post('programs',{client_id:cId,name:programName,status:'complete',goal:'',notes:''},token)
      setPrograms(p=>[...p,prog])
      const weekMap={}
      for(const w of result.weeks){
        const nw=await sb.post('program_weeks',{program_id:prog.id,week_number:parseInt(w.week_number)||1,phase:w.phase||'',notes:'',sort_order:parseInt(w.week_number)||1},token)
        setWeeks(p=>[...p,nw]); weekMap[w.id]=nw.id
      }
      for(const s of result.sessions){
        const ns=await sb.post('sessions',{week_id:weekMap[s.week_id]||s.week_id,program_id:prog.id,client_id:cId,name:s.name,session_type:s.session_type,status:s.status,exercises:JSON.stringify(s.exercises||[]),sort_order:0,completed_at:s.status==='complete'?new Date().toISOString():null},token)
        setSessions(p=>[...p,{...ns,exercises:s.exercises||[]}])
      }
    }catch(e){ setError('Import failed: '+e.message) }
    finally{ setSaving(false) }
  }

  if(loading) return (
    <div style={{background:C.bg,minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:12}}>
      <Spin/><span style={{fontSize:12,color:C.muted}}>Loading your data…</span>
    </div>
  )

  const props = { clients,programs,weeks,sessions,measurements,goals,flags,announcements,saving,go,nav,token,addClient,updateClient,deleteClient,addProgram,updateProgram,deleteProgram,addWeek,deleteWeek,addSession,updateSession,deleteSession,importData,addMeasurement,deleteMeasurement,addGoal,updateGoal,deleteGoal,addFlag,updateFlag,deleteFlag,previewAsClient,messages,addMessage,replyMessage,markMsgRead,markMsgActioned }

  // ─── CLIENT PREVIEW MODE ────────────────────────────────────────────────────
  if(previewClientId) {
    const previewClient = clients.find(c => c.id === previewClientId)
    if(previewClient) {
      return <ClientPreviewApp
        client={previewClient}
        sessions={sessions.filter(s=>s.client_id===previewClientId)}
        allSessions={sessions}
        programs={programs.filter(p=>p.client_id===previewClientId)}
        weeks={weeks}
        goals={goals.filter(g=>g.client_id===previewClientId)}
        measurements={measurements.filter(m=>m.client_id===previewClientId)}
        messages={messages.filter(m=>m.client_id===previewClientId)}
        addMessage={addMessage} replyMessage={replyMessage} markMsgRead={markMsgRead} markMsgActioned={markMsgActioned} editMessage={editMessage}
        chats={chats.filter(c=>(c.member_ids||[]).includes(previewClientId))}
        chatMessages={chatMessages} addChatMessage={addChatMessage}
        chatUnread={(id)=>chatUnread(id,previewClientId)} markChatRead={(id)=>markChatRead(id,previewClientId)}
        updateSession={updateSession}
        onExit={()=>setPreviewClientId(null)}
        av={analyticsVersion}
      />
    }
  }

  const loggedInClient = clients.find(c => c.auth_user_id && session.user && session.user.id && c.auth_user_id === session.user.id)
  if(loggedInClient) {
    const signOutClient = async()=>{ try{await sb.signOut(token)}catch(e){} localStorage.removeItem('cgee_session'); onSignOut() }
    return <ClientPreviewApp
      client={loggedInClient}
      sessions={sessions.filter(s=>s.client_id===loggedInClient.id)}
      allSessions={sessions}
      programs={programs.filter(p=>p.client_id===loggedInClient.id)}
      weeks={weeks}
      goals={goals.filter(g=>g.client_id===loggedInClient.id)}
      measurements={measurements.filter(m=>m.client_id===loggedInClient.id)}
      messages={messages.filter(m=>m.client_id===loggedInClient.id)}
      addMessage={addMessage} replyMessage={replyMessage} markMsgRead={markMsgRead} markMsgActioned={markMsgActioned} editMessage={editMessage}
      chats={chats.filter(c=>(c.member_ids||[]).includes(loggedInClient.id))}
      chatMessages={chatMessages} addChatMessage={addChatMessage}
      chatUnread={(id)=>chatUnread(id,loggedInClient.id)} markChatRead={(id)=>markChatRead(id,loggedInClient.id)}
      updateSession={updateSession}
      onExit={signOutClient}
      isRealClient={true}
      av={analyticsVersion}
    />
  }

  return (
    <div style={{background:C.bg,height:'100vh',overflow:'hidden',color:C.white,fontSize:14,display:'flex',flexDirection:'column'}}>
      {error&&(<div style={{position:'fixed',bottom:20,left:'50%',transform:'translateX(-50%)',background:C.red,color:C.white,padding:'10px 20px',borderRadius:8,fontSize:13,fontWeight:600,zIndex:1000,display:'flex',alignItems:'center',gap:10,maxWidth:500}}><span style={{flex:1}}>{error}</span><button onClick={()=>setError('')} style={{background:'none',border:'none',color:C.white,cursor:'pointer',fontSize:18,padding:0,lineHeight:1}}>×</button></div>)}
      {saving&&<div style={{position:'fixed',top:0,left:0,right:0,height:2,background:C.amber,zIndex:1001}}/>}
      <div style={{background:C.ink,borderBottom:`1px solid ${C.border}`,height:42,display:'flex',alignItems:'center',padding:'0 16px',gap:8,flexShrink:0,zIndex:10}}>
        <div style={{flex:1,fontSize:12,color:C.muted,display:'flex',alignItems:'center',gap:4,flexWrap:'wrap'}}>
          <button onClick={()=>go('overview')} style={{background:'none',border:'none',color:C.amber,cursor:'pointer',fontSize:12,padding:0,fontWeight:600,fontFamily:'Space Grotesk,sans-serif'}}><span style={{color:C.amber}}>C</span><span style={{color:C.white}}>dG</span></button>
          {nav.clientId&&clients.find(c=>c.id===nav.clientId)&&(<>
            <span style={{color:C.faint}}>›</span>
            <button onClick={()=>go('clients')} style={{background:'none',border:'none',color:C.muted,cursor:'pointer',fontSize:12,padding:0}}>Athletes</button>
            <span style={{color:C.faint}}>›</span>
            <button onClick={()=>go('client',{clientId:nav.clientId})} style={{background:'none',border:'none',color:nav.view==='client'?C.white:C.muted,cursor:'pointer',fontSize:12,padding:0}}>{clients.find(c=>c.id===nav.clientId)?.name}</button>
            {nav.programId&&programs.find(p=>p.id===nav.programId)&&(<><span style={{color:C.faint}}>›</span><button onClick={()=>go('program',{programId:nav.programId,clientId:nav.clientId})} style={{background:'none',border:'none',color:nav.view==='program'?C.white:C.muted,cursor:'pointer',fontSize:12,padding:0}}>{programs.find(p=>p.id===nav.programId)?.name}</button></>)}
            {nav.sessionId&&sessions.find(s=>s.id===nav.sessionId)&&(<><span style={{color:C.faint}}>›</span><span style={{color:C.white,fontSize:12}}>{sessions.find(s=>s.id===nav.sessionId)?.name}</span></>)}
          </>)}
        </div>
        <span style={{fontSize:10,color:C.green,opacity:0.5}}>● Supabase</span>
        <button onClick={async()=>{await sb.signOut(token);localStorage.removeItem('cgee_session');onSignOut()}} style={{background:'transparent',border:`1px solid rgba(255,255,255,0.2)`,borderRadius:6,padding:'4px 10px',color:C.white,cursor:'pointer',fontSize:11,fontWeight:500}}>Sign Out</button>
      </div>
      <div style={{display:'flex',flex:1,overflow:'hidden'}}>
        <SidebarNav nav={nav} go={go} clients={clients} badges={{direct_messages:chats.filter(c=>c.type==='dm').reduce((n,c)=>n+chatUnread(c.id,'coach'),0), group_chats:chats.filter(c=>c.type==='group').reduce((n,c)=>n+chatUnread(c.id,'coach'),0)}} onSignOut={async()=>{await sb.signOut(token);localStorage.removeItem('cgee_session');onSignOut()}}/>
        <div style={{flex:1,overflowY:'auto',background:C.bg}}>
          <ErrorBoundary key={`${nav.view}-${nav.programId}-${nav.sessionId}`}>
            {(nav.view==='overview'||nav.view==='dashboard') && <Dashboard {...props} weeks={weeks} sessions={sessions} programs={programs} clients={clients} go={go}/>}
            {nav.view==='clients'    && <ClientsView {...props}/>}
            {nav.view==='client'     && <ClientDashboard {...props} clientId={nav.clientId}/>}
            {nav.view==='editclient' && <ClientsView {...props}/>}
            {nav.view==='program'    && <ProgramDetail {...props} programId={nav.programId} clientId={nav.clientId}/>}
            {nav.view==='session'    && <SessionDetail {...props} sessionId={nav.sessionId} programId={nav.programId} clientId={nav.clientId}/>}
            {nav.view==='library'    && <LibraryView sessions={sessions} av={analyticsVersion}/>}
            {nav.view==='cleanup'    && <ExerciseCleanup sessions={sessions} updateSession={props.updateSession} mergeSession={mergeSession} saving={saving}/>}
            {nav.view==='import'     && <ImportView {...props}/>}
            {nav.view==='calendar'   && <CalendarView sessions={sessions} weeks={weeks} programs={programs} clients={clients} go={go} token={token}/>}
            {['templates','templates_program','templates_session','templates_scheme','templates_labels','name_convention'].includes(nav.view) && <TemplatesView sessions={sessions} programs={programs} weeks={weeks} clients={clients} addProgram={props.addProgram} addWeek={props.addWeek} addSession={props.addSession} go={go} initialTab={nav.view==='templates_session'?'session':nav.view==='templates_scheme'?'rep_scheme':nav.view==='templates_labels'?'label':'program'}/>}
            {nav.view==='compliance'          && <CompliancePage {...props}/>}
            {nav.view==='alerts'               && <AlertsPage {...props}/>}
            {nav.view==='programs_list'        && <ProgramsListPage {...props}/>}
            {nav.view==='sessions_list'        && <SessionsListPage {...props}/>}
            {nav.view==='lb_strength'          && <StrengthLeaderboard {...props}/>}
            {nav.view==='lb_attendance'        && <AttendanceLeaderboard {...props}/>}
            {nav.view==='lb_wellness'          && <WellnessLeaderboard/>}
            {nav.view==='lb_sprint'            && <SprintLeaderboard {...props}/>}
            {nav.view==='injuries'             && <InjuriesPage {...props}/>}
            {nav.view==='monitoring'           && <MonitoringPage {...props}/>}
            {nav.view==='athlete_reports'      && <AthleteReportsPage {...props}/>}
            {nav.view==='compliance_reports'   && <ComplianceReportsPage {...props}/>}
            {nav.view==='export_centre'        && <ExportCentre {...props}/>}
            {nav.view==='testing_reports'      && <TestingReportsPage clients={clients} token={token} go={go}/>}
            {nav.view==='groups'               && <GroupsPage {...props}/>}
            {nav.view==='events'               && <EventsPage token={token}/>}
            {nav.view==='announcements'        && <AnnouncementsPage token={token}/>}
            {nav.view==='team_updates'         && <TeamUpdatesPage token={token}/>}
            {nav.view==='integrations'         && <IntegrationsPage/>}
            {nav.view==='wearables'            && <IntegrationsPage/>}
            {nav.view==='connected_apps'       && <IntegrationsPage/>}
            {nav.view==='settings'             && <SettingsPage token={token}/>}
            {nav.view==='name_convention'      && <NamingConventionTool sessions={sessions} updateSession={props.updateSession}/>}
            {nav.view==='db_tools'             && <ExerciseCleanup sessions={sessions} updateSession={props.updateSession} saving={saving}/>}
            {nav.view==='lbs_convert'          && <LbsConverterTool sessions={sessions} updateSession={updateSession}/>}
            {nav.view==='coaches'              && <CoachesAdminPage/>}
            {nav.view==='permissions'          && <CoachesAdminPage/>}
            {nav.view==='direct_messages'      && <ChatsPage mode="dm" chats={chats} chatMessages={chatMessages} clients={clients} addChat={addChat} addChatMessage={addChatMessage} deleteChat={deleteChat} unreadFor={(id)=>chatUnread(id,'coach')} markChatRead={(id)=>markChatRead(id,'coach')}/>}
            {nav.view==='group_chats'          && <ChatsPage mode="group" chats={chats} chatMessages={chatMessages} clients={clients} addChat={addChat} addChatMessage={addChatMessage} deleteChat={deleteChat} unreadFor={(id)=>chatUnread(id,'coach')} markChatRead={(id)=>markChatRead(id,'coach')}/>}
            {!['overview','dashboard','clients','client','editclient','program','session','library','cleanup','import','calendar','templates','compliance','alerts','programs_list','sessions_list','lb_strength','lb_attendance','lb_wellness','lb_sprint','injuries','monitoring','athlete_reports','compliance_reports','export_centre','testing_reports','groups','events','announcements','team_updates','integrations','wearables','connected_apps','settings','db_tools','lbs_convert','coaches','permissions','direct_messages','group_chats','templates_program','templates_session','templates_scheme','templates_labels'].includes(nav.view)&&(<ComingSoon view={nav.view} go={go}/>)}
          </ErrorBoundary>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROOT
// ═══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const isConfigured = SUPABASE_URL !== 'YOUR_PROJECT_URL' && SUPABASE_ANON_KEY !== 'YOUR_ANON_KEY'
  const [session, setSession] = useState(()=>{
    try{ const s=localStorage.getItem('cgee_session'); return s?JSON.parse(s):null }
    catch{ return null }
  })
  if(!isConfigured) return <NotConfigured/>
  if(!session)      return <LoginScreen onLogin={setSession}/>
  return <MainApp session={session} onSignOut={()=>setSession(null)}/>
}

// ═══════════════════════════════════════════════════════════════════════════════
// NEW ACTIVE PAGES — built from existing data
// ═══════════════════════════════════════════════════════════════════════════════

// ─── COMPLIANCE ───────────────────────────────────────────────────────────────
function CompliancePage({ clients, programs, sessions, weeks, go }) {
  const [filter, setFilter] = useState('all')
  const [groupFilter, setGroupFilter] = useState('')
  const rows = clients.filter(c=>c.status==='active' && (!groupFilter||c.group_label===groupFilter)).map(c=>{
    const cs = sessions.filter(s=>s.client_id===c.id)
    const done = cs.filter(s=>computeSessionStatus(s)==='complete').length
    const total = cs.filter(s=>computeSessionStatus(s)!=='skipped').length
    const pct = total>0?Math.round(done/total*100):0
    const missed = cs.filter(s=>{
      const d=getSessionDate(s,sessions,weeks,programs)
      return d&&d<new Date()&&computeSessionStatus(s)!=='complete'&&computeSessionStatus(s)!=='skipped'
    }).length
    const curProg = programs.find(p=>p.client_id===c.id&&p.status==='current')
    return {c,done,total,pct,missed,curProg}
  })
  const filtered = rows.filter(r=>filter==='all'||(filter==='risk'&&r.pct<70)||(filter==='ok'&&r.pct>=70)).sort((a,b)=>a.pct-b.pct)
  const avg = rows.length>0?Math.round(rows.reduce((a,r)=>a+r.pct,0)/rows.length):0
  const atRisk = rows.filter(r=>r.pct<70).length
  const pColor = p => p>=85?C.green:p>=70?C.amber:p>=50?C.orange:C.red
  return(
    <div style={{padding:20,maxWidth:1000,margin:'0 auto'}}>
      <h1 style={{fontSize:22,fontWeight:700,color:C.white,fontFamily:'Space Grotesk,sans-serif',marginBottom:4}}>COMPLIANCE</h1>
      <p style={{fontSize:13,color:C.muted,marginBottom:20}}>Session adherence across all active athletes</p>
      <GroupFilter clients={clients} value={groupFilter} onChange={setGroupFilter}/>
      <G3 style={{marginBottom:20}}>
        {[{v:rows.length,l:'Active Athletes',c:C.white},{v:`${avg}%`,l:'Avg Adherence',c:pColor(avg)},{v:atRisk,l:'At Risk (<70%)',c:atRisk>0?C.orange:C.green}].map(({v,l,c})=>(
          <Card key={l} style={{textAlign:'center',padding:'18px 20px'}}>
            <div style={{fontSize:28,fontWeight:700,color:c,fontFamily:'Space Grotesk,sans-serif'}}>{v}</div>
            <div style={{fontSize:11,color:C.muted,textTransform:'uppercase',letterSpacing:'0.06em',marginTop:4}}>{l}</div>
          </Card>
        ))}
      </G3>
      <Row style={{gap:8,marginBottom:16}}>
        {[{k:'all',l:'All'},{k:'ok',l:'On Track (≥70%)'},{k:'risk',l:'At Risk (<70%)'}].map(({k,l})=>(
          <button key={k} onClick={()=>setFilter(k)} style={{padding:'5px 14px',borderRadius:20,border:`1.5px solid ${filter===k?C.amber:C.border}`,background:filter===k?`${C.amber}18`:'transparent',color:filter===k?C.amber:C.muted,fontSize:11,fontWeight:700,cursor:'pointer'}}>{l}</button>
        ))}
      </Row>
      <div style={{overflowX:'auto'}}>
        <table style={{width:'100%',borderCollapse:'collapse'}}>
          <thead><tr style={{borderBottom:`1px solid ${C.border}`}}>
            {['Athlete','Current Program','Done','Missed','Adherence',''].map(h=>(<th key={h} style={{textAlign:'left',padding:'8px 12px',fontSize:10,color:C.amber,textTransform:'uppercase',letterSpacing:'0.06em',fontWeight:700}}>{h}</th>))}
          </tr></thead>
          <tbody>
            {filtered.map(({c,done,total,pct,missed,curProg})=>(
              <tr key={c.id} style={{borderBottom:`1px solid ${C.border}`,cursor:'pointer',transition:'background 0.1s'}} onMouseEnter={e=>e.currentTarget.style.background=`${C.c1}10`} onMouseLeave={e=>e.currentTarget.style.background='transparent'} onClick={()=>go('client',{clientId:c.id})}>
                <td style={{padding:'10px 12px'}}>
                  <Row style={{alignItems:'center',gap:8}}>
                    <span style={{width:32,height:32,borderRadius:'50%',background:`${C.c1}30`,color:C.c3,fontSize:12,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{c.name[0].toUpperCase()}</span>
                    <span style={{fontWeight:600,color:C.white,fontSize:13}}>{c.name}</span>
                  </Row>
                </td>
                <td style={{padding:'10px 12px',color:C.muted,fontSize:12}}>{curProg?.name||'—'}</td>
                <td style={{padding:'10px 12px',color:C.green,fontWeight:600}}>{done}/{total}</td>
                <td style={{padding:'10px 12px',color:missed>0?C.red:C.muted,fontWeight:missed>0?700:400}}>{missed}</td>
                <td style={{padding:'10px 12px',minWidth:140}}>
                  <Row style={{alignItems:'center',gap:8}}>
                    <span style={{fontWeight:700,color:pColor(pct),minWidth:38}}>{pct}%</span>
                    <div style={{flex:1,height:6,background:C.surface,borderRadius:3,overflow:'hidden'}}>
                      <div style={{height:'100%',width:`${pct}%`,background:pColor(pct),borderRadius:3,transition:'width 0.3s'}}/>
                    </div>
                  </Row>
                </td>
                <td style={{padding:'10px 12px',color:C.faint,fontSize:12}}>View →</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length===0&&<div style={{padding:40,textAlign:'center',color:C.muted}}>No athletes match this filter.</div>}
      </div>
    </div>
  )
}

// ─── ALERTS ───────────────────────────────────────────────────────────────────
function AlertsPage({ clients, sessions, programs, weeks, flags, go }) {
  const [filter, setFilter] = useState('all')
  const allFlags = clients.filter(c=>c.status==='active').flatMap(client=>{
    const cs = sessions.filter(s=>s.client_id===client.id)
    const auto = generateAutoFlags(client,cs,sessions,programs,weeks).map(f=>({...f,client}))
    const manual = flags.filter(f=>f.client_id===client.id&&!f.is_resolved).map(f=>({...f,client,is_manual:true}))
    return [...auto,...manual]
  })
  const typeCounts = allFlags.reduce((a,f)=>{a[f.flag_type]=(a[f.flag_type]||0)+1;return a},{})
  const filtered = filter==='all'?allFlags:allFlags.filter(f=>f.flag_type===filter)
  const FT = FLAG_TYPES
  return(
    <div style={{padding:20,maxWidth:960,margin:'0 auto'}}>
      <h1 style={{fontSize:22,fontWeight:700,color:C.white,fontFamily:'Space Grotesk,sans-serif',marginBottom:4}}>ALERTS</h1>
      <p style={{fontSize:13,color:C.muted,marginBottom:20}}>{allFlags.length} active flag{allFlags.length!==1?'s':''} across all athletes</p>
      {/* Type filter pills */}
      <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:16}}>
        <button onClick={()=>setFilter('all')} style={{padding:'4px 14px',borderRadius:20,border:`1.5px solid ${filter==='all'?C.amber:C.border}`,background:filter==='all'?`${C.amber}18`:'transparent',color:filter==='all'?C.amber:C.muted,fontSize:11,fontWeight:700,cursor:'pointer'}}>All ({allFlags.length})</button>
        {Object.entries(typeCounts).map(([type,count])=>{const ft=FT[type]||{label:type,color:C.muted};return(
          <button key={type} onClick={()=>setFilter(type)} style={{padding:'4px 14px',borderRadius:20,border:`1.5px solid ${filter===type?ft.color:C.border}`,background:filter===type?`${ft.color}18`:'transparent',color:filter===type?ft.color:C.muted,fontSize:11,fontWeight:700,cursor:'pointer'}}>{ft.label} ({count})</button>
        )})}
      </div>
      {filtered.length===0&&<Card style={{textAlign:'center',padding:40}}><p style={{color:C.green,fontSize:14}}>✓ No active alerts — everything looks good.</p></Card>}
      <div style={{display:'flex',flexDirection:'column',gap:8}}>
        {filtered.map((flag,i)=>{
          const ft=FT[flag.flag_type]||{label:'Alert',color:C.orange}
          return(
            <div key={flag.id||i} style={{background:`${ft.color}10`,border:`1px solid ${ft.color}40`,borderRadius:10,padding:'12px 14px',cursor:'pointer'}} onClick={()=>go('client',{clientId:flag.client.id})}>
              <Row style={{alignItems:'flex-start',gap:12}}>
                <div style={{width:36,height:36,borderRadius:'50%',background:`${C.c1}30`,color:C.c3,fontSize:13,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{flag.client.name[0].toUpperCase()}</div>
                <div style={{flex:1,minWidth:0}}>
                  <Row style={{alignItems:'center',gap:8,marginBottom:3,flexWrap:'wrap'}}>
                    <span style={{fontWeight:700,color:C.white,fontSize:13}}>{flag.client.name}</span>
                    <Tag v={ft.label} color={ft.color} small/>
                    {flag.is_auto&&<Tag v="Auto" color={C.faint} small/>}
                  </Row>
                  <div style={{fontSize:13,color:C.white,fontWeight:600,marginBottom:flag.body?2:0}}>{flag.title}</div>
                  {flag.body&&<div style={{fontSize:12,color:C.muted}}>{flag.body}</div>}
                </div>
                <span style={{color:C.faint,fontSize:14,flexShrink:0}}>›</span>
              </Row>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── ALL PROGRAMS ─────────────────────────────────────────────────────────────
function ProgramsListPage({ clients, programs, sessions, go }) {
  const [search, setSearch] = useState('')
  const [statusF, setStatusF] = useState('all')
  const rows = programs.map(p=>{
    const client = clients.find(c=>c.id===p.client_id)
    const ps = sessions.filter(s=>s.program_id===p.id)
    const done = ps.filter(s=>computeSessionStatus(s)==='complete').length
    const pct = ps.length>0?Math.round(done/ps.length*100):0
    return {p,client,ps:ps.length,done,pct}
  }).filter(r=>
    (statusF==='all'||r.p.status===statusF) &&
    (!search || r.p.name.toLowerCase().includes(search.toLowerCase()) || r.client?.name.toLowerCase().includes(search.toLowerCase()))
  ).sort((a,b)=>{
    if(a.p.status!==b.p.status){const order={current:0,draft:1,complete:2,archived:3};return(order[a.p.status]||3)-(order[b.p.status]||3)}
    return new Date(b.p.created_at||0)-new Date(a.p.created_at||0)
  })
  const statusColor = {current:C.amber,complete:C.green,draft:C.c3,archived:C.muted}
  return(
    <div style={{padding:20,maxWidth:1000,margin:'0 auto'}}>
      <h1 style={{fontSize:22,fontWeight:700,color:C.white,fontFamily:'Space Grotesk,sans-serif',marginBottom:16}}>ALL PROGRAMS</h1>
      <Row style={{gap:10,marginBottom:16}}>
        <div style={{flex:1}}><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search programs or athletes…" style={iS}/></div>
        <SI value={statusF} onChange={setStatusF} options={[{v:'all',l:'All Status'},{v:'current',l:'Current'},{v:'complete',l:'Complete'},{v:'draft',l:'Draft'},{v:'archived',l:'Archived'}]}/>
      </Row>
      <p style={{fontSize:12,color:C.muted,marginBottom:10}}>{rows.length} programs</p>
      <div style={{display:'flex',flexDirection:'column',gap:6}}>
        {rows.map(({p,client,ps,done,pct})=>(
          <div key={p.id} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:'10px 14px',cursor:'pointer',transition:'border-color 0.1s'}} onMouseEnter={e=>e.currentTarget.style.borderColor=`${C.amber}50`} onMouseLeave={e=>e.currentTarget.style.borderColor=C.border} onClick={()=>go('program',{programId:p.id,clientId:p.client_id})}>
            <Row style={{alignItems:'center',gap:12}}>
              <div style={{flex:1,minWidth:0}}>
                <Row style={{alignItems:'center',gap:8,marginBottom:2,flexWrap:'wrap'}}>
                  <span style={{fontWeight:700,color:C.white,fontSize:13}}>{p.name}</span>
                  <Tag v={p.status.charAt(0).toUpperCase()+p.status.slice(1)} color={statusColor[p.status]||C.muted} small/>
                  {p.phase&&<Tag v={p.phase} color={C.c2} small/>}
                </Row>
                <Row style={{gap:10,flexWrap:'wrap'}}>
                  {client&&<span style={{fontSize:11,color:C.c3,fontWeight:600}}>{client.name}</span>}
                  {p.goal&&<span style={{fontSize:11,color:C.muted}}>{p.goal}</span>}
                  <span style={{fontSize:11,color:C.faint}}>{done}/{ps} sessions</span>
                </Row>
              </div>
              <div style={{minWidth:130,textAlign:'right'}}>
                <div style={{fontSize:12,color:trafficColor(pct),fontWeight:700,marginBottom:3}}>{pct}%</div>
                <div style={{height:5,background:C.surface,borderRadius:3,overflow:'hidden'}}>
                  <div style={{height:'100%',width:`${pct}%`,background:trafficColor(pct),borderRadius:3,transition:'width 0.4s'}}/>
                </div>
              </div>
              <span style={{color:C.faint}}>›</span>
            </Row>
          </div>
        ))}
        {rows.length===0&&<Card style={{textAlign:'center',padding:32}}><p style={{color:C.muted}}>No programs match your filters.</p></Card>}
      </div>
    </div>
  )
}

// ─── ALL SESSIONS ─────────────────────────────────────────────────────────────
function SessionsListPage({ clients, programs, weeks, sessions, go }) {
  const [search, setSearch] = useState('')
  const [statusF, setStatusF] = useState('all')
  const [clientF, setClientF] = useState('all')
  const rows = sessions.map(s=>{
    const prog=programs.find(p=>p.id===s.program_id)
    const client=clients.find(c=>c.id===s.client_id)
    const week=weeks.find(w=>w.id===s.week_id)
    const status=computeSessionStatus(s)
    return {s,prog,client,week,status}
  }).filter(r=>
    (statusF==='all'||r.status===statusF) &&
    (clientF==='all'||r.s.client_id===clientF) &&
    (!search||r.s.name.toLowerCase().includes(search.toLowerCase())||r.client?.name.toLowerCase().includes(search.toLowerCase())||r.prog?.name.toLowerCase().includes(search.toLowerCase()))
  ).sort((a,b)=>new Date(b.s.created_at||0)-new Date(a.s.created_at||0))
  const clientOpts = [{v:'all',l:'All Athletes'},...clients.filter(c=>c.status==='active').map(c=>({v:c.id,l:c.name}))]
  return(
    <div style={{padding:20,maxWidth:1000,margin:'0 auto'}}>
      <h1 style={{fontSize:22,fontWeight:700,color:C.white,fontFamily:'Space Grotesk,sans-serif',marginBottom:16}}>ALL SESSIONS</h1>
      <div style={{display:'grid',gridTemplateColumns:'1fr 140px 140px',gap:10,marginBottom:12}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search sessions…" style={iS}/>
        <select value={clientF} onChange={e=>setClientF(e.target.value)} style={{...iS,cursor:'pointer'}}>{clientOpts.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}</select>
        <select value={statusF} onChange={e=>setStatusF(e.target.value)} style={{...iS,cursor:'pointer'}}><option value="all">All Status</option><option value="complete">Complete</option><option value="in_progress">In Progress</option><option value="not_started">Not Started</option></select>
      </div>
      <p style={{fontSize:12,color:C.muted,marginBottom:10}}>{rows.length} sessions</p>
      <div style={{display:'flex',flexDirection:'column',gap:4}}>
        {rows.slice(0,100).map(({s,prog,client,week,status})=>{
          const {color}=STATUS[status]||STATUS.not_started
          return(
            <div key={s.id} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:'8px 14px',cursor:'pointer',display:'flex',alignItems:'center',gap:12,transition:'border-color 0.1s'}} onMouseEnter={e=>e.currentTarget.style.borderColor=`${color}50`} onMouseLeave={e=>e.currentTarget.style.borderColor=C.border} onClick={()=>go('session',{sessionId:s.id,programId:s.program_id,clientId:s.client_id})}>
              <span style={{width:8,height:8,borderRadius:'50%',background:color,flexShrink:0}}/>
              <div style={{flex:1,minWidth:0}}>
                <Row style={{alignItems:'center',gap:8,marginBottom:1,flexWrap:'wrap'}}>
                  <span style={{fontWeight:600,color:C.white,fontSize:13}}>{s.name}</span>
                  {s.session_type&&<Tag v={s.session_type} color={C.c2} small/>}
                </Row>
                <Row style={{gap:8,flexWrap:'wrap'}}>
                  {client&&<span style={{fontSize:11,color:C.c3,fontWeight:600}}>{client.name}</span>}
                  {prog&&<span style={{fontSize:11,color:C.muted}}>{prog.name}</span>}
                  {week&&<span style={{fontSize:11,color:C.faint}}>Week {week.week_number}</span>}
                </Row>
              </div>
              <Tag v={STATUS[status]?.label} color={color} small/>
              <span style={{color:C.faint,fontSize:12}}>›</span>
            </div>
          )
        })}
        {rows.length>100&&<div style={{textAlign:'center',padding:12,color:C.faint,fontSize:12}}>Showing first 100 of {rows.length} — use filters to narrow down</div>}
        {rows.length===0&&<Card style={{textAlign:'center',padding:32}}><p style={{color:C.muted}}>No sessions match your filters.</p></Card>}
      </div>
    </div>
  )
}

// ─── STRENGTH LEADERBOARD ─────────────────────────────────────────────────────
function StrengthLeaderboard({ clients, sessions, weeks, programs }) {
  // Build exercise list from all logged sessions
  const exerciseNames = [...new Set(
    sessions.flatMap(s=>safeExercises(s).filter(e=>!e.isWarmup&&e.loggedSets?.some(ls=>ls.completedLoad)).map(e=>e.name))
  )].sort()
  const [exercise, setExercise] = useState(exerciseNames[0]||'')
  const rows = clients.filter(c=>c.status==='active').map(client=>{
    const pbs=getClientPBs(client.id,sessions.filter(s=>s.client_id===client.id),sessions,weeks,programs)
    const pb = pbs.find(p=>p.name===exercise)
    return {client, e1rm:pb?.maxE1RM||0, maxLoad:pb?.maxLoad||0, history:pb?.history||[]}
  }).filter(r=>r.e1rm>0).sort((a,b)=>b.e1rm-a.e1rm)
  return(
    <div style={{padding:20,maxWidth:900,margin:'0 auto'}}>
      <h1 style={{fontSize:22,fontWeight:700,color:C.white,fontFamily:'Space Grotesk,sans-serif',marginBottom:4}}>STRENGTH LEADERBOARD</h1>
      <p style={{fontSize:13,color:C.muted,marginBottom:20}}>Top e1RM ({_e1rmFormula} formula) across all athletes</p>
      <div style={{marginBottom:20,maxWidth:320}}>
        <label style={lS}>Exercise</label>
        <select value={exercise} onChange={e=>setExercise(e.target.value)} style={{...iS,cursor:'pointer'}}>
          <option value="">— Select exercise —</option>
          {exerciseNames.map(n=><option key={n} value={n}>{n}</option>)}
        </select>
      </div>
      {!exercise&&<Card style={{textAlign:'center',padding:40}}><p style={{color:C.muted}}>Select an exercise to see the leaderboard.</p></Card>}
      {exercise&&rows.length===0&&<Card style={{textAlign:'center',padding:40}}><p style={{color:C.muted}}>No logged sets found for "{exercise}".</p></Card>}
      {exercise&&rows.length>0&&(
        <div style={{display:'flex',flexDirection:'column',gap:6}}>
          {rows.map(({client,e1rm,maxLoad,history},i)=>{
            const trend = history.length>=2?(history[history.length-1].e1rm>history[history.length-2].e1rm?'↑':'→'):'—'
            const tColor = trend==='↑'?C.green:trend==='→'?C.orange:C.faint
            const medals = ['1st','2nd','3rd']
            return(
              <div key={client.id} style={{background:C.card,border:`1px solid ${i<3?C.amber+'40':C.border}`,borderRadius:10,padding:'12px 16px',display:'flex',alignItems:'center',gap:16}}>
                <span style={{fontSize:20,minWidth:32,textAlign:'center'}}>{medals[i]||<span style={{fontSize:14,color:C.faint,fontWeight:700}}>#{i+1}</span>}</span>
                {!medals[i]&&<span style={{fontSize:14,color:C.faint,fontWeight:700,minWidth:32,textAlign:'center'}}>#{i+1}</span>}
                <div style={{width:36,height:36,borderRadius:'50%',background:`${C.c1}30`,color:C.c3,fontSize:13,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{client.name[0].toUpperCase()}</div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,color:C.white,fontSize:14,marginBottom:1}}>{client.name}</div>
                  <div style={{fontSize:11,color:C.muted}}>{history.length} session{history.length!==1?'s':''} logged</div>
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontSize:22,fontWeight:700,color:i===0?C.gold:C.amber}}>{Math.round(e1rm*10)/10}kg</div>
                  <div style={{fontSize:11,color:C.muted}}>e1RM · Best {maxLoad}kg</div>
                </div>
                <span style={{fontSize:16,fontWeight:700,color:tColor,minWidth:20,textAlign:'center'}}>{trend}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── ATTENDANCE LEADERBOARD ───────────────────────────────────────────────────
function AttendanceLeaderboard({ clients, sessions, programs, go }) {
  const rows = clients.filter(c=>c.status==='active').map(c=>{
    const cs=sessions.filter(s=>s.client_id===c.id)
    const done=cs.filter(s=>computeSessionStatus(s)==='complete').length
    const total=cs.length
    const pct=total>0?Math.round(done/total*100):0
    return {c,done,total,pct}
  }).filter(r=>r.total>0).sort((a,b)=>b.pct-a.pct)
  const medals=['1st','2nd','3rd']
  const pColor=p=>p>=85?C.green:p>=70?C.amber:p>=50?C.orange:C.red
  return(
    <div style={{padding:20,maxWidth:760,margin:'0 auto'}}>
      <h1 style={{fontSize:22,fontWeight:700,color:C.white,fontFamily:'Space Grotesk,sans-serif',marginBottom:4}}>ATTENDANCE LEADERBOARD</h1>
      <p style={{fontSize:13,color:C.muted,marginBottom:20}}>Session completion rate across all athletes</p>
      {rows.length===0&&<Card style={{textAlign:'center',padding:40}}><p style={{color:C.muted}}>No session data yet.</p></Card>}
      <div style={{display:'flex',flexDirection:'column',gap:6}}>
        {rows.map(({c,done,total,pct},i)=>(
          <div key={c.id} onClick={()=>go('client',{clientId:c.id})} style={{background:C.card,border:`1px solid ${i<3?pColor(pct)+'40':C.border}`,borderRadius:10,padding:'12px 16px',cursor:'pointer',display:'flex',alignItems:'center',gap:12}}>
            <span style={{fontSize:i<3?20:14,minWidth:32,textAlign:'center',color:i>=3?C.faint:undefined,fontWeight:700}}>
              {medals[i]||`#${i+1}`}
            </span>
            <div style={{width:36,height:36,borderRadius:'50%',background:`${pColor(pct)}20`,color:pColor(pct),fontSize:13,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{c.name[0].toUpperCase()}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontWeight:700,color:C.white,fontSize:14,marginBottom:4}}>{c.name}</div>
              <div style={{height:6,background:C.surface,borderRadius:3,overflow:'hidden'}}>
                <div style={{height:'100%',width:`${pct}%`,background:pColor(pct),borderRadius:3,transition:'width 0.5s'}}/>
              </div>
            </div>
            <div style={{textAlign:'right',minWidth:80}}>
              <div style={{fontSize:20,fontWeight:700,color:pColor(pct)}}>{pct}%</div>
              <div style={{fontSize:11,color:C.muted}}>{done}/{total} sessions</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── WELLNESS LEADERBOARD ─────────────────────────────────────────────────────
function WellnessLeaderboard() {
  return(
    <div style={{padding:40,maxWidth:560,margin:'0 auto',textAlign:'center'}}>
      <div style={{display:'flex',justifyContent:'center',marginBottom:16}}><Icon name="trophy" size={38} color={C.amber}/></div>
      <h1 style={{fontSize:22,fontWeight:700,color:C.white,marginBottom:8,fontFamily:'Space Grotesk,sans-serif'}}>Wellness Leaderboard</h1>
      <p style={{fontSize:14,color:C.muted,lineHeight:1.7,marginBottom:24}}>Rankings are based on readiness scores, HRV, sleep quality, and energy levels logged by athletes. Enable athlete wellness check-ins to populate this leaderboard.</p>
      <div style={{background:`${C.c1}10`,border:`1px solid ${C.c1}30`,borderRadius:10,padding:'14px 20px',display:'inline-block'}}>
        <span style={{fontSize:12,color:C.c3,fontWeight:600}}>Activates when athletes submit readiness check-ins</span>
      </div>
    </div>
  )
}

// ─── SPRINT LEADERBOARD ───────────────────────────────────────────────────────
function SprintLeaderboard({ clients, sessions, go }) {
  // Sprint data comes from fitness tests (testing_reports)
  return(
    <div style={{padding:40,maxWidth:560,margin:'0 auto',textAlign:'center'}}>
      <div style={{display:'flex',justifyContent:'center',marginBottom:16}}><Icon name="trophy" size={38} color={C.amber}/></div>
      <h1 style={{fontSize:22,fontWeight:700,color:C.white,marginBottom:8,fontFamily:'Space Grotesk,sans-serif'}}>Sprint Rankings</h1>
      <p style={{fontSize:14,color:C.muted,lineHeight:1.7,marginBottom:20}}>Log sprint test results in Testing Reports to populate speed rankings.</p>
      <Btn label="Go to Testing Reports" onClick={()=>go('testing_reports')}/>
    </div>
  )
}

// ─── INJURIES ─────────────────────────────────────────────────────────────────
function InjuriesPage({ clients, flags, sessions, go }) {
  const injuryFlags = clients.flatMap(c=>{
    const manual = flags.filter(f=>f.client_id===c.id&&!f.is_resolved&&(f.flag_type==='injury'||c.pain_flag))
    const auto = sessions.filter(s=>s.client_id===c.id).flatMap(s=>
      safeExercises(s).filter(e=>(e.loggedSets||[]).some(ls=>ls.pain_score&&parseFloat(ls.pain_score)>=4)).map(e=>({
        id:`pain_${c.id}_${s.id}_${e.id}`, client:c, flag_type:'injury',
        title:`${e.name} — pain score ${e.loggedSets.find(ls=>ls.pain_score)?.pain_score}/10`,
        body:`Logged in session: ${s.name}`, is_auto:true
      }))
    )
    return [...manual.map(f=>({...f,client:c})),...auto]
  })
  const painClients = clients.filter(c=>c.pain_flag)
  return(
    <div style={{padding:20,maxWidth:900,margin:'0 auto'}}>
      <h1 style={{fontSize:22,fontWeight:700,color:C.white,fontFamily:'Space Grotesk,sans-serif',marginBottom:4}}>INJURIES & PAIN</h1>
      <p style={{fontSize:13,color:C.muted,marginBottom:20}}>Flagged injuries and pain concerns across all athletes</p>
      {painClients.length>0&&(
        <div style={{marginBottom:20}}>
          <SL>Athletes with Active Pain Flag</SL>
          <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
            {painClients.map(c=>(
              <div key={c.id} onClick={()=>go('client',{clientId:c.id})} style={{background:`${C.red}15`,border:`1px solid ${C.red}40`,borderRadius:8,padding:'8px 14px',cursor:'pointer',display:'flex',alignItems:'center',gap:8}}>
                <span style={{width:28,height:28,borderRadius:'50%',background:`${C.red}20`,color:C.red,fontSize:11,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center'}}>{c.name[0]}</span>
                <span style={{fontSize:13,color:C.white,fontWeight:600}}>{c.name}</span>
                <Tag v="Pain" color={C.red} small/>
              </div>
            ))}
          </div>
        </div>
      )}
      {injuryFlags.length===0&&painClients.length===0&&<Card style={{textAlign:'center',padding:40}}><p style={{color:C.green,fontSize:14}}>✓ No active injuries or pain flags.</p></Card>}
      {injuryFlags.length>0&&(
        <div>
          <SL>Flagged Concerns ({injuryFlags.length})</SL>
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {injuryFlags.map((f,i)=>(
              <div key={f.id||i} onClick={()=>go('client',{clientId:f.client.id})} style={{background:`${C.red}10`,border:`1px solid ${C.red}40`,borderRadius:10,padding:'12px 14px',cursor:'pointer'}}>
                <Row style={{alignItems:'flex-start',gap:12}}>
                  <div style={{width:36,height:36,borderRadius:'50%',background:`${C.red}20`,color:C.red,fontSize:13,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{f.client.name[0].toUpperCase()}</div>
                  <div style={{flex:1}}>
                    <Row style={{alignItems:'center',gap:8,marginBottom:2,flexWrap:'wrap'}}>
                      <span style={{fontWeight:700,color:C.white}}>{f.client.name}</span>
                      <Tag v="Injury" color={C.red} small/>
                      {f.is_auto&&<Tag v="Auto-detected" color={C.faint} small/>}
                    </Row>
                    <div style={{fontSize:13,color:C.white,fontWeight:500,marginBottom:f.body?2:0}}>{f.title}</div>
                    {f.body&&<div style={{fontSize:12,color:C.muted}}>{f.body}</div>}
                  </div>
                  <span style={{color:C.faint}}>›</span>
                </Row>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── MONITORING ───────────────────────────────────────────────────────────────
function MonitoringPage({ clients, programs, sessions, weeks, flags, go }) {
  const [groupFilter, setGroupFilter] = useState('')
  const rows = clients.filter(c=>c.status==='active' && (!groupFilter||c.group_label===groupFilter)).map(c=>{
    const cs = sessions.filter(s=>s.client_id===c.id)
    const done = cs.filter(s=>computeSessionStatus(s)==='complete').length
    const total = cs.length
    const pct = total>0?Math.round(done/total*100):0
    const autoF = generateAutoFlags(c,cs,sessions,programs,weeks)
    const manualF = flags.filter(f=>f.client_id===c.id&&!f.is_resolved)
    const totalFlags = autoF.length + manualF.length
    const hasInjury = c.pain_flag || manualF.some(f=>f.flag_type==='injury')
    const curProg = programs.find(p=>p.client_id===c.id&&p.status==='current')
    const lastSess = cs.filter(s=>computeSessionStatus(s)==='complete').slice(-1)[0]
    return {c,pct,done,total,totalFlags,hasInjury,curProg,lastSess,autoF,manualF}
  })
  const pColor = p=>p>=85?C.green:p>=70?C.amber:p>=50?C.orange:C.red
  return(
    <div style={{padding:20,maxWidth:1100,margin:'0 auto'}}>
      <h1 style={{fontSize:22,fontWeight:700,color:C.white,fontFamily:'Space Grotesk,sans-serif',marginBottom:4}}>MONITORING</h1>
      <p style={{fontSize:13,color:C.muted,marginBottom:20}}>At-a-glance status for all active athletes</p>
      <GroupFilter clients={clients} value={groupFilter} onChange={setGroupFilter}/>
      <div style={{display:'flex',flexDirection:'column',gap:8}}>
        {rows.map(({c,pct,done,total,totalFlags,hasInjury,curProg,lastSess,autoF})=>(
          <div key={c.id} onClick={()=>go('client',{clientId:c.id})} style={{background:C.card,border:`1px solid ${hasInjury?`${C.red}50`:totalFlags>0?`${C.orange}40`:C.border}`,borderRadius:10,padding:'10px 14px',cursor:'pointer',transition:'border-color 0.1s'}}>
            <Row style={{alignItems:'center',gap:12,flexWrap:'wrap'}}>
              <div style={{width:36,height:36,borderRadius:'50%',background:`${C.c1}30`,color:C.c3,fontSize:13,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{c.name[0].toUpperCase()}</div>
              <div style={{minWidth:160,flex:1}}>
                <div style={{fontWeight:700,color:C.white,fontSize:14,marginBottom:2}}>{c.name}</div>
                <div style={{fontSize:11,color:C.muted}}>{curProg?.name||'No active program'}</div>
              </div>
              {/* Adherence */}
              <div style={{minWidth:80,textAlign:'center'}}>
                <div style={{fontSize:16,fontWeight:700,color:pColor(pct)}}>{pct}%</div>
                <div style={{fontSize:9,color:C.faint,textTransform:'uppercase',letterSpacing:'0.06em'}}>Adherence</div>
              </div>
              {/* Sessions */}
              <div style={{minWidth:70,textAlign:'center'}}>
                <div style={{fontSize:16,fontWeight:700,color:C.white}}>{done}/{total}</div>
                <div style={{fontSize:9,color:C.faint,textTransform:'uppercase',letterSpacing:'0.06em'}}>Sessions</div>
              </div>
              {/* Flags */}
              <div style={{minWidth:60,textAlign:'center'}}>
                <div style={{fontSize:16,fontWeight:700,color:totalFlags>0?C.orange:C.green}}>{totalFlags}</div>
                <div style={{fontSize:9,color:C.faint,textTransform:'uppercase',letterSpacing:'0.06em'}}>Flags</div>
              </div>
              {/* Status tags */}
              <Row style={{gap:4,flexShrink:0,flexWrap:'wrap'}}>
                {hasInjury&&<Tag v="Injury" color={C.red} small/>}
                {autoF.some(f=>f.flag_type==='stall')&&<Tag v="Stall" color={C.c3} small/>}
                {autoF.some(f=>f.flag_type==='warning')&&<Tag v="Compliance" color={C.orange} small/>}
                {autoF.some(f=>f.flag_type==='imbalance')&&<Tag v="Imbalance" color={C.orange} small/>}
                {totalFlags===0&&!hasInjury&&<Tag v="On Track" color={C.green} small/>}
              </Row>
              <span style={{color:C.faint,fontSize:14}}>›</span>
            </Row>
          </div>
        ))}
        {rows.length===0&&<Card style={{textAlign:'center',padding:40}}><p style={{color:C.muted}}>No active athletes to monitor.</p></Card>}
      </div>
    </div>
  )
}

// ─── ATHLETE REPORTS ─────────────────────────────────────────────────────────
function AthleteReportsPage({ clients, programs, sessions, weeks, goals, flags, go }) {
  const [selected, setSelected] = useState(null)
  const activeClients = clients.filter(c=>c.status==='active')
  if(!selected) return(
    <div style={{padding:20,maxWidth:800,margin:'0 auto'}}>
      <h1 style={{fontSize:22,fontWeight:700,color:C.white,fontFamily:'Space Grotesk,sans-serif',marginBottom:4}}>ATHLETE REPORTS</h1>
      <p style={{fontSize:13,color:C.muted,marginBottom:20}}>Select an athlete to generate a progress summary</p>
      <div style={{display:'flex',flexDirection:'column',gap:6}}>
        {activeClients.map(c=>{
          const cs=sessions.filter(s=>s.client_id===c.id)
          const done=cs.filter(s=>computeSessionStatus(s)==='complete').length
          const pbs=getClientPBs(c.id,cs,sessions,weeks,programs)
          return(
            <div key={c.id} onClick={()=>setSelected(c)} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:'12px 16px',cursor:'pointer',display:'flex',alignItems:'center',gap:12,transition:'border-color 0.1s'}} onMouseEnter={e=>e.currentTarget.style.borderColor=`${C.amber}50`} onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}>
              <div style={{width:40,height:40,borderRadius:'50%',background:`${C.c1}30`,color:C.c3,fontSize:15,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{c.name[0].toUpperCase()}</div>
              <div style={{flex:1}}><div style={{fontWeight:700,color:C.white,fontSize:14,marginBottom:1}}>{c.name}</div><div style={{fontSize:12,color:C.muted}}>{done} sessions done · {pbs.length} exercises tracked</div></div>
              <Btn label="Generate Report" variant="secondary" small/>
            </div>
          )
        })}
        {activeClients.length===0&&<Card style={{textAlign:'center',padding:32}}><p style={{color:C.muted}}>No active athletes.</p></Card>}
      </div>
    </div>
  )
  const c=selected
  const cs=sessions.filter(s=>s.client_id===c.id)
  const done=cs.filter(s=>computeSessionStatus(s)==='complete').length
  const total=cs.length
  const pct=total>0?Math.round(done/total*100):0
  const pbs=getClientPBs(c.id,cs,sessions,weeks,programs)
  const cGoals=goals.filter(g=>g.client_id===c.id&&g.status!=='archived')
  const autoF=generateAutoFlags(c,cs,sessions,programs,weeks)
  const curProg=programs.find(p=>p.client_id===c.id&&p.status==='current')
  return(
    <div style={{padding:20,maxWidth:860,margin:'0 auto'}}>
      <button onClick={()=>setSelected(null)} style={{background:'none',border:'none',color:C.amber,cursor:'pointer',fontSize:13,fontWeight:600,padding:0,marginBottom:16}}>← Back to Athletes</button>
      <div style={{background:`linear-gradient(135deg,${C.ink},#0a0f1e)`,border:`1px solid ${C.border}`,borderRadius:12,padding:'20px 24px',marginBottom:20}}>
        <Row style={{alignItems:'center',gap:16,marginBottom:16}}>
          <div style={{width:56,height:56,borderRadius:'50%',background:`linear-gradient(135deg,${C.c1},${C.c2})`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,fontWeight:700,color:C.white,flexShrink:0}}>{c.name.split(' ').map(n=>n[0]).slice(0,2).join('')}</div>
          <div><h2 style={{fontSize:20,fontWeight:700,color:C.white,marginBottom:2}}>{c.name}</h2><div style={{fontSize:12,color:C.muted}}>{c.goal||'No primary goal set'}</div></div>
        </Row>
        <G4>
          {[{v:pct+'%',l:'Adherence'},{v:done+'/'+total,l:'Sessions'},{v:pbs.length,l:'Exercises Tracked'},{v:cGoals.filter(g=>g.status==='achieved').length+'/'+cGoals.length,l:'Goals Achieved'}].map(({v,l})=>(
            <div key={l} style={{textAlign:'center',padding:'10px 0'}}><div style={{fontSize:20,fontWeight:700,color:C.white,marginBottom:2}}>{v}</div><div style={{fontSize:9,color:C.faint,textTransform:'uppercase',letterSpacing:'0.08em'}}>{l}</div></div>
          ))}
        </G4>
      </div>
      {curProg&&<div style={{marginBottom:16}}><SL>Current Program</SL><Card><div style={{fontWeight:600,color:C.white,marginBottom:4}}>{curProg.name}</div><div style={{fontSize:12,color:C.muted}}>{curProg.goal||'No goal set'}</div></Card></div>}
      {pbs.length>0&&<div style={{marginBottom:16}}><SL>Top Personal Bests (e1RM)</SL><div style={{display:'flex',flexDirection:'column',gap:5}}>{pbs.slice(0,8).map(pb=>(<div key={pb.name} style={{display:'flex',alignItems:'center',gap:12,padding:'7px 0',borderBottom:`1px solid ${C.border}`}}><span style={{flex:1,fontSize:13,color:C.white}}>{pb.name}</span><span style={{color:C.amber,fontWeight:700,fontSize:14}}>{Math.round(pb.maxE1RM*10)/10}kg</span><span style={{fontSize:11,color:C.muted}}>Best {pb.maxLoad}kg</span>{(()=>{const h=pb.history;if(h.length<2)return null;const up=h[h.length-1].e1rm>h[h.length-2].e1rm;return<Tag v={up?'↑ Progressing':'→ Flat'} color={up?C.green:C.orange} small/>})()}</div>))}</div></div>}
      {autoF.length>0&&(<div style={{marginBottom:16}}><SL>Recommendations</SL><div style={{display:'flex',flexDirection:'column',gap:6}}>{autoF.map((f,i)=>{const ft=FLAG_TYPES[f.flag_type]||{label:'Note',color:C.amber};return(<div key={i} style={{background:`${ft.color}10`,border:`1px solid ${ft.color}40`,borderRadius:8,padding:'10px 12px'}}><Row style={{alignItems:'center',gap:8}}><Tag v={ft.label} color={ft.color} small/><span style={{fontSize:13,color:C.white,fontWeight:500}}>{f.title}</span></Row>{f.body&&<div style={{fontSize:12,color:C.muted,marginTop:3}}>{f.body}</div>}</div>)})}</div></div>)}
    </div>
  )
}

// ─── COMPLIANCE REPORTS ───────────────────────────────────────────────────────
function ComplianceReportsPage({ clients, programs, sessions, weeks }) {
  const rows = clients.filter(c=>c.status==='active').map(c=>{
    const cs=sessions.filter(s=>s.client_id===c.id)
    const done=cs.filter(s=>computeSessionStatus(s)==='complete').length
    const total=cs.length
    const pct=total>0?Math.round(done/total*100):0
    const cp=programs.filter(p=>p.client_id===c.id&&p.status==='current')
    return {name:c.name,goal:c.goal||'',programs:cp.length,done,total,pct}
  }).sort((a,b)=>a.pct-b.pct)
  const downloadCSV = () => {
    const hdr = ['Athlete','Goal','Active Programs','Sessions Done','Total Sessions','Adherence %']
    const lines = rows.map(r=>[r.name,r.goal,r.programs,r.done,r.total,r.pct+'%'].join(','))
    const csv = [hdr.join(','),...lines].join('\n')
    const a=document.createElement('a'); a.href='data:text/csv,'+encodeURIComponent(csv); a.download='compliance_report.csv'; a.click()
  }
  const pColor=p=>p>=85?C.green:p>=70?C.amber:p>=50?C.orange:C.red
  return(
    <div style={{padding:20,maxWidth:900,margin:'0 auto'}}>
      <Row style={{alignItems:'flex-start',justifyContent:'space-between',marginBottom:16,flexWrap:'wrap',gap:10}}>
        <div><h1 style={{fontSize:22,fontWeight:700,color:C.white,fontFamily:'Space Grotesk,sans-serif',marginBottom:2}}>COMPLIANCE REPORT</h1><p style={{fontSize:13,color:C.muted}}>Generated {new Date().toLocaleDateString('en-AU',{day:'numeric',month:'long',year:'numeric'})}</p></div>
        <Btn label="⬇ Export CSV" variant="secondary" onClick={downloadCSV}/>
      </Row>
      <div style={{overflowX:'auto'}}>
        <table style={{width:'100%',borderCollapse:'collapse'}}>
          <thead><tr style={{borderBottom:`2px solid ${C.border}`}}>{['Athlete','Goal','Active Programs','Sessions Done','Adherence %'].map(h=>(<th key={h} style={{textAlign:'left',padding:'8px 12px',fontSize:10,color:C.amber,textTransform:'uppercase',letterSpacing:'0.06em',fontWeight:700,whiteSpace:'nowrap'}}>{h}</th>))}</tr></thead>
          <tbody>
            {rows.map((r,i)=>(
              <tr key={r.name} style={{borderBottom:`1px solid ${C.border}`,background:i%2===0?'transparent':`${C.white}02`}}>
                <td style={{padding:'9px 12px',fontWeight:600,color:C.white}}>{r.name}</td>
                <td style={{padding:'9px 12px',color:C.muted,fontSize:12}}>{r.goal||'—'}</td>
                <td style={{padding:'9px 12px',color:C.white,textAlign:'center'}}>{r.programs}</td>
                <td style={{padding:'9px 12px',color:C.white}}>{r.done} / {r.total}</td>
                <td style={{padding:'9px 12px'}}>
                  <Row style={{alignItems:'center',gap:8}}>
                    <span style={{fontWeight:700,color:pColor(r.pct),minWidth:38}}>{r.pct}%</span>
                    <div style={{flex:1,minWidth:80,height:5,background:C.surface,borderRadius:3,overflow:'hidden'}}><div style={{height:'100%',width:`${r.pct}%`,background:pColor(r.pct),borderRadius:3}}/></div>
                  </Row>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── EXPORT CENTRE ────────────────────────────────────────────────────────────
function ExportCentre({ clients, programs, sessions, weeks, goals, flags }) {
  const [exporting, setExporting] = useState(null)
  const dl = (name, rows, headers) => {
    setExporting(name)
    const csv = [headers.join(','), ...rows.map(r=>r.map(v=>`"${String(v||'').replace(/"/g,'""')}"`).join(','))].join('\n')
    const a=document.createElement('a'); a.href='data:text/csv,'+encodeURIComponent(csv); a.download=name+'.csv'; a.click()
    setTimeout(()=>setExporting(null), 600)
  }
  const exports = [
    { id:'clients', label:'Athletes', desc:'All athlete profiles', icon:'◉',
      action:()=>dl('athletes', clients.map(c=>[c.name,c.email||'',c.goal||'',c.status,c.train_days||'']), ['Name','Email','Goal','Status','Days/Week']) },
    { id:'programs', label:'Programs', desc:'All training programs', icon:'▦',
      action:()=>dl('programs', programs.map(p=>{const c=clients.find(cl=>cl.id===p.client_id);const ps=sessions.filter(s=>s.program_id===p.id);const done=ps.filter(s=>computeSessionStatus(s)==='complete').length;return[c?.name||'',p.name,p.status,p.phase||'',`${done}/${ps.length}`,p.start_date||'']}), ['Athlete','Program','Status','Phase','Completion','Start Date']) },
    { id:'sessions', label:'Sessions', desc:'All session data', icon:'◈',
      action:()=>dl('sessions', sessions.map(s=>{const c=clients.find(cl=>cl.id===s.client_id);const p=programs.find(pr=>pr.id===s.program_id);const w=weeks.find(wk=>wk.id===s.week_id);return[c?.name||'',p?.name||'',`Week ${w?.week_number||'?'}`,s.name,s.session_type||'',computeSessionStatus(s),safeExercises(s).filter(e=>!e.isWarmup).length]}), ['Athlete','Program','Week','Session','Type','Status','Exercises']) },
    { id:'pbs', label:'Personal Bests', desc:'Best e1RM per exercise per athlete', icon:'◆',
      action:()=>{const rows=[];clients.filter(c=>c.status==='active').forEach(c=>{const pbs=getClientPBs(c.id,sessions.filter(s=>s.client_id===c.id),sessions,weeks,programs);pbs.forEach(pb=>rows.push([c.name,pb.name,pb.maxLoad,Math.round(pb.maxE1RM*10)/10,pb.history.length]))});dl('personal_bests',rows,['Athlete','Exercise','Best Load (kg)','Est. 1RM (kg)','Sessions Logged'])} },
    { id:'compliance', label:'Compliance', desc:'Adherence rates per athlete', icon:'◧',
      action:()=>dl('compliance', clients.filter(c=>c.status==='active').map(c=>{const cs=sessions.filter(s=>s.client_id===c.id);const done=cs.filter(s=>computeSessionStatus(s)==='complete').length;const t=cs.length;return[c.name,done,t,t>0?Math.round(done/t*100)+'%':'—']}), ['Athlete','Done','Total','Adherence']) },
  ]
  return(
    <div style={{padding:20,maxWidth:800,margin:'0 auto'}}>
      <h1 style={{fontSize:22,fontWeight:700,color:C.white,fontFamily:'Space Grotesk,sans-serif',marginBottom:4}}>EXPORT CENTRE</h1>
      <p style={{fontSize:13,color:C.muted,marginBottom:24}}>Download your coaching data as CSV files</p>
      <div style={{display:'flex',flexDirection:'column',gap:10}}>
        {exports.map(({id,label,desc,icon,action})=>(
          <Card key={id} style={{padding:'14px 18px'}}>
            <Row style={{alignItems:'center',gap:14}}>
              <div style={{width:42,height:42,borderRadius:8,background:`${C.amber}15`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,color:C.amber,flexShrink:0}}>{icon}</div>
              <div style={{flex:1}}><div style={{fontWeight:700,color:C.white,fontSize:14,marginBottom:2}}>{label}</div><div style={{fontSize:12,color:C.muted}}>{desc}</div></div>
              <Btn label={exporting===id?'Exporting…':'⬇ Export CSV'} variant="secondary" onClick={action} loading={exporting===id} disabled={!!exporting}/>
            </Row>
          </Card>
        ))}
      </div>
      <div style={{marginTop:24,background:`${C.c1}10`,border:`1px solid ${C.c1}30`,borderRadius:10,padding:'14px 18px'}}>
        <div style={{fontWeight:700,color:C.c3,fontSize:13,marginBottom:4}}>PDF Reports — Coming in Phase 4</div>
        <p style={{fontSize:12,color:C.muted}}>Branded athlete progress reports with charts, PBs, and training history will be available as PDF exports in an upcoming release.</p>
      </div>
    </div>
  )
}

// ─── TESTING REPORTS ─────────────────────────────────────────────────────────
function TestingReportsPage({ clients, token, go }) {
  const [tests, setTests] = useState([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [f, setF] = useState({client_id:'',test_name:'',value:'',unit:'',notes:'',tested_at:new Date().toISOString().split('T')[0]})
  const ff = k => v => setF(p=>({...p,[k]:v}))
  const TEST_NAMES = ['10m Sprint','20m Sprint','30m Sprint','505 COD','Broad Jump','CMJ','Squat Jump','3RM Back Squat','3RM Deadlift','Bench 1RM','Chin-Up Max Reps','Beep Test','1km Time Trial','VO2 Max (estimated)','HRV','Custom']

  useEffect(()=>{
    ;(async()=>{
      setLoading(true)
      try{ const r=await sb.get('fitness_tests','select=*&order=tested_at.desc',token); setTests(Array.isArray(r)?r:[]) }
      catch{ setTests([]) }
      setLoading(false)
    })()
  },[])

  const save = async () => {
    if(!f.client_id||!f.test_name||!f.value) return
    try{
      const r=await sb.post('fitness_tests',{...f,value:parseFloat(f.value),coach_id:null},token)
      if(r?.id) setTests(p=>[r,...p])
      setAdding(false); setF({client_id:'',test_name:'',value:'',unit:'',notes:'',tested_at:new Date().toISOString().split('T')[0]})
    }catch(e){alert('Save failed — run the SQL migration for fitness_tests table first.')}
  }
  const del = async id => { if(!window.confirm('Delete test result?'))return; await sb.del('fitness_tests',id,token); setTests(p=>p.filter(t=>t.id!==id)) }

  const clientOpts = [{v:'',l:'— Select Athlete —'},...clients.filter(c=>c.status==='active').map(c=>({v:c.id,l:c.name}))]
  return(
    <div style={{padding:20,maxWidth:900,margin:'0 auto'}}>
      <Row style={{alignItems:'center',justifyContent:'space-between',marginBottom:16,flexWrap:'wrap',gap:10}}>
        <div><h1 style={{fontSize:22,fontWeight:700,color:C.white,fontFamily:'Space Grotesk,sans-serif',marginBottom:2}}>TESTING REPORTS</h1><p style={{fontSize:13,color:C.muted}}>Log and track fitness test results</p></div>
        {!adding&&<Btn label="+ Add Result" onClick={()=>setAdding(true)}/>}
      </Row>
      {adding&&(
        <Panel style={{marginBottom:16}}>
          <h3 style={{color:C.white,marginBottom:12}}>New Test Result</h3>
          <G2 style={{marginBottom:10}}>
            <SI label="Athlete *" value={f.client_id} onChange={ff('client_id')} options={clientOpts}/>
            <SI label="Test *" value={f.test_name} onChange={ff('test_name')} options={[{v:'',l:'— Select Test —'},...TEST_NAMES.map(n=>({v:n,l:n}))]}/>
          </G2>
          <G3 style={{marginBottom:10}}>
            <TI label="Result *" value={f.value} onChange={ff('value')} placeholder="e.g. 1.85" type="number"/>
            <TI label="Unit" value={f.unit} onChange={ff('unit')} placeholder="e.g. s, m, kg, cm"/>
            <TI label="Date" value={f.tested_at} onChange={ff('tested_at')} type="date"/>
          </G3>
          <div style={{marginBottom:12}}><TA label="Notes" value={f.notes} onChange={ff('notes')} rows={2}/></div>
          <Row><Btn label="Save Result" onClick={save} disabled={!f.client_id||!f.test_name||!f.value}/><Btn label="Cancel" variant="secondary" onClick={()=>setAdding(false)}/></Row>
        </Panel>
      )}
      {loading&&<div style={{textAlign:'center',padding:40,color:C.muted}}><Spin/></div>}
      {!loading&&tests.length===0&&!adding&&(
        <Card style={{textAlign:'center',padding:40}}>
          <p style={{color:C.muted,marginBottom:12}}>No test results yet.</p>
          <p style={{fontSize:12,color:C.faint,marginBottom:16}}>Run the SQL migration for <code style={{color:C.amber}}>fitness_tests</code> table to enable testing.</p>
          <Btn label="+ Add First Result" small onClick={()=>setAdding(true)}/>
        </Card>
      )}
      {tests.length>0&&(
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead><tr style={{borderBottom:`1px solid ${C.border}`}}>{['Date','Athlete','Test','Result','Notes',''].map(h=>(<th key={h} style={{textAlign:'left',padding:'7px 10px',fontSize:9,color:C.amber,textTransform:'uppercase',letterSpacing:'0.06em',fontWeight:700}}>{h}</th>))}</tr></thead>
            <tbody>
              {tests.map(t=>{const c=clients.find(cl=>cl.id===t.client_id);return(
                <tr key={t.id} style={{borderBottom:`1px solid ${C.border}`}}>
                  <td style={{padding:'8px 10px',color:C.muted,fontSize:12,whiteSpace:'nowrap'}}>{new Date(t.tested_at+'T00:00:00').toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'numeric'})}</td>
                  <td style={{padding:'8px 10px',color:C.white,fontWeight:600}}>{c?.name||'—'}</td>
                  <td style={{padding:'8px 10px',color:C.white}}>{t.test_name}</td>
                  <td style={{padding:'8px 10px',color:C.amber,fontWeight:700}}>{t.value} <span style={{color:C.muted,fontWeight:400,fontSize:11}}>{t.unit}</span></td>
                  <td style={{padding:'8px 10px',color:C.dim,fontSize:12,maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{t.notes||'—'}</td>
                  <td style={{padding:'8px 10px'}}><button onClick={()=>del(t.id)} style={{background:'none',border:'none',color:C.faint,cursor:'pointer',fontSize:12}}>✕</button></td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── GROUPS (label-based grouping) ────────────────────────────────────────────
function GroupsPage({ clients, programs, sessions, go, updateClient }) {
  const groups = [...new Set(clients.filter(c=>c.group_label).map(c=>c.group_label))].sort()
  const [editing, setEditing] = useState(null)
  const [newLabel, setNewLabel] = useState('')
  const ungrouped = clients.filter(c=>c.status==='active'&&!c.group_label)
  return(
    <div style={{padding:20,maxWidth:900,margin:'0 auto'}}>
      <h1 style={{fontSize:22,fontWeight:700,color:C.white,fontFamily:'Space Grotesk,sans-serif',marginBottom:4}}>GROUPS</h1>
      <p style={{fontSize:13,color:C.muted,marginBottom:20}}>Organise athletes by group or training cohort</p>
      <div style={{marginBottom:20}}>
        <SL>Assign Group Labels</SL>
        <p style={{fontSize:12,color:C.faint,marginBottom:12}}>Click an athlete's group label to edit it. Groups are created automatically when you assign a label.</p>
        <div style={{display:'flex',flexDirection:'column',gap:6}}>
          {clients.filter(c=>c.status==='active').map(c=>(
            <div key={c.id} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:'8px 14px',display:'flex',alignItems:'center',gap:12}}>
              <div style={{width:32,height:32,borderRadius:'50%',background:`${C.c1}30`,color:C.c3,fontSize:12,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{c.name[0]}</div>
              <span style={{flex:1,fontSize:13,color:C.white,fontWeight:600,cursor:'pointer'}} onClick={()=>go('client',{clientId:c.id})}>{c.name}</span>
              {editing===c.id
                ? <Row style={{gap:6,flexWrap:'wrap'}}>
                    {groups.length>0&&<select value="" onChange={e=>{if(e.target.value)setNewLabel(e.target.value)}} style={{...iS,width:135,cursor:'pointer'}}><option value="">Pick existing…</option>{groups.map(g=><option key={g} value={g}>{g}</option>)}</select>}
                    <input value={newLabel} onChange={e=>setNewLabel(e.target.value)} placeholder="New group name…" style={{...iS,width:150}} autoFocus/>
                    <Btn label="Save" small onClick={()=>{updateClient(c.id,{group_label:newLabel.trim()||null});setEditing(null)}}/>
                    <Btn label="Cancel" variant="secondary" small onClick={()=>setEditing(null)}/>
                  </Row>
                : <button onClick={()=>{setEditing(c.id);setNewLabel(c.group_label||'')}} style={{background:c.group_label?`${C.c2}20`:`${C.white}08`,border:`1px solid ${c.group_label?C.c2:C.border}`,borderRadius:6,padding:'3px 10px',color:c.group_label?C.c3:C.faint,fontSize:11,cursor:'pointer'}}>
                    {c.group_label||'+ Add group'}
                  </button>
              }
            </div>
          ))}
        </div>
      </div>
      {groups.length>0&&(
        <div>
          <SL>Groups ({groups.length})</SL>
          {groups.map(grp=>{
            const members=clients.filter(c=>c.group_label===grp&&c.status==='active')
            return(
              <Card key={grp} style={{marginBottom:10}}>
                <Row style={{alignItems:'center',marginBottom:10}}>
                  <span style={{fontWeight:700,color:C.c3,fontSize:15,flex:1}}>{grp}</span>
                  <span style={{fontSize:12,color:C.muted}}>{members.length} athletes</span>
                </Row>
                <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                  {members.map(c=>(
                    <button key={c.id} onClick={()=>go('client',{clientId:c.id})} style={{background:`${C.c2}15`,border:`1px solid ${C.c2}40`,borderRadius:20,padding:'4px 12px',color:C.c3,fontSize:12,cursor:'pointer',fontWeight:500}}>{c.name}</button>
                  ))}
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── EVENTS / SCHEDULER ───────────────────────────────────────────────────────
function EventsPage({ token }) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [f, setF] = useState({title:'',event_type:'testing',description:'',event_date:''})
  const EVENT_TYPES = ['testing','competition','assessment','team_meeting','camp','other']

  useEffect(()=>{
    ;(async()=>{
      try{ const r=await sb.get('coach_events','select=*&order=event_date.asc',token); setEvents(Array.isArray(r)?r:[]) }
      catch{ setEvents([]) }
      setLoading(false)
    })()
  },[])

  const save = async () => {
    if(!f.title||!f.event_date) return
    try{
      const r=await sb.post('coach_events',f,token)
      if(r?.id) setEvents(p=>[...p,r].sort((a,b)=>a.event_date.localeCompare(b.event_date)))
      setAdding(false); setF({title:'',event_type:'testing',description:'',event_date:''})
    }catch{ alert('Save failed — run SQL migration for coach_events table') }
  }
  const del = async id => { if(!window.confirm('Delete event?'))return; await sb.del('coach_events',id,token); setEvents(p=>p.filter(e=>e.id!==id)) }
  const TYPE_COLORS = {testing:C.amber,competition:C.gold,assessment:C.c2,team_meeting:C.green,camp:C.purple,other:C.muted}

  return(
    <div style={{padding:20,maxWidth:800,margin:'0 auto'}}>
      <Row style={{alignItems:'center',justifyContent:'space-between',marginBottom:16,flexWrap:'wrap',gap:10}}>
        <div><h1 style={{fontSize:22,fontWeight:700,color:C.white,fontFamily:'Space Grotesk,sans-serif',marginBottom:2}}>EVENTS</h1><p style={{fontSize:13,color:C.muted}}>Testing days, competitions, and team events</p></div>
        {!adding&&<Btn label="+ Add Event" onClick={()=>setAdding(true)}/>}
      </Row>
      {adding&&(
        <Panel style={{marginBottom:16}}>
          <h3 style={{color:C.white,marginBottom:12}}>New Event</h3>
          <G2 style={{marginBottom:10}}>
            <TI label="Title *" value={f.title} onChange={v=>setF(p=>({...p,title:v}))} placeholder="Testing Day"/>
            <SI label="Type" value={f.event_type} onChange={v=>setF(p=>({...p,event_type:v}))} options={EVENT_TYPES.map(t=>({v:t,l:t[0].toUpperCase()+t.slice(1).replace('_',' ')}))}/>
          </G2>
          <G2 style={{marginBottom:10}}>
            <TI label="Date *" value={f.event_date} onChange={v=>setF(p=>({...p,event_date:v}))} type="date"/>
            <TI label="Description" value={f.description} onChange={v=>setF(p=>({...p,description:v}))} placeholder="Details…"/>
          </G2>
          <Row><Btn label="Save Event" onClick={save} disabled={!f.title||!f.event_date}/><Btn label="Cancel" variant="secondary" onClick={()=>setAdding(false)}/></Row>
        </Panel>
      )}
      {loading&&<div style={{textAlign:'center',padding:40}}><Spin/></div>}
      {!loading&&events.length===0&&!adding&&<Card style={{textAlign:'center',padding:40}}><p style={{color:C.muted,marginBottom:12}}>No events scheduled.</p><Btn label="+ Add Event" small onClick={()=>setAdding(true)}/></Card>}
      <div style={{display:'flex',flexDirection:'column',gap:8}}>
        {events.map(ev=>{
          const color=TYPE_COLORS[ev.event_type]||C.muted
          const isPast=new Date(ev.event_date+'T00:00:00')<new Date()
          return(
            <div key={ev.id} style={{background:C.card,border:`1px solid ${isPast?C.border:color+'40'}`,borderRadius:10,padding:'12px 16px',opacity:isPast?0.6:1,display:'flex',alignItems:'center',gap:14}}>
              <div style={{width:48,textAlign:'center',flexShrink:0}}>
                <div style={{fontSize:18,fontWeight:700,color:isPast?C.muted:color}}>{new Date(ev.event_date+'T00:00:00').getDate()}</div>
                <div style={{fontSize:10,color:C.faint,textTransform:'uppercase'}}>{new Date(ev.event_date+'T00:00:00').toLocaleDateString('en-AU',{month:'short'})}</div>
              </div>
              <div style={{flex:1,minWidth:0}}>
                <Row style={{alignItems:'center',gap:8,marginBottom:2}}>
                  <span style={{fontWeight:700,color:C.white,fontSize:14}}>{ev.title}</span>
                  <Tag v={ev.event_type.replace('_',' ')} color={color} small/>
                  {isPast&&<Tag v="Past" color={C.faint} small/>}
                </Row>
                {ev.description&&<div style={{fontSize:12,color:C.muted}}>{ev.description}</div>}
              </div>
              <button onClick={()=>del(ev.id)} style={{background:'none',border:'none',color:C.faint,cursor:'pointer',fontSize:14,flexShrink:0}}>✕</button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANNOUNCEMENTS + TEAM UPDATES (Supabase-backed)
// SQL MIGRATION — run in Supabase SQL Editor before using these pages:
//
// create table announcements (
//   id uuid default gen_random_uuid() primary key,
//   coach_id uuid references auth.users not null,
//   title text not null, body text default '',
//   is_pinned boolean default false, target text default 'all',
//   created_at timestamptz default now()
// );
// alter table announcements enable row level security;
// create policy "coaches_own" on announcements for all using (coach_id = auth.uid());
//
// create table coach_events (
//   id uuid default gen_random_uuid() primary key,
//   coach_id uuid references auth.users not null,
//   title text not null, event_type text default 'other',
//   event_date date not null, description text default '',
//   created_at timestamptz default now()
// );
// alter table coach_events enable row level security;
// create policy "coaches_own" on coach_events for all using (coach_id = auth.uid());
//
// create table fitness_tests (
//   id uuid default gen_random_uuid() primary key,
//   client_id uuid references clients, coach_id uuid references auth.users,
//   test_name text not null, value numeric, unit text, notes text,
//   tested_at date default current_date, created_at timestamptz default now()
// );
// alter table fitness_tests enable row level security;
// create policy "coaches_own" on fitness_tests for all using (coach_id = auth.uid());
//
// create table coach_settings (
//   coach_id uuid references auth.users primary key,
//   data jsonb default '{}', updated_at timestamptz default now()
// );
// alter table coach_settings enable row level security;
// create policy "coaches_own_settings" on coach_settings for all using (coach_id = auth.uid());
// ═══════════════════════════════════════════════════════════════════════════════

function AnnouncementsPage({ token }) {
  const [items, setItems]   = useState([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [f, setF] = useState({title:'',body:'',is_pinned:false,target:'all'})

  useEffect(()=>{
    ;(async()=>{
      try{ const r=await sb.get('announcements','select=*&order=is_pinned.desc,created_at.desc',token); setItems(Array.isArray(r)?r:[]) }
      catch{ setItems([]) }
      setLoading(false)
    })()
  },[])

  const save = async () => {
    if(!f.title.trim()) return
    try{
      const r=await sb.post('announcements',f,token)
      if(r?.id) setItems(p=>[r,...p].sort((a,b)=>(b.is_pinned?1:0)-(a.is_pinned?1:0)||(new Date(b.created_at)-new Date(a.created_at))))
      setAdding(false); setF({title:'',body:'',is_pinned:false,target:'all'})
    }catch{ alert('Save failed — run the SQL migration for announcements table first (shown in code comment).') }
  }

  const del = async id => {
    if(!window.confirm('Delete this announcement?')) return
    await sb.del('announcements',id,token); setItems(p=>p.filter(a=>a.id!==id))
  }

  const pin = async (item) => {
    const next={...item,is_pinned:!item.is_pinned}
    await sb.patch('announcements',item.id,{is_pinned:next.is_pinned},token)
    setItems(p=>p.map(a=>a.id===item.id?next:a).sort((a,b)=>(b.is_pinned?1:0)-(a.is_pinned?1:0)))
  }

  return(
    <div style={{padding:20,maxWidth:800,margin:'0 auto'}}>
      <Row style={{alignItems:'center',justifyContent:'space-between',marginBottom:16,flexWrap:'wrap',gap:10}}>
        <div>
          <h1 style={{fontSize:22,fontWeight:700,color:C.white,fontFamily:'Space Grotesk,sans-serif',marginBottom:2}}>ANNOUNCEMENTS</h1>
          <p style={{fontSize:13,color:C.muted}}>Post updates visible to all athletes</p>
        </div>
        {!adding&&<Btn label="+ New Post" onClick={()=>setAdding(true)}/>}
      </Row>

      {adding&&(
        <Panel style={{marginBottom:16}}>
          <h3 style={{color:C.white,marginBottom:12}}>New Announcement</h3>
          <div style={{marginBottom:10}}><TI label="Title *" value={f.title} onChange={v=>setF(p=>({...p,title:v}))} placeholder="Week 3 Program Update"/></div>
          <div style={{marginBottom:10}}><TA label="Message" value={f.body} onChange={v=>setF(p=>({...p,body:v}))} rows={4} placeholder="Write your announcement here…"/></div>
          <G2 style={{marginBottom:12}}>
            <SI label="Target" value={f.target} onChange={v=>setF(p=>({...p,target:v}))} options={[{v:'all',l:'All Athletes'},{v:'active',l:'Active Only'}]}/>
            <div style={{display:'flex',alignItems:'center',gap:8,paddingTop:22}}>
              <input type="checkbox" checked={f.is_pinned} onChange={e=>setF(p=>({...p,is_pinned:e.target.checked}))} style={{accentColor:C.amber,width:14,height:14}}/>
              <span style={{fontSize:13,color:C.muted}}>Pin to top</span>
            </div>
          </G2>
          <Row><Btn label="Post" onClick={save} disabled={!f.title.trim()}/><Btn label="Cancel" variant="secondary" onClick={()=>setAdding(false)}/></Row>
        </Panel>
      )}

      {loading&&<div style={{textAlign:'center',padding:40}}><Spin/></div>}
      {!loading&&items.length===0&&!adding&&(
        <Card style={{textAlign:'center',padding:40}}>
          <p style={{color:C.muted,marginBottom:12}}>No announcements yet.</p>
          <p style={{fontSize:12,color:C.faint,marginBottom:16}}>Make sure you've run the SQL migration to create the announcements table.</p>
          <Btn label="+ New Post" small onClick={()=>setAdding(true)}/>
        </Card>
      )}

      <div style={{display:'flex',flexDirection:'column',gap:10}}>
        {items.map(item=>(
          <div key={item.id} style={{background:C.card,border:`1px solid ${item.is_pinned?`${C.amber}50`:C.border}`,borderRadius:10,padding:'14px 16px'}}>
            <Row style={{alignItems:'flex-start',gap:12}}>
              <div style={{flex:1,minWidth:0}}>
                <Row style={{alignItems:'center',gap:8,marginBottom:4,flexWrap:'wrap'}}>
                  {item.is_pinned&&<Icon name="pin" size={12} color={C.amber} style={{marginRight:2}}/>}
                  <span style={{fontWeight:700,color:C.white,fontSize:15}}>{item.title}</span>
                  <Tag v={item.target==='all'?'All Athletes':'Active'} color={C.c2} small/>
                </Row>
                {item.body&&<p style={{fontSize:13,color:C.muted,lineHeight:1.6,marginBottom:8}}>{item.body}</p>}
                <div style={{fontSize:11,color:C.faint}}>Posted {new Date(item.created_at).toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}</div>
              </div>
              <Row style={{gap:5,flexShrink:0}}>
                <button onClick={()=>pin(item)} title={item.is_pinned?'Unpin':'Pin to top'} style={{background:`${item.is_pinned?C.amber:'transparent'}20`,border:`1px solid ${item.is_pinned?C.amber:C.border}`,borderRadius:6,padding:'4px 8px',color:item.is_pinned?C.amber:C.faint,cursor:'pointer',fontSize:12,display:'flex',alignItems:'center'}}><Icon name="pin" size={13}/></button>
                <Btn label="✕" variant="danger" small onClick={()=>del(item.id)}/>
              </Row>
            </Row>
          </div>
        ))}
      </div>
    </div>
  )
}

// Team Updates — same as announcements, slightly different framing
function TeamUpdatesPage({ token }) {
  return <AnnouncementsPage token={token}/>
}

// ─── INTEGRATIONS / CONNECTED APPS / WEARABLES ───────────────────────────────
const INTEGRATION_LIST = [
  {name:'WHOOP',logo:'watch',desc:'Sync HRV, sleep quality, recovery scores and strain.',status:'coming'},
  {name:'Garmin',logo:'watch',desc:'Import training load, HR, GPS and sleep data.',status:'coming'},
  {name:'Apple Health',logo:'activity',desc:'Sync steps, HRV, resting HR and activity.',status:'coming'},
  {name:'Strava',logo:'activity',desc:'Import running and cycling sessions.',status:'coming'},
  {name:'VALD Performance',logo:'activity',desc:'Import ForceDecks, NordBord and HumanTrak data.',status:'coming'},
  {name:'GymAware',logo:'activity',desc:'Sync velocity-based training data.',status:'coming'},
  {name:'Catapult',logo:'link',desc:'GPS and load monitoring for team sports.',status:'coming'},
]

function IntegrationsPage() {
  return(
    <div style={{padding:20,maxWidth:800,margin:'0 auto'}}>
      <h1 style={{fontSize:22,fontWeight:700,color:C.white,fontFamily:'Space Grotesk,sans-serif',marginBottom:4}}>INTEGRATIONS</h1>
      <p style={{fontSize:13,color:C.muted,marginBottom:24}}>Connect external platforms and devices to your coaching dashboard</p>
      <div style={{display:'flex',flexDirection:'column',gap:10}}>
        {INTEGRATION_LIST.map(({name,logo,desc,status})=>(
          <Card key={name} style={{padding:'14px 18px'}}>
            <Row style={{alignItems:'center',gap:14}}>
              <div style={{display:'flex',justifyContent:'center',flexShrink:0,width:44,color:C.c3}}><Icon name={logo} size={24}/></div>
              <div style={{flex:1,minWidth:0}}>
                <Row style={{alignItems:'center',gap:8,marginBottom:2}}><span style={{fontWeight:700,color:C.white,fontSize:14}}>{name}</span><Tag v="Coming Soon" color={C.c3} small/></Row>
                <div style={{fontSize:12,color:C.muted}}>{desc}</div>
              </div>
              <button disabled style={{background:`${C.white}08`,border:`1px solid ${C.border}`,borderRadius:8,padding:'6px 16px',color:C.dim,fontSize:12,cursor:'not-allowed',opacity:0.6}}>Connect</button>
            </Row>
          </Card>
        ))}
      </div>
      <div style={{marginTop:20,background:`${C.c1}10`,border:`1px solid ${C.c1}30`,borderRadius:10,padding:'14px 18px'}}>
        <div style={{fontWeight:700,color:C.c3,fontSize:13,marginBottom:4}}>CSV Import Available Now</div>
        <p style={{fontSize:12,color:C.muted,marginBottom:10}}>Import historical Google Sheets programs using the CSV Import tool available under Strength → CSV Import.</p>
        <Tag v="Available" color={C.green}/>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// SETTINGS PAGE
// ═══════════════════════════════════════════════════════════════════════════════

const DEFAULT_SETTINGS_OBJ = {
  // Appearance
  accentColor:'#FFA500', appName:"Coach'd By Gee", density:'standard',
  // Strength
  e1rmFormula:'Epley', e1rmMaxReps:15, enableBuiltInLib:true,
  // Training Load
  acutePeriod:7, chronicPeriod:28, trainingLoadEnabled:false,
  acwrFormula:'ACWR Uncoupled', sessionWeighting:'Weighted',
  // Notifications
  notifyMissedSessions:true, notifyPbs:true, notifyFlags:true,
  notifyReadiness:true, notifyComments:true,
  // Operations
  weekStartDay:'Monday', defaultSessionDuration:60,
  // Profile
  coachName:'', coachEmail:'', coachBio:'',
}

const SETTINGS_SECTIONS = [
  {id:'appearance', label:'Appearance',     icon:'palette'},
  {id:'strength',   label:'Strength',       icon:'dumbbell'},
  {id:'load',       label:'Training Load',  icon:'activity'},
  {id:'profile',    label:'Coach Profile',  icon:'user'},
  {id:'notifications',label:'Notifications',icon:'bell'},
  {id:'operations', label:'Operations',     icon:'sliders'},
  {id:'admin',      label:'Admin Tools',    icon:'wrench'},
]

const ACCENT_PRESETS = [
  {name:'Amber (Default)', color:'#FFA500'},
  {name:'Cobalt Blue',     color:'#2563EB'},
  {name:'Teal',            color:'#14B8A6'},
  {name:'Purple',          color:'#8B5CF6'},
  {name:'Red',             color:'#EF4444'},
  {name:'Green',           color:'#22C55E'},
  {name:'Pink',            color:'#EC4899'},
  {name:'Custom',          color:'custom'},
]

function Toggle({ value, onChange, label, sublabel, disabled }) {
  return(
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 0',borderBottom:`1px solid ${C.border}`}}>
      <div style={{flex:1}}>
        <div style={{fontSize:13,color:disabled?C.faint:C.white,fontWeight:500}}>{label}</div>
        {sublabel&&<div style={{fontSize:11,color:C.faint,marginTop:1}}>{sublabel}</div>}
      </div>
      <button
        onClick={()=>!disabled&&onChange(!value)}
        disabled={disabled}
        style={{
          width:44,height:24,borderRadius:12,border:'none',
          background:value?C.amber:'rgba(255,255,255,0.15)',
          cursor:disabled?'not-allowed':'pointer',
          position:'relative',transition:'background 0.2s',
          opacity:disabled?0.4:1,flexShrink:0,
        }}>
        <span style={{
          position:'absolute',top:3,left:value?22:3,
          width:18,height:18,borderRadius:'50%',background:C.white,
          transition:'left 0.2s',boxShadow:'0 1px 3px rgba(0,0,0,0.3)',
        }}/>
      </button>
    </div>
  )
}

function SettingRow({ label, sublabel, children }) {
  return(
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:16,padding:'10px 0',borderBottom:`1px solid ${C.border}`}}>
      <div style={{flex:1}}>
        <div style={{fontSize:13,color:C.white,fontWeight:500}}>{label}</div>
        {sublabel&&<div style={{fontSize:11,color:C.faint,marginTop:1}}>{sublabel}</div>}
      </div>
      <div style={{flexShrink:0}}>{children}</div>
    </div>
  )
}

function SettingsPage({ token }) {
  const [s, setS] = useState(() => {
    try { return { ...DEFAULT_SETTINGS_OBJ, ...JSON.parse(localStorage.getItem('cgee_settings') || '{}') } }
    catch { return DEFAULT_SETTINGS_OBJ }
  })
  const [section, setSection] = useState('appearance')
  const [saved, setSaved] = useState(false)
  const [customColor, setCustomColor] = useState(s.accentColor||'#FFA500')

  const save = (key, val) => {
    const next = { ...s, [key]: val }
    setS(next)
    localStorage.setItem('cgee_settings', JSON.stringify(next))
    // Update module-level variables immediately (no reload needed for these)
    if(key === 'e1rmFormula'){ _e1rmFormula = val; window.dispatchEvent(new CustomEvent('cgee-reg-changed')) }
    if(key === 'e1rmMaxReps'){ _e1rmMaxReps = parseInt(val); window.dispatchEvent(new CustomEvent('cgee-reg-changed')) }
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  const sI = ({label,value,onChange,options,style}) => (
    <select value={value||''} onChange={e=>onChange(e.target.value)} style={{...iS,width:'auto',minWidth:160,cursor:'pointer',...style}}>
      {options.map(o=><option key={o.v??o} value={o.v??o}>{o.l??o}</option>)}
    </select>
  )

  const panels = {
    appearance: (
      <div>
        <div style={{marginBottom:6,fontSize:11,fontWeight:700,color:C.amber,textTransform:'uppercase',letterSpacing:'0.1em'}}>Appearance</div>
        <p style={{fontSize:12,color:C.faint,marginBottom:16}}>Visual preferences. Accent color and density take effect on next page load.</p>
        <SettingRow label="Accent Color" sublabel="Primary action and highlight color">
          <div style={{display:'flex',gap:6,flexWrap:'wrap',justifyContent:'flex-end'}}>
            {ACCENT_PRESETS.filter(p=>p.color!=='custom').map(p=>(
              <button key={p.color} onClick={()=>{setCustomColor(p.color);save('accentColor',p.color)}} title={p.name}
                style={{width:24,height:24,borderRadius:'50%',background:p.color,border:`2px solid ${s.accentColor===p.color?C.white:'transparent'}`,cursor:'pointer',flexShrink:0,transition:'border-color 0.15s'}}/>
            ))}
            <div style={{display:'flex',alignItems:'center',gap:6}}>
              <input type="color" value={customColor} onChange={e=>setCustomColor(e.target.value)} onBlur={()=>save('accentColor',customColor)} style={{width:24,height:24,borderRadius:'50%',border:`2px solid ${!ACCENT_PRESETS.find(p=>p.color===s.accentColor)?C.white:'transparent'}`,cursor:'pointer',background:'transparent',padding:0}}/>
              <span style={{fontSize:10,color:C.faint}}>Custom</span>
            </div>
          </div>
        </SettingRow>
        <SettingRow label="App Name" sublabel="Displayed in the sidebar and topbar">
          <input value={s.appName||''} onChange={e=>save('appName',e.target.value)} style={{...iS,width:200}} placeholder="Coach'd By Gee"/>
        </SettingRow>
        <SettingRow label="Dashboard Density" sublabel="Card spacing and padding">
          <div style={{display:'flex',gap:6}}>
            {['compact','standard','spacious'].map(d=>(
              <button key={d} onClick={()=>save('density',d)} style={{padding:'4px 12px',borderRadius:6,border:`1.5px solid ${s.density===d?C.amber:C.border}`,background:s.density===d?`${C.amber}15`:'transparent',color:s.density===d?C.amber:C.muted,fontSize:11,fontWeight:600,cursor:'pointer',textTransform:'capitalize'}}>{d}</button>
            ))}
          </div>
        </SettingRow>
        <div style={{marginTop:16,background:`${C.orange}10`,border:`1px solid ${C.orange}30`,borderRadius:8,padding:'10px 14px'}}>
          <div style={{fontSize:12,color:C.orange,fontWeight:600,marginBottom:2}}>Color and density update on next page load</div>
          <div style={{fontSize:11,color:C.faint}}>Settings are saved immediately. Hard refresh (Cmd+Shift+R) to see full effect.</div>
        </div>
      </div>
    ),
    strength: (
      <div>
        <div style={{marginBottom:6,fontSize:11,fontWeight:700,color:C.amber,textTransform:'uppercase',letterSpacing:'0.1em'}}>Strength Settings</div>
        <p style={{fontSize:12,color:C.faint,marginBottom:16}}>e1RM formula changes take effect <strong style={{color:C.white}}>immediately</strong> on all current and future calculations.</p>
        <SettingRow label="1RM Formula" sublabel={`Currently: ${s.e1rmFormula}. Formula: ${s.e1rmFormula==='Epley'?'load × (1 + reps/30)':s.e1rmFormula==='Brzycki'?'load × 36 / (37 − reps)':s.e1rmFormula}`}>
          <select value={s.e1rmFormula} onChange={e=>save('e1rmFormula',e.target.value)} style={{...iS,width:160,cursor:'pointer'}}>
            {E1RM_FORMULAS.map(f=><option key={f} value={f}>{f}</option>)}
          </select>
        </SettingRow>
        <SettingRow label="Max Reps for 1RM Calculation" sublabel="Sets above this rep count are excluded from e1RM (prevents inaccurate estimates)">
          <input type="number" value={s.e1rmMaxReps} min={1} max={50} onChange={e=>save('e1rmMaxReps',parseInt(e.target.value))} style={{...iS,width:80,textAlign:'center'}}/>
        </SettingRow>
        <Toggle value={s.enableBuiltInLib} onChange={v=>save('enableBuiltInLib',v)} label="Enable Built-In Exercise Library" sublabel="Show default exercises in the search when adding to sessions"/>
        <div style={{marginTop:16,background:`${C.green}10`,border:`1px solid ${C.green}30`,borderRadius:8,padding:'10px 14px'}}>
          <div style={{fontSize:12,color:C.green,fontWeight:600}}>✓ e1RM formula is live — changes affect the next calculation, no reload needed</div>
        </div>
        <div style={{marginTop:12}}>
          <div style={{fontSize:11,color:C.faint,marginBottom:8,textTransform:'uppercase',letterSpacing:'0.06em'}}>Formula Preview (100kg × 5 reps)</div>
          <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
            {E1RM_FORMULAS.map(f=>{
              let v
              const w=100,r=5
              switch(f){
                case 'Brzycki': v=Math.round(w*(36/(37-r))*10)/10; break
                case 'Epley':   v=Math.round(w*(1+r/30)*10)/10; break
                case 'Lander':  v=Math.round(100*w/(101.3-2.67123*r)*10)/10; break
                case 'Lombardi':v=Math.round(w*Math.pow(r,0.1)*10)/10; break
                case 'Mayhew':  v=Math.round(100*w/(52.2+41.9*Math.exp(-0.055*r))*10)/10; break
                case 'OConner': v=Math.round(w*(1+r/40)*10)/10; break
                case 'Wathan':  v=Math.round(100*w/(48.8+53.8*Math.exp(-0.075*r))*10)/10; break
                default: v=Math.round(w*(1+r/30)*10)/10
              }
              return <span key={f} style={{fontSize:11,background:s.e1rmFormula===f?`${C.amber}18`:`${C.white}06`,border:`1px solid ${s.e1rmFormula===f?C.amber:C.border}`,borderRadius:6,padding:'3px 10px',color:s.e1rmFormula===f?C.amber:C.muted,whiteSpace:'nowrap'}}>{f}: {v}kg</span>
            })}
          </div>
        </div>
      </div>
    ),
    load: (
      <div>
        <div style={{marginBottom:6,fontSize:11,fontWeight:700,color:C.amber,textTransform:'uppercase',letterSpacing:'0.1em'}}>Training Load</div>
        <Toggle value={s.trainingLoadEnabled} onChange={v=>save('trainingLoadEnabled',v)} label="Enable Training Load Monitoring" sublabel="ACWR, TSB, and load balance calculations"/>
        <SettingRow label="Acute Period (days)" sublabel="Short-term load window (default: 7 days)">
          <input type="number" value={s.acutePeriod} min={3} max={14} onChange={e=>save('acutePeriod',parseInt(e.target.value))} style={{...iS,width:80,textAlign:'center'}}/>
        </SettingRow>
        <SettingRow label="Chronic Period (days)" sublabel="Long-term load window (default: 28 days)">
          <input type="number" value={s.chronicPeriod} min={14} max={42} onChange={e=>save('chronicPeriod',parseInt(e.target.value))} style={{...iS,width:80,textAlign:'center'}}/>
        </SettingRow>
        <SettingRow label="ACWR Formula" sublabel="Method for calculating acute:chronic workload ratio">
          <select value={s.acwrFormula||'ACWR Uncoupled'} onChange={e=>save('acwrFormula',e.target.value)} style={{...iS,width:200,cursor:'pointer'}}>
            {['ACWR Coupled','ACWR Uncoupled','Load Delta (CTL−ATL)','TSB'].map(f=><option key={f} value={f}>{f}</option>)}
          </select>
        </SettingRow>
        <SettingRow label="Session Weighting" sublabel="How session load is calculated">
          <div style={{display:'flex',gap:6}}>
            {['Weighted','Unweighted'].map(w=>(
              <button key={w} onClick={()=>save('sessionWeighting',w)} style={{padding:'4px 12px',borderRadius:6,border:`1.5px solid ${s.sessionWeighting===w?C.amber:C.border}`,background:s.sessionWeighting===w?`${C.amber}15`:'transparent',color:s.sessionWeighting===w?C.amber:C.muted,fontSize:11,cursor:'pointer'}}>{w}</button>
            ))}
          </div>
        </SettingRow>
        <div style={{marginTop:16,background:`${C.c1}10`,border:`1px solid ${C.c1}30`,borderRadius:8,padding:'10px 14px'}}>
          <div style={{fontSize:12,color:C.c3,fontWeight:600,marginBottom:2}}>Settings saved · Full ACWR dashboard activates in Phase 3</div>
          <div style={{fontSize:11,color:C.faint}}>These settings will automatically apply when athlete load monitoring data is collected via readiness check-ins.</div>
        </div>
      </div>
    ),
    profile: (
      <div>
        <div style={{marginBottom:6,fontSize:11,fontWeight:700,color:C.amber,textTransform:'uppercase',letterSpacing:'0.1em'}}>Coach Profile</div>
        <p style={{fontSize:12,color:C.faint,marginBottom:16}}>Saved locally. Synced to your Supabase session when available.</p>
        <div style={{marginBottom:10}}><TI label="Display Name" value={s.coachName||''} onChange={v=>save('coachName',v)} placeholder="Georgie Fowler"/></div>
        <div style={{marginBottom:10}}><TI label="Email" value={s.coachEmail||''} onChange={v=>save('coachEmail',v)} placeholder="gee@example.com" type="email"/></div>
        <div style={{marginBottom:16}}>
          <label style={lS}>Bio / Coach Note</label>
          <textarea value={s.coachBio||''} onChange={e=>save('coachBio',e.target.value)} rows={4} placeholder="Strength and conditioning coach specialising in…" style={{...iS,resize:'vertical'}}></textarea>
        </div>
        {s.coachName&&(
          <Card style={{background:`${C.c1}0d`,borderColor:`${C.c1}35`}}>
            <div style={{fontSize:11,color:C.faint,marginBottom:6}}>Preview</div>
            <Row style={{alignItems:'center',gap:12}}>
              <div style={{width:44,height:44,borderRadius:'50%',background:`linear-gradient(135deg,${C.amber},${C.gold})`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,fontWeight:700,color:C.bg,flexShrink:0}}>{s.coachName[0]?.toUpperCase()}</div>
              <div><div style={{fontWeight:700,color:C.white,fontSize:14}}>{s.coachName}</div><div style={{fontSize:12,color:C.muted}}>{s.coachEmail||'No email set'}</div></div>
            </Row>
          </Card>
        )}
      </div>
    ),
    notifications: (
      <div>
        <div style={{marginBottom:6,fontSize:11,fontWeight:700,color:C.amber,textTransform:'uppercase',letterSpacing:'0.1em'}}>Notifications</div>
        <p style={{fontSize:12,color:C.faint,marginBottom:4}}>Preferences saved to your browser. Push notifications require a service worker (Phase 4).</p>
        <div style={{marginBottom:16}}>
          <div style={{fontSize:11,color:C.faint,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:4,marginTop:12}}>In-App Alerts</div>
          <Toggle value={s.notifyMissedSessions} onChange={v=>save('notifyMissedSessions',v)} label="Missed Sessions" sublabel="Alert when an athlete misses a scheduled session"/>
          <Toggle value={s.notifyPbs} onChange={v=>save('notifyPbs',v)} label="Personal Bests" sublabel="Alert when an athlete hits a new PB"/>
          <Toggle value={s.notifyFlags} onChange={v=>save('notifyFlags',v)} label="Auto Flags" sublabel="Alert when a compliance or stall flag is raised"/>
          <Toggle value={s.notifyReadiness} onChange={v=>save('notifyReadiness',v)} label="Readiness Alerts" sublabel="Alert when readiness drops significantly (Phase 3)"/>
          <Toggle value={s.notifyComments} onChange={v=>save('notifyComments',v)} label="Athlete Comments" sublabel="Alert when an athlete adds a session note"/>
        </div>
        <div style={{background:`${C.c1}10`,border:`1px solid ${C.c1}30`,borderRadius:8,padding:'10px 14px'}}>
          <div style={{fontSize:12,color:C.c3,fontWeight:600,marginBottom:2}}>Push & Email Notifications — Phase 4</div>
          <div style={{fontSize:11,color:C.faint}}>SMS, push, and email delivery will be available in a future release. Your preferences are saved and ready.</div>
        </div>
      </div>
    ),
    operations: (
      <div>
        <div style={{marginBottom:6,fontSize:11,fontWeight:700,color:C.amber,textTransform:'uppercase',letterSpacing:'0.1em'}}>Operations</div>
        <SettingRow label="Week Start Day" sublabel="Affects calendar and load calculation windows">
          <select value={s.weekStartDay||'Monday'} onChange={e=>save('weekStartDay',e.target.value)} style={{...iS,width:140,cursor:'pointer'}}>
            {['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map(d=><option key={d} value={d}>{d}</option>)}
          </select>
        </SettingRow>
        <SettingRow label="Default Session Duration (min)" sublabel="Pre-filled when creating new sessions">
          <input type="number" value={s.defaultSessionDuration||60} min={15} max={240} step={5} onChange={e=>save('defaultSessionDuration',parseInt(e.target.value))} style={{...iS,width:80,textAlign:'center'}}/>
        </SettingRow>
        <Toggle value={s.enableAnnouncements!==false} onChange={v=>save('enableAnnouncements',v)} label="Enable Announcements" sublabel="Post team updates and announcements"/>
        <Toggle value={s.enableGroupChats||false} onChange={v=>save('enableGroupChats',v)} label="Enable Group Chats" sublabel="Direct messaging and group conversations (Phase 4)" disabled/>
      </div>
    ),
    admin: (
      <div>
        <div style={{marginBottom:6,fontSize:11,fontWeight:700,color:C.amber,textTransform:'uppercase',letterSpacing:'0.1em'}}>Admin Tools</div>
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {[
            {label:'Exercise Cleanup & Merge',desc:'Detect and merge duplicate exercise names across all sessions.',view:'cleanup',available:true},
            {label:'lbs → kg Converter',desc:'Scan all sessions for lbs-labelled loads and convert them to kg.',view:'lbs_convert',available:true},
            {label:'CSV Import',desc:'Import historical programs from Google Sheets CSV files.',view:'import',available:true},
            {label:'Audit Logs',desc:'View all data changes, imports, and deletions.',available:false},
            {label:'Deleted Items Recovery',desc:'Restore recently deleted programs, sessions, or athletes.',available:false},
            {label:'Cache Refresh',desc:'Clear and rebuild cached calculations.',available:false},
          ].map(({label,desc,view,available})=>(
            <div key={label} style={{background:C.ink,border:`1px solid ${C.border}`,borderRadius:8,padding:'12px 14px',opacity:available?1:0.5}}>
              <Row style={{alignItems:'center',gap:12}}>
                <div style={{flex:1}}>
                  <div style={{fontWeight:600,color:C.white,fontSize:13,marginBottom:2}}>{label}</div>
                  <div style={{fontSize:11,color:C.faint}}>{desc}</div>
                </div>
                {available&&view
                  ?<a href={`#${view}`} onClick={e=>{e.preventDefault();window.dispatchEvent(new CustomEvent('cgee-nav',{detail:view}))}} style={{background:`${C.amber}18`,border:`1px solid ${C.amber}40`,borderRadius:6,padding:'5px 14px',color:C.amber,fontSize:11,fontWeight:700,cursor:'pointer',textDecoration:'none'}}>Open</a>
                  :<span style={{fontSize:11,color:C.faint,background:`${C.white}06`,border:`1px solid ${C.border}`,borderRadius:6,padding:'5px 10px'}}>Phase 4</span>
                }
              </Row>
            </div>
          ))}
        </div>
      </div>
    ),
  }

  return(
    <div style={{maxWidth:1000,margin:'0 auto',display:'grid',gridTemplateColumns:'200px 1fr',minHeight:'60vh'}}>
      {/* Settings sidebar */}
      <div style={{background:C.ink,borderRight:`1px solid ${C.border}`,padding:'20px 0'}}>
        <div style={{padding:'0 16px 14px',fontSize:11,fontWeight:700,color:C.amber,textTransform:'uppercase',letterSpacing:'0.1em'}}>Settings</div>
        {SETTINGS_SECTIONS.map(({id,label,icon})=>(
          <button key={id} onClick={()=>setSection(id)} style={{display:'flex',alignItems:'center',gap:10,width:'100%',padding:'9px 16px',border:'none',borderLeft:`2px solid ${section===id?C.amber:'transparent'}`,background:section===id?`${C.amber}12`:'transparent',color:section===id?C.amber:C.muted,fontSize:13,cursor:'pointer',textAlign:'left',transition:'background 0.1s'}}>
            <Icon name={icon} size={15}/><span style={{fontWeight:section===id?600:400}}>{label}</span>
          </button>
        ))}
        {saved&&(
          <div style={{margin:'12px 16px 0',background:`${C.green}15`,border:`1px solid ${C.green}30`,borderRadius:6,padding:'5px 10px',fontSize:11,color:C.green,fontWeight:600,textAlign:'center'}}>
            ✓ Saved
          </div>
        )}
      </div>

      {/* Settings content */}
      <div style={{padding:'24px 28px',overflowY:'auto'}}>
        {panels[section]||<div style={{color:C.muted}}>Select a section</div>}
      </div>
    </div>
  )
}

// Admin panels (coaches, permissions, billing) — meaningful placeholders
function CoachesAdminPage() {
  return(
    <div style={{padding:20,maxWidth:700,margin:'0 auto'}}>
      <h1 style={{fontSize:22,fontWeight:700,color:C.white,fontFamily:'Space Grotesk,sans-serif',marginBottom:4}}>COACHES</h1>
      <p style={{fontSize:13,color:C.muted,marginBottom:20}}>Manage coach accounts and access levels</p>
      <Card style={{background:`${C.c1}0d`,borderColor:`${C.c1}35`,padding:24,textAlign:'center'}}>
        <div style={{display:'flex',justifyContent:'center',marginBottom:12}}><Icon name="users" size={32} color={C.c3}/></div>
        <div style={{fontWeight:700,color:C.white,fontSize:15,marginBottom:8}}>Multi-Coach Support</div>
        <p style={{fontSize:13,color:C.muted,lineHeight:1.7,marginBottom:16}}>Invite assistant coaches, assign athlete groups, and set permission levels. Each coach can have custom access to athletes, programs, and analytics.</p>
        <div style={{display:'flex',flexWrap:'wrap',gap:8,justifyContent:'center',marginBottom:16}}>
          {['Admin','Coach','Group Coach','Read-Only','Physio'].map(r=><Tag key={r} v={r} color={C.c3}/>)}
        </div>
        <Tag v="Launching Phase 4" color={C.amber}/>
      </Card>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// NAMING CONVENTION TOOL
// ═══════════════════════════════════════════════════════════════════════════════

const IMPLEMENT_OPTIONS = [
  '','BB','DB','KB','Landmine','Cable','Machine','BW',
  'Trap Bar','EZ Bar','Band','Sled','Med Ball','TRX','Smith Machine',
]

// Auto-parse existing name into {movement, implement, modifier, variation}
function autoParseExercise(raw) {
  let s = raw.trim()
  let implement = '', modifier = '', variation = ''

  // 1. Extract anything in (brackets) → variation
  const bracketMatch = s.match(/\(([^)]+)\)/)
  if(bracketMatch){ variation = bracketMatch[1].trim(); s = s.replace(/\s*\([^)]+\)/, '').trim() }

  // Learned generic word swaps (from your past renames) — whole-word, case-preserving, applied first
  const _ltw = getLearnedTerms().word || {}
  if(Object.keys(_ltw).length){
    s = s.replace(/[A-Za-z0-9]+/g, w => _ltw[w.toLowerCase()] || w)
  }

  // 2. Implement detection — multi-word first, then abbrevs
  const IMPL_PAIRS = [
    ['smith machine','Smith Machine'],['trap bar','Trap Bar'],['hex bar','Trap Bar'],
    ['ez bar','EZ Bar'],['ez-bar','EZ Bar'],
    ['med ball','Med Ball'],['medicine ball','Med Ball'],
    ['resistance band','Band'],
    ['kettlebell','KB'],['kettle bell','KB'],
    ['dumbbell','DB'],['dumbell','DB'],
    ['barbell','BB'],
    ['bodyweight','BW'],['body weight','BW'],
    ['landmine','Landmine'],
    ['machine','Machine'],
    ['cable','Cable'],['cable machine','Cable'],
    ['sled','Sled'],
    ['band','Band'],
    ['trx','TRX'],
  ]
  // Learned equipment vocabulary (from your past renames) — checked first, longest match wins
  const _lt = getLearnedTerms()
  const _learnedImpl = Object.keys(_lt.impl||{}).sort((a,b)=>b.length-a.length)
  for(const kw of _learnedImpl){
    if(!kw) continue
    const idx = s.toLowerCase().indexOf(kw)
    if(idx !== -1){ implement = _lt.impl[kw]; s = (s.slice(0,idx)+s.slice(idx+kw.length)).replace(/\s+/g,' ').trim(); break }
  }
  if(!implement){
    const sLow = s.toLowerCase()
    for(const [kw, implName] of IMPL_PAIRS){
      const idx = sLow.indexOf(kw)
      if(idx !== -1){
        implement = implName
        s = (s.slice(0, idx) + s.slice(idx + kw.length)).replace(/\s+/g,' ').trim()
        break
      }
    }
  }
  // Abbreviations as whole words (only if no implement found yet)
  if(!implement){
    const abbrevs = [['\\bBB\\b','BB'],['\\bDB\\b','DB'],['\\bKB\\b','KB'],['\\bBW\\b','BW']]
    for(const [pat, implName] of abbrevs){
      const m = s.match(new RegExp(pat))
      if(m){ implement = implName; s = s.replace(new RegExp(pat), '').replace(/\s+/g,' ').trim(); break }
    }
  }

  // 3. Modifier detection — stays with implement, no brackets
  const MOD_PATTERNS = [
    [/\b(1[\s-]?arm|single[\s-]arm|one[\s-]arm)\b/i,   '1 Arm'],
    [/\b(1[\s-]?leg|single[\s-]leg|one[\s-]leg)\b/i,   '1 Leg'],
    [/\b(alternating|alt)\b/i,                           'Alternating'],
    [/\bkneeling\b/i,                                    'Kneeling'],
    [/\bseated\b/i,                                      'Seated'],
    [/\bstanding\b/i,                                    'Standing'],
    [/\bincline\b/i,                                     'Incline'],
    [/\bdecline\b/i,                                     'Decline'],
    [/\bflat\b/i,                                        'Flat'],
    [/\bsplit\b/i,                                       'Split'],
    [/\bstaggered\b/i,                                   'Staggered'],
  ]
  const mods = []
  for(const [pat, label] of MOD_PATTERNS){
    if(pat.test(s)){ mods.push(label); s = s.replace(pat,'').replace(/\s+/g,' ').trim() }
  }
  modifier = mods.join(' ')

  // 4. Movement = whatever remains, cleaned up
  let movement = s.replace(/^[-\s]+|[-\s]+$/g,'').replace(/\s+/g,' ').trim()
  // Learned movement synonyms (from your past renames)
  const _mv = getLearnedTerms().move || {}
  if(_mv[movement.toLowerCase()]) movement = _mv[movement.toLowerCase()]
  return { movement, implement, modifier, variation }
}

function assembleExerciseName(movement, implement, modifier, variation){
  let name = (movement||'').trim()
  const impl = (implement||'').trim()
  const mod  = (modifier||'').trim()
  const vari = (variation||'').trim()
  if(impl)  name += ' - ' + impl
  if(mod)   name += ' ' + mod
  if(vari)  name += ' (' + vari + ')'
  return name
}

// Implement dropdown picker component
function ImplPicker({ value, onChange, disabled }) {
  const [open, setOpen] = React.useState(false)
  return(
    <div style={{position:'relative'}}>
      <input
        value={value}
        onChange={e=>onChange(e.target.value)}
        onFocus={()=>setOpen(true)}
        onBlur={()=>setTimeout(()=>setOpen(false),150)}
        placeholder="BB / DB / …"
        disabled={disabled}
        style={{...iS,fontSize:12,padding:'5px 8px',width:'100%',
          background:disabled?'transparent':'rgba(255,255,255,0.06)'}}
      />
      {open&&!disabled&&(
        <div style={{position:'absolute',top:'100%',left:0,zIndex:99,background:'#0D1117',
          border:`1px solid ${C.border}`,borderRadius:6,minWidth:140,boxShadow:'0 4px 16px rgba(0,0,0,0.5)',
          maxHeight:200,overflowY:'auto'}}>
          {IMPLEMENT_OPTIONS.map(o=>(
            <div key={o||'none'} onMouseDown={()=>onChange(o)}
              style={{padding:'6px 12px',fontSize:12,color:o?C.white:C.faint,cursor:'pointer',
                background:'transparent'}}
              onMouseEnter={e=>e.currentTarget.style.background=`${C.amber}18`}
              onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
              {o||'(none)'}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function NamingConventionTool({ sessions, updateSession }) {
  const allNames = [...new Set(
    sessions.flatMap(s => safeExercises(s).filter(e => !e.isWarmup).map(e => e.name)).filter(Boolean)
  )].sort()

  const [entries, setEntries] = useState(() =>
    allNames.map(name => {
      const p = autoParseExercise(name)
      const suggested = isAcceptedName(name) ? name : assembleExerciseName(p.movement, p.implement, p.modifier, p.variation)
      return { original:name, name:suggested, suggested,
               movement:p.movement, implement:p.implement, modifier:p.modifier, variation:p.variation,
               confirmed:false, applied:false, noChange: suggested===name }
    })
  )
  // Sync entries when sessions gain/lose exercises (preserves existing edit state)
  const _nctKey = sessions.map(s=>s.id).sort().join(',')
  useEffect(()=>{
    const names = [...new Set(sessions.flatMap(s=>safeExercises(s).filter(e=>!e.isWarmup).map(e=>e.name)).filter(Boolean))].sort()
    setEntries(prev=>{
      const existing = new Set(prev.map(e=>e.original))
      const current  = new Set(names)
      const newOnes  = names.filter(n=>!existing.has(n)).map(name=>{
        const p = autoParseExercise(name)
        const suggested = isAcceptedName(name) ? name : assembleExerciseName(p.movement,p.implement,p.modifier,p.variation)
        return {original:name, name:suggested, suggested,
                movement:p.movement, implement:p.implement, modifier:p.modifier, variation:p.variation,
                confirmed:false, applied:false, noChange:suggested===name}
      })
      const kept = prev.filter(e=>current.has(e.original)||e.applied)
      return newOnes.length>0||kept.length!==prev.length ? [...kept,...newOnes] : prev
    })
  }, [_nctKey])
  const [progress, setProgress]   = useState(null)
  const [applying, setApplying]   = useState(false)
  const [search,   setSearch]     = useState('')
  const [filter,   setFilter]     = useState('all')
  const [learnTick, setLearnTick] = useState(0)

  const upd = (i, field, val) =>
    setEntries(p => p.map((e,idx) => idx===i ? {...e,[field]:val,applied:false, confirmed: field==='name' ? false : e.confirmed} : e))

  const previewName = e => (e.name || '').trim() || e.original
  const isChanged   = e => previewName(e) !== e.original && previewName(e).length > 0

  const filtered = entries.filter(e => {
    const matchSearch = !search || e.original.toLowerCase().includes(search.toLowerCase()) || previewName(e).toLowerCase().includes(search.toLowerCase())
    if(!matchSearch) return false
    if(filter==='changed')   return isChanged(e) && !e.applied
    if(filter==='confirmed') return e.confirmed && !e.applied
    if(filter==='applied')   return e.applied
    if(filter==='unchanged') return !isChanged(e)
    return true
  })

  const changedCount    = entries.filter(e => isChanged(e) && !e.applied).length
  const confirmedCount  = entries.filter(e => e.confirmed && !e.applied).length
  const appliedCount    = entries.filter(e => e.applied).length

  const confirmAll = () =>
    setEntries(p => p.map(e => isChanged(e) ? {...e, confirmed:true} : e))

  const reSuggest = () => setEntries(p=>p.map(e=>{
    if(e.confirmed||e.applied) return e
    if(isAcceptedName(e.original)) return {...e,name:e.original,suggested:e.original,noChange:true}
    const pp=autoParseExercise(e.original)
    const sug=assembleExerciseName(pp.movement,pp.implement,pp.modifier,pp.variation)
    return {...e,name:sug,suggested:sug,movement:pp.movement,implement:pp.implement,modifier:pp.modifier,variation:pp.variation,noChange:sug===e.original}
  }))

  const keepName = (original) => {
    acceptName(original)
    setEntries(p=>p.map(e=> e.original===original ? {...e, name:original, suggested:original, noChange:true, confirmed:false} : e))
    setLearnTick(t=>t+1)
  }
  const unkeepName = (original) => {
    unacceptName(original)
    setEntries(p=>p.map(e=>{
      if(e.original!==original) return e
      const pp=autoParseExercise(original)
      const sug=assembleExerciseName(pp.movement,pp.implement,pp.modifier,pp.variation)
      return {...e, name:sug, suggested:sug, movement:pp.movement, implement:pp.implement, modifier:pp.modifier, variation:pp.variation, noChange:sug===original}
    }))
    setLearnTick(t=>t+1)
  }

  const applyRenames = async () => {
    const toApply = entries.filter(e => e.confirmed && !e.applied && isChanged(e))
    if(!toApply.length) return
    setApplying(true)
    let done=0
    for(const entry of toApply){
      const newName = previewName(entry)
      // Register in registry FIRST — persists regardless of Supabase outcome
      regRename(entry.original, newName)
      learnFromRename(entry.original, newName)
      const affected = sessions.filter(s => safeExercises(s).some(e => e.name===entry.original))
      for(const sess of affected){
        const newExs = safeExercises(sess).map(ex =>
          ex.name===entry.original ? {...ex, name:newName, _originalName:ex._originalName||ex.name} : ex
        )
        await updateSession(sess.id, {exercises:newExs})
      }
      setEntries(p => p.map(e => e.original===entry.original ? {...e, applied:true} : e))
      done++
      setProgress(`Saved ${done}/${toApply.length}…`)
    }
    setProgress(`✓ ${done} exercise${done!==1?'s':''} renamed and registered`)
    setTimeout(()=>setProgress(null), 3000)
    setApplying(false)
  }

  return(
    <div style={{padding:20,maxWidth:1060,margin:'0 auto'}}>
      <h1 style={{fontSize:22,fontWeight:700,color:C.white,fontFamily:'Space Grotesk,sans-serif',marginBottom:4}}>NAMING CONVENTION</h1>
      <p style={{fontSize:13,color:C.muted,marginBottom:4}}>
        Format: <span style={{color:C.white,fontWeight:600}}>Movement - Implement Modifier (Variation)</span>
      </p>
      <div style={{display:'flex',gap:10,flexWrap:'wrap',fontSize:12,color:C.faint,marginBottom:20}}>
        <span>e.g. <span style={{color:C.c3}}>Squat - BB (Banded)</span></span>
        <span>·</span>
        <span><span style={{color:C.c3}}>Shoulder Press - Landmine 1 Arm</span></span>
        <span>·</span>
        <span><span style={{color:C.c3}}>Chin-Up (Supinated)</span></span>
      </div>

      {/* Stats strip */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:16}}>
        {[
          {v:allNames.length, l:'Total Exercises', c:C.white},
          {v:changedCount,    l:'Need Renaming',   c:C.amber},
          {v:confirmedCount,  l:'Confirmed',        c:C.green},
          {v:appliedCount,    l:'Applied',          c:C.c3},
        ].map(({v,l,c})=>(
          <Card key={l} style={{padding:'10px 14px',textAlign:'center'}}>
            <div style={{fontSize:22,fontWeight:700,color:c}}>{v}</div>
            <div style={{fontSize:10,color:C.faint,textTransform:'uppercase',letterSpacing:'0.06em',marginTop:2}}>{l}</div>
          </Card>
        ))}
      </div>

      {(() => {
        const lt = getLearnedTerms()
        const implRules = Object.entries(lt.impl||{})
        const moveRules = Object.entries(lt.move||{})
        const wordRules = Object.entries(lt.word||{})
        if(implRules.length===0 && moveRules.length===0 && wordRules.length===0) return null
        return (
          <Card key={'lr'+learnTick} style={{marginBottom:14,padding:'12px 14px'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8,gap:10,flexWrap:'wrap'}}>
              <span style={{fontSize:10,fontWeight:700,color:C.amber,textTransform:'uppercase',letterSpacing:'0.1em'}}>Learned Naming Rules</span>
              <Btn label="Re-suggest from rules" variant="secondary" small onClick={reSuggest}/>
            </div>
            <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
              {implRules.map(([k,v])=>(
                <span key={'i'+k} style={{display:'inline-flex',alignItems:'center',gap:6,background:C.ink,border:`1px solid ${C.border}`,borderRadius:20,padding:'3px 6px 3px 10px',fontSize:11,color:C.muted}}>
                  <span style={{fontFamily:'monospace'}}>{k}</span><span style={{color:C.faint}}>{'\u2192'}</span><span style={{color:C.c3,fontWeight:700}}>{v}</span>
                  <button onClick={()=>{removeLearnedTerm('impl',k);setLearnTick(t=>t+1)}} style={{background:'none',border:'none',color:C.faint,cursor:'pointer',fontSize:13,lineHeight:1,padding:'0 2px'}}>{'\u00d7'}</button>
                </span>
              ))}
              {moveRules.map(([k,v])=>(
                <span key={'m'+k} style={{display:'inline-flex',alignItems:'center',gap:6,background:C.ink,border:`1px solid ${C.border}`,borderRadius:20,padding:'3px 6px 3px 10px',fontSize:11,color:C.muted}}>
                  <span style={{fontFamily:'monospace'}}>{k}</span><span style={{color:C.faint}}>{'\u2192'}</span><span style={{color:C.c2,fontWeight:700}}>{v}</span>
                  <button onClick={()=>{removeLearnedTerm('move',k);setLearnTick(t=>t+1)}} style={{background:'none',border:'none',color:C.faint,cursor:'pointer',fontSize:13,lineHeight:1,padding:'0 2px'}}>{'\u00d7'}</button>
                </span>
              ))}
              {wordRules.map(([k,v])=>(
                <span key={'w'+k} style={{display:'inline-flex',alignItems:'center',gap:6,background:C.ink,border:`1px solid ${C.border}`,borderRadius:20,padding:'3px 6px 3px 10px',fontSize:11,color:C.muted}}>
                  <span style={{fontFamily:'monospace'}}>{k}</span><span style={{color:C.faint}}>{'\u2192'}</span><span style={{color:C.amber,fontWeight:700}}>{v}</span>
                  <button onClick={()=>{removeLearnedTerm('word',k);setLearnTick(t=>t+1)}} style={{background:'none',border:'none',color:C.faint,cursor:'pointer',fontSize:13,lineHeight:1,padding:'0 2px'}}>{'\u00d7'}</button>
                </span>
              ))}
            </div>
            <p style={{fontSize:10,color:C.faint,margin:'8px 0 0'}}>Learned from your past renames. These shape new suggestions — you still review every one before applying.</p>
          </Card>
        )
      })()}

      {/* Controls */}
      <div style={{display:'flex',gap:8,marginBottom:12,flexWrap:'wrap',alignItems:'center'}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search exercises…"
          style={{...iS,flex:1,minWidth:200}}/>
        <div style={{display:'flex',gap:4}}>
          {[['all','All'],['changed','Changed'],['confirmed','Confirmed'],['applied','Applied'],['unchanged','No Change']].map(([k,l])=>(
            <button key={k} onClick={()=>setFilter(k)}
              style={{padding:'5px 11px',borderRadius:20,border:`1.5px solid ${filter===k?C.amber:C.border}`,
                background:filter===k?`${C.amber}18`:'transparent',color:filter===k?C.amber:C.muted,
                fontSize:11,fontWeight:700,cursor:'pointer'}}>
              {l}
            </button>
          ))}
        </div>
        <Btn label="Confirm All Changes" variant="secondary" small onClick={confirmAll} disabled={changedCount===0}/>
        <Btn
          label={applying?'Applying…':`Apply ${confirmedCount} Confirmed`}
          onClick={applyRenames}
          disabled={confirmedCount===0||applying}
          loading={applying}
        />
      </div>

      {progress&&(
        <div style={{background:`${progress.startsWith('✓')?C.green:progress.startsWith('')?C.orange:C.c1}18`,
          border:`1px solid ${progress.startsWith('✓')?C.green:progress.startsWith('')?C.orange:C.c1}40`,
          borderRadius:8,padding:'8px 14px',marginBottom:12,fontSize:13,
          color:progress.startsWith('✓')?C.green:progress.startsWith('')?C.orange:C.c3}}>
          {progress}
        </div>
      )}

      {/* Column headers */}
      <div style={{display:'grid',gridTemplateColumns:'minmax(200px, 1fr) 24px 2fr 110px',gap:12,
        padding:'5px 12px',marginBottom:6}}>
        {['Current Name','','New Name','Action'].map((h,i)=>(
          <div key={i} style={{fontSize:9,color:C.amber,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em'}}>{h}</div>
        ))}
      </div>

      {/* Exercise rows */}
      <div style={{display:'flex',flexDirection:'column',gap:5}}>
        {filtered.map((entry, i) => {
          const realIdx = entries.indexOf(entry)
          const preview = previewName(entry)
          const changed = isChanged(entry)
          const isCustomized = entry.name !== entry.suggested
          const borderColor = entry.applied ? C.c2 : entry.confirmed ? `${C.amber}60` : changed ? C.border : `${C.white}05`
          const bgColor     = entry.applied ? `${C.c2}08` : entry.confirmed ? `${C.amber}08` : C.card

          return(
            <div key={entry.original} style={{
              background:bgColor, border:`1.5px solid ${borderColor}`,
              borderRadius:9, padding:'10px 12px',
              opacity: entry.applied ? 0.55 : 1,
            }}>
              <div style={{display:'grid',gridTemplateColumns:'minmax(200px, 1fr) 24px 2fr 110px',gap:12,alignItems:'center'}}>

                {/* Original / current name */}
                <div style={{minWidth:0}}>
                  <div style={{fontSize:13,color:C.white,fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}
                       title={entry.original}>
                    {entry.original}
                  </div>
                  {!changed && <div style={{fontSize:10,color:`${C.c3}90`,marginTop:2}}>✓ already in correct format</div>}
                  {entry.applied && <div style={{fontSize:10,color:C.c2,marginTop:2,fontWeight:700}}>✓ renamed</div>}
                </div>

                {/* Arrow */}
                <div style={{color:C.faint,fontSize:16,textAlign:'center'}}>→</div>

                {/* Editable new name */}
                <div style={{display:'flex',gap:6,alignItems:'center',minWidth:0}}>
                  <input
                    value={entry.name}
                    onChange={e=>upd(realIdx,'name',e.target.value)}
                    placeholder={entry.suggested || 'New name…'}
                    disabled={entry.applied}
                    style={{...iS, flex:1, fontSize:13, fontWeight:500,
                      background: entry.applied ? 'transparent' : C.ink,
                      padding:'7px 11px',
                      color: changed ? C.amber : C.white,
                      borderColor: entry.name.trim() ? C.border : `${C.red}50`}}
                  />
                  {isCustomized && !entry.applied && (
                    <button
                      title={`Reset to auto-suggestion: ${entry.suggested}`}
                      onClick={()=>upd(realIdx,'name',entry.suggested)}
                      style={{background:'none',border:`1px solid ${C.border}`,borderRadius:5,
                        padding:'5px 8px',color:C.muted,fontSize:13,cursor:'pointer',flexShrink:0}}>
                      ↺
                    </button>
                  )}
                </div>

                {/* Actions */}
                <div style={{textAlign:'right'}}>
                  {entry.applied
                    ? <span style={{color:C.c2,fontSize:18,fontWeight:700}}>✓</span>
                    : isAcceptedName(entry.original)
                      ? <button onClick={()=>unkeepName(entry.original)} title="Allow suggestions for this name again"
                          style={{padding:'6px 12px',borderRadius:6,fontSize:11,fontWeight:700,cursor:'pointer',border:`1.5px solid ${C.green}40`,background:`${C.green}14`,color:C.green,whiteSpace:'nowrap'}}>
                          ✓ Kept
                        </button>
                      : <div style={{display:'flex',gap:6,justifyContent:'flex-end',flexWrap:'wrap'}}>
                          {changed && <button
                            onClick={()=>setEntries(p=>p.map((e,idx)=>idx===realIdx?{...e,confirmed:!e.confirmed}:e))}
                            style={{padding:'6px 14px',borderRadius:6,fontSize:11,fontWeight:700,cursor:'pointer',border:`1.5px solid ${entry.confirmed?C.c2:C.border}`,background:entry.confirmed?`${C.c2}18`:'transparent',color:entry.confirmed?C.c2:C.muted,whiteSpace:'nowrap'}}>
                            {entry.confirmed ? '✓ Ready' : 'Confirm'}
                          </button>}
                          <button onClick={()=>keepName(entry.original)} title="Keep this name as-is and stop suggesting changes"
                            style={{padding:'6px 12px',borderRadius:6,fontSize:11,fontWeight:700,cursor:'pointer',border:`1.5px solid ${C.border}`,background:'transparent',color:C.faint,whiteSpace:'nowrap'}}>
                            Keep name
                          </button>
                        </div>
                  }
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {filtered.length===0&&(
        <Card style={{textAlign:'center',padding:40}}>
          <p style={{color:C.muted}}>
            {search ? `No exercises match "${search}"` : 'No exercises in this filter.'}
          </p>
        </Card>
      )}

      <div style={{marginTop:16,padding:'10px 14px',background:C.ink,borderRadius:8,fontSize:11,color:C.faint,lineHeight:1.8}}>
        <strong style={{color:C.white}}>How this works:</strong> Edit Movement, Implement, Modifier and Variation fields. The preview updates live.
        Confirm the ones you're happy with, then click <strong style={{color:C.amber}}>Apply Confirmed</strong>.
        Every session in your database that uses that exercise name will be updated. This is reversible via the Exercise Cleanup undo.
      </div>
    </div>
  )
}