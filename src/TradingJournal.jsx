import React, { useState, useEffect, useMemo } from 'react';
import { Plus, X, TrendingUp, TrendingDown, Brain, BarChart3, ChevronDown, ChevronUp, Trash2, Filter, Sparkles, AlertCircle, Cloud, CloudOff } from 'lucide-react';

const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzj936UBtjCoJNNg5xtELgpTA6nLYtL7x4hAJWoE2lL5NXvsz3cJJz1wofWjiO4__ti2w/exec';

async function cloudLoad() {
  const res = await fetch(SCRIPT_URL, { method: 'GET' });
  const data = await res.json();
  if (!data.ok) throw new Error('cloud load failed');
  return data.trades || [];
}

async function cloudSave(trade) {
  await fetch(SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'save', trade }),
  });
}

async function cloudDelete(id) {
  await fetch(SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'delete', id }),
  });
}

const PSYCH_TAGS = ['وفق الخطة', 'طمع', 'انتقام', 'خوف', 'كسر الخطة', 'تسرع', 'ثقة زائدة', 'تردد'];
const PAIRS = ['GBPUSD', 'EURUSD', 'AUDJPY', 'AUDCAD', 'AUDNZD', 'AUDCHF', 'EURJPY', 'USDJPY', 'GBPJPY', 'XAUUSD', 'أخرى'];

const emptyTrade = () => ({
  id: crypto.randomUUID(),
  date: new Date().toISOString().slice(0, 10),
  pair: 'GBPUSD', direction: 'buy',
  entry: '', sl: '', tp: '', exit: '',
  result: 'open',
  reasonEntry: '', reasonExit: '', plan: '',
  psychTags: [], chartImage: null, aiAnalysis: null,
  createdAt: Date.now(),
});

function useTrades() {
  const [trades, setTrades] = useState([]);
  const [syncStatus, setSyncStatus] = useState('idle');
  useEffect(() => {
    setSyncStatus('loading');
    cloudLoad()
      .then((loaded) => { setTrades(loaded.sort((a,b) => (b.createdAt||0)-(a.createdAt||0))); setSyncStatus('synced'); })
      .catch(() => setSyncStatus('error'));
  }, []);
  const add = (t) => { setTrades((p) => [t,...p]); cloudSave(t).then(()=>setSyncStatus('synced')).catch(()=>setSyncStatus('error')); };
  const update = (id, patch) => { setTrades((p) => { const next=p.map((t)=>t.id===id?{...t,...patch}:t); const u=next.find((t)=>t.id===id); if(u) cloudSave(u).then(()=>setSyncStatus('synced')).catch(()=>setSyncStatus('error')); return next; }); };
  const remove = (id) => { setTrades((p)=>p.filter((t)=>t.id!==id)); cloudDelete(id).then(()=>setSyncStatus('synced')).catch(()=>setSyncStatus('error')); };
  return { trades, add, update, remove, syncStatus };
                                                   }
function computeRR(t) {
  const entry=parseFloat(t.entry),sl=parseFloat(t.sl),tp=parseFloat(t.tp);
  if(!entry||!sl||!tp) return null;
  const risk=Math.abs(entry-sl),reward=Math.abs(tp-entry);
  if(risk===0) return null;
  return +(reward/risk).toFixed(2);
}

function computeRealizedR(t) {
  const entry=parseFloat(t.entry),sl=parseFloat(t.sl),exit=parseFloat(t.exit);
  if(!entry||!sl||!exit||t.result==='open') return null;
  const risk=Math.abs(entry-sl);
  if(risk===0) return null;
  const moved=t.direction==='buy'?exit-entry:entry-exit;
  return +(moved/risk).toFixed(2);
}

