(() => {
  const AKEY='sunny-atelier-analytics-range';
  let arange=localStorage.getItem(AKEY)||'all';
  const A$=id=>document.getElementById(id);
  const aNum=v=>Number.isFinite(Number(v))?Number(v):0;
  const aEsc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const aMoney=v=>Number.isFinite(Number(v))?'₩'+Math.round(Number(v)).toLocaleString('ko-KR'):'—';
  const isoToday=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
  const dateObj=s=>new Date(`${s}T00:00:00`);
  const plusDays=(s,n)=>{const d=dateObj(s);d.setDate(d.getDate()+n);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
  const monthKey=s=>String(s||'').slice(0,7);
  const monthLabel=k=>{const [y,m]=k.split('-');return `${Number(m)}월`+(y!==String(new Date().getFullYear())?` '${String(y).slice(2)}`:'')};
  const dayName=s=>['일','월','화','수','목','금','토'][dateObj(s).getDay()];

  function installUI(){
    if(A$('analytics')) return;
    const side=document.querySelector('.side .nav');
    if(side){
      const b=document.createElement('button');
      b.dataset.page='analytics';b.textContent='데이터 분석';side.appendChild(b);
      b.addEventListener('click',()=>{nav('analytics');renderAnalytics()});
    }
    const mobile=document.querySelector('.mobile-nav');
    if(mobile){
      const b=document.createElement('button');
      b.dataset.page='analytics';b.textContent='분석';mobile.appendChild(b);
      b.addEventListener('click',()=>{nav('analytics');renderAnalytics()});
    }
    const main=document.querySelector('main.main');
    if(main){
      const s=document.createElement('section');
      s.id='analytics';s.className='page';
      s.innerHTML=`<div class="section-head"><div><h2>데이터 분석</h2><p>수업 · 수강생 · 매출 · 원가 데이터를 자동 집계해 운영 흐름을 시각화합니다.</p></div></div>
      <div class="analytics-wrap">
        <div class="analytics-controls" id="analyticsControls">
          <button class="seg" data-arange="all">전체</button>
          <button class="seg" data-arange="90">최근 90일</button>
          <button class="seg" data-arange="month">이번 달</button>
          <button class="seg" data-arange="next30">다음 30일</button>
        </div>
        <div id="analyticsKpis" class="analytics-kpis"></div>
        <div class="analytics-grid">
          <div class="analytics-card wide"><div class="analytics-head"><div><h3>월별 매출 흐름</h3><p>완료 수업 매출과 예약된 예정 수업 매출을 구분합니다.</p></div><span class="analytics-badge">Revenue trend</span></div><div id="revenueTrend"></div></div>
          <div class="analytics-card"><div class="analytics-head"><div><h3>메뉴별 매출</h3><p>현재 데이터 범위 내 매출 기여도 순위</p></div><span class="analytics-badge">Top menus</span></div><div id="menuRevenue"></div></div>
          <div class="analytics-card"><div class="analytics-head"><div><h3>좌석 충원율</h3><p>정원이 기록된 수업의 실제 수강생 비율</p></div><span class="analytics-badge">Fill rate</span></div><div id="fillRate"></div></div>
          <div class="analytics-card"><div class="analytics-head"><div><h3>예약 상태</h3><p>예정 수업의 마감 / 모집중 구성</p></div><span class="analytics-badge">Booking mix</span></div><div id="bookingMix"></div></div>
          <div class="analytics-card"><div class="analytics-head"><div><h3>원가 계산 가능 범위</h3><p>예정 메뉴 중 확정 원가가 연결된 비율</p></div><span class="analytics-badge">Cost coverage</span></div><div id="costCoverage"></div></div>
          <div class="analytics-card wide"><div class="analytics-head"><div><h3>요일 · 시간대 분포</h3><p>수업 편성 빈도를 히트맵으로 확인합니다.</p></div><span class="analytics-badge">Schedule heatmap</span></div><div id="scheduleHeatmap"></div></div>
          <div class="analytics-card wide"><div class="analytics-head"><div><h3>운영 인사이트</h3><p>현재 데이터에서 바로 확인할 수 있는 주요 신호</p></div></div><div id="analyticsInsights" class="insights"></div><div class="analytics-note">이익 분석은 레시피 원가가 확정되어 있고 대관료·추가비용이 입력된 일정만 계산합니다. 과거 기록 중 비용이 없는 수업에는 이익을 추정하지 않습니다.</div></div>
        </div>
      </div>`;
      main.appendChild(s);
      s.querySelectorAll('[data-arange]').forEach(b=>b.addEventListener('click',()=>{arange=b.dataset.arange;localStorage.setItem(AKEY,arange);renderAnalytics()}));
    }
  }

  function rawEvents(){
    const out=[];
    try{
      (history?.records||[]).forEach((r,i)=>out.push({id:`h${i}`,source:'history',date:r.date,time:r.time||'',status:'완료',bookingStatus:'완료',menu:r.menu||r.classTitle||'메뉴 미정',people:aNum(r.people),capacity:aNum(r.capacity)||aNum(r.people),fee:aNum(r.fee),revenue:r.revenue==null?aNum(r.people)*aNum(r.fee):aNum(r.revenue),raw:r}));
      (schedule?.rows||[]).forEach((r,i)=>out.push({id:r.id||`s${i}`,source:'schedule',date:r.date,time:r.time||'',status:r.status||'예정',bookingStatus:r.bookingStatus||'',menu:r.menu||r.classTitle||'메뉴 미정',people:aNum(r.people),capacity:aNum(r.capacity)||aNum(r.people),fee:aNum(r.fee),revenue:r.status==='취소'?0:aNum(r.people)*aNum(r.fee),raw:r}));
    }catch(e){}
    const seen=new Set();
    return out.filter(e=>{if(!e.date)return false;const k=`${e.date}|${e.time}|${e.menu}|${e.status}`;if(seen.has(k))return false;seen.add(k);return true}).sort((a,b)=>a.date.localeCompare(b.date)||(a.time||'').localeCompare(b.time||''));
  }

  function rangeEvents(all){
    const t=isoToday();
    if(arange==='90') return all.filter(e=>e.date>=plusDays(t,-90)&&e.date<=t);
    if(arange==='month') return all.filter(e=>e.date.slice(0,7)===t.slice(0,7));
    if(arange==='next30') return all.filter(e=>e.date>=t&&e.date<=plusDays(t,30)&&e.status!=='취소');
    return all;
  }

  function svgLine(months){
    if(!months.length)return '<div class="analytics-empty">표시할 매출 데이터가 없습니다.</div>';
    const W=760,H=245,L=52,R=18,T=18,B=42,iw=W-L-R,ih=H-T-B;
    const max=Math.max(1,...months.map(x=>Math.max(x.done,x.plan)));
    const y=v=>T+ih-(v/max)*ih;
    const x=i=>months.length===1?L+iw/2:L+(iw*i/(months.length-1));
    let grid='';for(let i=0;i<=4;i++){const yy=T+ih*i/4;const val=max*(1-i/4);grid+=`<line class="chart-grid-line" x1="${L}" y1="${yy}" x2="${W-R}" y2="${yy}"/><text class="chart-axis-text" x="${L-7}" y="${yy+3}" text-anchor="end">${Math.round(val/10000)}만</text>`}
    const path=k=>months.map((m,i)=>`${i?'L':'M'} ${x(i)} ${y(m[k])}`).join(' ');
    const area=`M ${x(0)} ${T+ih} `+months.map((m,i)=>`L ${x(i)} ${y(m.done)}`).join(' ')+` L ${x(months.length-1)} ${T+ih} Z`;
    const labels=months.map((m,i)=>`<text class="chart-axis-text" x="${x(i)}" y="${H-13}" text-anchor="middle">${aEsc(monthLabel(m.month))}</text>`).join('');
    const doneDots=months.map((m,i)=>`<circle class="chart-dot" cx="${x(i)}" cy="${y(m.done)}" r="4"><title>${aEsc(monthLabel(m.month))} 완료 ${aMoney(m.done)}</title></circle>`).join('');
    const planDots=months.map((m,i)=>`<circle cx="${x(i)}" cy="${y(m.plan)}" r="3.5" style="fill:var(--terra);stroke:var(--paper);stroke-width:2"><title>${aEsc(monthLabel(m.month))} 예정 ${aMoney(m.plan)}</title></circle>`).join('');
    return `<svg class="analytics-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="월별 매출 추이">${grid}<path class="chart-area" d="${area}"/><path class="chart-line" d="${path('done')}"/><path d="${path('plan')}" style="fill:none;stroke:var(--terra);stroke-width:2.5;stroke-dasharray:6 5;stroke-linecap:round;stroke-linejoin:round"/>${doneDots}${planDots}${labels}<g transform="translate(${W-210},3)"><circle cx="0" cy="8" r="4" class="chart-dot"/><text class="chart-axis-text" x="9" y="11">완료 매출</text><circle cx="90" cy="8" r="4" style="fill:var(--terra)"/><text class="chart-axis-text" x="99" y="11">예정 매출</text></g></svg>`;
  }

  function bars(rows,format='money',maxRows=8){
    if(!rows.length)return '<div class="analytics-empty">표시할 데이터가 없습니다.</div>';
    rows=rows.slice(0,maxRows);const mx=Math.max(1,...rows.map(x=>x.value));
    return `<div class="viz-list">${rows.map(x=>`<div class="viz-row"><div class="viz-name" title="${aEsc(x.name)}">${aEsc(x.name)}</div><div class="viz-track"><div class="viz-fill" style="width:${Math.max(2,Math.min(100,x.value/mx*100))}%"></div></div><div class="viz-value">${format==='pct'?`${Math.round(x.value)}%`:format==='count'?`${Math.round(x.value)}`:aMoney(x.value)}</div></div>`).join('')}</div>`;
  }

  function donut(a,b,labelA,labelB,centerLabel){
    const total=a+b,p=total?a/total*100:0;
    return `<div class="donut-layout"><div class="donut" style="background:conic-gradient(var(--blue) 0 ${p}%,var(--terra) ${p}% 100%)"><div class="donut-center"><b>${total?Math.round(p)+'%':'—'}</b><span>${aEsc(centerLabel)}</span></div></div><div class="legend"><div class="legend-row"><div class="legend-left"><i class="legend-dot" style="background:var(--blue)"></i><span>${aEsc(labelA)}</span></div><b>${a}</b></div><div class="legend-row"><div class="legend-left"><i class="legend-dot" style="background:var(--terra)"></i><span>${aEsc(labelB)}</span></div><b>${b}</b></div></div></div>`;
  }

  function heatmap(ev){
    const days=['일','월','화','수','목','금','토'],slots=['오전','오후','저녁'];
    const vals={};slots.forEach(s=>days.forEach(d=>vals[`${s}|${d}`]=0));
    ev.forEach(e=>{const h=Number(String(e.time||'10:00').split(':')[0]);const slot=h<12?'오전':h<17?'오후':'저녁';vals[`${slot}|${dayName(e.date)}`]++});
    const max=Math.max(1,...Object.values(vals));
    let html='<div class="heatmap"><div></div>'+days.map(d=>`<div class="heat-label">${d}</div>`).join('');
    slots.forEach(s=>{html+=`<div class="heat-label">${s}</div>`+days.map(d=>{const v=vals[`${s}|${d}`];const heat=Math.round(v/max*8);return `<div class="heat-cell" style="--heat:${heat}" title="${s} ${d}요일 ${v}회">${v||''}</div>`}).join('')});
    return html+'</div>';
  }

  function knownCostFor(e){
    try{const r=(recipes||[]).find(x=>x.name===e.menu);if(!r)return false;return r.cost!=null&&!['부분원가','미산정'].includes(r.cost_status)}catch(err){return false}
  }

  function renderAnalytics(){
    installUI();if(!A$('analyticsKpis'))return;
    document.querySelectorAll('[data-arange]').forEach(b=>b.classList.toggle('active',b.dataset.arange===arange));
    const all=rawEvents(),ev=rangeEvents(all),today=isoToday();
    const completed=ev.filter(e=>e.status==='완료'),future=ev.filter(e=>e.source==='schedule'&&e.date>=today&&e.status!=='취소');
    const revDone=completed.reduce((s,e)=>s+e.revenue,0),revPlan=future.reduce((s,e)=>s+e.revenue,0);
    const capEv=ev.filter(e=>e.capacity>0),avgFill=capEv.length?capEv.reduce((s,e)=>s+Math.min(1,e.people/e.capacity),0)/capEv.length*100:0;
    const openSeats=future.reduce((s,e)=>s+Math.max(0,e.capacity-e.people),0);
    const known=future.filter(knownCostFor).length,coverage=future.length?known/future.length*100:0;
    const avgTicket=ev.reduce((s,e)=>s+e.people,0)?ev.reduce((s,e)=>s+e.revenue,0)/ev.reduce((s,e)=>s+e.people,0):0;
    A$('analyticsKpis').innerHTML=[
      ['완료 매출',aMoney(revDone),`${completed.length}회 완료`],['예약 매출',aMoney(revPlan),`${future.length}회 예정`],['평균 충원율',capEv.length?`${Math.round(avgFill)}%`:'—',`${capEv.length}개 수업 기준`],['남은 좌석',`${openSeats}석`,'예정 수업 합계'],['원가 연결률',future.length?`${Math.round(coverage)}%`:'—',`${known}/${future.length}개 예정 메뉴`]
    ].map(x=>`<div class="analytics-kpi"><div class="ak-label">${x[0]}</div><div class="ak-value">${x[1]}</div><div class="ak-sub">${x[2]}</div></div>`).join('');

    const mm={};ev.forEach(e=>{const k=monthKey(e.date);if(!mm[k])mm[k]={month:k,done:0,plan:0};if(e.status==='완료')mm[k].done+=e.revenue;else if(e.source==='schedule'&&e.status!=='취소')mm[k].plan+=e.revenue});
    A$('revenueTrend').innerHTML=svgLine(Object.values(mm).sort((a,b)=>a.month.localeCompare(b.month)));

    const byMenu={};ev.filter(e=>e.status!=='취소').forEach(e=>{const k=e.menu||'메뉴 미정';byMenu[k]=(byMenu[k]||0)+e.revenue});
    A$('menuRevenue').innerHTML=bars(Object.entries(byMenu).map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value),'money',8);

    const fillRows=ev.filter(e=>e.capacity>0&&e.status!=='취소').map(e=>({name:`${e.date.slice(5)} ${e.menu}`,value:Math.min(100,e.people/e.capacity*100)})).sort((a,b)=>b.value-a.value);
    A$('fillRate').innerHTML=bars(fillRows,'pct',8);

    const closed=future.filter(e=>e.bookingStatus==='마감'||(e.capacity>0&&e.people>=e.capacity)).length,open=future.length-closed;
    A$('bookingMix').innerHTML=future.length?donut(closed,open,'마감','모집중','마감 비율'):'<div class="analytics-empty">예정 수업이 없습니다.</div>';
    A$('costCoverage').innerHTML=future.length?donut(known,future.length-known,'원가 연결','미연결/미확정','원가 연결률'):'<div class="analytics-empty">예정 수업이 없습니다.</div>';
    A$('scheduleHeatmap').innerHTML=heatmap(ev.filter(e=>e.status!=='취소'));

    const menuRank=Object.entries(byMenu).sort((a,b)=>b[1]-a[1]);
    const best=menuRank[0];
    const fillSorted=ev.filter(e=>e.capacity>0&&e.status!=='취소').sort((a,b)=>(b.people/b.capacity)-(a.people/a.capacity));
    const bestFill=fillSorted[0];
    const missingMenus=[...new Set(future.filter(e=>!knownCostFor(e)).map(e=>e.menu))].filter(Boolean);
    const insights=[];
    insights.push({k:'Revenue leader',b:best?best[0]:'데이터 없음',p:best?`선택 기간 매출 ${aMoney(best[1])}로 가장 큰 매출 기여도를 보입니다.`:'매출 데이터가 충분하지 않습니다.'});
    insights.push({k:'Seat utilization',b:capEv.length?`평균 ${Math.round(avgFill)}% 충원`:'정원 데이터 없음',p:bestFill?`최고 충원 수업은 ${bestFill.date.slice(5)} ${bestFill.menu} (${bestFill.people}/${bestFill.capacity}명)입니다.`:'정원이 입력된 수업이 없습니다.'});
    insights.push({k:'Cost visibility',b:future.length?`${known}/${future.length}개 원가 연결`:'예정 수업 없음',p:missingMenus.length?`원가 보완 필요: ${missingMenus.slice(0,4).join(', ')}${missingMenus.length>4?' 외 '+(missingMenus.length-4)+'개':''}`:'예정 메뉴의 원가가 모두 연결되어 있습니다.'});
    if(openSeats>0)insights.push({k:'Open seats',b:`현재 ${openSeats}석 모집 가능`,p:'모집중 수업의 잔여 좌석을 합산한 값입니다. 홍보 우선순위 설정에 활용할 수 있습니다.'});
    if(avgTicket)insights.push({k:'Revenue per student',b:`학생 1명당 ${aMoney(avgTicket)}`,p:'선택 기간의 총 매출을 실제 수강생 수로 나눈 단순 평균입니다.'});
    A$('analyticsInsights').innerHTML=insights.slice(0,6).map(i=>`<div class="insight"><div class="i-kicker">${aEsc(i.k)}</div><b>${aEsc(i.b)}</b><p>${aEsc(i.p)}</p></div>`).join('');
  }

  installUI();
  try{
    const baseRenderAll=renderAll;
    renderAll=function(){baseRenderAll();renderAnalytics()};
  }catch(e){}
  setTimeout(renderAnalytics,250);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')setTimeout(renderAnalytics,100)});
})();
