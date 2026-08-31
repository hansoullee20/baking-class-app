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

  function events(){
    const out=[];
    historyRows().forEach((r,i)=>out.push({source:'history',id:r.class_id||`h${i}`,date:r.date,time:timeOf(r),menu:menuOf(r),status:statusOf(r),raw:r}));
    scheduleRows().forEach((r,i)=>out.push({source:'schedule',id:r.class_id||r.id||`s${i}`,date:r.date,time:timeOf(r),menu:menuOf(r),status:statusOf(r),raw:r}));
    return (B.dedupeEvents?B.dedupeEvents(out):out).filter(e=>e.date&&e.status!=='취소').sort((a,b)=>a.date.localeCompare(b.date)||a.time.localeCompare(b.time));
  }

  function record(e){
    const f=B.classFinancials(e.raw,financeCtx(e.source));
    const people=Math.max(0,num(e.raw?.people)),fee=num(e.raw?.fee),revenue=num(f.revenue);
    const material=f.material==null?null:num(f.material),rent=num(f.rent),packing=num(f.packing),other=num(f.other);
    const batch=Math.max(.01,num(f.batchCount)||num(e.raw?.batchCount)||1),recipe=f.recipe||null,recipeBatchCost=material==null?null:material/batch;
    const profit=f.profit==null?null:num(f.profit),margin=profit==null||revenue<=0?null:profit/revenue*100;
    const perStudentProfit=profit==null||people<=0?null:profit/people,materialPerStudent=material==null||people<=0?null:material/people;
    const explicitRent=hasNum(e.raw?.rent),dow=B.dow?B.dow(e.date):'',weekdayRent=num(schedule?.settings?.weekdayRent)||81000,satRent=num(schedule?.settings?.satRent)||90000;
    const rentBasis=explicitRent?'수업에 저장된 대관료':dow==='토'?`토요일 기본 ${won(satRent)}`:`평일 기본 ${won(weekdayRent)}`;
    const costLabel=material==null?(recipe?`원가 ${f.costStatus||'미산정'}`:'레시피 미연결'):`${won(recipeBatchCost)} × ${batch}배합`;
    return{...e,f,people,fee,revenue,material,rent,packing,other,profit,margin,perStudentProfit,materialPerStudent,batch,recipe,recipeBatchCost,rentBasis,location:locationOf(e.raw),costLabel,costable:profit!=null};
  }

  function range(){const t=todayISO(),a=$('periodStart')?.value||`${t.slice(0,7)}-01`,b=$('periodEnd')?.value||t;return[a,b]}
  function rangeRecords(){const[a,b]=range();return events().filter(e=>e.date>=a&&e.date<=b).map(record)}

  function summarize(recs){
    const s={revenue:0,people:0,count:recs.length,profit:0,costable:0,costableRevenue:0,costablePeople:0,costMaterial:0,costRent:0,costPacking:0,costOther:0};
    recs.forEach(x=>{
      s.revenue+=x.revenue;s.people+=x.people;
      if(x.costable){s.profit+=x.profit;s.costable++;s.costableRevenue+=x.revenue;s.costablePeople+=x.people;s.costMaterial+=x.material;s.costRent+=x.rent;s.costPacking+=x.packing;s.costOther+=x.other}
    });
    s.avgClassProfit=s.costable?s.profit/s.costable:null;
    s.avgStudentProfit=s.costablePeople?s.profit/s.costablePeople:null;
    s.margin=s.costableRevenue?s.profit/s.costableRevenue*100:null;
    return s;
  }

  function monthKeys(n=6){const[y,m]=todayISO().split('-').map(Number),out=[];for(let i=n-1;i>=0;i--){const d=new Date(Date.UTC(y,m-1-i,1));out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}`)}return out}
  function monthly(){
    const keys=monthKeys(),map=Object.fromEntries(keys.map(k=>[k,{month:k,revenue:0,profit:0,count:0,costable:0}]));
    events().map(record).forEach(x=>{const m=map[x.date.slice(0,7)];if(!m)return;m.revenue+=x.revenue;m.count++;if(x.costable){m.profit+=x.profit;m.costable++}});
    return keys.map(k=>map[k]);
  }

  function menuSummary(recs){
    const map=new Map();
    recs.forEach(x=>{
      if(!map.has(x.menu))map.set(x.menu,{menu:x.menu,count:0,people:0,revenue:0,profit:0,costable:0,costablePeople:0,costableRevenue:0,classes:[]});
      const m=map.get(x.menu);m.count++;m.people+=x.people;m.revenue+=x.revenue;m.classes.push(x);
      if(x.costable){m.profit+=x.profit;m.costable++;m.costablePeople+=x.people;m.costableRevenue+=x.revenue}
    });
    return[...map.values()].map(m=>({...m,avgClassProfit:m.costable?m.profit/m.costable:null,avgStudentProfit:m.costablePeople?m.profit/m.costablePeople:null,margin:m.costableRevenue?m.profit/m.costableRevenue*100:null}));
  }

  function metricValue(m){return menuMetric==='student'?m.avgStudentProfit:menuMetric==='class'?m.avgClassProfit:m.profit}
  function metricLabel(){return menuMetric==='student'?'인당 평균이익':menuMetric==='class'?'회당 평균이익':'누적 총이익'}
  function monthLabel(k){return`${Number(k.slice(5))}월`}

  function kpis(s){
    return `<div class="ledger-kpis"><div><span>총매출</span><b>${won(s.revenue)}</b><small>${s.count}회 · ${s.people}명</small></div><div><span>계산가능 총이익</span><b>${s.costable?won(s.profit):'계산 보류'}</b><small>원가 연결 ${s.costable}/${s.count}회</small></div><div><span>수업 1회당 평균이익</span><b>${s.avgClassProfit==null?'—':won(s.avgClassProfit)}</b><small>원가 연결 수업 기준</small></div><div><span>수강생 1명당 평균이익</span><b>${s.avgStudentProfit==null?'—':won(s.avgStudentProfit)}</b><small>${s.costablePeople}명 기준</small></div></div>`;
  }

  function expensePanel(s){
    if(!s.costable)return'<div class="ledger-empty">원가가 연결된 수업이 없어 비용 구조를 계산할 수 없습니다.</div>';
    const rows=[['재료비',s.costMaterial],['대관비',s.costRent],['포장·기타',s.costPacking+s.costOther]],total=rows.reduce((a,x)=>a+x[1],0),max=Math.max(1,...rows.map(x=>x[1]));
    return `<div class="expense-focus-list">${rows.map(([label,v])=>`<div class="expense-focus-row"><span>${label}</span><div><i style="width:${v/max*100}%"></i></div><b>${won(v)}</b><small>${total?Math.round(v/total*100):0}%</small></div>`).join('')}</div><div class="ledger-caption">원가가 연결된 ${s.costable}/${s.count}회 수업의 비용만 합산합니다.</div>`;
  }

  function monthlyPanel(rows){
    const max=Math.max(1,...rows.flatMap(x=>[x.revenue,Math.abs(x.profit)]));
    return `<div class="month-compact-chart">${rows.map(x=>`<div class="month-compact"><div class="month-bars"><i class="revenue" style="height:${Math.max(2,x.revenue/max*100)}%"></i><i class="profit ${x.profit<0?'negative':''}" style="height:${Math.max(2,Math.abs(x.profit)/max*100)}%"></i></div><b>${monthLabel(x.month)}</b><span>매출 ${won(x.revenue)}</span><span>이익 ${x.costable?won(x.profit):'—'}</span><small>원가 ${x.costable}/${x.count}</small></div>`).join('')}</div><div class="ledger-legend"><span><i class="revenue"></i>매출</span><span><i class="profit"></i>계산가능 이익</span></div>`;
  }

  function menuDetail(m){
    const classes=m.classes.slice().sort((a,b)=>b.date.localeCompare(a.date)||b.time.localeCompare(a.time));
    return `<div class="menu-detail-note">${m.margin==null?'이익률 계산 보류':`이익률 ${Math.round(m.margin)}%`} · 날짜별 근거</div><div class="menu-class-lines">${classes.map(x=>`<div><time>${esc(x.date)} ${esc(x.time)}</time><span>${x.people}명 · 매출 ${won(x.revenue)}</span><span>재료 ${x.material==null?'—':won(x.material)} · 대관 ${won(x.rent)}</span><b>${x.profit==null?'이익 보류':`${won(x.profit)} · 인당 ${won(x.perStudentProfit)}`}</b></div>`).join('')}</div>`;
  }

  function menuRanking(menus){
    const usable=menus.filter(x=>metricValue(x)!=null).sort((a,b)=>metricValue(b)-metricValue(a)).slice(0,6),max=Math.max(1,...usable.map(x=>Math.abs(metricValue(x))));
    return `<div class="menu-metric-switch"><button data-menu-metric="total" class="${menuMetric==='total'?'active':''}">총이익</button><button data-menu-metric="class" class="${menuMetric==='class'?'active':''}">회당</button><button data-menu-metric="student" class="${menuMetric==='student'?'active':''}">인당</button></div>${usable.length?`<div class="menu-rank-list">${usable.map((m,i)=>{const v=metricValue(m);return`<details class="menu-rank-item"><summary><em>${i+1}</em><div class="menu-rank-name"><b>${esc(m.menu)}</b><small>${m.count}회 · ${m.people}명 · 원가 ${m.costable}/${m.count}</small></div><div class="menu-rank-bar"><i class="${v<0?'negative':''}" style="width:${Math.max(2,Math.abs(v)/max*100)}%"></i></div><strong>${won(v)}</strong></summary><div class="menu-rank-body">${menuDetail(m)}</div></details>`}).join('')}</div>`:'<div class="ledger-empty">비교 가능한 메뉴 이익 데이터가 없습니다.</div>'}<div class="ledger-caption">현재 순위 기준: ${metricLabel()}. 다른 기준은 위 버튼으로 바꿉니다.</div>`;
  }

  function classBreakdown(recs){
    if(!recs.length)return'<div class="ledger-empty">선택 기간에 수업이 없습니다.</div>';
    return `<div class="class-detail-list">${recs.slice().sort((a,b)=>b.date.localeCompare(a.date)||b.time.localeCompare(a.time)).map(x=>`<details class="class-detail-item"><summary><div><time>${esc(x.date)} ${esc(x.time)}</time><b>${esc(x.menu)}</b><small>${x.people}명 · ${x.profit==null?'원가 미연결':`이익 ${won(x.profit)}`}</small></div></summary><div class="class-formula"><div><span>매출</span><b>${won(x.revenue)}</b><small>${x.people}명 × ${won(x.fee)}</small></div><em>−</em><div><span>재료비</span><b>${x.material==null?'—':won(x.material)}</b><small>${x.recipe?`${esc(x.recipe.name)} · ${esc(x.costLabel)}${x.materialPerStudent==null?'':` · 인당 ${won(x.materialPerStudent)}`}`:'레시피 미연결'}</small></div><em>−</em><div><span>대관비</span><b>${won(x.rent)}</b><small>${esc(x.date)} ${B.dow?B.dow(x.date):''} · ${esc(x.location)} · ${esc(x.rentBasis)}</small></div><em>−</em><div><span>포장·기타</span><b>${won(x.packing+x.other)}</b><small>포장 ${won(x.packing)} · 기타 ${won(x.other)}</small></div><em>=</em><div class="result"><span>이익</span><b>${x.profit==null?'계산 보류':won(x.profit)}</b><small>${x.profit==null?'원가 연결 필요':`인당 ${won(x.perStudentProfit)} · 이익률 ${Math.round(x.margin||0)}%`}</small></div></div></details>`).join('')}</div>`;
  }

  function ensureHost(){
    const page=$('finance'),fields=page?.querySelector('.period-fields');if(!page||!fields)return null;
    let host=$('financeLedgerDetail');if(!host){host=document.createElement('div');host.id='financeLedgerDetail';host.className='finance-ledger-detail';fields.insertAdjacentElement('afterend',host)}
    const old=$('financeVisual');if(old)old.hidden=true;
    if($('financeKpis'))$('financeKpis').hidden=true;
    const next=$('nextMonthKpis')?.closest('.card');if(next)next.hidden=true;
    [...page.querySelectorAll(':scope > .card')].forEach(card=>{const h=card.querySelector(':scope > h3');if(h&&['메뉴별 집계','수업별 내역'].includes(h.textContent.trim()))card.hidden=true});
    const ing=$('ingredientGrid')?.closest('details');if(ing)ing.hidden=true;
    const audit=$('dataAudit')?.closest('details');if(audit){audit.open=false;audit.classList.add('finance-secondary-details')}
    return host;
  }

  function labelSurface(){
    const page=$('finance'),head=page?.querySelector('.section-head');if(head){head.querySelector('h2')?.replaceChildren(document.createTextNode('재정 · 수익'));head.querySelector('p')?.replaceChildren(document.createTextNode('핵심 숫자는 한 번만 보여주고, 근거는 필요할 때 펼칩니다.'))}
  }

  function render(){
    const host=ensureHost();if(!host)return;labelSurface();const recs=rangeRecords(),s=summarize(recs),months=monthly(),menus=menuSummary(recs);
    host.innerHTML=`${kpis(s)}<div class="finance-core-grid"><section class="ledger-card"><div class="ledger-head"><div><h3>비용 구조</h3><p>재료·대관·기타가 각각 얼마를 차지하는지.</p></div></div>${expensePanel(s)}</section><section class="ledger-card"><div class="ledger-head"><div><h3>6개월 흐름</h3><p>월별 매출과 이익만 비교합니다.</p></div></div>${monthlyPanel(months)}</section></div><section class="ledger-card"><div class="ledger-head"><div><h3>메뉴 수익성</h3><p>총이익·회당·인당 중 하나만 선택해 순위를 봅니다.</p></div></div>${menuRanking(menus)}</section><details class="ledger-detail-shell"><summary><span>수업별 손익 상세</span><small>필요할 때만 날짜별 계산 근거 보기</small></summary><div>${classBreakdown(recs)}</div></details><div class="ledger-note">재료비는 레시피 원가 × 실제 배합수입니다. 원가가 없는 수업의 이익은 임의로 만들지 않습니다.</div>`;
  }

  document.addEventListener('click',e=>{
    const metric=e.target.closest('[data-menu-metric]');if(metric){menuMetric=metric.dataset.menuMetric;render();return}
    if(e.target.closest('#finance [data-period],#finance #applyPeriod'))setTimeout(render,80);
  },true);
  document.addEventListener('change',e=>{if(e.target.closest('#finance #periodStart,#finance #periodEnd'))setTimeout(render,40)},true);
  try{const base=renderFinance;renderFinance=function(...args){const out=base.apply(this,args);setTimeout(render,25);return out}}catch(e){}
  try{const base=renderAll;renderAll=function(...args){const out=base.apply(this,args);setTimeout(render,140);return out}}catch(e){}
  setTimeout(render,1000);
})();