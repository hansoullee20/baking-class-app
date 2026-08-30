(() => {
  const $ = id => document.getElementById(id);
  const num = v => Number.isFinite(Number(v)) ? Number(v) : 0;
  const won = v => Number.isFinite(Number(v)) ? '₩' + Math.round(Number(v)).toLocaleString('ko-KR') : '—';
  const pct = v => Number.isFinite(Number(v)) ? Math.round(Number(v)) + '%' : '—';
  const esc = s => String(s ?? '').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const aliases = {'꾸덕브라우니':'브라우니','크랙소금빵':'소금빵','크랙소금빵 원데이':'소금빵'};

  function recipeFor(raw){
    const names=[raw?.menu,raw?.recipeCandidate,raw?.classTitle].filter(Boolean);
    for(const name of names){
      const direct=(recipes||[]).find(r=>r.name===name);
      if(direct) return direct;
      const alias=aliases[name];
      if(alias){const hit=(recipes||[]).find(r=>r.name===alias);if(hit)return hit;}
    }
    return null;
  }
  function costReady(r){return !!r&&r.cost!=null&&!['부분원가','미산정'].includes(r.cost_status)}
  function defaultRent(date){
    const s=schedule?.settings||{};
    try{return dow(date)==='토'?num(s.satRent||90000):num(s.weekdayRent||81000)}catch(e){return num(s.weekdayRent||81000)}
  }
  function calcRow(raw,source){
    const revenue=raw?.status==='취소'?0:(raw?.revenue!=null?num(raw.revenue):num(raw?.people)*num(raw?.fee));
    const rec=recipeFor(raw);
    const material=costReady(rec)?num(rec.cost)*num(raw?.batchCount||1):null;
    const rent=raw?.rent!==''&&raw?.rent!=null?num(raw.rent):defaultRent(raw?.date);
    const packing=num(raw?.packing),other=num(raw?.other);
    const total=material==null?null:material+rent+packing+other;
    let profit=total==null?null:revenue-total;
    if(raw?.actualProfit!==''&&raw?.actualProfit!=null&&Number.isFinite(Number(raw.actualProfit)))profit=Number(raw.actualProfit);
    const margin=profit==null||revenue<=0?null:profit/revenue*100;
    const roi=profit==null||total==null||total<=0?null:profit/total*100;
    const fee=num(raw?.fee);
    const breakEven=total!=null&&fee>0?Math.ceil(total/fee):null;
    return {source,rec,revenue,material,rent,packing,other,total,profit,margin,roi,breakEven};
  }
  function periodRows(){
    const a=$('periodStart')?.value||'0000-01-01',b=$('periodEnd')?.value||'9999-12-31',out=[];
    (history?.records||[]).forEach(r=>{if(r.date&&r.date>=a&&r.date<=b&&r.status!=='취소')out.push({date:r.date,menu:r.menu||r.classTitle||'메뉴 미정',people:num(r.people),raw:r,source:'history',calc:calcRow(r,'history')})});
    (schedule?.rows||[]).forEach(r=>{if(r.date&&r.date>=a&&r.date<=b&&r.status!=='취소')out.push({date:r.date,menu:r.menu||r.classTitle||'메뉴 미정',people:num(r.people),raw:r,source:'schedule',calc:calcRow(r,'schedule')})});
    return out.sort((x,y)=>x.date.localeCompare(y.date));
  }
  function menuStats(rows){
    const by={};
    rows.forEach(x=>{
      const k=x.menu||'메뉴 미정';
      if(!by[k])by[k]={menu:k,classes:0,people:0,revenue:0,ready:0,readyRevenue:0,profit:0,total:0};
      const g=by[k];g.classes++;g.people+=x.people;g.revenue+=x.calc.revenue;
      if(x.calc.profit!=null){g.ready++;g.readyRevenue+=x.calc.revenue;g.profit+=x.calc.profit;g.total+=x.calc.total||0;}
    });
    return Object.values(by).map(g=>({...g,margin:g.readyRevenue>0?g.profit/g.readyRevenue*100:null,roi:g.total>0?g.profit/g.total*100:null}));
  }

  function wrapDetail(card,title,sub){
    if(!card)return null;
    const existing=card.closest('details.finance-detail');if(existing)return existing;
    const d=document.createElement('details');d.className='finance-detail';
    const s=document.createElement('summary');s.innerHTML=`<span>${esc(title)}</span><small>${esc(sub)}</small>`;d.appendChild(s);
    card.classList.add('finance-detail-inner');card.style.marginTop='0';card.before(d);d.appendChild(card);return d;
  }
  function installStructure(){
    const page=$('finance');if(!page)return;
    page.classList.add('finance-pro');
    const head=page.querySelector(':scope > .section-head');
    if(head){const h=head.querySelector('h2'),p=head.querySelector('p');if(h)h.textContent='수익 · 원가 운영';if(p)p.textContent='기간 손익을 먼저 보고, 메뉴·정원·가격을 결정한 뒤 상세 원장을 확인합니다.';}
    let controls=$('financeProControls');
    if(!controls){controls=document.createElement('div');controls.id='financeProControls';controls.className='finance-pro-controls';const period=page.querySelector(':scope > .period'),fields=page.querySelector(':scope > .period-fields');if(period)controls.appendChild(period);if(fields)controls.appendChild(fields);const k=$('financeKpis');if(k)k.before(controls);}
    let body=$('financeProBody');if(!body){body=document.createElement('div');body.id='financeProBody';controls.insertAdjacentElement('afterend',body);}
    let brief=$('financeOperatorBrief');if(!brief){brief=document.createElement('div');brief.id='financeOperatorBrief';brief.className='finance-brief-card';}
    let eng=$('financeMenuEngineering');if(!eng){eng=document.createElement('div');eng.id='financeMenuEngineering';eng.className='finance-engineering';}
    let details=$('financeDetailArea');if(!details){details=document.createElement('div');details.id='financeDetailArea';details.className='finance-detail-area';const title=document.createElement('div');title.className='finance-detail-title';title.textContent='상세 데이터 · 필요할 때만 펼쳐보기';details.appendChild(title);}
    const menuDetail=wrapDetail($('menuFinance')?.closest('.card'),'메뉴별 집계','수업 · 수강생 · 수입 · 계산이익 전체표');
    const sessionDetail=wrapDetail($('sessionFinance')?.closest('.card'),'수업별 원장','날짜별 매출과 원가/이익 상세');
    const ing=$('ingredientGrid')?.closest('details');if(ing)ing.classList.add('finance-detail');
    [menuDetail,sessionDetail,ing].filter(Boolean).forEach(x=>details.appendChild(x));
    const ordered=[$('financeKpis'),$('profitCoverageNote'),brief,$('profitabilitySummary'),$('financeAnalytics'),eng,$('profitPlanner'),details].filter(Boolean);
    ordered.forEach(n=>body.appendChild(n));
  }

  function renderBrief(rows,stats){
    const host=$('financeOperatorBrief');if(!host)return;
    const ready=rows.filter(x=>x.calc.profit!=null),missing=rows.filter(x=>x.calc.profit==null);
    const missingMenus=[...new Set(missing.map(x=>x.menu))];
    const coverage=rows.length?ready.length/rows.length*100:0;
    const below=rows.filter(x=>x.source==='schedule'&&x.calc.breakEven!=null&&num(x.raw.people)<x.calc.breakEven);
    const top=stats.slice().sort((a,b)=>b.revenue-a.revenue)[0];
    const best=stats.filter(x=>x.margin!=null).sort((a,b)=>b.margin-a.margin)[0];
    host.innerHTML=`<div class="finance-pro-head"><div><h3>운영 포인트</h3><p>이 기간에서 바로 확인해야 할 원가·손익·메뉴 신호입니다.</p></div><div class="finance-scope-note">현재 이익 범위: 재료 + 대관 + 입력 추가비용</div></div><div class="finance-brief-grid">
      <div class="finance-brief-item ${missing.length?'warn':'good'}"><span>원가 연결</span><b>${ready.length}/${rows.length}회 · ${Math.round(coverage)}%</b><small>${missingMenus.length?`보완: ${esc(missingMenus.slice(0,3).join(', '))}${missingMenus.length>3?' 외':''}`:'선택 기간 원가 연결 완료'}</small></div>
      <div class="finance-brief-item ${below.length?'warn':'good'}"><span>손익분기 경고</span><b>${below.length?below.length+'회':'경고 없음'}</b><small>${below.length?`현재 인원이 최소 손익분기 인원보다 적은 예정 수업`:'현재 계산 가능한 예정 수업 기준'}</small></div>
      <div class="finance-brief-item"><span>매출 기여 1위</span><b>${top?esc(top.menu):'—'}</b><small>${top?`${top.people}명 · ${won(top.revenue)}`:'선택 기간 데이터 없음'}</small></div>
      <div class="finance-brief-item"><span>마진 상위 메뉴</span><b>${best?esc(best.menu):'—'}</b><small>${best?`${pct(best.margin)} · 계산이익 ${won(best.profit)}`:'계산 가능한 원가 데이터 없음'}</small></div>
    </div>`;
  }

  function renderProfitSummary(rows,stats){
    const box=$('profitabilitySummary');if(!box)return;
    const ready=rows.filter(x=>x.calc.profit!=null),revenue=ready.reduce((s,x)=>s+x.calc.revenue,0),cost=ready.reduce((s,x)=>s+(x.calc.total||0),0),profit=ready.reduce((s,x)=>s+x.calc.profit,0),margin=revenue?profit/revenue*100:null,roi=cost?profit/cost*100:null,avg=ready.length?profit/ready.length:null;
    const menu=stats.filter(x=>x.margin!=null).sort((a,b)=>b.margin-a.margin).slice(0,6);
    box.innerHTML=`<div class="analytics-head"><div><h3>기간 손익 성과</h3><p>같은 메뉴의 여러 수업은 합쳐서 보여주며, 원가가 연결된 수업만 손익에 포함합니다.</p></div><span class="analytics-badge">Profit control</span></div>
      <div class="ops-payment-kpis"><div><span>계산 가능 수업</span><b>${ready.length}/${rows.length}회</b></div><div><span>계산 비용</span><b>${won(cost)}</b></div><div><span>계산 이익</span><b>${won(profit)}</b></div><div><span>매출이익률</span><b>${pct(margin)}</b></div><div><span>수업당 평균이익</span><b>${won(avg)}</b></div></div>
      <div class="ops-margin-bars">${menu.map(x=>`<div class="viz-row"><div class="viz-name" title="${esc(x.menu)}">${esc(x.menu)}</div><div class="viz-track"><div class="viz-fill" style="width:${Math.max(2,Math.min(100,x.margin||0))}%"></div></div><div class="viz-value">${pct(x.margin)}</div></div>`).join('')||'<div class="analytics-empty">계산 가능한 메뉴가 없습니다.</div>'}</div>`;
  }

  function renderCoverage(rows){
    const host=$('financeCoverage');if(!host)return;
    const ready=rows.filter(x=>x.calc.profit!=null),missing=[...new Set(rows.filter(x=>x.calc.profit==null).map(x=>x.menu))],rate=rows.length?ready.length/rows.length*100:0;
    host.innerHTML=`<div class="finance-coverage-compact"><div class="finance-coverage-number"><div><b>${Math.round(rate)}%</b><span>계산 가능</span></div></div><div class="finance-coverage-copy"><b>${ready.length}/${rows.length}회 원가 연결</b><p>완료 기록과 예정 수업을 같은 기준으로 계산합니다.</p><p>${missing.length?`원가 보완: ${esc(missing.slice(0,4).join(', '))}${missing.length>4?' 외':''}`:'선택 기간의 모든 수업이 계산 가능합니다.'}</p></div></div>`;
    const card=host.closest('.analytics-card');if(card){const h=card.querySelector('.analytics-head h3'),p=card.querySelector('.analytics-head p');if(h)h.textContent='원가 연결 상태';if(p)p.textContent='선택 기간 전체 수업의 계산 가능 범위';}
    const menuCard=$('financeMenu')?.closest('.analytics-card');if(menuCard){const h=menuCard.querySelector('.analytics-head h3'),p=menuCard.querySelector('.analytics-head p');if(h)h.textContent='메뉴별 매출 기여';if(p)p.textContent='선택 기간 상위 5개 메뉴 매출';}
  }

  function renderEngineering(stats){
    const host=$('financeMenuEngineering');if(!host)return;
    const comparable=stats.filter(x=>x.margin!=null);
    const avgPeople=comparable.length?comparable.reduce((s,x)=>s+x.people,0)/comparable.length:0;
    const avgMargin=comparable.length?comparable.reduce((s,x)=>s+x.margin,0)/comparable.length:0;
    const label=x=>{if(x.margin==null)return['원가필요','review'];const highDemand=x.people>=avgPeople,highMargin=x.margin>=avgMargin;if(highDemand&&highMargin)return['스타','star'];if(highDemand)return['인기형','popular'];if(highMargin)return['수익형','profit'];return['재검토','review'];};
    const sorted=stats.slice().sort((a,b)=>b.revenue-a.revenue).slice(0,9);
    host.innerHTML=`<div class="finance-pro-head"><div><h3>클래스 메뉴 엔지니어링</h3><p>선택 기간의 총 수강생 수와 계산 가능한 마진을 기준으로 메뉴를 분류합니다. 스타=수요·마진 모두 상위, 인기형=수요 우세, 수익형=마진 우세.</p></div><span class="analytics-badge">Menu engineering</span></div><div class="finance-engineering-grid">${sorted.map(x=>{const [t,c]=label(x);return `<div class="finance-menu-card"><div class="finance-menu-card-head"><h4 title="${esc(x.menu)}">${esc(x.menu)}</h4><span class="finance-menu-tag ${c}">${t}</span></div><div class="finance-menu-meta">${x.classes}회 · ${x.people}명 · 원가계산 ${x.ready}/${x.classes}회</div><div class="finance-menu-values"><div><span>매출</span><b>${won(x.revenue)}</b></div><div><span>마진</span><b>${pct(x.margin)}</b></div><div><span>계산이익</span><b>${x.ready?won(x.profit):'—'}</b></div></div></div>`}).join('')||'<div class="analytics-empty">선택 기간 데이터가 없습니다.</div>'}</div>`;
  }

  function compactPlanner(){
    const planner=$('profitPlanner');if(!planner)return;
    const title=planner.querySelector('.ops-section-head h3'),sub=planner.querySelector('.ops-section-head p');if(title)title.textContent='가격 · 정원 시뮬레이션';if(sub)sub.textContent='다음 클래스의 메뉴, 정원, 수강료를 바꿔 손익분기와 예상이익을 비교합니다.';
    const ranking=$('planRanking');if(ranking){const parent=ranking.parentElement;let btn=parent?.querySelector('.finance-rank-toggle');if(parent&&!btn){btn=document.createElement('button');btn.type='button';btn.className='finance-rank-toggle';btn.textContent='전체 8개 보기';btn.addEventListener('click',()=>{ranking.classList.toggle('show-all');btn.textContent=ranking.classList.contains('show-all')?'상위 4개만 보기':'전체 8개 보기';});parent.appendChild(btn);}}
  }

  function refresh(){
    try{
      installStructure();
      const rows=periodRows(),stats=menuStats(rows);
      renderBrief(rows,stats);renderProfitSummary(rows,stats);renderCoverage(rows);renderEngineering(stats);compactPlanner();
      installStructure();
    }catch(e){console.warn('finance-pro',e)}
  }
  function scheduleRefresh(){setTimeout(refresh,90)}
  try{const base=renderFinance;renderFinance=function(){base();scheduleRefresh();};}catch(e){}
  try{const base=renderAll;renderAll=function(){base();scheduleRefresh();};}catch(e){}
  document.addEventListener('click',e=>{if(e.target.closest('[data-page="finance"]'))scheduleRefresh();});
  setTimeout(refresh,700);
})();