function useStats(trades) {
  return useMemo(() => {
    const closed=trades.filter((t)=>t.result!=='open');
    const wins=closed.filter((t)=>t.result==='win');
    const rValues=closed.map(computeRealizedR).filter((r)=>r!==null);
    const totalR=rValues.reduce((a,b)=>a+b,0);
    const winRate=closed.length?Math.round((wins.length/closed.length)*100):0;
    const avgPlannedRR=trades.map(computeRR).filter((r)=>r!==null);
    const avgRR=avgPlannedRR.length?(avgPlannedRR.reduce((a,b)=>a+b,0)/avgPlannedRR.length).toFixed(2):'—';
    const byPair={};
    closed.forEach((t)=>{ byPair[t.pair]=byPair[t.pair]||{wins:0,total:0}; byPair[t.pair].total++; if(t.result==='win') byPair[t.pair].wins++; });
    let bestPair=null,bestRate=-1;
    Object.entries(byPair).forEach(([p,v])=>{ const rate=v.wins/v.total; if(rate>bestRate&&v.total>=1){bestRate=rate;bestPair=p;} });
    const tagCounts={};
    closed.filter((t)=>t.result==='loss').forEach((t)=>{ t.psychTags.forEach((tag)=>{ tagCounts[tag]=(tagCounts[tag]||0)+1; }); });
    const topMistakeTag=Object.entries(tagCounts).sort((a,b)=>b[1]-a[1])[0]?.[0]||null;
    const byDay={};
    closed.forEach((t)=>{ const day=new Date(t.date).toLocaleDateString('ar-EG',{weekday:'long'}); byDay[day]=byDay[day]||{r:0,count:0}; const r=computeRealizedR(t)||0; byDay[day].r+=r; byDay[day].count++; });
    let bestDay=null,bestDayR=-Infinity;
    Object.entries(byDay).forEach(([d,v])=>{ if(v.r>bestDayR){bestDayR=v.r;bestDay=d;} });
    return { totalTrades:trades.length, closedCount:closed.length, wins:wins.length, winRate, totalR:+totalR.toFixed(2), avgRR, bestPair, topMistakeTag, bestDay, tagCounts };
  }, [trades]);
}

function Stat({label,value,accent}) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={accent?{color:accent}:{}}>{value}</div>
    </div>
  );
}

function Tag({children,active,onClick}) {
  return <button type="button" onClick={onClick} className={`tag-btn ${active?'tag-active':''}`}>{children}</button>;
}

