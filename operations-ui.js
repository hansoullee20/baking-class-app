(() => {
  const B=window.BakingBusiness,D=window.BakingData;
  if(!B)return;
  const $=id=>document.getElementById(id);
  const num=v=>Number.isFinite(Number(v))?Number(v):0;
  const won=v=>Number.isFinite(Number(v))?'₩'+Math.round(Number(v)).toLocaleString('ko-KR'):'—';
  const pct=v=>Number.isFinite(Number(v))?Math.round(Number(v))+'%':'—';
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const fmtLocal=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const todayISO=()=>B.zonedDate?B.zonedDate(new Date()):fmtLocal(new Date());
  const monthStart=s=>String(s).slice(0,7)+'-01';
  const monthEnd=s=>{const [y,m]=String(s).slice(0,7).split('-').map(Number);return `${y}-${String(m).padStart(2,'0')}-${String(new Date(y,m,0).getDate()).padStart(2,'0')}`};
  const nextMonth=s=>{let [y,m]=String(s).slice(0,7).split('-').map(Number);m+=1;if(m>12){y+=1;m=1}return `${y}-${String(m).padStart(2,'0')}-01`};
  const ctx=source=>({recipes:typeof recipes!=='undefined'?recipes:[],schedule:typeof schedule!=='undefined'?schedule:null,source});

  function events(){
    const out=[];
    try{
      (history?.records||[]).forEach((r,i)=>out.push({source:'history',id:r.class_id||`h${i}`,date:r.date,time:r.time||'',status:B.effectiveStatus?B.effectiveStatus(r):(r.status||'완료'),menu:r.menu||r.recipeCandidate||r.classTitle||'메뉴 미정',people:num(r.people),capacity:num(r.capacity)||num(r.people),raw:r}));
      (schedule?.rows||[]).forEach((r,i)=>out.push({source:'schedule',id:r.class_id||r.id||`s${i}`,date:r.date,time:r.time||r.session||'',status:B.effectiveStatus?B.effectiveStatus(r):(r.status||'예정'),menu:r.menu||r.classTitle||'메뉴 미정',people:num(r.people),capacity:num(r.capacity)||num(r.people),index:i,raw:r}));
    }catch(e){}
    return B.dedupeEvents(out).filter(e=>e.date&&e.status!=='취소').sort((a,b)=>a.date.localeCompare(b.date)||String(a.time).localeCompare(String(b.time)));
  }
  const fin=e=>B.classFinancials(e.raw,ctx(e.source));
  const pay=e=>B.payment(e.raw);
  const range=(a,b)=>events().filter(e=>e.date>=a&&e.date<=b);
  function summarize(rows){
    let revenue=0,collected=0,outstanding=0,cost=0,profit=0,costable=0,costableRevenue=0,conditional=0,actual=0;
    rows.forEach(e=>{const f=fin(e),p=pay(e);revenue+=f.revenue;collected+=p.collected;outstanding+=p.outstanding;if(f.total!=null){cost+=f.total;costable++;costableRevenue+=f.revenue;if(f.profit!=null)profit+=f.profit}if(f.confidence==='estimated')conditional++;if(f.confidence==='actual')actual++});
    const classCoverage=rows.length?costable/rows.length*100:0,revenueCoverage=revenue>0?costableRevenue/revenue*100:(rows.length?0:100),coverage=Math.min(classCoverage,revenueCoverage);
    return{revenue,collected,outstanding,cost,profit,costable,costableRevenue,conditional,actual,classCoverage,revenueCoverage,coverage,count:rows.length};
  }
  function confidence(s){if(!s.count)return['데이터 없음','neutral'];if(s.coverage>=90&&!s.conditional)return['높음','good'];if(s.coverage>=70)return['중간','warn'];return['낮음','bad']}
  const stat=(label,value,sub,tone='')=>`<div class="decision-stat ${tone}"><span>${esc(label)}</span><b>${esc(value)}</b><small>${esc(sub||'')}</small></div>`;

  function monthlySeries(){
    const map={};events().forEach(e=>{const k=e.date.slice(0,7);map[k]??={k,revenue:0,collected:0};const f=fin(e),p=pay(e);map[k].revenue+=f.revenue;map[k].collected+=p.collected});
    return Object.values(map).sort((a,b)=>a.k.localeCompare(b.k)).slice(-6);
  }
  function cashChart(){
    const rows=monthlySeries();if(!rows.length)return '<div class="decision-empty">표시할 데이터가 없습니다.</div>';
    const max=Math.max(1,...rows.flatMap(x=>[x.revenue,x.collected]));
    return `<div class="cash-chart">${rows.map(x=>`<div class="cash-month"><div class="cash-bars"><i class="booked" style="height:${Math.max(2,x.revenue/max*100)}%" title="수업 매출 ${won(x.revenue)}"></i><i class="paid" style="height:${Math.max(0,x.collected/max*100)}%" title="입금 기록 ${won(x.collected)}"></i></div><b>${Number(x.k.slice(5))}월</b><small>${won(x.revenue)}</small></div>`).join('')}</div><div class="decision-legend"><span><i class="booked"></i>수업 매출</span><span><i class="paid"></i>입금 기록</span></div><p class="decision-note">참가자 입금 추적 도입 전 과거 수업은 입금 기록이 0으로 보일 수 있습니다.</p>`;
  }

  function future(){const t=todayISO();return events().filter(e=>e.source==='schedule'&&e.date>=t&&e.status!=='완료')}
  function actionQueue(){
    const actions=[];
    future().forEach(e=>{
      const f=fin(e),p=pay(e),fill=e.capacity?e.people/e.capacity*100:100,remaining=Math.max(0,e.capacity-e.people),fee=num(e.raw?.fee);
      if(!f.recipe)actions.push({rank:1,date:e.date,title:`${e.menu} 레시피 연결`,detail:`${won(f.revenue)} 예약매출의 원가·이익 계산 불가`,impact:f.revenue,impactLabel:`${won(f.revenue)} 영향`});
      else if(f.total==null)actions.push({rank:2,date:e.date,title:`${e.menu} 원가 보완`,detail:`${won(f.revenue)} 예약매출 · ${f.costStatus||'미산정'}`,impact:f.revenue,impactLabel:`${won(f.revenue)} 영향`});
      if(p.outstanding>0)actions.push({rank:3,date:e.date,title:`${e.menu} 미수금 확인`,detail:`${won(p.outstanding)} 미입금`,impact:p.outstanding,impactLabel:won(p.outstanding)});
      if(fill<70&&remaining>0)actions.push({rank:4,date:e.date,title:`${e.menu} 모집 보강`,detail:`충원 ${pct(fill)} · ${remaining}석 남음`,impact:remaining*fee,impactLabel:`+${won(remaining*fee)} 잠재`});
    });
    return actions.sort((a,b)=>a.rank-b.rank||b.impact-a.impact||a.date.localeCompare(b.date)).slice(0,6);
  }

  function renderDashboard(){
    const page=$('dashboard');if(!page)return;const t=todayISO(),s=summarize(range(monthStart(t),monthEnd(t))),nm=nextMonth(t),ns=summarize(range(nm,monthEnd(nm)).filter(e=>e.source==='schedule')),cf=confidence(s),actions=actionQueue(),up=future().slice(0,4);
    page.querySelector('.hero small')?.replaceChildren(document.createTextNode('SUNNY’S ATELIER · CONTROL CENTER'));page.querySelector('.hero h2')?.replaceChildren(document.createTextNode('지금 필요한 운영 판단'));page.querySelector('.hero p')?.replaceChildren(document.createTextNode('매출·입금·이익 신뢰도와 다음 조치를 먼저 확인합니다.'));
    let host=$('operationsDashboard');if(!host){host=document.createElement('div');host.id='operationsDashboard';host.className='decision-dashboard';page.querySelector('.hero')?.after(host)}
    host.innerHTML=`<section class="decision-block"><div class="decision-head"><div><h3>이번 달 결정 요약</h3><p>완료 수업과 예약 수업을 현재 데이터 기준으로 합산합니다.</p></div><span class="confidence ${cf[1]}">원가 신뢰도 ${cf[0]} · 수업 ${pct(s.classCoverage)} / 매출 ${pct(s.revenueCoverage)}</span></div><div class="decision-stats">${stat('수업 매출',won(s.revenue),`${s.count}개 수업`)}${stat('입금 기록',won(s.collected),'참가자 결제 데이터','good')}${stat('미수금',won(s.outstanding),'추가 확인 필요',s.outstanding?'warn':'')}${stat('계산가능 비용',s.costable?won(s.cost):'계산 보류',`${s.costable}/${s.count} 수업`)}${stat('추정이익',s.costable?won(s.profit):'계산 보류',`매출 원가커버 ${pct(s.revenueCoverage)}`,s.coverage<70?'bad':'')}${stat('다음달 예약매출',won(ns.revenue),`${ns.count}개 예정 · 원가매출 ${pct(ns.revenueCoverage)}`)}</div></section><div class="decision-grid"><section class="decision-block"><div class="decision-head"><div><h3>사업 영향도 순 다음 행동</h3><p>원가·입금·모집 문제를 금액 영향과 함께 봅니다.</p></div></div><div class="action-list">${actions.length?actions.map(x=>`<div class="action-row"><time>${esc(x.date.slice(5).replace('-','.'))}</time><div><b>${esc(x.title)}</b><small>${esc(x.detail)}</small></div><span class="action-impact">${esc(x.impactLabel)}</span></div>`).join(''):'<div class="decision-empty">우선 처리할 항목이 없습니다.</div>'}</div></section><section class="decision-block"><div class="decision-head"><div><h3>가까운 수업</h3><p>충원 · 입금 · 예상이익</p></div></div><div class="next-list">${up.length?up.map(e=>{const f=fin(e),p=pay(e),fill=e.capacity?e.people/e.capacity*100:0;return `<button class="next-decision-row" data-ops-index="${e.index}"><time>${esc(e.date.slice(5).replace('-','.'))} ${esc(e.time)}</time><b>${esc(e.menu)}</b><span>충원 ${pct(fill)} · 입금 ${pct(p.rate)} · ${f.profit==null?'이익 계산 보류':`${esc(f.profitLabel)} ${won(f.profit)}`}</span></button>`}).join(''):'<div class="decision-empty">예정 수업이 없습니다.</div>'}</div></section></div><section class="decision-block"><div class="decision-head"><div><h3>6개월 매출 · 입금 흐름</h3><p>매출 기준액과 실제 입금 기록을 분리합니다.</p></div></div>${cashChart()}</section>`;
    if($('kpis'))$('kpis').hidden=true;const grid=page.querySelector(':scope > .grid2');if(grid)grid.hidden=true;if($('dashboardAnalytics'))$('dashboardAnalytics').hidden=true;
  }

  function renderSchedule(){
    const page=$('schedule');if(!page)return;const rows=future(),totalPeople=rows.reduce((s,e)=>s+e.people,0),totalCap=rows.reduce((s,e)=>s+e.capacity,0),fill=totalCap?totalPeople/totalCap*100:0,seats=Math.max(0,totalCap-totalPeople),unlinked=rows.filter(e=>!fin(e).recipe).length,uncosted=rows.filter(e=>fin(e).total==null).length,outstanding=rows.reduce((s,e)=>s+pay(e).outstanding,0);
    let host=$('scheduleDecision');if(!host){host=document.createElement('div');host.id='scheduleDecision';host.className='ops-summary-strip';page.querySelector('.section-head')?.after(host)}
    host.innerHTML=`${stat('예정 수업',`${rows.length}회`,'취소 제외 · 지난 날짜 자동 완료')}${stat('전체 충원율',pct(fill),`${totalPeople}/${totalCap}석`)}${stat('남은 좌석',`${seats}석`,'현재 모집 가능',seats?'warn':'')}${stat('미수금',won(outstanding),'참가자 결제 기준',outstanding?'warn':'')}${stat('레시피 미연결',`${unlinked}회`,'ID/별칭 연결 필요',unlinked?'bad':'')}${stat('이익 계산 보류',`${uncosted}회`,'원가 미완료 포함',uncosted?'warn':'')}`;
    if($('scheduleAnalytics'))$('scheduleAnalytics').hidden=true;
  }

  function renderRecipes(){
    const page=$('recipes');if(!page)return;const list=Array.isArray(recipes)?recipes:[],confirmed=list.filter(r=>B.costState(r).confidence==='confirmed').length,conditional=list.filter(r=>B.costState(r).confidence==='estimated').length,incomplete=list.filter(r=>!B.costState(r).usable).length,overlays=list.filter(r=>B.costState(r).source==='overlay').length,rec=D?D.reconciliation(list,ingredients,5):null,prov=D?D.provenanceAudit(ingredients):null;
    let host=$('recipeDecision');if(!host){host=document.createElement('div');host.id='recipeDecision';host.className='recipe-decision';page.querySelector('.recipe-tools')?.after(host)}
    const variance=rec?.materialVariance||[],review=prov?.needsReview||[];
    host.innerHTML=`<div class="ops-summary-strip">${stat('확정 원가',`${confirmed}개`,'승인된 확정 원가','good')}${stat('조건부 원가',`${conditional}개`,`계산 오버레이 ${overlays}개 포함`,conditional?'warn':'')}${stat('원가 미완료',`${incomplete}개`,'이익 계산 제외',incomplete?'bad':'')}${stat('재계산 완료',rec?`${rec.complete}/${rec.total}`:'—','공통 단가 기준')}${stat('원가 차이 ≥5%',rec?`${variance.length}개`:'—','유효 원가 검토',variance.length?'warn':'')}${stat('구매가 재확인',prov?`${review.length}개`:'—','쿠팡/지정제품 provenance',review.length?'warn':'')}</div><div class="recipe-review-list">${variance.length||review.length?`<b>검토 우선:</b> ${esc([...new Set([...variance.map(x=>x.name),...review])].slice(0,8).join(', '))}`:'현재 자동 검증에서 큰 경고가 없습니다.'}</div>`;
    if($('recipeAnalytics'))$('recipeAnalytics').hidden=true;
  }

  function periodRange(){const s=$('periodStart')?.value,e=$('periodEnd')?.value;if(s&&e)return[s,e];const t=todayISO();return[monthStart(t),monthEnd(t)]}
  function menuPerformance(rows){
    const map=new Map();rows.forEach(e=>{const f=fin(e);if(!map.has(e.menu))map.set(e.menu,{menu:e.menu,classes:0,people:0,capacity:0,revenue:0,costableRevenue:0,profit:0,costable:0});const x=map.get(e.menu);x.classes++;x.people+=e.people;x.capacity+=e.capacity;x.revenue+=f.revenue;if(f.profit!=null&&f.total!=null){x.profit+=f.profit;x.costable++;x.costableRevenue+=f.revenue}});
    return [...map.values()].map(x=>({...x,fill:x.capacity?x.people/x.capacity*100:null,profitPerClass:x.costable?x.profit/x.costable:null,margin:x.costableRevenue?x.profit/x.costableRevenue*100:null,coverage:x.classes?x.costable/x.classes*100:0})).sort((a,b)=>(b.profitPerClass??-1)-(a.profitPerClass??-1));
  }
  function blockerRows(rows){return rows.map(e=>({e,f:fin(e)})).filter(x=>x.f.total==null).sort((a,b)=>b.f.revenue-a.f.revenue||a.e.date.localeCompare(b.e.date))}
  function renderFinance(){
    const page=$('finance');if(!page)return;const [a,b]=periodRange(),rows=range(a,b),s=summarize(rows),cf=confidence(s),menus=menuPerformance(rows),nm=nextMonth(todayISO()),nextRows=range(nm,monthEnd(nm)).filter(e=>e.source==='schedule'),next=summarize(nextRows),nf=confidence(next),blockers=blockerRows(nextRows),blockedRevenue=blockers.reduce((x,y)=>x+y.f.revenue,0),base=s.costableRevenue||1;
    let host=$('financeDecision');if(!host){host=document.createElement('div');host.id='financeDecision';host.className='finance-decision';page.querySelector('.section-head')?.after(host)}
    host.innerHTML=`<section class="decision-block forecast"><div class="decision-head"><div><h3>${Number(nm.slice(5,7))}월 예상 수익</h3><p>현재 등록된 다음 달 일정과 유효 레시피 원가 기준</p></div><span class="confidence ${nf[1]}">신뢰도 ${nf[0]} · 수업 ${pct(next.classCoverage)} / 매출 ${pct(next.revenueCoverage)}</span></div><div class="decision-stats">${stat('예정 수업',`${next.count}회`,'취소 제외')}${stat('예약매출',won(next.revenue),'현재 예약 인원 기준')}${stat('계산가능 비용',next.costable?won(next.cost):'계산 보류',`${next.costable}/${next.count} 수업`)}${stat('계산가능 예상이익',next.costable?won(next.profit):'계산 보류',`원가 연결 매출 ${won(next.costableRevenue)}`,next.coverage<70?'warn':'')}${stat('원가 미연결 매출',won(blockedRevenue),`${blockers.length}개 수업`,blockedRevenue?'bad':'')}${stat('미수금',won(next.outstanding),'추가 입금 필요',next.outstanding?'warn':'')}</div>${blockers.length?`<div class="forecast-blockers"><b>예측을 막는 수업</b>${blockers.map(x=>`<div><time>${esc(x.e.date.slice(5).replace('-','.'))}</time><span>${esc(x.e.menu)}</span><strong>${won(x.f.revenue)}</strong><small>${x.f.recipe?esc(x.f.costStatus||'원가 미완료'):'레시피 미연결'}</small></div>`).join('')}</div>`:''}</section><section class="decision-block"><div class="decision-head"><div><h3>기간 수익 요약</h3><p>${esc(a)} ~ ${esc(b)} · 매출과 현금을 분리합니다.</p></div><span class="confidence ${cf[1]}">원가 신뢰도 ${cf[0]} · 수업 ${pct(s.classCoverage)} / 매출 ${pct(s.revenueCoverage)}</span></div><div class="decision-stats finance">${stat('수업 매출',won(s.revenue),`${s.count}개 수업`)}${stat('입금 기록',won(s.collected),'참가자 결제 데이터','good')}${stat('미수금',won(s.outstanding),'예정 결제액 - 입금',s.outstanding?'warn':'')}${stat('계산가능 비용',s.costable?won(s.cost):'계산 보류',`${s.costable}/${s.count} 수업`)}${stat('계산가능 추정이익',s.costable?won(s.profit):'계산 보류',`${s.conditional}개 조건부 포함`,s.coverage<70?'bad':'')}${stat('원가 커버리지',`${pct(s.classCoverage)} / ${pct(s.revenueCoverage)}`,'수업 건수 / 매출액')}</div></section><section class="decision-block"><div class="decision-head"><div><h3>계산 가능한 매출에서 남는 구조</h3><p>원가가 연결된 매출 ${won(s.costableRevenue)}만 분모로 사용합니다.</p></div></div><div class="profit-flow"><div><span>비용</span><i style="width:${Math.min(100,Math.max(0,s.cost/base*100))}%"></i><b>${s.costable?won(s.cost):'—'}</b></div><div><span>추정이익</span><i class="profit" style="width:${Math.min(100,Math.max(0,s.profit/base*100))}%"></i><b>${s.costable?won(s.profit):'—'}</b></div></div></section><section class="decision-block"><div class="decision-head"><div><h3>메뉴 성과</h3><p>평균 충원율·수업당 이익과 원가 커버리지를 함께 비교합니다.</p></div></div><div class="tablewrap"><table class="decision-table"><thead><tr><th>메뉴</th><th>수업</th><th>평균 충원</th><th>수업당 이익</th><th>계산가능 마진</th><th>원가 커버</th></tr></thead><tbody>${menus.length?menus.map(x=>`<tr><td><b>${esc(x.menu)}</b></td><td>${x.classes}회</td><td>${pct(x.fill)}</td><td>${x.profitPerClass==null?'계산 보류':won(x.profitPerClass)}</td><td>${pct(x.margin)}</td><td>${pct(x.coverage)}</td></tr>`).join(''):'<tr><td colspan="6">데이터가 없습니다.</td></tr>'}</tbody></table></div></section>`;
    if($('financeKpis'))$('financeKpis').hidden=true;if($('financeAnalytics'))$('financeAnalytics').hidden=true;const nextCard=$('nextMonthKpis')?.closest('.card');if(nextCard)nextCard.hidden=true;[...page.querySelectorAll(':scope > .card')].forEach(card=>{const h=card.querySelector(':scope > h3');if(h&&['메뉴별 집계','수업별 내역'].includes(h.textContent.trim()))card.hidden=true});const audit=$('dataAudit')?.closest('details');if(audit){audit.open=false;const q=audit.querySelector('summary');if(q)q.textContent='데이터 품질 · 연결 · 원가 검증'}const ing=$('ingredientGrid')?.closest('details');if(ing){ing.open=false;const q=ing.querySelector('summary');if(q)q.textContent='재료 단가 마스터'}
  }

  function refresh(){renderDashboard();renderSchedule();renderRecipes();renderFinance()}
  ['renderDashboard','renderSchedule','renderRecipes','renderFinance','renderAll'].forEach(name=>{try{const base=window[name];if(typeof base!=='function')return;window[name]=function(...args){const r=base.apply(this,args);setTimeout(refresh,40);return r}}catch(e){}});
  document.addEventListener('click',e=>{if(e.target.closest('#applyPeriod,[data-period]'))setTimeout(renderFinance,80)},true);document.addEventListener('change',e=>{if(e.target.closest('#periodStart,#periodEnd'))setTimeout(renderFinance,30)},true);
  setTimeout(refresh,700);
})();
