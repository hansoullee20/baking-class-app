(() => {
  const A$=id=>document.getElementById(id);
  const num=v=>Number.isFinite(Number(v))?Number(v):0;
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const won=v=>Number.isFinite(Number(v))?'₩'+Math.round(Number(v)).toLocaleString('ko-KR'):'—';
  const todayISO=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
  const dateObj=s=>new Date(`${s}T00:00:00`);
  const addDays=(s,k)=>{const d=dateObj(s);d.setDate(d.getDate()+k);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
  const dayName=s=>['일','월','화','수','목','금','토'][dateObj(s).getDay()];
  const monthLabel=k=>{const [y,m]=k.split('-');return `${Number(m)}월${String(new Date().getFullYear())===y?'':` '${y.slice(2)}`}`};

  function removeOldAnalysis(){
    document.querySelectorAll('[data-page="analytics"]').forEach(x=>x.remove());
    A$('analytics')?.remove();
  }

  function card(title,sub,id,wide=false){return `<div class="analytics-card${wide?' wide':''}"><div class="analytics-head"><div><h3>${title}</h3><p>${sub}</p></div></div><div id="${id}"></div></div>`}

  function install(){
    removeOldAnalysis();
    if(!A$('dashboardAnalytics')){
      const host=document.querySelector('#dashboard .grid2');
      if(host){const s=document.createElement('div');s.id='dashboardAnalytics';s.className='embedded-analytics';s.innerHTML=`<div class="analytics-kpis" id="opsKpis"></div><div class="analytics-grid">${card('매출 흐름','완료 매출과 예약 매출을 월별로 비교합니다.','opsRevenue',true)}${card('운영 신호','현재 운영 데이터에서 바로 확인할 포인트','opsInsights',true)}</div>`;host.after(s)}
    }
    if(!A$('scheduleAnalytics')){
      const list=A$('scheduleList');
      if(list){const s=document.createElement('div');s.id='scheduleAnalytics';s.className='embedded-analytics analytics-grid';s.innerHTML=card('예정 수업 충원율','실제 수강생 / 학생 정원 기준','scheduleFill')+card('예약 상태 · 남은 좌석','마감과 모집중 비중, 현재 모집 가능한 좌석','scheduleBooking');list.before(s)}
    }
    if(!A$('calendarAnalytics')){
      const sec=A$('calendar');
      if(sec){const s=document.createElement('div');s.id='calendarAnalytics';s.className='embedded-analytics';s.innerHTML=card('수업 편성 히트맵','요일과 시간대별 수업 빈도를 확인합니다.','calendarHeat',true);sec.appendChild(s)}
    }
    if(!A$('recipeAnalytics')){
      const tools=document.querySelector('#recipes .recipe-tools');
      if(tools){const s=document.createElement('div');s.id='recipeAnalytics';s.className='embedded-analytics analytics-grid compact';s.innerHTML=card('원가 데이터 완성도','레시피별 원가 상태와 예정 수업 연결 상태','recipeCoverage',true);tools.after(s)}
    }
    if(!A$('financeAnalytics')){
      const k=A$('financeKpis');
      if(k){const s=document.createElement('div');s.id='financeAnalytics';s.className='embedded-analytics analytics-grid';s.innerHTML=card('메뉴별 매출 기여','선택한 기간의 메뉴별 매출 순위','financeMenu')+card('원가 · 이익 계산 가능 범위','선택 기간 일정 중 확정 원가가 연결된 비율','financeCoverage');k.after(s)}
    }
  }

  function events(){
    const out=[];
    try{
      (history?.records||[]).forEach((r,i)=>out.push({id:`h${i}`,source:'history',date:r.date,time:r.time||'',status:'완료',bookingStatus:'완료',menu:r.menu||r.classTitle||'메뉴 미정',people:num(r.people),capacity:num(r.capacity)||num(r.people),fee:num(r.fee),revenue:r.revenue==null?num(r.people)*num(r.fee):num(r.revenue),raw:r}));
      (schedule?.rows||[]).forEach((r,i)=>out.push({id:r.id||`s${i}`,source:'schedule',date:r.date,time:r.time||'',status:r.status||'예정',bookingStatus:r.bookingStatus||'',menu:r.menu||r.classTitle||'메뉴 미정',people:num(r.people),capacity:num(r.capacity)||num(r.people),fee:num(r.fee),revenue:r.status==='취소'?0:num(r.people)*num(r.fee),raw:r}));
    }catch(e){}
    const seen=new Set();
    return out.filter(e=>{if(!e.date)return false;const k=`${e.date}|${e.time}|${e.menu}|${e.status}`;if(seen.has(k))return false;seen.add(k);return true}).sort((a,b)=>a.date.localeCompare(b.date)||(a.time||'').localeCompare(b.time||''));
  }

  function recipeFor(menu){try{return (recipes||[]).find(r=>r.name===menu)||null}catch(e){return null}}
  function knownCost(menu){const r=recipeFor(menu);return !!r&&r.cost!=null&&!['부분원가','미산정'].includes(r.cost_status)}

  function bars(rows,format='money',limit=8){
    if(!rows.length)return '<div class="analytics-empty">표시할 데이터가 없습니다.</div>';
    rows=rows.slice(0,limit);const mx=Math.max(1,...rows.map(x=>x.value));
    return `<div class="viz-list">${rows.map(x=>`<div class="viz-row"><div class="viz-name" title="${esc(x.name)}">${esc(x.name)}</div><div class="viz-track"><div class="viz-fill" style="width:${Math.max(2,Math.min(100,x.value/mx*100))}%"></div></div><div class="viz-value">${format==='pct'?Math.round(x.value)+'%':format==='count'?Math.round(x.value):won(x.value)}</div></div>`).join('')}</div>`;
  }

  function donut(a,b,labelA,labelB,center){
    const total=a+b,p=total?a/total*100:0;
    return `<div class="donut-layout"><div class="donut" style="background:conic-gradient(var(--blue) 0 ${p}%,var(--terra) ${p}% 100%)"><div class="donut-center"><b>${total?Math.round(p)+'%':'—'}</b><span>${esc(center)}</span></div></div><div class="legend"><div class="legend-row"><div class="legend-left"><i class="legend-dot" style="background:var(--blue)"></i><span>${esc(labelA)}</span></div><b>${a}</b></div><div class="legend-row"><div class="legend-left"><i class="legend-dot" style="background:var(--terra)"></i><span>${esc(labelB)}</span></div><b>${b}</b></div></div></div>`;
  }

  function revenueChart(ev){
    const by={};ev.forEach(e=>{const m=e.date.slice(0,7);by[m]??={month:m,done:0,plan:0};if(e.status==='완료')by[m].done+=e.revenue;else if(e.source==='schedule'&&e.status!=='취소')by[m].plan+=e.revenue});
    const months=Object.values(by).sort((a,b)=>a.month.localeCompare(b.month)).slice(-6);
    if(!months.length)return '<div class="analytics-empty">매출 데이터가 없습니다.</div>';
    const W=760,H=220,L=50,R=16,T=18,B=38,iw=W-L-R,ih=H-T-B,max=Math.max(1,...months.map(x=>Math.max(x.done,x.plan))),x=i=>months.length===1?L+iw/2:L+iw*i/(months.length-1),y=v=>T+ih-v/max*ih;
    let grid='';for(let i=0;i<=4;i++){const yy=T+ih*i/4,val=max*(1-i/4);grid+=`<line class="chart-grid-line" x1="${L}" y1="${yy}" x2="${W-R}" y2="${yy}"/><text class="chart-axis-text" x="${L-6}" y="${yy+3}" text-anchor="end">${Math.round(val/10000)}만</text>`}
    const path=k=>months.map((m,i)=>`${i?'L':'M'} ${x(i)} ${y(m[k])}`).join(' '),labels=months.map((m,i)=>`<text class="chart-axis-text" x="${x(i)}" y="${H-12}" text-anchor="middle">${esc(monthLabel(m.month))}</text>`).join('');
    return `<svg class="analytics-svg" viewBox="0 0 ${W} ${H}">${grid}<path class="chart-line" d="${path('done')}"/><path d="${path('plan')}" style="fill:none;stroke:var(--terra);stroke-width:2.5;stroke-dasharray:6 5;stroke-linecap:round"/>${months.map((m,i)=>`<circle class="chart-dot" cx="${x(i)}" cy="${y(m.done)}" r="4"><title>${esc(monthLabel(m.month))} 완료 ${won(m.done)}</title></circle><circle cx="${x(i)}" cy="${y(m.plan)}" r="3.5" style="fill:var(--terra);stroke:var(--paper);stroke-width:2"><title>${esc(monthLabel(m.month))} 예약 ${won(m.plan)}</title></circle>`).join('')}${labels}</svg><div class="mini-legend"><span><i style="background:var(--blue)"></i>완료 매출</span><span><i style="background:var(--terra)"></i>예약 매출</span></div>`;
  }

  function heatmap(ev){
    const days=['일','월','화','수','목','금','토'],slots=['오전','오후','저녁'],vals={};slots.forEach(s=>days.forEach(d=>vals[`${s}|${d}`]=0));
    ev.forEach(e=>{const h=Number(String(e.time||'10:00').split(':')[0]),slot=h<12?'오전':h<17?'오후':'저녁';vals[`${slot}|${dayName(e.date)}`]++});
    const max=Math.max(1,...Object.values(vals));let html='<div class="heatmap"><div></div>'+days.map(d=>`<div class="heat-label">${d}</div>`).join('');
    slots.forEach(s=>{html+=`<div class="heat-label">${s}</div>`+days.map(d=>{const v=vals[`${s}|${d}`];return `<div class="heat-cell" style="--heat:${Math.round(v/max*8)}" title="${s} ${d}요일 ${v}회">${v||''}</div>`}).join('')});return html+'</div>';
  }

  function renderDashboardBits(all){
    const t=todayISO(),future=all.filter(e=>e.source==='schedule'&&e.date>=t&&e.status!=='취소'),completed=all.filter(e=>e.status==='완료'),cap=future.filter(e=>e.capacity>0),fill=cap.length?cap.reduce((s,e)=>s+Math.min(1,e.people/e.capacity),0)/cap.length*100:0,open=future.reduce((s,e)=>s+Math.max(0,e.capacity-e.people),0),known=future.filter(e=>knownCost(e.menu)).length;
    A$('opsKpis').innerHTML=[['예약 매출',won(future.reduce((s,e)=>s+e.revenue,0)),`${future.length}회 예정`],['예정 충원율',cap.length?`${Math.round(fill)}%`:'—',`${cap.length}개 수업 기준`],['남은 좌석',`${open}석`,'모집 가능한 학생 좌석'],['원가 연결률',future.length?`${Math.round(known/future.length*100)}%`:'—',`${known}/${future.length}개 예정 메뉴`]].map(x=>`<div class="analytics-kpi"><div class="ak-label">${x[0]}</div><div class="ak-value">${x[1]}</div><div class="ak-sub">${x[2]}</div></div>`).join('');
    A$('opsRevenue').innerHTML=revenueChart(all);
    const menu={};completed.forEach(e=>menu[e.menu]=(menu[e.menu]||0)+e.revenue);const top=Object.entries(menu).sort((a,b)=>b[1]-a[1])[0],missing=[...new Set(future.filter(e=>!knownCost(e.menu)).map(e=>e.menu))];
    A$('opsInsights').innerHTML=`<div class="insights"><div class="insight"><div class="i-kicker">Revenue</div><b>${top?`${esc(top[0])} ${won(top[1])}`:'완료 매출 데이터 없음'}</b><p>현재 기록에서 누적 완료 매출이 가장 큰 메뉴입니다.</p></div><div class="insight"><div class="i-kicker">Seats</div><b>${open?`${open}석 모집 가능`:'예정 수업 좌석 마감'}</b><p>예정 수업의 정원에서 현재 수강생을 뺀 값입니다.</p></div><div class="insight"><div class="i-kicker">Cost</div><b>${missing.length?`${missing.length}개 메뉴 원가 보완 필요`:'예정 메뉴 원가 연결 완료'}</b><p>${missing.length?esc(missing.slice(0,4).join(', ')+(missing.length>4?' 외':'')):'현재 예정 수업 기준입니다.'}</p></div></div>`;
  }

  function renderScheduleBits(all){
    const t=todayISO(),future=all.filter(e=>e.source==='schedule'&&e.date>=t&&e.status!=='취소');
    A$('scheduleFill').innerHTML=bars(future.filter(e=>e.capacity>0).map(e=>({name:`${e.date.slice(5)} ${e.menu}`,value:e.capacity?e.people/e.capacity*100:0})).sort((a,b)=>b.value-a.value),'pct',10);
    const closed=future.filter(e=>e.bookingStatus==='마감'||(e.capacity>0&&e.people>=e.capacity)).length,open=future.length-closed,seats=future.reduce((s,e)=>s+Math.max(0,e.capacity-e.people),0);A$('scheduleBooking').innerHTML=donut(closed,open,'마감','모집중','마감 비율')+`<div class="analytics-note">현재 모집 가능한 학생 좌석: <b>${seats}석</b></div>`;
  }

  function renderRecipeBits(){
    const list=Array.isArray(recipes)?recipes:[],final=list.filter(r=>r.cost!=null&&!['부분원가','미산정'].includes(r.cost_status)).length,partial=list.filter(r=>r.partial_cost!=null&&!(r.cost!=null&&!['부분원가','미산정'].includes(r.cost_status))).length,missing=list.length-final-partial,t=todayISO(),future=(schedule?.rows||[]).filter(r=>r.date>=t&&r.status!=='취소'),missingMenus=[...new Set(future.filter(r=>!knownCost(r.menu||r.classTitle)).map(r=>r.menu||r.classTitle).filter(Boolean))];
    A$('recipeCoverage').innerHTML=`<div class="coverage-inline">${donut(final,partial+missing,'확정/조건부','부분/미산정','확정 원가')}<div class="coverage-copy"><b>${final}/${list.length}개 레시피 원가 사용 가능</b><p>부분원가 ${partial}개 · 미산정 ${missing}개</p><p>${missingMenus.length?`예정 수업 원가 미연결: ${esc(missingMenus.join(', '))}`:'예정 수업 메뉴의 원가가 모두 연결되어 있습니다.'}</p></div></div>`;
  }

  function renderFinanceBits(all){
    const a=A$('periodStart')?.value||'0000-01-01',b=A$('periodEnd')?.value||'9999-12-31',ev=all.filter(e=>e.date>=a&&e.date<=b&&e.status!=='취소'),by={};ev.forEach(e=>by[e.menu]=(by[e.menu]||0)+e.revenue);A$('financeMenu').innerHTML=bars(Object.entries(by).map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value),'money',8);
    const scheduled=ev.filter(e=>e.source==='schedule'),known=scheduled.filter(e=>knownCost(e.menu)).length;A$('financeCoverage').innerHTML=donut(known,scheduled.length-known,'원가 연결','원가 미연결','계산 가능')+`<div class="analytics-note">선택 기간의 일정 ${scheduled.length}개 중 ${known}개가 확정/조건부 레시피 원가와 연결되어 있습니다.</div>`;
  }

  function renderEmbedded(){
    install();const all=events();if(A$('opsKpis'))renderDashboardBits(all);if(A$('scheduleFill'))renderScheduleBits(all);if(A$('calendarHeat'))A$('calendarHeat').innerHTML=heatmap(all.filter(e=>e.date>=addDays(todayISO(),-90)&&e.date<=addDays(todayISO(),90)));if(A$('recipeCoverage'))renderRecipeBits();if(A$('financeMenu'))renderFinanceBits(all);
  }

  install();
  try{const base=renderAll;renderAll=function(){base();setTimeout(renderEmbedded,0)}}catch(e){}
  try{const baseF=renderFinance;renderFinance=function(){baseF();setTimeout(()=>renderFinanceBits(events()),0)}}catch(e){}
  setTimeout(renderEmbedded,250);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')setTimeout(renderEmbedded,100)});
})();