function ResultBadge({result}) {
  const map={win:{label:'رابحة',cls:'badge-win'},loss:{label:'خاسرة',cls:'badge-loss'},breakeven:{label:'تعادل',cls:'badge-be'},open:{label:'مفتوحة',cls:'badge-open'}};
  const m=map[result];
  return <span className={`badge ${m.cls}`}>{m.label}</span>;
}function TradeForm({onSave,onCancel}) {
  const [t,setT]=useState(emptyTrade());
  const set=(k,v)=>setT((p)=>({...p,[k]:v}));
  const handleImage=(e)=>{ const file=e.target.files?.[0]; if(!file) return; const reader=new FileReader(); reader.onload=()=>set('chartImage',reader.result); reader.readAsDataURL(file); };
  const rr=computeRR(t);
  return (
    <div className="form-card">
      <div className="form-grid">
        <label className="field"><span>التاريخ</span><input type="date" value={t.date} onChange={(e)=>set('date',e.target.value)} /></label>
        <label className="field"><span>الزوج</span><select value={t.pair} onChange={(e)=>set('pair',e.target.value)}>{PAIRS.map((p)=><option key={p} value={p}>{p}</option>)}</select></label>
        <label className="field"><span>الاتجاه</span><div className="dir-toggle"><button type="button" className={t.direction==='buy'?'dir-active dir-buy':'dir-buy'} onClick={()=>set('direction','buy')}><TrendingUp size={14}/> شراء</button><button type="button" className={t.direction==='sell'?'dir-active dir-sell':'dir-sell'} onClick={()=>set('direction','sell')}><TrendingDown size={14}/> بيع</button></div></label>
      </div>
      <div className="form-grid form-grid-4">
        <label className="field"><span>الدخول</span><input type="number" step="any" value={t.entry} onChange={(e)=>set('entry',e.target.value)} placeholder="1.2750"/></label>
        <label className="field"><span>إيقاف الخسارة</span><input type="number" step="any" value={t.sl} onChange={(e)=>set('sl',e.target.value)} placeholder="1.2700"/></label>
        <label className="field"><span>الهدف</span><input type="number" step="any" value={t.tp} onChange={(e)=>set('tp',e.target.value)} placeholder="1.2850"/></label>
        <label className="field"><span>الخروج الفعلي</span><input type="number" step="any" value={t.exit} onChange={(e)=>set('exit',e.target.value)} placeholder="اختياري"/></label>
      </div>
      {rr&&<div className="rr-preview">R:R المخطط: <strong>1:{rr}</strong></div>}
      <label className="field"><span>النتيجة</span><div className="result-toggle">{['win','loss','breakeven','open'].map((r)=>(<button key={r} type="button" className={t.result===r?`res-active res-${r}`:`res-${r}`} onClick={()=>set('result',r)}>{{win:'رابحة',loss:'خاسرة',breakeven:'تعادل',open:'مفتوحة'}[r]}</button>))}</div></label>
      <label className="field"><span>سبب الدخول</span><textarea rows={3} value={t.reasonEntry} onChange={(e)=>set('reasonEntry',e.target.value)} placeholder="CHoCH على 1H + ريتست EMA50 + Supply zone"/></label>
      <label className="field"><span>سبب الخروج</span><textarea rows={2} value={t.reasonExit} onChange={(e)=>set('reasonExit',e.target.value)} placeholder="ضرب الهدف / أغلقت يدوياً"/></label>
      <label className="field"><span>الخطة الأصلية</span><textarea rows={2} value={t.plan} onChange={(e)=>set('plan',e.target.value)} placeholder="ما كانت خطتك قبل الدخول؟"/></label>
      <label className="field"><span>الحالة النفسية</span><div className="tags-wrap">{PSYCH_TAGS.map((tag)=>(<Tag key={tag} active={t.psychTags.includes(tag)} onClick={()=>setT((p)=>({...p,psychTags:p.psychTags.includes(tag)?p.psychTags.filter((x)=>x!==tag):[...p.psychTags,tag]}))}>{tag}</Tag>))}</div></label>
      <label className="field"><span>صورة الشارت (اختياري)</span><input type="file" accept="image/*" onChange={handleImage} className="file-input"/>{t.chartImage&&<img src={t.chartImage} alt="chart" className="chart-thumb"/>}</label>
      <div className="form-actions"><button className="btn-secondary" onClick={onCancel}>إلغاء</button><button className="btn-primary" onClick={()=>onSave(t)}>حفظ الصفقة</button></div>
    </div>
  );
}function TradeCard({trade,onDelete,analyzing}) {
  const [open,setOpen]=useState(false);
  const rr=computeRR(trade);
  const realizedR=computeRealizedR(trade);
  return (
    <div className="trade-card">
      <div className="trade-head" onClick={()=>setOpen((o)=>!o)}>
        <div className="trade-head-left">
          {trade.direction==='buy'?<TrendingUp size={18} className="ico-buy"/>:<TrendingDown size={18} className="ico-sell"/>}
          <div><div className="trade-pair">{trade.pair}</div><div className="trade-date">{trade.date}</div></div>
        </div>
        <div className="trade-head-right">
          {realizedR!==null&&<span className={`r-pill ${realizedR>=0?'r-pos':'r-neg'}`}>{realizedR>=0?'+':''}{realizedR}R</span>}
          <ResultBadge result={trade.result}/>
          {open?<ChevronUp size={18}/>:<ChevronDown size={18}/>}
        </div>
      </div>
      {open&&(
        <div className="trade-body">
          <div className="trade-meta-grid">
            <div><span className="meta-label">دخول</span>{trade.entry||'—'}</div>
            <div><span className="meta-label">SL</span>{trade.sl||'—'}</div>
            <div><span className="meta-label">TP</span>{trade.tp||'—'}</div>
            <div><span className="meta-label">خروج</span>{trade.exit||'—'}</div>
            <div><span className="meta-label">R:R</span>{rr?`1:${rr}`:'—'}</div>
          </div>
          {trade.reasonEntry&&<div className="trade-text"><span className="meta-label">سبب الدخول</span><p>{trade.reasonEntry}</p></div>}
          {trade.reasonExit&&<div className="trade-text"><span className="meta-label">سبب الخروج</span><p>{trade.reasonExit}</p></div>}
          {trade.plan&&<div className="trade-text"><span className="meta-label">الخطة</span><p>{trade.plan}</p></div>}
          {trade.psychTags.length>0&&<div className="tags-wrap">{trade.psychTags.map((t)=><span key={t} className="tag-readonly">{t}</span>)}</div>}
          {trade.chartImage&&<img src={trade.chartImage} alt="chart" className="chart-thumb-lg"/>}
          <div className="ai-section">
            <button className="btn-ai btn-ai-disabled" disabled>
              <Brain size={16}/> التحليل بالذكاء الاصطناعي (قادم قريباً)
            </button>
          </div>
          <button className="btn-delete" onClick={()=>onDelete(trade.id)}><Trash2 size={14}/> حذف</button>
        </div>
      )}
    </div>
  );
}export default function TradingJournal() {
  const {trades,add,update,remove,syncStatus}=useTrades();
  const stats=useStats(trades);
  const [showForm,setShowForm]=useState(false);
  const [filterResult,setFilterResult]=useState('all');
  const filtered=trades.filter((t)=>filterResult==='all'||t.result===filterResult);
  return (
    <div className="app" dir="rtl">
      <style>{`
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=Oswald:wght@500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
:root{--bg:#090c11;--bg-grad:#0c1e42;--panel:#151a26;--panel-2:#1a2030;--line:#232b3d;--line-soft:#1b2230;--text:#f2f4f8;--text-dim:#707b8f;--text-mid:#aab3c5;--amber:#e5cd52;--amber-dim:#3a3320;--cyan:#6390e7;--cyan-dim:#16233f;--rose:#e0607a;--rose-dim:#3a1d24;--red-strong:#e23b3b;--blue:#4274dc;--blue-bright:#5b8def;--blue-deep:#0c2351;}
*{box-sizing:border-box;}
.app{font-family:'IBM Plex Sans Arabic',sans-serif;background:radial-gradient(900px 600px at 85% 0%,rgba(66,116,220,0.16),transparent 60%),linear-gradient(180deg,var(--bg) 0%,var(--bg) 45%,var(--bg-grad) 130%);color:var(--text);min-height:100vh;padding:0 0 60px;max-width:720px;margin:0 auto;}
.ticker-strip{display:flex;align-items:center;gap:10px;background:#060810;border-bottom:1px solid var(--line);padding:8px 16px;font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--text-dim);overflow-x:auto;white-space:nowrap;}
.ticker-dot{width:7px;height:7px;border-radius:50%;background:var(--blue);box-shadow:0 0 8px var(--blue);flex-shrink:0;}
.ticker-val{color:var(--text-mid);font-weight:600;}.ticker-val.tv-up{color:var(--blue-bright);}.ticker-val.tv-down{color:var(--red-strong);}
.ticker-sep{width:1px;height:12px;background:var(--line);flex-shrink:0;}
.sync-pill{display:flex;align-items:center;gap:4px;font-size:10.5px;color:var(--text-dim);margin-right:auto;}
.sync-pill.synced{color:var(--blue-bright);}.sync-pill.error{color:var(--red-strong);}
.app-header{display:flex;justify-content:space-between;align-items:center;margin:20px 16px 18px;padding-bottom:16px;border-bottom:1px solid var(--line-soft);}
.brand-block{display:flex;align-items:center;gap:12px;}
.brand-mark{width:38px;height:38px;border-radius:9px;background:linear-gradient(150deg,var(--blue),var(--blue-deep));color:#fff;font-family:'Oswald',sans-serif;font-weight:700;font-size:14px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 16px rgba(66,116,220,0.35);}
.app-header h1{font-family:'Oswald',sans-serif;font-size:19px;font-weight:600;margin:0;color:var(--text);}
.subtitle{font-size:12px;color:var(--text-dim);margin:2px 0 0;}
.btn-primary,.btn-secondary,.btn-ai,.btn-delete{display:inline-flex;align-items:center;gap:6px;border:none;border-radius:9px;cursor:pointer;font-family:inherit;font-weight:600;font-size:13px;transition:all .15s ease;}
.btn-primary{background:var(--blue);color:#fff;padding:10px 16px;box-shadow:0 6px 18px rgba(66,116,220,0.4);}
.btn-primary:hover{background:#3868c9;}
.btn-secondary{background:var(--panel-2);color:var(--text-mid);padding:10px 16px;border:1px solid var(--line);}
.stats-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:0 16px 14px;}
.stat-card{background:var(--panel);border:1px solid var(--line-soft);border-radius:11px;padding:12px 10px;}
.stat-label{font-size:10.5px;color:var(--text-dim);margin-bottom:5px;}
.stat-value{font-family:'JetBrains Mono',monospace;font-size:17px;font-weight:700;color:var(--text);}
.insight-banner{background:var(--amber-dim);border:1px solid #5e4a24;color:var(--amber);border-radius:10px;padding:10px 14px;font-size:12.5px;display:flex;align-items:center;gap:8px;margin:0 16px 14px;}
.form-card{background:var(--panel);border:1px solid var(--line-soft);border-radius:13px;padding:16px;margin:0 16px 16px;}
.form-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:10px;}
.form-grid-4{grid-template-columns:repeat(2,1fr);}
.field{display:flex;flex-direction:column;gap:6px;margin-bottom:10px;}
.field>span{font-size:12px;color:var(--text-mid);font-weight:500;}
.field input,.field select,.field textarea{background:var(--bg);border:1px solid var(--line);color:var(--text);border-radius:8px;padding:9px 11px;font-size:13px;font-family:inherit;outline:none;width:100%;resize:vertical;}
.field input,.field select{font-family:'JetBrains Mono',monospace;}
.field input:focus,.field select:focus,.field textarea:focus{border-color:var(--blue);}
.file-input{padding:6px;font-family:inherit!important;}
.dir-toggle,.result-toggle{display:flex;gap:6px;}
.dir-toggle button,.result-toggle button{flex:1;padding:8px;border-radius:8px;border:1px solid var(--line);background:var(--bg);color:var(--text-mid);font-size:12px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:4px;}
.dir-active.dir-buy{background:var(--cyan-dim);border-color:var(--cyan);color:var(--cyan);}
.dir-active.dir-sell{background:var(--rose-dim);border-color:var(--rose);color:var(--rose);}
.res-active.res-win{background:var(--cyan-dim);border-color:var(--cyan);color:var(--cyan);}
.res-active.res-loss{background:var(--rose-dim);border-color:var(--rose);color:var(--rose);}
.res-active.res-breakeven{background:var(--amber-dim);border-color:var(--amber);color:var(--amber);}
.res-active.res-open{background:#14233a;border-color:#4f9fe8;color:#4f9fe8;}
.rr-preview{font-size:12px;color:var(--text-dim);margin:-4px 0 12px;font-family:'JetBrains Mono',monospace;}
.rr-preview strong{color:var(--blue);}
.tags-wrap{display:flex;flex-wrap:wrap;gap:6px;}
.tag-btn{padding:6px 12px;border-radius:20px;border:1px solid var(--line);background:var(--bg);color:var(--text-mid);font-size:12px;cursor:pointer;font-family:inherit;}
.tag-active{background:#2a1f3a;border-color:#9b7fc4;color:#c4aee8;}
.tag-readonly{padding:4px 10px;border-radius:16px;background:var(--panel-2);color:var(--text-mid);font-size:11px;}
.chart-thumb{max-width:160px;border-radius:8px;margin-top:8px;border:1px solid var(--line);}
.chart-thumb-lg{max-width:100%;border-radius:10px;margin:10px 0;border:1px solid var(--line);}
.form-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:6px;}
.filter-row{display:flex;align-items:center;gap:6px;margin:0 16px 12px;color:var(--text-dim);}
.filter-btn{background:none;border:1px solid var(--line-soft);color:var(--text-dim);padding:6px 12px;border-radius:16px;font-size:12px;cursor:pointer;font-family:inherit;}
.filter-active{background:var(--blue-deep);color:#fff;border-color:var(--blue);}
.trades-list{display:flex;flex-direction:column;gap:10px;margin:0 16px;}
.empty-state{text-align:center;padding:50px 20px;color:var(--text-dim);display:flex;flex-direction:column;align-items:center;gap:10px;}
.trade-card{background:var(--panel);border:1px solid var(--line-soft);border-radius:12px;overflow:hidden;}
.trade-head{display:flex;justify-content:space-between;align-items:center;padding:14px;cursor:pointer;}
.trade-head-left{display:flex;align-items:center;gap:10px;}
.trade-pair{font-family:'JetBrains Mono',monospace;font-weight:700;font-size:13.5px;color:var(--text);}
.trade-date{font-size:11px;color:var(--text-dim);font-family:'JetBrains Mono',monospace;}
.trade-head-right{display:flex;align-items:center;gap:8px;color:var(--text-dim);}
.ico-buy{color:var(--cyan);}.ico-sell{color:var(--rose);}
.r-pill{font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:700;padding:3px 8px;border-radius:6px;}
.r-pos{background:var(--cyan-dim);color:var(--cyan);}.r-neg{background:var(--rose-dim);color:var(--rose);}
.badge{font-size:11px;font-weight:600;padding:4px 10px;border-radius:14px;}
.badge-win{background:var(--cyan-dim);color:var(--cyan);}
.badge-loss{background:var(--rose-dim);color:var(--rose);}
.badge-be{background:var(--amber-dim);color:var(--amber);}
.badge-open{background:#14233a;color:#4f9fe8;}
.trade-body{padding:0 14px 14px;border-top:1px solid var(--line-soft);}
.trade-meta-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;padding:12px 0;font-family:'JetBrains Mono',monospace;font-size:12px;}
.meta-label{display:block;font-size:10px;color:var(--text-dim);font-family:'IBM Plex Sans Arabic',sans-serif;margin-bottom:2px;}
.trade-text{margin-bottom:10px;}
.trade-text p{margin:0;font-size:13px;color:var(--text-mid);line-height:1.6;}
.ai-section{margin-top:12px;padding-top:12px;border-top:1px solid var(--line-soft);}
.btn-ai{background:linear-gradient(135deg,#241a30,#161c28);color:#c4aee8;padding:10px 14px;width:100%;justify-content:center;border:1px solid #332945;}
.btn-ai-disabled{cursor:not-allowed;opacity:0.45;}
.btn-delete{background:none;color:var(--text-dim);padding:6px 10px;margin-top:8px;font-size:12px;}
.btn-delete:hover{color:var(--rose);}
@media(max-width:420px){.stats-grid{grid-template-columns:repeat(2,1fr);}.form-grid{grid-template-columns:1fr 1fr;}.trade-meta-grid{grid-template-columns:repeat(3,1fr);}}
      `}</style>
      <div className="ticker-strip">
        <span className="ticker-dot"/>
        <span className="ticker-label">SESSION</span>
        <span className="ticker-val">{new Date().toLocaleDateString('ar-EG',{weekday:'long',day:'numeric',month:'short'})}</span>
        <span className="ticker-sep"/>
        <span className="ticker-label">R صافي</span>
        <span className={`ticker-val ${stats.totalR>=0?'tv-up':'tv-down'}`}>{stats.totalR>=0?'+':''}{stats.totalR}R</span>
        <span className="ticker-sep"/>
        <span className="ticker-label">WIN%</span>
        <span className="ticker-val">{stats.winRate}%</span>
        <span className="ticker-sep"/>
        <span className={`sync-pill ${syncStatus}`}>
          {syncStatus==='synced'&&<><Cloud size={11}/> محفوظ</>}
          {syncStatus==='loading'&&<>...جاري التحميل</>}
          {syncStatus==='error'&&<><CloudOff size={11}/> فشل الحفظ</>}
        </span>
      </div>
      <header className="app-header">
        <div className="brand-block">
          <div className="brand-mark">PA</div>
          <div><h1>دفتر التنفيذ</h1><p className="subtitle">سجّل قرارك، لا توصية أحد</p></div>
        </div>
        <button className="btn-primary" onClick={()=>setShowForm((s)=>!s)}>
          {showForm?<X size={18}/>:<Plus size={18}/>} {showForm?'إغلاق':'صفقة جديدة'}
        </button>
      </header>
      <section className="stats-grid">
        <Stat label="إجمالي الصفقات" value={stats.totalTrades}/>
        <Stat label="نسبة الفوز" value={`${stats.winRate}%`} accent={stats.winRate>=50?'#5b8def':'#e23b3b'}/>
        <Stat label="صافي R" value={`${stats.totalR>=0?'+':''}${stats.totalR}R`} accent={stats.totalR>=0?'#5b8def':'#e23b3b'}/>
        <Stat label="متوسط R:R" value={stats.avgRR==='—'?'—':`1:${stats.avgRR}`}/>
        <Stat label="أفضل زوج" value={stats.bestPair||'—'}/>
        <Stat label="أفضل يوم" value={stats.bestDay||'—'}/>
      </section>
      {stats.topMistakeTag&&<div className="insight-banner"><AlertCircle size={16}/> الخطأ المتكرر: <strong>{stats.topMistakeTag}</strong> ({stats.tagCounts[stats.topMistakeTag]} مرة)</div>}
      {showForm&&<TradeForm onSave={(t)=>{add(t);setShowForm(false);}} onCancel={()=>setShowForm(false)}/>}
      <div className="filter-row">
        <Filter size={14}/>
        {['all','win','loss','open'].map((f)=>(
          <button key={f} className={`filter-btn ${filterResult===f?'filter-active':''}`} onClick={()=>setFilterResult(f)}>
            {{all:'الكل',win:'رابحة',loss:'خاسرة',open:'مفتوحة'}[f]}
          </button>
        ))}
      </div>
      <div className="trades-list">
        {filtered.length===0&&<div className="empty-state"><BarChart3 size={32}/><p>لا توجد صفقات. ابدأ بتسجيل أول صفقة.</p></div>}
        {filtered.map((t)=>(<TradeCard key={t.id} trade={t} onDelete={remove} analyzing={false}/>))}
      </div>
    </div>
  );
}
