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
  const financeCtx=source=>({recipes:recipeRows(),schedule:typeof schedule!=='undefined'?schedule:null,source});
  const timeOf=r=>/^\d{2}:\d{2}/.test(String(r?.time||''))?String(r.time).slice(0,5):(String(r?.session||'').includes('오후')?'14:00':String(r?.session||'').includes('기타')?'18:00':'10:00');
  const menuOf=r=>r?.menu||r?.recipeCandidate||r?.classTitle||'메뉴 미정';
  const statusOf=r=>B.effectiveStatus?B.effectiveStatus(r):(r?.status||'예정');
  const locationOf=r=>r?.venue||r?.location||schedule?.settings?.venue||schedule?.settings?.location||'달크닉 기준';
  let menuMetric='total';

  function dedupeDashboard(){document.querySelector('#dashboard .lean-signal-grid')?.remove()}
  function events(){
    const out=[];
    historyRows().forEach((r,i)=>out.push({source:'history',id:r.class_id||`h${i}`,date:r.date,time:timeOf(r),menu:menuOf(r),status:statusOf(r),raw:r}));
    scheduleRows().forEach((r,i)=>out.push({source:'schedule',id:r.class_id||r.id||`s${i}`,date:r.date,time:timeOf(r),menu:menuOf(r),status:statusOf(r),raw:r}));
    return (B.dedupeEvents?B.dedupeEvents(out):out).filter(e=>e.date&&e.status!=='취소').sort((a,b)=>a.date.localeCompare(b.date)||a.time.localeCompare(b.time));
  }
  function record(e){
    const f=B.classFinancials(e.raw,financeCtx(e.source));
    const people=Math.max(0,num(e.raw?.people)),fee=num(e.raw?.fee),revenue=num(f.revenue),material=f.material==null?null:num(f.material),rent=num(f.rent),packing=num(f.packing),other=num(f.other);
    const batch=Math.max(.01,num(f.batchCount)||num(e.raw?.batchCount)||1),recipe=f.recipe||null,recipeBatchCost=material==null?null:material/batch,profit=f.profit==null?null:num(f.profit),margin=profit==null||revenue<=0?null:profit/revenue*100;
    const perStudentProfit=profit==null||people<=0?null:profit/people,materialPerStudent=material==null||people<=0?null:material/people;
    const explicitRent=hasNum(e.raw?.rent),dow=B.dow?B.dow(e.date):'',weekdayRent=num(schedule?.settings?.weekdayRent)||81000,satRent=num(schedule?.settings?.satRent)||90000;
    const rentBasis=explicitRent?'수업에 저장된 대관료':dow==='토'?`토요일 기본 ${won(satRent)}`:`평일 기본 ${won(weekdayRent)}`,costLabel=material==null?(recipe?`원가 ${f.costStatus||'미산정'}`:'레시피 미연결'):`${won(recipeBatchCost)} × ${batch}배합`;
    return{...e,f,people,fee,revenue,material,rent,packing,other,profit,margin,perStudentProfit,materialPerStudent,batch,recipe,recipeBatchCost,rentBasis,location:locationOf(e.raw),costLabel,costable:profit!=null};
  }
  function range(){const t=todayISO(),a=$('periodStart')?.value||`${t.slice(0,7)}-01`,b=$('periodEnd')?.value||t;return[a,b]}
  function rangeRecords(){const[a,b]=range();return events().filter(e=>e.date>=a&&e.date<=b).map(record)}
  function summarize(recs){
    const s={revenue:0,people:0,count:recs.length,profit:0,costable:0,costableRevenue:0,costablePeople:0,costMaterial:0,costRent:0,costPacking:0,costOther:0};
    recs.forEach(x=>{s.revenue+=x.revenue;s.people+=x.people;if(x.costable){s.profit+=x.profit;s.costable++;s.costableRevenue+=x.revenue;s.costablePeople+=x.people;s.costMaterial+=x.material;s.costRent+=x.rent;s.costPacking+=x.packing;s.costOther+=x.other}});
    s.avgClassProfit=s.costable?s.profit/s.costable:null;s.avgStudentProfit=s.costablePeople?s.profit/s.costablePeople:null;s.margin=s.costableRevenue?s.profit/s.costableRevenue*100:null;s.costTotal=s.costMaterial+s.costRent+s.costPacking+s.costOther;return s;
  }
  function monthKeys(n=6){const[y,m]=todayISO().split('-').map(Number),out=[];for(let i=n-1;i>=0;i--){const d=new Date(Date.UTC(y,m-1-i,1));out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}`)}return out}
  function monthly(){
    const keys=monthKeys(),map=Object.fromEntries(keys.map(k=>[k,{month:k,revenue:0,costableRevenue:0,cost:0,profit:0,count:0,costable:0}]));
    events().map(record).forEach(x=>{const m=map[x.date.slice(0,7)];if(!m)return;m.revenue+=x.revenue;m.count++;if(x.costable){m.costableRevenue+=x.revenue;m.cost+=(x.material||0)+x.rent+x.packing+x.other;m.profit+=x.profit;m.costable++}});return keys.map(k=>map[k]);
  }
  function menuSummary(recs){
    const map=new Map();recs.forEach(x=>{if(!map.has(x.menu))map.set(x.menu,{menu:x.menu,count:0,people:0,revenue:0,profit:0,costable:0,costablePeople:0,costableRevenue:0,classes:[]});const m=map.get(x.menu);m.count++;m.people+=x.people;m.revenue+=x.revenue;m.classes.push(x);if(x.costable){m.profit+=x.profit;m.costable++;m.costablePeople+=x.people;m.costableRevenue+=x.revenue}});
    return[...map.values()].map(m=>({...m,avgClassProfit:m.costable?m.profit/m.costable:null,avgStudentProfit:m.costablePeople?m.profit/m.costablePeople:null,margin:m.costableRevenue?m.profit/m.costableRevenue*100:null}));
  }
  function metricValue(m){return menuMetric==='student'?m.avgStudentProfit:menuMetric==='class'?m.avgClassProfit:m.profit}
  function metricLabel(){return menuMetric==='student'?'인당 평균이익':menuMetric==='class'?'회당 평균이익':'누적 총이익'}
  function monthLabel(k){return`${Number(k.slice(5))}월`}
  function periodLabel(a,b){return a.slice(0,7)===b.slice(0,7)?`${Number(a.slice(5,7))}월`:`${a.replaceAll('-','.')}–${b.replaceAll('-','.')}`}

  function moneyFlow(s,a,b){
    if(!s.count)return'<section class="money-flow-card"><div class="ledger-empty">선택 기간에 수업이 없습니다.</div></section>';
    const excluded=Math.max(0,s.revenue-s.costableRevenue),startLabel=s.costable===s.count?'총매출':'이익 계산 대상 매출',startValue=s.costable===s.count?s.revenue:s.costableRevenue;
    const startNote=s.costable===s.count?`${s.count}회 · ${s.people}명`:`전체 매출 ${won(s.revenue)} · 원가 미연결 ${s.count-s.costable}회`;
    const unit=s.costable?`<div class="money-unit-strip"><span>회당 남음 <b>${won(s.avgClassProfit)}</b></span><span>인당 남음 <b>${won(s.avgStudentProfit)}</b></span><span>이익률 <b>${Math.round(s.margin||0)}%</b></span><small>원가 연결 ${s.costable}/${s.count}회${excluded?` · ${won(excluded)} 매출은 이익 계산 제외`:''}</small></div>`:'';
    return `<section class="money-flow-card"><div class="money-flow-head"><div><span>${esc(periodLabel(a,b))} MONEY FLOW</span><h3>돈이 들어와 어디로 빠지는지</h3></div></div>${s.costable?`<div class="money-flow-line"><div class="money-node start"><span>${startLabel}</span><b>${won(startValue)}</b><small>${startNote}</small></div><em>→</em><div class="money-node cost"><span>재료비</span><b>− ${won(s.costMaterial)}</b></div><em>→</em><div class="money-node cost"><span>대관비</span><b>− ${won(s.costRent)}</b></div><em>→</em><div class="money-node cost"><span>포장·기타</span><b>− ${won(s.costPacking+s.costOther)}</b></div><em>→</em><div class="money-node result"><span>남는 돈</span><b>${won(s.profit)}</b></div></div>${unit}`:`<div class="money-flow-unavailable"><b>총매출 ${won(s.revenue)}</b><span>아직 원가가 연결된 수업이 없어 남는 돈을 계산할 수 없습니다.</span></div>`}</section>`;
  }

  function monthlyFlowPanel(rows,selectedMonth){
    const show=rows.filter(x=>x.month!==selectedMonth).slice(-5);
    if(!show.length)return'<div class="ledger-empty">비교할 지난달 데이터가 없습니다.</div>';
    return `<div class="month-flow-list">${show.map(x=>{const base=Math.max(1,x.costableRevenue),costPct=Math.max(0,Math.min(100,x.cost/base*100)),profitPct=x.profit>0?Math.max(0,Math.min(100,x.profit/base*100)):0;return`<div class="month-flow-row"><b>${monthLabel(x.month)}</b><div class="month-flow-track" title="계산대상 매출 ${won(x.costableRevenue)}"><i class="cost" style="width:${costPct}%"></i><i class="profit ${x.profit<0?'negative':''}" style="width:${profitPct}%"></i></div><div class="month-flow-values"><span>총매출 <strong>${won(x.revenue)}</strong></span><span>비용 <strong>${x.costable?won(x.cost):'—'}</strong></span><span>남음 <strong>${x.costable?won(x.profit):'—'}</strong></span></div><small>원가 ${x.costable}/${x.count}회</small></div>`}).join('')}</div><div class="ledger-caption">선택한 달은 위 돈 흐름에서 한 번만 보여주고, 여기에는 비교용 지난달만 표시합니다.</div>`;
  }

  function menuDetail(m){const classes=m.classes.slice().sort((a,b)=>b.date.localeCompare(a.date)||b.time.localeCompare(a.time));return `<div class="ledger-caption">${m.margin==null?'이익률 계산 보류':`이익률 ${Math.round(m.margin)}%`} · 날짜별 근거</div><div class="menu-class-lines">${classes.map(x=>`<div><time>${esc(x.date)} ${esc(x.time)}</time><span>${x.people}명 · 매출 ${won(x.revenue)}</span><span>재료 ${x.material==null?'—':won(x.material)} · 대관 ${won(x.rent)}</span><b>${x.profit==null?'이익 보류':`${won(x.profit)} · 인당 ${won(x.perStudentProfit)}`}</b></div>`).join('')}</div>`}
  function menuRanking(menus){
    const usable=menus.filter(x=>metricValue(x)!=null).sort((a,b)=>metricValue(b)-metricValue(a)).slice(0,6),max=Math.max(1,...usable.map(x=>Math.abs(metricValue(x))));
    return `<div class="menu-metric-switch"><button data-menu-metric="total" class="${menuMetric==='total'?'active':''}">총이익</button><button data-menu-metric="class" class="${menuMetric==='class'?'active':''}">회당</button><button data-menu-metric="student" class="${menuMetric==='student'?'active':''}">인당</button></div>${usable.length?`<div class="menu-rank-list">${usable.map((m,i)=>{const v=metricValue(m);return`<details class="menu-rank-item"><summary><em>${i+1}</em><div class="menu-rank-name"><b>${esc(m.menu)}</b><small>${m.count}회 · ${m.people}명 · 원가 ${m.costable}/${m.count}</small></div><div class="menu-rank-bar"><i class="${v<0?'negative':''}" style="width:${Math.max(2,Math.abs(v)/max*100)}%"></i></div><strong>${won(v)}</strong></summary><div class="menu-rank-body">${menuDetail(m)}</div></details>`}).join('')}</div>`:'<div class="ledger-empty">비교 가능한 메뉴 이익 데이터가 없습니다.</div>'}<div class="ledger-caption">현재 순위 기준: ${metricLabel()}.</div>`;
  }
  function classBreakdown(recs){
    if(!recs.length)return'<div class="ledger-empty">선택 기간에 수업이 없습니다.</div>';
    return `<div class="class-detail-list">${recs.slice().sort((a,b)=>b.date.localeCompare(a.date)||b.time.localeCompare(a.time)).map(x=>`<details class="class-detail-item"><summary><div><time>${esc(x.date)} ${esc(x.time)}</time><b>${esc(x.menu)}</b><small>${x.people}명 · ${x.profit==null?'원가 미연결':`이익 ${won(x.profit)}`}</small></div></summary><div class="class-formula"><div><span>매출</span><b>${won(x.revenue)}</b><small>${x.people}명 × ${won(x.fee)}</small></div><em>−</em><div><span>재료비</span><b>${x.material==null?'—':won(x.material)}</b><small>${x.recipe?`${esc(x.recipe.name)} · ${esc(x.costLabel)}${x.materialPerStudent==null?'':` · 인당 ${won(x.materialPerStudent)}`}`:'레시피 미연결'}</small></div><em>−</em><div><span>대관비</span><b>${won(x.rent)}</b><small>${esc(x.date)} ${B.dow?B.dow(x.date):''} · ${esc(x.location)} · ${esc(x.rentBasis)}</small></div><em>−</em><div><span>포장·기타</span><b>${won(x.packing+x.other)}</b><small>포장 ${won(x.packing)} · 기타 ${won(x.other)}</small></div><em>=</em><div class="result"><span>이익</span><b>${x.profit==null?'계산 보류':won(x.profit)}</b><small>${x.profit==null?'원가 연결 필요':`인당 ${won(x.perStudentProfit)} · 이익률 ${Math.round(x.margin||0)}%`}</small></div></div></details>`).join('')}</div>`;
  }
  function ensureHost(){
    const page=$('finance'),fields=page?.querySelector('.period-fields');if(!page||!fields)return null;let host=$('financeLedgerDetail');if(!host){host=document.createElement('div');host.id='financeLedgerDetail';host.className='finance-ledger-detail';fields.insertAdjacentElement('afterend',host)}
    const old=$('financeVisual');if(old){old.hidden=true;old.style.display='none'}if($('financeKpis')){$('financeKpis').hidden=true;$('financeKpis').style.display='none'}const next=$('nextMonthKpis')?.closest('.card');if(next){next.hidden=true;next.style.display='none'}
    [...page.querySelectorAll(':scope > .card')].forEach(card=>{const h=card.querySelector(':scope > h3');if(h&&['메뉴별 집계','수업별 내역'].includes(h.textContent.trim())){card.hidden=true;card.style.display='none'}});const ing=$('ingredientGrid')?.closest('details');if(ing){ing.hidden=true;ing.style.display='none'}const audit=$('dataAudit')?.closest('details');if(audit){audit.hidden=true;audit.style.display='none'}return host;
  }
  function labelSurface(){const head=$('finance')?.querySelector('.section-head');if(head){head.querySelector('h2')?.replaceChildren(document.createTextNode('재정 · 수익'));head.querySelector('p')?.replaceChildren(document.createTextNode('매출이 들어와 비용으로 빠지고 얼마가 남는지 한 방향으로 봅니다.'))}}
  function render(){
    dedupeDashboard();const host=ensureHost();if(!host)return;labelSurface();const recs=rangeRecords(),s=summarize(recs),months=monthly(),menus=menuSummary(recs),[a,b]=range(),selectedMonth=a.slice(0,7)===b.slice(0,7)?a.slice(0,7):'';
    host.innerHTML=`${moneyFlow(s,a,b)}<div class="finance-core-grid"><section class="ledger-card"><div class="ledger-head"><div><h3>지난달과 비교</h3><p>각 달의 매출 → 비용 → 남는 돈을 정확한 금액으로 봅니다.</p></div></div>${monthlyFlowPanel(months,selectedMonth)}</section><section class="ledger-card"><div class="ledger-head"><div><h3>메뉴 수익성</h3><p>어떤 메뉴가 실제 수익원이 되는지 비교합니다.</p></div></div>${menuRanking(menus)}</section></div><details class="ledger-detail-shell"><summary><span>수업별 손익 근거</span><small>필요할 때만 날짜별 계산식 열기</small></summary><div>${classBreakdown(recs)}</div></details><div class="ledger-note">재료비는 레시피 원가 × 실제 배합수입니다. 원가가 없는 수업은 남는 돈을 임의로 만들지 않습니다.</div>`;
  }
  document.addEventListener('click',e=>{const metric=e.target.closest('[data-menu-metric]');if(metric){menuMetric=metric.dataset.menuMetric;render();return}if(e.target.closest('#finance [data-period],#finance #applyPeriod'))setTimeout(render,80)},true);
  document.addEventListener('change',e=>{if(e.target.closest('#finance #periodStart,#finance #periodEnd'))setTimeout(render,40)},true);
  try{const base=renderFinance;renderFinance=function(...args){const out=base.apply(this,args);setTimeout(render,25);return out}}catch(e){}
  try{const base=renderAll;renderAll=function(...args){const out=base.apply(this,args);setTimeout(()=>{dedupeDashboard();render()},140);return out}}catch(e){}
  setTimeout(()=>{dedupeDashboard();render()},1000);
})();