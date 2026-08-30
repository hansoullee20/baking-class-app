(() => {
  const B=window.BakingBusiness;
  if(!B)return;
  const $=id=>document.getElementById(id);
  const num=v=>Number.isFinite(Number(v))?Number(v):0;
  const won=v=>Number.isFinite(Number(v))?'₩'+Math.round(Number(v)).toLocaleString('ko-KR'):'—';
  const pct=v=>Number.isFinite(Number(v))?Math.round(Number(v))+'%':'—';
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const isoToday=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
  const monthStart=s=>String(s).slice(0,7)+'-01';
  const monthEnd=s=>{const [y,m]=String(s).slice(0,7).split('-').map(Number);return new Date(y,m,0).toISOString().slice(0,10)};
  const nextMonth=s=>{const [y,m]=String(s).slice(0,7).split('-').map(Number);const d=new Date(y,m,1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`};
  const ctx=source=>({recipes:typeof recipes!=='undefined'?recipes:[],schedule:typeof schedule!=='undefined'?schedule:null,source});

  function allEvents(){
    const out=[];
    try{
      (history?.records||[]).forEach((r,i)=>out.push({source:'history',id:r.class_id||`h${i}`,date:r.date,time:r.time||'',status:r.status||'완료',menu:r.menu||r.recipeCandidate||r.classTitle||'메뉴 미정',people:num(r.people),capacity:num(r.capacity)||num(r.people),raw:r}));
      (schedule?.rows||[]).forEach((r,i)=>out.push({source:'schedule',id:r.class_id||r.id||`s${i}`,date:r.date,time:r.time||r.session||'',status:r.status||'예정',menu:r.menu||r.classTitle||'메뉴 미정',people:num(r.people),capacity:num(r.capacity)||num(r.people),index:i,raw:r}));
    }catch(e){}
    return B.dedupeEvents(out).filter(e=>e.date&&e.status!=='취소').sort((a,b)=>a.date.localeCompare(b.date)||String(a.time).localeCompare(String(b.time)));
  }
  function financeOf(e){return B.classFinancials(e.raw,ctx(e.source))}
  function paymentOf(e){return B.payment(e.raw)}
  function rangeEvents(a,b){return allEvents().filter(e=>e.date>=a&&e.date<=b)}
  function summary(rows){
    let booked=0,collected=0,outstanding=0,cost=0,profit=0,costable=0,conditional=0;
    rows.forEach(e=>{
      const f=financeOf(e),p=paymentOf(e);
      booked+=f.revenue;collected+=p.collected;outstanding+=p.outstanding;
      if(f.total!=null){cost+=f.total;profit+=f.profit||0;costable++;if(f.confidence==='estimated')conditional++}
    });
    const coverage=rows.length?costable/rows.length*100:0;
    return{booked,collected,outstanding,cost,profit,costable,conditional,coverage,count:rows.length};
  }
  function confidenceLabel(s){
    if(!s.count)return{label:'데이터 없음',tone:'neutral'};
    if(s.coverage>=90&&s.conditional===0)return{label:'높음',tone:'good'};
    if(s.coverage>=70)return{label:'중간',tone:'warn'};
    return{label:'낮음',tone:'bad'};
  }
  function stat(label,value,sub,tone=''){return `<div class="decision-stat ${tone}"><span>${esc(label)}</span><b>${esc(value)}</b><small>${esc(sub||'')}</small></div>`}

  function monthSeries(){
    const map={};
    allEvents().forEach(e=>{
      const k=e.date.slice(0,7);map[k]??={k,booked:0,collected:0};
      const f=financeOf(e),p=paymentOf(e);map[k].booked+=f.revenue;map[k].collected+=p.collected;
    });
    return Object.values(map).sort((a,b)=>a.k.localeCompare(b.k)).slice(-6);
  }
  function cashChart(){
    const rows=monthSeries();if(!rows.length)return '<div class="decision-empty">표시할 월별 데이터가 없습니다.</div>';
    const max=Math.max(1,...rows.flatMap(x=>[x.booked,x.collected]));
    return `<div class="cash-chart">${rows.map(x=>{
      const book=Math.max(2,x.booked/max*100),paid=Math.max(0,x.collected/max*100);
      return `<div class="cash-month"><div class="cash-bars"><i class="booked" style="height:${book}%" title="예약매출 ${won(x.booked)}"></i><i class="paid" style="height:${paid}%" title="입금 ${won(x.collected)}"></i></div><b>${Number(x.k.slice(5))}월</b><small>${won(x.booked)}</small></div>`
    }).join('')}</div><div class="decision-legend"><span><i class="booked"></i>예약매출</span><span><i class="paid"></i>입금</span></div>`;
  }

  function actionQueue(){
    const t=isoToday(),future=allEvents().filter(e=>e.source==='schedule'&&e.date>=t);
    const actions=[];
    future.forEach(e=>{
      const f=financeOf(e),p=paymentOf(e),fill=e.capacity?e.people/e.capacity*100:100;
      if(!f.recipe)actions.push({rank:1,date:e.date,title:`${e.menu} 레시피 연결`,detail:'원가·예상이익 계산이 불가능합니다.'});
      else if(f.total==null)actions.push({rank:2,date:e.date,title:`${e.menu} 원가 보완`,detail:`현재 상태 ${f.costStatus||'미산정'}`});
      if(p.outstanding>0)actions.push({rank:3,date:e.date,title:`${e.menu} 미수금 확인`,detail:`${won(p.outstanding)} 미입금`});
      if(fill<70)actions.push({rank:4,date:e.date,title:`${e.menu} 모집 보강`,detail:`충원율 ${pct(fill)} · ${Math.max(0,e.capacity-e.people)}석 남음`});
    });
    actions.sort((a,b)=>a.rank-b.rank||a.date.localeCompare(b.date));
    return actions.slice(0,6);
  }
  function upcomingRows(){
    const t=isoToday();return allEvents().filter(e=>e.source==='schedule'&&e.date>=t).slice(0,4);
  }

  function renderDashboardDecision(){
    const page=$('dashboard');if(!page)return;
    const t=isoToday(),a=monthStart(t),b=monthEnd(t),month=summary(rangeEvents(a,b));
    const nm=nextMonth(t),next=summary(rangeEvents(nm,monthEnd(nm)).filter(e=>e.source==='schedule'));
    const conf=confidenceLabel(month);
    page.querySelector('.hero small')?.replaceChildren(document.createTextNode('SUNNY’S ATELIER · CONTROL CENTER'));
    page.querySelector('.hero h2')?.replaceChildren(document.createTextNode('지금 필요한 운영 판단'));
    page.querySelector('.hero p')?.replaceChildren(document.createTextNode('매출·입금·이익 신뢰도와 다음 조치를 먼저 확인합니다.'));
    let host=$('decisionDashboard');
    if(!host){host=document.createElement('div');host.id='decisionDashboard';host.className='decision-dashboard';page.querySelector('.hero')?.after(host)}
    const actions=actionQueue(),up=upcomingRows();
    host.innerHTML=`
      <section class="decision-block"><div class="decision-head"><div><h3>이번 달 결정 요약</h3><p>회계 확정값이 아니라 현재 운영 데이터 기준입니다.</p></div><span class="confidence ${conf.tone}">신뢰도 ${conf.label}</span></div>
        <div class="decision-stats">${stat('예약매출',won(month.booked),`${month.count}개 수업`)}${stat('입금',won(month.collected),'참가자 입금기록 기준','good')}${stat('미수금',won(month.outstanding),'추가 확인 필요',month.outstanding?'warn':'')}${stat('비용',month.costable?won(month.cost):'계산 보류',`${month.costable}/${month.count} 수업 계산`)}${stat('추정이익',month.costable?won(month.profit):'계산 보류',`원가 연결률 ${pct(month.coverage)}`,month.coverage<70?'bad':'')}${stat('다음달 예약매출',won(next.booked),`${next.count}개 예정`)}</div>
      </section>
      <div class="decision-grid">
        <section class="decision-block"><div class="decision-head"><div><h3>다음 행동</h3><p>데이터와 운영 상태에서 바로 조치할 항목</p></div></div><div class="action-list">${actions.length?actions.map(x=>`<div class="action-row"><time>${esc(x.date.slice(5).replace('-','.'))}</time><div><b>${esc(x.title)}</b><small>${esc(x.detail)}</small></div></div>`).join(''):'<div class="decision-empty">긴급한 데이터·운영 조치가 없습니다.</div>'}</div></section>
        <section class="decision-block"><div class="decision-head"><div><h3>가까운 수업</h3><p>충원 · 입금 · 예상이익</p></div></div><div class="next-list">${up.length?up.map(e=>{const f=financeOf(e),p=paymentOf(e),fill=e.capacity?e.people/e.capacity*100:0;return `<button class="next-decision-row" data-ops-index="${e.index}"><time>${esc(e.date.slice(5).replace('-','.'))} ${esc(e.time)}</time><b>${esc(e.menu)}</b><span>충원 ${pct(fill)} · 입금 ${pct(p.rate)} · ${f.profit==null?'이익 계산 보류':`${esc(f.profitLabel)} ${won(f.profit)}`}</span></button>`}).join(''):'<div class="decision-empty">예정 수업이 없습니다.</div>'}</div></section>
      </div>
      <section class="decision-block"><div class="decision-head"><div><h3>6개월 현금 흐름</h3><p>예약매출과 실제 입금 기록을 분리해 봅니다.</p></div></div>${cashChart()}</section>`;
    const oldKpis=$('kpis');if(oldKpis)oldKpis.hidden=true;
    const oldGrid=page.querySelector(':scope > .grid2');if(oldGrid)oldGrid.hidden=true;
    const oldAnalytics=$('dashboardAnalytics');if(oldAnalytics)oldAnalytics.hidden=true;
  }

  function periodRange(){
    const s=$('periodStart')?.value,e=$('periodEnd')?.value;
    if(s&&e)return[s,e];
    const t=isoToday();return[monthStart(t),monthEnd(t)];
  }
  function menuPerformance(rows){
    const map=new Map();
    rows.forEach(e=>{
      const f=financeOf(e);if(!map.has(e.menu))map.set(e.menu,{menu:e.menu,classes:0,people:0,capacity:0,revenue:0,profit:0,costable:0});
      const x=map.get(e.menu);x.classes++;x.people+=e.people;x.capacity+=e.capacity;x.revenue+=f.revenue;if(f.profit!=null){x.profit+=f.profit;x.costable++}
    });
    return [...map.values()].map(x=>({...x,fill:x.capacity?x.people/x.capacity*100:null,profitPerClass:x.costable?x.profit/x.costable:null,margin:x.revenue&&x.costable?x.profit/x.revenue*100:null})).sort((a,b)=>(b.profitPerClass??-1)-(a.profitPerClass??-1));
  }
  function renderFinanceDecision(){
    const page=$('finance');if(!page)return;
    const [a,b]=periodRange(),rows=rangeEvents(a,b),s=summary(rows),conf=confidenceLabel(s),menus=menuPerformance(rows);
    let host=$('financeDecision');
    if(!host){host=document.createElement('div');host.id='financeDecision';host.className='finance-decision';page.querySelector('.section-head')?.after(host)}
    const totalBooked=s.booked||1,costPct=s.cost/totalBooked*100,profitPct=s.profit/totalBooked*100;
    host.innerHTML=`
      <section class="decision-block"><div class="decision-head"><div><h3>기간 수익 요약</h3><p>${esc(a)} ~ ${esc(b)} · 예약과 현금을 구분합니다.</p></div><span class="confidence ${conf.tone}">원가 신뢰도 ${conf.label} · ${pct(s.coverage)}</span></div>
        <div class="decision-stats finance">${stat('예약매출',won(s.booked),`${s.count}개 수업`)}${stat('입금',won(s.collected),'실제 입금 기록','good')}${stat('미수금',won(s.outstanding),'예약매출 - 입금',s.outstanding?'warn':'')}${stat('계산가능 비용',s.costable?won(s.cost):'계산 보류',`${s.costable}/${s.count} 수업`)}${stat('추정이익',s.costable?won(s.profit):'계산 보류',`${s.conditional}개 조건부 포함`,s.coverage<70?'bad':'')}${stat('원가 커버리지',pct(s.coverage),'계산 가능한 수업 비율')}</div>
      </section>
      <section class="decision-block"><div class="decision-head"><div><h3>매출에서 남는 구조</h3><p>계산 가능한 비용만 포함하며 미산정 수업은 제외됩니다.</p></div></div><div class="profit-flow"><div><span>비용</span><i style="width:${Math.min(100,Math.max(0,costPct))}%"></i><b>${s.costable?won(s.cost):'—'}</b></div><div><span>추정이익</span><i class="profit" style="width:${Math.min(100,Math.max(0,profitPct))}%"></i><b>${s.costable?won(s.profit):'—'}</b></div></div></section>
      <section class="decision-block"><div class="decision-head"><div><h3>메뉴 성과</h3><p>누적 인원 대신 평균 충원율과 수업당 이익으로 비교합니다.</p></div></div><div class="tablewrap"><table class="decision-table"><thead><tr><th>메뉴</th><th>수업</th><th>평균 충원</th><th>수업당 이익</th><th>마진</th></tr></thead><tbody>${menus.length?menus.map(x=>`<tr><td><b>${esc(x.menu)}</b></td><td>${x.classes}회</td><td>${pct(x.fill)}</td><td>${x.profitPerClass==null?'계산 보류':won(x.profitPerClass)}</td><td>${pct(x.margin)}</td></tr>`).join(''):'<tr><td colspan="5">데이터가 없습니다.</td></tr>'}</tbody></table></div></section>`;
    const oldKpis=$('financeKpis');if(oldKpis)oldKpis.hidden=true;
    const oldAnalytics=$('financeAnalytics');if(oldAnalytics)oldAnalytics.hidden=true;
    const cards=[...page.querySelectorAll(':scope > .card')].filter(x=>!x.closest('#financeDecision'));
    cards.forEach(card=>{
      const h=card.querySelector(':scope > h3');
      if(h&&['메뉴별 집계','수업별 내역'].includes(h.textContent.trim()))card.hidden=true;
    });
  }

  function diagnosticsLabel(){
    const audit=$('dataAudit')?.closest('details');if(audit){audit.open=false;const s=audit.querySelector('summary');if(s)s.textContent='데이터 품질 · 연결 · 원가 검증'}
    const ing=$('ingredientGrid')?.closest('details');if(ing){ing.open=false;const s=ing.querySelector('summary');if(s)s.textContent='재료 단가 마스터'}
  }
  function refresh(){renderDashboardDecision();renderFinanceDecision();diagnosticsLabel()}
  ['renderDashboard','renderFinance','renderAll'].forEach(name=>{try{const base=window[name];if(typeof base!=='function')return;window[name]=function(...args){const r=base.apply(this,args);setTimeout(refresh,40);return r}}catch(e){}});
  document.addEventListener('click',e=>{if(e.target.closest('#applyPeriod,[data-period]'))setTimeout(renderFinanceDecision,80)},true);
  document.addEventListener('change',e=>{if(e.target.closest('#periodStart,#periodEnd'))setTimeout(renderFinanceDecision,30)},true);
  setTimeout(refresh,700);
})();