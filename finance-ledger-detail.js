(() => {
  const B=window.BakingBusiness;
  if(!B)return;
  const $=id=>document.getElementById(id);
  const num=v=>Number.isFinite(Number(v))?Number(v):0;
  const hasNum=v=>v!==''&&v!=null&&Number.isFinite(Number(v));
  const won=v=>Number.isFinite(Number(v))?'₩'+Math.round(Number(v)).toLocaleString('ko-KR'):'—';
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const todayISO=()=>B.zonedDate?B.zonedDate(new Date()):new Date().toLocaleDateString('en-CA');
  const recipeRows=()=>typeof recipes!=='undefined'&&Array.isArray(recipes)?recipes:[];
  const scheduleRows=()=>typeof schedule!=='undefined'&&Array.isArray(schedule?.rows)?schedule.rows:[];
  const historyRows=()=>typeof history!=='undefined'&&Array.isArray(history?.records)?history.records:[];
  const timeOf=r=>/^\d{2}:\d{2}/.test(String(r?.time||''))?String(r.time).slice(0,5):(String(r?.session||'').includes('오후')?'14:00':String(r?.session||'').includes('기타')?'18:00':'10:00');
  const menuOf=r=>r?.menu||r?.recipeCandidate||r?.classTitle||'메뉴 미정';
  const classStatus=r=>B.effectiveStatus?B.effectiveStatus(r):(r?.status||'예정');
  const financeCtx=source=>({recipes:recipeRows(),schedule:typeof schedule!=='undefined'?schedule:null,source});
  const locationOf=r=>r?.venue||r?.location||schedule?.settings?.venue||schedule?.settings?.location||'달크닉 기준';

  function events(){
    const out=[];
    historyRows().forEach((r,i)=>out.push({source:'history',id:r.class_id||`h${i}`,date:r.date,time:timeOf(r),menu:menuOf(r),status:classStatus(r),raw:r}));
    scheduleRows().forEach((r,i)=>out.push({source:'schedule',id:r.class_id||r.id||`s${i}`,date:r.date,time:timeOf(r),menu:menuOf(r),status:classStatus(r),raw:r}));
    return (B.dedupeEvents?B.dedupeEvents(out):out).filter(e=>e.date&&e.status!=='취소').sort((a,b)=>a.date.localeCompare(b.date)||a.time.localeCompare(b.time));
  }
  function record(e){
    const f=B.classFinancials(e.raw,financeCtx(e.source));
    const people=Math.max(0,num(e.raw?.people)),fee=num(e.raw?.fee),material=f.material==null?null:num(f.material),rent=num(f.rent),packing=num(f.packing),other=num(f.other),knownSpend=(material==null?0:material)+rent+packing+other;
    const batch=Math.max(.01,num(f.batchCount)||1),recipe=f.recipe||null,recipeBatchCost=material==null?null:material/batch;
    const explicitRent=hasNum(e.raw?.rent),dow=B.dow?B.dow(e.date):'',weekdayRent=num(schedule?.settings?.weekdayRent)||81000,satRent=num(schedule?.settings?.satRent)||90000;
    const rentBasis=explicitRent?'수업에 저장된 대관료':dow==='토'?`토요일 기본 ${won(satRent)}`:`평일 기본 ${won(weekdayRent)}`;
    const sourceLabel=e.source==='history'?'완료 기록':'일정';
    const costLabel=material==null?(recipe?`원가 ${f.costStatus||'미산정'}`:'레시피 미연결'):`${won(recipeBatchCost)} × ${batch}배합`;
    return{...e,f,people,fee,revenue:num(f.revenue),material,rent,packing,other,knownSpend,total:f.total==null?null:num(f.total),profit:f.profit==null?null:num(f.profit),margin:f.margin==null?null:num(f.margin),batch,recipe,recipeBatchCost,rentBasis,location:locationOf(e.raw),sourceLabel,costLabel,costComplete:f.total!=null};
  }
  function range(){const t=todayISO(),a=$('periodStart')?.value||`${t.slice(0,7)}-01`,b=$('periodEnd')?.value||t;return[a,b]}
  function rangeRecords(){const[a,b]=range();return events().filter(e=>e.date>=a&&e.date<=b).map(record)}
  function monthKeys(n=6){const[y,m]=todayISO().split('-').map(Number),out=[];for(let i=n-1;i>=0;i--){const d=new Date(Date.UTC(y,m-1-i,1));out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}`)}return out}
  function monthly(){
    const keys=monthKeys(),map=Object.fromEntries(keys.map(k=>[k,{month:k,revenue:0,material:0,rent:0,packing:0,other:0,knownSpend:0,profit:0,count:0,costable:0,costableRevenue:0}]));
    events().map(record).forEach(x=>{const k=x.date.slice(0,7),m=map[k];if(!m)return;m.count++;m.revenue+=x.revenue;m.material+=x.material==null?0:x.material;m.rent+=x.rent;m.packing+=x.packing;m.other+=x.other;m.knownSpend+=x.knownSpend;if(x.profit!=null){m.profit+=x.profit;m.costable++;m.costableRevenue+=x.revenue}});return keys.map(k=>map[k]);
  }
  function summarize(recs){
    const s={revenue:0,material:0,rent:0,packing:0,other:0,knownSpend:0,profit:0,count:recs.length,costable:0,costableRevenue:0};
    recs.forEach(x=>{s.revenue+=x.revenue;s.material+=x.material==null?0:x.material;s.rent+=x.rent;s.packing+=x.packing;s.other+=x.other;s.knownSpend+=x.knownSpend;if(x.profit!=null){s.profit+=x.profit;s.costable++;s.costableRevenue+=x.revenue}});s.margin=s.costableRevenue?s.profit/s.costableRevenue*100:null;return s;
  }
  function menuSummary(recs){
    const map=new Map();
    recs.forEach(x=>{if(!map.has(x.menu))map.set(x.menu,{menu:x.menu,count:0,people:0,revenue:0,material:0,rent:0,packing:0,other:0,knownSpend:0,profit:0,costable:0,costableRevenue:0,classes:[]});const m=map.get(x.menu);m.count++;m.people+=x.people;m.revenue+=x.revenue;m.material+=x.material==null?0:x.material;m.rent+=x.rent;m.packing+=x.packing;m.other+=x.other;m.knownSpend+=x.knownSpend;m.classes.push(x);if(x.profit!=null){m.profit+=x.profit;m.costable++;m.costableRevenue+=x.revenue}});
    return[...map.values()].map(x=>({...x,avgProfit:x.costable?x.profit/x.costable:null,margin:x.costableRevenue?x.profit/x.costableRevenue*100:null})).sort((a,b)=>(b.profit||-Infinity)-(a.profit||-Infinity)||b.revenue-a.revenue);
  }
  function monthLabel(k){const[y,m]=k.split('-');return`${y}.${m}`}
  function monthlyChart(rows){
    const max=Math.max(1,...rows.flatMap(x=>[x.revenue,x.knownSpend,Math.abs(x.profit)]));
    return `<div class="ledger-month-chart">${rows.map(x=>`<div class="ledger-month-col"><div class="ledger-bars"><i class="revenue" style="height:${Math.max(2,x.revenue/max*100)}%" title="${monthLabel(x.month)} 매출 ${won(x.revenue)}"></i><i class="spend" style="height:${Math.max(1,x.knownSpend/max*100)}%" title="${monthLabel(x.month)} 확인비용 ${won(x.knownSpend)}"></i><i class="profit ${x.profit<0?'negative':''}" style="height:${Math.max(1,Math.abs(x.profit)/max*100)}%" title="${monthLabel(x.month)} 계산가능 이익 ${won(x.profit)}"></i></div><b>${Number(x.month.slice(5))}월</b></div>`).join('')}</div><div class="ledger-legend"><span><i class="revenue"></i>매출</span><span><i class="spend"></i>확인비용</span><span><i class="profit"></i>계산가능 이익</span></div>`;
  }
  function monthlyTable(rows){
    return `<div class="ledger-table-wrap"><table class="ledger-table ledger-month-table"><thead><tr><th>월</th><th>수업</th><th>매출</th><th>재료비</th><th>대관비</th><th>포장·기타</th><th>확인비용</th><th>계산가능 이익</th><th>원가 연결</th></tr></thead><tbody>${rows.map(x=>`<tr><td><b>${monthLabel(x.month)}</b></td><td>${x.count}회</td><td>${won(x.revenue)}</td><td>${won(x.material)}</td><td>${won(x.rent)}</td><td>${won(x.packing+x.other)}</td><td>${won(x.knownSpend)}</td><td class="${x.profit<0?'neg':''}">${x.costable?won(x.profit):'—'}</td><td>${x.costable}/${x.count}</td></tr>`).join('')}</tbody></table></div>`;
  }
  function costSummary(s){
    const items=[['재료비',s.material],['대관비',s.rent],['포장비',s.packing],['기타비',s.other]],max=Math.max(1,...items.map(x=>x[1]));
    return `<div class="ledger-cost-summary">${items.map(([label,v])=>`<div><header><span>${label}</span><b>${won(v)}</b></header><div><i style="width:${Math.max(v?2:0,v/max*100)}%"></i></div></div>`).join('')}</div>`;
  }
  function classBreakdown(recs){
    if(!recs.length)return'<div class="ledger-empty">선택 기간에 수업이 없습니다.</div>';
    return `<div class="ledger-class-list">${recs.slice().sort((a,b)=>b.date.localeCompare(a.date)||b.time.localeCompare(a.time)).map(x=>`<details class="ledger-class"><summary><div><time>${esc(x.date)} ${esc(x.time)}</time><b>${esc(x.menu)}</b><small>${x.people}명 × ${won(x.fee)} · ${esc(x.sourceLabel)}</small></div><div><span>매출 ${won(x.revenue)}</span><strong>${x.profit==null?'이익 계산 보류':`이익 ${won(x.profit)}`}</strong></div></summary><div class="ledger-class-body"><div class="ledger-formula"><div><span>매출</span><b>${won(x.revenue)}</b><small>${x.people}명 × ${won(x.fee)}${hasNum(x.raw?.revenue)?' · 저장 매출값 우선':''}</small></div><em>−</em><div><span>재료비</span><b>${x.material==null?'—':won(x.material)}</b><small>${x.recipe?`${esc(x.recipe.name)} · ${esc(x.costLabel)}`:'레시피 미연결'}</small></div><em>−</em><div><span>대관비</span><b>${won(x.rent)}</b><small>${esc(x.date)} ${B.dow?B.dow(x.date):''} · ${esc(x.location)} · ${esc(x.rentBasis)}</small></div><em>−</em><div><span>포장·기타</span><b>${won(x.packing+x.other)}</b><small>포장 ${won(x.packing)} · 기타 ${won(x.other)}</small></div><em>=</em><div class="result"><span>${x.f.profitLabel||'이익'}</span><b>${x.profit==null?'계산 보류':won(x.profit)}</b><small>${x.profit==null?'재료 원가 연결 필요':`이익률 ${Math.round(x.margin||0)}%`}</small></div></div>${x.material==null?`<div class="ledger-warning">${x.recipe?`${esc(x.recipe.name)}의 원가 상태가 ${esc(x.f.costStatus||'미산정')}라서 이 수업의 총비용·이익은 확정하지 않습니다.`:'레시피가 연결되지 않아 재료비와 이익을 계산하지 않습니다.'}</div>`:''}</div></details>`).join('')}</div>`;
  }
  function menuBreakdown(items){
    if(!items.length)return'<div class="ledger-empty">선택 기간에 메뉴 데이터가 없습니다.</div>';
    return `<div class="ledger-menu-list">${items.map((m,i)=>`<details class="ledger-menu"><summary><span class="rank">${i+1}</span><div><b>${esc(m.menu)}</b><small>${m.count}회 · ${m.people}명 · 원가 연결 ${m.costable}/${m.count}회</small></div><div><span>매출 ${won(m.revenue)}</span><strong>${m.costable?`총이익 ${won(m.profit)}`:'이익 계산 보류'}</strong><small>${m.avgProfit==null?'':`회당 ${won(m.avgProfit)} · 이익률 ${Math.round(m.margin||0)}%`}</small></div></summary><div class="ledger-menu-body"><div class="ledger-menu-numbers"><div><span>누적 매출</span><b>${won(m.revenue)}</b></div><div><span>재료비 확인분</span><b>${won(m.material)}</b></div><div><span>대관비</span><b>${won(m.rent)}</b></div><div><span>포장·기타</span><b>${won(m.packing+m.other)}</b></div><div><span>계산가능 총이익</span><b>${m.costable?won(m.profit):'—'}</b></div><div><span>회당 평균이익</span><b>${m.avgProfit==null?'—':won(m.avgProfit)}</b></div></div><div class="ledger-menu-classes">${m.classes.slice().sort((a,b)=>b.date.localeCompare(a.date)).map(x=>`<div><time>${esc(x.date)} ${esc(x.time)}</time><span>${x.people}명 · 매출 ${won(x.revenue)}</span><span>재료 ${x.material==null?'—':won(x.material)} · 대관 ${won(x.rent)}</span><b>${x.profit==null?'이익 보류':won(x.profit)}</b></div>`).join('')}</div></div></details>`).join('')}</div>`;
  }
  function ensureHost(){
    const page=$('finance'),fields=page?.querySelector('.period-fields');if(!page||!fields)return null;
    let host=$('financeLedgerDetail');if(!host){host=document.createElement('div');host.id='financeLedgerDetail';host.className='finance-ledger-detail';fields.insertAdjacentElement('afterend',host)}
    const old=$('financeVisual');if(old)old.hidden=true;return host;
  }
  function render(){
    const host=ensureHost();if(!host)return;const recs=rangeRecords(),s=summarize(recs),months=monthly(),menus=menuSummary(recs),margin=s.margin==null?'—':`${Math.round(s.margin)}%`;
    host.innerHTML=`<div class="ledger-kpis"><div><span>선택 기간 매출</span><b>${won(s.revenue)}</b><small>${s.count}회 수업</small></div><div><span>확인된 운영비</span><b>${won(s.knownSpend)}</b><small>재료 원가 연결 ${s.costable}/${s.count}회</small></div><div><span>계산가능 이익</span><b>${s.costable?won(s.profit):'계산 보류'}</b><small>원가 연결 매출 ${won(s.costableRevenue)}</small></div><div><span>계산가능 이익률</span><b>${margin}</b><small>원가 연결 수업 기준</small></div></div><section class="ledger-card"><div class="ledger-head"><div><h3>월별 돈의 흐름</h3><p>그래프는 흐름을 보고, 바로 아래 표에서 월별 정확한 원 단위 금액을 확인합니다.</p></div></div>${monthlyChart(months)}${monthlyTable(months)}</section><div class="ledger-grid"><section class="ledger-card"><div class="ledger-head"><div><h3>비용이 어디에 쓰였나</h3><p>선택 기간 전체 운영비 브레이크다운입니다.</p></div></div>${costSummary(s)}</section><section class="ledger-card"><div class="ledger-head"><div><h3>수업별 손익 브레이크다운</h3><p>각 수업의 매출·재료비·대관비·기타비가 어떻게 이익으로 이어졌는지 확인합니다.</p></div></div>${classBreakdown(recs)}</section></div><section class="ledger-card"><div class="ledger-head"><div><h3>메뉴별 수익성 브레이크다운</h3><p>누적 수익뿐 아니라 그 메뉴를 언제 진행했고 각 수업에서 얼마가 남았는지 펼쳐봅니다.</p></div></div>${menuBreakdown(menus)}</section><div class="ledger-note">재료 원가가 연결되지 않은 수업은 대관비 등 확인 가능한 비용은 보여주되 총비용과 이익은 임의로 완성하지 않습니다. 과거 수업 매출은 완료 실적으로 봅니다.</div>`;
  }
  try{const base=renderFinance;renderFinance=function(...args){const out=base.apply(this,args);setTimeout(render,20);return out}}catch(e){}
  try{const base=renderAll;renderAll=function(...args){const out=base.apply(this,args);setTimeout(render,130);return out}}catch(e){}
  document.addEventListener('click',e=>{if(e.target.closest('#finance [data-period],#finance #applyPeriod'))setTimeout(render,80)},true);
  document.addEventListener('change',e=>{if(e.target.closest('#finance #periodStart,#finance #periodEnd'))setTimeout(render,40)},true);
  setTimeout(render,1000);
})();